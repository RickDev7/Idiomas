/* Teste do onboarding: níveis, persistência, diagnóstico, perfil.
   Rodar: npx tsx scripts/test-onboarding.ts */
const _store = new Map<string, string>();
(globalThis as unknown as { localStorage: Storage }).localStorage = {
  getItem: (k: string) => _store.get(k) ?? null,
  setItem: (k: string, v: string) => { _store.set(k, v); },
  removeItem: (k: string) => { _store.delete(k); },
  clear: () => { _store.clear(); },
  key: () => null,
  length: 0,
} as Storage;

import {
  GERMAN_LEVEL_OPTIONS,
  diagnosticPromptFor,
  requiresDiagnostic,
  coarseLevelFromSelfReported,
  courseLevelFromSelfReported,
  startingCourseLevel,
  optionFor,
} from '../src/services/onboarding/GermanLevelOptions';
import {
  emptyDraft, loadDraft, saveDraft, clearDraft,
} from '../src/services/onboarding/OnboardingDraft';
import { profileFromDraft } from '../src/services/onboarding/completeOnboardingFlow';
import {
  pickAdaptiveItems,
  gradeAdaptiveDiagnostic,
} from '../src/services/onboarding/LevelDiagnostic';
import type { SelfReportedLevel } from '../src/types';

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean) {
  if (cond) { passed++; console.log(`  ✓ ${name}`); }
  else { failed++; console.error(`  ✗ ${name}`); }
}

console.log('— Tela 4: oito opções');
const ids = GERMAN_LEVEL_OPTIONS.map((o) => o.id);
const expected: SelfReportedLevel[] = [
  'zero', 'beginner', 'basic', 'intermediate', 'intermediate_plus', 'advanced', 'very_advanced', 'unknown',
];
check('são 8 opções', GERMAN_LEVEL_OPTIONS.length === 8);
expected.forEach((id) => check(`opção ${id}`, ids.includes(id)));
check('Zero não exige diagnóstico', requiresDiagnostic('zero') === false);
check('Iniciante diagnóstico opcional', diagnosticPromptFor('beginner') === 'optional');
check('Básico diagnóstico opcional', diagnosticPromptFor('basic') === 'optional');
check('Intermediário sugere diagnóstico', diagnosticPromptFor('intermediate') === 'suggested');
check('Intermediário+ sugere diagnóstico', diagnosticPromptFor('intermediate_plus') === 'suggested');
check('Avançado sugere diagnóstico', diagnosticPromptFor('advanced') === 'suggested');
check('Muito avançado sugere diagnóstico', diagnosticPromptFor('very_advanced') === 'suggested');
check('Não sei exige diagnóstico', requiresDiagnostic('unknown') === true);

console.log('— Mapeamento CEFR interno');
check('Zero → L0 / pré-A1', courseLevelFromSelfReported('zero') === 'L0' && optionFor('zero')?.estimatedCEFR === 'pré-A1');
check('Iniciante → A1', courseLevelFromSelfReported('beginner') === 'A1');
check('Básico → A2', courseLevelFromSelfReported('basic') === 'A2');
check('Intermediário → A2', courseLevelFromSelfReported('intermediate') === 'A2');
check('Intermediário+ → B1', courseLevelFromSelfReported('intermediate_plus') === 'B1');
check('Avançado → B2', courseLevelFromSelfReported('advanced') === 'B2');
check('Muito avançado → C1', courseLevelFromSelfReported('very_advanced') === 'C1');
check('coarse Zero → zero', coarseLevelFromSelfReported('zero') === 'zero');
check('coarse Iniciante → little', coarseLevelFromSelfReported('beginner') === 'little');
check('coarse Básico+ → basic', coarseLevelFromSelfReported('advanced') === 'basic');

console.log('— Evidência vs autoavaliação');
check('diagnóstico A2 vence autoavaliação B2', startingCourseLevel({
  level: 'basic',
  selfReportedLevel: 'advanced',
  diagnosticLevel: 'A2',
}) === 'A2');
check('sem diagnóstico usa autoavaliação', startingCourseLevel({
  level: 'basic',
  selfReportedLevel: 'advanced',
}) === 'B2');

console.log('— Persistência do rascunho');
clearDraft();
const d = emptyDraft();
d.step = 3;
d.profession = 'mecânico';
d.goal = 'work';
d.dailyMinutes = 30;
d.selfReportedLevel = 'basic';
saveDraft(d);
const loaded = loadDraft();
check('reload mantém step', loaded.step === 3);
check('reload mantém profissão', loaded.profession === 'mecânico');
check('reload mantém objetivo', loaded.goal === 'work');
check('reload mantém tempo', loaded.dailyMinutes === 30);
check('reload mantém nível', loaded.selfReportedLevel === 'basic');
clearDraft();
check('clear apaga rascunho', loadDraft().step === 0 && loadDraft().profession === '');

console.log('— Fluxo Zero → perfil');
const zeroDraft = emptyDraft();
zeroDraft.profession = 'estudante';
zeroDraft.goal = 'daily';
zeroDraft.dailyMinutes = 20;
zeroDraft.selfReportedLevel = 'zero';
const zeroProfile = profileFromDraft(zeroDraft);
check('Zero cria level zero', zeroProfile.level === 'zero');
check('Zero não tem diagnosticLevel', !zeroProfile.diagnosticLevel);
check('profissão no perfil', zeroProfile.profession === 'estudante');
check('tempo no perfil', zeroProfile.dailyMinutes === 20);
check('objetivo no perfil', zeroProfile.goal === 'daily');
check('onboarding marcado completo no draft→profile', zeroProfile.onboardingComplete === true);

console.log('— Skip usa defaults seguros');
const skipped = profileFromDraft(emptyDraft());
check('skip → zero / 20 min / daily', skipped.level === 'zero' && skipped.dailyMinutes === 20 && skipped.goal === 'daily');

console.log('— Diagnóstico');
const unknownItems = pickAdaptiveItems('unknown');
check('unknown começa baixo (L0/A1 presente)', unknownItems.some((i) => i.level === 'L0' || i.level === 'A1'));
const advItems = pickAdaptiveItems('advanced');
check('avançado não começa em Wie heißt du', !advItems[0].german.toLowerCase().includes('heißt du'));
const results = unknownItems.slice(0, 3).map((item, i) => ({ item, correct: i === 0 }));
const graded = gradeAdaptiveDiagnostic(results, 'unknown');
check('resultado tem overall', !!graded.overall);
check('resultado tem speaking/listening', !!graded.skills.speaking && !!graded.skills.listening);
check('label não diz certificado', !/certificad/i.test(graded.estimatedLabel));

console.log(`\nResultado: ${passed} passaram, ${failed} falharam`);
if (failed > 0) process.exit(1);
