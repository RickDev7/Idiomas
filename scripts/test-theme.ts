/* Testes do sistema de tema (preferência vs efetivo).
   Rodar: npx tsx scripts/test-theme.ts */

const _store = new Map<string, string>();
(globalThis as unknown as { localStorage: Storage }).localStorage = {
  getItem: (k) => _store.get(k) ?? null,
  setItem: (k, v) => { _store.set(k, String(v)); },
  removeItem: (k) => { _store.delete(k); },
  clear: () => { _store.clear(); },
  key: () => null,
  length: 0,
} as Storage;

const classSet = new Set<string>();
const html = {
  classList: {
    add: (c: string) => { classSet.add(c); },
    remove: (c: string) => { classSet.delete(c); },
    toggle: (c: string, force?: boolean) => {
      if (force === true) classSet.add(c);
      else if (force === false) classSet.delete(c);
      else if (classSet.has(c)) classSet.delete(c);
      else classSet.add(c);
      return classSet.has(c);
    },
    contains: (c: string) => classSet.has(c),
  },
  dataset: {} as Record<string, string>,
  style: { colorScheme: '' },
};

(globalThis as unknown as { document: unknown }).document = {
  documentElement: html,
  querySelector: () => null,
};

let systemLight = false;
(globalThis as unknown as { window: unknown }).window = {
  matchMedia: (q: string) => ({
    matches: q.includes('prefers-color-scheme: light') ? systemLight : !systemLight,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
  }),
};

const { ThemeService } = await import('../src/services/ui/ThemeService');

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean) {
  if (cond) { passed++; console.log(`  ✓ ${name}`); }
  else { failed++; console.error(`  ✗ ${name}`); }
}

console.log('— ThemeService');

ThemeService.init();
check('default sem storage é system', ThemeService.get() === 'system');

ThemeService.set('light');
check('preferência light', ThemeService.get() === 'light');
check('efetivo light', ThemeService.resolved() === 'light');
check('classe .light no html', classSet.has('light'));
check('data-theme=light', html.dataset.theme === 'light');
check('data-themePreference=light', html.dataset.themePreference === 'light');
check('persistido', _store.get('dt_theme') === 'light');

ThemeService.set('dark');
check('preferência dark', ThemeService.get() === 'dark');
check('efetivo dark', ThemeService.resolved() === 'dark');
check('sem classe .light', !classSet.has('light'));
check('data-theme=dark', html.dataset.theme === 'dark');
check('persistido dark', _store.get('dt_theme') === 'dark');

systemLight = true;
ThemeService.set('system');
check('preferência system', ThemeService.get() === 'system');
check('sistema claro → efetivo light', ThemeService.resolved() === 'light');
check('classe .light no system claro', classSet.has('light'));

systemLight = false;
ThemeService.set('system');
check('sistema escuro → efetivo dark', ThemeService.resolved() === 'dark');
check('sem .light no system escuro', !classSet.has('light'));
check('persistido system', _store.get('dt_theme') === 'system');

console.log(`\nResultado: ${passed} passaram, ${failed} falharam`);
if (failed > 0) process.exit(1);
