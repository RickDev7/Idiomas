/* Testes das configurações reais.
   Rodar: npx tsx scripts/test-settings.ts */
const _store = new Map<string, string>();
(globalThis as unknown as { localStorage: Storage }).localStorage = {
  getItem: (k) => _store.get(k) ?? null,
  setItem: (k, v) => { _store.set(k, String(v)); },
  removeItem: (k) => { _store.delete(k); },
  clear: () => { _store.clear(); },
  key: () => null,
  length: 0,
} as Storage;

try {
  Object.defineProperty(globalThis, 'navigator', {
    value: { vibrate: () => true },
    configurable: true,
  });
} catch {
  /* navigator already present */
}

import { UiPrefsService, helpLevelToNumber, immersionHint } from '../src/services/ui/UiPrefsService';
import { HapticService } from '../src/services/ui/HapticService';
import { SoundService } from '../src/services/ui/SoundService';
import { NotificationService } from '../src/services/ui/NotificationService';
import { LocaleService, t } from '../src/services/ui/LocaleService';
import { immersionGuidanceForTeacher, intensiveGuidanceForTeacher, planTodaysTraining } from '../src/services/teacher/TeacherEngine';
import type { UserProfile } from '../src/types';

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean) {
  if (cond) { passed++; console.log(`  ✓ ${name}`); }
  else { failed++; console.error(`  ✗ ${name}`); }
}

const profile: UserProfile = {
  id: 'u', name: 'Rick', level: 'zero', dailyMinutes: 20, goal: 'daily', profession: '',
  frequentSituations: [], interests: [], onboardingComplete: true, firstLessonComplete: true,
  currentDay: 2, streak: 1, lastStudyDate: null, immersionPhase: 1, turboMode: false,
  speechSpeed: 'normal', germanPercentage: 80, createdAt: new Date().toISOString(),
};

console.log('— persistência UiPrefs');
UiPrefsService.reset();
check('default sound on', UiPrefsService.get().sound === true);
UiPrefsService.set({ sound: false, haptics: false, immersionTarget: 40, interfaceLanguage: 'de-DE' });
check('sound off salvo', UiPrefsService.get().sound === false);
check('imersão 40 salva', UiPrefsService.get().immersionTarget === 40);
check('idioma DE salvo', UiPrefsService.get().interfaceLanguage === 'de-DE');
const raw = localStorage.getItem('dt_uiprefs');
check('está no localStorage', !!raw && raw.includes('"sound":false'));

console.log('— reset não apaga outras chaves');
localStorage.setItem('deutsch-turbo:session-continuity:v1', '{"sessionCount":3}');
UiPrefsService.reset();
check('prefs resetadas', UiPrefsService.get().sound === true);
check('continuidade intacta', localStorage.getItem('deutsch-turbo:session-continuity:v1')?.includes('sessionCount'));

console.log('— haptic respeita preferência');
UiPrefsService.set({ haptics: false });
check('haptic disabled', HapticService.isEnabled() === false);
UiPrefsService.set({ haptics: true });
check('haptic enabled', HapticService.isEnabled() === true);

console.log('— sound respeita preferência');
UiPrefsService.set({ sound: false });
check('sound disabled', SoundService.isEnabled() === false);
UiPrefsService.set({ sound: true });
check('sound enabled', SoundService.isEnabled() === true);

console.log('— notificações');
NotificationService.disable();
check('notif off', NotificationService.isEnabled() === false);

console.log('— i18n');
LocaleService.set('en-US');
check('t settings.title EN', t('settings.title') === 'Settings');
LocaleService.set('de-DE');
check('t settings.title DE', t('settings.title') === 'Einstellungen');
LocaleService.set('pt-BR');
check('t settings.title PT', t('settings.title') === 'Configurações');

console.log('— imersão / intensivo no teacher');
check('imersão baixa em PT guidance', /português/i.test(immersionGuidanceForTeacher(20)));
check('imersão alta em DE guidance', /alemão predominante/i.test(immersionGuidanceForTeacher(70)));
check('intensivo guidance', /INTENSIVO/i.test(intensiveGuidanceForTeacher(true)));
check('normal guidance', /NORMAL/i.test(intensiveGuidanceForTeacher(false)));
check('hint 80%', /aumenta o alemão/i.test(immersionHint(80)));

const normal = planTodaysTraining({ ...profile, turboMode: false }, []);
const turbo = planTodaysTraining({ ...profile, turboMode: true }, []);
const speakN = normal.stages.find((s) => s.id === 'speaking')!.minutes;
const speakT = turbo.stages.find((s) => s.id === 'speaking')!.minutes;
check('turbo dá mais speaking', speakT >= speakN);

console.log('— help level');
check('extra → 3', helpLevelToNumber('extra') === 3);
check('minimal → 0', helpLevelToNumber('minimal') === 0);

console.log(`\nResultado: ${passed} passaram, ${failed} falharam`);
if (failed > 0) process.exit(1);
