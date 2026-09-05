/* Testes das configurações reais.
   Rodar: npx tsx scripts/test-settings.ts */
const _store = new Map<string, string>();
(globalThis as unknown as { localStorage: Storage; sessionStorage: Storage }).localStorage = {
  getItem: (k) => _store.get(k) ?? null,
  setItem: (k, v) => { _store.set(k, String(v)); },
  removeItem: (k) => { _store.delete(k); },
  clear: () => { _store.clear(); },
  key: () => null,
  length: 0,
} as Storage;
(globalThis as unknown as { sessionStorage: Storage }).sessionStorage =
  (globalThis as unknown as { localStorage: Storage }).localStorage;

try {
  Object.defineProperty(globalThis, 'navigator', {
    value: { vibrate: () => true },
    configurable: true,
  });
} catch {
  /* navigator already present */
}

import {
  UiPrefsService,
  applyHelpPrefToScaffold,
  helpLevelToNumber,
  helpLevelGuidanceForTeacher,
  immersionHint,
  livePrefsDirective,
} from '../src/services/ui/UiPrefsService';
import { HapticService } from '../src/services/ui/HapticService';
import { SoundService } from '../src/services/ui/SoundService';
import { NotificationService } from '../src/services/ui/NotificationService';
import { LocaleService, t } from '../src/services/ui/LocaleService';
import { immersionGuidanceForTeacher, intensiveGuidanceForTeacher, planTodaysTraining } from '../src/services/teacher/TeacherEngine';
import { ConversationOrchestrator } from '../src/services/teacher/ConversationOrchestrator';
import { emptyLearningProfile } from '../src/services/learning/RealProgress';
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
check('nav DE', t('nav.start', 'de-DE') === 'Start');
check('nav EN', t('nav.start', 'en-US') === 'Home');
check('seção geral DE', t('settings.section.general', 'de-DE') === 'ALLGEMEIN');

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

console.log('— treino minutos');
for (const m of [10, 20, 30, 60, 90] as const) {
  const plan = planTodaysTraining({ ...profile, dailyMinutes: m }, []);
  const sum = plan.stages.reduce((a, s) => a + s.minutes, 0);
  check(`planner ${m} min total`, plan.totalMinutes === m);
  check(`planner ${m} min soma estágios`, sum === m);
}

console.log('— help level');
check('extra → 4', helpLevelToNumber('extra') === 4);
check('minimal → 0', helpLevelToNumber('minimal') === 0);
check('normal → 2', helpLevelToNumber('normal') === 2);
check('auto começa moderado', helpLevelToNumber('auto') === 2);
check('extra eleva scaffold', applyHelpPrefToScaffold(1, 'extra') === 4);
check('auto preserva motor', applyHelpPrefToScaffold(1, 'auto') === 1);
check('normal fixa 2', applyHelpPrefToScaffold(5, 'normal') === 2);
check('minimal zera', applyHelpPrefToScaffold(5, 'minimal') === 0);
check('guidance extra', /AJUDA ALTA/.test(helpLevelGuidanceForTeacher('extra')));
check('guidance auto', /AUTOMÁTICA/.test(helpLevelGuidanceForTeacher('auto')));

const liveLow = livePrefsDirective({
  helpLevel: 'minimal',
  immersionPct: 20,
  zeroLanguage: false,
  immersionGuidance: immersionGuidanceForTeacher(20),
  intensiveGuidance: intensiveGuidanceForTeacher(false),
});
check('live recebe ajuda mínima', /AJUDA MÍNIMA/.test(liveLow));
check('live recebe imersão baixa', /português/i.test(liveLow));

const liveL0 = livePrefsDirective({
  helpLevel: 'extra',
  immersionPct: 100,
  zeroLanguage: true,
  immersionGuidance: immersionGuidanceForTeacher(100),
  intensiveGuidance: intensiveGuidanceForTeacher(true),
});
check('L0 não força alemão 100%', /Não force alemão 100%/.test(liveL0));
check('L0 ainda recebe ajuda alta', /AJUDA ALTA/.test(liveL0));
check('intensivo no overlay', /INTENSIVO/.test(liveL0));

console.log('— haptic vibrate');
let vibrateCalls = 0;
const vibrateFn = () => {
  vibrateCalls += 1;
  return true;
};
try {
  Object.defineProperty(globalThis.navigator, 'vibrate', {
    value: vibrateFn,
    configurable: true,
    writable: true,
  });
} catch {
  (globalThis.navigator as { vibrate: () => boolean }).vibrate = vibrateFn;
}
UiPrefsService.set({ haptics: false });
HapticService.pulse(12);
check('vibrate não chamado com haptics off', vibrateCalls === 0);
UiPrefsService.set({ haptics: true });
HapticService.pulse(12);
check('vibrate chamado com haptics on', vibrateCalls >= 1);

console.log('— notificações não disparam desligadas');
let notifCreated = 0;
class FakeNotification {
  static permission: NotificationPermission = 'granted';
  static requestPermission = async () => 'granted' as NotificationPermission;
  constructor(_title: string, _opts?: NotificationOptions) {
    notifCreated += 1;
  }
  close() {}
}
(globalThis as unknown as { Notification: typeof FakeNotification }).Notification = FakeNotification;
NotificationService.disable();
void NotificationService.maybeRemind().then(() => {});
void NotificationService.showTest();
check('nenhum lembrete com notif off', notifCreated === 0);

console.log('— reset não apaga aprendizado');
localStorage.setItem('learning-profile', '{"phrase-x":{"confidence":88}}');
localStorage.setItem('learning-events', '[{"type":"PHRASE_PRODUCED"}]');
localStorage.setItem('deutsch-turbo:session-continuity:v1', '{"sessionCount":9}');
UiPrefsService.set({ helpLevel: 'extra', immersionTarget: 15, notifications: true, haptics: false });
UiPrefsService.reset();
check('reset volta help auto', UiPrefsService.get().helpLevel === 'auto');
check('reset volta imersão 80', UiPrefsService.get().immersionTarget === 80);
check('reset volta haptics on', UiPrefsService.get().haptics === true);
check('reset desliga notif', UiPrefsService.get().notifications === false);
check('learning-profile intacto', !!localStorage.getItem('learning-profile')?.includes('phrase-x'));
check('learning-events intacto', !!localStorage.getItem('learning-events')?.includes('PHRASE_PRODUCED'));
check('continuidade intacta após reset 2', !!localStorage.getItem('deutsch-turbo:session-continuity:v1')?.includes('sessionCount'));

console.log('— orchestrator consome helpLevel');
const learning = emptyLearningProfile();
const phrases = [{
  id: 'p1', german: 'Ich arbeite.', portuguese: 'Eu trabalho.', category: 'test',
  mastery: 'speak' as const, reviewStage: 'learning' as const, nextReview: null,
  timesReviewed: 0, timesCorrect: 0, timesIncorrect: 0, isAutomatic: false, contexts: [],
}];
UiPrefsService.set({ helpLevel: 'minimal' });
const orchMin = ConversationOrchestrator.create({ profile, learning, phrases });
check('orch minimal → support 0', orchMin.getCurrentSupport() === 0);
UiPrefsService.set({ helpLevel: 'extra' });
const orchEx = ConversationOrchestrator.create({ profile, learning, phrases });
check('orch extra → support >= 4', orchEx.getCurrentSupport() >= 4);
check('toLiveFields scaffold extra', (orchEx.toLiveFields().scaffoldLevel ?? 0) >= 4);
UiPrefsService.set({ helpLevel: 'auto' });

console.log(`\nResultado: ${passed} passaram, ${failed} falharam`);
if (failed > 0) process.exit(1);
