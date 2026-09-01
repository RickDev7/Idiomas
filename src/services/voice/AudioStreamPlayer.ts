const DEV = typeof import.meta !== 'undefined' && !!(import.meta as { env?: { DEV?: boolean } }).env?.DEV;

type QueueItem = {
  pcm: Float32Array;
  generation: number;
};

export class AudioStreamPlayer {
  private audioCtx: AudioContext | null = null;
  private queue: QueueItem[] = [];
  private isPlaying = false;
  private currentSource: AudioBufferSourceNode | null = null;
  private activeGeneration = 0;
  private chunkSeq = 0;

  setGeneration(generation: number): void {
    this.activeGeneration = generation;
    this.stopAll();
    if (DEV) {
      console.log('[LIVE_PLAYER]', { playerId: 'audioStreamPlayer', generation, created: true });
    }
  }

  private initContext(): AudioContext {
    if (!this.audioCtx || this.audioCtx.state === 'closed') {
      this.audioCtx = new (window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext)();
    }
    if (this.audioCtx.state === 'suspended') {
      void this.audioCtx.resume();
    }
    return this.audioCtx;
  }

  /** Adiciona um bloco de áudio PCM (24kHz) recebido do Gemini na fila. */
  public enqueue(pcmChunk24k: Float32Array, generation: number): void {
    if (pcmChunk24k.length === 0) return;
    if (generation !== this.activeGeneration) {
      if (DEV) {
        console.log('[LIVE_AUDIO]', {
          sessionId: generation,
          chunkId: 'discarded',
          playerId: 'audioStreamPlayer',
          reason: 'stale_generation',
        });
      }
      return;
    }
    const chunkId = ++this.chunkSeq;
    if (DEV) {
      console.log('[LIVE_AUDIO]', {
        sessionId: generation,
        chunkId,
        playerId: 'audioStreamPlayer',
      });
    }
    this.queue.push({ pcm: pcmChunk24k, generation });
    if (!this.isPlaying) {
      this.playNext();
    }
  }

  private playNext(): void {
    while (this.queue.length > 0 && this.queue[0].generation !== this.activeGeneration) {
      this.queue.shift();
    }
    if (this.queue.length === 0) {
      this.isPlaying = false;
      return;
    }

    this.isPlaying = true;
    const ctx = this.initContext();
    const { pcm: chunk24k, generation } = this.queue.shift()!;
    if (generation !== this.activeGeneration) {
      this.isPlaying = false;
      this.playNext();
      return;
    }

    const sourceRate = 24000;
    const targetRate = ctx.sampleRate;
    const ratio = targetRate / sourceRate;
    const targetLength = Math.max(1, Math.round(chunk24k.length * ratio));

    const audioBuffer = ctx.createBuffer(1, targetLength, targetRate);
    const channelData = audioBuffer.getChannelData(0);

    for (let i = 0; i < targetLength; i++) {
      const originIndex = i / ratio;
      const indexFloor = Math.floor(originIndex);
      const indexCeil = Math.min(indexFloor + 1, chunk24k.length - 1);
      const weight = originIndex - indexFloor;
      channelData[i] = chunk24k[indexFloor] * (1 - weight) + chunk24k[indexCeil] * weight;
    }

    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(ctx.destination);

    source.onended = () => {
      this.currentSource = null;
      if (generation === this.activeGeneration) {
        this.playNext();
      } else {
        this.isPlaying = false;
      }
    };

    this.currentSource = source;
    source.start(0);
  }

  /** Cancela instantaneamente qualquer fala ativa e limpa a fila. */
  public stopAll(): void {
    this.queue = [];
    if (this.currentSource) {
      try {
        this.currentSource.stop();
        this.currentSource.disconnect();
      } catch {
        /* ignore */
      }
      this.currentSource = null;
    }
    this.isPlaying = false;
  }

  /** Fecha contexto e zera estado — chamar no gesto do usuário ao iniciar sessão. */
  resetForSession(generation: number): void {
    this.setGeneration(generation);
    if (this.audioCtx && this.audioCtx.state !== 'closed') {
      void this.audioCtx.close();
    }
    this.audioCtx = null;
  }

  getIsPlaying(): boolean {
    return this.isPlaying || this.queue.length > 0;
  }
}

export const audioStreamPlayer = new AudioStreamPlayer();
