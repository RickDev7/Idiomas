/**
 * Adapta VoiceEngine → VoiceServiceInterface (useLesson / páginas legadas).
 */
import type { VoiceEngine } from '@/services/voice/VoiceEngine';
import type { SpeechSpeed, VoiceServiceInterface } from '@/services/voice/VoiceService';

const SPEED_RATES: Record<SpeechSpeed, number> = {
  slow: 0.7,
  normal: 1.0,
  natural: 1.15,
};

export function adaptVoiceEngineToService(engine: VoiceEngine): VoiceServiceInterface {
  let speed: SpeechSpeed = 'normal';

  return {
    async listen(): Promise<string> {
      return engine.startListening({
        lang: 'de-DE',
        continuous: false,
        interimResults: true,
        maxAlternatives: 1,
      });
    },
    stopListening(): void {
      engine.stopListening();
    },
    async recognizeSpeech(_audioBlob?: Blob): Promise<string> {
      return this.listen();
    },
    async speak(text: string, lang = 'de-DE'): Promise<void> {
      await engine.speak(text, { lang, rate: SPEED_RATES[speed], cancelPrevious: true });
    },
    stopSpeaking(): void {
      engine.stop();
    },
    setLanguage(lang: string): void {
      engine.setLanguage(lang);
    },
    setSpeed(next: SpeechSpeed): void {
      speed = next;
    },
    setVoice(_voiceName?: string): void {
      /* FreeVoice escolhe voz por idioma automaticamente */
    },
    isListening(): boolean {
      return engine.isListening();
    },
    isSpeaking(): boolean {
      return engine.isSpeaking();
    },
    isSupported(): boolean {
      const caps = engine.getCapabilities();
      return caps.speechSynthesis || caps.speechRecognition || engine.providerId === 'text';
    },
  };
}
