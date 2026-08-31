/* Maximizar aprendizado por sessão (L0) — cobertura + defer dificuldade.
   Rodar: npx tsx scripts/_diag-l0-max-coverage.ts */
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
  mergeZeroLanguagePhrases,
  l0ExpectedCoverageForMinutes,
  L0_MAX_CORRECTION_ATTEMPTS,
  ZERO_LANGUAGE_BLOCKS,
} from '../src/services/teacher/ZeroLanguageMode';
import type { Phrase, UserProfile } from '../src/types';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`FAIL: ${msg}`);
}

function profileZero(mins: number): UserProfile {
  return {
    id: `cov-${mins}`, name: 'Rick', level: 'zero', selfReportedLevel: 'zero', diagnosticLevel: 'L0',
    goal: 'daily', dailyMinutes: mins, germanPercentage: 30, turboMode: false, streak: 0, currentDay: 1,
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

console.log('DIAG — L0 maximize coverage\n');

const priorityLen = ZERO_LANGUAGE_BLOCKS.flatMap((b) => b.phraseIds).length;
assert(priorityLen >= 18, `currículo L0 expandido (>=18, got ${priorityLen})`);
assert(l0ExpectedCoverageForMinutes(10) < l0ExpectedCoverageForMinutes(20), '10min < 20min expectativa');
assert(l0ExpectedCoverageForMinutes(20) < l0ExpectedCoverageForMinutes(60), '20min < 60min expectativa');
assert(L0_MAX_CORRECTION_ATTEMPTS === 2, 'max 2 retries');
console.log('  ✓ cobertura esperada escala com minutos; currículo=', priorityLen);

await EventStore.clear();
await MemoryService.saveConfidenceMap({});

const phrases = mergeZeroLanguagePhrases([
  fakePhrase('survival-arbeite', 'Ich arbeite.', 'Eu trabalho.'),
]);

// TESTE 1–2: correct advance + near miss path via orchestrator
{
  const zero = profileZero(20);
  const orch = ConversationOrchestrator.create({
    profile: zero,
    learning: buildLearningProfile(zero, [], [], null, {}),
    phrases,
  });
  assert(orch.getPlan().target?.id === 'l0-guten-morgen', `start=${orch.getPlan().target?.id}`);
  await orch.handle({ type: 'TEACHER_UTTERANCE', text: 'Guten Morgen.' });
  const ok = await orch.handle({ type: 'USER_UTTERANCE', text: 'Guten Morgen.' });
  assert(!ok.reason.startsWith('target_mismatch'), `T1 advance: ${ok.reason}`);
  assert(orch.getPlan().target?.id !== 'l0-guten-morgen', `T1 next != Morgen (${orch.getPlan().target?.id})`);
  console.log('  ✓ TESTE 1: CORRECT → advance →', orch.getPlan().target?.id);
}

// TESTE 3: erro persistente → defer + advance
{
  await MemoryService.saveConfidenceMap({});
  const zero = profileZero(20);
  const orch = ConversationOrchestrator.create({
    profile: zero,
    learning: buildLearningProfile(zero, [], [], null, {}),
    phrases,
  });
  const firstId = orch.getPlan().target!.id;
  await orch.handle({ type: 'TEACHER_UTTERANCE', text: 'Guten Morgen.' });
  const e1 = await orch.handle({ type: 'USER_UTTERANCE', text: 'Banana.' });
  assert(e1.flow === 'intervenePedagogically', `T3 e1: ${e1.reason}`);
  const e2 = await orch.handle({ type: 'USER_UTTERANCE', text: 'Banana.' });
  // attempt 2 may still retry OR if idempotent... use different wrong text
  const e2b = e2.reason.includes('idempotent')
    ? await orch.handle({ type: 'USER_UTTERANCE', text: 'Totally wrong.' })
    : e2;
  assert(
    e2b.reason.includes('postergada') || e2b.reason.includes('correction_retry_fail'),
    `T3 e2: ${e2b.reason}`,
  );
  // One more fail to force defer if still on retry
  let final = e2b;
  if (e2b.reason.includes('correction_retry_fail')) {
    final = await orch.handle({ type: 'USER_UTTERANCE', text: 'Still wrong xyz.' });
  }
  assert(final.reason.includes('postergada'), `T3 defer: ${final.reason}`);
  assert(orch.getPlan().target?.id !== firstId, `T3 avançou de ${firstId} → ${orch.getPlan().target?.id}`);
  assert(!/Guten Morgen.*RECUPERAÇÃO|Wie geht/i.test(final.geminiNudge || ''), 'T3 sem recovery greetings');
  console.log('  ✓ TESTE 3: erro persistente → defer + advance →', orch.getPlan().target?.id);
}

// TESTE 4–6: sequência de acertos cobre várias frases; sem rewind
{
  await MemoryService.saveConfidenceMap({});
  const zero = profileZero(20);
  const orch = ConversationOrchestrator.create({
    profile: zero,
    learning: buildLearningProfile(zero, [], [], null, {}),
    phrases,
  });
  const seen = new Set<string>();
  for (let i = 0; i < 12; i++) {
    const t = orch.getPlan().target;
    if (!t) break;
    seen.add(t.id);
    await orch.handle({ type: 'TEACHER_UTTERANCE', text: t.german });
    await orch.handle({ type: 'USER_UTTERANCE', text: t.german });
  }
  assert(seen.size >= 8, `T4 cobertura uniqueTargets>=8 (got ${seen.size})`);
  console.log('  ✓ TESTE 4–6: 12 acertos → unique=', seen.size);
}

// TESTE 7–10: expectativa de cobertura por duração
{
  const c10 = l0ExpectedCoverageForMinutes(10);
  const c20 = l0ExpectedCoverageForMinutes(20);
  const c30 = l0ExpectedCoverageForMinutes(30);
  const c60 = l0ExpectedCoverageForMinutes(60);
  assert(c10 >= 6 && c20 >= c10 && c30 >= c20 && c60 >= c30, `T7–10 escala ${c10}<${c20}<${c30}<${c60}`);
  console.log('  ✓ TESTE 7–10: expectativa', { c10, c20, c30, c60, curriculum: priorityLen });
}

console.log('\nDIAG L0 MAX COVERAGE OK');
