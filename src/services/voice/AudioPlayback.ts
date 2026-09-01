/**
 * Controle global de reprodução — evita sobreposição entre TTS, PCM Gemini e filas.
 */
import { audioStreamPlayer } from '@/services/voice/AudioStreamPlayer';

/** Para apenas TTS do navegador (Web Speech API). */
export function stopBrowserAudio(): void {
  try {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  } catch {
    /* ignore */
  }
}

/** Para playback PCM do Gemini (fila sequencial + fonte ativa). */
export function stopGeminiPlayback(): void {
  try {
    audioStreamPlayer.stopAll();
  } catch {
    /* ignore */
  }
}

/** Interrupção estrita — chamar ANTES de qualquer nova fala. */
export function stopAllAudio(): void {
  stopBrowserAudio();
  stopGeminiPlayback();
}
