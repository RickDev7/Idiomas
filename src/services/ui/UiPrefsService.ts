/* UiPrefsService — fonte única das preferências de interface.
   Separadas do perfil de aprendizagem (turboMode/germanPercentage ficam no UserProfile). */
export type TranslationMode = 'always' | 'ondemand' | 'immersion';
export type HelpLevelPref = 'auto' | 'normal' | 'extra' | 'minimal';
export type InterfaceLanguage = 'pt-BR' | 'de-DE' | 'en-US';

export interface UiPrefs {
  sound: boolean;
  haptics: boolean;
  notifications: boolean;
  interfaceLanguage: InterfaceLanguage;
  translationMode: TranslationMode;
  helpLevel: HelpLevelPref;
  /** Meta de imersão escolhida pelo usuário (0–100). Sincroniza com profile.germanPercentage. */
  immersionTarget: number;
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

