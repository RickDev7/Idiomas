/**
 * Utilitários compartilhados do pipeline Web Audio (captura + decode PCM).
 * Taxas alinhadas às APIs de voz Gemini: 16 kHz entrada, 24 kHz saída.
 */

export const MIC_PCM_RATE = 16_000;
export const PLAYBACK_PCM_RATE = 24_000;

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

export const MIC_CONSTRAINTS: MediaTrackConstraints = {
  channelCount: 1,
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
};
