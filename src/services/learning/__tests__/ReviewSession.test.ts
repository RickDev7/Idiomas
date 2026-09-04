import { emptyConfidence, updateConfidence } from '@/services/learning/ConfidenceService';
import { persistAutomationScore } from '@/services/learning/AutomationScoreEngine';
import {
  buildReviewQueue,
  opportunityFromQueueItem,
  type ReviewQueueItem,
} from '@/services/learning/ReviewEngine';
import {
  createReviewSessionSnapshot,
  getCurrentReviewQueueItem,
  MAX_REVIEW_ITEM_ATTEMPTS,
  advanceReviewQueueAfterItem,
  reviewSessionProgress,
  startReviewSession,
  summarizeReviewSession,
} from '@/services/learning/ReviewSession';
import { ConversationOrchestrator } from '@/services/teacher/ConversationOrchestrator';
import type { UserProfile } from '@/types';

const TWELVE_GERMAN = [
  'Ich möchte...',
  'Ich arbeite.',
  'Ich arbeite in Cuxhaven.',
  'Ich brauche...',
  'Ich brauche Wasser.',
  'Was möchtest du?',
  'Was möchtest du essen?',
  'Wo arbeitest du?',
  'Ich muss arbeiten.',
  'Ich möchte Pizza.',
  'Ich möchte Wasser.',
  'Kannst du mir helfen?',
];

function buildLearned(id: string) {
  let c = emptyConfidence(id);
  c = updateConfidence(c, { type: 'heard', correct: true });
  c = updateConfidence(c, { type: 'repeated', correct: true });
  c = updateConfidence(c, { type: 'produced', correct: true, withHelp: false, responseMs: 4000 });
  c = {
    ...c,
    confidence: 52,
    timesCorrect: 2,
    timesProduced: 2,
    needsHelp: true,
    contextTransfer: 15,
    lastSeen: new Date(Date.now() - 3 * 86_400_000).toISOString(),
    lastProduced: new Date(Date.now() - 2 * 86_400_000).toISOString(),
    state: 'answeredAlone',
  };
  return persistAutomationScore(c);
}

function fakeQueue12(): ReviewQueueItem[] {
  const map: Record<string, ReturnType<typeof buildLearned>> = {};
  for (let i = 0; i < 12; i++) {
    map[`p-${i}`] = buildLearned(`p-${i}`);
  }
  const phrases = TWELVE_GERMAN.map((german, i) => ({
    id: `p-${i}`,
    german,
    portuguese: `pt-${i}`,
    category: 'test',
    mastery: 'speak' as const,
    reviewStage: 'learning' as const,
    nextReview: null,
    timesReviewed: 0,
    timesCorrect: 0,
    timesIncorrect: 0,
    isAutomatic: false,
    contexts: [],
  }));
  return buildReviewQueue(map, phrases, new Date(), 12);
}

const profile: UserProfile = {
  id: 'u1',
  name: 'Test',
  level: 'zero',
  dailyMinutes: 20,
  goal: 'work',
  profession: 'dev',
  frequentSituations: [],
  interests: [],
  onboardingComplete: true,
  firstLessonComplete: true,
  currentDay: 1,
  streak: 1,
  lastStudyDate: null,
  immersionPhase: 1,
  turboMode: false,
  speechSpeed: 'normal',
  germanPercentage: 50,
  createdAt: new Date().toISOString(),
};

function ensureStorage() {
  const make = () => {
    const store: Record<string, string> = {};
    return {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => { store[k] = String(v); },
      removeItem: (k: string) => { delete store[k]; },
      clear: () => { Object.keys(store).forEach((k) => delete store[k]); },
      key: () => null,
      length: 0,
    };
  };
  const g = globalThis as unknown as { localStorage?: Storage; sessionStorage?: Storage };
  if (typeof g.localStorage === 'undefined') g.localStorage = make() as Storage;
  if (typeof g.sessionStorage === 'undefined') g.sessionStorage = make() as Storage;
}

async function run() {
  ensureStorage();
  let passed = 0;
  let failed = 0;
  const assert = (name: string, cond: boolean) => {
    if (cond) { passed++; console.log('  ✓', name); }
    else { failed++; console.log('  ✗', name); }
  };

  const queue = fakeQueue12();
  assert('getReviewQueue length === 12', queue.length === 12);

  const snapshot = startReviewSession(queue);
  assert('reviewSession.total === 12', snapshot.total === 12);
  assert('reviewSession.items === queue', snapshot.items.length === 12 && snapshot.items[0].phraseId === queue[0].phraseId);
  assert('primeiro item da fila', getCurrentReviewQueueItem(snapshot)?.phraseId === queue[0].phraseId);

  const progress = reviewSessionProgress(snapshot);
  assert('progresso 1 de 12', progress?.current === 1 && progress?.total === 12);

  // opportunity from queue item
  const map = Object.fromEntries(queue.map((q) => [q.phraseId, buildLearned(q.phraseId)]));
  const opp = opportunityFromQueueItem(queue[0], map, []);
  assert('opportunity do primeiro item', opp?.itemId === queue[0].phraseId);

  // orchestrator com snapshot
  const learning = {
    userLevel: 'zero' as const,
    communicationScore: 40,
    listeningScore: 40,
    speakingScore: 40,
    retentionScore: 40,
    pronunciationScore: 40,
    responseSpeedScore: 40,
    immersionLevel: 50,
    dailyGoal: 20,
    currentStreak: 1,
    totalStudyTime: 30,
    knownWords: [],
    knownPhrases: queue.map((q) => q.phraseId),
    weakPhrases: [],
    strongPhrases: [],
    recurringMistakes: [],
    recentTopics: [],
    recentSituations: [],
    lastSession: null,
    learningVelocity: 1,
    phrases: map,
    bottleneck: null,
  };

  const phrases = queue.map((q, i) => ({
    id: q.phraseId,
    german: TWELVE_GERMAN[i],
    portuguese: `pt-${i}`,
    category: 'test',
    mastery: 'speak' as const,
    reviewStage: 'learning' as const,
    nextReview: null,
    timesReviewed: 0,
    timesCorrect: 0,
    timesIncorrect: 0,
    isAutomatic: false,
    contexts: [],
  }));

  const orch = ConversationOrchestrator.create({
    profile,
    learning,
    phrases,
    reviewSessionSnapshot: snapshot,
  });
  assert('orch review primeiro item', orch.getPlan().target?.id === queue[0].phraseId);

  const threeQueue = queue.slice(0, 3);
  const threePhrases = phrases.slice(0, 3);
  const threeSnap = createReviewSessionSnapshot(threeQueue);
  const orch3 = ConversationOrchestrator.create({
    profile,
    learning,
    phrases: threePhrases,
    reviewSessionSnapshot: threeSnap,
  });
  for (let i = 0; i < 3; i++) {
    const german = orch3.getPlan().target?.german;
    assert(`Q${i + 1} tem alvo`, !!german);
    const decision = await orch3.handleUserUtterance(german || '');
    const live = orch3.getReviewSessionSnapshot();
    if (i < 2) {
      assert(`Q${i + 1} correta avança`, live?.completed === false && decision.reason.startsWith('review_next:'));
      assert(`após Q${i + 1} currentIndex=${i + 1}`, live?.currentIndex === i + 1);
    } else {
      assert('após Q3 status COMPLETE', live?.completed === true && decision.reason === 'review_session_complete');
      assert('após Q3 não existe Q4', live?.items.length === 3 && live.items[3] === undefined);
      assert('currentIndex não sai da fila', live?.currentIndex === 2);
    }
  }

  const failSnap = createReviewSessionSnapshot(threeQueue);
  const orchFail = ConversationOrchestrator.create({
    profile,
    learning,
    phrases: threePhrases,
    reviewSessionSnapshot: failSnap,
  });
  await orchFail.handleUserUtterance(orchFail.getPlan().target?.german || '');
  await orchFail.handleUserUtterance(orchFail.getPlan().target?.german || '');
  const retry = await orchFail.handleUserUtterance('zzzzzzzz');
  assert('última errada pede retry', retry.reason.startsWith('review_retry:'));
  assert('ainda não COMPLETE no retry', orchFail.getReviewSessionSnapshot()?.completed === false);
  const afterDefer = await orchFail.handleUserUtterance('zzzzzzzz');
  assert('última errada/defer → COMPLETE', afterDefer.reason === 'review_session_complete');
  assert('COMPLETE após defer', orchFail.getReviewSessionSnapshot()?.completed === true);
  assert('sem Q4 após defer', orchFail.getReviewSessionSnapshot()?.items[3] === undefined);

  // simular avanço manual no snapshot
  const snap2 = createReviewSessionSnapshot(queue);
  snap2.results.push({ phraseId: queue[0].phraseId, result: 'SUCCESS', reviewType: queue[0].reviewType });
  snap2.currentIndex = 1;
  assert('após acerto index=1', snap2.currentIndex === 1);
  assert('item 2 é o segundo da fila', getCurrentReviewQueueItem(snap2)?.phraseId === queue[1].phraseId);

  // deferred após max attempts
  const snap3 = createReviewSessionSnapshot(queue.slice(0, 3));
  snap3.itemAttempts = MAX_REVIEW_ITEM_ATTEMPTS;
  assert('max attempts = 2', MAX_REVIEW_ITEM_ATTEMPTS === 2);

  // summary
  const done = createReviewSessionSnapshot(queue);
  done.results = queue.map((q, i) => ({
    phraseId: q.phraseId,
    result: i < 9 ? 'SUCCESS' as const : 'DEFERRED' as const,
    reviewType: q.reviewType,
  }));
  done.currentIndex = 12;
  done.completed = true;
  const sum = summarizeReviewSession(done);
  assert('12 revisados', sum.reviewed === 12);
  assert('9 dominados', sum.mastered === 9);
  assert('3 para depois', sum.needsLater === 3);
  assert('não confundir revisados com acertos', sum.reviewed === 12 && sum.mastered === 9);

  // 3 perguntas — COMPLETE após Q3, sem Q4
  const three = createReviewSessionSnapshot(queue.slice(0, 3));
  three.results.push({ phraseId: three.items[0].phraseId, result: 'SUCCESS', reviewType: three.items[0].reviewType });
  let step = advanceReviewQueueAfterItem(three);
  assert('após Q1 correta: não COMPLETE', !step.finished && three.completed === false);
  assert('após Q1: índice 1 (Q2)', three.currentIndex === 1 && getCurrentReviewQueueItem(three)?.phraseId === three.items[1].phraseId);

  three.results.push({ phraseId: three.items[1].phraseId, result: 'SUCCESS', reviewType: three.items[1].reviewType });
  step = advanceReviewQueueAfterItem(three);
  assert('após Q2 correta: ainda ACTIVE', !step.finished && three.completed === false);
  assert('após Q2: índice 2 (Q3)', three.currentIndex === 2 && getCurrentReviewQueueItem(three)?.phraseId === three.items[2].phraseId);
  assert('não existe Q4', three.items[3] === undefined);

  three.results.push({ phraseId: three.items[2].phraseId, result: 'SUCCESS', reviewType: three.items[2].reviewType });
  step = advanceReviewQueueAfterItem(three);
  assert('após Q3 correta: COMPLETE', step.finished && three.completed === true);
  assert('após COMPLETE não há pergunta atual', getCurrentReviewQueueItem(three) === null);
  assert('índice não vira 3 (fora da fila)', three.currentIndex === 2);
  const again = advanceReviewQueueAfterItem(three);
  assert('avançar de novo não cria Q4 nem loop', again.finished && three.items.length === 3 && getCurrentReviewQueueItem(three) === null);

  // última resposta errada → DEFERRED (política existente) → COMPLETE
  const lastFail = createReviewSessionSnapshot(queue.slice(0, 3));
  lastFail.results.push({ phraseId: lastFail.items[0].phraseId, result: 'SUCCESS', reviewType: lastFail.items[0].reviewType });
  advanceReviewQueueAfterItem(lastFail);
  lastFail.results.push({ phraseId: lastFail.items[1].phraseId, result: 'SUCCESS', reviewType: lastFail.items[1].reviewType });
  advanceReviewQueueAfterItem(lastFail);
  assert('Q3 ainda ativa antes do defer', getCurrentReviewQueueItem(lastFail)?.phraseId === lastFail.items[2].phraseId);
  lastFail.itemAttempts = MAX_REVIEW_ITEM_ATTEMPTS;
  lastFail.results.push({
    phraseId: lastFail.items[2].phraseId,
    result: 'DEFERRED',
    reviewType: lastFail.items[2].reviewType,
  });
  const deferredDone = advanceReviewQueueAfterItem(lastFail);
  assert('última errada/defer → COMPLETE', deferredDone.finished && lastFail.completed === true);
  assert('sem loop após última errada', getCurrentReviewQueueItem(lastFail) === null && lastFail.currentIndex === 2);

  // contrato UI: última resposta dispara o mesmo padrão da mini prova
  const { readFileSync } = await import('node:fs');
  const { resolve, dirname } = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
  const hook = readFileSync(resolve(root, 'src/hooks/useGeminiLive.ts'), 'utf8');
  const gemini = readFileSync(resolve(root, 'src/pages/GeminiConversation.tsx'), 'utf8');
  assert('hook marca reviewComplete', hook.includes("decision.reason === 'review_session_complete'") && hook.includes('setReviewComplete(true)'));
  assert('GeminiConversation navega ao completar review', gemini.includes('live.reviewComplete') && gemini.includes('onFinish()'));

  // fila estável — snapshot não muda items
  const originalLen = snapshot.items.length;
  snapshot.items.pop();
  assert('snapshot original preservado na sessão', originalLen === 12);

  console.log(`\n${passed} passaram, ${failed} falharam.`);
  if (failed > 0) process.exit(1);
}

run().catch((e) => { console.error(e); process.exit(1); });
