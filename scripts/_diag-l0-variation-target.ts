/* Diagnóstico: variação Arbeitest du? vs regressão para Ich arbeite.
   Rodar: npx tsx scripts/_diag-l0-variation-target.ts */
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
  buildL0AcceptedAnswers,
  diagnoseAgainstAccepted,
  mergeZeroLanguagePhrases,
  ZERO_LANGUAGE_BLOCKS,
} from '../src/services/teacher/ZeroLanguageMode';
import type { Phrase, UserProfile } from '../src/types';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`FAIL: ${msg}`);
}

function profileZero(): UserProfile {
  return {
    id: 'var-target', name: 'Rick', level: 'zero', selfReportedLevel: 'zero', diagnosticLevel: 'L0',
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

const ALL = ZERO_LANGUAGE_BLOCKS.flatMap((b) => b.phraseIds);
const PRIOR = ALL.slice(0, ALL.indexOf('survival-arbeite'));

console.log('DIAG — L0 variation target (Arbeitest du?)\n');

// Probe acceptedAnswers
{
  const cases: Array<[string, string, string]> = [
    ['Ja, ich arbeite.', 'Ich arbeite.', ''],
    ['Ja, ich arbeite.', 'Ich arbeite.', 'Arbeitest du?'],
    ['Arbeitest du?', 'Ich arbeite.', ''],
    ['Arbeitest du?', 'Ich arbeite.', 'Arbeitest du? Agora você.'],
    ['Ja.', 'Ich arbeite.', 'Arbeitest du?'],
  ];
  for (const [user, target, teacher] of cases) {
    const acc = buildL0AcceptedAnswers(target, teacher);
    const d = diagnoseAgainstAccepted(user, acc, target);
    console.log(`  ${d.verdict.padEnd(12)} user="${user}" teacher="${teacher.slice(0, 30)}" → matched=${d.matchedAnswer}`);
  }
  const echoNoTeacher = diagnoseAgainstAccepted(
    'Arbeitest du?',
    buildL0AcceptedAnswers('Ich arbeite.', ''),
    'Ich arbeite.',
  );
  console.log('\n  ROOT CANDIDATE: eco "Arbeitest du?" sem teacher no snapshot →', echoNoTeacher.verdict);
  assert(echoNoTeacher.verdict !== 'CORRECT', 'eco sem contexto NÃO deve passar (prova do gap)');
}

await EventStore.clear();
await MemoryService.saveConfidenceMap({});

const zero = profileZero();
const phrases = mergeZeroLanguagePhrases([
  fakePhrase('survival-arbeite', 'Ich arbeite.', 'Eu trabalho.'),
]);
const prior = Object.fromEntries(PRIOR.map((id) => [id, acceptConf(id)]));
await MemoryService.saveConfidenceMap(prior);

// TESTE EXATO: A correct → teacher Arbeitest → B correct → NÃO volta a A
{
  const orch = ConversationOrchestrator.create({
    profile: zero,
    learning: buildLearningProfile(zero, [], [], null, prior),
    phrases,
  });
  assert(orch.getPlan().target?.id === 'survival-arbeite', `start A (${orch.getPlan().target?.id})`);

  await orch.handle({ type: 'TEACHER_UTTERANCE', text: 'Diga: Ich arbeite.' });
  const a = await orch.handle({ type: 'USER_UTTERANCE', text: 'Ich arbeite.' });
  assert(!a.reason.startsWith('target_mismatch'), `A CORRECT: ${a.reason}`);
  const afterA = orch.getPlan().target?.id;
  console.log('\n  Após A CORRECT → target=', afterA, 'reason=', a.reason);

  // Simula Gemini introduzindo variação ANTES do aluno ter avançado… ou no mesmo target.
  // Caso crítico de produção: professor pergunta Arbeitest enquanto target ainda é A
  // (recria: reset plan stick — novo orch sem aceitar A ainda)
}

// Caso produção: target ainda A, professor pergunta Arbeitest, aluno responde bem
{
  await MemoryService.saveConfidenceMap(prior);
  const orch = ConversationOrchestrator.create({
    profile: zero,
    learning: buildLearningProfile(zero, [], [], null, prior),
    phrases,
  });
  assert(orch.getPlan().target?.id === 'survival-arbeite', 'target A');

  // Snapshot STALE: só "Diga Ich arbeite" (sem Arbeitest) — race típica
  await orch.handle({ type: 'TEACHER_UTTERANCE', text: 'Diga: Ich arbeite.' });
  // Gemini já perguntou Arbeitest, mas TEACHER_UTTERANCE atrasou / não chegou
  const stale = await orch.handle({ type: 'USER_UTTERANCE', text: 'Arbeitest du?' });
  console.log('\n  STALE SNAPSHOT + eco Arbeitest:', {
    reason: stale.reason,
    flow: stale.flow,
    correction: stale.correction,
    targetItem: stale.targetItem,
  });
  assert(
    stale.flow === 'intervenePedagogically' || stale.reason.startsWith('target_mismatch'),
    'reproduz: eco Arbeitest com snapshot stale → INCORRECT',
  );
  assert(/ich arbeite/i.test(stale.correction || stale.targetItem || ''), 'correção aponta Ich arbeite (= “voltou”)');
  console.log('  ✓ REPRODUZIDO: variação correta avaliada contra snapshot sem pergunta → regressão UX para A');
}

// Com TEACHER_UTTERANCE atualizado: deve aceitar
{
  await MemoryService.saveConfidenceMap(prior);
  const orch = ConversationOrchestrator.create({
    profile: zero,
    learning: buildLearningProfile(zero, [], [], null, prior),
    phrases,
  });
  await orch.handle({ type: 'TEACHER_UTTERANCE', text: 'Arbeitest du? Agora você.' });
  const ok = await orch.handle({ type: 'USER_UTTERANCE', text: 'Ja, ich arbeite.' });
  console.log('\n  Com snapshot fresca + Ja ich arbeite:', {
    reason: ok.reason,
    flow: ok.flow,
    correction: ok.correction,
    targetItem: ok.targetItem,
    action: ok.action,
    planTarget: orch.getPlan().target?.id,
    events: ok.eventsRecorded,
    nudgeHead: (ok.geminiNudge || '').split('\n').slice(0, 6).join(' | '),
  });
  assert(!ok.reason.startsWith('target_mismatch'), `deve CORRECT: ${ok.reason}`);
  const confA = (await MemoryService.loadConfidenceMap())['survival-arbeite'];
  console.log('  conf survival-arbeite timesCorrect=', confA?.timesCorrect);
  const next = orch.getPlan().target?.id;
  assert(
    next !== 'survival-arbeite',
    `após variação CORRECT deve avançar (next=${next}, reason=${ok.reason}, timesCorrect=${confA?.timesCorrect})`,
  );
  console.log('  ✓ Com TEACHER fresca: CORRECT → next=', next);
  assert(!ok.eventsRecorded.includes('PHRASE_USED_SPONTANEOUSLY'), 'variação guiada NÃO é spontaneous');
  assert(/aceita|próximo|TARGET_STUCK/i.test(ok.reason), `reason avanço: ${ok.reason}`);
}

// Echo Arbeitest COM teacher registrado → CORRECT → avança
{
  await MemoryService.saveConfidenceMap(prior);
  const orch = ConversationOrchestrator.create({
    profile: zero,
    learning: buildLearningProfile(zero, [], [], null, prior),
    phrases,
  });
  await orch.handle({ type: 'TEACHER_UTTERANCE', text: 'Arbeitest du? Agora você.' });
  const echoOk = await orch.handle({ type: 'USER_UTTERANCE', text: 'Arbeitest du?' });
  assert(!echoOk.reason.startsWith('target_mismatch'), `eco com teacher: ${echoOk.reason}`);
  assert(orch.getPlan().target?.id !== 'survival-arbeite', `eco avança (${orch.getPlan().target?.id})`);
  console.log('  ✓ eco Arbeitest com TEACHER → CORRECT →', orch.getPlan().target?.id);
}

// Erro em D não volta a A
{
  await MemoryService.saveConfidenceMap(prior);
  const orch = ConversationOrchestrator.create({
    profile: zero,
    learning: buildLearningProfile(zero, [], [], null, prior),
    phrases,
  });
  const seq: string[] = [];
  for (let i = 0; i < 3; i++) {
    const t = orch.getPlan().target!;
    seq.push(t.id);
    await orch.handle({ type: 'TEACHER_UTTERANCE', text: t.german });
    await orch.handle({ type: 'USER_UTTERANCE', text: t.german });
  }
  const d = orch.getPlan().target!;
  seq.push(d.id);
  await orch.handle({ type: 'TEACHER_UTTERANCE', text: d.german });
  const bad = await orch.handle({ type: 'USER_UTTERANCE', text: 'Completely wrong xyz.' });
  assert(bad.flow === 'intervenePedagogically', 'D incorrect');
  assert(orch.getPlan().target?.id === d.id, `retry D não A (${orch.getPlan().target?.id})`);
  assert(!/guten morgen|wie geht/i.test(bad.correction || ''), 'correction = D');
  await orch.handle({ type: 'USER_UTTERANCE', text: d.german });
  seq.push(orch.getPlan().target?.id || '?');
  console.log('  SEQ:', seq.join(' → '));
  assert(!seq.slice(1).includes('survival-arbeite') || seq[0] === 'survival-arbeite', 'sem regressão indevida');
  console.log('  ✓ erro em D → retry D (não A/B/C)');
}

// LOOP 30 turnos
{
  await MemoryService.saveConfidenceMap({});
  const orch = ConversationOrchestrator.create({
    profile: zero,
    learning: buildLearningProfile(zero, [], [], null, {}),
    phrases: mergeZeroLanguagePhrases([]),
  });
  const ids: string[] = [];
  for (let i = 0; i < 30; i++) {
    const t = orch.getPlan().target;
    if (!t) break;
    ids.push(t.id);
    await orch.handle({ type: 'TEACHER_UTTERANCE', text: t.german });
    await orch.handle({ type: 'USER_UTTERANCE', text: t.german });
  }
  let loop = false;
  for (let i = 0; i + 5 < ids.length; i++) {
    const [a, b, c, d, e, f] = ids.slice(i, i + 6);
    if (a === c && c === e && b === d && d === f && a !== b) {
      loop = true;
      console.log('  LOOP_DETECTED at', i, a, b);
      break;
    }
  }
  assert(!loop, `LOOP_DETECTED na seq ${ids.join('→')}`);
  console.log('  ✓ 30 turnos sem A↔B loop; unique=', new Set(ids).size);
}

console.log('\nDIAG VARIATION TARGET OK');
console.log(`
CAUSA RAIZ
==========
1) Resposta válida à variação ("Ja, ich arbeite." / eco "Arbeitest du?") era classificada como
   SPONTANEOUS → timesCorrect NÃO subia → NBA "aguardando aceitação" → re-modela A.
2) Snapshot/acceptedAnswers sem o texto do professor → eco Arbeitest = INCORRECT → correction A.
3) Race: TEACHER_UTTERANCE fire-and-forget no Live podia avaliar o user antes do snapshot.

CORREÇÃO
========
- L0: turnTarget do snapshot + lastTeacher fresco na avaliação
- L0: bloquear spontaneous no turno guiado
- Live: fila serial TEACHER → USER
`);
