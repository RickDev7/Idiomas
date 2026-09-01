/**
 * Utilitários compartilhados do pipeline Web Audio (captura + playback PCM).
 * Taxas alinhadas às APIs de voz Gemini: 16 kHz entrada, 24 kHz saída.
 */

export const MIC_PCM_RATE = 16_000;
export const PLAYBACK_PCM_RATE = 24_000;
export const CHUNK_FADE_MS = 8;
/** Máximo de chunks na fila antes de descartar (evita estática por overflow). */
export const MAX_PLAYBACK_QUEUE_CHUNKS = 20;
/** Atraso máximo agendado / gap entre pacotes antes de flush (ms). */
export const MAX_PLAYBACK_LAG_MS = 500;

export type QueuedPcmChunk = {
  buf: ArrayBuffer;
  mime?: string;
  receivedAt: number;
};

type AudioContextCtor = typeof AudioContext;

function getAudioContextCtor(): AudioContextCtor {
  const w = window as Window & { webkitAudioContext?: AudioContextCtor };
  const Ctx = window.AudioContext ?? w.webkitAudioContext;
  if (!Ctx) throw new Error('AudioContext não suportado');
  return Ctx;
}

/** Cria ou reutiliza um AudioContext na taxa desejada; retoma se suspenso. */
export async function createOrResumeAudioContext(
  existing: AudioContext | null,
  sampleRate: number,
): Promise<AudioContext> {
  const Ctx = getAudioContextCtor();

  if (existing && existing.state !== 'closed' && existing.sampleRate === sampleRate) {
    if (existing.state === 'suspended') {
      try {
        await existing.resume();
      } catch {
        /* ignore */
      }
    }
    return existing;
  }

  if (existing && existing.state !== 'closed') {
    try {
      await existing.close();
    } catch {
      /* ignore */
    }
  }

  const ctx = new Ctx({ sampleRate });
  if (ctx.state === 'suspended') {
    try {
      await ctx.resume();
    } catch {
      /* ignore */
    }
  }
  return ctx;
}

/** Retoma contexto suspenso (gesto do usuário ou retorno à aba). */
export async function resumeAudioContextIfNeeded(ctx: AudioContext | null): Promise<void> {
  if (!ctx || ctx.state === 'closed') return;
  if (ctx.state === 'suspended') {
    try {
      await ctx.resume();
    } catch {
      /* ignore */
    }
  }
}

/** Fade-in / fade-out curto para eliminar cliques entre fragmentos PCM. */
export function applyChunkFade(
  gain: GainNode,
  startTime: number,
  durationSec: number,
): void {
  const fadeSec = Math.min(CHUNK_FADE_MS / 1000, durationSec / 4);
  if (fadeSec <= 0) {
    gain.gain.setValueAtTime(1, startTime);
    return;
  }
  gain.gain.cancelScheduledValues(startTime);
  gain.gain.setValueAtTime(0, startTime);
  gain.gain.linearRampToValueAtTime(1, startTime + fadeSec);
  const fadeOutStart = startTime + durationSec - fadeSec;
  if (fadeOutStart > startTime + fadeSec) {
    gain.gain.setValueAtTime(1, fadeOutStart);
    gain.gain.linearRampToValueAtTime(0, startTime + durationSec);
  }
}

export function parsePcmSampleRate(mime?: string, fallback = PLAYBACK_PCM_RATE): number {
  if (mime) {
    const m = mime.match(/rate[=:](\d+)/i);
    if (m) return parseInt(m[1], 10);
  }
  return fallback;
}

/** Resample linear mono Float32. */
export function resampleLinearPcm(
  input: Float32Array,
  origRate: number,
  destRate: number,
): Float32Array {
  if (origRate === destRate || input.length === 0) return input;
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

export function decodePcm16LE(pcm: ArrayBuffer): Float32Array {
  const view = new DataView(pcm);
  const samples = pcm.byteLength / 2;
  const float = new Float32Array(samples);
  for (let i = 0; i < samples; i++) {
    float[i] = view.getInt16(i * 2, true) / 0x8000;
  }
  return float;
}

/**
 * Converte PCM 16-bit LE em AudioBuffer alinhado ao sample rate REAL do contexto.
 * Evita voz acelerada ("chipmunk") quando o hardware ignora sampleRate: 24000.
 */
export function pcmToAudioBuffer(
  ctx: AudioContext,
  pcm: ArrayBuffer,
  sourceRate: number,
): AudioBuffer {
  const parsed = sourceRate > 0 ? sourceRate : PLAYBACK_PCM_RATE;
  const float = decodePcm16LE(pcm);
  const ctxRate = ctx.sampleRate;
  const channel =
    parsed === ctxRate ? float : resampleLinearPcm(float, parsed, ctxRate);
  const audioBuf = ctx.createBuffer(1, channel.length, ctxRate);
  audioBuf.copyToChannel(channel, 0);
  return audioBuf;
}

/** AudioContext de saída fixado em 24 kHz (voz Gemini). */
export async function createPlaybackAudioContext(
  existing: AudioContext | null,
): Promise<AudioContext> {
  return createOrResumeAudioContext(existing, PLAYBACK_PCM_RATE);
}

/** Atraso entre o relógio de áudio e o próximo chunk agendado (ms). */
export function playbackScheduleLagMs(ctx: AudioContext, nextStartTime: number): number {
  return Math.max(0, (nextStartTime - ctx.currentTime) * 1000);
}

export const MIC_CONSTRAINTS: MediaTrackConstraints = {
  channelCount: 1,
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
};
