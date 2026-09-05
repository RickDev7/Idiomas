/**
 * Contrato VoiceEngine — fala e escuta apenas.
 * Não decide pedagogia, currículo ou mastery.
 */
import type {
  FreeVoiceHandlers,
  ListenOptions,
  SpeakOptions,
  VoiceCapabilities,
  VoiceEngineState,
  VoiceLang,
} from '@/services/voice/voiceTypes';

export interface VoiceEngine {
  readonly providerId: string;
  getState(): VoiceEngineState;
  getCapabilities(): VoiceCapabilities;

  speak(text: string, options?: SpeakOptions): Promise<void>;
  stop(): void;
  pause(): void;
  resume(): void;
  isSpeaking(): boolean;

  startListening(options?: ListenOptions): Promise<string>;
  stopListening(): void;
  abortListening(): void;
  isListening(): boolean;

  getAvailableVoices(): SpeechSynthesisVoice[];
  setLanguage(lang: VoiceLang): void;
  setHandlers(handlers: FreeVoiceHandlers): void;
  dispose(): void;
}
