import type { SpeechSpeed, VoiceServiceInterface } from '@/services/voice/VoiceService';
import { GeminiLiveService, type LiveProfile, type LiveSessionState } from '@/services/ai/GeminiLiveService';
import {
  MIC_PCM_RATE,
  MIC_CONSTRAINTS,
  PLAYBACK_PCM_RATE,
  createOrResumeAudioContext,
  resumeAudioContextIfNeeded,
  resampleLinearPcm,
  decodePcm16LE,
  parsePcmSampleRate,
} from '@/services/voice/AudioPipeline';
import { stopAllAudio } from '@/services/voice/AudioPlayback';
import { audioStreamPlayer } from '@/services/voice/AudioStreamPlayer';
import { isLiveSessionCurrent } from '@/services/voice/LiveSessionRegistry';

const DEV = typeof import.meta !== 'undefined' && !!(import.meta as { env?: { DEV?: boolean } }).env?.DEV;

export type MicCaptureState =
  | 'IDLE'
  | 'REQUESTING_PERMISSION'
  | 'LISTENING'
  | 'STOPPING'
  | 'ERROR';

function floatTo16BitPCM(float32: Float32Array): ArrayBuffer {
  const buffer = new ArrayBuffer(float32.length * 2);
  const view = new DataView(buffer);
  for (let i = 0; i < float32.length; i++) {
    let s = Math.max(-1, Math.min(1, float32[i]));
    s = s < 0 ? s * 0x8000 : s * 0x7fff;
    view.setInt16(i * 2, s, true);
  }
  return buffer;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)));
  }
  return btoa(binary);
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

export interface GeminiVoiceHandlers {
  onStateChange?: (state: LiveSessionState) => void;
  onTranscript?: (role: 'user' | 'assistant', text: string, meta?: { delta?: string; complete?: boolean }) => void;
  onTurnComplete?: (role?: 'user' | 'assistant', text?: string) => void;
  onError?: (message: string) => void;
  onMicLevel?: (level: number) => void;
  onMicDevice?: (label: string) => void;
  onMicState?: (state: MicCaptureState) => void;
}

export class GeminiVoiceService implements VoiceServiceInterface {
  private live: GeminiLiveService;
  private micContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private processorNode: ScriptProcessorNode | null = null;
  private silentGain: GainNode | null = null;
  private listening = false;
  private micAcquired = false;
  private speaking = false;
  private handlers: GeminiVoiceHandlers;
  private preferredDeviceId: string | null = null;
  private micState: MicCaptureState = 'IDLE';
  private chunksSent = 0;
  private bytesSent = 0;
  private visibilityHandler: (() => void) | null = null;
  private backgroundSuspended = false;
  private readonly sessionGen: number;

  setMicDeviceId(id: string | null): void {
    this.preferredDeviceId = id;
  }

  constructor(
    profile: LiveProfile,
    handlers: GeminiVoiceHandlers,
    backendUrl?: string,
    sessionGen?: number,
  ) {
    this.sessionGen = sessionGen ?? 0;
    this.handlers = handlers;
    this.live = new GeminiLiveService(
      profile,
      {
        onStateChange: (s) => {
          this.handlers.onStateChange?.(s);
        },
        onAudio: (b64, mime) => {
          if (!isLiveSessionCurrent(this.sessionGen)) return;
          const pcm = base64ToArrayBuffer(b64);
          const float = decodePcm16LE(pcm);
          const rate = parsePcmSampleRate(mime, PLAYBACK_PCM_RATE);
          const chunk24k =
            rate === PLAYBACK_PCM_RATE
              ? float
              : resampleLinearPcm(float, rate, PLAYBACK_PCM_RATE);
          this.speaking = true;
          audioStreamPlayer.enqueue(chunk24k, this.sessionGen);
        },
        onTranscript: (role, text, meta) => {
          if (!isLiveSessionCurrent(this.sessionGen)) return;
          if (role === 'assistant') this.speaking = true;
          this.handlers.onTranscript?.(role, text, meta);
        },
        onTurnComplete: (role, text) => {
          if (!isLiveSessionCurrent(this.sessionGen)) return;
          this.speaking = false;
          this.handlers.onTurnComplete?.(role, text);
        },
        onInterrupted: (text) => {
          if (!isLiveSessionCurrent(this.sessionGen)) return;
          stopAllAudio();
          this.speaking = false;
          this.handlers.onTurnComplete?.('assistant', text);
        },
        onError: (m) => this.handlers.onError?.(m),
      },
      backendUrl,
    );
    this.bindVisibilityHandling();
  }

  getMicState(): MicCaptureState {
    return this.micState;
  }

  getInputStats() {
    return { chunksSent: this.chunksSent, bytesSent: this.bytesSent };
  }

  private setMicState(s: MicCaptureState) {
    this.micState = s;
    this.handlers.onMicState?.(s);
  }

  isSupported(): boolean {
    return !!(
      typeof navigator !== 'undefined' &&
      !!navigator.mediaDevices &&
      ('AudioContext' in window || 'webkitAudioContext' in window)
    );
  }

  setLanguage(_lang: string): void {}
  setSpeed(_speed: SpeechSpeed): void {}
  setVoice(_voiceName?: string): void {}

  isListening(): boolean {
    return this.listening;
  }

  isSpeaking(): boolean {
    return this.speaking || audioStreamPlayer.getIsPlaying();
  }

  async preparePlaybackOnGesture(): Promise<void> {
    audioStreamPlayer.resetForSession(this.sessionGen);
  }

  async connect(): Promise<void> {
    stopAllAudio();
    await this.live.connect();
  }

  getSessionState(): LiveSessionState {
    return this.live.getState();
  }

  attachAcquiredMic(ctx: AudioContext, stream: MediaStream): void {
    this.micContext = ctx;
    this.mediaStream = stream;
    this.micAcquired = true;
    const track = stream.getAudioTracks()[0];
    if (track) this.handlers.onMicDevice?.(track.label || 'dispositivo sem nome');
    this.setMicState('IDLE');
  }

  async acquireMic(): Promise<void> {
    if (this.micAcquired && this.mediaStream) {
      const track = this.mediaStream.getAudioTracks()[0];
      if (track && track.readyState === 'live') return;
    }
    this.setMicState('REQUESTING_PERMISSION');
    try {
      this.micContext = await createOrResumeAudioContext(this.micContext, MIC_PCM_RATE);

      const audioConstraint: MediaTrackConstraints = { ...MIC_CONSTRAINTS };
      if (this.preferredDeviceId) audioConstraint.deviceId = { exact: this.preferredDeviceId };
      this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraint });

      const tracks = this.mediaStream.getAudioTracks();
      const track = tracks[0];
      if (!this.mediaStream || tracks.length === 0 || !track || track.readyState !== 'live') {
        throw new Error('microphone_inactive');
      }

      const label = track.label || 'dispositivo sem nome';
      if (DEV) {
        console.log('[VOICE INPUT] AudioContext sampleRate =', this.micContext.sampleRate);
      }
      this.handlers.onMicDevice?.(label);
      this.micAcquired = true;
      this.setMicState('IDLE');
    } catch (e) {
      this.setMicState('ERROR');
      this.micAcquired = false;
      throw e instanceof Error && e.message === 'microphone_inactive'
        ? e
        : new Error('microphone_denied');
    }
  }

  beginSending(): void {
    if (this.listening) return;
    if (!this.micContext || !this.mediaStream) {
      throw new Error('microphone_not_acquired');
    }
    void resumeAudioContextIfNeeded(this.micContext);

    this.teardownProcessor();

    const nativeRate = this.micContext.sampleRate;
    this.sourceNode = this.micContext.createMediaStreamSource(this.mediaStream);
    this.processorNode = this.micContext.createScriptProcessor(4096, 1, 1);
    this.silentGain = this.micContext.createGain();
    this.silentGain.gain.value = 0;

    this.chunksSent = 0;
    this.bytesSent = 0;
    let levelEmit = 0;

    this.processorNode.onaudioprocess = (e) => {
      if (!this.listening) return;
      if (!this.live.isConnected()) return;
      const input = e.inputBuffer.getChannelData(0);
      let sumSq = 0;
      for (let i = 0; i < input.length; i += 64) sumSq += input[i] * input[i];
      const rms = Math.sqrt(sumSq / (input.length / 64));
      const now = performance.now();
      if (now - levelEmit > 100) {
        levelEmit = now;
        this.handlers.onMicLevel?.(Math.min(1, rms * 4));
      }
      const resampled = resampleLinearPcm(input, nativeRate, MIC_PCM_RATE);
      const pcm = floatTo16BitPCM(resampled);
      this.chunksSent += 1;
      this.bytesSent += pcm.byteLength;
      const b64 = arrayBufferToBase64(pcm);
      void this.live.sendAudio(b64);
    };

    this.sourceNode.connect(this.processorNode);
    this.processorNode.connect(this.silentGain);
    this.silentGain.connect(this.micContext.destination);
    this.listening = true;
    this.setMicState('LISTENING');
  }

  async startMic(): Promise<void> {
    await this.acquireMic();
    this.beginSending();
  }

  private teardownProcessor(): void {
    try { this.processorNode?.disconnect(); } catch { /* ignore */ }
    try { this.sourceNode?.disconnect(); } catch { /* ignore */ }
    try { this.silentGain?.disconnect(); } catch { /* ignore */ }
    this.processorNode = null;
    this.sourceNode = null;
    this.silentGain = null;
  }

  stopMic(): void {
    this.setMicState('STOPPING');
    this.listening = false;
    this.teardownProcessor();
    this.mediaStream?.getTracks().forEach((t) => t.stop());
    this.mediaStream = null;
    this.micAcquired = false;
    this.setMicState('IDLE');
  }

  listen(): Promise<string> {
    return new Promise((resolve) => {
      const handler = (role: 'user' | 'assistant', text: string) => {
        if (role === 'user' && text) resolve(text);
      };
      const prev = this.handlers.onTranscript;
      this.handlers.onTranscript = (r, t) => {
        prev?.(r, t);
        handler(r, t);
      };
    });
  }

  stopListening(): void {
    this.stopMic();
  }

  async recognizeSpeech(_audioBlob?: Blob): Promise<string> {
    return '';
  }

  speak(text: string, _lang = 'de-DE'): Promise<void> {
    stopAllAudio();
    this.speaking = false;
    return this.live.sendText(text);
  }

  sendUserText(text: string): Promise<void> {
    return this.live.sendText(text);
  }

  stopSpeaking(): void {
    this.live.interrupt();
    audioStreamPlayer.stopAll();
    this.speaking = false;
  }

  interrupt(): void {
    this.live.interrupt();
    audioStreamPlayer.stopAll();
    this.speaking = false;
  }

  disconnect(): void {
    this.unbindVisibilityHandling();
    this.stopMic();
    audioStreamPlayer.stopAll();
    this.live.disconnect();
    void this.micContext?.close();
    this.micContext = null;
  }

  private bindVisibilityHandling(): void {
    if (typeof document === 'undefined' || this.visibilityHandler) return;
    this.visibilityHandler = () => {
      if (document.hidden) {
        this.handleTabHidden();
      } else {
        void this.handleTabVisible();
      }
    };
    document.addEventListener('visibilitychange', this.visibilityHandler);
  }

  private unbindVisibilityHandling(): void {
    if (this.visibilityHandler) {
      document.removeEventListener('visibilitychange', this.visibilityHandler);
      this.visibilityHandler = null;
    }
  }

  private handleTabHidden(): void {
    audioStreamPlayer.stopAll();
    this.speaking = false;
    this.backgroundSuspended = true;
    void this.micContext?.suspend();
  }

  private async handleTabVisible(): Promise<void> {
    if (!this.backgroundSuspended) return;
    this.backgroundSuspended = false;
    await resumeAudioContextIfNeeded(this.micContext);
  }
}
