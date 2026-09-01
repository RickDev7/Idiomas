import { stopAllAudio, stopBrowserAudio } from '@/services/voice/AudioPlayback';

export type SpeechSpeed = 'slow' | 'normal' | 'natural';

export interface VoiceServiceInterface {
  listen(): Promise<string>;
  stopListening(): void;
  recognizeSpeech(audioBlob?: Blob): Promise<string>;
  speak(text: string, lang?: string): Promise<void>;
  stopSpeaking(): void;
  setLanguage(lang: string): void;
  setSpeed(speed: SpeechSpeed): void;
  setVoice(voiceName?: string): void;
  isListening(): boolean;
  isSpeaking(): boolean;
  isSupported(): boolean;
}

const SPEED_RATES: Record<SpeechSpeed, number> = {
  slow: 0.7,
  normal: 1.0,
  natural: 1.15,
};

export class BrowserVoiceService implements VoiceServiceInterface {
  private language = 'de-DE';
  private speed: SpeechSpeed = 'normal';
  private recognition: SpeechRecognition | null = null;
  private synthesis = window.speechSynthesis;
  private listening = false;
  private speaking = false;
  private selectedVoice: SpeechSynthesisVoice | null = null;

  constructor() {
    this.initRecognition();
    this.loadVoices();
  }

  private initRecognition(): void {
    const Ctor = (window as Window & { SpeechRecognition?: new () => SpeechRecognition; webkitSpeechRecognition?: new () => SpeechRecognition }).SpeechRecognition
      || (window as Window & { webkitSpeechRecognition?: new () => SpeechRecognition }).webkitSpeechRecognition;
    if (!Ctor) return;
    this.recognition = new Ctor();
    this.recognition.continuous = false;
    this.recognition.interimResults = false;
    this.recognition.lang = this.language;
  }

  private loadVoices(): void {
    const setVoice = () => {
      const voices = this.synthesis.getVoices();
      this.selectedVoice =
        voices.find((v) => v.lang.startsWith('de') && v.name.includes('Google')) ||
        voices.find((v) => v.lang.startsWith('de')) ||
        null;
    };
    setVoice();
    this.synthesis.onvoiceschanged = setVoice;
  }

  isSupported(): boolean {
    return !!(this.recognition && this.synthesis);
  }

  setLanguage(lang: string): void {
    this.language = lang;
    if (this.recognition) this.recognition.lang = lang;
  }

  setSpeed(speed: SpeechSpeed): void {
    this.speed = speed;
  }

  setVoice(voiceName?: string): void {
    if (!voiceName) return;
    const voices = this.synthesis.getVoices();
    this.selectedVoice = voices.find((v) => v.name === voiceName) || this.selectedVoice;
  }

  isListening(): boolean {
    return this.listening;
  }

  isSpeaking(): boolean {
    return this.speaking;
  }

  listen(): Promise<string> {
    return new Promise((resolve, reject) => {
      if (!this.recognition) {
        reject(new Error('Speech recognition not supported'));
        return;
      }

      this.recognition.lang = this.language;
      this.listening = true;

      this.recognition.onresult = (event: SpeechRecognitionEvent) => {
        const transcript = event.results[0][0].transcript;
        this.listening = false;
        resolve(transcript);
      };

      this.recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        this.listening = false;
        if (event.error === 'no-speech') {
          resolve('');
        } else {
          reject(new Error(event.error));
        }
      };

      this.recognition.onend = () => {
        this.listening = false;
      };

      try {
        this.recognition.start();
      } catch {
        this.listening = false;
        reject(new Error('Failed to start recognition'));
      }
    });
  }

  stopListening(): void {
    if (this.recognition && this.listening) {
      this.recognition.stop();
      this.listening = false;
    }
  }

  async recognizeSpeech(_audioBlob?: Blob): Promise<string> {
    return this.listen();
  }

  speak(text: string, lang = 'de-DE'): Promise<void> {
    return new Promise((resolve, reject) => {
      stopAllAudio();
      this.speaking = false;

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = lang;
      utterance.rate = SPEED_RATES[this.speed];
      if (this.selectedVoice) utterance.voice = this.selectedVoice;

      utterance.onstart = () => {
        this.speaking = true;
      };
      utterance.onend = () => {
        this.speaking = false;
        resolve();
      };
      utterance.onerror = (e) => {
        this.speaking = false;
        reject(e);
      };

      this.synthesis.speak(utterance);
    });
  }

  stopSpeaking(): void {
    stopBrowserAudio();
    this.speaking = false;
  }
}

let voiceServiceInstance: VoiceServiceInterface | null = null;

export function getVoiceService(): VoiceServiceInterface {
  if (!voiceServiceInstance) {
    voiceServiceInstance = new BrowserVoiceService();
  }
  return voiceServiceInstance;
}

export function setVoiceService(service: VoiceServiceInterface): void {
  voiceServiceInstance = service;
}

export function isGeminiLiveEnabled(): boolean {
  return String(import.meta.env.VITE_USE_GEMINI_LIVE ?? 'false') === 'true';
}
