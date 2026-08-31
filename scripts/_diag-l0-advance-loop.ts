/* Anti-loop L0: 1 CORRECT → ADVANCE; 20× não fica no mesmo target.
   Rodar: npx tsx scripts/_diag-l0-advance-loop.ts */
const _store = new Map<string, string>();
(globalThis as unknown as { localStorage: Storage }).localStorage = {
  getItem: (k: string) => (k === 'L0_DEBUG' ? '1' : _store.get(k) ?? null),
  setItem: (k: string, v: string) => { _store.set(k, v); },
  removeItem: (k: string) => { _store.delete(k); },
  clear: () => { _store.clear(); },
  key: () => null,
  length: 0,
} as Storage;

import { buildLearningProfile, type PhraseConfidence } from '../src/services/learning/ConfidenceService';
import { EventStore } from '../src/services/learning/EventStore';
import { MemoryService } from '../src/services/learning/MemoryService';
import { ConversationOrchestrator } from '../src/services/teacher/ConversationOrchestrator';
import {
  pickZeroLanguageTarget,
  mergeZeroLanguagePhrases,
  isZeroLanguagePhraseAccepted,
} from '../src/services/teacher/ZeroLanguageMode';
import type { Phrase, UserProfile } from '../src/types';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`FAIL: ${msg}`);
}

function profileZero(): UserProfile {
  return {
    id: 'loop', name: 'Rick', level: 'zero', selfReportedLevel: 'zero', diagnosticLevel: 'L0',
    goal: 'daily', dailyMinutes: 20, germanPercentage: 30, turboMode: false, streak: 0, currentDay: 1,
    onboardingComplete: true, firstLessonComplete: false, profession: 'escritório',
    frequentSituations: ['work'], interests: [], lastStudyDate: null, immersionPhase: 1,
    speechSpeed: 'normal', createdAt: new Date().toISOString(),
  };
}

function fakePhrase(id: string, german: string, pt: string): Phrase {
  return {
    id, german, portuguese: pt, category: 'greetings', mastery: 'recognize',
    reviewStage: 'learning', nextReview: null, timesReviewed: 0, timesCorrect: 0,
    timesIncorrect: 0, isAutomatic: false, contexts: [],
  };
}

function acceptConf(id: string, n = 1): PhraseConfidence {
  return {
    phraseId: id, state: 'repeated', confidence: 55, recognition: 50, listening: 50,
    speaking: 50, production: 50, speed: 40, contextTransfer: 20, timesSeen: n,
    timesCorrect: n, timesIncorrect: 0, timesProduced: n,
    lastSeen: new Date().toISOString(), lastProduced: new Date().toISOString(),
    needsHelp: false, readyForTransfer: false, readyForSpontaneous: false,
  } as PhraseConfidence;
}

const PRIOR = [
  'l0-guten-morgen', 'l0-guten-abend', 'l0-gute-nacht',
  'l0-wie-gehts', 'l0-mir-gehts-gut', 'survival-gut',
  'l0-hallo', 'l0-ich-heisse', 'survival-heisse',
];

console.log('DIAG — L0 advance loop\n');

await EventStore.clear();
await MemoryService.saveConfidenceMap({});

const zero = profileZero();
const phrases = mergeZeroLanguagePhrases([
  fakePhrase('survival-arbeite', 'Ich arbeite.', 'Eu trabalho.'),
]);

// --- pick: após aceitar última, exclude → NÃO devolve a mesma ---
{
  const all: Record<string, PhraseConfidence> = {
    ...Object.fromEntries(PRIOR.map((id) => [id, acceptConf(id)])),
    'survival-arbeite': acceptConf('survival-arbeite', 1),
  };
  const stuck = pickZeroLanguageTarget(buildLearningProfile(zero, [], [], null, all), phrases);
  assert(stuck.phrase?.id === 'survival-arbeite', `sem exclude = última (${stuck.phrase?.id})`);
  const rotated = pickZeroLanguageTarget(buildLearningProfile(zero, [], [], null, all), phrases, {
    excludePhraseId: 'survival-arbeite',
  });
  assert(rotated.phrase?.id !== 'survival-arbeite', `exclude → next != Ich arbeite (got ${rotated.phrase?.id} action=${rotated.action})`);
  console.log('  ✓ pickZeroLanguageTarget exclude evita Ich arbeite imediato →', rotated.phrase?.id || rotated.action);
}

// --- TESTE: 1 CORRECT → ADVANCE (próximo ≠ mesmo) ---
{
  const prior = Object.fromEntries(PRIOR.map((id) => [id, acceptConf(id)]));
  await MemoryService.saveConfidenceMap(prior);
  const orch = ConversationOrchestrator.create({
    profile: zero,
    learning: buildLearningProfile(zero, [], [], null, prior),
    phrases,
  });
  assert(orch.getPlan().target?.id === 'survival-arbeite', 'start em Ich arbeite');
  await orch.handle({ type: 'TEACHER_UTTERANCE', text: 'Diga Ich arbeite.' });
  const d = await orch.handle({ type: 'USER_UTTERANCE', text: 'Ich arbeite.' });
  assert(!d.reason.includes('aguardando aceitação'), `aceitou: ${d.reason}`);
  assert(
    d.reason.includes('TARGET_STUCK') || d.reason.includes('próximo alvo') || d.action === 'converse' || d.action === 'recall',
    `avançou: ${d.reason} action=${d.action}`,
  );
  // Nudge NÃO pede a mesma frase
  assert(!/Nova frase-alvo ÚNICA: "Ich arbeite/i.test(d.geminiNudge || ''), 'nudge não re-mira Ich arbeite');
  assert(/PROIBIDO.*mesma frase|AVANCE|TARGET_STUCK|OUTRA frase/i.test(d.geminiNudge || ''), 'nudge anti-loop');
  const conf = (await MemoryService.loadConfidenceMap())['survival-arbeite'];
  assert(isZeroLanguagePhraseAccepted(conf), 'accepted após 1 correto');
  console.log('  ✓ 1 CORRECT → ADVANCE (sem “fale de novo”) reason=', d.reason);
}

// --- TESTE 20×: sem streak consecutivo no mesmo target ---
{
  const prior = Object.fromEntries(PRIOR.map((id) => [id, acceptConf(id)]));
  await MemoryService.saveConfidenceMap(prior);
  const orch = ConversationOrchestrator.create({
    profile: zero,
    learning: buildLearningProfile(zero, [], [], null, prior),
    phrases,
  });
  let maxConsecSame = 0;
  let consec = 0;
  let prevId: string | null = null;
  for (let i = 0; i < 20; i++) {
    const plan = orch.getPlan();
    const tid = plan.target?.id ?? `converse-${plan.action}`;
    if (tid === prevId) consec += 1;
    else consec = 1;
    prevId = tid;
    if (consec > maxConsecSame) maxConsecSame = consec;
    const say = plan.target?.german || 'Ja.';
    await orch.handle({ type: 'TEACHER_UTTERANCE', text: `Turn ${i}. ${say}` });
    if (!plan.target) continue;
    await orch.handle({ type: 'USER_UTTERANCE', text: say });
  }
  assert(maxConsecSame <= 2, `sem loop consecutivo (maxConsec=${maxConsecSame})`);
  console.log('  ✓ 20× CORRECT: max consecutive same target=', maxConsecSame);
}

// --- TESTE erro → retry → correct → advance ---
{
  const prior = Object.fromEntries(PRIOR.map((id) => [id, acceptConf(id)]));
  await MemoryService.saveConfidenceMap(prior);
  const orch = ConversationOrchestrator.create({
    profile: zero,
    learning: buildLearningProfile(zero, [], [], null, prior),
    phrases,
  });
  await orch.handle({ type: 'TEACHER_UTTERANCE', text: 'Ich arbeite.' });
  const bad = await orch.handle({ type: 'USER_UTTERANCE', text: 'Hallo.' });
  assert(bad.flow === 'intervenePedagogically', `erro → retry: ${bad.reason}`);
  assert(/ich arbeite/i.test(bad.correction || ''), 'retry current');
  await orch.handle({ type: 'TEACHER_UTTERANCE', text: 'Sag: Ich arbeite.' });
  const ok = await orch.handle({ type: 'USER_UTTERANCE', text: 'Ich arbeite.' });
  assert(!ok.reason.startsWith('target_mismatch'), `após retry advance: ${ok.reason}`);
  assert(!/Nova frase-alvo ÚNICA: "Ich arbeite/i.test(ok.geminiNudge || ''), 'não re-drill após correção');
  console.log('  ✓ erro → retry → CORRECT → advance');
}

// --- near miss ---
{
  const prior = Object.fromEntries(PRIOR.map((id) => [id, acceptConf(id)]));
  await MemoryService.saveConfidenceMap(prior);
  const orch = ConversationOrchestrator.create({
    profile: zero,
    learning: buildLearningProfile(zero, [], [], null, prior),
    phrases,
  });
  await orch.handle({ type: 'TEACHER_UTTERANCE', text: 'Ich arbeite.' });
  const near = await orch.handle({ type: 'USER_UTTERANCE', text: 'Ich arbeit.' });
  assert(near.flow === 'intervenePedagogically', `near: ${near.reason}`);
  await orch.handle({ type: 'USER_UTTERANCE', text: 'Ich arbeite.' });
  console.log('  ✓ near-miss → retry → correct');
}

console.log('\nDIAG L0 ADVANCE LOOP OK');
