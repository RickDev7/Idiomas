/* Chunks + substituição L0 — gancho → variação → sem loop.
   Rodar: npx tsx scripts/_diag-l0-chunk-substitution.ts */
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
  l0VariationsForBase,
  l0SubstitutionAdvanceNudge,
  l0ConverseExpandNudge,
  teachFromErrorNudge,
  isL0GreetingPhraseId,
  ZERO_LANGUAGE_BLOCKS,
  L0_BASE_TO_VARIATIONS,
} from '../src/services/teacher/ZeroLanguageMode';
import type { UserProfile } from '../src/types';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`FAIL: ${msg}`);
}

function profileZero(): UserProfile {
  return {
    id: 'chunk', name: 'Rick', level: 'zero', selfReportedLevel: 'zero', diagnosticLevel: 'L0',
    goal: 'daily', dailyMinutes: 20, germanPercentage: 30, turboMode: false, streak: 0, currentDay: 1,
    onboardingComplete: true, firstLessonComplete: false, profession: 'escritório',
    frequentSituations: ['work'], interests: [], lastStudyDate: null, immersionPhase: 1,
    speechSpeed: 'normal', createdAt: new Date().toISOString(),
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

const CORE = ZERO_LANGUAGE_BLOCKS.flatMap((b) => b.phraseIds);
const BEFORE_ARBEITE = CORE.slice(0, CORE.indexOf('survival-arbeite'));

console.log('DIAG — L0 chunk substitution\n');

// T1: grafo base → variações existe
{
  const vars = l0VariationsForBase('survival-arbeite');
  assert(vars.length >= 3, 'T1 arbeite tem variações');
  assert(vars.includes('l0-bridge-ich-arbeite-in'), 'T1 inclui Ich arbeite in...');
  assert(Object.keys(L0_BASE_TO_VARIATIONS).includes('l0-hook-ich-muss'), 'T1 gancho Ich muss');
  console.log('  ✓ T1 grafo gancho→variação');
}

// T2: CORRECT em Ich arbeite → próxima = variação, não Ja / greetings
{
  const zero = profileZero();
  const map = Object.fromEntries(BEFORE_ARBEITE.map((id) => [id, acceptConf(id)]));
  map['survival-arbeite'] = acceptConf('survival-arbeite');
  const learning = buildLearningProfile(zero, [], [], null, map);
  const next = pickZeroLanguageTarget(learning, mergeZeroLanguagePhrases([]), {
    excludePhraseId: 'survival-arbeite',
  });
  assert(next.phrase?.id === 'l0-bridge-ich-arbeite-in', `T2 next=${next.phrase?.id}`);
  assert(next.phrase?.id !== 'l0-ja', 'T2 ≠ Ja');
  assert(!isL0GreetingPhraseId(next.phrase!.id), 'T2 ≠ greeting');
  console.log('  ✓ T2 Ich arbeite CORRECT →', next.phrase?.id);
}

// T3: cadeia de substituições
{
  const zero = profileZero();
  const map = Object.fromEntries(BEFORE_ARBEITE.map((id) => [id, acceptConf(id)]));
  map['survival-arbeite'] = acceptConf('survival-arbeite');
  map['l0-bridge-ich-arbeite-in'] = acceptConf('l0-bridge-ich-arbeite-in');
  const learning = buildLearningProfile(zero, [], [], null, map);
  const next = pickZeroLanguageTarget(learning, mergeZeroLanguagePhrases([]), {
    excludePhraseId: 'l0-bridge-ich-arbeite-in',
  });
  assert(next.phrase?.id === 'l0-bridge-ich-arbeite-heute', `T3 cadeia=${next.phrase?.id}`);
  console.log('  ✓ T3 substituição em cadeia →', next.phrase?.id);
}

// T4: nudge substituição
{
  const n = l0SubstitutionAdvanceNudge({
    acceptedGerman: 'Ich arbeite.',
    nextGerman: 'Ich arbeite in...',
    nextPt: 'Eu trabalho em...',
  });
  assert(/SUBSTITUIÇÃO|EXPANDIR/i.test(n), 'T4 substituição');
  assert(/Ich arbeite in/i.test(n), 'T4 next');
  assert(!/fale de novo para fixar/i.test(n) || /PROIBIDO/i.test(n), 'T4 anti-repeat');
  console.log('  ✓ T4 nudge substituição');
}

// T5: converse pede montagem situacional
{
  const n = l0ConverseExpandNudge({ lastGerman: 'Ich arbeite.', nextBridgeGerman: 'Ich arbeite morgens.' });
  assert(/MONTAR|Situação|parceiro ativo/i.test(n), 'T5 montar');
  assert(/palavra|estrutura|reduza ajuda/i.test(n), 'T5 tutor ativo');
  console.log('  ✓ T5 converse situacional');
}

// T6: tutor ativo no erro (modelo parcial na 2ª tentativa)
{
  const n1 = teachFromErrorNudge({
    userSaid: 'Ich arbeit',
    correction: 'Ich arbeite in Cuxhaven.',
    hardPart: 'Cuxhaven',
    attempt: 1,
  });
  const n2 = teachFromErrorNudge({
    userSaid: 'Ich arbeit',
    correction: 'Ich arbeite in Cuxhaven.',
    attempt: 2,
  });
  assert(/palavra|MONTAR/i.test(n1), 'T6a palavra');
  assert(/parcial|PARCIAL/i.test(n2), 'T6b parcial');
  console.log('  ✓ T6 tutor ativo erro');
}

// T7: orch — aceitar arbeite avança para variação
{
  await EventStore.clear();
  const prior = Object.fromEntries(BEFORE_ARBEITE.map((id) => [id, acceptConf(id)]));
  await MemoryService.saveConfidenceMap(prior);
  const zero = profileZero();
  const orch = ConversationOrchestrator.create({
    profile: zero,
    learning: buildLearningProfile(zero, [], [], null, prior),
    phrases: mergeZeroLanguagePhrases([]),
  });
  assert(orch.getPlan().target?.id === 'survival-arbeite', `T7 start (${orch.getPlan().target?.id})`);
  await orch.handle({ type: 'TEACHER_UTTERANCE', text: 'Ich arbeite.' });
  const d = await orch.handle({ type: 'USER_UTTERANCE', text: 'Ich arbeite.' });
  assert(orch.getPlan().target?.id === 'l0-bridge-ich-arbeite-in', `T7 após CORRECT (${orch.getPlan().target?.id})`);
  assert(/substituição|variação|SUBSTITUIÇÃO|EXPANDIR|próximo/i.test(d.reason + (d.geminiNudge || '')), `T7 nudge (${d.reason})`);
  console.log('  ✓ T7 orch CORRECT → variação');
}

// T8: greetings aceitos não voltam
{
  const greets = ZERO_LANGUAGE_BLOCKS.find((b) => b.id === 'greetings')!.phraseIds;
  const map = Object.fromEntries([
    ...greets.map((id) => [id, acceptConf(id)]),
    ...CORE.filter((id) => !greets.includes(id)).map((id) => [id, acceptConf(id)]),
  ]);
  const learning = buildLearningProfile(profileZero(), [], [], null, map);
  const picked = pickZeroLanguageTarget(learning, mergeZeroLanguagePhrases([]), {
    excludePhraseId: 'l0-noch-einmal',
  });
  assert(!picked.phrase || !isL0GreetingPhraseId(picked.phrase.id), `T8 sem greeting (${picked.phrase?.id})`);
  console.log('  ✓ T8 sem recycle greetings →', picked.phrase?.id || picked.action);
}

// T9: A2 sem L0 substitution kickoff
{
  const a2: UserProfile = { ...profileZero(), id: 'a2', level: 'A2', selfReportedLevel: 'A2', diagnosticLevel: 'A2' };
  const { buildConversationPlan } = await import('../src/services/teacher/ConversationOrchestrator');
  const plan = buildConversationPlan(a2, buildLearningProfile(a2, [], [], null, {}), mergeZeroLanguagePhrases([]));
  assert(!/SUBSTITUIÇÃO \(tutor ativo\)/i.test(plan.actionKickoff), 'T9 A2 clean');
  console.log('  ✓ T9 A1+ regressão zero');
}

console.log('\nDIAG L0 CHUNK SUBSTITUTION OK');
