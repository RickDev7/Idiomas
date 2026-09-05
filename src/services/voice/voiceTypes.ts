/**
 * Tipos da camada VoiceEngine — só voz, sem pedagogia.
 */

export type VoiceProvider = 'gemini-live' | 'free-browser' | 'text';

export function isVoiceProvider(value: unknown): value is VoiceProvider {
  return value === 'gemini-live' || value === 'free-browser' || value === 'text';
}

export function normalizeVoiceProvider(value: unknown): VoiceProvider {
  return isVoiceProvider(value) ? value : 'gemini-live';
}

export type VoiceEngineState =
  | 'IDLE'
  | 'LISTENING'
  | 'SPEAKING'
  | 'PROCESSING'
  | 'ERROR'
  | 'UNSUPPORTED';

export type VoiceLang = 'de-DE' | 'pt-BR' | string;

export interface SpeakOptions {
  lang?: VoiceLang;
  rate?: number;
  pitch?: number;
  /** Cancela fala anterior antes de iniciar. Default true. */
  cancelPrevious?: boolean;
}

export interface ListenOptions {
  lang?: VoiceLang;
  continuous?: boolean;
  interimResults?: boolean;
  maxAlternatives?: number;
}

export interface VoiceCapabilities {
  speechSynthesis: boolean;
  speechRecognition: boolean;
  germanTTS: boolean | 'unknown';
  germanSTT: boolean | 'unknown';
  mobile: boolean;
  android: boolean;
  ios: boolean;
  browser: string;
}

export interface FreeVoiceHandlers {
  onStart?: () => void;
  onResult?: (transcript: string, isFinal: boolean) => void;
  onInterimResult?: (transcript: string) => void;
  onEnd?: () => void;
  onError?: (code: string, message: string) => void;
  onSpeakStart?: (text: string) => void;
  onSpeakEnd?: () => void;
}

export type SttErrorCode =
  | 'not-allowed'
  | 'permission-denied'
  | 'no-speech'
  | 'audio-capture'
  | 'network'
  | 'aborted'
  | 'service-not-allowed'
  | 'unsupported'
  | 'busy'
  | string;
