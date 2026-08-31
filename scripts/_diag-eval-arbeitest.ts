/* Diagnóstico: avaliação L0 Ich arbeite → Arbeitest du?
   Rodar: npx tsx scripts/_diag-eval-arbeitest.ts
   NÃO faz commit. */
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
import {
  ConversationOrchestrator,
  evaluateProduction,
} from '../src/services/teacher/ConversationOrchestrator';
import {
  diagnoseProduction,
  diagnoseAgainstAccepted,
  buildL0AcceptedAnswers,
  mergeZeroLanguagePhrases,
  isZeroLanguagePhraseAccepted,
  ZERO_LANGUAGE_BLOCKS,
} from '../src/services/teacher/ZeroLanguageMode';
import type { Phrase, UserProfile } from '../src/types';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`FAIL: ${msg}`);
}

function profileZero(): UserProfile {
  return {
    id: 'diag-arbeit',
    name: 'Rick',
    level: 'zero',
    selfReportedLevel: 'zero',
    diagnosticLevel: 'L0',
    goal: 'daily',
    dailyMinutes: 20,
    germanPercentage: 30,
    turboMode: false,
    streak: 0,
    currentDay: 1,
    onboardingComplete: true,
    firstLessonComplete: false,
    profession: 'escritório',
    frequentSituations: ['work'],
    interests: [],
    lastStudyDate: null,
    immersionPhase: 1,
    speechSpeed: 'normal',
    createdAt: new Date().toISOString(),
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
    phraseId: id,
    state: 'repeated',
    confidence: 55,
    recognition: 50,
    listening: 50,
    speaking: 50,
    production: 50,
    speed: 40,
    contextTransfer: 20,
    timesSeen: n,
    timesCorrect: n,
    timesIncorrect: 0,
    timesProduced: n,
    lastSeen: new Date().toISOString(),
    lastProduced: new Date().toISOString(),
    needsHelp: false,
    readyForTransfer: false,
    readyForSpontaneous: false,
  } as PhraseConfidence;
}

const ALL_IDS = ZERO_LANGUAGE_BLOCKS.flatMap((b) => b.phraseIds);
const PRIOR_IDS = ALL_IDS.slice(0, ALL_IDS.indexOf('survival-arbeite'));

function priorAccepted(): Record<string, PhraseConfidence> {
  return Object.fromEntries(PRIOR_IDS.map((id) => [id, acceptConf(id)]));
}

console.log('DIAG — EVAL Arbeitest du? vs Ich arbeite.\n');

const rawVsA = diagnoseProduction('Arbeitest du?', 'Ich arbeite.');
const rawVsB = diagnoseProduction('Arbeitest du?', 'Arbeitest du?');
const jaVsA = diagnoseProduction('Ja, ich arbeite.', 'Ich arbeite.');
console.log('RAW diagnoseProduction:');
console.log('  user="Arbeitest du?" expected="Ich arbeite." →', rawVsA.verdict);
console.log('  user="Arbeitest du?" expected="Arbeitest du?" →', rawVsB.verdict);
console.log('  user="Ja, ich arbeite." expected="Ich arbeite." →', jaVsA.verdict);

assert(rawVsA.verdict === 'INCORRECT' || rawVsA.verdict === 'UNKNOWN', 'sem contexto, Arbeitest≠Ich arbeite');
assert(rawVsB.verdict === 'CORRECT', 'Arbeitest vs Arbeitest = CORRECT');
assert(jaVsA.verdict === 'CORRECT', 'Ja ich arbeite vs Ich arbeite = CORRECT');

const acceptedWithTeacher = buildL0AcceptedAnswers('Ich arbeite.', 'Arbeitest du? Agora você.');
console.log('\nacceptedAnswers (target=Ich arbeite, teacher=Arbeitest du?):', acceptedWithTeacher);
const withCtx = diagnoseAgainstAccepted('Ja, ich arbeite.', acceptedWithTeacher, 'Ich arbeite.');
const echoQ = diagnoseAgainstAccepted('Arbeitest du?', acceptedWithTeacher, 'Ich arbeite.');
console.log('  Ja, ich arbeite. →', withCtx.verdict, 'matched=', withCtx.matchedAnswer);
console.log('  Arbeitest du? →', echoQ.verdict, 'matched=', echoQ.matchedAnswer);
assert(withCtx.verdict === 'CORRECT', 'com contexto professor, Ja ich arbeite = CORRECT');
assert(echoQ.verdict === 'CORRECT', 'com contexto professor, eco da pergunta = CORRECT');

await EventStore.clear();
await MemoryService.saveConfidenceMap({});

const zero = profileZero();
const phrases = mergeZeroLanguagePhrases([
  fakePhrase('survival-arbeite', 'Ich arbeite.', 'Eu trabalho.'),
]);

// ---------- TESTE A ----------
{
  const prior = priorAccepted();
  await MemoryService.saveConfidenceMap(prior);
  const orchA = ConversationOrchestrator.create({
    profile: zero,
    learning: buildLearningProfile(zero, [], [], null, prior),
    phrases,
  });
  assert(orchA.getPlan().target?.id === 'survival-arbeite', `TESTE A target=${orchA.getPlan().target?.id}`);
  await orchA.handle({ type: 'TEACHER_UTTERANCE', text: 'Diga: Ich arbeite.' });
  const a = await orchA.handle({ type: 'USER_UTTERANCE', text: 'Ich arbeite.' });
  assert(!a.reason.startsWith('target_mismatch'), `TESTE A ADVANCE, got ${a.reason}`);
  const confA = (await MemoryService.loadConfidenceMap())['survival-arbeite'];
  assert(isZeroLanguagePhraseAccepted(confA), 'TESTE A: frase aceita');
  console.log('  ✓ TESTE A: Ich arbeite. CORRECT → ADVANCE');
}

// ---------- TESTE B + C ----------
{
  const prior = priorAccepted();
  await MemoryService.saveConfidenceMap({ ...prior });
  const orch = ConversationOrchestrator.create({
    profile: zero,
    learning: buildLearningProfile(zero, [], [], null, prior),
    phrases,
  });
  await orch.handle({ type: 'TEACHER_UTTERANCE', text: 'Ich arbeite. Agora você.' });
  const okA = await orch.handle({ type: 'USER_UTTERANCE', text: 'Ich arbeite.' });
  assert(!okA.reason.startsWith('target_mismatch'), `C-A sem mismatch: ${okA.reason}`);

  await orch.handle({ type: 'TEACHER_UTTERANCE', text: 'Sehr gut. Arbeitest du? Agora você.' });
  const okB = await orch.handle({ type: 'USER_UTTERANCE', text: 'Ja, ich arbeite.' });
  console.log('  TESTE B decision:', { reason: okB.reason, flow: okB.flow, correction: okB.correction, targetItem: okB.targetItem });
  assert(!okB.reason.startsWith('target_mismatch'), `TESTE B NÃO mismatch: ${okB.reason}`);
  // Após aceitar, pode ir para recall espaçado de OUTRA frase — isso NÃO é recovery-por-erro
  assert(!okB.correction, `TESTE C sem correction forçada: ${okB.correction}`);
  console.log('  ✓ TESTE B: Arbeitest du? + Ja, ich arbeite. → CORRECT');
  console.log('  ✓ TESTE C: A→B sem mismatch; next=', okB.targetItem);
}

// ---------- TESTE D ----------
{
  const prior = priorAccepted();
  await MemoryService.saveConfidenceMap(prior);
  const orch = ConversationOrchestrator.create({
    profile: zero,
    learning: buildLearningProfile(zero, [], [], null, prior),
    phrases,
  });
  await orch.handle({ type: 'TEACHER_UTTERANCE', text: 'Arbeitest du? Agora você.' });
  const bad = await orch.handle({ type: 'USER_UTTERANCE', text: 'Ich bin Auto.' });
  assert(bad.reason.startsWith('target_mismatch') || bad.flow === 'intervenePedagogically', `TESTE D intervene: ${bad.reason}`);
  assert(/ich arbeite/i.test(bad.correction || bad.targetItem || ''), `TESTE D retry CURRENT: ${bad.correction}`);
  assert(!/wie geht|guten morgen/i.test(bad.correction || ''), 'TESTE D NÃO volta para frase antiga');
  console.log('  ✓ TESTE D: erro → RETRY current (Ich arbeite), não frase antiga');
}

// ---------- TESTE E ----------
{
  const prior = priorAccepted();
  await MemoryService.saveConfidenceMap(prior);
  const orch = ConversationOrchestrator.create({
    profile: zero,
    learning: buildLearningProfile(zero, [], [], null, prior),
    phrases,
  });
  await orch.handle({ type: 'TEACHER_UTTERANCE', text: 'Diga Ich arbeite.' });
  const near = await orch.handle({ type: 'USER_UTTERANCE', text: 'Ich arbeit.' });
  assert(near.flow === 'intervenePedagogically' || near.reason.includes('mismatch') || near.reason.includes('pronunciation'), `TESTE E: ${near.reason}`);
  assert(/arbeite/i.test(near.correction || ''), 'TESTE E correction = current');
  console.log('  ✓ TESTE E: near-miss → correction → retry current');
}

// ---------- TESTE F ----------
{
  const prior = priorAccepted();
  await MemoryService.saveConfidenceMap(prior);
  const orch = ConversationOrchestrator.create({
    profile: zero,
    learning: buildLearningProfile(zero, [], [], null, prior),
    phrases,
  });
  assert(orch.getPlan().target?.id === 'survival-arbeite', `TESTE F target=${orch.getPlan().target?.id}`);
  await orch.handle({ type: 'TEACHER_UTTERANCE', text: 'Ich arbeite.' });
  const force = await orch.handle({ type: 'USER_UTTERANCE', text: 'Completely wrong xyz.' });
  assert(force.flow === 'intervenePedagogically', 'F setup pending');
  await orch.handle({ type: 'TEACHER_UTTERANCE', text: 'Arbeitest du? Ja oder nein?' });
  const late = await orch.handle({ type: 'USER_UTTERANCE', text: 'Ja, ich arbeite.' });
  assert(!late.reason.includes('correction_retry_fail'), `TESTE F: ${late.reason}`);
  console.log('  ✓ TESTE F: pending antigo não derruba resposta correta atual');
}

// ---------- TESTE G ----------
{
  const prior = priorAccepted();
  await MemoryService.saveConfidenceMap(prior);
  const orch = ConversationOrchestrator.create({
    profile: zero,
    learning: buildLearningProfile(zero, [], [], null, prior),
    phrases,
  });
  await orch.handle({ type: 'TEACHER_UTTERANCE', text: 'Diga Ich arbeite.' });
  await orch.handle({ type: 'USER_UTTERANCE', text: 'Completely wrong xyz.' });
  const g2 = await orch.handle({ type: 'USER_UTTERANCE', text: 'Completely wrong xyz.' });
  assert(g2.reason === 'utterance_idempotent' || g2.reason.includes('idempotent'), `TESTE G: ${g2.reason}`);
  console.log('  ✓ TESTE G: duplicado → uma avaliação');
}

assert(evaluateProduction('Ich arbeite.', 'ich arbeite') === 'CORRECT', 'expected curto ainda ok');
console.log('\nDIAG OK — testes A–G passaram.');
console.log(`
RELATÓRIO
=========
TARGET ATUAL (plano): Ich arbeite. (survival-arbeite)
PROFESSOR (Live) diz: Arbeitest du?  ← NÃO existe como phraseId L0
RESPOSTA: Ja, ich arbeite. / Arbeitest du?
ANTES: evaluate(user, plan.target) → INCORRECT → teachFromError(Ich arbeite) = \"volta para A\"
CAUSA: desalinhamento Gemini↔orchestrator + expected truncado; B nunca é target oficial
CORREÇÃO: snapshot do turno + acceptedAnswers quando o professor elicita a pergunta
`);
