/**
 * FreeVoiceEngine — TTS/STT gratuito via Web Speech API (celular).
 * Não decide pedagogia; fala/ouve exatamente o texto pedido.
 */
import type { VoiceEngine } from '@/services/voice/VoiceEngine';
import {
  getSpeechRecognitionCtor,
  getVoiceCapabilities,
  hasSpeechSynthesis,
} from '@/services/voice/voiceCapabilities';
import { freeVoiceLog } from '@/services/voice/freeVoiceLog';
import type {
  FreeVoiceHandlers,
  ListenOptions,
  SpeakOptions,
  VoiceCapabilities,
  VoiceEngineState,
  VoiceLang,
} from '@/services/voice/voiceTypes';

function pickVoice(
  voices: SpeechSynthesisVoice[],
  lang: string,
): SpeechSynthesisVoice | null {
  const base = lang.toLowerCase();
  if (base.startsWith('de')) {
    return (
      voices.find((v) => /^de-de$/i.test(v.lang)) ||
      voices.find((v) => /^de(-|$)/i.test(v.lang)) ||
      voices.find((v) => /german|deutsch/i.test(v.name)) ||
      null
    );
  }
  if (base.startsWith('pt')) {
    return (
      voices.find((v) => /^pt-br$/i.test(v.lang)) ||
      voices.find((v) => /^pt-pt$/i.test(v.lang)) ||
      voices.find((v) => /^pt(-|$)/i.test(v.lang)) ||
      voices.find((v) => /portug/i.test(v.name)) ||
      null
    );
  }
  return (
    voices.find((v) => v.lang.toLowerCase() === base) ||
    voices.find((v) => v.lang.toLowerCase().startsWith(base.slice(0, 2))) ||
    null
  );
}

function normalizeSttError(code: string): string {
  const c = String(code || '').toLowerCase();
  if (c === 'not-allowed' || c === 'permission-denied') return c;
  if (
    c === 'no-speech' ||
    c === 'audio-capture' ||
    c === 'network' ||
    c === 'aborted' ||
    c === 'service-not-allowed'
  ) {
    return c;
  }
  return c || 'unknown';
}

export class FreeVoiceEngine implements VoiceEngine {
  readonly providerId = 'free-browser';

  private language: VoiceLang = 'de-DE';
  private state: VoiceEngineState = 'IDLE';
  private speaking = false;
  private listening = false;
  private handlers: FreeVoiceHandlers = {};
  private recognition: SpeechRecognition | null = null;
  private voices: SpeechSynthesisVoice[] = [];
  private voicesReady: Promise<void>;
  private resolveVoices!: () => void;
  private voicesResolved = false;
  private listenReject: ((err: Error) => void) | null = null;
  private listenResolve: ((text: string) => void) | null = null;
  private finalBuffer = '';
  private disposed = false;

  constructor() {
    this.voicesReady = new Promise((resolve) => {
      this.resolveVoices = () => {
        if (this.voicesResolved) return;
        this.voicesResolved = true;
        resolve();
      };
    });
    this.bootstrapVoices();
    this.initRecognition();
    const caps = this.getCapabilities();
    if (!caps.speechSynthesis && !caps.speechRecognition) {
      this.state = 'UNSUPPORTED';
    }
  }

  private bootstrapVoices(): void {
    if (!hasSpeechSynthesis()) {
      this.resolveVoices();
      return;
    }
    const load = () => {
      this.voices = window.speechSynthesis.getVoices();
      if (this.voices.length > 0) {
        freeVoiceLog('voices_loaded', {
          count: this.voices.length,
          de: this.voices.filter((v) => /^de/i.test(v.lang)).map((v) => v.name).slice(0, 5),
          pt: this.voices.filter((v) => /^pt/i.test(v.lang)).map((v) => v.name).slice(0, 5),
        });
        this.resolveVoices();
      }
    };
    load();
    if (typeof window.speechSynthesis.addEventListener === 'function') {
      window.speechSynthesis.addEventListener('voiceschanged', load);
    } else {
      window.speechSynthesis.onvoiceschanged = load;
    }
    // Mobile: voices podem chegar tarde — não bloquear eternamente.
    window.setTimeout(() => {
      load();
      this.resolveVoices();
    }, 1500);
  }

  private initRecognition(): void {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) return;
    this.recognition = new Ctor();
    this.recognition.continuous = false;
    this.recognition.interimResults = true;
    this.recognition.maxAlternatives = 1;
    this.recognition.lang = this.language;
  }

  getState(): VoiceEngineState {
    return this.state;
  }

  getCapabilities(): VoiceCapabilities {
    return getVoiceCapabilities(this.voices);
  }

  setHandlers(handlers: FreeVoiceHandlers): void {
    this.handlers = handlers || {};
  }

  setLanguage(lang: VoiceLang): void {
    this.language = lang;
    if (this.recognition) this.recognition.lang = lang;
  }

  getAvailableVoices(): SpeechSynthesisVoice[] {
    if (hasSpeechSynthesis()) {
      const live = window.speechSynthesis.getVoices();
      if (live.length) this.voices = live;
    }
    return [...this.voices];
  }

  isSpeaking(): boolean {
    return this.speaking;
  }

  isListening(): boolean {
    return this.listening;
  }

  stop(): void {
    if (hasSpeechSynthesis()) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        /* ignore */
      }
    }
    this.speaking = false;
    if (this.state === 'SPEAKING') this.state = 'IDLE';
  }

  pause(): void {
    if (hasSpeechSynthesis()) {
      try {
        window.speechSynthesis.pause();
      } catch {
        /* ignore */
      }
    }
  }

  resume(): void {
    if (hasSpeechSynthesis()) {
      try {
        window.speechSynthesis.resume();
      } catch {
        /* ignore */
      }
    }
  }

  async speak(text: string, options: SpeakOptions = {}): Promise<void> {
    if (this.disposed) return;
    const trimmed = String(text || '').trim();
    if (!trimmed) return;

    if (!hasSpeechSynthesis()) {
      freeVoiceLog('tts_error', { reason: 'unsupported' });
      this.state = 'UNSUPPORTED';
      this.handlers.onError?.('unsupported', 'Speech synthesis not available');
      throw new Error('speech_synthesis_unsupported');
    }

    if (this.listening) this.abortListening();

    const cancelPrevious = options.cancelPrevious !== false;
    if (cancelPrevious) this.stop();

    await this.voicesReady;
    const lang = options.lang || this.language || 'de-DE';
    const voices = this.getAvailableVoices();
    const voice = pickVoice(voices, lang);
    if (!voice) {
      freeVoiceLog('tts_error', {
        reason: 'no_matching_voice',
        lang,
        voiceCount: voices.length,
        note: 'usando lang nativo do utterance',
      });
    }

    return new Promise<void>((resolve, reject) => {
      const utterance = new SpeechSynthesisUtterance(trimmed);
      utterance.lang = lang;
      if (voice) utterance.voice = voice;
      if (typeof options.rate === 'number') utterance.rate = options.rate;
      if (typeof options.pitch === 'number') utterance.pitch = options.pitch;

      this.speaking = true;
      this.state = 'SPEAKING';
      freeVoiceLog('tts_start', { lang, len: trimmed.length, voice: voice?.name || null });
      this.handlers.onSpeakStart?.(trimmed);

      utterance.onend = () => {
        this.speaking = false;
        this.state = 'IDLE';
        freeVoiceLog('tts_end', { lang, len: trimmed.length });
        this.handlers.onSpeakEnd?.();
        resolve();
      };
      utterance.onerror = (ev) => {
        this.speaking = false;
        const errName = String((ev as SpeechSynthesisErrorEvent)?.error || 'tts_error');
        freeVoiceLog('tts_error', { error: errName });
        this.handlers.onError?.(errName, errName);
        // Não travar a UI — resolve para o fluxo pedagógico continuar.
        this.state = 'IDLE';
        resolve();
      };

      try {
        try {
          window.speechSynthesis.resume();
        } catch {
          /* ignore */
        }
        window.speechSynthesis.speak(utterance);
      } catch (err) {
        this.speaking = false;
        this.state = 'IDLE';
        freeVoiceLog('tts_error', { error: String(err) });
        this.handlers.onError?.('tts_error', String(err));
        reject(err instanceof Error ? err : new Error('tts_failed'));
      }
    });
  }

  startListening(options: ListenOptions = {}): Promise<string> {
    if (this.disposed) {
      return Promise.reject(new Error('disposed'));
    }
    if (this.speaking) this.stop();

    if (!this.recognition) {
      this.state = 'UNSUPPORTED';
      freeVoiceLog('stt_error', { code: 'unsupported' });
      this.handlers.onError?.('unsupported', 'Speech recognition not available');
      return Promise.reject(new Error('speech_recognition_unsupported'));
    }

    if (this.listening) {
      this.abortListening();
    }

    const lang = options.lang || this.language || 'de-DE';
    this.recognition.lang = lang;
    this.recognition.continuous = options.continuous ?? false;
    this.recognition.interimResults = options.interimResults ?? true;
    this.recognition.maxAlternatives = options.maxAlternatives ?? 1;
    this.finalBuffer = '';

    return new Promise<string>((resolve, reject) => {
      this.listenResolve = resolve;
      this.listenReject = reject;
      this.listening = true;
      this.state = 'LISTENING';
      freeVoiceLog('stt_start', { lang });
      this.handlers.onStart?.();

      const finishOk = (text: string) => {
        const res = this.listenResolve;
        this.listenResolve = null;
        this.listenReject = null;
        this.listening = false;
        this.state = text.trim() ? 'PROCESSING' : 'IDLE';
        res?.(text.trim());
        // PROCESSING é breve — a UI de lesson muda para grading.
        if (this.state === 'PROCESSING') {
          window.setTimeout(() => {
            if (this.state === 'PROCESSING') this.state = 'IDLE';
          }, 50);
        }
      };

      const finishErr = (code: string) => {
        const rej = this.listenReject;
        this.listenResolve = null;
        this.listenReject = null;
        this.listening = false;
        this.state = code === 'aborted' || code === 'no-speech' ? 'IDLE' : 'ERROR';
        rej?.(new Error(code));
        window.setTimeout(() => {
          if (this.state === 'ERROR') this.state = 'IDLE';
        }, 0);
      };

      this.recognition!.onresult = (event: SpeechRecognitionEvent) => {
        let interim = '';
        let finalChunk = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const res = event.results[i];
          const t = res[0]?.transcript || '';
          if (res.isFinal) finalChunk += t;
          else interim += t;
        }
        if (interim) {
          freeVoiceLog('stt_interim', { len: interim.length });
          this.handlers.onInterimResult?.(interim);
          this.handlers.onResult?.(interim, false);
        }
        if (finalChunk) {
          this.finalBuffer += finalChunk;
          freeVoiceLog('stt_final', { len: this.finalBuffer.length });
          this.handlers.onResult?.(this.finalBuffer.trim(), true);
        }
      };

      this.recognition!.onerror = (event: SpeechRecognitionErrorEvent) => {
        const code = normalizeSttError(event.error);
        freeVoiceLog('stt_error', { code });
        this.handlers.onError?.(code, code);
        if (code === 'no-speech' && this.finalBuffer.trim()) {
          finishOk(this.finalBuffer);
          return;
        }
        finishErr(code);
      };

      this.recognition!.onend = () => {
        freeVoiceLog('stt_end', { hadFinal: !!this.finalBuffer.trim() });
        this.handlers.onEnd?.();
        if (!this.listenResolve && !this.listenReject) return;
        // Sessão curta: devolve final acumulado (pode ser '').
        finishOk(this.finalBuffer);
      };

      try {
        this.recognition!.start();
      } catch (err) {
        freeVoiceLog('stt_error', { code: 'busy', message: String(err) });
        this.handlers.onError?.('busy', String(err));
        finishErr('busy');
      }
    });
  }

  stopListening(): void {
    if (!this.recognition || !this.listening) {
      this.listening = false;
      if (this.state === 'LISTENING' || this.state === 'PROCESSING') this.state = 'IDLE';
      return;
    }
    try {
      this.recognition.stop();
    } catch {
      /* ignore */
    }
  }

  abortListening(): void {
    if (!this.recognition) {
      this.listening = false;
      this.state = 'IDLE';
      return;
    }
    try {
      this.recognition.abort();
    } catch {
      try {
        this.recognition.stop();
      } catch {
        /* ignore */
      }
    }
    this.listening = false;
    const rej = this.listenReject;
    this.listenResolve = null;
    this.listenReject = null;
    this.state = 'IDLE';
    rej?.(new Error('aborted'));
  }

  dispose(): void {
    this.disposed = true;
    this.stop();
    this.abortListening();
    this.handlers = {};
    this.recognition = null;
  }
}
