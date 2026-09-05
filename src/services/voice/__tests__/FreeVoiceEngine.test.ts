/**
 * FreeVoiceEngine / Factory / capabilities — mocks de Web Speech API.
 * Uso: npx tsx src/services/voice/__tests__/FreeVoiceEngine.test.ts
 *
 * NÃO prova STT real em Android — apenas lógica + CAPABILITY DETECTED.
 */
import { VoiceEngineFactory, normalizeVoiceProvider, isVoiceProvider } from '@/services/voice/VoiceEngineFactory';
import { getVoiceCapabilities, hasSpeechRecognition, hasSpeechSynthesis } from '@/services/voice/voiceCapabilities';
import { FreeVoiceEngine } from '@/services/voice/FreeVoiceEngine';
import { TextVoiceEngine } from '@/services/voice/TextVoiceEngine';
import { adaptVoiceEngineToService } from '@/services/voice/voiceEngineAdapter';
import type { VoiceEngine } from '@/services/voice/VoiceEngine';
import type { VoiceProvider } from '@/services/voice/voiceTypes';

let passed = 0;
let failed = 0;

function check(name: string, cond: boolean) {
  if (cond) {
    passed += 1;
    console.log(`  ✓ ${name}`);
  } else {
    failed += 1;
    console.error(`  ✗ ${name}`);
  }
}

type SynthVoice = { lang: string; name: string; default?: boolean; localService?: boolean; voiceURI?: string };

function installSpeechMocks(opts: {
  voices?: SynthVoice[];
  synth?: boolean;
  recognition?: boolean;
}) {
  const voices = (opts.voices || []) as unknown as SpeechSynthesisVoice[];
  const utterances: SpeechSynthesisUtterance[] = [];

  if (opts.synth !== false) {
    const synth = {
      speaking: false,
      pending: false,
      paused: false,
      getVoices: () => voices,
      speak: (u: SpeechSynthesisUtterance) => {
        utterances.push(u);
        synth.speaking = true;
        queueMicrotask(() => {
          synth.speaking = false;
          u.onend?.(new Event('end') as SpeechSynthesisEvent);
        });
      },
      cancel: () => {
        synth.speaking = false;
      },
      pause: () => {
        synth.paused = true;
      },
      resume: () => {
        synth.paused = false;
      },
      addEventListener: (_: string, cb: () => void) => {
        queueMicrotask(cb);
      },
      removeEventListener: () => {},
      onvoiceschanged: null as (() => void) | null,
    };
    Object.defineProperty(globalThis, 'speechSynthesis', {
      value: synth,
      configurable: true,
      writable: true,
    });
    (globalThis as unknown as { SpeechSynthesisUtterance: unknown }).SpeechSynthesisUtterance = class {
      text = '';
      lang = '';
      voice: SpeechSynthesisVoice | null = null;
      rate = 1;
      pitch = 1;
      onend: ((ev: SpeechSynthesisEvent) => void) | null = null;
      onerror: ((ev: SpeechSynthesisErrorEvent) => void) | null = null;
      constructor(text: string) {
        this.text = text;
      }
    };
  } else {
    Object.defineProperty(globalThis, 'speechSynthesis', {
      value: undefined,
      configurable: true,
      writable: true,
    });
  }

  class MockRecognition {
    lang = 'de-DE';
    continuous = false;
    interimResults = true;
    maxAlternatives = 1;
    onresult: ((ev: SpeechRecognitionEvent) => void) | null = null;
    onerror: ((ev: SpeechRecognitionErrorEvent) => void) | null = null;
    onend: (() => void) | null = null;
    private mode: 'ok' | 'error' | 'empty' = 'ok';
    private errorCode = 'no-speech';

    __setMode(mode: 'ok' | 'error' | 'empty', errorCode = 'no-speech') {
      this.mode = mode;
      this.errorCode = errorCode;
    }

    start() {
      queueMicrotask(() => {
        if (this.mode === 'error') {
          this.onerror?.({ error: this.errorCode } as SpeechRecognitionErrorEvent);
          this.onend?.();
          return;
        }
        if (this.mode === 'empty') {
          this.onend?.();
          return;
        }
        const result = {
          isFinal: true,
          0: { transcript: 'Guten Morgen', confidence: 0.9 },
          length: 1,
        };
        this.onresult?.({
          resultIndex: 0,
          results: { 0: result, length: 1, item: () => result },
        } as unknown as SpeechRecognitionEvent);
        this.onend?.();
      });
    }

    stop() {
      this.onend?.();
    }

    abort() {
      this.onerror?.({ error: 'aborted' } as SpeechRecognitionErrorEvent);
      this.onend?.();
    }
  }

  let lastRec: MockRecognition | null = null;
  if (opts.recognition !== false) {
    const Ctor = function SpeechRecognition() {
      lastRec = new MockRecognition();
      return lastRec;
    } as unknown as new () => SpeechRecognition;
    (globalThis as unknown as { window: Window }).window = globalThis as unknown as Window;
    (globalThis as unknown as { SpeechRecognition: unknown }).SpeechRecognition = Ctor;
    (globalThis as unknown as { webkitSpeechRecognition: unknown }).webkitSpeechRecognition = undefined;
  } else {
    (globalThis as unknown as { SpeechRecognition: unknown }).SpeechRecognition = undefined;
    (globalThis as unknown as { webkitSpeechRecognition: unknown }).webkitSpeechRecognition = undefined;
  }

  // Força UA Android/Chrome no mock (Node já tem navigator).
  try {
    Object.defineProperty(globalThis.navigator, 'userAgent', {
      value: 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
      configurable: true,
    });
  } catch {
    Object.defineProperty(globalThis, 'navigator', {
      value: {
        userAgent:
          'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
      },
      configurable: true,
    });
  }

  return {
    utterances,
    getLastRecognition: () => lastRec,
  };
}

async function run() {
  console.log('\n=== FreeVoiceEngine / Factory ===\n');

  // Provider selection
  check('isVoiceProvider gemini-live', isVoiceProvider('gemini-live'));
  check('isVoiceProvider free-browser', isVoiceProvider('free-browser'));
  check('isVoiceProvider text', isVoiceProvider('text'));
  check('reject invalid provider', !isVoiceProvider('elevenlabs'));
  check('normalize fallback gemini-live', normalizeVoiceProvider('x') === 'gemini-live');

  // Capabilities — CAPABILITY DETECTED (mock), not real mobile pass
  {
    installSpeechMocks({
      voices: [
        { lang: 'de-DE', name: 'Google Deutsch' },
        { lang: 'pt-BR', name: 'Google Português' },
      ],
    });
    const caps = getVoiceCapabilities();
    check('CAPABILITY DETECTED speechSynthesis', caps.speechSynthesis === true);
    check('CAPABILITY DETECTED speechRecognition', caps.speechRecognition === true);
    check('germanTTS true when de voice present', caps.germanTTS === true);
    check('android detected from UA', caps.android === true);
    check('browser Chrome', caps.browser === 'Chrome');
    check('hasSpeechSynthesis helper', hasSpeechSynthesis() === true);
    check('hasSpeechRecognition helper', hasSpeechRecognition() === true);
  }

  // Factory
  {
    installSpeechMocks({ voices: [{ lang: 'de-DE', name: 'Deutsch' }] });
    const free = VoiceEngineFactory.create('free-browser');
    check('factory free-browser', free.providerId === 'free-browser');
    const text = VoiceEngineFactory.create('text');
    check('factory text', text.providerId === 'text');
    check('factory implements VoiceEngine speak', typeof free.speak === 'function');
    check('factory implements startListening', typeof free.startListening === 'function');
  }

  // FreeVoiceEngine TTS de-DE / pt-BR
  {
    const { utterances } = installSpeechMocks({
      voices: [
        { lang: 'de-DE', name: 'Google Deutsch' },
        { lang: 'pt-BR', name: 'Google Português do Brasil' },
      ],
    });
    const engine = new FreeVoiceEngine();
    check('initial IDLE', engine.getState() === 'IDLE' || engine.getState() === 'UNSUPPORTED');

    await engine.speak('Guten Morgen!', { lang: 'de-DE' });
    check('tts de-DE uttered', utterances.some((u) => u.lang === 'de-DE' && u.text.includes('Guten Morgen')));
    check('not speaking after end', engine.isSpeaking() === false);
    check('state IDLE after speak', engine.getState() === 'IDLE');

    await engine.speak('Como você se chama?', { lang: 'pt-BR' });
    check('tts pt-BR uttered', utterances.some((u) => u.lang === 'pt-BR'));

    engine.stop();
    engine.pause();
    engine.resume();
    check('getAvailableVoices has de', engine.getAvailableVoices().some((v) => /^de/i.test(v.lang)));
    engine.dispose();
  }

  // STT mock (NOT real mobile)
  {
    installSpeechMocks({ voices: [{ lang: 'de-DE', name: 'D' }] });
    const engine = new FreeVoiceEngine();
    const text = await engine.startListening({ lang: 'de-DE' });
    check('MOCK STT returns Guten Morgen (not REAL MOBILE TEST PASS)', text === 'Guten Morgen');
    check('not listening after result', engine.isListening() === false);
    engine.dispose();
  }

  // Error handling — permission
  {
    const { getLastRecognition } = installSpeechMocks({ voices: [{ lang: 'de-DE', name: 'D' }] });
    const engine = new FreeVoiceEngine();
    // Re-init recognition after construct — patch next start
    const rec = (engine as unknown as { recognition: { __setMode?: (m: string, c?: string) => void } }).recognition;
    // recognition was created in constructor; replace start behavior via last mock instance
    const last = getLastRecognition();
    // New listen creates... actually FreeVoiceEngine reuses same recognition from constructor.
    // Patch the instance used by engine:
    if (rec && typeof (rec as { __setMode?: unknown }).__setMode === 'function') {
      (rec as { __setMode: (m: 'error', c: string) => void }).__setMode('error', 'not-allowed');
    } else if (last) {
      last.__setMode('error', 'not-allowed');
    }
    // Force by replacing recognition methods on engine's recognition
    const engRec = (engine as unknown as { recognition: {
      start: () => void;
      onerror: ((ev: SpeechRecognitionErrorEvent) => void) | null;
      onend: (() => void) | null;
      onresult: ((ev: SpeechRecognitionEvent) => void) | null;
    } }).recognition;
    engRec.start = () => {
      queueMicrotask(() => {
        engRec.onerror?.({ error: 'not-allowed' } as SpeechRecognitionErrorEvent);
        engRec.onend?.();
      });
    };
    let errCode = '';
    try {
      await engine.startListening();
    } catch (e) {
      errCode = e instanceof Error ? e.message : '';
    }
    check('stt not-allowed surfaces error', errCode === 'not-allowed');
    check('state usable after error', engine.getState() === 'IDLE' || engine.getState() === 'ERROR');
    // Force IDLE wait
    await new Promise((r) => setTimeout(r, 5));
    check('state back to IDLE', engine.getState() === 'IDLE');
    engine.dispose();
  }

  // Text provider fallback
  {
    installSpeechMocks({ synth: false, recognition: false });
    const textEngine = new TextVoiceEngine();
    check('text provider id', textEngine.providerId === 'text');
    await textEngine.speak('Guten Morgen!');
    check('text speak is silent success', textEngine.getState() === 'IDLE');
    // prompt may be undefined in node
    (globalThis as unknown as { prompt: (m?: string, d?: string) => string | null }).prompt = () => 'Hallo';
    const heard = await textEngine.startListening();
    check('text listen via prompt', heard === 'Hallo');
    textEngine.dispose();
  }

  // Adapter → VoiceServiceInterface
  {
    installSpeechMocks({ voices: [{ lang: 'de-DE', name: 'D' }] });
    const engine: VoiceEngine = VoiceEngineFactory.create('free-browser');
    const svc = adaptVoiceEngineToService(engine);
    check('adapter isSupported', svc.isSupported() === true);
    await svc.speak('Hallo', 'de-DE');
    const t = await svc.listen();
    check('adapter listen feeds pipeline text', t === 'Guten Morgen');
    engine.dispose();
  }

  // Provider matrix
  const providers: VoiceProvider[] = ['gemini-live', 'free-browser', 'text'];
  for (const p of providers) {
    check(`normalize keeps ${p}`, normalizeVoiceProvider(p) === p);
  }

  console.log(`\nResultado: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exitCode = 1;
  console.log('\nNOTA: MOCK STT ≠ REAL MOBILE TEST PASS. Validar TTS/STT no Android/Chrome manualmente.\n');
}

void run();
