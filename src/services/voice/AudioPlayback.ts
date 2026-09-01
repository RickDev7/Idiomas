/**
 * Controle global de reprodução — evita sobreposição entre TTS, PCM Gemini e filas.
 */

type StopHandler = () => void;

let geminiStopHandler: StopHandler | null = null;

/** Registra handler para parar playback PCM do Gemini Live. */
export function registerGeminiPlaybackStop(handler: StopHandler): () => void {
  geminiStopHandler = handler;
  return () => {
    if (geminiStopHandler === handler) geminiStopHandler = null;
  };
}

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

/** Para playback PCM do Gemini (fila + fontes ativas). */
export function stopGeminiPlayback(): void {
  try {
    geminiStopHandler?.();
  } catch {
    /* ignore */
  }
}

/** Interrupção estrita — chamar ANTES de qualquer nova fala. */
export function stopAllAudio(): void {
  stopBrowserAudio();
  stopGeminiPlayback();
}
