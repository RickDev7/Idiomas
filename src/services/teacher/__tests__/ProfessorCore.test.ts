/**
 * Testes do Professor Core — conhecimento pedagógico ≠ Learning State.
 */
import { assert } from '@/services/learning/__tests__/assert';
import { emptyConfidence } from '@/services/learning/ConfidenceService';
import { emptyLearningProfile, acceptedConf } from '@/services/learning/RealProgress';
import type { Phrase, UserProfile } from '@/types';
import {
  buildProfessorContext,
  formatProfessorContextForGemini,
  classifyPhraseAvailability,
  grammarExistsIndependentlyOfLearning,
  decideProgression,
  autonomyFromConfidence,
  isMereRepetition,
  MODE_POLICIES,
  filterSituationsByKnownPatterns,
  EVERYDAY_SITUATIONS,
  recordRealCommunicationEvidence,
  clearRealCommunicationEvidenceForTests,
  CHUNK_CATALOG,
} from '@/services/teacher/ProfessorCore';
import { ConversationOrchestrator } from '@/services/teacher/ConversationOrchestrator';
import { buildImmersionSimulatorKickoff, buildImmersionMiniProvaKickoff } from '@/services/teacher/ImmersionPolicy';
import { tryClaimSimulatorKickoff, resetSimulatorKickoffGuard } from '@/services/teacher/SimulatorKickoffGuard';
import { isOpeningDecision, shouldEmitPedagogicalNudge } from '@/services/voice/TeacherTurnSync';
import {
  beginLiveSession,
  invalidateLiveSession,
  isLiveSessionCurrent,
} from '@/services/voice/LiveSessionRegistry';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dir = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dir, '../../../..');

function readSrc(rel: string): string {
  return readFileSync(resolve(root, rel), 'utf8');
}

function mkPhrase(id: string, german: string, category: string): Phrase {
  return {
    id,
    german,
    portuguese: '',
    category,
    mastery: 'recognize',
    reviewStage: 'new',
    nextReview: null,
    timesReviewed: 0,
    timesCorrect: 0,
    timesIncorrect: 0,
    isAutomatic: false,
    contexts: [],
  };
}

function profile(): UserProfile {
  return {
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
}

function learningStudied() {
  const learning = emptyLearningProfile();
  learning.phrases['survival-arbeite'] = acceptedConf('survival-arbeite');
  learning.phrases['l0-hook-ich-moechte'] = acceptedConf('l0-hook-ich-moechte');
  learning.phrases['l0-hook-ich-brauche'] = {
    ...acceptedConf('l0-hook-ich-brauche'),
    confidence: 25,
    needsHelp: true,
  };
  return learning;
}

const phrases: Phrase[] = [
  mkPhrase('survival-arbeite', 'Ich arbeite.', 'work'),
  mkPhrase('l0-hook-ich-moechte', 'Ich möchte…', 'food'),
  mkPhrase('l0-hook-ich-brauche', 'Ich brauche…', 'needs'),
  mkPhrase('never-studied', 'Ich fliege morgen.', 'travel'),
];

export async function testProfessorCore() {
  // 1. contexto válido
  const ctxLesson = buildProfessorContext({
    profile: profile(),
    learning: learningStudied(),
    phrases,
    mode: 'LESSON',
    targetPhraseId: 'survival-arbeite',
  });
  assert(ctxLesson.mode === 'LESSON', '1: modo LESSON');
  assert(!!formatProfessorContextForGemini(ctxLesson), '1: formato Gemini não vazio');
  assert(ctxLesson.knownChunks.some((c) => c.id === 'survival-arbeite'), '1: known inclui estudado');

  // 2. Grammar ≠ Learning State
  assert(grammarExistsIndependentlyOfLearning('g.a1.modal'), '2: regra gramatical existe no Professor Core');
  assert(classifyPhraseAvailability(undefined) === 'NOT_YET_STUDIED', '2: sem confidence = não estudado');

  // 3. não estudado ≠ conhecido
  assert(
    !ctxLesson.knownChunks.some((c) => c.id === 'never-studied'),
    '3: never-studied não aparece como KNOWN',
  );
  assert(classifyPhraseAvailability(emptyConfidence('x')) === 'NOT_YET_STUDIED', '3: empty = NOT_YET');

  // 4. weak points
  assert(ctxLesson.weakChunks.some((c) => c.id === 'l0-hook-ich-brauche'), '4: weak identificado');

  // 5. ProgressionRules
  const progNew = decideProgression(undefined);
  assert(progNew.action === 'INTRODUCE', '5: sem evidência → INTRODUCE');
  const progKnown = decideProgression(acceptedConf('survival-arbeite'));
  assert(['PRACTICE', 'VARY', 'ADVANCE', 'REVIEW', 'TEST'].includes(progKnown.action), '5: conhecido → ação válida');
  const defer = decideProgression(acceptedConf('x'), { persistentErrors: 3 });
  assert(defer.action === 'DEFER', '5: erros persistentes → DEFER');

  // 6–9 políticas por modo
  const sim = buildProfessorContext({
    profile: profile(),
    learning: learningStudied(),
    phrases,
    simulator: true,
  });
  assert(sim.mode === 'SIMULATOR', '6: modo SIMULATOR');
  assert(sim.policy.goal.includes('USAR'), '6: meta conversação');
  assert(!sim.policy.allowPortuguese, '10: PT bloqueado no Simulator');
  assert(!sim.policy.allowTeaching, '6: sem ensino no Simulator');

  const mp = buildProfessorContext({
    profile: profile(),
    learning: learningStudied(),
    phrases,
    miniProva: true,
  });
  assert(mp.mode === 'MINI_PROVA', '7: modo MINI_PROVA');
  assert(mp.policy.goal.includes('SOZINHO'), '7: meta avaliação');
  assert(!mp.policy.allowPortuguese, '11: PT bloqueado na Mini Prova');

  const lesson = MODE_POLICIES.LESSON;
  assert(lesson.allowTeaching && lesson.allowPortuguese, '8: LESSON ensina');
  const review = MODE_POLICIES.REVIEW;
  assert(review.newContentMaxRatio === 0, '9: REVIEW sem conteúdo novo');

  // 12. autonomia ≠ repetição
  assert(isMereRepetition('repeated'), '12: repeated = mera repetição');
  assert(autonomyFromConfidence(acceptedConf('a')) !== 'RECOGNITION', '12: accepted ≠ só recognition');

  // 13. transferência / situações com estruturas conhecidas
  const sits = filterSituationsByKnownPatterns(EVERYDAY_SITUATIONS, ['Ich möchte Wasser.']);
  assert(sits.some((s) => s.domain === 'restaurant'), '13: situação restaurant com Ich möchte');
  assert(
    !filterSituationsByKnownPatterns(EVERYDAY_SITUATIONS, ['xyz']).length ||
      filterSituationsByKnownPatterns(EVERYDAY_SITUATIONS, ['xyz']).every((s) =>
        s.requiredPatterns.every((p) => 'xyz'.includes(p)),
      ) === false,
    '13: sem padrão conhecido → situações filtradas',
  );
  const emptySits = filterSituationsByKnownPatterns(EVERYDAY_SITUATIONS, ['Hallo nur']);
  assert(emptySits.length < EVERYDAY_SITUATIONS.length, '13: filtro reduz situações');

  // 14. conteúdo novo limitado
  assert(sim.contentMix.newRatio <= 0.2, '14: Simulator ≤20% novo');
  assert(sim.contentMix.knownRatio >= 0.8, '14: Simulator ≥80% conhecido');
  assert(mp.contentMix.newRatio === 0, '14: Mini Prova só estudado');

  // 15. anti-loop (defer + kickoff guard)
  resetSimulatorKickoffGuard();
  assert(tryClaimSimulatorKickoff('pc-1', 1), '15a: 1º kickoff');
  assert(!tryClaimSimulatorKickoff('pc-1', 1), '15b: 2º kickoff bloqueado');

  // 16. TeacherTurnSync opening nudge
  const opening = {
    flow: 'continueConversation' as const,
    action: 'converse' as const,
    mode: 'FREE_CONVERSATION' as const,
    reason: 'sessão iniciada com plano TeacherEngine',
    targetItem: 'x',
    geminiNudge: 'n',
    eventsRecorded: [] as never[],
  };
  assert(isOpeningDecision(opening), '16a: opening');
  assert(
    !shouldEmitPedagogicalNudge(opening, {
      liveVoiceActive: true,
      naturalTeacherResponseExpected: true,
      assistantSpeaking: false,
      teacherReceiving: false,
      playerPlaying: false,
    }),
    '16b: nudge bloqueado na abertura',
  );

  // 17. LiveSessionOwnership
  const g1 = beginLiveSession();
  invalidateLiveSession();
  const g2 = beginLiveSession();
  assert(!isLiveSessionCurrent(g1) && isLiveSessionCurrent(g2), '17: só sessão nova ativa');

  // 18–19. kickoff único / imersão
  const kick = buildImmersionSimulatorKickoff({
    settingDe: 'Café',
    roleDe: 'Partner',
    durationMinutes: 10,
    openingGerman: 'Was möchtest du?',
    structures: ['Ich möchte'],
    vocabulary: ['Wasser'],
    conversationHints: ['trinken'],
  });
  assert(kick.includes('TEACHER_TALK_RATIO'), '18: kickoff com talk ratio');
  assert(kick.includes('NUR DEUTSCH'), '10b: kickoff sem PT');
  const mpKick = buildImmersionMiniProvaKickoff({
    questionGerman: 'Was ist das?',
    questionType: 'prod',
    total: 5,
    index: 0,
  });
  assert(mpKick.includes('MINI-PRÜFUNG'), '11b: mini prova kickoff');
  assert(mpKick.includes('NUR DEUTSCH'), '11c: mini prova DE');

  // 20. Learning State fonte da verdade — orchestrator injeta Professor Core sem substituir phrases
  resetSimulatorKickoffGuard();
  const orch = ConversationOrchestrator.create({
    profile: profile(),
    learning: learningStudied(),
    phrases,
  });
  const pc = orch.getProfessorContext();
  assert(!!pc, '20: orchestrator tem Professor Context');
  assert(!!pc && pc.knownChunks.every((c) => !!learningStudied().phrases[c.id]), '20: known vem do Learning State');
  assert(orch.toLiveFields().coachContext?.includes('PROFESSOR CORE') === true, '20: coachContext inclui Professor Core');

  // 21–22. Review / ProgressAggregator intactos (arquivos)
  assert(readSrc('src/services/learning/ReviewEngine.ts').includes('buildReviewQueue'), '21: ReviewEngine intacto');
  assert(readSrc('src/services/learning/RealProgress.ts').includes('computeRealProgress'), '22: RealProgress intacto');

  // REAL_COMMUNICATION
  clearRealCommunicationEvidenceForTests();
  const ev = await recordRealCommunicationEvidence({
    observation: 'Hoje consegui falar com um alemão e ele me entendeu.',
    relatedStructure: 'Ich möchte',
    evidenceConfidence: 'medium',
  });
  assert(ev.doesNotImplyMastery === true, 'RC: não implica mastery');
  assert(CHUNK_CATALOG.length >= 5, 'chunks catalogados');

  // transfer text in format
  const formatted = formatProfessorContextForGemini(sim);
  assert(formatted.includes('Português: BLOQUEADO'), 'format: PT bloqueado simulator');
  assert(formatted.includes('Learning State é a fonte'), 'format: LS fonte da verdade');
}

if (import.meta.url.endsWith('ProfessorCore.test.ts')) {
  try {
    await testProfessorCore();
    console.log('ProfessorCore: todos os testes passaram.');
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}
