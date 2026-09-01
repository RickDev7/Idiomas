export class AudioStreamPlayer {
  private audioCtx: AudioContext | null = null;
  private queue: Float32Array[] = [];
  private isPlaying = false;
  private currentSource: AudioBufferSourceNode | null = null;

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
  public enqueue(pcmChunk24k: Float32Array): void {
    if (pcmChunk24k.length === 0) return;
    this.queue.push(pcmChunk24k);
    if (!this.isPlaying) {
      this.playNext();
    }
  }

  private playNext(): void {
    if (this.queue.length === 0) {
      this.isPlaying = false;
      return;
    }

    this.isPlaying = true;
    const ctx = this.initContext();
    const chunk24k = this.queue.shift()!;

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
      this.playNext();
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
  resetForSession(): void {
    this.stopAll();
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
