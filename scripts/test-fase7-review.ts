/* Fase 7 — Revisão inteligente + retenção
   Rodar: npx tsx scripts/test-fase7-review.ts */
const _store = new Map<string, string>();
(globalThis as unknown as { localStorage: Storage }).localStorage = {
  getItem: (k: string) => _store.get(k) ?? null,
  setItem: (k: string, v: string) => { _store.set(k, v); },
  removeItem: (k: string) => { _store.delete(k); },
  clear: () => { _store.clear(); },
  key: () => null,
  length: 0,
} as Storage;

import type { UserProfile, Phrase } from '../src/types';
import { buildLearningProfile, emptyConfidence, updateConfidence } from '../src/services/learning/ConfidenceService';
import { persistAutomationScore, readAutomationScore } from '../src/services/learning/AutomationScoreEngine';
import { ConversationOrchestrator } from '../src/services/teacher/ConversationOrchestrator';
import { EventStore } from '../src/services/learning/EventStore';
import { MemoryService } from '../src/services/learning/MemoryService';
import {
  applyReviewResult,
  buildReviewQueue,
  evaluateReviewAttempt,
  pickReviewOpportunity,
  selectReviewType,
} from '../src/services/learning/ReviewEngine';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`  ✓ ${msg}`);
}

const profile: UserProfile = {
  id: 'u',
  name: 'Rick',
  level: 'little',
  dailyMinutes: 20,
  goal: 'work',
  profession: 'Reinigungskraft',
  frequentSituations: [],
  interests: [],
  onboardingComplete: true,
  firstLessonComplete: true,
  currentDay: 4,
  streak: 2,
  createdAt: new Date().toISOString(),
  germanPercentage: 60,
  turboMode: false,
  lastStudyDate: new Date().toISOString(),
  immersionPhase: 1,
  speechSpeed: 'normal',
};

const TARGET: Phrase = {
  id: 'survival-pause',
  german: 'Ich brauche eine Pause.',
  portuguese: 'Preciso de uma pausa.',
  category: 'work',
  mastery: 'speak',
  reviewStage: 'learning',
  nextReview: null,
  timesReviewed: 0,
  timesCorrect: 0,
  timesIncorrect: 0,
  isAutomatic: false,
  contexts: [],
};

async function probeGemini(reviewType: string, prompt: string): Promise<boolean> {
  const base = process.env.VITE_BACKEND_URL || 'http://localhost:8787';
  try {
    const res = await fetch(`${base}/api/gemini/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        profile: {
          level: 'little',
          goal: 'work',
          profession: 'Reinigungskraft',
          pedagogicalAction: 'recall',
          targetPhrase: TARGET.german,
          sessionKind: 'REVIEW_SESSION',
          openingGerman: prompt,
          actionReason: `Fase 7 ${reviewType}`,
          teacherDirective: `REVISÃO ${reviewType}. Não anuncie review. Fale: "${prompt}"`,
          skipKickoff: false,
        },
      }),
    });
    if (!res.ok) {
      console.log(`  · Gemini Live REAL: HTTP ${res.status}`);
      return false;
    }
    const data = (await res.json()) as { token?: string };
    if (!data.token) return false;
    console.log(`  ✓ Gemini Live REAL: token (${data.token.slice(0, 8)}…) tipo=${reviewType}`);
    return true;
  } catch (e) {
    console.log(`  · Gemini Live REAL: ${(e as Error).message}`);
    return false;
  }
}

async function run() {
  console.log('FASE 7 — Review inteligente\n');
  _store.clear();
  await EventStore.clear();
  await MemoryService.saveConfidenceMap({});

  let c = emptyConfidence(TARGET.id);
  c = updateConfidence(c, { type: 'heard', correct: true });
  c = updateConfidence(c, { type: 'produced', correct: true, withHelp: true });
  c = persistAutomationScore({
    ...c,
    needsHelp: true,
    state: 'answeredWithHelp',
    lastSeen: new Date(Date.now() - 2 * 86_400_000).toISOString(),
    lastProduced: new Date(Date.now() - 2 * 86_400_000).toISOString(),
  });
  await MemoryService.saveConfidenceMap({ [TARGET.id]: c });

  const t1 = selectReviewType(c);
  console.log(`  Sessão 1 aprender → tipo esperado depois: ${t1}`);
  assert(t1 === 'GUIDED_SPEAKING_REVIEW' || t1 === 'RECALL_REVIEW', `s2 tipo ${t1}`);

  const learning = buildLearningProfile(profile, [], [], null, { [TARGET.id]: c });
  const orch = ConversationOrchestrator.create({
    profile,
    learning,
    phrases: [TARGET],
    sessionId: 'fase7-review',
    reviewIntent: { phraseId: TARGET.id, reviewType: t1 },
  });
  const started = await orch.handle({ type: 'SESSION_STARTED' });
  assert(started.eventsRecorded.includes('REVIEW_STARTED'), 'REVIEW_STARTED');
  assert(!!started.geminiNudge && /REVISÃO|Was brauchst/i.test(started.geminiNudge), 'nudge de revisão contextual');
  assert(!/Review Mode/i.test(started.geminiNudge || ''), 'não mostra REVIEW MODE');

  const attempt = await orch.handle({ type: 'USER_UTTERANCE', text: 'Ich brauche eine Pause.' });
  assert(attempt.eventsRecorded.includes('REVIEW_SUCCESS'), 'REVIEW_SUCCESS');
  const after = await MemoryService.getPhraseConfidence(TARGET.id);
  assert((after.reviewCount ?? 0) >= 1, 'reviewCount');
  assert(!!after.nextReview, 'nextReview persistido');
  const next1 = new Date(after.nextReview!).getTime();

  const fail = applyReviewResult(after, 'FAILED', { reviewType: t1, sessionId: 'fail' });
  assert(new Date(fail.nextReview!).getTime() < next1 + 2 * 86_400_000, 'falha aproxima');
  const ok2 = applyReviewResult(fail, 'SUCCESS', { reviewType: 'INDEPENDENT_SPEAKING_REVIEW', sessionId: 'ok' });
  assert(new Date(ok2.nextReview!).getTime() > new Date(fail.nextReview!).getTime(), 'sucesso afasta');

  const t3 = selectReviewType({ ...ok2, needsHelp: false, state: 'answeredAlone', contextTransfer: 15, recognition: 70 });
  console.log(`  Sessão 3 independent/transfer: ${t3}`);
  assert(
    t3 === 'INDEPENDENT_SPEAKING_REVIEW' || t3 === 'TRANSFER_REVIEW' || t3 === 'RECALL_REVIEW',
    `s3 produção, não recognition (${t3})`,
  );
  const t4 = selectReviewType({
    ...ok2,
    needsHelp: false,
    state: 'usedInContext',
    contextTransfer: 20,
    recognition: 70,
  });
  console.log(`  Sessão 4 transfer?: ${t4}`);
  const t5 = selectReviewType({
    ...ok2,
    needsHelp: false,
    state: 'spontaneous',
    contextTransfer: 80,
    recognition: 80,
    timesSeen: 12,
    timesProduced: 8,
    timesCorrect: 8,
    successfulSessions: 3,
    independentSessions: 2,
    spontaneousSessions: 1,
    automationScore: 82,
  });
  console.log(`  Sessão 5 spontaneous/maintenance: ${t5}`);
  assert(
    t5 === 'SPONTANEOUS_REVIEW' || t5 === 'MAINTENANCE_REVIEW',
    `forte → spontaneous/maintenance (${t5})`,
  );

  const fourteen = new Date(Date.now() - 14 * 86_400_000).toISOString();
  const weekLater = {
    ...ok2,
    lastProduced: fourteen,
    lastSeen: fourteen,
    lastReviewed: fourteen,
    lastIndependentUse: fourteen,
    nextReview: new Date(Date.now() - 86_400_000).toISOString(),
    needsHelp: false,
    automationScore: 70,
    state: 'usedInContext' as const,
    contextTransfer: 55,
  };
  const weekQ = buildReviewQueue({ [TARGET.id]: weekLater }, [TARGET]);
  assert(weekQ.length >= 1, 'após 14 dias item volta (contextual)');

  const opp = pickReviewOpportunity({ [TARGET.id]: c }, [TARGET], { profile, phraseId: TARGET.id });
  assert(evaluateReviewAttempt('Ich brauche eine Pause.', opp!) === 'SUCCESS', 'produção = uso');

  const liveOk = await probeGemini(t1, opp!.prompt);

  console.log('\n## RESUMO FASE 7');
  console.log(`tipo s2=${t1} s5=${t5}`);
  console.log(`nextReview após sucesso: ${ok2.nextReview}`);
  console.log(`Gemini Live: ${liveOk ? 'token OK' : 'backend offline / simulação Orchestrator'}`);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
