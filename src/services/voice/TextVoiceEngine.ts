/**
 * TextVoiceEngine — modo texto (sem TTS/STT).
 * speak é no-op; listen usa prompt simples se disponível (fallback de digitação).
 */
import type { VoiceEngine } from '@/services/voice/VoiceEngine';
import { getVoiceCapabilities } from '@/services/voice/voiceCapabilities';
import { freeVoiceLog } from '@/services/voice/freeVoiceLog';
import type {
  FreeVoiceHandlers,
  ListenOptions,
  SpeakOptions,
  VoiceCapabilities,
  VoiceEngineState,
  VoiceLang,
} from '@/services/voice/voiceTypes';

export class TextVoiceEngine implements VoiceEngine {
  readonly providerId = 'text';

  private language: VoiceLang = 'de-DE';
  private state: VoiceEngineState = 'IDLE';
  private handlers: FreeVoiceHandlers = {};
  private disposed = false;

  getState(): VoiceEngineState {
    return this.state;
  }

  getCapabilities(): VoiceCapabilities {
    const caps = getVoiceCapabilities([]);
    return {
      ...caps,
      speechSynthesis: false,
      speechRecognition: false,
      germanTTS: false,
      germanSTT: false,
    };
  }

  setHandlers(handlers: FreeVoiceHandlers): void {
    this.handlers = handlers || {};
  }

  setLanguage(lang: VoiceLang): void {
    this.language = lang;
  }

  getAvailableVoices(): SpeechSynthesisVoice[] {
    return [];
  }

  isSpeaking(): boolean {
    return false;
  }

  isListening(): boolean {
    return this.state === 'LISTENING' || this.state === 'PROCESSING';
  }

  stop(): void {
    this.state = 'IDLE';
  }

  pause(): void {}
  resume(): void {}

  async speak(text: string, _options: SpeakOptions = {}): Promise<void> {
    if (this.disposed) return;
    const trimmed = String(text || '').trim();
    if (!trimmed) return;
    freeVoiceLog('tts_start', {
      provider: 'text',
      lang: this.language,
      len: trimmed.length,
      silent: true,
    });
    this.handlers.onSpeakStart?.(trimmed);
    this.handlers.onSpeakEnd?.();
    freeVoiceLog('tts_end', { provider: 'text', silent: true });
  }

  async startListening(_options: ListenOptions = {}): Promise<string> {
    if (this.disposed) throw new Error('disposed');
    this.state = 'LISTENING';
    freeVoiceLog('stt_start', { provider: 'text' });
    this.handlers.onStart?.();

    let text = '';
    try {
      if (typeof window !== 'undefined' && typeof window.prompt === 'function') {
        text = String(window.prompt('Digite sua resposta em alemão:', '') || '').trim();
      }
    } catch {
      text = '';
    }

    this.state = 'PROCESSING';
    if (text) {
      freeVoiceLog('stt_final', { provider: 'text', len: text.length });
      this.handlers.onResult?.(text, true);
    } else {
      freeVoiceLog('stt_error', { provider: 'text', code: 'no-speech' });
      this.handlers.onError?.('no-speech', 'no-speech');
    }
    this.handlers.onEnd?.();
    this.state = 'IDLE';
    freeVoiceLog('stt_end', { provider: 'text' });
    return text;
  }

  stopListening(): void {
    this.state = 'IDLE';
  }

  abortListening(): void {
    this.state = 'IDLE';
  }

  dispose(): void {
    this.disposed = true;
    this.handlers = {};
    this.state = 'IDLE';
  }
}
