// ThemeService — preferência (dark|light|system) vs tema efetivo (dark|light).
// Aplica classe `.light` + data-theme no <html> e atualiza theme-color do PWA.

export type ThemePreference = 'dark' | 'light' | 'system';
export type EffectiveTheme = 'dark' | 'light';
/** @deprecated use ThemePreference */
export type Theme = ThemePreference;

const STORAGE_KEY = 'dt_theme';

type Listener = (preference: ThemePreference, effective: EffectiveTheme) => void;
const listeners = new Set<Listener>();

let preference: ThemePreference = 'system';
let mediaQuery: MediaQueryList | null = null;

function resolveEffective(pref: ThemePreference): EffectiveTheme {
  if (pref !== 'system') return pref;
  if (typeof window === 'undefined') return 'dark';
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

function notify(): void {
  const effective = resolveEffective(preference);
  listeners.forEach((fn) => {
    try { fn(preference, effective); } catch { /* ignore */ }
  });
}

function applyDom(pref: ThemePreference): EffectiveTheme {
  const effective = resolveEffective(pref);
  if (typeof document === 'undefined') return effective;
  const root = document.documentElement;
  root.classList.toggle('light', effective === 'light');
  root.dataset.theme = effective;
  root.dataset.themePreference = pref;
  root.style.colorScheme = effective;

  const meta = document.querySelector('meta[name="theme-color"]:not([media])') as HTMLMetaElement | null;
  if (meta) meta.content = effective === 'light' ? '#E8EEF6' : '#0B0F19';

  return effective;
}

function onSystemChange(): void {
  if (preference === 'system') {
    applyDom('system');
    notify();
  }
}

export const ThemeService = {
  init(): ThemePreference {
    const stored = localStorage.getItem(STORAGE_KEY) as ThemePreference | null;
    preference = stored === 'dark' || stored === 'light' || stored === 'system' ? stored : 'system';
    applyDom(preference);

    if (!mediaQuery) {
      mediaQuery = window.matchMedia('(prefers-color-scheme: light)');
      mediaQuery.addEventListener('change', onSystemChange);
    }
    return preference;
  },

  /** Preferência escolhida pelo usuário (dark | light | system). */
  get(): ThemePreference {
    return preference;
  },

  /** Tema visual efetivo aplicado no DOM. */
  resolved(): EffectiveTheme {
    return resolveEffective(preference);
  },

  set(theme: ThemePreference): void {
    preference = theme;
    localStorage.setItem(STORAGE_KEY, theme);
    applyDom(theme);
    notify();
  },

  reset(): ThemePreference {
    this.set('system');
    return preference;
  },

  subscribe(fn: Listener): () => void {
    listeners.add(fn);
    return () => { listeners.delete(fn); };
  },
};
