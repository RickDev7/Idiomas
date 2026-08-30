/* Fase 3 — Scaffolding + Fade Out
   Rodar: npx tsx scripts/test-scaffolding-fade.ts */
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
  buildScaffoldHint,
  decreaseSupport,
  getHelpHistory,
  getPreviousHelpLevel,
  increaseSupport,
  nextSupportAfterAttempt,
  persistSupportState,
  recordHelpAttempt,
  restoreSupportState,
  shouldIncreaseSupport,
  shouldReduceSupport,
  startingSupportForPhrase,
  type PhraseHelpHistory,
} from '../src/services/learning/ScaffoldingEngine';
import {
  advanceMicroPractice,
  createMicroPractice,
  scoreAgainstTarget,
} from '../src/services/teacher/MicroPracticeEngine';
import { decideSupportForAttempt } from '../src/services/teacher/TeacherEngine';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`  ✓ ${msg}`);
}

console.log('FASE 3 — SUPPORT LEVEL\n');
_store.clear();
const target = 'Ich arbeite heute.';
assert(buildScaffoldHint(target, 0).displayText === '', 'SUPPORT 0 sem ajuda');
assert(buildScaffoldHint(target, 1).displayText.includes('Arbeit'), 'SUPPORT 1 contexto');
assert(buildScaffoldHint(target, 2).displayText.includes('Es beginnt mit Ich'), 'SUPPORT 2 pista');
assert(buildScaffoldHint(target, 3).displayText === 'Ich...', 'SUPPORT 3 primeira palavra');
assert(buildScaffoldHint(target, 4).displayText === 'Ich ar...', 'SUPPORT 4 parcial');
assert(buildScaffoldHint(target, 5).full === target, 'SUPPORT 5 completa');

console.log('\nFASE 3 — increase / decrease / should*\n');
assert(increaseSupport(2) === 3, 'increaseSupport');
assert(decreaseSupport(2) === 1, 'decreaseSupport');
assert(shouldIncreaseSupport({ correct: false }), 'shouldIncreaseSupport');
assert(shouldReduceSupport({ correct: true, usedHelp: false }), 'shouldReduceSupport');
assert(nextSupportAfterAttempt({ previous: 1, correct: false, usedHelp: false }) === 2, 'erro sobe');
assert(nextSupportAfterAttempt({ previous: 3, correct: true, usedHelp: true }) === 2, 'acerto fade');

console.log('\nFASE 3 — FADE OUT entre sessões 3→2→1→0\n');
_store.clear();
const id = 'fade-phrase';
assert(startingSupportForPhrase(id, { isNew: true }) === 3, 'Sessão 1 = 3');
recordHelpAttempt(id, 3, true);
assert(getPreviousHelpLevel(id) === 2, 'Sessão 2 = 2');
recordHelpAttempt(id, 2, true);
assert(getPreviousHelpLevel(id) === 1, 'Sessão 3 = 1');
recordHelpAttempt(id, 1, true);
assert(getPreviousHelpLevel(id) === 0, 'Sessão 4 = 0');

console.log('\nFASE 3 — erro sobe de novo\n');
const up = recordHelpAttempt(id, 0, false);
assert(up.nextInSession >= 1, 'erro em 0 → sobe');

console.log('\nFASE 3 — persistência\n');
_store.clear();
const snap: PhraseHelpHistory = {
  phraseId: 'persist-x',
  previousHelpLevel: 2,
  lastHelpLevel: 3,
  lastSupportLevel: 3,
  bestIndependentLevel: 0,
  averageSupportLevel: 2.5,
  successfulWithoutHelp: 2,
  consecutiveSuccess: 2,
  consecutiveFail: 0,
  helpHistory: [{
    supportLevel: 3,
    correct: true,
    helpRequested: false,
    timestamp: new Date().toISOString(),
    sessionId: 's1',
    responseTimeMs: 1200,
  }],
  updatedAt: new Date().toISOString(),
};
persistSupportState(snap);
const restored = restoreSupportState('persist-x');
assert(!!restored && restored.lastSupportLevel === 3, 'restore lastSupportLevel');
assert(!!restored && restored.helpHistory.length === 1, 'restore helpHistory');
assert(!!restored && restored.bestIndependentLevel === 0, 'restore bestIndependentLevel');

console.log('\nFASE 3 — TeacherEngine decideSupport\n');
const d = decideSupportForAttempt({
  lastSupportLevel: 2,
  successHistory: [true, true],
  independence: 2,
  recentErrors: 0,
  correct: true,
  usedHelp: false,
});
assert(d.nextLevel <= 2, 'TeacherEngine reduce/maintain após acerto');

console.log('\nFASE 3 — MicroPractice com ajuda mínima\n');
_store.clear();
let micro = createMicroPractice({
  grammar: {
    pattern: 'ich_arbeiten',
    userSaid: 'Ich arbeiten heute.',
    correction: 'Ich arbeite heute.',
    phraseId: 'survival-arbeite-heute',
  },
  originConversationId: 'live-1',
  lastTeacherUtterance: 'Was machst du heute?',
  intensiveMode: false,
  recurring: true,
  level: 'little',
  currentSessionSupport: 1,
});
assert(micro.currentSupportLevel >= 1, 'micro começa com suporte mínimo');
assert(micro.scaffoldDisplay.length > 0, 'scaffoldDisplay preenchido');
let step = advanceMicroPractice(micro);
assert(step.session.phase === 'guided', 'explain → guided');
assert(!step.feedback.includes('Ich arbeite heute.') || step.session.currentSupportLevel >= 5, 'sem frase completa precoce');
micro = step.session;
step = advanceMicroPractice(micro, 'Ich arbeiten');
assert(step.session.currentSupportLevel > 1, 'falha sobe suporte');
micro = step.session;
step = advanceMicroPractice(micro, 'Ich arbeite heute.');
assert(step.session.phase === 'independent', 'acerto → independent');
micro = step.session;
step = advanceMicroPractice(micro, 'Ich arbeite heute.');
assert(step.finished && step.session.result === 'SUCCESS', 'sucesso final');
assert(scoreAgainstTarget('Ich arbeite heute am Büro', 'Ich arbeite heute.'), 'não exige string exata');

const hist = getHelpHistory('survival-arbeite-heute');
assert(!!hist && hist.helpHistory.length >= 1, 'helpHistory no LearningItem');

console.log('\n✅ FASE 3 — todos os testes automatizados passaram.');
