/**
 * Detecção de suporte browser para voz gratuita.
 */
import type { VoiceCapabilities } from '@/services/voice/voiceTypes';
import { freeVoiceLog } from '@/services/voice/freeVoiceLog';

function detectBrowser(ua: string): string {
  if (/Edg\//i.test(ua)) return 'Edge';
  if (/Chrome\//i.test(ua) && !/Edg\//i.test(ua)) return 'Chrome';
  if (/Safari\//i.test(ua) && !/Chrome\//i.test(ua)) return 'Safari';
  if (/Firefox\//i.test(ua)) return 'Firefox';
  if (/SamsungBrowser/i.test(ua)) return 'Samsung Internet';
  return 'other';
}

export function hasSpeechSynthesis(): boolean {
  return typeof window !== 'undefined' && typeof window.speechSynthesis !== 'undefined';
}

export function getSpeechRecognitionCtor(): (new () => SpeechRecognition) | null {
  if (typeof window === 'undefined') return null;
  const w = window as Window & {
    SpeechRecognition?: new () => SpeechRecognition;
    webkitSpeechRecognition?: new () => SpeechRecognition;
  };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

export function hasSpeechRecognition(): boolean {
  return !!getSpeechRecognitionCtor();
}

export function getVoiceCapabilities(voices?: SpeechSynthesisVoice[]): VoiceCapabilities {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const mobile = /Android|iPhone|iPad|iPod|Mobile/i.test(ua);
  const android = /Android/i.test(ua);
  const ios = /iPhone|iPad|iPod/i.test(ua);
  const synth = hasSpeechSynthesis();
  const stt = hasSpeechRecognition();
  const list = voices ?? (synth ? window.speechSynthesis.getVoices() : []);
  let germanTTS: boolean | 'unknown' = 'unknown';
  if (synth) {
    germanTTS = list.length === 0 ? 'unknown' : list.some((v) => /^de(-|$)/i.test(v.lang));
  } else {
    germanTTS = false;
  }
  // STT alemão: a API não expõe lista de idiomas confiável em todos browsers.
  const germanSTT: boolean | 'unknown' = stt ? 'unknown' : false;

  const caps: VoiceCapabilities = {
    speechSynthesis: synth,
    speechRecognition: stt,
    germanTTS,
    germanSTT,
    mobile,
    android,
    ios,
    browser: detectBrowser(ua),
  };
  freeVoiceLog('capabilities', { ...caps, voiceCount: list.length });
  return caps;
}
