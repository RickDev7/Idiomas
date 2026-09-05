/* UiPrefsService — fonte única das preferências de interface.
   Separadas do perfil de aprendizagem (turboMode/germanPercentage ficam no UserProfile). */
import type { VoiceProvider } from '@/services/voice/voiceTypes';
import { normalizeVoiceProvider } from '@/services/voice/voiceTypes';

export type TranslationMode = 'always' | 'ondemand' | 'immersion';
export type HelpLevelPref = 'auto' | 'normal' | 'extra' | 'minimal';
export type InterfaceLanguage = 'pt-BR' | 'de-DE' | 'en-US';
export type { VoiceProvider };

export interface UiPrefs {
  sound: boolean;
  haptics: boolean;
  notifications: boolean;
  interfaceLanguage: InterfaceLanguage;
  translationMode: TranslationMode;
  helpLevel: HelpLevelPref;
  /** Meta de imersão escolhida pelo usuário (0–100). Sincroniza com profile.germanPercentage. */
  immersionTarget: number;
  /**
   * Camada de voz da sessão.
   * Padrão: gemini-live (sem alterar comportamento atual).
   */
  voiceProvider: VoiceProvider;
}

const KEY = 'dt_uiprefs';

const defaults: UiPrefs = {
  sound: true,
  haptics: true,
  notifications: false,
  interfaceLanguage: 'pt-BR',
  translationMode: 'always',
  helpLevel: 'auto',
  immersionTarget: 80,
  voiceProvider: 'gemini-live',
};

type Listener = (prefs: UiPrefs) => void;
const listeners = new Set<Listener>();

let cache: UiPrefs = { ...defaults };
let loaded = false;

function clampImmersion(n: unknown): number {
  const v = typeof n === 'number' ? n : Number(n);
  if (!Number.isFinite(v)) return defaults.immersionTarget;
  return Math.max(0, Math.min(100, Math.round(v)));
}

function load(): UiPrefs {
  if (loaded) return cache;
  loaded = true;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<UiPrefs>;
      cache = {
        ...defaults,
        ...parsed,
        immersionTarget: clampImmersion(parsed.immersionTarget ?? defaults.immersionTarget),
        voiceProvider: normalizeVoiceProvider(parsed.voiceProvider ?? defaults.voiceProvider),
      };
    }
  } catch {
    cache = { ...defaults };
  }
  return cache;
}

function persist(next: UiPrefs): UiPrefs {
  cache = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(cache));
  } catch {
    /* quota */
  }
  listeners.forEach((fn) => {
    try { fn(cache); } catch { /* ignore */ }
  });
  return cache;
}

export const UiPrefsService = {
  defaults: { ...defaults },
  get(): UiPrefs {
    return { ...load() };
  },
  set(partial: Partial<UiPrefs>): UiPrefs {
    const base = load();
    const next: UiPrefs = {
      ...base,
      ...partial,
      immersionTarget: clampImmersion(
        partial.immersionTarget !== undefined ? partial.immersionTarget : base.immersionTarget,
      ),
      voiceProvider: normalizeVoiceProvider(
        partial.voiceProvider !== undefined ? partial.voiceProvider : base.voiceProvider,
      ),
    };
    return persist(next);
  },
  reset(): UiPrefs {
    return persist({ ...defaults });
  },
  subscribe(fn: Listener): () => void {
    listeners.add(fn);
    return () => { listeners.delete(fn); };
  },
};

/** Mapeia preferência de ajuda → nível numérico inicial (0–5) para a lição. */
export function helpLevelToNumber(level: HelpLevelPref): number {
  if (level === 'extra') return 4;
  if (level === 'normal') return 2;
  if (level === 'minimal') return 0;
  return 2; // auto: começa moderado; ScaffoldingEngine faz fade
}

/**
 * Ajusta o scaffold do motor no INÍCIO da sessão.
 * auto = o motor decide; extra/normal/minimal = preferência do usuário.
 */
export function applyHelpPrefToScaffold(engineLevel: number, pref: HelpLevelPref): number {
  const e = Math.max(0, Math.min(5, Math.round(Number.isFinite(engineLevel) ? engineLevel : 2)));
  if (pref === 'auto') return e;
  if (pref === 'extra') return Math.max(e, 4);
  if (pref === 'normal') return 2;
  return 0;
}

export function helpLevelGuidanceForTeacher(level: HelpLevelPref): string {
  if (level === 'extra') {
    return 'AJUDA ALTA: contexto + pista + primeira palavra; frase parcial; completa só se o aluno travar.';
  }
  if (level === 'normal') {
    return 'AJUDA NORMAL: menos pistas; deixe o aluno tentar antes de modelar a frase inteira.';
  }
  if (level === 'minimal') {
    return 'AJUDA MÍNIMA: máxima tentativa independente; pista só após bloqueio claro.';
  }
  return 'AJUDA AUTOMÁTICA: ajuste o suporte ao desempenho real; reduza ajuda quando acertar sozinho.';
}

/** Texto curto para o teacherDirective (o compact prompt do Live não inclui help/imersão/intensivo). */
export function livePrefsDirective(opts: {
  helpLevel: HelpLevelPref;
  immersionPct: number;
  zeroLanguage: boolean;
  immersionGuidance: string;
  intensiveGuidance: string;
}): string {
  const immersion = opts.zeroLanguage
    ? `META DE IMERSÃO: ${opts.immersionPct}%. Nível iniciante: explicações em português e modelo em alemão. Não force alemão 100%.`
    : opts.immersionGuidance;
  return [helpLevelGuidanceForTeacher(opts.helpLevel), immersion, opts.intensiveGuidance]
    .filter(Boolean)
    .join('\n');
}

export function immersionBand(pct: number): 'low' | 'mid' | 'high' | 'max' {
  if (pct <= 25) return 'low';
  if (pct <= 50) return 'mid';
  if (pct <= 75) return 'high';
  return 'max';
}

export function immersionHint(pct: number): string {
  const p = clampImmersion(pct);
  if (p <= 25) return 'bastante apoio em português';
  if (p <= 50) return 'alemão crescente, com apoio quando precisa';
  if (p <= 75) return 'alemão predominante';
  if (p <= 90) return 'o professor aumenta o alemão sozinho';
  return 'quase toda a interação em alemão';
}

export { haptic, HapticService } from '@/services/ui/HapticService';

