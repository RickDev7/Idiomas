/**
 * Player PCM sequencial para Gemini Live (PWA mobile).
 * - AudioContext nativo do dispositivo (sem forçar 24 kHz no constructor)
 * - Resampling manual: API 24 kHz → ctx.sampleRate
 * - Fila única estrita com nextStartTime
 */
import {
  PLAYBACK_PCM_RATE,
  MAX_PLAYBACK_QUEUE_CHUNKS,
  MAX_PLAYBACK_LAG_MS,
  applyChunkFade,
  decodePcm16LE,
  parsePcmSampleRate,
  resampleLinearPcm,
  type QueuedPcmChunk,
} from '@/services/voice/AudioPipeline';
import { stopBrowserAudio } from '@/services/voice/AudioPlayback';

const DEV = typeof import.meta !== 'undefined' && !!(import.meta as { env?: { DEV?: boolean } }).env?.DEV;
const SCHEDULE_CATCHUP_SEC = 0.05;

type ActiveNode = {
  source: AudioBufferSourceNode;
  gain: GainNode;
};

function getAudioContextCtor(): typeof AudioContext {
  const w = window as Window & { webkitAudioContext?: typeof AudioContext };
  const Ctx = window.AudioContext ?? w.webkitAudioContext;
  if (!Ctx) throw new Error('AudioContext não suportado');
  return Ctx;
}

export class GeminiPcmPlayer {
  private ctx: AudioContext | null = null;
  private nextStartTime = 0;
  private queue: QueuedPcmChunk[] = [];
  private draining = false;
  private activeNodes: ActiveNode[] = [];
  private lastMime?: string;
  private lastPacketAt = 0;
  private onSpeakingChange?: (speaking: boolean) => void;

  setOnSpeakingChange(fn: (speaking: boolean) => void): void {
    this.onSpeakingChange = fn;
  }

  getContext(): AudioContext | null {
    return this.ctx;
  }

  isSpeaking(): boolean {
    return this.queue.length > 0 || this.activeNodes.length > 0 || this.draining;
  }

  /**
   * Destrói qualquer contexto anterior e cria um NOVO AudioContext nativo.
   * Deve ser chamado exclusivamente no gesto do usuário (onClick).
   */
  async initOnUserGesture(): Promise<void> {
    await this.destroyContext();
    const Ctx = getAudioContextCtor();
    this.ctx = new Ctx();
    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }
    this.nextStartTime = 0;
    this.queue = [];
    this.lastPacketAt = 0;
    this.lastMime = undefined;
    if (DEV) {
      console.log('[GeminiPcmPlayer] novo AudioContext sampleRate =', this.ctx.sampleRate);
    }
  }

  async resumeIfSuspended(): Promise<void> {
    if (!this.ctx || this.ctx.state === 'closed') return;
    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }
  }

  async suspend(): Promise<void> {
    if (!this.ctx || this.ctx.state !== 'running') return;
    try {
      await this.ctx.suspend();
    } catch {
      /* ignore */
    }
  }

  /** Para fila + fontes ativas; mantém AudioContext. */
  stop(): void {
    this.queue = [];
    this.draining = false;
    this.nextStartTime = 0;
    this.lastPacketAt = 0;
    this.lastMime = undefined;
    for (const node of this.activeNodes) {
      try { node.source.stop(); } catch { /* ignore */ }
      try { node.source.disconnect(); } catch { /* ignore */ }
      try { node.gain.disconnect(); } catch { /* ignore */ }
    }
    this.activeNodes = [];
    this.onSpeakingChange?.(false);
    if (DEV) console.log('[GeminiPcmPlayer] stop — fila e fontes zeradas');
  }

  /** Fecha AudioContext completamente. */
  async destroyContext(): Promise<void> {
    this.stop();
    if (this.ctx && this.ctx.state !== 'closed') {
      try {
        await this.ctx.close();
      } catch {
        /* ignore */
      }
    }
    this.ctx = null;
  }

  enqueue(pcm: ArrayBuffer, mime?: string): void {
    if (!this.ctx || this.ctx.state === 'closed') {
      if (DEV) console.warn('[GeminiPcmPlayer] enqueue ignorado — sem AudioContext');
      return;
    }

    const now = performance.now();
    if (mime) this.lastMime = mime;

    if (this.queue.length === 0 && this.activeNodes.length === 0 && !this.draining) {
      stopBrowserAudio();
    }

    if (this.shouldFlushForJitter(now)) {
      this.stop();
    }
    if (this.queue.length >= MAX_PLAYBACK_QUEUE_CHUNKS) {
      if (DEV) console.warn('[GeminiPcmPlayer] overflow — fila reiniciada');
      this.stop();
    }

    this.lastPacketAt = now;
    this.queue.push({ buf: pcm, mime, receivedAt: now });
    this.onSpeakingChange?.(true);
    void this.drainQueue();
  }

  private shouldFlushForJitter(now: number): boolean {
    if (this.lastPacketAt > 0 && now - this.lastPacketAt > MAX_PLAYBACK_LAG_MS) {
      return true;
    }
    if (this.ctx && this.nextStartTime > 0) {
      const lagMs = (this.nextStartTime - this.ctx.currentTime) * 1000;
      if (lagMs > MAX_PLAYBACK_LAG_MS) return true;
    }
    return false;
  }

  /** Processa a fila sequencialmente — nunca em paralelo. */
  private async drainQueue(): Promise<void> {
    if (this.draining) return;
    this.draining = true;

    try {
      await this.resumeIfSuspended();
      const ctx = this.ctx;
      if (!ctx || ctx.state === 'closed') return;

      while (this.queue.length > 0) {
        if (this.shouldFlushForJitter(performance.now())) {
          this.stop();
          break;
        }
        const item = this.queue.shift()!;
        this.scheduleChunk(item);
      }
    } finally {
      this.draining = false;
      if (this.queue.length > 0) {
        void this.drainQueue();
      }
    }
  }

  private scheduleChunk(item: QueuedPcmChunk): void {
    const ctx = this.ctx;
    if (!ctx || ctx.state === 'closed') return;

    const sourceRate = parsePcmSampleRate(item.mime ?? this.lastMime, PLAYBACK_PCM_RATE);
    const pcm = item.buf;
    if (pcm.byteLength < 2) return;

    const decoded = decodePcm16LE(pcm);
    const deviceRate = ctx.sampleRate;
    const resampled =
      sourceRate === deviceRate
        ? decoded
        : resampleLinearPcm(decoded, sourceRate, deviceRate);

    const audioBuf = ctx.createBuffer(1, resampled.length, deviceRate);
    audioBuf.copyToChannel(resampled, 0);

    const src = ctx.createBufferSource();
    src.buffer = audioBuf;
    src.playbackRate.value = 1;

    const gain = ctx.createGain();
    src.connect(gain);
    gain.connect(ctx.destination);

    const now = ctx.currentTime;
    if (this.nextStartTime < now) {
      this.nextStartTime = now + SCHEDULE_CATCHUP_SEC;
    }
    const start = this.nextStartTime;
    applyChunkFade(gain, start, audioBuf.duration);

    src.start(start);
    this.nextStartTime = start + audioBuf.duration;

    const node: ActiveNode = { source: src, gain };
    this.activeNodes.push(node);

    src.onended = () => {
      this.activeNodes = this.activeNodes.filter((n) => n.source !== src);
      try { src.disconnect(); } catch { /* ignore */ }
      try { gain.disconnect(); } catch { /* ignore */ }
      if (this.queue.length === 0 && this.activeNodes.length === 0 && !this.draining) {
        this.onSpeakingChange?.(false);
      }
    };
  }
}
