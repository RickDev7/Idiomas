import { PLAYBACK_PCM_RATE } from '@/services/voice/AudioPipeline';

type QueueItem = {
  pcm: Float32Array;
  generation: number;
};

function audioTrace(event: string, extra: Record<string, unknown>): void {
  // Telemetria segura — sem PCM, transcript ou segredos.
  console.log('[LIVE_AUDIO_TRACE]', event, extra);
}

export class AudioStreamPlayer {
  private audioCtx: AudioContext | null = null;
  private queue: QueueItem[] = [];
  private isPlaying = false;
  private currentSource: AudioBufferSourceNode | null = null;
  private activeGeneration = 0;
  private chunkSeq = 0;
  private sourceCount = 0;
  /** Incrementado em stopAll/setGeneration — onended antigo não pode continuar a cadeia. */
  private playbackEpoch = 0;
  private lastSourceEndCtxTime: number | null = null;
  private readonly serviceId = 'audioStreamPlayer';

  getDebugState(): {
    sourceCount: number;
    queueLength: number;
    isPlaying: boolean;
    activeGeneration: number;
    playbackEpoch: number;
  } {
    return {
      sourceCount: this.sourceCount,
      queueLength: this.queue.length,
      isPlaying: this.isPlaying,
      activeGeneration: this.activeGeneration,
      playbackEpoch: this.playbackEpoch,
    };
  }

  setGeneration(generation: number): void {
    this.activeGeneration = generation;
    this.stopAll();
    audioTrace('generation:set', {
      serviceId: this.serviceId,
      activeGeneration: this.activeGeneration,
      sourceCount: this.sourceCount,
    });
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

  /** Adiciona um bloco de áudio PCM (24 kHz) recebido do Gemini na fila. */
  public enqueue(pcmChunk24k: Float32Array, generation: number): void {
    if (pcmChunk24k.length === 0) return;
    if (generation !== this.activeGeneration) {
      audioTrace('audio:stale-discarded', {
        sessionGen: generation,
        serviceId: this.serviceId,
        activeGeneration: this.activeGeneration,
        queueLength: this.queue.length,
        sourceCount: this.sourceCount,
      });
      return;
    }
    const chunkSequence = ++this.chunkSeq;
    const bufferDuration = pcmChunk24k.length / PLAYBACK_PCM_RATE;
    this.queue.push({ pcm: pcmChunk24k, generation });
    audioTrace('enqueue', {
      sessionGen: generation,
      serviceId: this.serviceId,
      chunkSequence,
      queueLength: this.queue.length,
      activeGeneration: this.activeGeneration,
      audioContextState: this.audioCtx?.state ?? 'none',
      sampleRate: PLAYBACK_PCM_RATE,
      contextSampleRate: this.audioCtx?.sampleRate ?? null,
      bufferDuration,
      sourceCount: this.sourceCount,
      timestamp: Date.now(),
    });
    if (!this.isPlaying) {
      this.playNext();
    }
  }

  private playNext(): void {
    const epoch = this.playbackEpoch;
    while (this.queue.length > 0 && this.queue[0].generation !== this.activeGeneration) {
      this.queue.shift();
    }
    if (this.queue.length === 0) {
      this.isPlaying = false;
      const ctx = this.audioCtx;
      audioTrace('QUEUE_STARVATION', {
        sessionGen: this.activeGeneration,
        serviceId: this.serviceId,
        queueLength: 0,
        sourceCount: this.sourceCount,
        isPlaying: false,
        audioContextState: ctx?.state ?? 'none',
        audioContextCurrentTime: ctx?.currentTime ?? null,
        timestamp: Date.now(),
      });
      // Fim da cadeia — o próximo source é outro turno, não gap intra-fala.
      this.lastSourceEndCtxTime = null;
      return;
    }
    if (epoch !== this.playbackEpoch) return;

    this.isPlaying = true;
    const ctx = this.initContext();
    const { pcm: chunk24k, generation } = this.queue.shift()!;
    if (generation !== this.activeGeneration || epoch !== this.playbackEpoch) {
      this.isPlaying = false;
      this.playNext();
      return;
    }

    const sourceRate = PLAYBACK_PCM_RATE;
    const targetRate = ctx.sampleRate;
    const ratio = targetRate / sourceRate;
    const targetLength = Math.max(1, Math.round(chunk24k.length * ratio));
    const bufferDuration = chunk24k.length / sourceRate;

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
      if (epoch !== this.playbackEpoch) return;
      if (this.currentSource !== source) return;
      this.currentSource = null;
      this.sourceCount = Math.max(0, this.sourceCount - 1);
      const endTime = ctx.currentTime;
      this.lastSourceEndCtxTime = endTime;
      audioTrace('source:stop', {
        sessionGen: generation,
        serviceId: this.serviceId,
        sourceCount: this.sourceCount,
        queueLength: this.queue.length,
        activeGeneration: this.activeGeneration,
        sourceEndTime: endTime,
        audioContextCurrentTime: endTime,
        audioContextState: ctx.state,
        bufferDuration,
      });
      if (generation === this.activeGeneration) {
        this.playNext();
      } else {
        this.isPlaying = false;
      }
    };

    this.currentSource = source;
    this.sourceCount += 1;
    if (this.sourceCount > 1) {
      audioTrace('OVERLAP_DETECTED', {
        sessionGen: generation,
        serviceId: this.serviceId,
        sourceCount: this.sourceCount,
        queueLength: this.queue.length,
        activeGeneration: this.activeGeneration,
      });
    }
    const startWhen = ctx.currentTime;
    const gapFromPrev =
      this.lastSourceEndCtxTime != null ? startWhen - this.lastSourceEndCtxTime : null;
    if (gapFromPrev != null && gapFromPrev > 0.008) {
      audioTrace('SOURCE_GAP', {
        sessionGen: generation,
        serviceId: this.serviceId,
        gapSeconds: gapFromPrev,
        sourceStartTime: startWhen,
        sourceEndTimePrev: this.lastSourceEndCtxTime,
        audioContextCurrentTime: startWhen,
        bufferDuration,
        queueLength: this.queue.length,
        audioContextState: ctx.state,
      });
    }
    audioTrace('source:start', {
      sessionGen: generation,
      serviceId: this.serviceId,
      sourceCount: this.sourceCount,
      queueLength: this.queue.length,
      sampleRate: sourceRate,
      contextSampleRate: ctx.sampleRate,
      bufferDuration,
      playbackRate: source.playbackRate?.value ?? 1,
      sourceStartTime: startWhen,
      audioContextCurrentTime: startWhen,
      audioContextState: ctx.state,
      generation,
    });
    // currentTime (não 0): 0 é o início do contexto e já passou; o spec toca imediatamente se when < currentTime.
    source.start(startWhen);
  }

  /** Cancela instantaneamente qualquer fala ativa e limpa a fila. */
  public stopAll(): void {
    this.playbackEpoch += 1;
    this.queue = [];
    const src = this.currentSource;
    this.currentSource = null;
    if (src) {
      src.onended = null;
      try {
        src.stop();
        src.disconnect();
      } catch {
        /* ignore */
      }
    }
    this.sourceCount = 0;
    this.isPlaying = false;
    this.lastSourceEndCtxTime = null;
    audioTrace('stopAll', {
      serviceId: this.serviceId,
      activeGeneration: this.activeGeneration,
      sourceCount: this.sourceCount,
      queueLength: 0,
    });
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
