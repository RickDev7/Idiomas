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
} from '@/services/learning/ScaffoldingEngine';
import { assert } from './assert';

function ensureLocalStorage() {
  if (typeof globalThis.localStorage !== 'undefined') return;
  const store: Record<string, string> = {};
  (globalThis as unknown as { localStorage: Storage }).localStorage = {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = String(v); },
    removeItem: (k: string) => { delete store[k]; },
    clear: () => { Object.keys(store).forEach((k) => delete store[k]); },
    key: () => null,
    length: 0,
  };
}

export function testScaffoldingEngine() {
  ensureLocalStorage();
  localStorage.removeItem('deutsch-turbo:scaffolding:v1');

  // --- SupportLevel 0–5 ---
  const target = 'Ich arbeite heute.';
  assert(buildScaffoldHint(target, 0).displayText === '', 'nível 0 = sem ajuda');
  assert(
    buildScaffoldHint(target, 1).displayText.includes('Arbeit') ||
      buildScaffoldHint(target, 1).displayText.includes('heute'),
    'nível 1 = contexto',
  );
  assert(buildScaffoldHint(target, 2).displayText.includes('Es beginnt mit Ich'), 'nível 2 = pista');
  assert(buildScaffoldHint(target, 3).displayText === 'Ich...', 'nível 3 = primeira palavra');
  assert(buildScaffoldHint(target, 4).displayText === 'Ich ar...', 'nível 4 = parcial');
  assert(buildScaffoldHint(target, 5).full === target, 'nível 5 = completa');

  // --- increase / decrease ---
  assert(increaseSupport(0) === 1, 'increaseSupport 0→1');
  assert(increaseSupport(5) === 5, 'increaseSupport capped');
  assert(decreaseSupport(3) === 2, 'decreaseSupport 3→2');
  assert(decreaseSupport(0) === 0, 'decreaseSupport floor');

  // --- shouldReduce / shouldIncrease ---
  assert(shouldIncreaseSupport({ correct: false }) === true, 'erro → shouldIncrease');
  assert(shouldIncreaseSupport({ correct: true }) === false, 'acerto → não increase');
  assert(shouldReduceSupport({ correct: true, usedHelp: false }) === true, 'acerto sem ajuda → reduce');
  assert(
    shouldReduceSupport({ correct: true, usedHelp: true, consecutiveSuccess: 2 }) === true,
    '2 acertos → reduce',
  );
  assert(shouldReduceSupport({ correct: false, usedHelp: false }) === false, 'erro → não reduce');

  // --- nextSupportAfterAttempt ---
  assert(nextSupportAfterAttempt({ previous: 0, correct: true, usedHelp: false }) === 0, 'domínio → 0');
  assert(nextSupportAfterAttempt({ previous: 1, correct: false, usedHelp: false }) === 2, 'erro → sobe');
  assert(nextSupportAfterAttempt({ previous: 3, correct: true, usedHelp: true }) === 2, 'acerto com ajuda → fade');

  // --- Teste 1: usuário domina sem ajuda ---
  localStorage.removeItem('deutsch-turbo:scaffolding:v1');
  const r0 = recordHelpAttempt('mastery', 0, true);
  assert(r0.history.lastSupportLevel === 0, 'supportLevel = 0');
  assert(r0.history.bestIndependentLevel === 0, 'bestIndependent = 0');
  assert(r0.history.successfulWithoutHelp >= 1, 'successfulWithoutHelp');

  // --- Fade entre sessões: 3 → 2 → 1 → 0 ---
  localStorage.removeItem('deutsch-turbo:scaffolding:v1');
  const id = 'phrase-fade-sessions';
  assert(startingSupportForPhrase(id, { isNew: true }) === 3, 'sessão 1 começa em 3');

  recordHelpAttempt(id, 3, true); // sessão 1
  assert(getPreviousHelpLevel(id) === 2, 'após sessão 1 → previous 2');

  recordHelpAttempt(id, 2, true); // sessão 2
  const s3start = getPreviousHelpLevel(id);
  assert(s3start <= 1, 'após sessão 2 → ≤1');

  recordHelpAttempt(id, 1, true); // sessão 3
  recordHelpAttempt(id, getPreviousHelpLevel(id), true); // reforço
  assert(getPreviousHelpLevel(id) === 0, 'sessão 4 → 0');

  // --- Erro na sessão 4 sobe suporte ---
  const afterErr = recordHelpAttempt(id, 0, false);
  assert(afterErr.nextInSession >= 1, 'erro em 0 → sobe');
  assert(getHelpHistory(id)!.lastSupportLevel === 0, 'lastSupportLevel registra o nível usado');

  // --- persist / restore ---
  const snap: PhraseHelpHistory = {
    phraseId: 'persist-demo',
    previousHelpLevel: 2,
    lastHelpLevel: 3,
    lastSupportLevel: 3,
    bestIndependentLevel: 1,
    averageSupportLevel: 2.5,
    successfulWithoutHelp: 1,
    consecutiveSuccess: 1,
    consecutiveFail: 0,
    helpHistory: [
      {
        supportLevel: 3,
        correct: true,
        helpRequested: false,
        timestamp: new Date().toISOString(),
        sessionId: 's1',
      },
    ],
    updatedAt: new Date().toISOString(),
  };
  persistSupportState(snap);
  const restored = restoreSupportState('persist-demo');
  assert(!!restored, 'restoreSupportState');
  assert(restored!.previousHelpLevel === 2, 'previousHelpLevel persistido');
  assert(restored!.lastSupportLevel === 3, 'lastSupportLevel persistido');
  assert(restored!.helpHistory.length === 1, 'helpHistory persistido');
  assert(restored!.bestIndependentLevel === 1, 'bestIndependentLevel persistido');

  // --- Não exigir string exata no hint ---
  assert(buildScaffoldHint('Ich arbeite morgen.', 2).displayText.includes('Ich'), 'pista sem flashcard rígido');
}
