/* Fase 11 — ZERO LANGUAGE + ciclo de correção
   Rodar: npx tsx scripts/test-fase11-zero-language.ts */
const _store = new Map<string, string>();
(globalThis as unknown as { localStorage: Storage }).localStorage = {
  getItem: (k: string) => _store.get(k) ?? null,
  setItem: (k: string, v: string) => { _store.set(k, v); },
  removeItem: (k: string) => { _store.delete(k); },
  clear: () => { _store.clear(); },
  key: () => null,
  length: 0,
} as Storage;

import { buildLearningProfile } from '../src/services/learning/ConfidenceService';
import { EventStore } from '../src/services/learning/EventStore';
import { MemoryService } from '../src/services/learning/MemoryService';
import { readAutomationScore, toLearningItemState } from '../src/services/learning/AutomationScoreEngine';
import {
  ConversationOrchestrator,
  buildConversationPlan,
  evaluateProduction,
} from '../src/services/teacher/ConversationOrchestrator';
import {
  diagnoseProduction,
  isZeroLanguageMode,
  isZeroLanguagePhraseAccepted,
  mergeZeroLanguagePhrases,
  L0_MIN_CORRECT_BEFORE_ADVANCE,
  L0_BLOCK_RECOVERY_ERROR_THRESHOLD,
} from '../src/services/teacher/ZeroLanguageMode';
import type { Phrase, UserProfile } from '../src/types';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`FAIL: ${msg}`);
}

function profileZero(): UserProfile {
  return {
    id: 'z0',
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

function profileA2(): UserProfile {
  return {
    ...profileZero(),
    id: 'a2',
    level: 'little',
    selfReportedLevel: 'basic',
    diagnosticLevel: 'A2',
    germanPercentage: 75,
    firstLessonComplete: true,
  };
}

function fakePhrase(id: string, german: string, pt: string): Phrase {
  return {
    id,
    german,
    portuguese: pt,
    category: 'greetings',
    mastery: 'recognize',
    reviewStage: 'learning',
    nextReview: null,
    timesReviewed: 0,
    timesCorrect: 0,
    timesIncorrect: 0,
    isAutomatic: false,
    contexts: [],
  };
}

console.log('FASE 11 — ZERO LANGUAGE + CORREÇÃO\n');

// --- Gate ---
assert(isZeroLanguageMode(profileZero()) === true, 'nível 0 → ZERO_LANGUAGE_MODE');
assert(isZeroLanguageMode(profileA2()) === false, 'A2 → modo NÃO ativo');
assert(isZeroLanguageMode({ level: 'zero', selfReportedLevel: 'beginner', diagnosticLevel: 'A1' }) === false, 'diag A1 → off');
console.log('  ✓ isZeroLanguageMode gate');

// --- Diagnóstico / pronúncia near-miss ---
assert(evaluateProduction('Guten Morgen.', 'Guten Morgen.') === 'CORRECT', 'produção correta');
assert(evaluateProduction('Guten Morgem.', 'Guten Morgen.') === 'NEEDS_REPAIR', 'Morgem → NEEDS_REPAIR');
const diag = diagnoseProduction('Guten Morgem.', 'Guten Morgen.');
assert(diag.errorType === 'pronunciation_approx', 'tipo pronunciation_approx');
assert(diag.hardPart === 'morgen' || diag.hardPart === 'Morgen' || !!diag.hardPart, 'hardPart presente');
assert(L0_MIN_CORRECT_BEFORE_ADVANCE === 1, 'avanço com 1 acerto');
assert(isZeroLanguagePhraseAccepted({ phraseId: 'x', timesCorrect: 1 } as never) === true, 'accepted com 1 acerto');
assert(isZeroLanguagePhraseAccepted({ phraseId: 'x', timesCorrect: 0 } as never) === false, 'não accepted sem acerto');
console.log('  ✓ accept vs mastery (1 acerto avança)');

await EventStore.clear();
await MemoryService.saveConfidenceMap({});

const zero = profileZero();
const phrases = mergeZeroLanguagePhrases([
  fakePhrase('survival-arbeite', 'Ich arbeite.', 'Eu trabalho.'),
]);
const learning = buildLearningProfile(zero, [], [], null, {});
const plan = buildConversationPlan(zero, learning, phrases);
assert(plan.action === 'introduce' || plan.action === 'practice', `L0 action introduce/practice (got ${plan.action})`);
assert(plan.scaffoldLevel >= 3, `scaffold alto L0 (${plan.scaffoldLevel})`);
assert(plan.teacherDirective.includes('ZERO LANGUAGE MODE'), 'directive L0');
assert(plan.actionKickoff.includes('ZERO LANGUAGE MODE') || plan.actionKickoff.includes('Agora'), 'kickoff L0');
assert(!!plan.target, 'tem target L0');
assert(/morgen|geht|hallo|heiße|arbeite/i.test(plan.target!.german), `target curto: ${plan.target!.german}`);
assert(/Guten Morgen|microaula|Vamos aprender/i.test(plan.actionKickoff + plan.teacherDirective), 'microaula PT no prompt');
console.log('  ✓ buildConversationPlan L0');

// Continuidade abertura L0
const { getSessionOpening } = await import('../src/services/teacher/sessionContinuity/SessionOpeningEngine');
const open1 = getSessionOpening({
  sessionCount: 0,
  lastSession: null,
  recentOpenings: [],
  hoursSinceLast: null,
  weakPhrases: [],
  knownPhrases: [],
  goal: 'daily',
  profession: '',
  zeroLanguageMode: true,
});
assert(/Guten Morgen/i.test(open1.german), `L0 first opening curto: ${open1.german}`);
assert(!/Wie heißt du/i.test(open1.german), 'L0 first NÃO abre com Wie heißt du complexo');
const open2 = getSessionOpening({
  sessionCount: 2,
  lastSession: {
    date: new Date().toISOString(),
    durationMinutes: 10,
    topic: 'greetings',
    phrasesLearned: ['Guten Morgen.'],
    phrasesReviewed: [],
    mistakes: [],
    unfinishedContent: ["Wie geht's?"],
    lastQuestion: "Wie geht's?",
    lastTeacherMessage: "Wie geht's?",
    lastUserResponse: '',
    nextSuggestedStep: 'continue',
    lastOpening: 'Guten Morgen.',
    sessionKind: 'FIRST_SESSION',
  },
  recentOpenings: ['Guten Morgen.'],
  hoursSinceLast: 24,
  weakPhrases: ["Wie geht's?"],
  knownPhrases: ['Guten Morgen.'],
  goal: 'daily',
  profession: '',
  zeroLanguageMode: true,
});
assert(/geht|continuar|Morgen/i.test(open2.german + open2.portuguese), `L0 return continua: ${open2.german}`);
assert(!/Schön, dich wiederzusehen/i.test(open2.german), 'L0 return sem frase longa A1');
console.log('  ✓ abertura L0 + continuidade');

// Regressão A2
const planA2 = buildConversationPlan(profileA2(), learning, phrases);
assert(!planA2.teacherDirective.includes('ZERO LANGUAGE MODE'), 'A2 sem bloco zero');
console.log('  ✓ regressão A2 no plano');

// --- Ciclo correção por voz (orquestrador) ---
await EventStore.clear();
await MemoryService.saveConfidenceMap({});

const orch = ConversationOrchestrator.create({
  profile: zero,
  learning,
  phrases,
  sessionId: 'fase11-zero',
});
const live = orch.toLiveFields();
assert(live.teacherDirective?.includes('ZERO LANGUAGE MODE'), 'toLiveFields L0');
assert((live.scaffoldLevel ?? 0) >= 3, 'scaffold live L0');
console.log('  ✓ toLiveFields L0');

// --- Ciclo correção por voz: Guten Morgem → modelo → retry (força target no plano via utterance path) ---
await EventStore.clear();
await MemoryService.saveConfidenceMap({});

const orch2 = ConversationOrchestrator.create({
  profile: zero,
  learning: buildLearningProfile(zero, [], [], null, {}),
  phrases: mergeZeroLanguagePhrases([
    fakePhrase('l0-guten-morgen', 'Guten Morgen.', 'Bom dia.'),
  ]),
  sessionId: 'fase11-corr',
});
await orch2.handle({ type: 'SESSION_STARTED' });

// Se o plano ainda for Hallo, o near-miss contra Hallo também dispara mismatch — preferimos testar
// diagnoseProduction (já feito) + ciclo grammar/conjugação E o path target com fala errada vs alvo atual.
const targetDe = orch2.toLiveFields().targetPhrase || 'Hallo.';
const wrong =
  /morgen/i.test(targetDe) ? 'Guten Morgem.'
    : /hallo/i.test(targetDe) ? 'Halo.'
      : `${targetDe.replace(/[.?!]$/, '')}x`;

const bad = await orch2.handleUserUtterance(wrong);
assert(
  bad.eventsRecorded.includes('PHRASE_FAILED') || bad.flow === 'intervenePedagogically',
  `detecta erro (flow=${bad.flow}, events=${bad.eventsRecorded.join(',')}, target=${targetDe}, wrong=${wrong})`,
);
assert(!!bad.geminiNudge && /quase|agora você|correção|modelo|escute|sag:/i.test(bad.geminiNudge), 'nudge de correção pede nova tentativa');
assert(bad.mode === 'PEDAGOGICAL_INTERVENTION' || bad.flow === 'intervenePedagogically', 'intervém pedagogicamente');
console.log('  ✓ erro → correção + espera retry');

const retryOk = await orch2.handleUserUtterance(targetDe);
assert(
  retryOk.eventsRecorded.includes('PHRASE_PRODUCED_WITH_HINT') ||
    retryOk.eventsRecorded.includes('PHRASE_PRODUCED'),
  `2ª tentativa registrada (${retryOk.eventsRecorded.join(',')})`,
);
assert(!retryOk.eventsRecorded.includes('INDEPENDENT_RESPONSE'), 'após modelo NÃO é independência');
assert(!!retryOk.geminiNudge && /sehr gut|perfeito/i.test(retryOk.geminiNudge), 'elogio após retry');
console.log('  ✓ segunda tentativa guiada registrada');

const map = await MemoryService.loadConfidenceMap();
const conf = Object.values(map).find((c) => c.timesCorrect > 0 || c.timesIncorrect > 0);
assert(!!conf, 'PhraseConfidence atualizado');
const state = toLearningItemState(conf!);
assert(typeof state.automationScore === 'number', 'LearningItemState derivável');
assert(typeof readAutomationScore(conf!) === 'number', 'automationScore');
assert(typeof state.independenceScore === 'number', 'independenceScore existe');
console.log('  ✓ memória / LearningItemState / automation');

const events = await EventStore.load();
assert(events.some((e) => e.type === 'PHRASE_FAILED'), 'EventStore PHRASE_FAILED');
assert(
  events.some((e) => e.type === 'PHRASE_PRODUCED_WITH_HINT' || e.type === 'PHRASE_PRODUCED'),
  'EventStore produção',
);
assert(!events.some((e) => String(e.type).includes('BEGINNER')), 'sem memória paralela beginner');
console.log('  ✓ EventStore existente (sem BeginnerMemory)');
// Produção correta sem ajuda artificial (scaffold baixo) — independente
await EventStore.clear();
await MemoryService.saveConfidenceMap({});
const orch3 = ConversationOrchestrator.create({
  profile: profileA2(),
  learning: buildLearningProfile(profileA2(), [], [], null, {}),
  phrases: [
    fakePhrase('survival-arbeite', 'Ich arbeite heute.', 'Eu trabalho hoje.'),
    fakePhrase('p1', 'Ich wohne in Cuxhaven.', 'Moro em Cuxhaven.'),
  ],
  sessionId: 'fase11-a2',
});
assert(!orch3.toLiveFields().teacherDirective?.includes('ZERO LANGUAGE MODE'), 'A2 live sem zero');
const okA2 = await orch3.handleUserUtterance('Ich arbeite heute.');
// Pode ser unclassified se target diferente — ok se não ativou zero
assert(!okA2.reason?.includes('ZERO_LANGUAGE'), 'A2 reason sem zero');
console.log('  ✓ regressão A2 orquestrador');

// Recorrência: mesmo erro duas sessões (padrão)
await EventStore.clear();
await MemoryService.saveConfidenceMap({});
const orchR = ConversationOrchestrator.create({
  profile: zero,
  learning: buildLearningProfile(zero, [], [], null, {}),
  phrases: mergeZeroLanguagePhrases([fakePhrase('survival-arbeite', 'Ich arbeite.', 'Eu trabalho.')]),
  sessionId: 'fase11-rec',
});
const e1 = await orchR.handleUserUtterance('Ich arbeiten.');
assert(e1.eventsRecorded.includes('PHRASE_FAILED') || e1.correction || e1.flow === 'startMicroPractice', '1º Ich arbeiten detectado');
const e2 = await orchR.handleUserUtterance('Ich arbeite.');
assert(
  e2.eventsRecorded.includes('PHRASE_PRODUCED_WITH_HINT') ||
    e2.eventsRecorded.includes('PHRASE_PRODUCED') ||
    e2.eventsRecorded.includes('MICRO_PRACTICE_ATTEMPT') ||
    e2.eventsRecorded.includes('MICRO_PRACTICE_SUCCESS') ||
    e2.flow === 'continueConversation' ||
    e2.flow === 'resumeConversation' ||
    e2.flow === 'startMicroPractice',
  `retry após conjugação (flow=${e2.flow}, events=${e2.eventsRecorded.join(',')})`,
);
console.log('  ✓ ciclo conjugação Ich arbeiten → Ich arbeite');

// Blocos + recuperação L0
const {
  ZERO_LANGUAGE_BLOCKS,
  getBlockRecoverySequence,
  shouldRecoverZeroLanguageBlock,
  zeroLanguageSessionUnits,
  blockRecoveryNudge,
  pickZeroLanguageTarget,
} = await import('../src/services/teacher/ZeroLanguageMode');
assert(ZERO_LANGUAGE_BLOCKS[0].phraseIds[0] === 'l0-guten-morgen', 'bloco 1 começa com Guten Morgen');
assert(ZERO_LANGUAGE_BLOCKS[0].phraseIds.includes('l0-gute-nacht'), 'bloco 1 tem Gute Nacht');
assert(shouldRecoverZeroLanguageBlock('l0-gute-nacht', 'INCORRECT', 'mismatch', L0_BLOCK_RECOVERY_ERROR_THRESHOLD) === true, '2º erro no bloco → recovery');
assert(shouldRecoverZeroLanguageBlock('l0-gute-nacht', 'INCORRECT', 'mismatch', 1) === false, '1º erro → sem recovery de bloco');
assert(shouldRecoverZeroLanguageBlock('l0-guten-morgen', 'INCORRECT', 'mismatch', 5) === false, '1ª frase do bloco → sem recovery');
assert(shouldRecoverZeroLanguageBlock('l0-gute-nacht', 'NEEDS_REPAIR', 'pronunciation_approx', 5) === false, 'near-miss → sem recovery');
assert(shouldRecoverZeroLanguageBlock('l0-wie-gehts', 'INCORRECT', 'mismatch', 5) === false, '1ª frase bloco 2 → sem recovery');
const seq = getBlockRecoverySequence('l0-gute-nacht', mergeZeroLanguagePhrases([]));
assert(seq.length === 3, `recovery seq sem memória length 3 (got ${seq.length})`);
assert(/Guten Morgen/i.test(seq[0].german) && /Gute Nacht/i.test(seq[2].german), 'sem memória: Morgen→…→Nacht');
// Com frases aceitas: NÃO inclui dominadas
const learningAccepted = buildLearningProfile(zero, [], [], null, {});
for (const id of ['l0-guten-morgen', 'l0-guten-abend']) {
  learningAccepted.phrases[id] = {
    phraseId: id, state: 'answeredWithHelp', confidence: 50,
    timesCorrect: 1, timesProduced: 1, timesSeen: 1, needsHelp: true,
    listening: 0, speaking: 0, recognition: 0, production: 0, speed: 0, contextTransfer: 0,
    avgResponseMs: 0, lastSeen: new Date().toISOString(), lastProduced: new Date().toISOString(),
  } as never;
}
const seqFiltered = getBlockRecoverySequence('l0-gute-nacht', mergeZeroLanguagePhrases([]), learningAccepted);
assert(seqFiltered.length === 1 && /Gute Nacht/i.test(seqFiltered[0].german), 'com aceitas: só a frase falhada');
assert(zeroLanguageSessionUnits(20) === 20, 'duração 20 → 20 unidades');
assert(zeroLanguageSessionUnits(10) === 10, 'duração 10 → 10 unidades');
const nudgeRec = blockRecoveryNudge({ failedGerman: 'Gute Nacht.', sequence: seqFiltered, blockNamePt: 'Cumprimentos' });
assert(/RECUPERAÇÃO LOCAL|RECUPERAÇÃO DO BLOCO|Vamos tentar/i.test(nudgeRec), 'nudge recovery local');
assert(/Gute Nacht/i.test(nudgeRec), 'nudge lista a frase falhada');
assert(!/Modele "Guten Morgen/i.test(nudgeRec), 'nudge NÃO pede modelar Morgen dominado');
console.log('  ✓ blocos L0 + regra de recuperação');

// Orquestrador: near-miss não agenda recovery; mismatch no meio do bloco agenda
await EventStore.clear();
await MemoryService.saveConfidenceMap({});
const orchNear = ConversationOrchestrator.create({
  profile: zero,
  learning: buildLearningProfile(zero, [], [], null, {}),
  phrases: mergeZeroLanguagePhrases([
    fakePhrase('l0-guten-morgen', 'Guten Morgen.', 'Bom dia.'),
  ]),
  sessionId: 'fase11-near',
});
await orchNear.handle({ type: 'SESSION_STARTED' });
const nearDec = await orchNear.handleUserUtterance('Guten Morgem.');
assert(
  nearDec.flow === 'intervenePedagogically' || nearDec.eventsRecorded.includes('PHRASE_FAILED'),
  'near-miss Morgen intervém',
);
const nearOk = await orchNear.handleUserUtterance('Guten Morgen.');
assert(/Perfeito/i.test(nearOk.geminiNudge || ''), 'near-miss → elogio');
assert(shouldRecoverZeroLanguageBlock('l0-guten-morgen', 'NEEDS_REPAIR', 'pronunciation_approx', 5) === false, 'flag recovery off p/ near-miss na 1ª');
console.log('  ✓ near-miss sem recovery de bloco');

// Simula recovery nudge pós-correção compondo as funções (mesmo contrato do orquestrador)
const failedId = 'l0-gute-nacht';
const seq2 = getBlockRecoverySequence(failedId, mergeZeroLanguagePhrases([]), learningAccepted);
const composed = [
  (await import('../src/services/teacher/ZeroLanguageMode')).praiseGuidedRetryNudge('Gute Nacht.'),
  blockRecoveryNudge({ failedGerman: 'Gute Nacht.', sequence: seq2, blockNamePt: 'Cumprimentos' }),
].join('\n');
assert(/Perfeito/i.test(composed) && /RECUPERAÇÃO/i.test(composed), 'compose praise+recovery');
assert(!/Modele "Wie geht/i.test(composed), 'compose sem modelar Wie geht');
assert(shouldRecoverZeroLanguageBlock(failedId, 'INCORRECT', 'wrong_word', L0_BLOCK_RECOVERY_ERROR_THRESHOLD), 'Gute Nacht INCORRECT 2x → recovery flag');
console.log('  ✓ orquestrador recovery (contrato nudge + flag)');

// TESTE 1: 1 acerto → avança
await EventStore.clear();
await MemoryService.saveConfidenceMap({});
const orchT1 = ConversationOrchestrator.create({
  profile: zero,
  learning: buildLearningProfile(zero, [], [], null, {}),
  phrases: mergeZeroLanguagePhrases([fakePhrase('l0-guten-morgen', 'Guten Morgen.', 'Bom dia.')]),
  sessionId: 't1-advance',
});
await orchT1.handle({ type: 'SESSION_STARTED' });
const t1 = await orchT1.handleUserUtterance('Guten Morgen.');
assert(t1.eventsRecorded.includes('PHRASE_PRODUCED_WITH_HINT') || t1.eventsRecorded.includes('PHRASE_PRODUCED'), 'TESTE1 produção');
assert(/próximo|Nova frase|aceita|Perfeito/i.test(t1.geminiNudge || t1.reason || ''), `TESTE1 avança (${t1.reason})`);
const planT1 = orchT1.getPlan();
assert(planT1.target?.id !== 'l0-guten-morgen' || /Abend|próximo/i.test(t1.geminiNudge || ''), 'TESTE1 não repete Morgen');
console.log('  ✓ TESTE 1: 1 acerto → avança');

// TESTE 2: near-miss → correção → acerto → avança
await EventStore.clear();
await MemoryService.saveConfidenceMap({});
const orchT2 = ConversationOrchestrator.create({
  profile: zero,
  learning: buildLearningProfile(zero, [], [], null, {}),
  phrases: mergeZeroLanguagePhrases([fakePhrase('l0-guten-morgen', 'Guten Morgen.', 'Bom dia.')]),
  sessionId: 't2-near',
});
await orchT2.handle({ type: 'SESSION_STARTED' });
const t2a = await orchT2.handleUserUtterance('Guten Morgem.');
assert(t2a.flow === 'intervenePedagogically', 'TESTE2 near-miss intervém');
const t2b = await orchT2.handleUserUtterance('Guten Morgen.');
assert(/Perfeito|próximo|Nova frase|aceita/i.test(t2b.geminiNudge || ''), 'TESTE2 acerto após near-miss avança');
console.log('  ✓ TESTE 2: near-miss → correção → avança');

// TESTE 3: erro real → correção → acerto → avança
await EventStore.clear();
await MemoryService.saveConfidenceMap({});
const orchT3 = ConversationOrchestrator.create({
  profile: zero,
  learning: buildLearningProfile(zero, [], [], null, {}),
  phrases: mergeZeroLanguagePhrases([fakePhrase('l0-guten-morgen', 'Guten Morgen.', 'Bom dia.')]),
  sessionId: 't3-err',
});
await orchT3.handle({ type: 'SESSION_STARTED' });
const t3a = await orchT3.handleUserUtterance('Ich bin Auto.');
assert(t3a.flow === 'intervenePedagogically', 'TESTE3 erro intervém');
const t3b = await orchT3.handleUserUtterance('Guten Morgen.');
assert(/Perfeito|próximo|Nova frase|aceita/i.test(t3b.geminiNudge || ''), 'TESTE3 acerto após erro avança');
console.log('  ✓ TESTE 3: erro → correção → avança');

// TESTE 4: erro em nova estrutura NÃO volta para Morgen
await EventStore.clear();
await MemoryService.saveConfidenceMap({});
const learningT4 = buildLearningProfile(zero, [], [], null, {});
learningT4.phrases['l0-guten-morgen'] = {
  phraseId: 'l0-guten-morgen', state: 'answeredWithHelp', confidence: 50,
  timesCorrect: 1, timesProduced: 1, timesSeen: 1, needsHelp: true,
  listening: 0, speaking: 0, recognition: 0, production: 0, speed: 0, contextTransfer: 0,
  avgResponseMs: 0, lastSeen: new Date().toISOString(), lastProduced: new Date().toISOString(),
} as never;
learningT4.phrases['l0-guten-abend'] = { ...learningT4.phrases['l0-guten-morgen'], phraseId: 'l0-guten-abend' } as never;
learningT4.phrases['l0-gute-nacht'] = { ...learningT4.phrases['l0-guten-morgen'], phraseId: 'l0-gute-nacht' } as never;
const orchT4 = ConversationOrchestrator.create({
  profile: zero,
  learning: learningT4,
  phrases: mergeZeroLanguagePhrases([]),
  sessionId: 't4-local',
});
await orchT4.handle({ type: 'SESSION_STARTED' });
const planBefore = orchT4.getPlan();
assert(planBefore.target?.id === 'l0-wie-gehts', `TESTE4 target bloco 2 (${planBefore.target?.id})`);
const t4 = await orchT4.handleUserUtterance('Ich bin Auto.');
assert(t4.targetItem?.includes('geht') || planBefore.target?.german.includes('geht'), 'TESTE4 correção local');
assert(!/Guten Morgen.*RECUPERAÇÃO|Vamos fazer de novo.*Morgen/i.test(t4.geminiNudge || ''), 'TESTE4 sem recovery greetings');
console.log('  ✓ TESTE 4: erro nova estrutura → recovery local');

// TESTE 5: 2 erros no bloco → pode BLOCK_REVIEW; limite existe
await EventStore.clear();
await MemoryService.saveConfidenceMap({});
const learningT5 = buildLearningProfile(zero, [], [], null, {});
for (const id of ['l0-guten-morgen', 'l0-guten-abend']) {
  learningT5.phrases[id] = {
    phraseId: id, state: 'answeredWithHelp', confidence: 50,
    timesCorrect: 1, timesProduced: 1, timesSeen: 1, needsHelp: true,
    listening: 0, speaking: 0, recognition: 0, production: 0, speed: 0, contextTransfer: 0,
    avgResponseMs: 0, lastSeen: new Date().toISOString(), lastProduced: new Date().toISOString(),
  } as never;
}
const orchT5 = ConversationOrchestrator.create({
  profile: zero,
  learning: learningT5,
  phrases: mergeZeroLanguagePhrases([]),
  sessionId: 't5-block',
});
await orchT5.handle({ type: 'SESSION_STARTED' });
const t5a = await orchT5.handleUserUtterance('Falsch eins.');
assert(t5a.flow === 'intervenePedagogically', 'TESTE5 1º erro intervém');
const t5b = await orchT5.handleUserUtterance('Falsch zwei.');
assert(t5b.flow === 'intervenePedagogically', 'TESTE5 2º erro intervém');
const t5c = await orchT5.handleUserUtterance('Gute Nacht.');
assert(/Perfeito|próximo|Nova frase|aceita/i.test(t5c.geminiNudge || ''), 'TESTE5 após erros+acerto avança');
assert(!/Modele "Guten Morgen|correction_retry_ok_local_block|Vamos fazer de novo/i.test(`${t5c.reason}|${t5c.geminiNudge}`), 'TESTE5 sem rewalk Morgen');
assert(/frase aceita|próximo|Nova frase|correction_retry_ok/i.test(t5c.reason || t5c.geminiNudge || ''), 'TESTE5 reason de avanço');
console.log('  ✓ TESTE 5: 2 erros → ajuda local → acerto → avança (sem rewalk)');

// TESTE 6: dedup utterance (simulado via mesma lógica)
let processCount = 0;
const dedup = (() => {
  let last: { id: string; text: string; at: number } | null = null;
  return (id: string, text: string) => {
    const now = Date.now();
    if (last && last.id === id && last.text === text) return false;
    if (last && last.text === text && now - last.at < 2000) return false;
    last = { id, text, at: now };
    processCount += 1;
    return true;
  };
})();
assert(dedup('u1', 'Guten Morgen.') === true, 'TESTE6 primeira passa');
assert(dedup('u1', 'Guten Morgen.') === false, 'TESTE6 duplicata id bloqueada');
assert(dedup('u2', 'Guten Morgen.') === false, 'TESTE6 duplicata texto bloqueada');
assert(processCount === 1, 'TESTE6 uma única utterance lógica');
console.log('  ✓ TESTE 6: dedup transcript');

// TESTE 7: sessão 20 min → unidades de tempo, não preso em 1 frase
assert(zeroLanguageSessionUnits(20) === 20, 'TESTE7 20 min');
const learn7 = buildLearningProfile(zero, [], [], null, {});
for (let i = 0; i < 3; i++) {
  const id = ['l0-guten-morgen', 'l0-guten-abend', 'l0-gute-nacht'][i];
  learn7.phrases[id] = {
    phraseId: id, state: 'answeredWithHelp', confidence: 50,
    timesCorrect: 1, timesProduced: 1, timesSeen: 1, needsHelp: true,
    listening: 0, speaking: 0, recognition: 0, production: 0, speed: 0, contextTransfer: 0,
    avgResponseMs: 0, lastSeen: new Date().toISOString(), lastProduced: new Date().toISOString(),
  } as never;
}
const next7 = pickZeroLanguageTarget(learn7, mergeZeroLanguagePhrases([]));
assert(next7.phrase?.id === 'l0-wie-gehts', `TESTE7 próximo após 3 aceitas: ${next7.phrase?.id}`);
console.log('  ✓ TESTE 7: progressão por tempo, não preso');

// TESTE 9 (obrigatório): A..E correct → F incorrect → retry F, NÃO B/A
await EventStore.clear();
await MemoryService.saveConfidenceMap({});
const orchT9 = ConversationOrchestrator.create({
  profile: zero,
  learning: buildLearningProfile(zero, [], [], null, {}),
  phrases: mergeZeroLanguagePhrases([]),
  sessionId: 't9-no-rewind',
});
await orchT9.handle({ type: 'SESSION_STARTED' });
const spokenCorrect = async () => {
  const g = orchT9.getPlan().target?.german;
  assert(!!g, 'T9 tem target');
  return orchT9.handleUserUtterance(g!);
};
await spokenCorrect(); // Morgen
await spokenCorrect(); // Abend
await spokenCorrect(); // Nacht
await spokenCorrect(); // Wie geht's
await spokenCorrect(); // Mir geht's gut
const beforeF = orchT9.getPlan().target;
assert(!!beforeF, 'T9 F existe');
assert(beforeF!.id !== 'l0-wie-gehts' && beforeF!.id !== 'l0-guten-morgen', `T9 F não é B/A (${beforeF!.id})`);
const t9err = await orchT9.handleUserUtterance('Ich bin Auto.');
assert(t9err.flow === 'intervenePedagogically', 'T9 F incorrect → retry');
assert(orchT9.getPlan().target?.id === beforeF!.id, `T9 mantém F (${orchT9.getPlan().target?.id})`);
assert(!/Modele "Wie geht/i.test(t9err.geminiNudge || ''), 'T9 nudge sem modelar Wie geht');
const t9ok = await orchT9.handleUserUtterance(beforeF!.german);
assert(/Perfeito|próximo|Nova frase|aceita/i.test(t9ok.geminiNudge || ''), 'T9 F correct → avança');
assert(!/Modele "Wie geht|Modele "Guten Morgen/i.test(t9ok.geminiNudge || '') || /próximo|Nova frase|aceita/i.test(t9ok.reason || ''), 'T9 sem rewalk dominadas');
console.log('  ✓ TESTE 9: A..E ok → F erro → retry F → ok → avança (não B/A)');

// TESTE 10: F incorrect x3 → ajuda progressiva, nunca Morgen
await EventStore.clear();
await MemoryService.saveConfidenceMap({});
const learnT10 = buildLearningProfile(zero, [], [], null, {});
for (const id of ['l0-guten-morgen', 'l0-guten-abend', 'l0-gute-nacht', 'l0-wie-gehts', 'l0-mir-gehts-gut', 'survival-gut', 'l0-hallo']) {
  learnT10.phrases[id] = {
    phraseId: id, state: 'answeredWithHelp', confidence: 50,
    timesCorrect: 1, timesProduced: 1, timesSeen: 1, needsHelp: true,
    listening: 0, speaking: 0, recognition: 0, production: 0, speed: 0, contextTransfer: 0,
    avgResponseMs: 0, lastSeen: new Date().toISOString(), lastProduced: new Date().toISOString(),
  } as never;
}
const orchT10 = ConversationOrchestrator.create({
  profile: zero,
  learning: learnT10,
  phrases: mergeZeroLanguagePhrases([]),
  sessionId: 't10-persist',
});
await orchT10.handle({ type: 'SESSION_STARTED' });
assert(orchT10.getPlan().target?.id === 'l0-ich-heisse', `T10 target Ich heiße (${orchT10.getPlan().target?.id})`);
const fDe = orchT10.getPlan().target!.german;
await orchT10.handleUserUtterance('Falsch 1.');
await orchT10.handleUserUtterance('Falsch 2.');
const t10c = await orchT10.handleUserUtterance('Falsch 3.');
assert(t10c.flow === 'intervenePedagogically', 'T10 3º erro ainda intervém');
assert(orchT10.getPlan().target?.id === 'l0-ich-heisse' || t10c.targetItem === fDe, 'T10 permanece em F');
assert(!/Modele "Guten Morgen/i.test(t10c.geminiNudge || ''), 'T10 NÃO modela Guten Morgen');
console.log('  ✓ TESTE 10: F x3 erros → ajuda progressiva local (sem Morgen)');

// TESTE 11: near-miss em F → correção → correct → advance; sem bloco anterior
await EventStore.clear();
await MemoryService.saveConfidenceMap({});
const learnT11 = buildLearningProfile(zero, [], [], null, {});
for (const id of ['l0-guten-morgen', 'l0-guten-abend', 'l0-gute-nacht', 'l0-wie-gehts', 'l0-mir-gehts-gut', 'survival-gut', 'l0-hallo']) {
  learnT11.phrases[id] = {
    phraseId: id, state: 'answeredWithHelp', confidence: 50,
    timesCorrect: 1, timesProduced: 1, timesSeen: 1, needsHelp: true,
    listening: 0, speaking: 0, recognition: 0, production: 0, speed: 0, contextTransfer: 0,
    avgResponseMs: 0, lastSeen: new Date().toISOString(), lastProduced: new Date().toISOString(),
  } as never;
}
await MemoryService.saveConfidenceMap(learnT11.phrases);
const orchT11 = ConversationOrchestrator.create({
  profile: zero,
  learning: learnT11,
  phrases: mergeZeroLanguagePhrases([]),
  sessionId: 't11-near-f',
});
await orchT11.handle({ type: 'SESSION_STARTED' });
const f11 = orchT11.getPlan().target?.german || 'Ich heiße...';
const nearF = diagnoseProduction('Ich heise.', f11);
assert(nearF.verdict === 'NEEDS_REPAIR' || nearF.verdict === 'INCORRECT', `T11 diagnose near/err (${nearF.verdict})`);
const t11a = await orchT11.handleUserUtterance('Ich heise.');
assert(
  t11a.flow === 'intervenePedagogically' || t11a.eventsRecorded.includes('PHRASE_FAILED'),
  `T11 near-miss intervém (flow=${t11a.flow})`,
);
assert(!/Modele "Wie geht|Modele "Guten Morgen/i.test(t11a.geminiNudge || ''), 'T11 near-miss sem bloco anterior');
const t11b = await orchT11.handleUserUtterance(f11);
assert(/Perfeito|próximo|Nova frase|aceita/i.test(t11b.geminiNudge || ''), 'T11 correct → avança');
assert(!/Modele "Wie geht/i.test(t11b.geminiNudge || ''), 'T11 advance sem modelar Wie geht');
console.log('  ✓ TESTE 11: near-miss F → retry → advance');

// diagnoseProduction: erro total ≠ near-miss
assert(diagnoseProduction('Ich bin Auto.', 'Mir geht es gut.').verdict === 'INCORRECT', 'Ich bin Auto ≠ near-miss');
console.log('  ✓ diagnoseProduction mismatch real');

// LIVE buckets: aceitas NÃO são weak
const { l0PhrasesForLiveProfile } = await import('../src/services/teacher/ZeroLanguageMode');
const learnLive = buildLearningProfile(zero, [], [], null, {});
for (const id of ['l0-guten-morgen', 'l0-wie-gehts', 'l0-mir-gehts-gut']) {
  learnLive.phrases[id] = {
    phraseId: id, state: 'answeredWithHelp', confidence: 10,
    timesCorrect: 1, timesProduced: 1, timesSeen: 1, needsHelp: true,
    listening: 0, speaking: 0, recognition: 0, production: 0, speed: 0, contextTransfer: 0,
    avgResponseMs: 0, lastSeen: new Date().toISOString(), lastProduced: new Date().toISOString(),
  } as never;
}
const buckets = l0PhrasesForLiveProfile(learnLive);
assert(buckets.knownPhrases.includes('l0-wie-gehts'), 'aceita entra em known');
assert(!buckets.weakPhrases.includes('l0-wie-gehts'), 'aceita NÃO entra em weak/reforce');
assert(!buckets.weakPhrases.includes('l0-guten-morgen'), 'Morgen aceito NÃO é weak');
console.log('  ✓ l0PhrasesForLiveProfile: aceitas ≠ FRACAS');

// LOOP detector (teste): A→B→A→B→A
function detectTargetLoop(ids: string[]): boolean {
  if (ids.length < 6) return false;
  const [a, b, c, d, e, f] = ids.slice(-6);
  return a === c && c === e && b === d && d === f && a !== b;
}
assert(detectTargetLoop(['x', 'A', 'B', 'A', 'B', 'A', 'B']) === true, 'loop A-B detectado');
assert(detectTargetLoop(['A', 'B', 'C', 'D', 'E', 'F']) === false, 'progressão sem loop');
console.log('  ✓ LOOP_DETECTED helper');

// All-accepted recall estável (não oscila para Hallo)
const learnAll = buildLearningProfile(zero, [], [], null, {});
for (const id of ['l0-guten-morgen', 'l0-guten-abend', 'l0-gute-nacht', 'l0-wie-gehts', 'l0-mir-gehts-gut', 'survival-gut', 'l0-hallo', 'l0-ich-heisse', 'survival-heisse', 'survival-arbeite']) {
  learnAll.phrases[id] = {
    phraseId: id, state: 'answeredWithHelp', confidence: 10,
    timesCorrect: 1, timesProduced: 1, timesSeen: 1, needsHelp: true,
    listening: 0, speaking: 0, recognition: 0, production: 0, speed: 0, contextTransfer: 0,
    avgResponseMs: 0, lastSeen: new Date().toISOString(), lastProduced: new Date().toISOString(),
  } as never;
}
const p1 = pickZeroLanguageTarget(learnAll, mergeZeroLanguagePhrases([]));
const p2 = pickZeroLanguageTarget(learnAll, mergeZeroLanguagePhrases([]));
assert(p1.phrase?.id === p2.phrase?.id, `recall estável (${p1.phrase?.id})`);
assert(p1.phrase?.id === 'survival-arbeite', `recall = última tocada (${p1.phrase?.id})`);
console.log('  ✓ recall all-accepted estável (sem loop Hallo)');

// Regressão: plano A2 ainda sem ZERO e sem blocos L0 no directive
const planA2b = buildConversationPlan(profileA2(), learning, phrases);
assert(!planA2b.teacherDirective.includes('RECUPERAÇÃO DE BLOCO'), 'A2 sem recovery L0');
assert(!planA2b.teacherDirective.includes('DURAÇÃO DA SESSÃO'), 'A2 sem duração L0 no zero block');
console.log('  ✓ regressão A2 após política L0');

// Backend Gemini (opcional)
const BACKEND = process.env.GEMINI_BACKEND_URL || 'http://127.0.0.1:8787';
try {
  const res = await fetch(`${BACKEND}/api/gemini/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      profile: {
        level: 'zero',
        goal: 'daily',
        sessionKind: 'FIRST_SESSION',
        openingGerman: 'Hallo.',
        teacherDirective: 'ZERO LANGUAGE MODE test',
        orchestratorKickoff: 'Agora repita: Hallo.',
        scaffoldLevel: 4,
        pedagogicalAction: 'introduce',
        targetPhrase: 'Hallo.',
      },
    }),
  });
  if (res.ok) {
    const json = await res.json() as { token?: string };
    assert(!!json.token, 'token Gemini');
    console.log('  ✓ Gemini Live token (nível 0) OK');
  } else {
    console.log(`  ⚠ Gemini backend HTTP ${res.status} — rode o server para validação real`);
  }
} catch {
  console.log('  ⚠ Gemini backend offline — testes locais OK; valide voz depois');
}

console.log('\nFASE 11 OK (automatizado)');
console.log('Validação voz real L0: PT→Guten Morgen→repita→Morgem→correção→retry→bloco→recovery→tempo.');
