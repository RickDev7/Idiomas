import type { SpeechSpeed, VoiceServiceInterface } from '@/services/voice/VoiceService';
import { GeminiLiveService, type LiveProfile, type LiveSessionState } from '@/services/ai/GeminiLiveService';
import {
  MIC_PCM_RATE,
  PLAYBACK_PCM_RATE,
  MAX_PLAYBACK_QUEUE_CHUNKS,
  MAX_PLAYBACK_LAG_MS,
  MIC_CONSTRAINTS,
  createOrResumeAudioContext,
  resumeAudioContextIfNeeded,
  applyChunkFade,
  parsePcmSampleRate,
  playbackScheduleLagMs,
  type QueuedPcmChunk,
} from '@/services/voice/AudioPipeline';
import {
  registerGeminiPlaybackStop,
  stopAllAudio,
  stopBrowserAudio,
} from '@/services/voice/AudioPlayback';

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

function resampleLinear(input: Float32Array, origRate: number, destRate: number): Float32Array {
  if (origRate === destRate) return input;
  const ratio = origRate / destRate;
  const outLen = Math.floor(input.length / ratio);
  const out = new Float32Array(outLen);
  for (let i = 0; i < outLen; i++) {
    const srcPos = i * ratio;
    const i0 = Math.floor(srcPos);
    const i1 = Math.min(i0 + 1, input.length - 1);
    const frac = srcPos - i0;
    out[i] = input[i0] * (1 - frac) + input[i1] * frac;
  }
  return out;
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

type ActivePlaybackNode = {
  source: AudioBufferSourceNode;
  gain: GainNode;
};

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
  private playbackContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private processorNode: ScriptProcessorNode | null = null;
  private silentGain: GainNode | null = null;
  private listening = false;
  private micAcquired = false;
  private speaking = false;
  private playbackQueue: QueuedPcmChunk[] = [];
  private playing = false;
  private handlers: GeminiVoiceHandlers;
  private preferredDeviceId: string | null = null;
  private micState: MicCaptureState = 'IDLE';
  private chunksSent = 0;
  private bytesSent = 0;
  private nextStartTime = 0;
  private activeNodes: ActivePlaybackNode[] = [];
  private lastPacketAt = 0;
  private visibilityHandler: (() => void) | null = null;
  private backgroundSuspended = false;
  private unregisterGeminiStop: (() => void) | null = null;

  setMicDeviceId(id: string | null): void {
    this.preferredDeviceId = id;
  }

  constructor(profile: LiveProfile, handlers: GeminiVoiceHandlers, backendUrl?: string) {
    this.handlers = handlers;
    this.live = new GeminiLiveService(
      profile,
      {
        onStateChange: (s) => {
          this.handlers.onStateChange?.(s);
        },
        onAudio: (b64, mime) => this.enqueueAudio(base64ToArrayBuffer(b64), mime),
        onTranscript: (role, text, meta) => {
          if (role === 'assistant') this.speaking = true;
          this.handlers.onTranscript?.(role, text, meta);
        },
        onTurnComplete: (role, text) => {
          this.speaking = false;
          this.handlers.onTurnComplete?.(role, text);
        },
        onInterrupted: (text) => {
          this.flushPlaybackQueue('interrupted');
          this.speaking = false;
          this.handlers.onTurnComplete?.('assistant', text);
        },
        onError: (m) => this.handlers.onError?.(m),
      },
      backendUrl,
    );
    this.unregisterGeminiStop = registerGeminiPlaybackStop(() => this.flushPlaybackQueue('stop_all'));
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
    return this.speaking;
  }

  async connect(): Promise<void> {
    await this.live.connect();
  }

  getSessionState(): LiveSessionState {
    return this.live.getState();
  }

  /** Recebe AudioContext + MediaStream já abertos no user gesture (Fase 1A). */
  attachAcquiredMic(ctx: AudioContext, stream: MediaStream): void {
    this.micContext = ctx;
    this.mediaStream = stream;
    this.micAcquired = true;
    const track = stream.getAudioTracks()[0];
    if (track) this.handlers.onMicDevice?.(track.label || 'dispositivo sem nome');
    this.setMicState('IDLE');
  }

  /**
   * Fase 1A — adquirir mic + AudioContext DENTRO do user gesture,
   * antes de awaits longos (token/WS). Não começa a enviar PCM ainda.
   */
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
      const settings = track.getSettings();
      if (DEV) {
        console.log('[VOICE INPUT] stream active =', this.mediaStream.active);
        console.log('[VOICE INPUT] track active =', track.enabled, 'readyState =', track.readyState);
        console.log('[VOICE INPUT] AudioContext sampleRate =', this.micContext.sampleRate);
        console.log('[VOICE INPUT] channels = 1 (target PCM 16kHz mono 16-bit)');
        console.log('[mic] dispositivo:', label, settings);
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

  /** Liga o ScriptProcessor e começa a enviar PCM 16 kHz ao Gemini. */
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
      const resampled = resampleLinear(input, nativeRate, MIC_PCM_RATE);
      const pcm = floatTo16BitPCM(resampled);
      this.chunksSent += 1;
      this.bytesSent += pcm.byteLength;
      if (DEV && (this.chunksSent === 1 || this.chunksSent === 10 || this.chunksSent % 50 === 0)) {
        console.log('[VOICE INPUT] chunkBytes =', pcm.byteLength, 'chunks =', this.chunksSent, 'bytesTotal =', this.bytesSent, 'rms =', rms.toFixed(4));
      }
      const b64 = arrayBufferToBase64(pcm);
      void this.live.sendAudio(b64);
    };

    this.sourceNode.connect(this.processorNode);
    this.processorNode.connect(this.silentGain);
    this.silentGain.connect(this.micContext.destination);
    this.listening = true;
    this.setMicState('LISTENING');
    if (DEV) console.log('[VOICE INPUT] LISTENING — PCM 16kHz mono → Gemini');
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
    if (DEV) console.log('[VOICE INPUT] STOPPED chunks=', this.chunksSent, 'bytes=', this.bytesSent);
  }

  listen(): Promise<string> {
    return new Promise((resolve) => {
      const handler = (role: 'user' | 'assistant', text: string) => {
        if (role === 'user' && text) {
          resolve(text);
        }
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
    this.flushPlaybackQueue('stop_speaking');
    this.speaking = false;
  }

  interrupt(): void {
    this.live.interrupt();
    this.flushPlaybackQueue('interrupt');
    this.speaking = false;
  }

  disconnect(): void {
    this.unregisterGeminiStop?.();
    this.unregisterGeminiStop = null;
    this.unbindVisibilityHandling();
    this.stopMic();
    this.flushPlaybackQueue('disconnect');
    this.live.disconnect();
    void this.micContext?.close();
    void this.playbackContext?.close();
    this.micContext = null;
    this.playbackContext = null;
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
    this.flushPlaybackQueue('tab_hidden');
    this.speaking = false;
    this.backgroundSuspended = true;
    void this.micContext?.suspend();
    void this.playbackContext?.suspend();
  }

  private async handleTabVisible(): Promise<void> {
    if (!this.backgroundSuspended) return;
    this.backgroundSuspended = false;
    await resumeAudioContextIfNeeded(this.micContext);
    await resumeAudioContextIfNeeded(this.playbackContext);
    this.lastPacketAt = 0;
    this.nextStartTime = 0;
  }

  private shouldFlushForJitter(now: number): boolean {
    if (this.lastPacketAt > 0 && now - this.lastPacketAt > MAX_PLAYBACK_LAG_MS) {
      return true;
    }
    if (this.playbackContext && this.nextStartTime > 0) {
      const lag = playbackScheduleLagMs(this.playbackContext, this.nextStartTime);
      if (lag > MAX_PLAYBACK_LAG_MS) return true;
    }
    return false;
  }

  private flushPlaybackQueue(reason: string): void {
    if (DEV && (this.playbackQueue.length > 0 || this.activeNodes.length > 0)) {
      console.log('[VOICE OUTPUT] flush:', reason, 'queued=', this.playbackQueue.length, 'active=', this.activeNodes.length);
    }
    this.playbackQueue = [];
    this.playing = false;
    this.nextStartTime = 0;
    this.lastPacketAt = 0;
    for (const node of this.activeNodes) {
      try { node.source.stop(); } catch { /* ignore */ }
      try { node.source.disconnect(); } catch { /* ignore */ }
      try { node.gain.disconnect(); } catch { /* ignore */ }
    }
    this.activeNodes = [];
  }

  private enqueueAudio(buf: ArrayBuffer, mime?: string) {
    const now = performance.now();
    if (this.playbackQueue.length === 0 && !this.playing && this.activeNodes.length === 0) {
      stopBrowserAudio();
    }
    if (this.shouldFlushForJitter(now)) {
      this.flushPlaybackQueue('jitter');
    }
    if (this.playbackQueue.length >= MAX_PLAYBACK_QUEUE_CHUNKS) {
      this.flushPlaybackQueue('overflow');
    }
    this.lastPacketAt = now;
    this.playbackQueue.push({ buf, mime, receivedAt: now });
    this.speaking = true;
    void this.playQueue();
  }

  private async playQueue() {
    if (this.playing) return;
    this.playing = true;

    try {
      this.playbackContext = await createOrResumeAudioContext(
        this.playbackContext,
        PLAYBACK_PCM_RATE,
      );

      while (this.playbackQueue.length > 0) {
        if (this.playbackContext && this.shouldFlushForJitter(performance.now())) {
          this.flushPlaybackQueue('playback_lag');
          break;
        }

        const item = this.playbackQueue.shift()!;
        const rate = parsePcmSampleRate(item.mime, PLAYBACK_PCM_RATE);
        this.schedulePcmChunk(item.buf, rate);
      }
    } finally {
      this.playing = false;
      if (this.playbackQueue.length > 0) {
        void this.playQueue();
      }
    }
  }

  private schedulePcmChunk(pcm: ArrayBuffer, rate: number) {
    if (!this.playbackContext) return;

    const view = new DataView(pcm);
    const samples = pcm.byteLength / 2;
    if (samples <= 0) return;

    const float = new Float32Array(samples);
    for (let i = 0; i < samples; i++) {
      float[i] = view.getInt16(i * 2, true) / 0x8000;
    }

    const audioBuf = this.playbackContext.createBuffer(1, float.length, rate);
    audioBuf.copyToChannel(float, 0);

    const src = this.playbackContext.createBufferSource();
    src.buffer = audioBuf;

    const gain = this.playbackContext.createGain();
    src.connect(gain);
    gain.connect(this.playbackContext.destination);

    const now = this.playbackContext.currentTime;
    const start = Math.max(now, this.nextStartTime);
    applyChunkFade(gain, start, audioBuf.duration);

    src.start(start);
    this.nextStartTime = start + audioBuf.duration;

    const node: ActivePlaybackNode = { source: src, gain };
    this.activeNodes.push(node);

    src.onended = () => {
      this.activeNodes = this.activeNodes.filter((n) => n.source !== src);
      try { src.disconnect(); } catch { /* ignore */ }
      try { gain.disconnect(); } catch { /* ignore */ }
      if (this.activeNodes.length === 0 && this.playbackQueue.length === 0) {
        this.speaking = false;
      }
    };
  }
}
