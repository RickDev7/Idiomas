import {
  advanceMicroPractice,
  buildReturnPrompt,
  createMicroPractice,
  pickMicroDuration,
  scoreAgainstTarget,
  shouldStartMicroPractice,
} from '@/services/teacher/MicroPracticeEngine';
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

export function testMicroPracticeEngine() {
  ensureLocalStorage();
  localStorage.removeItem('deutsch-turbo:scaffolding:v1');

  const grammar = {
    pattern: 'ich_arbeiten',
    userSaid: 'Ich arbeiten morgen.',
    correction: 'Ich arbeite morgen.',
    phraseId: 'survival-arbeite',
  };

  assert(
    shouldStartMicroPractice({
      grammar,
      recentMistakes: [],
      confidence: 20,
      timesCorrect: 0,
      turnsSinceLastMicro: 5,
    }),
    'baixa confiança / nunca acertou → micro',
  );

  assert(
    !shouldStartMicroPractice({
      grammar,
      recentMistakes: [],
      confidence: 80,
      timesCorrect: 3,
      turnsSinceLastMicro: 5,
    }),
    'erro isolado com boa confiança → sem micro',
  );

  assert(
    shouldStartMicroPractice({
      grammar,
      recentMistakes: ['ich_arbeiten:Ich arbeiten heute.'],
      confidence: 70,
      timesCorrect: 2,
      turnsSinceLastMicro: 5,
    }),
    'erro recorrente → micro',
  );

  assert(pickMicroDuration({ intensiveMode: false, confidence: 80, recurring: false, level: 'little' }) === 30, '30s default');
  assert(pickMicroDuration({ intensiveMode: true, confidence: 50, recurring: false, level: 'little' }) === 60, '1min intensive');
  assert(pickMicroDuration({ intensiveMode: false, confidence: 35, recurring: true, level: 'little' }) === 120, '2min recorrente');

  assert(buildReturnPrompt('Ich arbeite morgen.', '') === 'Also, was machst du morgen?', 'return prompt morgen');

  let session = createMicroPractice({
    grammar,
    originConversationId: 'sess-1',
    lastTeacherUtterance: 'Was machst du morgen?',
    intensiveMode: false,
    recurring: false,
    level: 'little',
    currentSessionSupport: 2,
    snapshot: {
      lastTeacherUtterance: 'Was machst du morgen?',
      lastUserUtterance: 'Ich arbeiten morgen.',
      topic: 'rotina',
      goal: 'practice',
      targetItem: 'Ich arbeite morgen.',
      mode: 'FREE_CONVERSATION',
    },
  });
  assert(session.targetItem === 'Ich arbeite morgen.', 'target da conversa');
  assert(session.originConversationId === 'sess-1', 'originConversationId');
  assert(session.originSessionId === 'sess-1', 'originSessionId');
  assert(session.targetItemId === 'survival-arbeite', 'targetItemId');
  assert(session.reason.includes('grammar_error'), 'reason');
  assert(session.goal === 'independent_production', 'goal');
  assert(typeof session.startingSupport === 'number', 'startingSupport');
  assert(session.currentSupportLevel >= 2, 'currentSupportLevel ≥ sessão');
  assert(session.phase === 'explain', 'começa em explain');
  assert(session.currentStep === 'explain', 'currentStep');
  assert(session.visualState === 'ENTERING', 'visual ENTERING');
  assert(session.maxAttempts === 3, 'maxAttempts 3');
  assert(session.snapshot.topic === 'rotina', 'snapshot topic');
  assert(session.returnPrompt.includes('morgen'), 'retorna à pergunta');
  assert(session.independentPrompt.includes('morgen'), 'pergunta independente');

  let step = advanceMicroPractice(session);
  assert(step.session.phase === 'guided', 'após explain → guided');
  assert(step.session.visualState === 'PRACTICING', 'visual PRACTICING');
  assert(
    !step.feedback.includes('Ich arbeite morgen.') || step.session.currentSupportLevel >= 5,
    'não entrega frase completa cedo',
  );
  session = step.session;

  const supportBeforeFail = session.currentSupportLevel;
  step = advanceMicroPractice(session, 'Ich gehen');
  assert(!step.finished, 'guided errado continua');
  assert(step.session.attempts === 1, 'attempts++');
  assert(step.session.currentSupportLevel >= supportBeforeFail, 'erro sobe ou mantém suporte');
  session = step.session;

  step = advanceMicroPractice(session, 'Ich arbeite morgen.');
  assert(step.session.phase === 'independent', 'guided ok → independent');
  session = step.session;

  step = advanceMicroPractice(session, 'Ich arbeite morgen.');
  assert(step.finished, 'independent ok → finished');
  assert(step.session.phase === 'done', 'phase done');
  assert(step.session.result === 'SUCCESS', 'result SUCCESS');
  assert(step.session.independentOk, 'independentOk');
  assert(step.session.independentSuccess, 'independentSuccess');
  assert(step.session.visualState === 'SUCCESS', 'visual SUCCESS');

  assert(scoreAgainstTarget('ich arbeite morgen', 'Ich arbeite morgen.'), 'score flexível');
  assert(scoreAgainstTarget('Ich arbeite heute bei der Firma', 'Ich arbeite heute.'), 'variação leve ok');

  localStorage.removeItem('deutsch-turbo:scaffolding:v1');
  let fail = createMicroPractice({
    grammar,
    originConversationId: 'sess-fail',
    lastTeacherUtterance: 'Was machst du heute?',
    intensiveMode: false,
    recurring: true,
    level: 'little',
    currentSessionSupport: 2,
  });
  fail = advanceMicroPractice(fail).session;
  fail = advanceMicroPractice(fail, 'Ich gehen').session;
  fail = advanceMicroPractice(fail, 'Ich gehen').session;
  step = advanceMicroPractice(fail, 'Ich gehen');
  assert(step.finished, '3 falhas → finished');
  assert(step.session.result === 'NEEDS_REVIEW', 'NEEDS_REVIEW');
  assert(step.session.status === 'completed', 'status completed');
}
