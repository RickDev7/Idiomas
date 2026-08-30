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
  mergeZeroLanguagePhrases,
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
console.log('  ✓ diagnoseProduction / near-miss');

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
console.log('Validação voz real: abrir app com perfil nível 0 → Hallo → Morgem → correção → retry.');
