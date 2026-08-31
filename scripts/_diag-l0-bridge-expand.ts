/* Ponte L0 → A1 funcional + anti-greetings recall.
   Rodar: npx tsx scripts/_diag-l0-bridge-expand.ts */
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
  isL0CoreCurriculumComplete,
  isL0GreetingPhraseId,
  l0ConverseExpandNudge,
  l0FunctionalExpansionsFor,
  ZERO_LANGUAGE_BLOCKS,
  L0_BRIDGE_A1_SPECS,
} from '../src/services/teacher/ZeroLanguageMode';
import type { UserProfile } from '../src/types';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`FAIL: ${msg}`);
}

function profileZero(): UserProfile {
  return {
    id: 'bridge', name: 'Rick', level: 'zero', selfReportedLevel: 'zero', diagnosticLevel: 'L0',
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
const GREETINGS = ZERO_LANGUAGE_BLOCKS.find((b) => b.id === 'greetings')!.phraseIds;

console.log('DIAG — L0 bridge expand + anti-greetings\n');

// TESTE 1: greetings aceitos não voltam como recall prioritário
{
  const zero = profileZero();
  const map = Object.fromEntries([
    ...GREETINGS.map((id) => [id, acceptConf(id)]),
    ['l0-wie-gehts', acceptConf('l0-wie-gehts')],
  ]);
  const learning = buildLearningProfile(zero, [], [], null, map);
  const picked = pickZeroLanguageTarget(learning, mergeZeroLanguagePhrases([]), {
    excludePhraseId: 'l0-wie-gehts',
  });
  assert(picked.phrase?.id !== 'l0-guten-morgen', `T1 não Morgen (${picked.phrase?.id})`);
  assert(!picked.phrase || !isL0GreetingPhraseId(picked.phrase.id), `T1 sem greeting recall (${picked.phrase?.id})`);
  console.log('  ✓ TESTE 1: greetings aceitos ≠ recall prioritário →', picked.phrase?.id, picked.action);
}

// TESTE 2–3: core complete → ponte A1, não primeiro greeting
{
  const zero = profileZero();
  const map = Object.fromEntries(CORE.map((id) => [id, acceptConf(id)]));
  const learning = buildLearningProfile(zero, [], [], null, map);
  assert(isL0CoreCurriculumComplete(learning), 'T2 core complete');
  const picked = pickZeroLanguageTarget(learning, mergeZeroLanguagePhrases([]));
  assert(picked.phrase?.id !== 'l0-guten-morgen', 'T2 ≠ primeiro greeting');
  assert(picked.phrase?.id === 'l0-bridge-ich-arbeite-in', `T3 ponte (${picked.phrase?.id})`);
  assert(picked.action === 'introduce', `T3 introduce (${picked.action})`);
  console.log('  ✓ TESTE 2–3: L0_CURRICULUM_COMPLETE → ponte', picked.phrase?.id);
}

// TESTE 4–5: converse expand nudge
{
  const nudge = l0ConverseExpandNudge({
    lastGerman: 'Ich arbeite.',
    nextBridgeGerman: 'Wo arbeitest du?',
  });
  assert(/EXPANDIR|Wo arbeitest/i.test(nudge), 'T4 expand');
  assert(!/use outra frase já conhecida em RECALL/i.test(nudge), 'T4 sem recall genérico');
  assert(/PROIBIDO:.*Guten Morgen/i.test(nudge), 'T4 proíbe greetings');
  const ex = l0FunctionalExpansionsFor('Ich arbeite.');
  assert(ex.some((e) => /Wo arbeitest|Wann arbeitest|Ich arbeite in/i.test(e)), 'T5 expansões arbeite');
  console.log('  ✓ TESTE 4–5: converse expande Ich arbeite →', ex[0]);
}

// TESTE 6: erro em target novo (bridge) → retry local, não greetings
{
  await EventStore.clear();
  await MemoryService.saveConfidenceMap(Object.fromEntries(CORE.map((id) => [id, acceptConf(id)])));
  const zero = profileZero();
  const orch = ConversationOrchestrator.create({
    profile: zero,
    learning: buildLearningProfile(zero, [], [], null, Object.fromEntries(CORE.map((id) => [id, acceptConf(id)]))),
    phrases: mergeZeroLanguagePhrases([]),
  });
  const start = orch.getPlan().target;
  assert(start?.id === L0_BRIDGE_A1_SPECS[0].id, `T6 start bridge (${start?.id})`);
  await orch.handle({ type: 'TEACHER_UTTERANCE', text: start!.german });
  const bad = await orch.handle({ type: 'USER_UTTERANCE', text: 'xyz-wrong-999' });
  assert(bad.flow === 'intervenePedagogically', 'T6 intervene');
  assert(orch.getPlan().target?.id === start!.id, `T6 stick (${orch.getPlan().target?.id})`);
  assert(!/Guten Morgen/i.test(bad.correction || ''), 'T6 ≠ Morgen');
  console.log('  ✓ TESTE 6: erro bridge → retry local');
}

// TESTE 7: 20+ turnos sem loop de greetings
{
  await EventStore.clear();
  await MemoryService.saveConfidenceMap({});
  const zero = profileZero();
  const orch = ConversationOrchestrator.create({
    profile: zero,
    learning: buildLearningProfile(zero, [], [], null, {}),
    phrases: mergeZeroLanguagePhrases([]),
  });
  const ids: string[] = [];
  for (let i = 0; i < 25; i++) {
    const t = orch.getPlan().target;
    if (!t) break;
    ids.push(t.id);
    await orch.handle({ type: 'TEACHER_UTTERANCE', text: t.german });
    await orch.handle({ type: 'USER_UTTERANCE', text: t.german });
  }
  // Após aceitar os 6 greetings, não devem reaparecer como target
  const afterGreetings = ids.slice(GREETINGS.length);
  const greetingReentry = afterGreetings.filter((id) => isL0GreetingPhraseId(id));
  assert(greetingReentry.length === 0, `T7 greetings reentraram: ${greetingReentry.join(',')}`);
  assert(ids.includes(L0_BRIDGE_A1_SPECS[0].id), 'T7 alcança ponte');
  console.log('  ✓ TESTE 7: 25 turnos sem loop greetings; unique=', new Set(ids).size);
}

// TESTE 8: A1+ sem L0 bridge no plano
{
  const a2: UserProfile = {
    ...profileZero(),
    id: 'a2',
    level: 'A2',
    selfReportedLevel: 'A2',
    diagnosticLevel: 'A2',
  };
  const { buildConversationPlan } = await import('../src/services/teacher/ConversationOrchestrator');
  const plan = buildConversationPlan(a2, buildLearningProfile(a2, [], [], null, {}), mergeZeroLanguagePhrases([]));
  assert(!/L0_BRIDGE|ZERO LANGUAGE MODE/i.test(plan.teacherDirective), 'T8 A2 sem L0 bridge directive');
  assert(!/EXPANDIR \(não reiniciar\)/i.test(plan.actionKickoff), 'T8 A2 sem expand L0 kickoff');
  console.log('  ✓ TESTE 8: A1+ regressão zero');
}

console.log('\nDIAG L0 BRIDGE EXPAND OK');
