/* ConversationOrchestrator — Fase 1+2
   Liga Gemini Live ↔ TeacherEngine ↔ Memory ↔ MicroPractice.
   Gemini conversa; o app decide continuar, intervir ou abrir microtreino. */
import type { Phrase, UserProfile } from '@/types';
import type { UserLearningProfile, PhraseConfidence } from '@/services/learning/ConfidenceService';
import { stateIndex } from '@/services/learning/ConfidenceService';
import {
  pickReviewOpportunity,
  buildReviewGeminiNudge,
  evaluateReviewAttempt,
  mapReviewTypeToAction,
  opportunityFromQueueItem,
  type ReviewOpportunity,
  type ReviewType,
} from '@/services/learning/ReviewEngine';
import {
  MAX_REVIEW_ITEM_ATTEMPTS,
  advanceReviewQueueAfterItem,
  persistReviewSession,
  readReviewSessionSnapshot,
  type ReviewSessionSnapshot,
} from '@/services/learning/ReviewSession';
import { applyHelpPrefToScaffold, UiPrefsService } from '@/services/ui/UiPrefsService';
import { targetFlow } from '@/services/ui/TargetFlowTrace';
import {
  getNextBestLearningAction,
  decideNextBestAction,
  logAutomationDebug,
  readAutomationScore,
  isAutomated,
  type PedagogicalKind,
} from '@/services/learning/AutomationScoreEngine';
import { detectBottleneck, detectBottlenecks } from '@/services/learning/BottleneckDetector';
import {
  geminiAdaptationSnippet,
  loadPersonalLearningProfile,
} from '@/services/learning/PersonalLearningProfile';
import {
  buildTransferVariants,
  buildTransferConversationPrompt,
  buildTransferGeminiNudge,
  decideTransfer,
  isExactRepetition,
  isSuccessfulTransfer,
  pickTransferFromConfidence,
  pickTransferForLive,
  recordTransferAttempt,
  transferEventContext,
  type TransferVariant,
} from '@/services/learning/TransferEngine';
import {
  analyzeSpontaneousUse,
  buildSpontaneousOpportunity,
  buildSpontaneousOpportunityNudge,
  getSpontaneousMemory,
  makeSpontaneousEventId,
  recordConfirmedSpontaneous,
  type SpontaneousOpportunity,
} from '@/services/learning/SpontaneousUseDetector';
import {
  buildConversationCoachContext,
  buildConversationTopicKickoff,
  conversationTopicPlanLabel,
  pickConversationOpening,
  type ConversationTopicContext,
} from '@/services/teacher/ConversationTopics';
import {
  buildSimulatorKickoff,
  buildSimulatorConversationHints,
  pickSimulatorOpening,
  scenarioLabel,
} from '@/services/teacher/SimulatorEngine';
import type { SimulatorContext } from '@/services/teacher/SimulatorTypes';
import { tryClaimSimulatorKickoff } from '@/services/teacher/SimulatorKickoffGuard';
import { isSimulatorActive, recordSimulatorDeferred } from '@/services/teacher/SimulatorSession';
import {
  buildProfessorContext,
  formatProfessorContextForGemini,
} from '@/services/teacher/ProfessorCore';
import {
  buildImmersionMiniProvaKickoff,
  buildMiniProvaDirective,
  buildMiniProvaNextNudge,
  buildSimulatorCoachContext,
  buildSimulatorDirective,
  buildSimulatorHelpNudge,
  buildSimulatorTurnNudge,
} from '@/services/teacher/ImmersionPolicy';
import { evaluateMiniProvaResponse } from '@/services/teacher/MiniProvaEngine';
import {
  getCurrentMiniProvaQuestion,
  persistMiniProvaSnapshot,
  recordMiniProvaAnswer,
  type MiniProvaSnapshot,
} from '@/services/teacher/MiniProvaSession';
import { decideReviewOrConverse, decideSpontaneousOpportunity } from '@/services/teacher/TeacherEngine';
import { EventStore, type LearningEventType } from '@/services/learning/EventStore';
import { MemoryService } from '@/services/learning/MemoryService';
import { ChunkTrackerStore } from '@/services/learning/ChunkTrackerStore';
import { UserMetricsStore } from '@/services/learning/UserMetricsStore';
import {
  planTodaysTraining,
  suggestConversationTopic,
  stageFromElapsed,
  type TrainingStageId,
  type TodaysTraining,
} from '@/services/teacher/TeacherEngine';
import {
  advanceMicroPractice,
  buildMicroResumeNudge,
  buildMicroStartNudge,
  createMicroPractice,
  markMicroReturning,
  shouldStartMicroPractice,
  type MicroPracticeSession,
} from '@/services/teacher/MicroPracticeEngine';
import {
  buildScaffoldHint,
  recordHelpAttempt,
  scaffoldingDirective,
  startingSupportForPhrase,
  escalateSupport,
  type SupportLevel,
} from '@/services/learning/ScaffoldingEngine';
import { ingestUserUtterance } from '@/services/coach/ingestUtterance';
import {
  startPrepareMode,
  applyPostEventLearning,
  dueFollowUpEvent,
  followUpNudge,
  markFollowedUp,
} from '@/services/coach/RealWorldPractice';
import { decideInterruption, briefCorrectionNudge } from '@/services/coach/InvisibleTeaching';
import { selectRelevantCoachContext } from '@/services/coach/MemoryRelevanceEngine';
import { seedFromUserProfile, loadCoachMemory, saveCoachMemory } from '@/services/coach/CoachMemory';
import {
  diagnoseProduction,
  diagnoseAgainstAccepted,
  buildL0TurnEvalSnapshot,
  buildL0AcceptedAnswers,
  findZeroLanguageBlock,
  isZeroLanguageMode,
  mergeZeroLanguagePhrases,
  pickZeroLanguageTarget,
  praiseGuidedRetryNudge,
  shouldRecoverZeroLanguageBlock,
  teachFromErrorNudge,
  deferDifficultyAndContinueNudge,
  zeroLanguageDirective,
  zeroLanguageKickoff,
  zeroLanguageWrapUpNudge,
  isZeroLanguagePhraseAccepted,
  isL0CoreCurriculumComplete,
  isL0GreetingPhraseId,
  l0ConverseExpandNudge,
  l0SubstitutionAdvanceNudge,
  l0ChunkMatureAdvanceNudge,
  l0VariationsForBase,
  l0ChunkBaseForPhraseId,
  l0IsQuestionNodeId,
  isL0ChunkMature,
  l0MasteredSimpleExamples,
  L0_BRIDGE_A1_SPECS,
  L0_MAX_IMMEDIATE_CORRECT_STREAK,
  L0_MAX_CORRECTION_ATTEMPTS,
  type L0PhrasePhase,
  type L0TurnEvalSnapshot,
  type ProductionErrorType,
} from '@/services/teacher/ZeroLanguageMode';
import {
  a1FirstTarget,
  getA1TargetById,
  isA1TargetId,
  isHigherLevelCurriculumBlocked,
  mergeA1CurriculumPhrases,
  pickA1PlannerTarget,
} from '@/services/course/A1Curriculum';
import {
  a2FirstTarget,
  getA2TargetById,
  isA2TargetId,
  mergeA2CurriculumPhrases,
  pickA2PlannerTarget,
} from '@/services/course/A2Curriculum';
import {
  b1FirstTarget,
  getB1TargetById,
  isB1TargetId,
  mergeB1CurriculumPhrases,
  pickB1PlannerTarget,
} from '@/services/course/B1Curriculum';
import {
  b2FirstTarget,
  getB2TargetById,
  isB2TargetId,
  mergeB2CurriculumPhrases,
  pickB2PlannerTarget,
} from '@/services/course/B2Curriculum';
import {
  c1FirstTarget,
  getC1TargetById,
  isC1TargetId,
  mergeC1CurriculumPhrases,
  pickC1PlannerTarget,
} from '@/services/course/C1Curriculum';
import {
  c2FirstTarget,
  getC2TargetById,
  isC2TargetId,
  mergeC2CurriculumPhrases,
  pickC2PlannerTarget,
} from '@/services/course/C2Curriculum';
import {
  maybeGraduateL0ToA1,
  maybeGraduateA1ToA2,
  maybeGraduateA2ToB1,
  maybeGraduateB1ToB2,
  maybeGraduateB2ToC1,
  maybeGraduateC1ToC2,
  maybeGraduateC2ToHigher,
  recordA1TargetSuccess,
  recordA2TargetSuccess,
  recordB1TargetSuccess,
  recordB2TargetSuccess,
  recordC1TargetSuccess,
  recordC2TargetSuccess,
  applyProfileLevelAfterGraduation,
} from '@/services/course/L0ToA1Graduation';
import { getStoredCourseProgress } from '@/services/course/CourseProgressEngine';
import { getCurrentLevel } from '@/services/course/LevelPresentation';
import { StorageService } from '@/services/storage/StorageService';

/** A1 curricular ativo (não L0 zero-mode). */
export function isA1LiveMode(
  profile: Pick<UserProfile, 'level' | 'selfReportedLevel' | 'diagnosticLevel'>,
): boolean {
  if (isZeroLanguageMode(profile)) return false;
  try {
    const course = getStoredCourseProgress();
    const level = getCurrentLevel(profile, course);
    return level === 'A1' || course?.currentLevel === 'A1';
  } catch {
    return profile.level === 'little' || profile.diagnosticLevel === 'A1';
  }
}

/** A2 curricular ativo (exclusivo — nunca L0/A1 como pool curricular). */
export function isA2LiveMode(
  profile: Pick<UserProfile, 'level' | 'selfReportedLevel' | 'diagnosticLevel'>,
): boolean {
  if (isZeroLanguageMode(profile)) return false;
  if (isA1LiveMode(profile)) return false;
  try {
    const course = getStoredCourseProgress();
    const level = getCurrentLevel(profile, course);
    return level === 'A2' || course?.currentLevel === 'A2';
  } catch {
    // Não usar level==='basic' — B1 também é basic no UserProfile.
    return profile.diagnosticLevel === 'A2';
  }
}

/** B1 curricular ativo (exclusivo — nunca L0/A1/A2 como pool curricular). */
export function isB1LiveMode(
  profile: Pick<UserProfile, 'level' | 'selfReportedLevel' | 'diagnosticLevel'>,
): boolean {
  if (isZeroLanguageMode(profile)) return false;
  if (isA1LiveMode(profile) || isA2LiveMode(profile)) return false;
  try {
    const course = getStoredCourseProgress();
    const level = getCurrentLevel(profile, course);
    return level === 'B1' || course?.currentLevel === 'B1';
  } catch {
    return profile.diagnosticLevel === 'B1';
  }
}

/** B2 curricular ativo (exclusivo — nunca L0/A1/A2/B1/C1 como pool curricular). */
export function isB2LiveMode(
  profile: Pick<UserProfile, 'level' | 'selfReportedLevel' | 'diagnosticLevel'>,
): boolean {
  if (isZeroLanguageMode(profile)) return false;
  if (isA1LiveMode(profile) || isA2LiveMode(profile) || isB1LiveMode(profile)) return false;
  try {
    const course = getStoredCourseProgress();
    const level = getCurrentLevel(profile, course);
    if (level === 'C1' || course?.currentLevel === 'C1') return false;
    return level === 'B2' || course?.currentLevel === 'B2';
  } catch {
    return profile.diagnosticLevel === 'B2';
  }
}

/** C1 curricular ativo (exclusivo — nunca L0/A1/A2/B1/B2/C2 como pool curricular). */
export function isC1LiveMode(
  profile: Pick<UserProfile, 'level' | 'selfReportedLevel' | 'diagnosticLevel'>,
): boolean {
  if (isZeroLanguageMode(profile)) return false;
  if (
    isA1LiveMode(profile) ||
    isA2LiveMode(profile) ||
    isB1LiveMode(profile) ||
    isB2LiveMode(profile)
  ) {
    return false;
  }
  try {
    const course = getStoredCourseProgress();
    const level = getCurrentLevel(profile, course);
    if (level === 'C2' || course?.currentLevel === 'C2') return false;
    return level === 'C1' || course?.currentLevel === 'C1';
  } catch {
    return profile.diagnosticLevel === 'C1';
  }
}

/** C2 curricular ativo (exclusivo — nunca L0/A1/A2/B1/B2/C1 como pool curricular). */
export function isC2LiveMode(
  profile: Pick<UserProfile, 'level' | 'selfReportedLevel' | 'diagnosticLevel'>,
): boolean {
  if (isZeroLanguageMode(profile)) return false;
  if (
    isA1LiveMode(profile) ||
    isA2LiveMode(profile) ||
    isB1LiveMode(profile) ||
    isB2LiveMode(profile) ||
    isC1LiveMode(profile)
  ) {
    return false;
  }
  try {
    const course = getStoredCourseProgress();
    const level = getCurrentLevel(profile, course);
    return level === 'C2' || course?.currentLevel === 'C2';
  } catch {
    return profile.diagnosticLevel === 'C2';
  }
}

/**
 * Objetivo pedagógico estruturado enviado ao Gemini a cada turno (A1).
 * Não reenvia system instruction completa — só nudge turn-level.
 */
export function buildA1TurnPedagogicalDirective(input: {
  targetId: string;
  german: string;
  portuguese: string;
  action: OrchestratorAction;
  objective?: string;
  allowedNext?: string;
  verdict?: string;
}): string {
  const objective =
    input.objective ||
    (input.action === 'introduce'
      ? 'EXPOSE_AND_MODEL'
      : input.action === 'practice'
        ? 'GUIDED_PRODUCTION'
        : input.action === 'recall'
          ? 'INDEPENDENT_RECALL'
          : input.action === 'transfer'
            ? 'TRANSFER_CONTEXT'
            : input.action === 'converse'
              ? 'CONTEXTUAL_CONVERSATION'
              : input.action === 'automation'
                ? 'AUTOMATION_CHECK'
                : 'PRODUCE_TARGET');
  const allowed =
    input.allowedNext ||
    (input.action === 'introduce'
      ? 'MODEL → ASK_PRODUCTION → WAIT'
      : input.action === 'practice'
        ? 'CORRECT_OR_SCAFFOLD → RETRY_SAME_TARGET'
        : input.action === 'transfer'
          ? 'ONE_AXIS_CHANGE → ASK_PRODUCTION'
          : input.action === 'converse'
            ? 'USE_TARGET_IN_DIALOGUE → DO_NOT_SWITCH_TO_L0'
            : 'EVALUATE → STAY_ON_TARGET_OR_ADVANCE_A1');
  return [
    '[INSTRUÇÃO INTERNA — não leia isto em voz alta]',
    '=== PEDAGOGICAL TURN (A1) ===',
    `TARGET: ${input.targetId}`,
    `DE: ${input.german}`,
    `PT: ${input.portuguese}`,
    `CURRENT OBJECTIVE: ${objective}`,
    `ALLOWED NEXT ACTION: ${allowed}`,
    input.verdict ? `LAST VERDICT: ${input.verdict}` : '',
    'PROIBIDO: voltar para targets l0-* ou cumprimentos L0.',
    '=== FIM PEDAGOGICAL TURN ===',
  ]
    .filter(Boolean)
    .join('\n');
}

/** Diretiva turn-level A2 — mais produção independente / transfer. */
export function buildA2TurnPedagogicalDirective(input: {
  targetId: string;
  german: string;
  portuguese: string;
  action: OrchestratorAction;
  objective?: string;
  allowedNext?: string;
  verdict?: string;
}): string {
  const objective =
    input.objective ||
    (input.action === 'introduce'
      ? 'EXPOSE_AND_MODEL'
      : input.action === 'practice'
        ? 'GUIDED_THEN_INDEPENDENT_PRODUCTION'
        : input.action === 'recall'
          ? 'INDEPENDENT_RECALL'
          : input.action === 'transfer'
            ? 'TRANSFER_ONE_AXIS'
            : input.action === 'converse'
              ? 'CONTEXTUAL_CONVERSATION_A2'
              : input.action === 'automation'
                ? 'AUTOMATION_CHECK'
                : 'PRODUCE_TARGET_INDEPENDENTLY');
  const allowed =
    input.allowedNext ||
    (input.action === 'introduce'
      ? 'MODEL → ASK_PRODUCTION → WAIT'
      : input.action === 'practice'
        ? 'BRIEF_CORRECTION → RETRY → REDUCE_SCAFFOLD'
        : input.action === 'transfer'
          ? 'ONE_AXIS_CHANGE → ASK_PRODUCTION'
          : input.action === 'converse'
            ? 'USE_TARGET_IN_DIALOGUE → DO_NOT_SWITCH_TO_A1_OR_L0'
            : 'EVALUATE → STAY_ON_A2_OR_ADVANCE');
  return [
    '[INSTRUÇÃO INTERNA — não leia isto em voz alta]',
    '=== PEDAGOGICAL TURN (A2) ===',
    'NÍVEL: A2 — autonomia crescente; menos scaffolding que A1.',
    `TARGET: ${input.targetId}`,
    `DE: ${input.german}`,
    `PT: ${input.portuguese}`,
    `CURRENT OBJECTIVE: ${objective}`,
    `ALLOWED NEXT ACTION: ${allowed}`,
    input.verdict ? `LAST VERDICT: ${input.verdict}` : '',
    'PROIBIDO: voltar para targets l0-* ou a1-* como currículo.',
    'Preferir produção independente após modelo curto.',
    '=== FIM PEDAGOGICAL TURN ===',
  ]
    .filter(Boolean)
    .join('\n');
}

/** Diretiva turn-level B1 — produção independente / justificação / narrativa. */
export function buildB1TurnPedagogicalDirective(input: {
  targetId: string;
  german: string;
  portuguese: string;
  action: OrchestratorAction;
  objective?: string;
  allowedNext?: string;
  verdict?: string;
}): string {
  const objective =
    input.objective ||
    (input.action === 'introduce'
      ? 'EXPOSE_AND_MODEL_BRIEF'
      : input.action === 'practice'
        ? 'INDEPENDENT_PRODUCTION_WITH_LIGHT_SCAFFOLD'
        : input.action === 'recall'
          ? 'INDEPENDENT_RECALL_B1'
          : input.action === 'transfer'
            ? 'TRANSFER_JUSTIFY_OR_NARRATE'
            : input.action === 'converse'
              ? 'CONTEXTUAL_CONVERSATION_B1'
              : input.action === 'automation'
                ? 'AUTOMATION_SPONTANEOUS_CHECK'
                : 'PRODUCE_TARGET_INDEPENDENTLY');
  const allowed =
    input.allowedNext ||
    (input.action === 'introduce'
      ? 'BRIEF_MODEL → ASK_INDEPENDENT_PRODUCTION → WAIT'
      : input.action === 'practice'
        ? 'BRIEF_CORRECTION → RETRY → REDUCE_SCAFFOLD'
        : input.action === 'transfer'
          ? 'ONE_AXIS_CHANGE → ASK_JUSTIFICATION_OR_NARRATION'
          : input.action === 'converse'
            ? 'USE_TARGET_IN_DIALOGUE → DO_NOT_SWITCH_TO_A2_A1_OR_L0'
            : 'EVALUATE → STAY_ON_B1_OR_ADVANCE');
  return [
    '[INSTRUÇÃO INTERNA — não leia isto em voz alta]',
    '=== PEDAGOGICAL TURN (B1) ===',
    'NÍVEL: B1 — exigir mais produção independente; justificativa e narrativa quando couber.',
    `TARGET: ${input.targetId}`,
    `DE: ${input.german}`,
    `PT: ${input.portuguese}`,
    `CURRENT OBJECTIVE: ${objective}`,
    `ALLOWED NEXT ACTION: ${allowed}`,
    input.verdict ? `LAST VERDICT: ${input.verdict}` : '',
    'PROIBIDO: voltar para targets l0-*, a1-* ou a2-* como currículo.',
    'Não abandonar o target para conversa livre sem uso do target.',
    '=== FIM PEDAGOGICAL TURN ===',
  ]
    .filter(Boolean)
    .join('\n');
}

/** Diretiva turn-level B2 — produção independente / argumentação / hipótese. */
export function buildB2TurnPedagogicalDirective(input: {
  targetId: string;
  german: string;
  portuguese: string;
  action: OrchestratorAction;
  objective?: string;
  allowedNext?: string;
  verdict?: string;
}): string {
  const objective =
    input.objective ||
    (input.action === 'introduce'
      ? 'EXPOSE_AND_MODEL_BRIEF'
      : input.action === 'practice'
        ? 'INDEPENDENT_PRODUCTION_WITH_MINIMAL_SCAFFOLD'
        : input.action === 'recall'
          ? 'INDEPENDENT_RECALL_B2'
          : input.action === 'transfer'
            ? 'ARGUE_OR_JUSTIFY'
            : input.action === 'converse'
              ? 'CONTEXTUAL_CONVERSATION_B2'
              : input.action === 'automation'
                ? 'AUTOMATION_SPONTANEOUS_CHECK'
                : 'PRODUCE_TARGET_INDEPENDENTLY');
  const allowed =
    input.allowedNext ||
    (input.action === 'introduce'
      ? 'MODEL → PRODUÇÃO COM AJUDA → PRODUÇÃO INDEPENDENTE → ARGUMENTAÇÃO → CONVERSAÇÃO'
      : input.action === 'practice'
        ? 'BRIEF_CORRECTION → RETRY → MINIMAL_SCAFFOLD → INDEPENDENT'
        : input.action === 'transfer'
          ? 'ONE_AXIS_CHANGE → ASK_ARGUMENT_OR_HYPOTHESIS'
          : input.action === 'converse'
            ? 'USE_TARGET_IN_DIALOGUE → DO_NOT_SWITCH_TO_B1_A2_A1_OR_L0'
            : 'EVALUATE → STAY_ON_B2_OR_ADVANCE');
  return [
    '[INSTRUÇÃO INTERNA — não leia isto em voz alta]',
    '=== PEDAGOGICAL TURN (B2) ===',
    'NÍVEL: B2 — produção independente, argumentação, causa/consequência, opinião, hipótese.',
    `TARGET: ${input.targetId}`,
    `DE: ${input.german}`,
    `PT: ${input.portuguese}`,
    `CURRENT OBJECTIVE: ${objective}`,
    `ALLOWED NEXT ACTION: ${allowed}`,
    input.verdict ? `LAST VERDICT: ${input.verdict}` : '',
    'PROIBIDO: voltar para targets l0-*, a1-*, a2-* ou b1-* como currículo.',
    'Não abandonar o target para conversa livre sem uso do target.',
    '=== FIM PEDAGOGICAL TURN ===',
  ]
    .filter(Boolean)
    .join('\n');
}

/** Diretiva turn-level C1 — produção independente / reformulação / argumentação / nuance. */
export function buildC1TurnPedagogicalDirective(input: {
  targetId: string;
  german: string;
  portuguese: string;
  action: OrchestratorAction;
  objective?: string;
  allowedNext?: string;
  verdict?: string;
}): string {
  const objective =
    input.objective ||
    (input.action === 'introduce'
      ? 'EXPOSE_AND_MODEL_BRIEF'
      : input.action === 'practice'
        ? 'INDEPENDENT_PRODUCTION_WITH_MINIMAL_SCAFFOLD'
        : input.action === 'recall'
          ? 'INDEPENDENT_RECALL_C1'
          : input.action === 'transfer'
            ? 'ARGUE_OR_COUNTER_ARGUE'
            : input.action === 'converse'
              ? 'SPONTANEOUS_DISCOURSE_C1'
              : input.action === 'automation'
                ? 'AUTOMATION_SPONTANEOUS_CHECK'
                : 'PRODUCE_TARGET_INDEPENDENTLY');
  const allowed =
    input.allowedNext ||
    (input.action === 'introduce'
      ? 'MODEL → REFORMULAÇÃO → PRODUÇÃO INDEPENDENTE → ARGUMENTAÇÃO → CONTRA-ARGUMENTAÇÃO → DISCURSO ESPONTÂNEO'
      : input.action === 'practice'
        ? 'BRIEF_CORRECTION → RETRY → MINIMAL_SCAFFOLD → INDEPENDENT'
        : input.action === 'transfer'
          ? 'ONE_AXIS_CHANGE → ASK_ARGUMENT_OR_COUNTER_ARGUMENT'
          : input.action === 'converse'
            ? 'USE_TARGET_IN_DIALOGUE → DO_NOT_SWITCH_TO_B2_B1_A2_A1_OR_L0'
            : 'EVALUATE → STAY_ON_C1_OR_ADVANCE');
  return [
    '[INSTRUÇÃO INTERNA — não leia isto em voz alta]',
    '=== PEDAGOGICAL TURN (C1) ===',
    'NÍVEL: C1 — produção independente, reformulação, argumentação, contra-argumentação, nuance, registro, discurso espontâneo.',
    `TARGET: ${input.targetId}`,
    `DE: ${input.german}`,
    `PT: ${input.portuguese}`,
    `CURRENT OBJECTIVE: ${objective}`,
    `ALLOWED NEXT ACTION: ${allowed}`,
    input.verdict ? `LAST VERDICT: ${input.verdict}` : '',
    'PROIBIDO: voltar para targets l0-*, a1-*, a2-*, b1-* ou b2-* como currículo.',
    'Não abandonar o target para conversa livre sem uso do target.',
    '=== FIM PEDAGOGICAL TURN ===',
  ]
    .filter(Boolean)
    .join('\n');
}

/** Diretiva turn-level C2 — nuance extrema / inferência / persuasão / discurso espontâneo. */
export function buildC2TurnPedagogicalDirective(input: {
  targetId: string;
  german: string;
  portuguese: string;
  action: OrchestratorAction;
  objective?: string;
  allowedNext?: string;
  verdict?: string;
}): string {
  const objective =
    input.objective ||
    (input.action === 'introduce'
      ? 'EXPOSE_AND_MODEL_BRIEF'
      : input.action === 'practice'
        ? 'INDEPENDENT_PRODUCTION_WITH_MINIMAL_SCAFFOLD'
        : input.action === 'recall'
          ? 'INDEPENDENT_RECALL_C2'
          : input.action === 'transfer'
            ? 'PERSUADE_OR_INFER_IMPLICIT'
            : input.action === 'converse'
              ? 'SPONTANEOUS_DISCOURSE_C2'
              : input.action === 'automation'
                ? 'AUTOMATION_SPONTANEOUS_CHECK'
                : 'PRODUCE_TARGET_INDEPENDENTLY');
  const allowed =
    input.allowedNext ||
    (input.action === 'introduce'
      ? 'MODEL → NUANCE → INFERÊNCIA → PERSUASÃO → DISCURSO ESPONTÂNEO'
      : input.action === 'practice'
        ? 'BRIEF_CORRECTION → RETRY → MINIMAL_SCAFFOLD → INDEPENDENT'
        : input.action === 'transfer'
          ? 'ONE_AXIS_CHANGE → ASK_INFERENCE_OR_PERSUASION'
          : input.action === 'converse'
            ? 'USE_TARGET_IN_DIALOGUE → DO_NOT_SWITCH_TO_C1_B2_B1_A2_A1_OR_L0'
            : 'EVALUATE → STAY_ON_C2');
  return [
    '[INSTRUÇÃO INTERNA — não leia isto em voz alta]',
    '=== PEDAGOGICAL TURN (C2) ===',
    'NÍVEL: C2 — nuance extrema, inferência, persuasão, discurso espontâneo.',
    `TARGET: ${input.targetId}`,
    `DE: ${input.german}`,
    `PT: ${input.portuguese}`,
    `CURRENT OBJECTIVE: ${objective}`,
    `ALLOWED NEXT ACTION: ${allowed}`,
    input.verdict ? `LAST VERDICT: ${input.verdict}` : '',
    'PROIBIDO: voltar para targets l0-*, a1-*, a2-*, b1-*, b2-* ou c1-* como currículo.',
    'Não abandonar o target para conversa livre sem uso do target.',
    '=== FIM PEDAGOGICAL TURN ===',
  ]
    .filter(Boolean)
    .join('\n');
}

const SESSION_STATE_KEY = 'deutsch-turbo:orchestrator-session:v1';

export type OrchestratorAction =
  | 'introduce'
  | 'practice'
  | 'recall'
  | 'transfer'
  | 'spontaneous'
  | 'automation'
  | 'review'
  | 'converse';

export type ConversationMode =
  | 'FREE_CONVERSATION'
  | 'GUIDED_CONVERSATION'
  | 'PEDAGOGICAL_INTERVENTION'
  | 'MICRO_PRACTICE';

export type FlowDecision =
  | 'continueConversation'
  | 'intervenePedagogically'
  | 'startMicroPractice'
  | 'resumeConversation';

export type OrchestratorInputEvent =
  | { type: 'SESSION_STARTED'; sessionId?: string }
  | { type: 'SESSION_ENDED'; status?: string }
  | { type: 'USER_UTTERANCE'; text: string }
  | { type: 'TEACHER_UTTERANCE'; text: string }
  | { type: 'HELP_REQUESTED'; text?: string }
  | { type: 'TRANSLATION_REQUESTED' }
  | { type: 'PAUSE' }
  | { type: 'ERROR'; message: string }
  | { type: 'MICRO_ANSWER'; text: string }
  | { type: 'MICRO_SKIP' };

export interface ConversationContext {
  sessionId: string;
  userLevel: string;
  topic: string;
  currentGoal: string;
  targetItem: string | null;
  recentItems: string[];
  weakItems: string[];
  recentMistakes: string[];
  lastTeacherUtterance: string;
  lastUserUtterance: string;
  immersionLevel: number;
  intensiveMode: boolean;
  mode: ConversationMode;
  lastAction: OrchestratorAction;
  turnsSinceIntervention: number;
}

export interface OrchestratorTarget {
  id: string;
  german: string;
  portuguese: string;
  expected: string;
  hint: string;
  transferPrompt?: string;
}

export interface ConversationPlan {
  topic: string;
  training: TodaysTraining;
  stageId: TrainingStageId;
  action: OrchestratorAction;
  target: OrchestratorTarget | null;
  scaffoldLevel: SupportLevel;
  bottleneck: string | null;
  teacherDirective: string;
  actionKickoff: string;
  actionReason?: string;
  previousAction?: OrchestratorAction;
}

export interface GrammarSignal {
  kind: 'possibleGrammarError';
  pattern: string;
  userSaid: string;
  correction: string;
  phraseId: string;
}

export interface OrchestratorDecision {
  flow: FlowDecision;
  action: OrchestratorAction;
  mode: ConversationMode;
  reason: string;
  grammar?: GrammarSignal | null;
  correction?: string;
  targetItem: string | null;
  geminiNudge: string | null;
  eventsRecorded: LearningEventType[];
  microPractice?: MicroPracticeSession | null;
  microFeedback?: string;
}

export interface PersistedOrchestratorState {
  sessionId: string;
  currentTopic: string;
  currentGoal: string;
  targetItem: string | null;
  lastAction: OrchestratorAction;
  mode: ConversationMode;
  recentMistakes: string[];
  updatedAt: string;
  actionReason?: string;
  previousAction?: OrchestratorAction;
  actionHistory?: Array<{ action: string; reason: string; timestamp: string; result?: string }>;
  l0PhrasePhase?: L0PhrasePhase;
}

export interface OrchestratorSnapshot {
  plan: ConversationPlan;
  userTurns: number;
  elapsedMs: number;
}

/** Detecta erros comuns sem NLP completo. */
export function detectPossibleGrammarError(text: string): GrammarSignal | null {
  const t = text.trim();
  if (!t) return null;

  if (/\bich\b/i.test(t) && /\barbeiten\b/i.test(t) && !/\barbeite\b/i.test(t)) {
    const correction = /\bheute\b/i.test(t)
      ? 'Ich arbeite heute.'
      : /\bmorgen\b/i.test(t)
        ? 'Ich arbeite morgen.'
        : 'Ich arbeite.';
    return {
      kind: 'possibleGrammarError',
      pattern: 'ich_arbeiten',
      userSaid: t,
      correction,
      phraseId: 'survival-arbeite',
    };
  }

  if (/\bich\b/i.test(t) && /\bgehen\b/i.test(t) && !/\bgehe\b/i.test(t) && !/\bwird\b/i.test(t)) {
    return {
      kind: 'possibleGrammarError',
      pattern: 'ich_gehen',
      userSaid: t,
      correction: 'Ich gehe.',
      phraseId: 'survival-gehe',
    };
  }

  return null;
}

export type ProductionVerdict = 'CORRECT' | 'INCORRECT' | 'NEEDS_REPAIR' | 'UNKNOWN';

/**
 * Fase 1A — produção só é CORRECT se relacionar-se ao target esperado.
 * Near-miss (ex.: Morgem≈Morgen) → NEEDS_REPAIR (não conta como domínio).
 * Sem target → UNKNOWN (nunca CORRECT por substring solta tipo "ich arbeite").
 */
export function evaluateProduction(text: string, expected?: string | null): ProductionVerdict {
  if (detectPossibleGrammarError(text)) return 'NEEDS_REPAIR';
  if (!expected) return 'UNKNOWN';
  return diagnoseProduction(text, expected).verdict;
}

export function looksLikeCorrectProduction(text: string, expected?: string): boolean {
  return evaluateProduction(text, expected) === 'CORRECT';
}

function mapKind(kind: PedagogicalKind): OrchestratorAction {
  if (kind === 'guided') return 'practice';
  if (kind === 'independent' || kind === 'maintenance') return 'converse';
  return kind;
}

function scaffoldFor(c: PhraseConfidence | undefined, action: OrchestratorAction, phraseId?: string): SupportLevel {
  if (phraseId) {
    return startingSupportForPhrase(phraseId, {
      confidence: c?.confidence,
      isNew: !c || c.state === 'new',
    });
  }
  if (action === 'introduce' || action === 'practice') return 3;
  if (!c) return 2;
  if (c.needsHelp || c.confidence < 40) return 2;
  if (c.confidence < 70) return 1;
  return 0;
}

function resolvePhrase(id: string, phrases: Phrase[]): Phrase | null {
  return phrases.find((p) => p.id === id) || phrases.find((p) => p.german === id) || null;
}

function phraseToTarget(p: Phrase, conf?: PhraseConfidence): OrchestratorTarget {
  const picked = conf ? pickTransferFromConfidence(p, conf) : null;
  const variants = picked ? [picked] : buildTransferVariants(p, conf);
  const v = variants[0];
  return {
    id: p.id,
    german: p.german,
    portuguese: p.portuguese,
    expected: p.german.toLowerCase().split(/\s+/).slice(0, 3).join(' '),
    hint: p.german.split(/\s+/)[0] + '...',
    transferPrompt: v ? buildTransferConversationPrompt(v) : undefined,
  };
}

export function pickPrimaryTarget(
  learning: UserLearningProfile,
  phrases: Phrase[],
): { conf: PhraseConfidence | undefined; phrase: Phrase | null; action: OrchestratorAction } {
  const entries = Object.values(learning.phrases);
  if (entries.length === 0) {
    const survival =
      phrases.find((p) => /pause|hilfe|heiße|arbeite/i.test(p.german)) || phrases[0] || null;
    return { conf: undefined, phrase: survival, action: 'introduce' };
  }

  const candidates = entries
    .filter((c) => c.state !== 'automatic' && !isAutomated(c) && readAutomationScore(c) < 92)
    .sort((a, b) => {
      // Prioridade: AutomationScore baixo primeiro (precisa de prática)
      const aAuto = readAutomationScore(a);
      const bAuto = readAutomationScore(b);
      if (aAuto !== bAuto) return aAuto - bAuto;
      if (a.confidence !== b.confidence) return a.confidence - b.confidence;
      return stateIndex(b.state) - stateIndex(a.state);
    });

  const top = candidates[0];
  if (!top) {
    return { conf: undefined, phrase: phrases[0] || null, action: 'converse' };
  }
  return {
    conf: top,
    phrase: resolvePhrase(top.phraseId, phrases),
    action: mapKind(getNextBestLearningAction(top, { bottleneck: learning.bottleneck })),
  };
}

function actionLabel(action: OrchestratorAction): string {
  const labels: Record<OrchestratorAction, string> = {
    introduce: 'INTRODUCE — ensine a frase em contexto real (não só "repita").',
    practice: 'PRACTICE — correção breve + nova tentativa; depois volte à conversa.',
    recall: 'RECALL — faça o aluno recuperar a frase sem mostrar o modelo primeiro.',
    transfer: 'TRANSFER — mesma ideia em outro contexto, um eixo por vez.',
    spontaneous: 'SPONTANEOUS — situação em que a frase seja útil sem pedir explicitamente.',
    automation: 'AUTOMATION — peça a frase de novo mais tarde, sem ajuda.',
    review: 'REVIEW — revisão ativa em produção (falar).',
    converse: 'CONVERSE — conversa natural; observe uso sem transformar em prova.',
  };
  return labels[action];
}

function buildDirective(
  plan: Omit<ConversationPlan, 'teacherDirective' | 'actionKickoff'>,
  zeroMode = false,
  sessionMinutes?: number,
  a1Mode = false,
  a2Mode = false,
  b1Mode = false,
  b2Mode = false,
  c1Mode = false,
  c2Mode = false,
): string {
  const personal = loadPersonalLearningProfile();
  const adapt = geminiAdaptationSnippet(personal);
  const curricularMode = a1Mode || a2Mode || b1Mode || b2Mode || c1Mode || c2Mode;
  const c2Block =
    c2Mode && plan.target
      ? buildC2TurnPedagogicalDirective({
          targetId: plan.target.id,
          german: plan.target.german,
          portuguese: plan.target.portuguese,
          action: plan.action,
        })
      : c2Mode
        ? '=== C2 MODE — use apenas targets c2-* ==='
        : '';
  const c1Block =
    c1Mode && plan.target
      ? buildC1TurnPedagogicalDirective({
          targetId: plan.target.id,
          german: plan.target.german,
          portuguese: plan.target.portuguese,
          action: plan.action,
        })
      : c1Mode
        ? '=== C1 MODE — use apenas targets c1-* ==='
        : '';
  const b2Block =
    b2Mode && plan.target
      ? buildB2TurnPedagogicalDirective({
          targetId: plan.target.id,
          german: plan.target.german,
          portuguese: plan.target.portuguese,
          action: plan.action,
        })
      : b2Mode
        ? '=== B2 MODE — use apenas targets b2-* ==='
        : '';
  const b1Block =
    b1Mode && plan.target
      ? buildB1TurnPedagogicalDirective({
          targetId: plan.target.id,
          german: plan.target.german,
          portuguese: plan.target.portuguese,
          action: plan.action,
        })
      : b1Mode
        ? '=== B1 MODE — use apenas targets b1-* ==='
        : '';
  const a2Block =
    a2Mode && plan.target
      ? buildA2TurnPedagogicalDirective({
          targetId: plan.target.id,
          german: plan.target.german,
          portuguese: plan.target.portuguese,
          action: plan.action,
        })
      : a2Mode
        ? '=== A2 MODE — use apenas targets a2-* ==='
        : '';
  const a1Block =
    a1Mode && plan.target
      ? buildA1TurnPedagogicalDirective({
          targetId: plan.target.id,
          german: plan.target.german,
          portuguese: plan.target.portuguese,
          action: plan.action,
        })
      : a1Mode
        ? '=== A1 MODE — use apenas targets a1-* ==='
        : '';
  const lines = [
    '=== ORQUESTRAÇÃO DO TEACHERENGINE (obrigatória) ===',
    `AÇÃO ATUAL: ${actionLabel(plan.action)}`,
    `TEMA DA SESSÃO: ${plan.topic}`,
    `ESTÁGIO: ${plan.stageId}`,
    plan.bottleneck ? `GARGALO DETECTADO: ${plan.bottleneck}` : '',
    adapt && !zeroMode && !curricularMode ? `=== ADAPTAÇÃO PESSOAL ===\n${adapt}\n=== FIM ADAPTAÇÃO ===` : '',
    plan.actionReason ? `POR QUÊ: ${plan.actionReason}` : '',
    scaffoldingDirective(plan.scaffoldLevel, plan.target?.german),
    plan.target
      ? `FRASE-ALVO:\n- DE: ${plan.target.german}\n- PT: ${plan.target.portuguese}`
      : 'FRASE-ALVO: nenhuma específica.',
    plan.target?.transferPrompt && plan.action === 'transfer' ? plan.target.transferPrompt : '',
    c2Block,
    c1Block,
    b2Block,
    b1Block,
    a2Block,
    a1Block,
    zeroMode
      ? zeroLanguageDirective({
          targetGerman: plan.target?.german,
          targetPt: plan.target?.portuguese,
          scaffoldLevel: plan.scaffoldLevel,
          action: plan.action,
          sessionMinutes,
        })
      : '',
    'REGRAS:',
    '- Gemini conversa; o app orquestra. Não anuncie testes.',
    '- CORREÇÃO: Quase → explique curto → modele → peça nova tentativa → AGUARDE. NÃO mude de assunto após corrigir.',
    c2Mode ? '- C2: PROIBIDO voltar a targets l0-*, a1-*, a2-*, b1-*, b2-* ou c1-* como currículo.' : '',
    c1Mode ? '- C1: PROIBIDO voltar a targets l0-*, a1-*, a2-*, b1-* ou b2-* como currículo.' : '',
    b2Mode ? '- B2: PROIBIDO voltar a targets l0-*, a1-*, a2-* ou b1-* como currículo.' : '',
    b1Mode ? '- B1: PROIBIDO voltar a targets l0-*, a1-* ou a2-* como currículo.' : '',
    a2Mode ? '- A2: PROIBIDO voltar a targets l0-* ou a1-* como currículo.' : '',
    a1Mode ? '- A1: PROIBIDO voltar a cumprimentos/targets L0 (l0-*).' : '',
    personal.teachingStrategy.correctionStyle === 'brief_explanation' && !zeroMode
      ? '- Correção: breve explicação + forma correta + nova tentativa.'
      : '- Se houver correção pedida pelo app: "Quase! Sag: <forma>. Agora você." Depois avalie a nova tentativa.',
    !zeroMode && !curricularMode && personal.teachingStrategy.preferredActivity === 'speaking'
      ? '- Priorize perguntas que EXIGEM fala do aluno (produção). Evite monólogos longos do professor.'
      : '',
    !zeroMode && !curricularMode && personal.teachingStrategy.preferredActivity === 'listening'
      ? '- Priorize compreensão: diga frases curtas e peça ao aluno para reagir / confirmar o que ouviu.'
      : '',
    !zeroMode && !curricularMode && personal.teachingStrategy.errorFocus
      ? `- Trabalhe naturalmente o padrão: ${personal.teachingStrategy.errorFocus}.`
      : '',
    '- Não interrompa demais. Prefira continuidade.',
    '- Produção logo após o modelo = GUIADA (não declare automação).',
    '=== FIM ORQUESTRAÇÃO ===',
  ];
  return lines.filter(Boolean).join('\n');
}

function buildActionKickoff(
  plan: Omit<ConversationPlan, 'teacherDirective' | 'actionKickoff'>,
  zeroMode = false,
  a1Mode = false,
  a2Mode = false,
  b1Mode = false,
  b2Mode = false,
  c1Mode = false,
  c2Mode = false,
): string {
  const target = plan.target;
  if (zeroMode) {
    if (plan.action === 'converse' || !target) {
      return l0ConverseExpandNudge({
        lastGerman: target?.german || null,
        nextBridgeGerman: L0_BRIDGE_A1_SPECS[0]?.german || 'Wo arbeitest du?',
      });
    }
    return zeroLanguageKickoff({
      targetGerman: target.german,
      targetPt: target.portuguese,
      scaffoldLevel: plan.scaffoldLevel,
      returning: plan.action === 'recall' || plan.action === 'practice',
    });
  }
  if (c2Mode && target) {
    return [
      buildC2TurnPedagogicalDirective({
        targetId: target.id,
        german: target.german,
        portuguese: target.portuguese,
        action: plan.action,
      }),
      `AÇÃO PEDAGÓGICA: ${plan.action.toUpperCase()}.`,
      plan.actionReason ? `Motivo: ${plan.actionReason}` : '',
      scaffoldingDirective(plan.scaffoldLevel, target.german),
      'Comece: contexto breve → modele curto → peça NUANCE / INFERÊNCIA / PERSUASÃO / DISCURSO ESPONTÂNEO (C2) → AGUARDE.',
    ]
      .filter(Boolean)
      .join('\n');
  }
  if (c1Mode && target) {
    return [
      buildC1TurnPedagogicalDirective({
        targetId: target.id,
        german: target.german,
        portuguese: target.portuguese,
        action: plan.action,
      }),
      `AÇÃO PEDAGÓGICA: ${plan.action.toUpperCase()}.`,
      plan.actionReason ? `Motivo: ${plan.actionReason}` : '',
      scaffoldingDirective(plan.scaffoldLevel, target.german),
      'Comece: contexto breve → modele curto → peça PRODUÇÃO INDEPENDENTE / REFORMULAÇÃO / ARGUMENTAÇÃO (C1) → AGUARDE.',
    ]
      .filter(Boolean)
      .join('\n');
  }
  if (b2Mode && target) {
    return [
      buildB2TurnPedagogicalDirective({
        targetId: target.id,
        german: target.german,
        portuguese: target.portuguese,
        action: plan.action,
      }),
      `AÇÃO PEDAGÓGICA: ${plan.action.toUpperCase()}.`,
      plan.actionReason ? `Motivo: ${plan.actionReason}` : '',
      scaffoldingDirective(plan.scaffoldLevel, target.german),
      'Comece: contexto breve → modele curto → peça PRODUÇÃO INDEPENDENTE / ARGUMENTAÇÃO (B2) → AGUARDE.',
    ]
      .filter(Boolean)
      .join('\n');
  }
  if (b1Mode && target) {
    return [
      buildB1TurnPedagogicalDirective({
        targetId: target.id,
        german: target.german,
        portuguese: target.portuguese,
        action: plan.action,
      }),
      `AÇÃO PEDAGÓGICA: ${plan.action.toUpperCase()}.`,
      plan.actionReason ? `Motivo: ${plan.actionReason}` : '',
      scaffoldingDirective(plan.scaffoldLevel, target.german),
      'Comece: contexto breve → modele curto → peça PRODUÇÃO INDEPENDENTE (B1) → AGUARDE.',
    ]
      .filter(Boolean)
      .join('\n');
  }
  if (a2Mode && target) {
    return [
      buildA2TurnPedagogicalDirective({
        targetId: target.id,
        german: target.german,
        portuguese: target.portuguese,
        action: plan.action,
      }),
      `AÇÃO PEDAGÓGICA: ${plan.action.toUpperCase()}.`,
      plan.actionReason ? `Motivo: ${plan.actionReason}` : '',
      scaffoldingDirective(plan.scaffoldLevel, target.german),
      'Comece: contexto curto → modele → peça produção (A2: incentive independência) → AGUARDE.',
    ]
      .filter(Boolean)
      .join('\n');
  }
  if (a1Mode && target) {
    return [
      buildA1TurnPedagogicalDirective({
        targetId: target.id,
        german: target.german,
        portuguese: target.portuguese,
        action: plan.action,
      }),
      `AÇÃO PEDAGÓGICA: ${plan.action.toUpperCase()}.`,
      plan.actionReason ? `Motivo: ${plan.actionReason}` : '',
      scaffoldingDirective(plan.scaffoldLevel, target.german),
      'Comece: contexto curto em PT → modele a frase → peça produção → AGUARDE.',
    ]
      .filter(Boolean)
      .join('\n');
  }
  return [
    '[INSTRUÇÃO INTERNA — não leia isto em voz alta]',
    `AÇÃO PEDAGÓGICA DO TEACHERENGINE: ${plan.action.toUpperCase()}.`,
    plan.actionReason ? `Motivo: ${plan.actionReason}` : '',
    `Tema: ${plan.topic}.`,
    target ? `Frase-alvo: "${target.german}".` : '',
    scaffoldingDirective(plan.scaffoldLevel, target?.german),
  ].filter(Boolean).join('\n');
}

function buildInterventionNudge(grammar: GrammarSignal, action: OrchestratorAction): string {
  return teachFromErrorNudge({
    userSaid: grammar.userSaid,
    correction: grammar.correction,
    errorType: grammar.pattern.includes('arbeit') || grammar.pattern.includes('geh') ? 'conjugation' : 'structure',
    attempt: 1,
    tutorBand: 'L0',
  }) + `\n[ação orquestrada: ${action}]`;
}

export function buildConversationPlan(
  profile: UserProfile,
  learning: UserLearningProfile,
  phrases: Phrase[],
  elapsedMs = 0,
  opts?: { l0BlockReviewPhraseId?: string | null; l0ExcludePhraseId?: string | null; l0SkipPhraseIds?: string[] | null },
): ConversationPlan {
  const zeroMode = isZeroLanguageMode(profile);
  const a1Mode = !zeroMode && isA1LiveMode(profile);
  const a2Mode = !zeroMode && !a1Mode && isA2LiveMode(profile);
  const b1Mode = !zeroMode && !a1Mode && !a2Mode && isB1LiveMode(profile);
  const b2Mode = !zeroMode && !a1Mode && !a2Mode && !b1Mode && isB2LiveMode(profile);
  const c1Mode = !zeroMode && !a1Mode && !a2Mode && !b1Mode && !b2Mode && isC1LiveMode(profile);
  const c2Mode =
    !zeroMode && !a1Mode && !a2Mode && !b1Mode && !b2Mode && !c1Mode && isC2LiveMode(profile);
  const course = getStoredCourseProgress();
  const higherBlocked =
    !zeroMode &&
    !a1Mode &&
    !a2Mode &&
    !b1Mode &&
    !b2Mode &&
    !c1Mode &&
    !c2Mode &&
    !!course &&
    isHigherLevelCurriculumBlocked(course.currentLevel);
  // C2 é o último currículo executável. Níveis desconhecidos reforçam C2.
  const reinforceB2 = false;
  const reinforceC1 = false;
  const reinforceC2 = higherBlocked;

  const phrasePool = zeroMode
    ? mergeZeroLanguagePhrases(phrases)
    : c2Mode || reinforceC2
      ? mergeC2CurriculumPhrases(phrases)
      : c1Mode || reinforceC1
        ? mergeC1CurriculumPhrases(phrases)
        : b2Mode || reinforceB2
          ? mergeB2CurriculumPhrases(phrases)
          : b1Mode
            ? mergeB1CurriculumPhrases(phrases)
            : a2Mode
              ? mergeA2CurriculumPhrases(phrases)
              : a1Mode
                ? mergeA1CurriculumPhrases(phrases)
                : phrases;

  const dueAsPhrases = Object.values(learning.phrases)
    .filter((c): c is NonNullable<typeof c> => !!c && c.state !== 'automatic' && c.confidence > 0 && c.confidence < 85)
    .slice(0, 5)
    .map((c) => resolvePhrase(c.phraseId, phrasePool))
    .filter((p): p is Phrase => !!p);

  const training = planTodaysTraining(profile, dueAsPhrases, learning);
  const topic = zeroMode
    ? (profile.profession ? 'apresentação e sobrevivência no trabalho' : 'primeiras frases')
    : c2Mode || reinforceC2
      ? 'C2 — nuance extrema, inferência e discurso espontâneo'
      : c1Mode || reinforceC1
        ? 'C1 — nuance, argumentação e discurso espontâneo'
        : b2Mode || reinforceB2
          ? 'B2 — argumentação e produção independente'
          : b1Mode
            ? 'B1 — narrativa e justificação'
            : a2Mode
              ? 'A2 — autonomia cotidiana'
              : a1Mode
                ? 'A1 — comunicação cotidiana'
                : (training.topic || suggestConversationTopic(profile));
  const stageIdx = stageFromElapsed(elapsedMs, training);
  const stageId = training.stages[stageIdx]?.id ?? 'conversation';
  const personal = loadPersonalLearningProfile();
  const bottleneckReport = detectBottlenecks(learning);
  const bottleneck = bottleneckReport.primary ?? detectBottleneck(learning);
  const effectiveBottleneck =
    personal.primaryBottleneck && personal.primaryBottleneckConfidence >= 0.5
      ? { type: personal.primaryBottleneck, confidence: personal.primaryBottleneckConfidence }
      : bottleneck;

  const zeroPick = zeroMode
    ? pickZeroLanguageTarget(learning, phrasePool, {
      blockReviewPhraseId: opts?.l0BlockReviewPhraseId,
      excludePhraseId: opts?.l0ExcludePhraseId,
      skipPhraseIds: opts?.l0SkipPhraseIds,
    })
    : null;

  const c2Pick =
    !zeroMode && (c2Mode || reinforceC2)
      ? pickC2PlannerTarget(learning, phrasePool, {
        excludePhraseId: opts?.l0ExcludePhraseId,
        skipPhraseIds: opts?.l0SkipPhraseIds,
      })
      : null;

  const c1Pick =
    !zeroMode && (c1Mode || reinforceC1)
      ? pickC1PlannerTarget(learning, phrasePool, {
        excludePhraseId: opts?.l0ExcludePhraseId,
        skipPhraseIds: opts?.l0SkipPhraseIds,
      })
      : null;

  const b2Pick =
    !zeroMode && (b2Mode || reinforceB2)
      ? pickB2PlannerTarget(learning, phrasePool, {
        excludePhraseId: opts?.l0ExcludePhraseId,
        skipPhraseIds: opts?.l0SkipPhraseIds,
      })
      : null;

  const b1Pick =
    !zeroMode && b1Mode
      ? pickB1PlannerTarget(learning, phrasePool, {
        excludePhraseId: opts?.l0ExcludePhraseId,
        skipPhraseIds: opts?.l0SkipPhraseIds,
      })
      : null;

  const a2Pick =
    !zeroMode && a2Mode
      ? pickA2PlannerTarget(learning, phrasePool, {
        excludePhraseId: opts?.l0ExcludePhraseId,
        skipPhraseIds: opts?.l0SkipPhraseIds,
      })
      : null;

  const a1Pick =
    !zeroMode && a1Mode
      ? pickA1PlannerTarget(learning, phrasePool, {
        excludePhraseId: opts?.l0ExcludePhraseId,
        skipPhraseIds: opts?.l0SkipPhraseIds,
      })
      : null;

  let picked = zeroPick
    ? { conf: zeroPick.conf, phrase: zeroPick.phrase, action: zeroPick.action as OrchestratorAction }
    : c2Pick
      ? { conf: c2Pick.conf, phrase: c2Pick.phrase, action: c2Pick.action as OrchestratorAction }
      : c1Pick
        ? { conf: c1Pick.conf, phrase: c1Pick.phrase, action: c1Pick.action as OrchestratorAction }
        : b2Pick
          ? { conf: b2Pick.conf, phrase: b2Pick.phrase, action: b2Pick.action as OrchestratorAction }
          : b1Pick
            ? { conf: b1Pick.conf, phrase: b1Pick.phrase, action: b1Pick.action as OrchestratorAction }
            : a2Pick
              ? { conf: a2Pick.conf, phrase: a2Pick.phrase, action: a2Pick.action as OrchestratorAction }
              : a1Pick
                ? { conf: a1Pick.conf, phrase: a1Pick.phrase, action: a1Pick.action as OrchestratorAction }
                : pickPrimaryTarget(learning, phrasePool);

  // Invariante C2: nunca escolher l0/a1/a2/b1/b2/c1 como currículo automático
  if ((c2Mode || reinforceC2) && picked.phrase && !isC2TargetId(picked.phrase.id)) {
    const fallback = c2FirstTarget();
    const fp = phrasePool.find((p) => p.id === fallback.id) ?? mergeC2CurriculumPhrases([])[0];
    picked = {
      phrase: fp,
      conf: learning.phrases[fp.id],
      action: 'introduce',
    };
  }

  // Invariante C1: nunca escolher l0/a1/a2/b1/b2 como currículo automático
  if ((c1Mode || reinforceC1) && picked.phrase && !isC1TargetId(picked.phrase.id)) {
    const fallback = c1FirstTarget();
    const fp = phrasePool.find((p) => p.id === fallback.id) ?? mergeC1CurriculumPhrases([])[0];
    picked = {
      phrase: fp,
      conf: learning.phrases[fp.id],
      action: 'introduce',
    };
  }

  // Invariante B2: nunca escolher l0/a1/a2/b1 como currículo automático
  if ((b2Mode || reinforceB2) && picked.phrase && !isB2TargetId(picked.phrase.id)) {
    const fallback = b2FirstTarget();
    const fp = phrasePool.find((p) => p.id === fallback.id) ?? mergeB2CurriculumPhrases([])[0];
    picked = {
      phrase: fp,
      conf: learning.phrases[fp.id],
      action: 'introduce',
    };
  }

  // Invariante B1: nunca escolher l0/a1/a2 como currículo automático
  if (b1Mode && picked.phrase && !isB1TargetId(picked.phrase.id)) {
    const fallback = b1FirstTarget();
    const fp = phrasePool.find((p) => p.id === fallback.id) ?? mergeB1CurriculumPhrases([])[0];
    picked = {
      phrase: fp,
      conf: learning.phrases[fp.id],
      action: 'introduce',
    };
  }

  // Invariante A2: nunca escolher l0/a1 como currículo automático
  if (a2Mode && picked.phrase && !isA2TargetId(picked.phrase.id)) {
    const fallback = a2FirstTarget();
    const fp = phrasePool.find((p) => p.id === fallback.id) ?? mergeA2CurriculumPhrases([])[0];
    picked = {
      phrase: fp,
      conf: learning.phrases[fp.id],
      action: 'introduce',
    };
  }

  // Invariante A1: nunca escolher target L0 como currículo automático
  if (a1Mode && picked.phrase && !isA1TargetId(picked.phrase.id)) {
    const fallback = a1FirstTarget();
    const fp = phrasePool.find((p) => p.id === fallback.id) ?? mergeA1CurriculumPhrases([])[0];
    picked = {
      phrase: fp,
      conf: learning.phrases[fp.id],
      action: 'introduce',
    };
  }

  const sessionMode = decideReviewOrConverse(learning, phrasePool);
  const nba = decideNextBestAction(picked.conf, {
    bottleneck: effectiveBottleneck?.type ?? learning.bottleneck,
    sessionGoal: sessionMode.decision === 'REVIEW' ? 'review' : 'auto',
    dueReview: sessionMode.decision === 'REVIEW',
    reviewType: sessionMode.opportunity?.type,
  });
  const curricularLive =
    a1Mode || a2Mode || b1Mode || b2Mode || reinforceB2 || c1Mode || reinforceC1 || c2Mode || reinforceC2;
  let action = zeroMode
    ? (picked.action as OrchestratorAction)
    : curricularLive
      ? (picked.action as OrchestratorAction)
      : mapKind(nba.action);

  if (!zeroMode && !curricularLive) {
    if (stageId === 'warmup' && action === 'converse') action = 'recall';
    if (stageId === 'new' && picked.conf && stateIndex(picked.conf.state) < stateIndex('answeredAlone')) {
      action = 'introduce';
    }
    if (effectiveBottleneck?.type === 'response_speed' && nba.score < 80) action = 'automation';
    if (effectiveBottleneck?.type === 'retention' && nba.score < 75) action = 'recall';
    // Fase 9 — estratégia muda o comportamento, não só o texto
    if (personal.teachingStrategy.preferredActivity === 'speaking' && (action === 'converse' || action === 'introduce')) {
      action = nba.score < 50 ? 'practice' : 'automation';
    }
    if (personal.teachingStrategy.preferredActivity === 'listening' && action === 'automation') {
      action = 'introduce';
    }
    if (personal.teachingStrategy.preferredActivity === 'review') action = 'recall';
    if (personal.teachingStrategy.preferredActivity === 'transfer' && nba.score < 85) action = 'transfer';
    if (personal.teachingStrategy.errorFocus === 'verb_conjugation' && action === 'converse') {
      action = 'practice';
    }
  } else if (curricularLive) {
    if (nba.action === 'transfer' && picked.conf && (picked.conf.timesCorrect ?? 0) >= 1) {
      action = 'transfer';
    } else if (nba.action === 'independent' || nba.action === 'maintenance') {
      action = 'converse';
    } else if (nba.action === 'automation' && (picked.conf?.timesCorrect ?? 0) >= 2) {
      action = 'automation';
    }
  } else {
    // L0: após currículo aceito, converse/recall espaçado são válidos.
    // NÃO reescrever converse→practice (isso causava loop "fale de novo").
    if (action === 'transfer' || action === 'spontaneous' || action === 'automation') {
      action = picked.phrase
        ? ((picked.conf?.timesCorrect ?? 0) > 0 ? 'practice' : 'introduce')
        : 'converse';
    }
  }

  const target = picked.phrase ? phraseToTarget(picked.phrase, picked.conf) : null;
  let scaffoldLevel = scaffoldFor(picked.conf, action, picked.phrase?.id || picked.conf?.phraseId);
  if (zeroMode && action !== 'converse') {
    scaffoldLevel = Math.max(scaffoldLevel, action === 'introduce' ? 4 : 3) as SupportLevel;
  }
  if (a1Mode && action === 'introduce') {
    scaffoldLevel = Math.max(scaffoldLevel, 3) as SupportLevel;
  }
  if (a2Mode && action === 'introduce') {
    scaffoldLevel = Math.max(scaffoldLevel, 2) as SupportLevel;
  }
  if ((a2Mode) && picked.conf && (picked.conf.timesCorrect ?? 0) >= 2) {
    scaffoldLevel = Math.min(scaffoldLevel, 2) as SupportLevel;
  }
  // B1: scaffold mais baixo — privilégio à produção independente
  if (b1Mode && action === 'introduce') {
    scaffoldLevel = Math.max(scaffoldLevel, 1) as SupportLevel;
  }
  if (b1Mode && picked.conf && (picked.conf.timesCorrect ?? 0) >= 1) {
    scaffoldLevel = Math.min(scaffoldLevel, 1) as SupportLevel;
  }
  // B2: scaffold mínimo — privilégio à produção independente / argumentação
  if ((b2Mode || reinforceB2) && action === 'introduce') {
    scaffoldLevel = Math.max(scaffoldLevel, 1) as SupportLevel;
  }
  if ((b2Mode || reinforceB2) && picked.conf && (picked.conf.timesCorrect ?? 0) >= 1) {
    scaffoldLevel = Math.min(scaffoldLevel, 1) as SupportLevel;
  }
  // C1: scaffold mínimo — produção independente / reformulação / argumentação
  if ((c1Mode || reinforceC1) && action === 'introduce') {
    scaffoldLevel = Math.max(scaffoldLevel, 1) as SupportLevel;
  }
  if ((c1Mode || reinforceC1) && picked.conf && (picked.conf.timesCorrect ?? 0) >= 1) {
    scaffoldLevel = Math.min(scaffoldLevel, 1) as SupportLevel;
  }
  // C2: scaffold mínimo — nuance / inferência / persuasão / discurso espontâneo
  if ((c2Mode || reinforceC2) && action === 'introduce') {
    scaffoldLevel = Math.max(scaffoldLevel, 1) as SupportLevel;
  }
  if ((c2Mode || reinforceC2) && picked.conf && (picked.conf.timesCorrect ?? 0) >= 1) {
    scaffoldLevel = Math.min(scaffoldLevel, 1) as SupportLevel;
  }

  const partial = {
    topic,
    training,
    stageId,
    action,
    target,
    scaffoldLevel,
    bottleneck: effectiveBottleneck?.type ?? null,
    actionReason: [
      zeroMode ? 'ZERO_LANGUAGE_MODE — aquisição guiada' : '',
      c2Mode ? 'C2_CURRICULUM — planner curricular' : '',
      c1Mode ? 'C1_CURRICULUM — planner curricular' : '',
      b2Mode ? 'B2_CURRICULUM — planner curricular' : '',
      b1Mode ? 'B1_CURRICULUM — planner curricular' : '',
      a2Mode ? 'A2_CURRICULUM — planner curricular' : '',
      a1Mode ? 'A1_CURRICULUM — planner curricular' : '',
      reinforceC2 ? 'HIGHER_LEVEL_BLOCKED — reforço C2 (sem currículo superior)' : '',
      reinforceC1 ? 'HIGHER_LEVEL_BLOCKED — reforço C1' : '',
      reinforceB2 ? 'HIGHER_LEVEL_BLOCKED — reforço B2 até currículo C1+' : '',
      zeroMode && zeroPick?.action === 'introduce' && isL0CoreCurriculumComplete(learning)
        ? 'L0_BRIDGE_A1 — conteúdo funcional após currículo inicial'
        : '',
      zeroPick?.action === 'converse' ? 'L0_CURRICULUM_COMPLETE — expandir (sem recycle greetings)' : '',
      nba.reason,
      !zeroMode && !curricularLive && personal.teachingStrategy.reason ? `adaptação: ${personal.teachingStrategy.reason}` : '',
    ]
      .filter(Boolean)
      .join(' | '),
  };
  return {
    ...partial,
    teacherDirective: buildDirective(
      partial,
      zeroMode,
      training.totalMinutes,
      a1Mode,
      a2Mode,
      b1Mode,
      b2Mode || reinforceB2,
      c1Mode || reinforceC1,
      c2Mode || reinforceC2,
    ),
    actionKickoff: buildActionKickoff(
      partial,
      zeroMode,
      a1Mode,
      a2Mode,
      b1Mode,
      b2Mode || reinforceB2,
      c1Mode || reinforceC1,
      c2Mode || reinforceC2,
    ),
  };
}

export function reevaluatePlan(
  previous: ConversationPlan,
  profile: UserProfile,
  learning: UserLearningProfile,
  phrases: Phrase[],
  elapsedMs: number,
  userTurns: number,
  opts?: {
    l0BlockReviewPhraseId?: string | null;
    l0StickPhraseId?: string | null;
    l0ExcludePhraseId?: string | null;
    l0SkipPhraseIds?: string[] | null;
  },
): ConversationPlan {
  const fresh = buildConversationPlan(profile, learning, phrases, elapsedMs, {
    l0BlockReviewPhraseId: opts?.l0BlockReviewPhraseId,
    l0ExcludePhraseId: opts?.l0ExcludePhraseId,
    l0SkipPhraseIds: opts?.l0SkipPhraseIds,
  });
  const zeroMode = isZeroLanguageMode(profile);

  // L0: manter frase atual só durante correção/retry ativo (não por domínio/score)
  if (zeroMode && opts?.l0StickPhraseId && previous.target?.id === opts.l0StickPhraseId) {
    const prevConf = learning.phrases[opts.l0StickPhraseId];
    const action: OrchestratorAction =
      !prevConf || (prevConf.timesCorrect ?? 0) === 0 ? 'introduce' : 'practice';
    const stageIdx = stageFromElapsed(elapsedMs, previous.training);
    const stageId = previous.training.stages[stageIdx]?.id ?? previous.stageId;
    const resolved = resolvePhrase(opts.l0StickPhraseId, phrases);
    const target = resolved ? phraseToTarget(resolved, prevConf) : { ...previous.target! };
    const partial = {
      topic: previous.topic,
      training: previous.training,
      stageId,
      action,
      target,
      scaffoldLevel: Math.max(
        scaffoldFor(prevConf, action, opts.l0StickPhraseId),
        action === 'introduce' ? 4 : 3,
      ) as SupportLevel,
      bottleneck: fresh.bottleneck,
      actionReason: 'ZERO_LANGUAGE_MODE — aguardando retry local',
      previousAction: previous.action,
    };
    return {
      ...partial,
      teacherDirective: buildDirective(partial, true, previous.training.totalMinutes),
      actionKickoff: buildActionKickoff(partial, true),
    };
  }

  const prevConf = previous.target ? learning.phrases[previous.target.id] : undefined;

  const stickTarget = !zeroMode && previous.target && userTurns % 3 !== 0;
  if (stickTarget && previous.target && prevConf) {
    const a1Mode = isA1LiveMode(profile);
    const a2Mode = isA2LiveMode(profile);
    const b1Mode = isB1LiveMode(profile);
    const b2Mode = isB2LiveMode(profile);
    const c1Mode = isC1LiveMode(profile);
    const c2Mode = isC2LiveMode(profile);
    const nba = decideNextBestAction(prevConf, { bottleneck: learning.bottleneck, sessionGoal: 'auto' });
    const action = mapKind(nba.action);
    const stageIdx = stageFromElapsed(elapsedMs, previous.training);
    const stageId = previous.training.stages[stageIdx]?.id ?? previous.stageId;
    const resolved = resolvePhrase(previous.target.id, phrases);
    const target = resolved ? phraseToTarget(resolved, prevConf) : { ...previous.target };
    const partial = {
      topic: previous.topic,
      training: previous.training,
      stageId,
      action,
      target,
      scaffoldLevel: scaffoldFor(prevConf, action, previous.target?.id),
      bottleneck: fresh.bottleneck,
      actionReason: nba.reason,
      previousAction: previous.action,
    };
    return {
      ...partial,
      teacherDirective: buildDirective(
        partial,
        false,
        previous.training.totalMinutes,
        a1Mode,
        a2Mode,
        b1Mode,
        b2Mode,
        c1Mode,
        c2Mode,
      ),
      actionKickoff: buildActionKickoff(partial, false, a1Mode, a2Mode, b1Mode, b2Mode, c1Mode, c2Mode),
    };
  }
  return fresh;
}

export function createOrchestratorState(plan: ConversationPlan): OrchestratorSnapshot {
  return { plan, userTurns: 0, elapsedMs: 0 };
}

export function loadPersistedOrchestratorState(): PersistedOrchestratorState | null {
  try {
    const raw = localStorage.getItem(SESSION_STATE_KEY);
    return raw ? (JSON.parse(raw) as PersistedOrchestratorState) : null;
  } catch {
    return null;
  }
}

export function savePersistedOrchestratorState(state: PersistedOrchestratorState): void {
  try {
    localStorage.setItem(SESSION_STATE_KEY, JSON.stringify(state));
  } catch { /* ignore */ }
}

export function clearPersistedOrchestratorState(): void {
  try {
    localStorage.removeItem(SESSION_STATE_KEY);
  } catch { /* ignore */ }
}

async function saveLearningEvent(
  type: LearningEventType,
  extra: { phraseId?: string; context?: string; helpLevel?: number } = {},
): Promise<void> {
  await EventStore.record({ type, ...extra });
}

export interface OrchestratorDeps {
  profile: UserProfile;
  learning: UserLearningProfile;
  phrases: Phrase[];
  sessionId?: string;
  reviewIntent?: { phraseId?: string; reviewType?: ReviewType };
  reviewSessionSnapshot?: ReviewSessionSnapshot | null;
  conversationIntent?: ConversationTopicContext;
  simulatorIntent?: SimulatorContext;
  miniProvaSnapshot?: MiniProvaSnapshot | null;
  /** Geração LiveSession — idempotência do kickoff do simulador. */
  liveSessionGeneration?: number;
  /** Home / estrutura: frase-alvo só na inicialização desta sessão. */
  startPhraseId?: string;
}

/** Seleção explícita da Home/Chunks não pôde ser aplicada — sem fallback para currículo. */
export class SelectedStartTargetError extends Error {
  readonly startPhraseId: string;
  readonly planTargetId: string | null;

  constructor(startPhraseId: string, planTargetId: string | null, message?: string) {
    super(
      message
        || `SELECTED_START_TARGET_FAILED: requested=${startPhraseId} plan=${planTargetId ?? 'null'}`,
    );
    this.name = 'SelectedStartTargetError';
    this.startPhraseId = startPhraseId;
    this.planTargetId = planTargetId;
  }
}

/** True se o plano efetivamente usa o id solicitado (ou base L0 equivalente). */
export function selectedStartIdsMatch(requestedRaw: string, planTargetId: string | null | undefined): boolean {
  if (!planTargetId) return false;
  let requested = requestedRaw.trim();
  if (!requested) return false;
  try {
    requested = decodeURIComponent(requested).trim();
  } catch {
    /* already decoded */
  }
  if (requested === planTargetId) return true;
  const baseReq = l0ChunkBaseForPhraseId(requested);
  const basePlan = l0ChunkBaseForPhraseId(planTargetId);
  if (baseReq && baseReq === planTargetId) return true;
  if (basePlan && basePlan === requested) return true;
  if (baseReq && basePlan && baseReq === basePlan) return true;
  return false;
}

export class ConversationOrchestrator {
  readonly sessionId: string;
  private profile: UserProfile;
  private learning: UserLearningProfile;
  private phrases: Phrase[];
  private plan: ConversationPlan;
  private ctx: ConversationContext;
  private userTurns = 0;
  private startedAt = Date.now();
  private micro: MicroPracticeSession | null = null;
  private turnsSinceLastMicro = 99;
  /** Ajuda atual na sessão (fade por tentativa). */
  private sessionSupport: SupportLevel = 2;
  private pendingTransfer: TransferVariant | null = null;
  private sessionTransfers = 0;
  private turnsSinceLastTransfer = 99;
  private transferAttempts = 0;
  private justErrored = false;
  private spontaneousOpportunity: SpontaneousOpportunity | null = null;
  private sessionSpontaneousOpps = 0;
  private turnsSinceSpontaneousOpp = 99;
  private recentTeacherRequests: string[] = [];
  private lastSpontaneousEventId: string | null = null;
  private actionHistory: Array<{ action: string; reason: string; timestamp: string; result?: string }> = [];
  /** Ajuda pedida/exibida neste turno (não confundir com scaffold disponível). */
  private helpUsedThisTurn = false;
  private pendingReview: ReviewOpportunity | null = null;
  private sessionReviewed = new Set<string>();
  private reviewSession = false;
  private reviewQueueSnapshot: ReviewSessionSnapshot | null = null;
  private interruptionsLast10 = 0;
  private briefCorrectionsLast10 = 0;
  private microStartsLast10 = 0;
  private coachContextText = '';
  private professorContextCache: import('@/services/teacher/ProfessorCore').ProfessorContext | null = null;
  private simulatorMode = false;
  private simulatorContext: SimulatorContext | null = null;
  private simulatorKickoffSuppressed = false;
  private simulatorTurnIndex = 0;
  private simulatorConversationHints: string[] = [];
  private miniProvaSnapshot: MiniProvaSnapshot | null = null;
  private miniProvaMode = false;
  /** Home/Chunks: startPhraseId aplicado com sucesso neste create(). */
  private selectedStartApplied = false;
  private requestedStartPhraseId: string | null = null;
  private followUpEventId: string | undefined;
  private followUpOpening: string | undefined;
  /** Ciclo correção: aguarda nova tentativa após modelo (Fase 11 §§26–28). */
  private pendingCorrectionRetry: {
    phraseId: string;
    expected: string;
    attempt: number;
    userSaid: string;
    errorType: ProductionErrorType;
    hardPart?: string;
  } | null = null;
  /** L0: após corrigir erro relevante, recuperar o bloco atual (não a sessão inteira). */
  private pendingBlockRecovery: {
    phraseId: string;
    failedGerman: string;
  } | null = null;
  /** L0: erros reais acumulados por bloco (diagnóstico; recovery de bloco desativado na prática). */
  private l0BlockErrors: Record<string, number> = {};
  /** L0: frase que dispara BLOCK_REVIEW local (null = progressão normal). */
  private l0BlockReviewPhraseId: string | null = null;
  /** L0: fase explícita do ciclo pedagógico. */
  private l0PhrasePhase: L0PhrasePhase = 'INTRODUCE';
  /** L0: revisões do target — detecta sobrescrita / regressão em logs. */
  private l0TargetRevision = 0;
  private wrapUpSent = false;
  /** L0: snapshot imutável do alvo no momento em que o professor pediu a resposta. */
  private l0TurnEvalSnapshot: L0TurnEvalSnapshot | null = null;
  private l0PreviousTargetId: string | null = null;
  private l0PreviousTargetText: string | null = null;
  private l0LastEvalUtteranceKey: string | null = null;
  private l0EvalSeq = 0;
  /** Frase aceita mais recente — exclusão de recall imediato. */
  private l0JustAcceptedId: string | null = null;
  /** Acertos seguidos no mesmo target sem erro (anti TARGET_STUCK). */
  private l0CorrectStreakOnTarget = 0;
  private l0CorrectStreakTargetId: string | null = null;
  /** Frases difíceis postergadas nesta sessão (revisão futura, não monopolizam agora). */
  private l0DeferredPhraseIds: string[] = [];
  /** Cobertura da sessão (diagnóstico). */
  private l0UniqueTargetsIntroduced = new Set<string>();
  private l0DeferredReviewCount = 0;

  private logL0(phase: string, extra?: Record<string, unknown>) {
    if (!isZeroLanguageMode(this.profile)) return;
    const dev =
      typeof import.meta !== 'undefined' && !!(import.meta as { env?: { DEV?: boolean } }).env?.DEV;
    if (!dev && typeof localStorage !== 'undefined' && localStorage.getItem('L0_DEBUG') !== '1') return;
    const block = this.plan.target?.id ? findZeroLanguageBlock(this.plan.target.id) : null;
    console.log('[L0_STATE]', {
      phase,
      sessionId: this.sessionId,
      targetId: this.plan.target?.id ?? null,
      targetText: this.plan.target?.german ?? null,
      currentBlockId: block?.id ?? null,
      l0PhrasePhase: this.l0PhrasePhase,
      l0TargetRevision: this.l0TargetRevision,
      pendingRetry: !!this.pendingCorrectionRetry,
      pendingBlockRecovery: !!this.pendingBlockRecovery,
      ...extra,
    });
  }

  /** Log obrigatório por interação L0 — sequência independente do conteúdo escolhido pelo professor. */
  private logL0Turn(opts: {
    teacherUtterance: string;
    targetAtQuestionTime: string | null;
    userUtterance: string;
    evaluatedTarget: string | null;
    result: 'CORRECT' | 'NEAR_MISS' | 'INCORRECT' | 'UNKNOWN';
    nextTarget: string | null;
    decisionReason: string;
  }) {
    if (!isZeroLanguageMode(this.profile)) return;
    const dev =
      typeof import.meta !== 'undefined' && !!(import.meta as { env?: { DEV?: boolean } }).env?.DEV;
    if (!dev && typeof localStorage !== 'undefined' && localStorage.getItem('L0_DEBUG') !== '1') return;
    console.log('[L0_TURN]', {
      teacherUtterance: opts.teacherUtterance.slice(0, 200),
      targetAtQuestionTime: opts.targetAtQuestionTime,
      userUtterance: opts.userUtterance.slice(0, 200),
      evaluatedTarget: opts.evaluatedTarget,
      result: opts.result,
      nextTarget: opts.nextTarget,
      decisionReason: opts.decisionReason,
    });
  }

  private constructor(deps: OrchestratorDeps, plan: ConversationPlan, ctx: ConversationContext) {
    this.profile = deps.profile;
    this.learning = deps.learning;
    this.phrases = deps.phrases;
    this.sessionId = ctx.sessionId;
    this.plan = plan;
    this.ctx = ctx;
  }

  static create(deps: OrchestratorDeps): ConversationOrchestrator {
    const phrases = isZeroLanguageMode(deps.profile)
      ? mergeZeroLanguagePhrases(deps.phrases)
      : isC2LiveMode(deps.profile)
        ? mergeC2CurriculumPhrases(deps.phrases)
        : isC1LiveMode(deps.profile)
          ? mergeC1CurriculumPhrases(deps.phrases)
          : isB2LiveMode(deps.profile)
            ? mergeB2CurriculumPhrases(deps.phrases)
            : isB1LiveMode(deps.profile)
              ? mergeB1CurriculumPhrases(deps.phrases)
              : isA2LiveMode(deps.profile)
                ? mergeA2CurriculumPhrases(deps.phrases)
                : isA1LiveMode(deps.profile)
                  ? mergeA1CurriculumPhrases(deps.phrases)
                  : deps.phrases;
    const merged = { ...deps, phrases };
    const plan = buildConversationPlan(merged.profile, merged.learning, phrases, 0);
    const sessionId = merged.sessionId || `live-${Date.now()}`;
    const weak = Object.values(merged.learning.phrases)
      .filter((c) => c.confidence > 0 && c.confidence < 40)
      .map((c) => c.phraseId)
      .slice(0, 6);
    const ctx: ConversationContext = {
      sessionId,
      userLevel: merged.profile.level,
      topic: plan.topic,
      currentGoal: plan.action,
      targetItem: plan.target?.german ?? null,
      recentItems: [],
      weakItems: weak,
      recentMistakes: [],
      lastTeacherUtterance: '',
      lastUserUtterance: '',
      immersionLevel: merged.profile.germanPercentage ?? 50,
      intensiveMode: !!merged.profile.turboMode,
      mode: plan.action === 'introduce' || plan.action === 'practice' ? 'GUIDED_CONVERSATION' : 'FREE_CONVERSATION',
      lastAction: plan.action,
      turnsSinceIntervention: 99,
    };
    const orch = new ConversationOrchestrator(merged, plan, ctx);
    const helpPref = UiPrefsService.get().helpLevel;
    orch.sessionSupport = applyHelpPrefToScaffold(plan.scaffoldLevel, helpPref) as SupportLevel;
    if (orch.sessionSupport !== plan.scaffoldLevel) {
      orch.plan = { ...orch.plan, scaffoldLevel: orch.sessionSupport };
    }
    if (merged.reviewIntent || merged.reviewSessionSnapshot) {
      orch.reviewSession = true;
      const snapshot = merged.reviewSessionSnapshot
        ?? (merged.reviewIntent ? readReviewSessionSnapshot() : null);
      if (snapshot && snapshot.items.length > 0 && !snapshot.completed) {
        orch.reviewQueueSnapshot = snapshot;
        orch.applyReviewQueueItem(snapshot.currentIndex);
      } else if (merged.reviewIntent?.phraseId) {
        const opp = pickReviewOpportunity(merged.learning.phrases, phrases, {
          profile: merged.profile,
          phraseId: merged.reviewIntent.phraseId,
          forcedType: merged.reviewIntent.reviewType,
        });
        if (opp) {
          orch.applyReviewOpportunity(opp);
        }
      }
    } else if (merged.miniProvaSnapshot && merged.miniProvaSnapshot.questions.length > 0) {
      orch.miniProvaMode = true;
      orch.miniProvaSnapshot = merged.miniProvaSnapshot;
      orch.applyMiniProvaQuestion(0);
    } else if (merged.simulatorIntent) {
      orch.applySimulatorIntent(merged.simulatorIntent, merged.liveSessionGeneration ?? 0);
    } else if (merged.startPhraseId) {
      orch.requestedStartPhraseId = merged.startPhraseId.trim();
      let ok = orch.applySelectedStartTarget(merged.startPhraseId);
      if (!ok || !selectedStartIdsMatch(merged.startPhraseId, orch.getPlan().target?.id)) {
        targetFlow('APPLY_SELECTED_START', {
          startPhraseId: merged.startPhraseId,
          planTarget: orch.getPlan().target?.german ?? null,
          planTargetId: orch.getPlan().target?.id ?? null,
          note: 'primeira tentativa falhou — reaplicando uma vez',
        });
        ok = orch.applySelectedStartTarget(merged.startPhraseId);
      }
      const planId = orch.getPlan().target?.id ?? null;
      const invariantOk = ok && selectedStartIdsMatch(merged.startPhraseId, planId);
      targetFlow('APPLY_SELECTED_START', {
        startPhraseId: merged.startPhraseId,
        planTarget: orch.getPlan().target?.german ?? null,
        planTargetId: planId,
        actionReason: orch.getPlan().actionReason ?? null,
        selectedStart: invariantOk,
        note: invariantOk
          ? 'applySelectedStartTarget OK — invariante plan.target.id ≡ startPhraseId'
          : 'SELECTED_START_INVARIANT_FAILED — sem fallback para currículo',
      });
      if (!invariantOk) {
        orch.selectedStartApplied = false;
        throw new SelectedStartTargetError(merged.startPhraseId, planId);
      }
      orch.selectedStartApplied = true;
    } else if (merged.conversationIntent) {
      orch.applyConversationTopicIntent(merged.conversationIntent);
    }
    orch.persist();
    try {
      saveCoachMemory(seedFromUserProfile(loadCoachMemory(), deps.profile));
      const rel = selectRelevantCoachContext({ user: deps.profile, topic: orch.plan.topic });
      if (merged.conversationIntent || merged.simulatorIntent) {
        orch.coachContextText = [
          orch.coachContextText,
          rel.text,
        ].filter(Boolean).join('\n\n');
      } else {
        orch.coachContextText = rel.text;
      }
      orch.followUpOpening = rel.followUpOpening;
      orch.followUpEventId = rel.followUpEventId;
    } catch { /* coach memory opcional */ }

    try {
      const professorCtx = buildProfessorContext({
        profile: merged.profile,
        learning: merged.learning,
        phrases,
        simulator: !!merged.simulatorIntent || orch.simulatorMode,
        miniProva: !!merged.miniProvaSnapshot || orch.miniProvaMode,
        review: !!merged.reviewIntent || !!merged.reviewSessionSnapshot || orch.reviewSession,
        conversation: !!merged.conversationIntent,
        targetPhraseId: orch.plan.target?.id ?? null,
        recentErrors: orch.ctx.recentMistakes,
        helpLevelAllowed: orch.sessionSupport,
        dueReview: !!merged.reviewIntent || !!merged.reviewSessionSnapshot,
        curriculumBand: isC2LiveMode(merged.profile)
          ? 'C2'
          : isC1LiveMode(merged.profile)
            ? 'C1'
            : isB2LiveMode(merged.profile)
              ? 'B2'
              : isB1LiveMode(merged.profile)
                ? 'B1'
                : isA2LiveMode(merged.profile)
                  ? 'A2'
                  : isA1LiveMode(merged.profile)
                    ? 'A1'
                    : isZeroLanguageMode(merged.profile)
                      ? 'L0'
                      : null,
      });
      const professorBlock = formatProfessorContextForGemini(professorCtx, 900);
      orch.coachContextText = [orch.coachContextText, professorBlock].filter(Boolean).join('\n\n');
      orch.professorContextCache = professorCtx;
    } catch { /* Professor Core opcional — não quebra sessão */ }

    return orch;
  }

  getProfessorContext(): import('@/services/teacher/ProfessorCore').ProfessorContext | null {
    return this.professorContextCache;
  }

  /** Rótulo do tutor no nudge de correção — NÃO forçar L0 em sessão A1. */
  private tutorBandLabel(): string {
    if (isZeroLanguageMode(this.profile)) return 'L0';
    if (isC2LiveMode(this.profile)) return 'C2';
    if (isC1LiveMode(this.profile)) return 'C1';
    if (isB2LiveMode(this.profile)) return 'B2';
    if (isB1LiveMode(this.profile)) return 'B1';
    if (isA2LiveMode(this.profile)) return 'A2';
    if (isA1LiveMode(this.profile)) return 'A1';
    try {
      const course = getStoredCourseProgress();
      const lvl = getCurrentLevel(this.profile, course);
      return lvl === 'L0' ? 'L0' : lvl;
    } catch {
      return 'A1';
    }
  }

  getContext(): ConversationContext {
    return { ...this.ctx };
  }

  getReviewSessionSnapshot(): ReviewSessionSnapshot | null {
    return this.reviewQueueSnapshot ? { ...this.reviewQueueSnapshot, items: [...this.reviewQueueSnapshot.items], results: [...this.reviewQueueSnapshot.results] } : null;
  }

  private applyReviewOpportunity(opp: ReviewOpportunity) {
    this.pendingReview = opp;
    const action = mapReviewTypeToAction(opp.type);
    this.plan = {
      ...this.plan,
      action,
      actionReason: opp.reason,
      target: {
        id: opp.itemId,
        german: opp.german,
        portuguese: opp.portuguese,
        expected: opp.expected.toLowerCase(),
        hint: opp.prompt,
      },
    };
    this.ctx.targetItem = opp.german;
    this.ctx.lastAction = action;
    this.ctx.currentGoal = 'review';
    this.ctx.mode = opp.type === 'GUIDED_SPEAKING_REVIEW' ? 'GUIDED_CONVERSATION' : 'FREE_CONVERSATION';
  }

  private applyReviewQueueItem(index: number): boolean {
    if (!this.reviewQueueSnapshot) return false;
    const item = this.reviewQueueSnapshot.items[index];
    if (!item) return false;
    const opp = opportunityFromQueueItem(item, this.learning.phrases, this.phrases, {
      profile: this.profile,
    });
    if (!opp) return false;
    this.reviewQueueSnapshot.currentIndex = index;
    this.reviewQueueSnapshot.itemAttempts = 0;
    persistReviewSession(this.reviewQueueSnapshot);
    this.applyReviewOpportunity(opp);
    return true;
  }

  /** Simulador — produção real em cenário baseado no aprendizado. */
  applySimulatorIntent(intent: SimulatorContext, liveSessionGeneration = 0): boolean {
    const claimed = tryClaimSimulatorKickoff(intent.id, liveSessionGeneration);
    this.simulatorKickoffSuppressed = !claimed;
    this.simulatorMode = true;
    this.simulatorContext = intent;
    this.simulatorTurnIndex = 0;
    this.simulatorConversationHints = buildSimulatorConversationHints(intent);
    const opening = pickSimulatorOpening(intent);
    const topicDe = scenarioLabel(intent, true);

    this.ctx.topic = topicDe;
    this.ctx.mode = 'FREE_CONVERSATION';
    this.ctx.currentGoal = 'converse';
    this.ctx.lastAction = 'converse';
    this.plan = {
      ...this.plan,
      action: 'converse',
      actionReason: `simulator:${intent.simulatorMode}`,
      topic: topicDe,
      stageId: 'conversation',
      training: {
        ...this.plan.training,
        totalMinutes: intent.durationMinutes,
        stages: [],
      },
      target: {
        id: intent.baseId || 'simulator',
        german: opening,
        portuguese: '',
        expected: opening.toLowerCase(),
        hint: '',
      },
      actionKickoff: buildSimulatorKickoff(intent, opening),
    };
    this.plan.teacherDirective = buildSimulatorDirective(intent);
    this.coachContextText = buildSimulatorCoachContext(intent, this.simulatorConversationHints);
    this.ctx.targetItem = opening;
    return claimed;
  }

  wasSimulatorKickoffClaimed(): boolean {
    return this.simulatorMode && !this.simulatorKickoffSuppressed;
  }

  isSimulatorMode(): boolean {
    return this.simulatorMode;
  }

  isMiniProvaMode(): boolean {
    return this.miniProvaMode;
  }

  getMiniProvaSnapshot(): MiniProvaSnapshot | null {
    return this.miniProvaSnapshot ? { ...this.miniProvaSnapshot } : null;
  }

  private applyMiniProvaQuestion(index: number): boolean {
    if (!this.miniProvaSnapshot) return false;
    const q = this.miniProvaSnapshot.questions[index];
    if (!q) return false;
    this.miniProvaSnapshot.currentIndex = index;
    persistMiniProvaSnapshot(this.miniProvaSnapshot);
    this.ctx.topic = 'Mini-Prüfung';
    this.ctx.mode = 'FREE_CONVERSATION';
    this.ctx.currentGoal = 'converse';
    this.ctx.lastAction = 'converse';
    this.plan = {
      ...this.plan,
      action: 'converse',
      actionReason: `miniprova:${q.type}`,
      topic: 'Mini-Prüfung',
      stageId: 'conversation',
      target: {
        id: q.phraseId,
        german: q.german,
        portuguese: '',
        expected: q.german.toLowerCase(),
        hint: '',
      },
      actionKickoff: buildImmersionMiniProvaKickoff({
        questionGerman: q.promptDe,
        questionType: q.type,
        total: this.miniProvaSnapshot.total,
        index,
      }),
    };
    this.plan.teacherDirective = buildMiniProvaDirective(this.miniProvaSnapshot.total);
    this.coachContextText = '';
    this.ctx.targetItem = q.promptDe;
    return true;
  }

  private async onMiniProvaAttempt(text: string): Promise<OrchestratorDecision> {
    if (!this.miniProvaSnapshot) return this.continueResult('miniprova_sem_snapshot');
    const q = getCurrentMiniProvaQuestion(this.miniProvaSnapshot);
    if (!q) return this.continueResult('miniprova_complete');
    this.userTurns += 1;
    const usedHelp = this.helpUsedThisTurn;
    this.helpUsedThisTurn = false;
    const autonomy = evaluateMiniProvaResponse(text, q, {
      usedHelp,
      attempt: 1,
    });
    const correct = autonomy !== 'incorrect' && autonomy !== 'no_response';
    const eventsRecorded: LearningEventType[] = ['USER_UTTERANCE'];

    await saveLearningEvent(correct ? 'PHRASE_PRODUCED' : 'PHRASE_FAILED', {
      phraseId: q.phraseId,
      context: text,
      helpLevel: usedHelp ? this.sessionSupport : 0,
    });
    eventsRecorded.push(correct ? 'PHRASE_PRODUCED' : 'PHRASE_FAILED');

    if (!correct) {
      await this.recordPhraseEvent(q.phraseId, { type: 'produced', correct: false });
    } else {
      await this.recordPhraseEvent(q.phraseId, {
        type: 'produced',
        correct: true,
        withHelp: usedHelp,
      });
    }

    this.miniProvaSnapshot = recordMiniProvaAnswer(this.miniProvaSnapshot, {
      phraseId: q.phraseId,
      german: q.german,
      type: q.type,
      autonomy,
      correct,
      userSaid: text,
      at: new Date().toISOString(),
    });

    if (!this.miniProvaSnapshot.completed) {
      const nextIndex = this.miniProvaSnapshot.currentIndex;
      this.applyMiniProvaQuestion(nextIndex);
      const nextQ = getCurrentMiniProvaQuestion(this.miniProvaSnapshot);
      return {
        flow: 'continueConversation',
        action: 'converse',
        mode: 'FREE_CONVERSATION',
        reason: 'miniprova_next',
        targetItem: nextQ?.promptDe ?? null,
        geminiNudge: nextQ
          ? buildMiniProvaNextNudge({
            questionGerman: nextQ.promptDe,
            index: nextIndex,
            total: this.miniProvaSnapshot.total,
          })
          : null,
        eventsRecorded,
      };
    }

    return {
      flow: 'continueConversation',
      action: 'converse',
      mode: 'FREE_CONVERSATION',
      reason: 'miniprova_done',
      targetItem: null,
      geminiNudge: [
        '[INTERNE ANWEISUNG — nicht vorlesen]',
        'Sage auf Deutsch: "Sehr gut! Die Mini-Prüfung ist fertig."',
      ].join('\n'),
      eventsRecorded,
    };
  }

  /** Simulador — conversa natural, fora do ciclo de aula L0. */
  private async onSimulatorUtterance(text: string): Promise<OrchestratorDecision> {
    const trimmed = text.trim();
    if (!trimmed || !this.simulatorContext) {
      return this.continueResult('simulator_empty');
    }
    this.userTurns += 1;
    this.ctx.lastUserUtterance = trimmed;
    this.simulatorTurnIndex += 1;
    const eventsRecorded: LearningEventType[] = ['USER_UTTERANCE'];
    await saveLearningEvent('USER_UTTERANCE', {
      phraseId: this.plan.target?.id,
      context: trimmed,
      helpLevel: this.helpUsedThisTurn ? this.sessionSupport : 0,
    });
    this.helpUsedThisTurn = false;

    const hints = this.simulatorConversationHints;
    const nextHint = hints[this.simulatorTurnIndex % Math.max(1, hints.length)] || '';
    const ctx = this.simulatorContext;

    return {
      flow: 'continueConversation',
      action: 'converse',
      mode: 'FREE_CONVERSATION',
      reason: `simulator_turn:${this.simulatorTurnIndex}`,
      targetItem: nextHint || this.ctx.targetItem,
      geminiNudge: buildSimulatorTurnNudge({
        userSaid: trimmed,
        nextHint,
        settingDe: ctx.scenario.settingDe,
      }),
      eventsRecorded,
    };
  }

  /**
   * Target explícito da Home / detalhe da estrutura — só no create().
   * TRUE só se o plano ficou efetivamente com esse target (não só “achei a frase”).
   * Depois o refreshPlan segue a progressão normal (variação → pergunta → conversa).
   */
  applySelectedStartTarget(phraseId: string): boolean {
    const c2 = isC2LiveMode(this.profile);
    const c1 = isC1LiveMode(this.profile);
    const b2 = isB2LiveMode(this.profile);
    const b1 = isB1LiveMode(this.profile);
    const a2 = isA2LiveMode(this.profile);
    const a1 = isA1LiveMode(this.profile);
    const pool = isZeroLanguageMode(this.profile)
      ? mergeZeroLanguagePhrases(this.phrases)
      : c2
        ? mergeC2CurriculumPhrases(this.phrases)
        : c1
          ? mergeC1CurriculumPhrases(this.phrases)
          : b2
            ? mergeB2CurriculumPhrases(this.phrases)
            : b1
              ? mergeB1CurriculumPhrases(this.phrases)
              : a2
                ? mergeA2CurriculumPhrases(this.phrases)
                : a1
                  ? mergeA1CurriculumPhrases(this.phrases)
                  : mergeZeroLanguagePhrases(
                    mergeA1CurriculumPhrases(
                      mergeA2CurriculumPhrases(
                        mergeB1CurriculumPhrases(
                          mergeB2CurriculumPhrases(
                            mergeC1CurriculumPhrases(mergeC2CurriculumPhrases(this.phrases)),
                          ),
                        ),
                      ),
                    ),
                  );
    let decoded = phraseId.trim();
    if (!decoded) return false;
    try {
      decoded = decodeURIComponent(decoded).trim();
    } catch {
      /* id já decodificado */
    }
    const baseId = l0ChunkBaseForPhraseId(decoded);
    const resolved =
      resolvePhrase(decoded, pool)
      || (baseId ? resolvePhrase(baseId, pool) : null)
      || pool.find((p) => p.german === decoded)
      || null;
    if (!resolved) {
      this.selectedStartApplied = false;
      return false;
    }

    const conf = this.learning.phrases[resolved.id];
    const times = conf?.timesCorrect ?? 0;
    const action: OrchestratorAction =
      !conf || conf.state === 'new' || times === 0 ? 'introduce' : 'practice';
    const zero = isZeroLanguageMode(this.profile);
    let scaffoldLevel = scaffoldFor(conf, action, resolved.id);
    if (zero) {
      scaffoldLevel = Math.max(scaffoldLevel, action === 'introduce' ? 4 : 3) as SupportLevel;
    }
    if (a1 && action === 'introduce') {
      scaffoldLevel = Math.max(scaffoldLevel, 3) as SupportLevel;
    }
    if (a2 && action === 'introduce') {
      scaffoldLevel = Math.max(scaffoldLevel, 2) as SupportLevel;
    }
    if (b1 && action === 'introduce') {
      scaffoldLevel = Math.max(scaffoldLevel, 1) as SupportLevel;
    }
    if (b2 && action === 'introduce') {
      scaffoldLevel = Math.max(scaffoldLevel, 1) as SupportLevel;
    }
    if (c1 && action === 'introduce') {
      scaffoldLevel = Math.max(scaffoldLevel, 1) as SupportLevel;
    }
    if (c2 && action === 'introduce') {
      scaffoldLevel = Math.max(scaffoldLevel, 1) as SupportLevel;
    }
    const helpPref = UiPrefsService.get().helpLevel;
    this.sessionSupport = applyHelpPrefToScaffold(scaffoldLevel, helpPref) as SupportLevel;
    const target = phraseToTarget(resolved, conf);
    this.plan = {
      ...this.plan,
      action,
      actionReason: `selected_home_target:${resolved.id}`,
      target,
      scaffoldLevel: this.sessionSupport,
    };
    this.plan.teacherDirective = buildDirective(
      this.plan,
      zero,
      this.plan.training?.totalMinutes,
      a1,
      a2,
      b1,
      b2,
      c1,
    );
    this.plan.actionKickoff = buildActionKickoff(this.plan, zero, a1, a2, b1, b2, c1);
    this.ctx.targetItem = target.german;
    this.ctx.lastAction = action;
    this.ctx.currentGoal = action;
    this.ctx.mode = 'GUIDED_CONVERSATION';

    const applied = selectedStartIdsMatch(decoded, this.plan.target?.id);
    this.selectedStartApplied = applied;
    return applied;
  }

  /** Seleção explícita da Home/Chunks aplicada com sucesso neste create(). */
  wasSelectedStartApplied(): boolean {
    return this.selectedStartApplied;
  }

  getRequestedStartPhraseId(): string | null {
    return this.requestedStartPhraseId;
  }

  /** Tema escolhido na tela Conversar — conversa guiada pelo progresso real. */
  applyConversationTopicIntent(intent: ConversationTopicContext) {
    const opening = pickConversationOpening(intent);
    const topicPt = conversationTopicPlanLabel(intent.topic);
    const targetPhrase =
      this.phrases.find((p) => p.german === opening)
      || mergeZeroLanguagePhrases(this.phrases).find((p) => p.german === opening)
      || null;

    this.ctx.topic = topicPt;
    this.ctx.mode = 'FREE_CONVERSATION';
    this.ctx.currentGoal = 'converse';
    this.ctx.lastAction = 'converse';
    this.plan = {
      ...this.plan,
      action: 'converse',
      actionReason: `conversation_topic:${intent.id}`,
      topic: topicPt,
      stageId: 'conversation',
      target: targetPhrase
        ? {
            id: targetPhrase.id,
            german: targetPhrase.german,
            portuguese: targetPhrase.portuguese,
            expected: targetPhrase.german.toLowerCase(),
            hint: intent.chunk || '',
          }
        : this.plan.target,
      actionKickoff: buildConversationTopicKickoff(intent, opening),
    };
    this.plan.teacherDirective = buildDirective(
      this.plan,
      isZeroLanguageMode(this.profile),
      this.plan.training?.totalMinutes,
    );
    this.coachContextText = buildConversationCoachContext(intent);
    this.ctx.targetItem = opening;
  }

  getPlan(): ConversationPlan {
    return this.plan;
  }

  getActionHistory() {
    return [...this.actionHistory];
  }

  getCurrentSupport(): SupportLevel {
    return this.sessionSupport;
  }

  getScaffoldHint(): ReturnType<typeof buildScaffoldHint> | null {
    const target = this.pendingTransfer?.german || this.plan.target?.german || this.ctx.targetItem;
    if (!target) return null;
    return buildScaffoldHint(target, this.sessionSupport, {
      portuguese: this.pendingTransfer?.portuguese || this.plan.target?.portuguese,
    });
  }

  getMicroPractice(): MicroPracticeSession | null {
    return this.micro ? { ...this.micro } : null;
  }

  getPendingTransfer(): TransferVariant | null {
    return this.pendingTransfer;
  }

  getSpontaneousOpportunity(): SpontaneousOpportunity | null {
    return this.spontaneousOpportunity;
  }

  getPendingReview(): ReviewOpportunity | null {
    return this.pendingReview;
  }

  private tryBeginSpontaneousOpportunity(reason: string, force = false): OrchestratorDecision | null {
    if (isZeroLanguageMode(this.profile) && !force) return null;
    const phrase = this.sourcePhraseForTransfer();
    if (!phrase) return null;
    const mem = getSpontaneousMemory(phrase.id);
    const hist = this.learning.phrases[phrase.id];
    const decision = decideSpontaneousOpportunity({
      hasProduced: (hist?.timesCorrect ?? 0) >= 1 || (hist?.timesProduced ?? 0) >= 1,
      spontaneousCount: mem?.spontaneousCount ?? 0,
      sessionOpportunities: this.sessionSpontaneousOpps,
      recentError: this.justErrored,
      turnsSinceLastOpportunity: this.turnsSinceSpontaneousOpp,
    });
    if (!force && decision !== 'CREATE_SPONTANEOUS_OPPORTUNITY') return null;
    if (this.pendingTransfer) return null;
    if (!force && !hist) return null;

    const opp = buildSpontaneousOpportunity(
      { id: phrase.id, german: phrase.german },
      { profession: this.profile.profession, level: this.profile.level },
    );
    this.spontaneousOpportunity = opp;
    this.sessionSpontaneousOpps += 1;
    this.turnsSinceSpontaneousOpp = 0;
    this.ctx.lastAction = 'spontaneous';
    this.plan = { ...this.plan, action: 'spontaneous' };
    this.persist();
    return {
      flow: 'continueConversation',
      action: 'spontaneous',
      mode: 'FREE_CONVERSATION',
      reason,
      targetItem: phrase.german,
      geminiNudge: buildSpontaneousOpportunityNudge(opp),
      eventsRecorded: [],
    };
  }

  private sourcePhraseForTransfer(): Phrase | null {
    const id = this.plan.target?.id;
    const german = this.plan.target?.german || this.ctx.targetItem;
    if (id) return resolvePhrase(id, this.phrases);
    if (german) return this.phrases.find((p) => p.german === german) || null;
    return null;
  }

  private tryBeginReviewOpportunity(reason: string, force = false): OrchestratorDecision | null {
    // L0: revisão natural A1+ não deve puxar frases antigas (ex.: Wie geht's) no meio do ensino
    if (isZeroLanguageMode(this.profile) && !force) return null;
    if (this.micro && this.micro.phase !== 'done') return null;
    if (this.pendingTransfer || this.spontaneousOpportunity) return null;
    if (this.pendingReview) return null;
    if (!force && !this.reviewSession && this.userTurns < 2) return null;
    const opp = pickReviewOpportunity(this.learning.phrases, this.phrases, {
      profile: this.profile,
      skipIds: [...this.sessionReviewed],
    });
    if (!opp) return null;
    if (!force && opp.priority < 40) return null;

    if (opp.type === 'TRANSFER_REVIEW') {
      const phrase = resolvePhrase(opp.itemId, this.phrases);
      if (phrase) {
        const variant = pickTransferForLive(phrase, {
          userLevel: this.profile.level,
          profession: this.profile.profession,
        });
        if (variant) {
          opp.prompt = variant.situationPrompt || opp.prompt;
          opp.expected = variant.german;
          opp.context = variant.axis || opp.context;
        }
      }
    }

    this.pendingReview = opp;
    const action = mapReviewTypeToAction(opp.type);
    this.plan = { ...this.plan, action, actionReason: opp.reason };
    this.ctx.lastAction = action;
    this.ctx.targetItem = opp.german;
    this.persist();
    return {
      flow: 'continueConversation',
      action,
      mode: opp.type === 'GUIDED_SPEAKING_REVIEW' ? 'GUIDED_CONVERSATION' : 'FREE_CONVERSATION',
      reason: `${reason}:${opp.type}`,
      targetItem: opp.german,
      geminiNudge: buildReviewGeminiNudge(opp),
      eventsRecorded: [],
    };
  }

  private async onReviewAttempt(text: string): Promise<OrchestratorDecision> {
    const opp = this.pendingReview;
    if (!opp) return this.continueResult('review_sem_alvo');
    this.userTurns += 1;
    this.ctx.lastUserUtterance = text;
    const usedHelp = this.helpUsedThisTurn;
    this.helpUsedThisTurn = false;
    const result = evaluateReviewAttempt(text, opp);
    const eventsRecorded: LearningEventType[] = ['USER_UTTERANCE'];
    await saveLearningEvent('USER_UTTERANCE', {
      phraseId: opp.itemId,
      context: text,
      helpLevel: usedHelp ? this.sessionSupport : 0,
    });

    const inQueueSession = !!this.reviewQueueSnapshot;

    if (inQueueSession && this.reviewQueueSnapshot) {
      this.reviewQueueSnapshot.itemAttempts += 1;
      const attempts = this.reviewQueueSnapshot.itemAttempts;
      const shouldAdvance =
        result === 'SUCCESS' ||
        result === 'PARTIAL' ||
        (result === 'FAILED' && attempts >= MAX_REVIEW_ITEM_ATTEMPTS);

      if (!shouldAdvance && result === 'FAILED') {
        this.justErrored = true;
        persistReviewSession(this.reviewQueueSnapshot);
        return {
          flow: 'continueConversation',
          action: 'practice',
          mode: 'GUIDED_CONVERSATION',
          reason: `review_retry:${attempts}_of_${MAX_REVIEW_ITEM_ATTEMPTS}`,
          targetItem: opp.german,
          geminiNudge: [
            '[INSTRUÇÃO INTERNA — não leia isto em voz alta]',
            'REVISÃO — resposta incorreta. Explique curto em português.',
            `Modele: "${opp.german}"`,
            'Peça nova tentativa. Não avance para o próximo item ainda.',
            `Pergunta: "${opp.prompt}"`,
          ].join('\n'),
          eventsRecorded,
        };
      }

      const ev: LearningEventType =
        result === 'SUCCESS' ? 'REVIEW_SUCCESS' : result === 'PARTIAL' ? 'REVIEW_PARTIAL' : 'REVIEW_FAILED';
      await saveLearningEvent(ev, {
        phraseId: opp.itemId,
        context: JSON.stringify({
          reviewType: opp.type,
          result,
          prompt: opp.prompt,
          helpLevel: usedHelp ? this.sessionSupport : 0,
          sessionIndex: this.reviewQueueSnapshot.currentIndex,
        }),
        helpLevel: usedHelp ? this.sessionSupport : 0,
      });
      eventsRecorded.push(ev);

      const storedResult: 'SUCCESS' | 'PARTIAL' | 'FAILED' | 'DEFERRED' =
        result === 'FAILED' && attempts >= MAX_REVIEW_ITEM_ATTEMPTS ? 'DEFERRED' : result;

      if (result === 'SUCCESS' && opp.type === 'RECALL_REVIEW') {
        await saveLearningEvent('PHRASE_RECALLED', { phraseId: opp.itemId, context: text });
        eventsRecorded.push('PHRASE_RECALLED');
      }

      const updated = await MemoryService.recordReviewResult(
        opp.itemId,
        storedResult === 'DEFERRED' ? 'FAILED' : result,
        {
        reviewType: opp.type,
        helpLevel: usedHelp ? this.sessionSupport : 0,
        sessionId: this.sessionId,
      });
      this.learning = {
        ...this.learning,
        phrases: { ...this.learning.phrases, [opp.itemId]: updated },
      };
      this.sessionReviewed.add(opp.itemId);
      this.reviewQueueSnapshot.results.push({
        phraseId: opp.itemId,
        german: opp.german,
        result: storedResult,
        reviewType: opp.type,
      });
      this.pendingReview = null;
      this.justErrored = storedResult === 'DEFERRED' || storedResult === 'FAILED';

      const advanced = advanceReviewQueueAfterItem(this.reviewQueueSnapshot);
      if (!advanced.finished && advanced.nextIndex != null) {
        persistReviewSession(this.reviewQueueSnapshot);
        this.applyReviewQueueItem(advanced.nextIndex);
        const nextOpp = this.pendingReview!;
        const pos = advanced.nextIndex + 1;
        const total = this.reviewQueueSnapshot.total;
        return {
          flow: 'continueConversation',
          action: mapReviewTypeToAction(nextOpp.type),
          mode: nextOpp.type === 'GUIDED_SPEAKING_REVIEW' ? 'GUIDED_CONVERSATION' : 'FREE_CONVERSATION',
          reason: `review_next:${pos}_of_${total}`,
          targetItem: nextOpp.german,
          geminiNudge: [
            '[INSTRUÇÃO INTERNA — não leia isto em voz alta]',
            `Revisão ${pos} de ${total}. Item anterior concluído.`,
            buildReviewGeminiNudge(nextOpp).split('\n').slice(1).join('\n'),
          ].join('\n'),
          eventsRecorded,
        };
      }

      this.reviewQueueSnapshot.completed = true;
      persistReviewSession(this.reviewQueueSnapshot);
      const summary = this.reviewQueueSnapshot.results;
      const mastered = summary.filter((r) => r.result === 'SUCCESS').length;
      const needsLater = summary.filter((r) => r.result === 'FAILED' || r.result === 'DEFERRED').length;
      const withHelp = summary.filter((r) => r.result === 'PARTIAL').length;
      this.ctx.mode = 'FREE_CONVERSATION';
      this.persist();
      return {
        flow: 'continueConversation',
        action: 'converse',
        mode: 'FREE_CONVERSATION',
        reason: 'review_session_complete',
        targetItem: null,
        geminiNudge: [
          '[INSTRUÇÃO INTERNA — não leia isto em voz alta]',
          `Revisão concluída. ${this.reviewQueueSnapshot.total} itens revisados.`,
          `Dominados nesta sessão: ${mastered}. Com ajuda: ${withHelp}. Para revisão posterior: ${needsLater}.`,
          'Elogie brevemente e encerre a revisão de forma natural.',
        ].join('\n'),
        eventsRecorded,
      };
    }

    const ev: LearningEventType =
      result === 'SUCCESS' ? 'REVIEW_SUCCESS' : result === 'PARTIAL' ? 'REVIEW_PARTIAL' : 'REVIEW_FAILED';
    await saveLearningEvent(ev, {
      phraseId: opp.itemId,
      context: JSON.stringify({
        reviewType: opp.type,
        result,
        prompt: opp.prompt,
        helpLevel: usedHelp ? this.sessionSupport : 0,
      }),
      helpLevel: usedHelp ? this.sessionSupport : 0,
    });
    eventsRecorded.push(ev);
    if (result === 'SUCCESS' && opp.type === 'RECALL_REVIEW') {
      await saveLearningEvent('PHRASE_RECALLED', { phraseId: opp.itemId, context: text });
      eventsRecorded.push('PHRASE_RECALLED');
    }

    const updated = await MemoryService.recordReviewResult(opp.itemId, result, {
      reviewType: opp.type,
      helpLevel: usedHelp ? this.sessionSupport : 0,
      sessionId: this.sessionId,
    });
    this.learning = {
      ...this.learning,
      phrases: { ...this.learning.phrases, [opp.itemId]: updated },
    };
    this.sessionReviewed.add(opp.itemId);
    this.pendingReview = null;
    this.justErrored = result === 'FAILED';
    this.ctx.mode = 'FREE_CONVERSATION';
    this.persist();

    const nextHint =
      result === 'SUCCESS'
        ? 'Revisão OK. Feedback curto. Continue a conversa — não comece outro drill da mesma frase.'
        : result === 'PARTIAL'
          ? 'Parcial. Dê uma pista mínima e continue em contexto. Não zere o progresso.'
          : 'Não conseguiu agora. Ajuda breve, depois volte à conversa. Não destrua a automação.';

    return {
      flow: 'continueConversation',
      action: result === 'FAILED' ? 'practice' : 'converse',
      mode: result === 'FAILED' ? 'GUIDED_CONVERSATION' : 'FREE_CONVERSATION',
      reason: `review_${result.toLowerCase()}:${opp.type}`,
      targetItem: opp.german,
      geminiNudge: [
        '[INSTRUÇÃO INTERNA — não leia isto em voz alta]',
        nextHint,
        result === 'SUCCESS' ? 'Sehr gut — naturalmente, sem "review".' : '',
      ].filter(Boolean).join('\n'),
      eventsRecorded,
    };
  }

  private tryBeginTransfer(reason: string, phraseOverride?: Phrase | null, force = false): OrchestratorDecision | null {
    // Não misturar transfer com oportunidade espontânea ativa
    if (this.spontaneousOpportunity) return null;
    if (isZeroLanguageMode(this.profile) && !force) return null;
    const phrase = phraseOverride || this.sourcePhraseForTransfer();
    if (!phrase) return null;
    const hist = this.learning.phrases[phrase.id];
    if (!force && hist && (isAutomated(hist) || readAutomationScore(hist) >= 85)) return null;
    const hasProducedBefore = (hist?.timesCorrect ?? 0) >= 1 || (hist?.timesProduced ?? 0) >= 1;
    const variant = pickTransferForLive(phrase, {
      userLevel: this.profile.level,
      selfReportedLevel: this.profile.selfReportedLevel,
      profession: this.profile.profession,
    });
    const decision = decideTransfer({
      producedNow: true,
      recentError: this.justErrored,
      hasProducedBefore,
      sessionTransfers: this.sessionTransfers,
      turnsSinceLastTransfer: this.turnsSinceLastTransfer,
      pendingTransfer: !!this.pendingTransfer,
      hasVariant: !!variant,
    });
    if (!force && (decision !== 'TRANSFER' || !variant)) return null;
    if (!variant) return null;

    this.pendingTransfer = variant;
    this.sessionTransfers += 1;
    this.turnsSinceLastTransfer = 0;
    this.transferAttempts = 0;
    this.ctx.lastAction = 'transfer';
    this.ctx.mode = this.sessionSupport > 0 ? 'GUIDED_CONVERSATION' : 'FREE_CONVERSATION';
    this.plan = { ...this.plan, action: 'transfer' };
    this.persist();
    return {
      flow: 'continueConversation',
      action: 'transfer',
      mode: this.ctx.mode,
      reason,
      targetItem: phrase.german,
      geminiNudge: buildTransferGeminiNudge(variant, phrase.german),
      eventsRecorded: [],
    };
  }

  toLiveFields() {
    const hint = this.getScaffoldHint();
    const targetId = this.plan.target?.id;
    const conf = targetId ? this.learning.phrases[targetId] : undefined;
    const zero = isZeroLanguageMode(this.profile);
    const a1 = isA1LiveMode(this.profile);
    const a2 = isA2LiveMode(this.profile);
    const b1 = isB1LiveMode(this.profile);
    const b2 = isB2LiveMode(this.profile);
    const c1 = isC1LiveMode(this.profile);
    const c2 = isC2LiveMode(this.profile);
    const pedagogicalTurn =
      (a1 || a2 || b1 || b2 || c1 || c2) && this.plan.target
        ? {
            target: this.plan.target.id,
            currentObjective: this.plan.action.toUpperCase(),
            allowedNextAction:
              this.plan.action === 'practice'
                ? 'CORRECT_OR_SCAFFOLD → RETRY_SAME_TARGET'
                : this.plan.action === 'transfer'
                  ? 'ONE_AXIS_CHANGE → ASK_PRODUCTION'
                  : c2
                    ? 'EVALUATE → STAY_ON_C2'
                    : c1
                      ? 'EVALUATE → STAY_ON_C1_OR_ADVANCE'
                      : b2
                        ? 'EVALUATE → STAY_ON_B2_OR_ADVANCE'
                        : b1
                          ? 'EVALUATE → STAY_ON_B1_OR_ADVANCE'
                          : a2
                            ? 'EVALUATE → STAY_ON_A2_OR_ADVANCE'
                            : 'EVALUATE → STAY_ON_A1_OR_ADVANCE',
          }
        : null;
    return {
      zeroLanguageMode: zero,
      a1CurriculumMode: a1 && !b2 && !c1 && !c2,
      a2CurriculumMode: a2 && !b2 && !c1 && !c2,
      b1CurriculumMode: b1 && !b2 && !c1 && !c2,
      b2CurriculumMode: b2 && !c1 && !c2,
      c1CurriculumMode: c1 && !c2,
      c2CurriculumMode: c2,
      teacherDirective: this.plan.teacherDirective,
      pedagogicalAction: this.pendingTransfer
        ? 'transfer'
        : this.pendingReview
          ? mapReviewTypeToAction(this.pendingReview.type)
          : this.plan.action,
      pedagogicalTurn,
      targetPhrase: this.pendingTransfer?.german || this.plan.target?.german,
      targetPhrasePt: this.pendingTransfer?.portuguese || this.plan.target?.portuguese,
      targetId: this.plan.target?.id,
      scaffoldLevel: this.sessionSupport,
      sessionTopic: this.plan.topic,
      trainingStage: this.plan.stageId,
      orchestratorKickoff: (this.simulatorMode && this.simulatorKickoffSuppressed)
        ? undefined
        : this.plan.actionKickoff,
      scaffoldHint: hint?.displayText || '',
      actionReason: this.plan.actionReason || '',
      automationScore: conf ? readAutomationScore(conf) : undefined,
      coachContext: this.coachContextText || undefined,
    };
  }

  private persist() {
    savePersistedOrchestratorState({
      sessionId: this.sessionId,
      currentTopic: this.ctx.topic,
      currentGoal: this.ctx.currentGoal,
      targetItem: this.ctx.targetItem,
      lastAction: this.ctx.lastAction,
      mode: this.ctx.mode,
      recentMistakes: this.ctx.recentMistakes.slice(0, 6),
      updatedAt: new Date().toISOString(),
      actionReason: this.plan.actionReason,
      previousAction: this.plan.previousAction,
      actionHistory: this.actionHistory.slice(-12),
      l0PhrasePhase: this.l0PhrasePhase,
    });
  }

  private refreshPlan(excludePhraseId?: string | null) {
    const elapsed = Date.now() - this.startedAt;
    const prevAction = this.plan.action;
    const prevTargetId = this.plan.target?.id ?? null;
    this.plan = reevaluatePlan(
      this.plan,
      this.profile,
      this.learning,
      this.phrases,
      elapsed,
      this.userTurns,
      {
        l0BlockReviewPhraseId: this.l0BlockReviewPhraseId,
        l0StickPhraseId: this.pendingCorrectionRetry?.phraseId ?? null,
        l0ExcludePhraseId: excludePhraseId ?? this.l0JustAcceptedId,
        l0SkipPhraseIds: this.l0DeferredPhraseIds,
      },
    );
    this.plan = { ...this.plan, previousAction: prevAction };
    this.ctx.topic = this.plan.topic;
    this.ctx.targetItem = this.plan.target?.german ?? this.ctx.targetItem;
    this.ctx.lastAction = this.plan.action;
    this.ctx.currentGoal = this.plan.action;
    const nextId = this.plan.target?.id ?? null;
    if (nextId !== prevTargetId) {
      this.l0TargetRevision += 1;
      this.logL0('AFTER_PLAN_RECALC', {
        previousTargetId: prevTargetId,
        selectedNextTarget: nextId,
        excludePhraseId: excludePhraseId ?? this.l0JustAcceptedId,
        recoveryReason: this.pendingBlockRecovery ? 'pendingBlockRecovery' : this.l0BlockReviewPhraseId ? 'blockReview' : null,
      });
    }
  }

  private async applyNbaAfterEvidence(phraseId: string): Promise<OrchestratorDecision | null> {
    const conf = this.learning.phrases[phraseId];
    if (!conf) return null;
    if (this.micro && this.micro.phase !== 'done') return null;
    if (this.pendingTransfer) return null;

    // L0: 1 acerto = aceitar e avançar (domínio é longitudinal, não bloqueia)
    if (isZeroLanguageMode(this.profile)) {
      if (!isZeroLanguagePhraseAccepted(conf)) {
        this.l0PhrasePhase = 'RETRY';
        this.refreshPlan();
        this.persist();
        return {
          flow: 'continueConversation',
          action: 'practice',
          mode: 'GUIDED_CONVERSATION',
          reason: 'ZERO_LANGUAGE_MODE — aguardando aceitação',
          targetItem: this.plan.target?.german ?? this.ctx.targetItem,
          geminiNudge: [
            '[INSTRUÇÃO INTERNA — não leia isto em voz alta]',
            'ZERO LANGUAGE MODE — ainda na mesma frase.',
            `Modele "${this.plan.target?.german || conf.phraseId}" e diga "Agora você."`,
            'AGUARDE.',
          ].join('\n'),
          eventsRecorded: [],
        };
      }

      // Anti-loop: após aceitar, EXCLUIR esta frase do recall imediato
      this.l0JustAcceptedId = phraseId;
      this.l0PhrasePhase = 'ADVANCE';
      this.l0BlockReviewPhraseId = null;
      this.refreshPlan(phraseId);
      this.persist();
      const next = this.plan.target;
      const sameTarget = !!next && next.id === phraseId;
      const noTarget = !next;

      this.logL0('AFTER_ACCEPT_ADVANCE', {
        acceptedId: phraseId,
        nextTargetId: next?.id ?? null,
        nextTargetText: next?.german ?? null,
        action: this.plan.action,
        targetStuck: sameTarget,
        reason: sameTarget || noTarget ? 'TARGET_STUCK_OR_CURRICULUM_END' : 'ADVANCE',
      });

      if (sameTarget || noTarget || this.plan.action === 'converse') {
        const lastDe =
          this.learning.phrases[phraseId]
            ? (resolvePhrase(phraseId, this.phrases)?.german || this.ctx.targetItem)
            : this.ctx.targetItem;
        const chunkBase = l0ChunkBaseForPhraseId(phraseId);
        const chunkMature = chunkBase ? isL0ChunkMature(this.learning, chunkBase) : false;
        const nextBridge = L0_BRIDGE_A1_SPECS.find(
          (s) => !isZeroLanguagePhraseAccepted(this.learning.phrases[s.id]),
        );
        const coreDone = isL0CoreCurriculumComplete(this.learning);
        if (coreDone) {
          const grad = await maybeGraduateL0ToA1(this.profile, this.learning);
          if (grad.graduated && grad.progress) {
            this.profile = await applyProfileLevelAfterGraduation(
              this.profile,
              grad.progress,
              (p) => StorageService.saveProfile(p),
            );
            this.phrases = mergeA1CurriculumPhrases(this.phrases);
            this.refreshPlan(phraseId);
            const first = this.plan.target ?? phraseToTarget(
              mergeA1CurriculumPhrases([])[0],
              this.learning.phrases[a1FirstTarget().id],
            );
            return {
              flow: 'continueConversation',
              action: 'introduce',
              mode: 'GUIDED_CONVERSATION',
              reason: `L0→A1 graduated (${grad.reason})`,
              targetItem: first.german,
              geminiNudge: buildA1TurnPedagogicalDirective({
                targetId: first.id,
                german: first.german,
                portuguese: first.portuguese,
                action: 'introduce',
                objective: 'FIRST_A1_TARGET',
                allowedNext: 'MODEL → ASK_PRODUCTION → WAIT',
                verdict: 'GRADUATED_FROM_L0',
              }),
              eventsRecorded: [],
            };
          }
        }
        const chunkLabel = chunkBase
          ? (resolvePhrase(chunkBase, this.phrases)?.german
            || mergeZeroLanguagePhrases(this.phrases).find((p) => p.id === chunkBase)?.german
            || chunkBase)
          : lastDe;
        const mastered = chunkBase
          ? l0MasteredSimpleExamples(this.learning, chunkBase, this.phrases)
          : [];
        const matureNudge = chunkMature
          ? l0ChunkMatureAdvanceNudge({
            chunkGerman: chunkLabel || 'Ich brauche...',
            masteredExamples: mastered,
            nextGerman: next?.german || nextBridge?.german || null,
            mode: next && l0IsQuestionNodeId(next.id) ? 'question' : 'converse',
          })
          : null;
        return {
          flow: 'continueConversation',
          action: 'converse',
          mode: 'GUIDED_CONVERSATION',
          reason: chunkMature
            ? 'ZERO_LANGUAGE_MODE — CHUNK_MATURE → pergunta/conversa'
            : coreDone
              ? 'ZERO_LANGUAGE_MODE — L0_CURRICULUM_COMPLETE; expandir funcional'
              : 'ZERO_LANGUAGE_MODE — TARGET_STUCK evitado; sem repetição imediata',
          targetItem: next?.german ?? nextBridge?.german ?? this.ctx.targetItem,
          geminiNudge: matureNudge
            || (coreDone
              ? l0ConverseExpandNudge({
                lastGerman: lastDe,
                nextBridgeGerman: nextBridge?.german || next?.german || null,
              })
              : [
                '[INSTRUÇÃO INTERNA — não leia isto em voz alta]',
                'ZERO LANGUAGE MODE — frase ACEITA. Elogie curto ("Perfeito!").',
                'PROIBIDO: pedir a MESMA frase de novo ("fale de novo para fixar").',
                'PROIBIDO: repetição imediata / drill da frase que acabou de acertar.',
                'PROIBIDO: voltar a Guten Morgen / Wie geht\'s se já aceitos nesta sessão.',
                next && next.id !== phraseId && !isL0GreetingPhraseId(next.id)
                  ? `Avance: Nova frase-alvo ÚNICA "${next.german}". Ciclo PT→modelo→repita→AGUARDE.`
                  : 'Continue com a PRÓXIMA estrutura do currículo (não greetings).',
              ].join('\n')),
          eventsRecorded: [],
        };
      }

      const acceptedDe = resolvePhrase(phraseId, this.phrases)?.german || phraseId;
      const chunkBase = l0ChunkBaseForPhraseId(phraseId);
      const chunkMature = chunkBase ? isL0ChunkMature(this.learning, chunkBase) : false;
      const isVariationNext =
        l0VariationsForBase(phraseId).includes(next.id) ||
        (chunkBase ? l0VariationsForBase(chunkBase).includes(next.id) : false) ||
        next.id.startsWith('l0-bridge-') ||
        next.id.startsWith('l0-var-') ||
        next.id.startsWith('l0-hook-');
      const isQuestionNext = l0IsQuestionNodeId(next.id);
      if (chunkMature && isQuestionNext) {
        const chunkLabel =
          resolvePhrase(chunkBase!, this.phrases)?.german
          || mergeZeroLanguagePhrases(this.phrases).find((p) => p.id === chunkBase)?.german
          || chunkBase!
          || 'Ich brauche...';
        return {
          flow: 'continueConversation',
          action: (this.learning.phrases[next.id]?.timesCorrect ?? 0) === 0 ? 'introduce' : 'practice',
          mode: 'GUIDED_CONVERSATION',
          reason: 'ZERO_LANGUAGE_MODE — CHUNK_MATURE → pergunta/conversa',
          targetItem: next.german,
          geminiNudge: l0ChunkMatureAdvanceNudge({
            chunkGerman: chunkLabel,
            masteredExamples: l0MasteredSimpleExamples(this.learning, chunkBase!, this.phrases),
            nextGerman: next.german,
            mode: 'question',
          }),
          eventsRecorded: [],
        };
      }
      return {
        flow: 'continueConversation',
        action: this.plan.action === 'recall' ? 'recall' : (this.learning.phrases[next.id]?.timesCorrect ?? 0) === 0 ? 'introduce' : 'practice',
        mode: 'GUIDED_CONVERSATION',
        reason: isVariationNext
          ? 'ZERO_LANGUAGE_MODE — CORRECT → substituição/variação'
          : 'ZERO_LANGUAGE_MODE — frase aceita, próximo alvo',
        targetItem: next.german,
        geminiNudge: isVariationNext
          ? l0SubstitutionAdvanceNudge({
            acceptedGerman: acceptedDe,
            nextGerman: next.german,
            nextPt: next.portuguese,
          })
          : [
            '[INSTRUÇÃO INTERNA — não leia isto em voz alta]',
            'ZERO LANGUAGE MODE — frase aceita. Elogie curto ("Perfeito!") e AVANCE.',
            `Nova frase-alvo ÚNICA: "${next.german}" (= ${next.portuguese || ''}). Ciclo PT→modelo→repita→AGUARDE.`,
            'PROIBIDO: voltar para a frase que acabou de acertar.',
            'PROIBIDO: "fale de novo para fixar" na mesma frase.',
            'Não faça perguntas abertas sem gancho. Não despeje várias frases.',
          ].join('\n'),
        eventsRecorded: [],
      };
    }

    // A1 curricular: avanço + nudge estruturado (reutiliza NBA/transfer existentes)
    if (isA1LiveMode(this.profile) && isA1TargetId(phraseId)) {
      const a1Meta = getA1TargetById(phraseId);
      if (a1Meta) {
        await recordA1TargetSuccess(this.profile, a1Meta.competencyId, 8);
      }
      this.refreshPlan(phraseId);
      const next = this.plan.target;
      const nextMeta = next ? getA1TargetById(next.id) : null;
      const gradA2 = await maybeGraduateA1ToA2(this.profile, this.learning);
      if (gradA2.graduated && gradA2.progress) {
        this.profile = await applyProfileLevelAfterGraduation(
          this.profile,
          gradA2.progress,
          (p) => StorageService.saveProfile(p),
        );
        this.phrases = mergeA2CurriculumPhrases(this.phrases);
        this.refreshPlan(phraseId);
        const first = this.plan.target ?? phraseToTarget(
          mergeA2CurriculumPhrases([])[0],
          this.learning.phrases[a2FirstTarget().id],
        );
        return {
          flow: 'continueConversation',
          action: 'introduce',
          mode: 'GUIDED_CONVERSATION',
          reason: `A1→A2 graduated (${gradA2.reason})`,
          targetItem: first.german,
          geminiNudge: buildA2TurnPedagogicalDirective({
            targetId: first.id,
            german: first.german,
            portuguese: first.portuguese,
            action: 'introduce',
            objective: 'FIRST_A2_TARGET',
            allowedNext: 'MODEL → ASK_PRODUCTION → WAIT',
            verdict: 'GRADUATED_FROM_A1',
          }),
          eventsRecorded: [],
        };
      }
      const nbaA1 = decideNextBestAction(conf, {
        bottleneck: this.learning.bottleneck,
        recentError: this.justErrored,
        pendingTransfer: !!this.pendingTransfer,
        inMicroPractice: !!this.micro && this.micro.phase !== 'done',
        sessionGoal: this.reviewSession || this.pendingReview ? 'review' : 'auto',
        dueReview: !!this.pendingReview,
        reviewType: this.pendingReview?.type,
      });
      if (nbaA1.action === 'transfer') {
        const phrase = resolvePhrase(phraseId, this.phrases);
        if (phrase) return this.tryBeginTransfer('nba_transfer', phrase, true);
      }
      const action = (next && next.id !== phraseId ? this.plan.action : mapKind(nbaA1.action)) as OrchestratorAction;
      const focus = next && isA1TargetId(next.id) ? next : resolvePhrase(phraseId, this.phrases);
      if (focus) {
        return {
          flow: 'continueConversation',
          action,
          mode: 'GUIDED_CONVERSATION',
          reason: nextMeta && next && next.id !== phraseId
            ? `A1_ADVANCE → ${next.id}`
            : `A1_CONTINUE — ${nbaA1.reason}`,
          targetItem: focus.german,
          geminiNudge: buildA1TurnPedagogicalDirective({
            targetId: focus.id,
            german: focus.german,
            portuguese: focus.portuguese,
            action,
            objective: next && next.id !== phraseId ? 'NEXT_A1_TARGET' : action.toUpperCase(),
            allowedNext: next && next.id !== phraseId
              ? 'MODEL → ASK_PRODUCTION → WAIT'
              : 'VARIATION_OR_TRANSFER_OR_CONVERSE',
            verdict: 'CORRECT',
          }),
          eventsRecorded: [],
        };
      }
    }

    // A2 curricular: avanço + nudge + graduação A2→B1 (currículo B1 executável)
    if (isA2LiveMode(this.profile) && isA2TargetId(phraseId)) {
      const a2Meta = getA2TargetById(phraseId);
      if (a2Meta) {
        await recordA2TargetSuccess(this.profile, a2Meta.competencyId, 8);
      }
      this.refreshPlan(phraseId);
      const next = this.plan.target;
      const nextMeta = next ? getA2TargetById(next.id) : null;
      const gradB1 = await maybeGraduateA2ToB1(this.profile, this.learning);
      if (gradB1.graduated && gradB1.progress) {
        this.profile = await applyProfileLevelAfterGraduation(
          this.profile,
          gradB1.progress,
          (p) => StorageService.saveProfile(p),
        );
        this.phrases = mergeB1CurriculumPhrases(this.phrases);
        this.refreshPlan(phraseId);
        const first = this.plan.target ?? phraseToTarget(
          mergeB1CurriculumPhrases([])[0],
          this.learning.phrases[b1FirstTarget().id],
        );
        return {
          flow: 'continueConversation',
          action: 'introduce',
          mode: 'GUIDED_CONVERSATION',
          reason: `A2→B1 graduated (${gradB1.reason})`,
          targetItem: first.german,
          geminiNudge: buildB1TurnPedagogicalDirective({
            targetId: first.id,
            german: first.german,
            portuguese: first.portuguese,
            action: 'introduce',
            objective: 'FIRST_B1_TARGET',
            allowedNext: 'BRIEF_MODEL → ASK_INDEPENDENT_PRODUCTION → WAIT',
            verdict: 'GRADUATED_FROM_A2',
          }),
          eventsRecorded: [],
        };
      }
      const nbaA2 = decideNextBestAction(conf, {
        bottleneck: this.learning.bottleneck,
        recentError: this.justErrored,
        pendingTransfer: !!this.pendingTransfer,
        inMicroPractice: !!this.micro && this.micro.phase !== 'done',
        sessionGoal: this.reviewSession || this.pendingReview ? 'review' : 'auto',
        dueReview: !!this.pendingReview,
        reviewType: this.pendingReview?.type,
      });
      if (nbaA2.action === 'transfer') {
        const phrase = resolvePhrase(phraseId, this.phrases);
        if (phrase) return this.tryBeginTransfer('nba_transfer', phrase, true);
      }
      const action = (next && next.id !== phraseId ? this.plan.action : mapKind(nbaA2.action)) as OrchestratorAction;
      const focus = next && isA2TargetId(next.id) ? next : resolvePhrase(phraseId, this.phrases);
      if (focus) {
        return {
          flow: 'continueConversation',
          action,
          mode: 'GUIDED_CONVERSATION',
          reason: nextMeta && next && next.id !== phraseId
            ? `A2_ADVANCE → ${next.id}`
            : `A2_CONTINUE — ${nbaA2.reason}`,
          targetItem: focus.german,
          geminiNudge: buildA2TurnPedagogicalDirective({
            targetId: focus.id,
            german: focus.german,
            portuguese: focus.portuguese,
            action,
            objective: next && next.id !== phraseId ? 'NEXT_A2_TARGET' : action.toUpperCase(),
            allowedNext: next && next.id !== phraseId
              ? 'MODEL → ASK_PRODUCTION → WAIT'
              : 'VARIATION_OR_TRANSFER_OR_INDEPENDENT_OR_CONVERSE',
            verdict: 'CORRECT',
          }),
          eventsRecorded: [],
        };
      }
    }

    // B1 curricular: avanço + nudge + graduação B1→B2 (currículo B2 executável)
    if (isB1LiveMode(this.profile) && isB1TargetId(phraseId)) {
      const b1Meta = getB1TargetById(phraseId);
      if (b1Meta) {
        await recordB1TargetSuccess(this.profile, b1Meta.competencyId, 8);
      }
      this.refreshPlan(phraseId);
      const next = this.plan.target;
      const nextMeta = next ? getB1TargetById(next.id) : null;
      const gradB2 = await maybeGraduateB1ToB2(this.profile, this.learning);
      if (gradB2.graduated && gradB2.progress) {
        this.profile = await applyProfileLevelAfterGraduation(
          this.profile,
          gradB2.progress,
          (p) => StorageService.saveProfile(p),
        );
        this.phrases = mergeB2CurriculumPhrases(this.phrases);
        this.refreshPlan(phraseId);
        const first = this.plan.target ?? phraseToTarget(
          mergeB2CurriculumPhrases([])[0],
          this.learning.phrases[b2FirstTarget().id],
        );
        return {
          flow: 'continueConversation',
          action: 'introduce',
          mode: 'GUIDED_CONVERSATION',
          reason: `B1→B2 graduated (${gradB2.reason})`,
          targetItem: first.german,
          geminiNudge: buildB2TurnPedagogicalDirective({
            targetId: first.id,
            german: first.german,
            portuguese: first.portuguese,
            action: 'introduce',
            objective: 'FIRST_B2_TARGET',
            allowedNext: 'MODEL → PRODUÇÃO COM AJUDA → PRODUÇÃO INDEPENDENTE → ARGUMENTAÇÃO → CONVERSAÇÃO',
            verdict: 'GRADUATED_FROM_B1',
          }),
          eventsRecorded: [],
        };
      }
      const nbaB1 = decideNextBestAction(conf, {
        bottleneck: this.learning.bottleneck,
        recentError: this.justErrored,
        pendingTransfer: !!this.pendingTransfer,
        inMicroPractice: !!this.micro && this.micro.phase !== 'done',
        sessionGoal: this.reviewSession || this.pendingReview ? 'review' : 'auto',
        dueReview: !!this.pendingReview,
        reviewType: this.pendingReview?.type,
      });
      if (nbaB1.action === 'transfer') {
        const phrase = resolvePhrase(phraseId, this.phrases);
        if (phrase) return this.tryBeginTransfer('nba_transfer', phrase, true);
      }
      const action = (next && next.id !== phraseId ? this.plan.action : mapKind(nbaB1.action)) as OrchestratorAction;
      const focus = next && isB1TargetId(next.id) ? next : resolvePhrase(phraseId, this.phrases);
      if (focus) {
        return {
          flow: 'continueConversation',
          action,
          mode: 'GUIDED_CONVERSATION',
          reason: nextMeta && next && next.id !== phraseId
            ? `B1_ADVANCE → ${next.id}`
            : `B1_CONTINUE — ${nbaB1.reason}`,
          targetItem: focus.german,
          geminiNudge: buildB1TurnPedagogicalDirective({
            targetId: focus.id,
            german: focus.german,
            portuguese: focus.portuguese,
            action,
            objective: next && next.id !== phraseId ? 'NEXT_B1_TARGET' : action.toUpperCase(),
            allowedNext: next && next.id !== phraseId
              ? 'BRIEF_MODEL → ASK_INDEPENDENT_PRODUCTION → WAIT'
              : 'VARIATION_OR_TRANSFER_OR_INDEPENDENT_OR_CONVERSE',
            verdict: 'CORRECT',
          }),
          eventsRecorded: [],
        };
      }
    }

    // B2 curricular: avanço + nudge + graduação B2→C1 (currículo C1 executável)
    if (isB2LiveMode(this.profile) && isB2TargetId(phraseId)) {
      const b2Meta = getB2TargetById(phraseId);
      if (b2Meta) {
        await recordB2TargetSuccess(this.profile, b2Meta.competencyId, 8);
      }
      this.refreshPlan(phraseId);
      const next = this.plan.target;
      const nextMeta = next ? getB2TargetById(next.id) : null;
      const gradC1 = await maybeGraduateB2ToC1(this.profile, this.learning);
      if (gradC1.graduated && gradC1.progress) {
        this.profile = await applyProfileLevelAfterGraduation(
          this.profile,
          gradC1.progress,
          (p) => StorageService.saveProfile(p),
        );
        this.phrases = mergeC1CurriculumPhrases(this.phrases);
        this.refreshPlan(phraseId);
        const first = this.plan.target ?? phraseToTarget(
          mergeC1CurriculumPhrases([])[0],
          this.learning.phrases[c1FirstTarget().id],
        );
        return {
          flow: 'continueConversation',
          action: 'introduce',
          mode: 'GUIDED_CONVERSATION',
          reason: `B2→C1 graduated (${gradC1.reason})`,
          targetItem: first.german,
          geminiNudge: buildC1TurnPedagogicalDirective({
            targetId: first.id,
            german: first.german,
            portuguese: first.portuguese,
            action: 'introduce',
            objective: 'FIRST_C1_TARGET',
            allowedNext: 'MODEL → REFORMULAÇÃO → PRODUÇÃO INDEPENDENTE → ARGUMENTAÇÃO → CONTRA-ARGUMENTAÇÃO → DISCURSO ESPONTÂNEO',
            verdict: 'GRADUATED_FROM_B2',
          }),
          eventsRecorded: [],
        };
      }
      const nbaB2 = decideNextBestAction(conf, {
        bottleneck: this.learning.bottleneck,
        recentError: this.justErrored,
        pendingTransfer: !!this.pendingTransfer,
        inMicroPractice: !!this.micro && this.micro.phase !== 'done',
        sessionGoal: this.reviewSession || this.pendingReview ? 'review' : 'auto',
        dueReview: !!this.pendingReview,
        reviewType: this.pendingReview?.type,
      });
      if (nbaB2.action === 'transfer') {
        const phrase = resolvePhrase(phraseId, this.phrases);
        if (phrase) return this.tryBeginTransfer('nba_transfer', phrase, true);
      }
      const action = (next && next.id !== phraseId ? this.plan.action : mapKind(nbaB2.action)) as OrchestratorAction;
      const focus = next && isB2TargetId(next.id) ? next : resolvePhrase(phraseId, this.phrases);
      if (focus) {
        return {
          flow: 'continueConversation',
          action,
          mode: 'GUIDED_CONVERSATION',
          reason: nextMeta && next && next.id !== phraseId
            ? `B2_ADVANCE → ${next.id}`
            : `B2_CONTINUE — ${nbaB2.reason}`,
          targetItem: focus.german,
          geminiNudge: buildB2TurnPedagogicalDirective({
            targetId: focus.id,
            german: focus.german,
            portuguese: focus.portuguese,
            action,
            objective: next && next.id !== phraseId ? 'NEXT_B2_TARGET' : action.toUpperCase(),
            allowedNext: next && next.id !== phraseId
              ? 'MODEL → PRODUÇÃO COM AJUDA → PRODUÇÃO INDEPENDENTE → ARGUMENTAÇÃO → CONVERSAÇÃO'
              : 'VARIATION_OR_TRANSFER_OR_ARGUMENT_OR_CONVERSE',
            verdict: 'CORRECT',
          }),
          eventsRecorded: [],
        };
      }
    }

    // C1 curricular: avanço + nudge + graduação C1→C2 (currículo C2 executável)
    if (isC1LiveMode(this.profile) && isC1TargetId(phraseId)) {
      const c1Meta = getC1TargetById(phraseId);
      if (c1Meta) {
        await recordC1TargetSuccess(this.profile, c1Meta.competencyId, 8);
      }
      this.refreshPlan(phraseId);
      const next = this.plan.target;
      const nextMeta = next ? getC1TargetById(next.id) : null;
      const gradC2 = await maybeGraduateC1ToC2(this.profile, this.learning);
      if (gradC2.graduated && gradC2.progress) {
        this.profile = await applyProfileLevelAfterGraduation(
          this.profile,
          gradC2.progress,
          (p) => StorageService.saveProfile(p),
        );
        this.phrases = mergeC2CurriculumPhrases(this.phrases);
        this.refreshPlan(phraseId);
        const first = this.plan.target ?? phraseToTarget(
          mergeC2CurriculumPhrases([])[0],
          this.learning.phrases[c2FirstTarget().id],
        );
        return {
          flow: 'continueConversation',
          action: 'introduce',
          mode: 'GUIDED_CONVERSATION',
          reason: `C1→C2 graduated (${gradC2.reason})`,
          targetItem: first.german,
          geminiNudge: buildC2TurnPedagogicalDirective({
            targetId: first.id,
            german: first.german,
            portuguese: first.portuguese,
            action: 'introduce',
            objective: 'FIRST_C2_TARGET',
            allowedNext: 'MODEL → NUANCE → INFERÊNCIA → PERSUASÃO → DISCURSO ESPONTÂNEO',
            verdict: 'GRADUATED_FROM_C1',
          }),
          eventsRecorded: [],
        };
      }
      const nbaC1 = decideNextBestAction(conf, {
        bottleneck: this.learning.bottleneck,
        recentError: this.justErrored,
        pendingTransfer: !!this.pendingTransfer,
        inMicroPractice: !!this.micro && this.micro.phase !== 'done',
        sessionGoal: this.reviewSession || this.pendingReview ? 'review' : 'auto',
        dueReview: !!this.pendingReview,
        reviewType: this.pendingReview?.type,
      });
      if (nbaC1.action === 'transfer') {
        const phrase = resolvePhrase(phraseId, this.phrases);
        if (phrase) return this.tryBeginTransfer('nba_transfer', phrase, true);
      }
      const action = (next && next.id !== phraseId ? this.plan.action : mapKind(nbaC1.action)) as OrchestratorAction;
      const focus = next && isC1TargetId(next.id) ? next : resolvePhrase(phraseId, this.phrases);
      if (focus) {
        return {
          flow: 'continueConversation',
          action,
          mode: 'GUIDED_CONVERSATION',
          reason: nextMeta && next && next.id !== phraseId
            ? `C1_ADVANCE → ${next.id}`
            : `C1_CONTINUE — ${nbaC1.reason}`,
          targetItem: focus.german,
          geminiNudge: buildC1TurnPedagogicalDirective({
            targetId: focus.id,
            german: focus.german,
            portuguese: focus.portuguese,
            action,
            objective: next && next.id !== phraseId ? 'NEXT_C1_TARGET' : action.toUpperCase(),
            allowedNext: next && next.id !== phraseId
              ? 'MODEL → REFORMULAÇÃO → PRODUÇÃO INDEPENDENTE → ARGUMENTAÇÃO → CONTRA-ARGUMENTAÇÃO → DISCURSO ESPONTÂNEO'
              : 'VARIATION_OR_TRANSFER_OR_ARGUMENT_OR_CONVERSE',
            verdict: 'CORRECT',
          }),
          eventsRecorded: [],
        };
      }
    }

    // C2 curricular: avanço + nudge + terminal (sem currículo superior)
    if (isC2LiveMode(this.profile) && isC2TargetId(phraseId)) {
      const c2Meta = getC2TargetById(phraseId);
      if (c2Meta) {
        await recordC2TargetSuccess(this.profile, c2Meta.competencyId, 8);
      }
      this.refreshPlan(phraseId);
      const next = this.plan.target;
      const nextMeta = next ? getC2TargetById(next.id) : null;
      const gradHigher = await maybeGraduateC2ToHigher(this.profile, this.learning);
      if (gradHigher.reason === 'c2_terminal_no_higher_curriculum' && gradHigher.progress) {
        this.profile = await applyProfileLevelAfterGraduation(
          this.profile,
          gradHigher.progress,
          (p) => StorageService.saveProfile(p),
        );
        this.phrases = mergeC2CurriculumPhrases(this.phrases);
        this.refreshPlan(phraseId);
      }
      const nbaC2 = decideNextBestAction(conf, {
        bottleneck: this.learning.bottleneck,
        recentError: this.justErrored,
        pendingTransfer: !!this.pendingTransfer,
        inMicroPractice: !!this.micro && this.micro.phase !== 'done',
        sessionGoal: this.reviewSession || this.pendingReview ? 'review' : 'auto',
        dueReview: !!this.pendingReview,
        reviewType: this.pendingReview?.type,
      });
      if (nbaC2.action === 'transfer') {
        const phrase = resolvePhrase(phraseId, this.phrases);
        if (phrase) return this.tryBeginTransfer('nba_transfer', phrase, true);
      }
      const action = (next && next.id !== phraseId ? this.plan.action : mapKind(nbaC2.action)) as OrchestratorAction;
      const focus = next && isC2TargetId(next.id) ? next : resolvePhrase(phraseId, this.phrases);
      if (focus) {
        return {
          flow: 'continueConversation',
          action,
          mode: 'GUIDED_CONVERSATION',
          reason: gradHigher.reason === 'c2_terminal_no_higher_curriculum'
            ? `C2_TERMINAL (${gradHigher.reason})`
            : nextMeta && next && next.id !== phraseId
              ? `C2_ADVANCE → ${next.id}`
              : `C2_CONTINUE — ${nbaC2.reason}`,
          targetItem: focus.german,
          geminiNudge: buildC2TurnPedagogicalDirective({
            targetId: focus.id,
            german: focus.german,
            portuguese: focus.portuguese,
            action,
            objective: next && next.id !== phraseId ? 'NEXT_C2_TARGET' : action.toUpperCase(),
            allowedNext: next && next.id !== phraseId
              ? 'MODEL → NUANCE → INFERÊNCIA → PERSUASÃO → DISCURSO ESPONTÂNEO'
              : 'VARIATION_OR_TRANSFER_OR_INFERENCE_OR_CONVERSE',
            verdict: gradHigher.reason === 'c2_terminal_no_higher_curriculum'
              ? 'C2_TERMINAL'
              : 'CORRECT',
          }),
          eventsRecorded: [],
        };
      }
    }

    const nba = decideNextBestAction(conf, {
      bottleneck: this.learning.bottleneck,
      recentError: this.justErrored,
      pendingTransfer: !!this.pendingTransfer,
      inMicroPractice: !!this.micro && this.micro.phase !== 'done',
      sessionGoal: this.reviewSession || this.pendingReview ? 'review' : 'auto',
      dueReview: !!this.pendingReview,
      reviewType: this.pendingReview?.type,
    });
    const nextAction = mapKind(nba.action);
    const prev = this.plan.action;
    this.plan = {
      ...this.plan,
      action: nextAction,
      actionReason: nba.reason,
      previousAction: prev,
    };
    this.ctx.lastAction = nextAction;
    this.actionHistory.push({
      action: nextAction,
      reason: nba.reason,
      timestamp: new Date().toISOString(),
      result: `score=${nba.score};band=${nba.band}`,
    });
    if (this.actionHistory.length > 40) this.actionHistory.shift();
    logAutomationDebug({
      item: phraseId,
      score: nba.score,
      evidence: nba.band,
      action: nextAction,
      reason: nba.reason,
    });
    this.persist();

    const phrase = resolvePhrase(phraseId, this.phrases);
    if (nba.action === 'transfer' && phrase) {
      return this.tryBeginTransfer('nba_transfer', phrase, true);
    }
    if (nba.action === 'spontaneous' && phrase) {
      return this.tryBeginSpontaneousOpportunity('nba_spontaneous', true);
    }
    if (nba.action === 'maintenance' || nba.action === 'independent') {
      return {
        flow: 'continueConversation',
        action: 'converse',
        mode: 'FREE_CONVERSATION',
        reason: nba.reason,
        targetItem: phrase?.german ?? this.ctx.targetItem,
        geminiNudge: [
          '[INSTRUÇÃO INTERNA — não leia isto em voz alta]',
          `AutomationScore ${nba.score} (${nba.band}). ${nba.reason}`,
          'NÃO peça para repetir a mesma frase. Continue conversa real / manutenção leve.',
        ].join('\n'),
        eventsRecorded: [],
      };
    }
    if (nextAction !== prev) {
      return {
        flow: 'continueConversation',
        action: nextAction,
        mode: this.ctx.mode,
        reason: nba.reason,
        targetItem: this.ctx.targetItem,
        geminiNudge: [
          '[INSTRUÇÃO INTERNA — não leia isto em voz alta]',
          `Ação mudou: ${prev} → ${nextAction}.`,
          nba.reason,
          'Não anuncie isso ao aluno. Não interrompa demais.',
        ].join('\n'),
        eventsRecorded: [],
      };
    }
    return null;
  }

  private async recordPhraseEvent(
    phraseId: string,
    event: Parameters<typeof MemoryService.recordEvent>[1],
  ) {
    const updated = await MemoryService.recordEvent(phraseId, event, this.sessionId);
    this.learning = {
      ...this.learning,
      phrases: { ...this.learning.phrases, [phraseId]: updated },
    };
    return updated;
  }

  async handle(event: OrchestratorInputEvent): Promise<OrchestratorDecision> {
    switch (event.type) {
      case 'SESSION_STARTED':
        return this.onSessionStarted();
      case 'SESSION_ENDED':
        return this.onSessionEnded(event.status);
      case 'USER_UTTERANCE':
        return this.onUserUtterance(event.text);
      case 'TEACHER_UTTERANCE':
        return this.onTeacherUtterance(event.text);
      case 'HELP_REQUESTED':
        return this.onHelp(event.text);
      case 'TRANSLATION_REQUESTED':
        return this.onTranslation();
      case 'PAUSE':
        return this.onPause();
      case 'ERROR':
        return this.onError(event.message);
      case 'MICRO_ANSWER':
        return this.onMicroAnswer(event.text);
      case 'MICRO_SKIP':
        return this.resume();
      default:
        return this.continueResult('evento desconhecido');
    }
  }

  /** Fase 1A — entrada explícita do turno do aluno (Live). */
  async handleUserUtterance(userUtterance: string): Promise<OrchestratorDecision> {
    return this.handle({ type: 'USER_UTTERANCE', text: userUtterance });
  }

  /**
   * L0: quando ~90% do dailyMinutes passou, pedir encerramento suave (sem segunda duração).
   */
  maybeZeroLanguageWrapUp(): OrchestratorDecision | null {
    if (!isZeroLanguageMode(this.profile) || this.wrapUpSent) return null;
    if (this.pendingCorrectionRetry || this.pendingBlockRecovery) return null;
    const minutes = this.plan.training?.totalMinutes || this.profile.dailyMinutes || 20;
    const elapsedMin = (Date.now() - this.startedAt) / 60000;
    if (elapsedMin < minutes * 0.9) return null;
    this.wrapUpSent = true;
    const hint = this.ctx.targetItem || this.plan.target?.german || undefined;
    return {
      flow: 'continueConversation',
      action: this.plan.action,
      mode: 'GUIDED_CONVERSATION',
      reason: 'ZERO_LANGUAGE_MODE — wrap_up_por_tempo',
      targetItem: this.ctx.targetItem,
      geminiNudge: zeroLanguageWrapUpNudge({ minutes, learnedHint: hint }),
      eventsRecorded: [],
    };
  }

  /**
   * Volta à conversa após MicroPractice.
   * Envia nudge interno para o Gemini retomar com a pergunta de retorno.
   */
  async resume(): Promise<OrchestratorDecision> {
    const session = this.micro ? markMicroReturning(this.micro) : null;
    const returnPrompt = session?.returnPrompt || 'Also, weiter.';
    const phraseId = session?.phraseId;
    const result = session?.result;
    const independentOk = session?.independentOk || result === 'SUCCESS';
    const needsReview = result === 'NEEDS_REVIEW' || result === 'FAILED';
    const eventsRecorded: LearningEventType[] = [];

    if (session) {
      if (independentOk) {
        await saveLearningEvent('MICRO_PRACTICE_SUCCESS', {
          phraseId,
          context: JSON.stringify({
            attempts: session.attempts,
            helpUsed: session.helpUsed,
            independentSuccess: true,
          }),
        });
        eventsRecorded.push('MICRO_PRACTICE_SUCCESS');
        if (phraseId) {
          await this.recordPhraseEvent(phraseId, { type: 'produced', correct: true, withHelp: session.helpUsed });
          await saveLearningEvent(
            session.helpUsed ? 'PHRASE_PRODUCED_WITH_HINT' : 'PHRASE_PRODUCED',
            { phraseId, helpLevel: session.helpUsed ? session.startingSupport : 0, context: 'micro_done' },
          );
          eventsRecorded.push(session.helpUsed ? 'PHRASE_PRODUCED_WITH_HINT' : 'PHRASE_PRODUCED');
        }
      } else if (needsReview) {
        await saveLearningEvent('MICRO_PRACTICE_FAILED', {
          phraseId,
          context: JSON.stringify({
            attempts: session.attempts,
            result: 'NEEDS_REVIEW',
            helpUsed: session.helpUsed,
          }),
        });
        eventsRecorded.push('MICRO_PRACTICE_FAILED');
      }

      await saveLearningEvent('MICRO_PRACTICE_COMPLETED', {
        phraseId,
        context: JSON.stringify({
          result: result || (independentOk ? 'SUCCESS' : 'NEEDS_REVIEW'),
          attempts: session.attempts,
          reason: session.reason,
          originSessionId: session.originSessionId,
        }),
      });
      eventsRecorded.push('MICRO_PRACTICE_COMPLETED');
    }

    // Restaurar snapshot da conversa
    if (session?.snapshot) {
      const snap = session.snapshot;
      if (snap.topic) this.ctx.topic = snap.topic;
      if (snap.goal) this.ctx.currentGoal = snap.goal;
      if (snap.lastTeacherUtterance) this.ctx.lastTeacherUtterance = snap.lastTeacherUtterance;
      if (snap.targetItem) this.ctx.targetItem = snap.targetItem;
    }

    this.micro = null;
    this.ctx.mode = 'FREE_CONVERSATION';
    this.ctx.lastAction = 'converse';
    this.ctx.currentGoal = 'converse';
    this.turnsSinceLastMicro = 0;
    this.justErrored = false;
    this.sessionSupport = 0;

    if (independentOk && !needsReview) {
      const pid = session?.phraseId;
      if (pid) {
        const nba = await this.applyNbaAfterEvidence(pid);
        if (nba) {
          this.persist();
          return {
            ...nba,
            flow: 'resumeConversation',
            eventsRecorded,
            microPractice: null,
            microFeedback: 'Voltando à conversa…',
          };
        }
      }
    }
    this.persist();

    const nudgeSession = session
      ? { ...session, returnPrompt, independentOk, result: result || (independentOk ? 'SUCCESS' : 'NEEDS_REVIEW') }
      : null;

    return {
      flow: 'resumeConversation',
      action: 'converse',
      mode: 'FREE_CONVERSATION',
      reason: needsReview ? 'micropractice_needs_review' : 'micropractice_finished',
      targetItem: session?.targetItem ?? this.ctx.targetItem,
      geminiNudge: nudgeSession ? buildMicroResumeNudge(nudgeSession as MicroPracticeSession) : [
        '[INSTRUÇÃO INTERNA — não leia isto em voz alta]',
        'Volte à conversa.',
        `"${returnPrompt}"`,
      ].join('\n'),
      eventsRecorded,
      microPractice: null,
      microFeedback: needsReview
        ? 'Vamos revisar isso novamente mais tarde.'
        : 'Voltando à conversa…',
    };
  }

  private continueResult(reason: string, extras: Partial<OrchestratorDecision> = {}): OrchestratorDecision {
    const mode =
      this.ctx.mode === 'PEDAGOGICAL_INTERVENTION' && this.ctx.turnsSinceIntervention >= 1
        ? 'FREE_CONVERSATION'
        : this.ctx.mode;
    return {
      flow: 'continueConversation',
      action: this.plan.action,
      mode,
      reason,
      grammar: null,
      targetItem: this.ctx.targetItem,
      geminiNudge: null,
      eventsRecorded: extras.eventsRecorded ?? [],
      ...extras,
    };
  }

  private async onSessionStarted(): Promise<OrchestratorDecision> {
    await saveLearningEvent('SESSION_STARTED', { context: this.sessionId });
    const eventsRecorded: LearningEventType[] = ['SESSION_STARTED'];
    if (this.pendingReview) {
      await saveLearningEvent('REVIEW_STARTED', {
        phraseId: this.pendingReview.itemId,
        context: JSON.stringify({
          reviewType: this.pendingReview.type,
          reason: this.pendingReview.reason,
          prompt: this.pendingReview.prompt,
        }),
      });
      eventsRecorded.push('REVIEW_STARTED');
      this.persist();
      return {
        flow: 'continueConversation',
        action: this.plan.action,
        mode: this.ctx.mode,
        reason: `review_started:${this.pendingReview.type}`,
        targetItem: this.pendingReview.german,
        geminiNudge: buildReviewGeminiNudge(this.pendingReview),
        eventsRecorded,
      };
    }
    this.persist();
    if (this.followUpOpening && this.followUpEventId) {
      const ev = dueFollowUpEvent();
      if (ev && ev.id === this.followUpEventId) {
        markFollowedUp(ev.id);
        await saveLearningEvent('TEACHER_ADAPTATION', { context: 'follow_up_event' });
        eventsRecorded.push('TEACHER_ADAPTATION');
        return {
          flow: 'continueConversation',
          action: this.plan.action,
          mode: this.ctx.mode,
          reason: 'follow_up_real_world_event',
          targetItem: this.ctx.targetItem,
          geminiNudge: followUpNudge(ev),
          eventsRecorded,
        };
      }
    }
    return {
      flow: 'continueConversation',
      action: this.plan.action,
      mode: this.ctx.mode,
      reason: 'sessão iniciada com plano TeacherEngine',
      targetItem: this.ctx.targetItem,
      geminiNudge: null,
      eventsRecorded,
    };
  }

  private async onSessionEnded(status?: string): Promise<OrchestratorDecision> {
    await saveLearningEvent('SESSION_ENDED', { context: status || 'COMPLETED' });
    try {
      const { refreshPersonalLearningAfterSession } = await import('@/services/learning/AdaptationEngine');
      await refreshPersonalLearningAfterSession(this.profile, this.learning);
      const { syncPersonaFromAdaptation } = await import('@/services/coach/TeacherPersona');
      syncPersonaFromAdaptation();
    } catch {
      /* adaptação não bloqueia fim de sessão */
    }
    this.persist();
    return this.continueResult('sessão encerrada', { eventsRecorded: ['SESSION_ENDED'] });
  }

  private async onTeacherUtterance(text: string): Promise<OrchestratorDecision> {
    this.ctx.lastTeacherUtterance = text;
    if (/\b(?:sag|wiederhole|say|repeat|diga)\b/i.test(text)) {
      this.recentTeacherRequests = [...this.recentTeacherRequests, text].slice(-8);
    }
    if (isZeroLanguageMode(this.profile) && this.plan.target) {
      const tid = this.plan.target.id;
      const ttext = this.plan.target.german;
      if (this.l0TurnEvalSnapshot && this.l0TurnEvalSnapshot.targetId !== tid) {
        this.l0PreviousTargetId = this.l0TurnEvalSnapshot.targetId;
        this.l0PreviousTargetText = this.l0TurnEvalSnapshot.targetText;
      } else if (!this.l0PreviousTargetId && this.l0TurnEvalSnapshot) {
        this.l0PreviousTargetId = this.l0TurnEvalSnapshot.targetId;
        this.l0PreviousTargetText = this.l0TurnEvalSnapshot.targetText;
      }
      this.l0EvalSeq += 1;
      this.l0TurnEvalSnapshot = buildL0TurnEvalSnapshot({
        turnId: `${this.sessionId}:teach:${this.l0EvalSeq}`,
        targetId: tid,
        targetText: ttext,
        previousTargetId: this.l0PreviousTargetId,
        previousTargetText: this.l0PreviousTargetText,
        teacherText: text,
      });
      this.l0UniqueTargetsIntroduced.add(tid);
      this.logL0('TEACHER_TURN_SNAPSHOT', {
        turnId: this.l0TurnEvalSnapshot.turnId,
        currentTargetId: tid,
        currentTargetText: ttext,
        previousTargetId: this.l0PreviousTargetId,
        previousTargetText: this.l0PreviousTargetText,
        expectedAnswer: this.l0TurnEvalSnapshot.expectedAnswer,
        acceptedAnswers: this.l0TurnEvalSnapshot.acceptedAnswers,
        teacherText: text.slice(0, 160),
        uniqueIntroduced: this.l0UniqueTargetsIntroduced.size,
        deferredReviewItems: this.l0DeferredReviewCount,
      });
    }
    this.persist();
    return this.continueResult('fala do professor registrada');
  }

  private async onHelp(text?: string): Promise<OrchestratorDecision> {
    if (this.miniProvaMode && this.miniProvaSnapshot && !this.miniProvaSnapshot.completed) {
      this.helpUsedThisTurn = true;
      await saveLearningEvent('HELP_REQUESTED', { context: text, phraseId: this.plan.target?.id });
      return {
        flow: 'continueConversation',
        action: 'converse',
        mode: 'FREE_CONVERSATION',
        reason: 'miniprova_no_help',
        targetItem: this.ctx.targetItem,
        geminiNudge: null,
        eventsRecorded: ['HELP_REQUESTED'],
      };
    }

    if (this.simulatorMode && this.simulatorContext) {
      this.sessionSupport = escalateSupport(this.sessionSupport);
      this.helpUsedThisTurn = true;
      await saveLearningEvent('HELP_REQUESTED', {
        context: text,
        helpLevel: this.sessionSupport,
        phraseId: this.plan.target?.id,
      });
      return {
        flow: 'continueConversation',
        action: 'converse',
        mode: 'FREE_CONVERSATION',
        reason: `simulator_help_${this.sessionSupport}`,
        targetItem: this.ctx.targetItem,
        geminiNudge: buildSimulatorHelpNudge(this.sessionSupport, this.ctx.targetItem),
        eventsRecorded: ['HELP_REQUESTED'],
      };
    }

    const from = this.sessionSupport;
    this.sessionSupport = escalateSupport(this.sessionSupport);
    this.helpUsedThisTurn = true;
    const hint = this.getScaffoldHint();
    await saveLearningEvent('HELP_REQUESTED', {
      context: text,
      helpLevel: this.sessionSupport,
      phraseId: this.plan.target?.id,
    });
    await saveLearningEvent('SCAFFOLD_REQUESTED', {
      context: text,
      helpLevel: this.sessionSupport,
      phraseId: this.plan.target?.id,
    });
    await saveLearningEvent('SCAFFOLD_USED', {
      helpLevel: this.sessionSupport,
      phraseId: this.plan.target?.id,
      context: JSON.stringify({ from, to: this.sessionSupport, helpRequested: true }),
    });
    if (this.plan.target?.id) {
      await this.recordPhraseEvent(this.plan.target.id, { type: 'help', correct: false });
      recordHelpAttempt(this.plan.target.id, this.sessionSupport, false, {
        helpRequested: true,
        sessionId: this.sessionId,
      });
    }
    // Se microtreino ativo, sobe suporte lá também
    if (this.micro && this.micro.phase !== 'done') {
      const { requestMicroHelp } = await import('@/services/teacher/MicroPracticeEngine');
      this.micro = requestMicroHelp(this.micro);
    }
    this.ctx.mode = 'GUIDED_CONVERSATION';
    this.ctx.lastAction = 'practice';
    this.plan = { ...this.plan, scaffoldLevel: this.sessionSupport };
    this.persist();
    return {
      flow: 'intervenePedagogically',
      action: 'practice',
      mode: 'GUIDED_CONVERSATION',
      reason: `ajuda_nível_${this.sessionSupport}`,
      targetItem: this.ctx.targetItem,
      geminiNudge: [
        '[INSTRUÇÃO INTERNA — não leia isto em voz alta]',
        `supportLevel = ${this.sessionSupport}`,
        scaffoldingDirective(this.sessionSupport, this.plan.target?.german),
        hint?.displayText ? `Mostre agora (máximo neste nível): ${hint.displayText}` : '',
        'NÃO salte para a frase completa se o nível for < 5.',
      ].filter(Boolean).join('\n'),
      eventsRecorded: ['HELP_REQUESTED', 'SCAFFOLD_REQUESTED', 'SCAFFOLD_USED'],
      microPractice: this.micro,
      microFeedback: this.micro?.scaffoldDisplay || hint?.displayText || undefined,
    };
  }

  private async onTranslation(): Promise<OrchestratorDecision> {
    await saveLearningEvent('TRANSLATION_REQUESTED');
    return this.continueResult('tradução pedida', { eventsRecorded: ['TRANSLATION_REQUESTED'] });
  }

  private async onPause(): Promise<OrchestratorDecision> {
    this.persist();
    return this.continueResult('pausa');
  }

  private async onError(message: string): Promise<OrchestratorDecision> {
    this.persist();
    return this.continueResult(`erro de sessão: ${message}`);
  }

  private async onCorrectionRetry(text: string): Promise<OrchestratorDecision> {
    const pending = this.pendingCorrectionRetry!;
    const trimmed = text.trim();
    this.userTurns += 1;
    this.ctx.lastUserUtterance = trimmed;
    const eventsRecorded: LearningEventType[] = [];

    await saveLearningEvent('USER_UTTERANCE', {
      phraseId: pending.phraseId,
      context: JSON.stringify({
        text: trimmed,
        retryAttempt: pending.attempt,
        previousError: pending.userSaid,
        expected: pending.expected,
        errorType: pending.errorType,
      }),
      helpLevel: this.sessionSupport,
    });
    eventsRecorded.push('USER_UTTERANCE');

    const diagnosis = diagnoseProduction(trimmed, pending.expected);
    const l0RetryDiag = isZeroLanguageMode(this.profile)
      ? diagnoseAgainstAccepted(
        trimmed,
        buildL0AcceptedAnswers(pending.expected, this.ctx.lastTeacherUtterance || ''),
        pending.expected,
      )
      : null;
    const retryOk = l0RetryDiag
      ? l0RetryDiag.verdict === 'CORRECT'
      : (diagnosis.verdict === 'CORRECT' || looksLikeCorrectProduction(trimmed, pending.expected));
    if (retryOk) {
      this.pendingCorrectionRetry = null;
      this.ctx.mode = isZeroLanguageMode(this.profile) ? 'GUIDED_CONVERSATION' : 'FREE_CONVERSATION';
      this.ctx.targetItem = pending.expected;
      await saveLearningEvent('PHRASE_PRODUCED_WITH_HINT', {
        phraseId: pending.phraseId,
        context: trimmed,
        helpLevel: this.sessionSupport,
      });
      eventsRecorded.push('PHRASE_PRODUCED_WITH_HINT');
      await this.recordPhraseEvent(pending.phraseId, {
        type: 'produced',
        correct: true,
        withHelp: true,
      });
      const faded = recordHelpAttempt(pending.phraseId, this.sessionSupport, true, {
        sessionId: this.sessionId,
      });
      const prevSupport = this.sessionSupport;
      this.sessionSupport = faded.nextInSession;
      this.plan = { ...this.plan, scaffoldLevel: this.sessionSupport };
      if (faded.decision === 'decreaseSupport' || faded.decision === 'removeSupport') {
        await saveLearningEvent('SCAFFOLD_DECREASED', {
          phraseId: pending.phraseId,
          helpLevel: faded.nextInSession,
          context: JSON.stringify({ from: prevSupport, to: faded.nextInSession, afterRetry: true }),
        });
        eventsRecorded.push('SCAFFOLD_DECREASED');
      }
      this.justErrored = false;
      this.refreshPlan();
      this.persist();

      // L0: acerto após correção = AVANÇAR. Nunca rewalk frases anteriores
      // (erro em F → "Perfeito!" → próxima; NÃO voltar para Wie geht's / Morgen).
      if (isZeroLanguageMode(this.profile)) {
        this.pendingBlockRecovery = null;
        this.l0BlockReviewPhraseId = null;
        this.l0JustAcceptedId = pending.phraseId;
      }

      this.l0PhrasePhase = 'CORRECT';
      const nbaAfterRetry = await this.applyNbaAfterEvidence(pending.phraseId);
      if (nbaAfterRetry) {
        return {
          ...nbaAfterRetry,
          eventsRecorded: [...eventsRecorded, ...nbaAfterRetry.eventsRecorded],
          geminiNudge: [
            praiseGuidedRetryNudge(pending.expected),
            nbaAfterRetry.geminiNudge || '',
          ].filter(Boolean).join('\n'),
        };
      }

      return {
        flow: 'continueConversation',
        action: 'practice',
        mode: this.ctx.mode,
        reason: `correction_retry_ok:attempt_${pending.attempt}`,
        correction: pending.expected,
        targetItem: pending.expected,
        geminiNudge: praiseGuidedRetryNudge(pending.expected),
        eventsRecorded,
      };
    }

    // Ainda incorreto — mais ajuda OU postergar (L0: não monopolizar a sessão)
    const nextAttempt = pending.attempt + 1;
    await saveLearningEvent('PHRASE_FAILED', {
      phraseId: pending.phraseId,
      context: JSON.stringify({
        text: trimmed,
        attempt: nextAttempt,
        errorType: diagnosis.errorType || pending.errorType,
        expected: pending.expected,
      }),
      helpLevel: this.sessionSupport,
    });
    eventsRecorded.push('PHRASE_FAILED');
    await this.recordPhraseEvent(pending.phraseId, { type: 'produced', correct: false });
    recordHelpAttempt(pending.phraseId, this.sessionSupport, false, { helpRequested: true });

    if (isZeroLanguageMode(this.profile) && nextAttempt >= L0_MAX_CORRECTION_ATTEMPTS) {
      return this.deferL0DifficultyAndAdvance({
        phraseId: pending.phraseId,
        expected: pending.expected,
        userSaid: trimmed,
        eventsRecorded,
      });
    }

    this.sessionSupport = escalateSupport(this.sessionSupport);
    this.plan = { ...this.plan, scaffoldLevel: this.sessionSupport };
    this.pendingCorrectionRetry = {
      ...pending,
      attempt: nextAttempt,
      userSaid: trimmed,
      errorType: diagnosis.errorType || pending.errorType,
      hardPart: diagnosis.hardPart || pending.hardPart,
    };
    if (isZeroLanguageMode(this.profile)) {
      this.l0PhrasePhase = 'RETRY';
      // Sem block-recovery agressivo: dificuldade vai para revisão futura se persistir
    }
    this.ctx.mode = 'PEDAGOGICAL_INTERVENTION';
    this.ctx.targetItem = pending.expected;
    this.persist();
    return {
      flow: 'intervenePedagogically',
      action: 'practice',
      mode: 'PEDAGOGICAL_INTERVENTION',
      reason: `correction_retry_fail:attempt_${this.pendingCorrectionRetry.attempt}`,
      correction: pending.expected,
      targetItem: pending.expected,
      geminiNudge: teachFromErrorNudge({
        userSaid: trimmed,
        correction: pending.expected,
        hardPart: this.pendingCorrectionRetry.hardPart,
        errorType: this.pendingCorrectionRetry.errorType,
        attempt: this.pendingCorrectionRetry.attempt,
        tutorBand: this.tutorBandLabel(),
      }),
      eventsRecorded,
    };
  }

  /** L0: esgotou retries → registrar dificuldade e AVANÇAR (orçamento de tempo). */
  private async deferL0DifficultyAndAdvance(opts: {
    phraseId: string;
    expected: string;
    userSaid: string;
    eventsRecorded: LearningEventType[];
  }): Promise<OrchestratorDecision> {
    this.pendingCorrectionRetry = null;
    this.pendingBlockRecovery = null;
    this.l0BlockReviewPhraseId = null;
    if (!this.l0DeferredPhraseIds.includes(opts.phraseId)) {
      this.l0DeferredPhraseIds.push(opts.phraseId);
    }
    if (isSimulatorActive()) {
      recordSimulatorDeferred(opts.phraseId);
    }
    this.l0DeferredReviewCount += 1;
    this.justErrored = false;
    this.l0PhrasePhase = 'ADVANCE';
    this.l0JustAcceptedId = null;
    this.sessionSupport = escalateSupport(this.sessionSupport);
    this.plan = { ...this.plan, scaffoldLevel: this.sessionSupport };
    this.refreshPlan(opts.phraseId);
    this.persist();
    const next = this.plan.target;
    this.logL0('DEFER_DIFFICULTY_ADVANCE', {
      deferredId: opts.phraseId,
      deferredText: opts.expected,
      userSaid: opts.userSaid,
      nextTargetId: next?.id ?? null,
      nextTargetText: next?.german ?? null,
      deferredCount: this.l0DeferredReviewCount,
      uniqueIntroduced: this.l0UniqueTargetsIntroduced.size,
    });
    await saveLearningEvent('PHRASE_FAILED', {
      phraseId: opts.phraseId,
      context: JSON.stringify({
        deferred: true,
        text: opts.userSaid,
        expected: opts.expected,
        reason: 'L0_MAX_CORRECTION_ATTEMPTS',
      }),
      helpLevel: this.sessionSupport,
    });
    opts.eventsRecorded.push('PHRASE_FAILED');
    const deferReason = 'ZERO_LANGUAGE_MODE — dificuldade postergada; avançar cobertura';
    this.logL0Turn({
      teacherUtterance: this.ctx.lastTeacherUtterance || '',
      targetAtQuestionTime: opts.expected,
      userUtterance: opts.userSaid,
      evaluatedTarget: opts.expected,
      result: 'INCORRECT',
      nextTarget: next?.german ?? null,
      decisionReason: deferReason,
    });
    return {
      flow: 'continueConversation',
      action: next
        ? ((this.learning.phrases[next.id]?.timesCorrect ?? 0) === 0 ? 'introduce' : 'practice')
        : 'converse',
      mode: 'GUIDED_CONVERSATION',
      reason: deferReason,
      targetItem: next?.german ?? this.ctx.targetItem,
      correction: opts.expected,
      geminiNudge: deferDifficultyAndContinueNudge({
        hardPhrase: opts.expected,
        nextGerman: next?.german ?? null,
      }),
      eventsRecorded: opts.eventsRecorded,
    };
  }

  private async onUserUtterance(text: string): Promise<OrchestratorDecision> {
    const trimmed = text.trim();
    if (!trimmed) return this.continueResult('utterance vazia');

    const zeroModeEarly = isZeroLanguageMode(this.profile);
    const utteranceKeyEarly = `${this.sessionId}:${this.pendingCorrectionRetry?.phraseId || this.plan.target?.id || 'x'}:${trimmed.toLowerCase()}`;
    if (zeroModeEarly && this.l0LastEvalUtteranceKey === utteranceKeyEarly) {
      this.logL0('EVAL_IDEMPOTENT_SKIP', {
        utteranceKey: utteranceKeyEarly,
        userTranscript: trimmed,
        currentTargetId: this.plan.target?.id ?? null,
        currentTargetText: this.plan.target?.german ?? null,
      });
      return this.continueResult('utterance_idempotent', { eventsRecorded: [] });
    }

    // Durante microtreino, respostas vão para o ciclo do micro (não para a conversa livre)
    if (this.micro && this.micro.phase !== 'done') {
      return this.onMicroAnswer(trimmed);
    }

    if (this.pendingTransfer) {
      return this.onTransferAttempt(trimmed);
    }
    if (this.miniProvaSnapshot && !this.miniProvaSnapshot.completed) {
      return this.onMiniProvaAttempt(trimmed);
    }
    if (this.simulatorMode && this.simulatorContext) {
      return this.onSimulatorUtterance(trimmed);
    }
    if (this.pendingReview) {
      return this.onReviewAttempt(trimmed);
    }

    // Ciclo de correção pendente — avaliar nova tentativa ANTES de outros ramos
    // L0: se o plano já avançou para outro target e a fala casa com o target ATUAL,
    // não avaliar o callback antigo contra o target anterior.
    if (this.pendingCorrectionRetry) {
      if (
        isZeroLanguageMode(this.profile) &&
        this.plan.target?.id &&
        this.pendingCorrectionRetry.phraseId !== this.plan.target.id
      ) {
        const currentAccepted = buildL0AcceptedAnswers(
          this.plan.target.german,
          this.ctx.lastTeacherUtterance || '',
        );
        const currentHit = diagnoseAgainstAccepted(trimmed, currentAccepted, this.plan.target.german);
        if (currentHit.verdict === 'CORRECT') {
          this.logL0('STALE_RETRY_IGNORED', {
            pendingPhraseId: this.pendingCorrectionRetry.phraseId,
            pendingExpected: this.pendingCorrectionRetry.expected,
            currentTargetId: this.plan.target.id,
            currentTargetText: this.plan.target.german,
            userTranscript: trimmed,
            evaluationResult: 'CORRECT',
            matchedTargetId: this.plan.target.id,
          });
          this.pendingCorrectionRetry = null;
        } else {
          return this.onCorrectionRetry(trimmed);
        }
      } else {
        return this.onCorrectionRetry(trimmed);
      }
    }

    this.userTurns += 1;
    if (this.turnsSinceLastTransfer < 99) this.turnsSinceLastTransfer += 1;
    if (this.turnsSinceSpontaneousOpp < 99) this.turnsSinceSpontaneousOpp += 1;
    this.turnsSinceLastMicro += 1;
    this.ctx.lastUserUtterance = trimmed;
    this.ctx.turnsSinceIntervention += 1;
    this.ctx.recentItems = [...this.ctx.recentItems, trimmed].slice(-8);
    const usedHelp = this.helpUsedThisTurn;
    this.helpUsedThisTurn = false;

    // L0: avaliar SEMPRE contra o alemão do target (ou snapshot do turno),
    // NUNCA contra plan.target.expected truncado ("ich arbeite" de 3 tokens).
    const zeroMode = isZeroLanguageMode(this.profile);
    const snap = zeroMode ? this.l0TurnEvalSnapshot : null;
    const expected = zeroMode
      ? (snap?.expectedAnswer || this.plan.target?.german || this.ctx.targetItem || null)
      : this.ctx.mode === 'PEDAGOGICAL_INTERVENTION'
        ? this.ctx.targetItem || this.plan.target?.expected || this.plan.target?.german
        : this.plan.target?.expected || this.plan.target?.german;
    const utteranceKey = `${this.sessionId}:${this.plan.target?.id || 'x'}:${trimmed.toLowerCase()}`;
    if (zeroMode) this.l0LastEvalUtteranceKey = utteranceKey;

    const eventsRecorded: LearningEventType[] = [];
    const productionCtx = JSON.stringify({
      text: trimmed,
      sessionId: this.sessionId,
      topic: this.ctx.topic,
      targetItemId: this.plan.target?.id ?? null,
      expectedText: expected ?? null,
      helpUsed: usedHelp,
      independent: !usedHelp,
      lastTeacher: this.ctx.lastTeacherUtterance || null,
      turnId: snap?.turnId ?? null,
      acceptedAnswers: snap?.acceptedAnswers ?? null,
    });

    await saveLearningEvent('USER_UTTERANCE', {
      phraseId: this.plan.target?.id,
      context: productionCtx,
      helpLevel: usedHelp ? this.sessionSupport : 0,
    });
    eventsRecorded.push('USER_UTTERANCE');

    try {
      ingestUserUtterance(trimmed, this.profile, this.ctx.topic);
    } catch { /* */ }

    const prepare = startPrepareMode(trimmed);
    if (prepare) {
      await saveLearningEvent('REAL_WORLD_EVENT_CREATED', { context: JSON.stringify({ topic: prepare.event.topic, type: prepare.event.type }) });
      eventsRecorded.push('REAL_WORLD_EVENT_CREATED');
      return {
        flow: 'continueConversation',
        action: 'practice',
        mode: 'GUIDED_CONVERSATION',
        reason: 'prepare_mode',
        targetItem: prepare.event.topic,
        geminiNudge: prepare.nudge,
        eventsRecorded,
      };
    }

    const post = applyPostEventLearning(trimmed);
    if (post) {
      await saveLearningEvent('POST_EVENT_LEARNING', { context: JSON.stringify({ eventId: post.eventId, note: post.learningNote }) });
      eventsRecorded.push('POST_EVENT_LEARNING');
      return {
        flow: 'continueConversation',
        action: 'practice',
        mode: 'GUIDED_CONVERSATION',
        reason: 'post_event_learning',
        targetItem: post.structure || this.ctx.targetItem,
        geminiNudge: post.nudge,
        eventsRecorded,
      };
    }

    const grammar = detectPossibleGrammarError(trimmed);

    try {
      // Merge (não substituir): evita wipe que faz pickZeroLanguageTarget voltar ao início
      const loaded = await MemoryService.loadConfidenceMap();
      this.learning = {
        ...this.learning,
        phrases: { ...this.learning.phrases, ...loaded },
      };
    } catch { /* keep */ }

    // L0: avaliar cedo contra o TARGET DO TURNO (snapshot) + lastTeacher fresco.
    // Spontaneous/grammar NÃO podem interceptar resposta válida de variação (ex.: Arbeitest du?).
    const l0Snap = zeroMode ? this.l0TurnEvalSnapshot : null;
    const l0EvalTargetId = l0Snap?.targetId || this.plan.target?.id || null;
    const l0EvalTargetText =
      l0Snap?.targetText ||
      this.plan.target?.german ||
      expected ||
      '';
    const l0TeacherForAccept =
      this.ctx.lastTeacherUtterance || l0Snap?.teacherText || '';
    const l0AcceptedEarly = zeroMode
      ? buildL0AcceptedAnswers(l0EvalTargetText, l0TeacherForAccept)
      : [];
    const l0DiagEarly = zeroMode
      ? diagnoseAgainstAccepted(trimmed, l0AcceptedEarly, l0EvalTargetText)
      : null;
    const l0AnswerMatchesTurn =
      zeroMode && (l0DiagEarly?.verdict === 'CORRECT' || l0DiagEarly?.verdict === 'NEEDS_REPAIR');

    if (grammar && !(zeroMode && l0AnswerMatchesTurn)) {
      const recentlySame =
        this.ctx.mode === 'PEDAGOGICAL_INTERVENTION' &&
        this.ctx.turnsSinceIntervention < 2 &&
        this.ctx.recentMistakes[0]?.includes(grammar.pattern);

      if (!recentlySame) {
        await saveLearningEvent('PHRASE_FAILED', {
          phraseId: grammar.phraseId,
          context: trimmed,
        });
        eventsRecorded.push('PHRASE_FAILED');
        await this.recordPhraseEvent(grammar.phraseId, { type: 'produced', correct: false });
        const helpUpdate = recordHelpAttempt(grammar.phraseId, this.sessionSupport, false);
        this.sessionSupport = helpUpdate.nextInSession;
        this.plan = { ...this.plan, scaffoldLevel: this.sessionSupport };

        try {
          const { recordSessionMistake } = await import('@/services/teacher/sessionContinuity');
          recordSessionMistake(trimmed, grammar.correction);
        } catch { /* ignore */ }

        const conf = this.learning.phrases[grammar.phraseId];
        const recurring = this.ctx.recentMistakes.some((m) => m.includes(grammar.pattern));
        const startMicro = shouldStartMicroPractice({
          grammar,
          recentMistakes: this.ctx.recentMistakes,
          confidence: conf?.confidence,
          timesCorrect: conf?.timesCorrect,
          turnsSinceLastMicro: this.turnsSinceLastMicro,
        });

        const kind = decideInterruption({
          hasGrammarError: true,
          recurringError: recurring,
          shouldMicro: startMicro,
          pendingReview: !!this.pendingReview,
          pendingTransfer: !!this.pendingTransfer,
          spontaneous: false,
          strategy: loadPersonalLearningProfile().teachingStrategy,
          naturalness: {
            interruptionsLast10: this.interruptionsLast10,
            briefCorrectionsLast10: this.briefCorrectionsLast10,
            microStartsLast10: this.microStartsLast10,
            topicRepeats: 0,
            turnsSinceLastIntervention: this.ctx.turnsSinceIntervention,
          },
        });

        this.ctx.recentMistakes = [`${grammar.pattern}:${trimmed}`, ...this.ctx.recentMistakes].slice(0, 6);
        this.ctx.lastAction = 'practice';
        this.ctx.currentGoal = 'practice';
        this.ctx.targetItem = grammar.correction;
        this.justErrored = true;

        if (kind === 'CORRECT_BRIEFLY') {
          this.briefCorrectionsLast10 += 1;
          this.ctx.turnsSinceIntervention = 0;
          this.ctx.mode = 'PEDAGOGICAL_INTERVENTION';
          this.pendingCorrectionRetry = {
            phraseId: grammar.phraseId,
            expected: grammar.correction,
            attempt: 1,
            userSaid: trimmed,
            errorType: 'conjugation',
          };
          this.persist();
          return {
            flow: 'intervenePedagogically',
            action: 'practice',
            mode: 'PEDAGOGICAL_INTERVENTION',
            reason: `correct_briefly:${grammar.pattern}`,
            grammar,
            correction: grammar.correction,
            targetItem: grammar.correction,
            geminiNudge: briefCorrectionNudge(trimmed, grammar.correction),
            eventsRecorded,
          };
        }

        this.ctx.turnsSinceIntervention = 0;
        this.plan = { ...this.plan, action: 'practice' };
        this.interruptionsLast10 += 1;

        if (startMicro) {
          const micro = createMicroPractice({
            grammar,
            originConversationId: this.sessionId,
            lastTeacherUtterance: this.ctx.lastTeacherUtterance,
            confidence: conf,
            intensiveMode: this.ctx.intensiveMode,
            recurring,
            level: this.profile.level,
            originConversationTurnId: `turn-${this.userTurns}`,
            currentSessionSupport: this.sessionSupport,
            snapshot: {
              lastTeacherUtterance: this.ctx.lastTeacherUtterance,
              lastUserUtterance: trimmed,
              topic: this.ctx.topic,
              goal: this.ctx.currentGoal,
              targetItem: grammar.correction,
              mode: this.ctx.mode,
            },
          });
          // Explicação mínima → guided com ajuda mínima (não frase completa)
          const advanced = advanceMicroPractice(micro);
          this.micro = advanced.session;
          this.sessionSupport = advanced.session.currentSupportLevel;
          this.plan = { ...this.plan, scaffoldLevel: this.sessionSupport };
          this.ctx.mode = 'MICRO_PRACTICE';
          this.turnsSinceLastMicro = 0;
          this.microStartsLast10 += 1;
          this.persist();

          await saveLearningEvent('MICRO_PRACTICE_STARTED', {
            phraseId: grammar.phraseId,
            context: JSON.stringify({
              reason: advanced.session.reason,
              target: grammar.correction,
              originSessionId: this.sessionId,
              userSaid: trimmed,
              supportLevel: advanced.session.currentSupportLevel,
            }),
            helpLevel: advanced.session.currentSupportLevel,
          });
          await saveLearningEvent('SCAFFOLD_USED', {
            phraseId: grammar.phraseId,
            helpLevel: advanced.session.currentSupportLevel,
            context: JSON.stringify({
              display: advanced.session.scaffoldDisplay,
              phase: advanced.session.phase,
            }),
          });
          eventsRecorded.push('MICRO_PRACTICE_STARTED', 'SCAFFOLD_USED');

          return {
            flow: 'startMicroPractice',
            action: 'practice',
            mode: 'MICRO_PRACTICE',
            reason: `micropractice:${grammar.pattern}`,
            grammar,
            correction: grammar.correction,
            targetItem: grammar.correction,
            geminiNudge: buildMicroStartNudge(advanced.session),
            eventsRecorded,
            microPractice: this.micro,
            microFeedback: advanced.feedback,
          };
        }

        this.ctx.mode = 'PEDAGOGICAL_INTERVENTION';
        this.pendingCorrectionRetry = {
          phraseId: grammar.phraseId,
          expected: grammar.correction,
          attempt: 1,
          userSaid: trimmed,
          errorType: 'conjugation',
        };
        this.persist();

        return {
          flow: 'intervenePedagogically',
          action: 'practice',
          mode: 'PEDAGOGICAL_INTERVENTION',
          reason: `possibleGrammarError:${grammar.pattern}`,
          grammar,
          correction: grammar.correction,
          targetItem: grammar.correction,
          geminiNudge: buildInterventionNudge(grammar, 'practice'),
          eventsRecorded,
          microPractice: null,
        };
      }
    }

    if (
      this.ctx.mode === 'PEDAGOGICAL_INTERVENTION' &&
      looksLikeCorrectProduction(trimmed, this.ctx.targetItem || undefined)
    ) {
      const phraseId = this.plan.target?.id || this.ctx.targetItem || 'survival-arbeite';
      this.pendingCorrectionRetry = null;
      await saveLearningEvent('PHRASE_PRODUCED_WITH_HINT', {
        phraseId,
        context: trimmed,
        helpLevel: this.sessionSupport,
      });
      eventsRecorded.push('PHRASE_PRODUCED_WITH_HINT');
      await this.recordPhraseEvent(phraseId, {
        type: 'produced',
        correct: true,
        withHelp: true,
      });
      const faded = recordHelpAttempt(phraseId, this.sessionSupport, true, {
        sessionId: this.sessionId,
      });
      const prevSupport = this.sessionSupport;
      this.sessionSupport = faded.nextInSession;
      this.plan = { ...this.plan, scaffoldLevel: this.sessionSupport };
      if (faded.decision === 'decreaseSupport' || faded.decision === 'removeSupport') {
        await saveLearningEvent('SCAFFOLD_DECREASED', {
          phraseId,
          helpLevel: faded.nextInSession,
          context: JSON.stringify({ from: prevSupport, to: faded.nextInSession }),
        });
        eventsRecorded.push('SCAFFOLD_DECREASED');
      }
      this.ctx.mode = isZeroLanguageMode(this.profile) ? 'GUIDED_CONVERSATION' : 'FREE_CONVERSATION';
      this.ctx.lastAction = 'practice';
      this.ctx.currentGoal = 'practice';
      this.justErrored = false;
      this.refreshPlan();
      this.persist();
      const nba = await this.applyNbaAfterEvidence(phraseId);
      if (nba) {
        return {
          ...nba,
          geminiNudge: praiseGuidedRetryNudge(this.ctx.targetItem || trimmed),
          eventsRecorded: [...eventsRecorded, ...nba.eventsRecorded],
        };
      }
      return this.continueResult('produção correta após correção — guiada', {
        action: 'practice',
        mode: this.ctx.mode,
        eventsRecorded,
        geminiNudge: praiseGuidedRetryNudge(this.ctx.targetItem || trimmed),
      });
    }

    // Preferir avaliação precoce L0 (target do turno + teacher fresco)
    const l0Accepted = zeroMode
      ? (l0AcceptedEarly.length
        ? l0AcceptedEarly
        : buildL0AcceptedAnswers(l0EvalTargetText || expected || '', l0TeacherForAccept))
      : [];
    const l0Diag = zeroMode
      ? (l0DiagEarly || diagnoseAgainstAccepted(trimmed, l0Accepted, l0EvalTargetText || expected))
      : null;
    const verdict: ProductionVerdict = zeroMode
      ? (l0Diag!.verdict === 'CORRECT'
        ? 'CORRECT'
        : l0Diag!.verdict === 'NEEDS_REPAIR'
          ? 'NEEDS_REPAIR'
          : l0Diag!.verdict === 'INCORRECT'
            ? 'INCORRECT'
            : evaluateProduction(trimmed, l0EvalTargetText || expected))
      : evaluateProduction(trimmed, expected);

    // L0: com target explícito, UNKNOWN não pode “passar” — trata como erro da frase atual
    const effectiveVerdict: ProductionVerdict =
      zeroMode && verdict === 'UNKNOWN' && !!(l0EvalTargetText || this.plan.target?.german || expected)
        ? 'INCORRECT'
        : verdict;

    if (zeroMode) {
      this.logL0('EVAL_TURN', {
        sessionId: this.sessionId,
        turnId: snap?.turnId ?? `user-${this.userTurns}`,
        utteranceId: utteranceKey,
        turnTargetId: l0EvalTargetId,
        turnTargetText: l0EvalTargetText,
        currentTargetId: this.plan.target?.id ?? null,
        currentTargetText: this.plan.target?.german ?? null,
        evaluatedTargetId: l0EvalTargetId,
        previousTargetId: snap?.previousTargetId ?? this.l0PreviousTargetId,
        previousTargetText: snap?.previousTargetText ?? this.l0PreviousTargetText,
        expectedAnswer: l0EvalTargetText || expected,
        acceptedAnswers: l0Accepted,
        userTranscript: trimmed,
        evaluationResult: effectiveVerdict,
        rawVerdict: verdict,
        matchedTargetId: l0Diag?.matchedAnswer ? l0EvalTargetId : null,
        matchedAnswer: l0Diag?.matchedAnswer ?? null,
        matchScore: effectiveVerdict === 'CORRECT' ? 1 : effectiveVerdict === 'NEEDS_REPAIR' ? 0.5 : 0,
        nearMiss: l0Diag?.errorType === 'pronunciation_approx' || effectiveVerdict === 'NEEDS_REPAIR',
        helpLevel: this.sessionSupport,
        failureCount: l0EvalTargetId
          ? (this.l0BlockErrors[findZeroLanguageBlock(l0EvalTargetId)?.id || ''] ?? 0)
          : 0,
        recoveryReason: this.pendingBlockRecovery ? 'pendingBlockRecovery' : null,
        nextTargetId: this.plan.target?.id ?? null,
        nextTargetText: this.plan.target?.german ?? null,
        evaluatedAgainst: l0EvalTargetText || expected,
        truncatedExpectedAvoided: this.plan.target?.expected ?? null,
        teacherForAccept: l0TeacherForAccept.slice(0, 120),
      });
    }

    const spontaneous = analyzeSpontaneousUse({
      teacherPrompt: this.ctx.lastTeacherUtterance,
      userResponse: trimmed,
      targetItems: this.plan.target
        ? [{ id: this.plan.target.id, german: this.plan.target.german, expected: this.plan.target.expected }]
        : [],
      knownPhrases: this.phrases.map((p) => ({ id: p.id, german: p.german })),
      pedagogicalKind: this.plan.action,
      orchestratorAction: this.plan.action,
      conversationMode: this.ctx.mode,
      pendingTransfer: !!this.pendingTransfer,
      opportunity: this.spontaneousOpportunity,
      recentRequests: this.recentTeacherRequests,
      sessionId: this.sessionId,
      recentAttempts: this.ctx.lastTeacherUtterance
        ? [{ phraseId: this.plan.target?.id, teacherSaid: this.ctx.lastTeacherUtterance }]
        : undefined,
    });

    // L0 com target do turno: NÃO tratar como spontaneous (senão timesCorrect=0 → “aguardando aceitação”
    // e o professor re-modela Ich arbeite = regressão UX).
    const l0GuidedTurn = zeroMode && !!l0EvalTargetId;

    // Oportunidade aberta: resposta válida sem o target — NÃO punir, NÃO abrir micro
    if (
      !l0GuidedTurn &&
      this.spontaneousOpportunity &&
      !spontaneous.confirmed &&
      spontaneous.classification !== 'GUIDED' &&
      spontaneous.classification !== 'TRANSFER'
    ) {
      this.spontaneousOpportunity = null;
      this.ctx.lastAction = 'converse';
      this.persist();
      return this.continueResult('oportunidade espontânea — resposta livre aceita', {
        action: 'converse',
        mode: 'FREE_CONVERSATION',
        eventsRecorded,
        geminiNudge: [
          '[INSTRUÇÃO INTERNA — não leia isto em voz alta]',
          'Resposta válida. Continue a conversa naturalmente. Sem MicroPractice. Sem "teste".',
        ].join('\n'),
      });
    }

    if (!l0GuidedTurn && spontaneous.confirmed && spontaneous.phraseId) {
      const eventId = makeSpontaneousEventId(this.sessionId, spontaneous.phraseId, trimmed);
      if (this.lastSpontaneousEventId === eventId) {
        return this.continueResult('spontaneous_idempotent', { eventsRecorded });
      }
      this.lastSpontaneousEventId = eventId;
      const mem = recordConfirmedSpontaneous({
        phraseId: spontaneous.phraseId,
        eventId,
        sessionId: this.sessionId,
      });
      await saveLearningEvent('PHRASE_PRODUCED', {
        phraseId: spontaneous.phraseId,
        context: trimmed,
        helpLevel: 0,
      });
      eventsRecorded.push('PHRASE_PRODUCED');
      await saveLearningEvent('PHRASE_USED_SPONTANEOUSLY', {
        phraseId: spontaneous.phraseId,
        helpLevel: 0,
        context: JSON.stringify({
          eventId,
          sessionId: this.sessionId,
          targetItemId: spontaneous.phraseId,
          userText: trimmed,
          teacherTextBefore: this.ctx.lastTeacherUtterance,
          context: this.spontaneousOpportunity?.context || this.ctx.topic,
          productionOrigin: spontaneous.productionOrigin,
          confidence: spontaneous.confidence,
          spontaneousCount: mem.spontaneousCount,
        }),
      });
      eventsRecorded.push('PHRASE_USED_SPONTANEOUSLY');
      await this.recordPhraseEvent(spontaneous.phraseId, { type: 'spontaneous', correct: true });
      recordHelpAttempt(spontaneous.phraseId, 0, true);
      this.justErrored = false;
      this.spontaneousOpportunity = null;
      this.ctx.lastAction = 'spontaneous';
      this.persist();
      const nba = await this.applyNbaAfterEvidence(spontaneous.phraseId);
      if (nba) {
        return {
          ...nba,
          eventsRecorded: [...eventsRecorded, ...nba.eventsRecorded],
          geminiNudge: [
            '[INSTRUÇÃO INTERNA — não leia isto em voz alta]',
            'O aluno usou a estrutura sozinho. Feedback CURTO em alemão: "Sehr gut."',
            nba.reason,
            'NÃO diga "spontaneous". NÃO abra exercício. Continue a conversa.',
          ].join('\n'),
        };
      }
      return {
        flow: 'continueConversation',
        action: 'spontaneous',
        mode: 'FREE_CONVERSATION',
        reason: 'spontaneous_confirmed',
        targetItem: spontaneous.german,
        geminiNudge: [
          '[INSTRUÇÃO INTERNA — não leia isto em voz alta]',
          'O aluno usou a estrutura sozinho. Feedback CURTO em alemão: "Sehr gut."',
          'NÃO diga "spontaneous". NÃO abra exercício. Continue a conversa.',
        ].join('\n'),
        eventsRecorded,
      };
    }

    if (l0EvalTargetId && effectiveVerdict === 'CORRECT') {
      const targetId = l0EvalTargetId;
      if (isZeroLanguageMode(this.profile)) {
        this.l0PhrasePhase = 'CORRECT';
      }
      // Introduce/practice com scaffold alto = produção guiada (não independência automática)
      const guidedProduction =
        usedHelp ||
        this.sessionSupport >= 3 ||
        this.plan.action === 'introduce' ||
        isZeroLanguageMode(this.profile);
      await saveLearningEvent(guidedProduction ? 'PHRASE_PRODUCED_WITH_HINT' : 'PHRASE_PRODUCED', {
        phraseId: targetId,
        context: trimmed,
        helpLevel: guidedProduction ? this.sessionSupport : 0,
      });
      eventsRecorded.push(guidedProduction ? 'PHRASE_PRODUCED_WITH_HINT' : 'PHRASE_PRODUCED');
      await this.recordPhraseEvent(targetId, {
        type: 'produced',
        correct: true,
        withHelp: guidedProduction,
      });
      UserMetricsStore.recordSpeechOutcome({
        correct: true,
        withHint: usedHelp || this.sessionSupport > 0,
      });
      UserMetricsStore.syncFromLearning(this.learning);
      const prevSupport = this.sessionSupport;
      const faded = recordHelpAttempt(targetId, this.sessionSupport, true, {
        sessionId: this.sessionId,
      });
      this.sessionSupport = faded.nextInSession;
      this.plan = { ...this.plan, scaffoldLevel: this.sessionSupport };
      if (!guidedProduction) {
        await saveLearningEvent('INDEPENDENT_RESPONSE', {
          phraseId: targetId,
          helpLevel: 0,
          context: trimmed,
        });
        eventsRecorded.push('INDEPENDENT_RESPONSE');
      }
      if (faded.decision === 'decreaseSupport' || faded.decision === 'removeSupport') {
        await saveLearningEvent('SCAFFOLD_DECREASED', {
          phraseId: targetId,
          helpLevel: faded.nextInSession,
          context: JSON.stringify({ from: prevSupport, to: faded.nextInSession }),
        });
        eventsRecorded.push('SCAFFOLD_DECREASED');
      }
      this.justErrored = false;
      if (isZeroLanguageMode(this.profile)) {
        this.l0JustAcceptedId = targetId;
        if (this.l0CorrectStreakTargetId === targetId) this.l0CorrectStreakOnTarget += 1;
        else {
          this.l0CorrectStreakTargetId = targetId;
          this.l0CorrectStreakOnTarget = 1;
        }
        if (this.l0CorrectStreakOnTarget >= L0_MAX_IMMEDIATE_CORRECT_STREAK) {
          this.logL0('TARGET_STUCK_STREAK', {
            targetId,
            streak: this.l0CorrectStreakOnTarget,
            action: 'force_exclude_and_advance',
          });
        }
        this.refreshPlan(targetId);
        ChunkTrackerStore.recordCorrect({
          phraseId: targetId,
          nextPhraseId: this.plan.target?.id ?? null,
        });
      } else if (isA1LiveMode(this.profile) && isA1TargetId(targetId)) {
        this.refreshPlan(targetId);
      } else {
        this.refreshPlan();
      }
      this.persist();
      const nba = await this.applyNbaAfterEvidence(targetId);
      if (nba) {
        if (zeroMode) {
          this.logL0Turn({
            teacherUtterance: this.ctx.lastTeacherUtterance || l0TeacherForAccept || '',
            targetAtQuestionTime: l0EvalTargetText || null,
            userUtterance: trimmed,
            evaluatedTarget: l0EvalTargetText || null,
            result: 'CORRECT',
            nextTarget: this.plan.target?.german ?? nba.targetItem ?? null,
            decisionReason: nba.reason,
          });
        }
        return { ...nba, eventsRecorded: [...eventsRecorded, ...nba.eventsRecorded] };
      }
    } else if (
      l0EvalTargetId &&
      (effectiveVerdict === 'INCORRECT' || effectiveVerdict === 'NEEDS_REPAIR')
    ) {
      const targetId = l0EvalTargetId;
      const targetGerman = l0EvalTargetText || this.plan.target?.german || '';
      const diagnosis = zeroMode
        ? (l0Diag || diagnoseProduction(trimmed, targetGerman))
        : diagnoseProduction(trimmed, targetGerman);
      await saveLearningEvent('PHRASE_FAILED', {
        phraseId: targetId,
        context: JSON.stringify({
          text: trimmed,
          expected: targetGerman,
          errorType: diagnosis.errorType || (effectiveVerdict === 'NEEDS_REPAIR' ? 'pronunciation_approx' : 'mismatch'),
          hardPart: diagnosis.hardPart,
          attempt: 1,
          turnTargetId: l0EvalTargetId,
          evaluatedTargetId: targetId,
        }),
        helpLevel: this.sessionSupport,
      });
      eventsRecorded.push('PHRASE_FAILED');
      await this.recordPhraseEvent(targetId, { type: 'produced', correct: false });
      UserMetricsStore.recordSpeechOutcome({
        correct: false,
        withHint: usedHelp || this.sessionSupport > 0,
      });
      const helpUpdate = recordHelpAttempt(targetId, this.sessionSupport, false);
      this.sessionSupport = escalateSupport(helpUpdate.nextInSession);
      this.plan = { ...this.plan, scaffoldLevel: this.sessionSupport };
      this.ctx.mode = 'PEDAGOGICAL_INTERVENTION';
      this.ctx.targetItem = targetGerman;
      this.ctx.recentMistakes = [`${diagnosis.errorType || 'mismatch'}:${trimmed}`, ...this.ctx.recentMistakes].slice(0, 6);
      this.justErrored = true;
      const errorType: ProductionErrorType =
        diagnosis.errorType || (effectiveVerdict === 'NEEDS_REPAIR' ? 'pronunciation_approx' : 'mismatch');
      if (isZeroLanguageMode(this.profile)) {
        this.l0CorrectStreakOnTarget = 0;
        this.l0CorrectStreakTargetId = null;
        // Em retry, NÃO excluir o target atual
        if (this.l0JustAcceptedId === targetId) this.l0JustAcceptedId = null;
      }
      this.pendingCorrectionRetry = {
        phraseId: targetId,
        expected: targetGerman,
        attempt: 1,
        userSaid: trimmed,
        errorType,
        hardPart: diagnosis.hardPart,
      };
      if (isZeroLanguageMode(this.profile)) {
        this.l0PhrasePhase = effectiveVerdict === 'NEEDS_REPAIR' ? 'NEAR_MISS' : 'INCORRECT';
        // Sem block-recovery que volta a cumprimentos: retries locais + defer depois
        this.pendingBlockRecovery = null;
      } else if (
        shouldRecoverZeroLanguageBlock(targetId, effectiveVerdict, errorType)
      ) {
        this.pendingBlockRecovery = { phraseId: targetId, failedGerman: targetGerman };
      } else {
        this.pendingBlockRecovery = null;
      }
      try {
        const { recordSessionMistake } = await import('@/services/teacher/sessionContinuity');
        recordSessionMistake(trimmed, targetGerman);
      } catch { /* ignore */ }
      this.persist();
      this.logL0('AFTER_EVAL_MISMATCH', {
        evaluation: errorType,
        attemptCount: 1,
        shouldAdvance: false,
        recoveryLevel: 'RETRY_CURRENT',
        selectedNextTarget: targetId,
        evaluatedTargetId: targetId,
        turnTargetId: l0EvalTargetId,
      });
      const mismatchReason = `target_mismatch:${errorType}`;
      if (zeroMode) {
        this.logL0Turn({
          teacherUtterance: this.ctx.lastTeacherUtterance || l0TeacherForAccept || '',
          targetAtQuestionTime: l0EvalTargetText || null,
          userUtterance: trimmed,
          evaluatedTarget: l0EvalTargetText || null,
          result: effectiveVerdict === 'NEEDS_REPAIR' ? 'NEAR_MISS' : 'INCORRECT',
          nextTarget: targetGerman,
          decisionReason: mismatchReason,
        });
      }
      return {
        flow: 'intervenePedagogically',
        action: 'practice',
        mode: 'PEDAGOGICAL_INTERVENTION',
        reason: mismatchReason,
        correction: targetGerman,
        targetItem: targetGerman,
        geminiNudge: teachFromErrorNudge({
          userSaid: trimmed,
          correction: targetGerman,
          hardPart: diagnosis.hardPart,
          errorType,
          attempt: 1,
          tutorBand: this.tutorBandLabel(),
        }),
        eventsRecorded,
      };
    } else if (!l0GuidedTurn && spontaneous.productionOrigin === 'TRANSFER') {
      // Elicitação de transfer sem pending — tratar como produção correta do target se match
      if (spontaneous.phraseId && spontaneous.confidence >= 0.72) {
        await saveLearningEvent('PHRASE_PRODUCED', {
          phraseId: spontaneous.phraseId,
          context: trimmed,
          helpLevel: this.sessionSupport,
        });
        eventsRecorded.push('PHRASE_PRODUCED');
        await this.recordPhraseEvent(spontaneous.phraseId, {
          type: 'produced',
          correct: true,
          withHelp: usedHelp,
        });
      }
    } else {
      await saveLearningEvent('UNCLASSIFIED_USER_UTTERANCE', { context: productionCtx });
      eventsRecorded.push('UNCLASSIFIED_USER_UTTERANCE');
      MemoryService.recordUnclassifiedUtterance({
        text: trimmed,
        sessionId: this.sessionId,
        topic: this.ctx.topic,
        lastTeacher: this.ctx.lastTeacherUtterance || undefined,
      });
    }

    this.refreshPlan();
    if (this.ctx.mode === 'PEDAGOGICAL_INTERVENTION' && this.ctx.turnsSinceIntervention >= 2) {
      this.ctx.mode = 'FREE_CONVERSATION';
    }
    this.ctx.lastAction = this.plan.action;
    this.persist();

    const canOpenNaturalReview = !this.justErrored && !this.pendingTransfer && !this.pendingReview;
    if (canOpenNaturalReview) {
      const natural = this.tryBeginReviewOpportunity('natural_due');
      if (natural) {
        const opened = this.getPendingReview();
        await saveLearningEvent('REVIEW_STARTED', {
          phraseId: opened?.itemId,
          context: JSON.stringify({ type: opened?.type, reason: natural.reason }),
        });
        return {
          ...natural,
          eventsRecorded: [...eventsRecorded, 'REVIEW_STARTED', ...natural.eventsRecorded],
        };
      }
    }

    return this.continueResult('continuar conversa — sem intervenção necessária', {
      action: this.plan.action,
      mode: this.ctx.mode,
      eventsRecorded,
    });
  }

  private async onMicroAnswer(text: string): Promise<OrchestratorDecision> {
    if (!this.micro || this.micro.phase === 'done' || this.micro.status === 'completed') {
      return this.resume();
    }

    const phaseBefore = this.micro.phase;
    const supportBefore = this.micro.currentSupportLevel;
    const utterance = text.trim();
    const result = advanceMicroPractice(this.micro, utterance || undefined);
    this.micro = result.session;
    this.sessionSupport = this.micro.currentSupportLevel;
    this.plan = { ...this.plan, scaffoldLevel: this.sessionSupport };

    const eventsRecorded: LearningEventType[] = [];
    if (utterance) {
      await saveLearningEvent('MICRO_PRACTICE_ATTEMPT', {
        phraseId: this.micro.phraseId,
        context: JSON.stringify({
          text: utterance,
          correct: result.correct,
          step: phaseBefore,
          attempts: this.micro.attempts,
          supportLevel: supportBefore,
          helpRequested: this.micro.helpRequested,
          responseTimeMs: Date.now() - this.micro.startedAt,
        }),
        helpLevel: supportBefore,
      });
      eventsRecorded.push('MICRO_PRACTICE_ATTEMPT');

      if (this.micro.currentSupportLevel > supportBefore) {
        await saveLearningEvent('SCAFFOLD_USED', {
          phraseId: this.micro.phraseId,
          helpLevel: this.micro.currentSupportLevel,
          context: JSON.stringify({
            from: supportBefore,
            to: this.micro.currentSupportLevel,
            display: this.micro.scaffoldDisplay,
          }),
        });
        eventsRecorded.push('SCAFFOLD_USED');
      }
      if (
        result.supportDecision === 'decreaseSupport' ||
        result.supportDecision === 'removeSupport' ||
        this.micro.currentSupportLevel < supportBefore
      ) {
        await saveLearningEvent('SCAFFOLD_DECREASED', {
          phraseId: this.micro.phraseId,
          helpLevel: this.micro.currentSupportLevel,
          context: JSON.stringify({ from: supportBefore, to: this.micro.currentSupportLevel }),
        });
        eventsRecorded.push('SCAFFOLD_DECREASED');
      }
      if (result.correct && supportBefore === 0 && !this.micro.helpRequested) {
        await saveLearningEvent('INDEPENDENT_RESPONSE', {
          phraseId: this.micro.phraseId,
          helpLevel: 0,
          context: utterance,
        });
        eventsRecorded.push('INDEPENDENT_RESPONSE');
      }
    }

    if (result.correct && this.micro.phraseId && utterance) {
      await this.recordPhraseEvent(this.micro.phraseId, {
        type: 'produced',
        correct: true,
        withHelp: supportBefore > 0 || this.micro.helpRequested,
      });
    }

    this.persist();

    if (result.finished) {
      return this.resume();
    }

    // Nudge alinhado ao nível atual (não frase completa se < 5)
    let geminiNudge: string | null = null;
    if (phaseBefore === 'guided' && this.micro.phase === 'independent') {
      geminiNudge = [
        '[INSTRUÇÃO INTERNA — não leia isto em voz alta]',
        'Diga só a pergunta curta (áudio), depois silêncio:',
        `"${this.micro.independentPrompt}"`,
        'NÃO forneça a resposta.',
      ].join('\n');
    } else if (this.micro.currentSupportLevel > supportBefore) {
      geminiNudge = [
        '[INSTRUÇÃO INTERNA — não leia isto em voz alta]',
        `supportLevel = ${this.micro.currentSupportLevel}`,
        scaffoldingDirective(this.micro.currentSupportLevel, this.micro.targetItem),
        this.micro.scaffoldDisplay
          ? `Verbalize só: "${this.micro.scaffoldDisplay}"`
          : '',
      ].filter(Boolean).join('\n');
    }

    return {
      flow: 'startMicroPractice',
      action: 'practice',
      mode: 'MICRO_PRACTICE',
      reason: `micro_phase:${this.micro.currentStep}`,
      targetItem: this.micro.targetItem,
      geminiNudge,
      eventsRecorded,
      microPractice: this.micro,
      microFeedback: result.feedback,
    };
  }

  private async onTransferAttempt(text: string): Promise<OrchestratorDecision> {
    const variant = this.pendingTransfer;
    const phrase = this.sourcePhraseForTransfer();
    if (!variant || !phrase) {
      this.pendingTransfer = null;
      return this.continueResult('transfer_sem_alvo');
    }

    this.userTurns += 1;
    this.ctx.lastUserUtterance = text;
    this.transferAttempts += 1;
    const eventsRecorded: LearningEventType[] = [];
    const helpLevel = this.sessionSupport;

    await saveLearningEvent('USER_UTTERANCE', {
      phraseId: phrase.id,
      context: JSON.stringify({ text, transfer: true, variant: variant.german }),
      helpLevel,
    });
    eventsRecorded.push('USER_UTTERANCE');

    const grammar = detectPossibleGrammarError(text);
    if (grammar) {
      this.justErrored = true;
      await saveLearningEvent('PHRASE_FAILED', { phraseId: phrase.id, context: text });
      eventsRecorded.push('PHRASE_FAILED');
      this.sessionSupport = escalateSupport(this.sessionSupport);
      this.plan = { ...this.plan, scaffoldLevel: this.sessionSupport };
      this.persist();
      const startMicro = shouldStartMicroPractice({
        grammar,
        recentMistakes: this.ctx.recentMistakes,
        confidence: this.learning.phrases[grammar.phraseId]?.confidence,
        timesCorrect: this.learning.phrases[grammar.phraseId]?.timesCorrect,
        turnsSinceLastMicro: this.turnsSinceLastMicro,
      });
      if (startMicro && this.turnsSinceLastMicro >= 2) {
        this.pendingTransfer = null;
        return this.onUserUtterance(text);
      }
      const hint = buildScaffoldHint(variant.german, this.sessionSupport, {
        portuguese: variant.portuguese,
      });
      return {
        flow: 'continueConversation',
        action: 'transfer',
        mode: 'GUIDED_CONVERSATION',
        reason: 'transfer_fail_scaffold',
        targetItem: phrase.german,
        geminiNudge: [
          '[INSTRUÇÃO INTERNA — não leia isto em voz alta]',
          'TRANSFER falhou. Use scaffolding. NÃO trate como erro definitivo.',
          scaffoldingDirective(this.sessionSupport, variant.german),
          hint.displayText ? `Pista máxima neste nível: ${hint.displayText}` : '',
          `Continue a pergunta: "${variant.situationPrompt}"`,
        ].filter(Boolean).join('\n'),
        eventsRecorded,
      };
    }

    if (isSuccessfulTransfer(text, phrase.german, variant)) {
      const hist = recordTransferAttempt({
        phraseId: phrase.id,
        sourcePhrase: phrase.german,
        variant,
        success: true,
        helpLevel,
        sessionId: this.sessionId,
      });
      await saveLearningEvent('PHRASE_TRANSFERRED', {
        phraseId: phrase.id,
        helpLevel,
        context: transferEventContext({
          targetItemId: phrase.id,
          sourcePhrase: phrase.german,
          variant,
          sessionId: this.sessionId,
          success: true,
          helpLevel,
        }),
      });
      eventsRecorded.push('PHRASE_TRANSFERRED');
      await this.recordPhraseEvent(phrase.id, { type: 'transfer', correct: true });
      if (helpLevel === 0) {
        await saveLearningEvent('INDEPENDENT_RESPONSE', {
          phraseId: phrase.id,
          helpLevel: 0,
          context: text,
        });
        eventsRecorded.push('INDEPENDENT_RESPONSE');
      }
      this.pendingTransfer = null;
      this.justErrored = false;
      this.turnsSinceLastTransfer = 0;
      this.ctx.lastAction = 'converse';
      this.ctx.mode = 'FREE_CONVERSATION';
      this.plan = { ...this.plan, action: 'converse' };
      this.persist();
      void hist;
      // Após transfer: conversa. Só muda se score já pede spontaneous/maintenance (≥65).
      const confAfter = this.learning.phrases[phrase.id];
      const scoreAfter = confAfter ? readAutomationScore(confAfter) : 0;
      if (scoreAfter >= 65) {
        const nba = await this.applyNbaAfterEvidence(phrase.id);
        if (nba && (nba.action === 'spontaneous' || nba.action === 'converse')) {
          return {
            ...nba,
            eventsRecorded: [...eventsRecorded, ...nba.eventsRecorded],
            geminiNudge: [
              '[INSTRUÇÃO INTERNA — não leia isto em voz alta]',
              'Transferência OK. Reconheça de forma breve.',
              nba.reason,
            ].join('\n'),
          };
        }
      }
      return {
        flow: 'continueConversation',
        action: 'converse',
        mode: 'FREE_CONVERSATION',
        reason: 'transfer_success_then_converse',
        targetItem: phrase.german,
        geminiNudge: [
          '[INSTRUÇÃO INTERNA — não leia isto em voz alta]',
          'Transferência OK. Reconheça de forma breve e VOLTE à conversa normal.',
          'Não peça outra variação agora. Mude de assunto com leveza.',
        ].join('\n'),
        eventsRecorded,
      };
    }

    if (isExactRepetition(text, phrase.german)) {
      return {
        flow: 'continueConversation',
        action: 'transfer',
        mode: this.ctx.mode,
        reason: 'transfer_not_repetition',
        targetItem: phrase.german,
        geminiNudge: [
          '[INSTRUÇÃO INTERNA — não leia isto em voz alta]',
          'O aluno repetiu a frase original. Isso NÃO é transferência.',
          `Pergunte de novo, natural: "${variant.situationPrompt}"`,
          'NÃO dê a resposta.',
        ].join('\n'),
        eventsRecorded,
      };
    }

    this.sessionSupport = escalateSupport(this.sessionSupport);
    recordTransferAttempt({
      phraseId: phrase.id,
      sourcePhrase: phrase.german,
      variant,
      success: false,
      helpLevel: this.sessionSupport,
      sessionId: this.sessionId,
    });
    const hint = buildScaffoldHint(variant.german, this.sessionSupport, {
      portuguese: variant.portuguese,
    });
    this.plan = { ...this.plan, scaffoldLevel: this.sessionSupport };
    this.persist();
    return {
      flow: 'continueConversation',
      action: 'transfer',
      mode: 'GUIDED_CONVERSATION',
      reason: 'transfer_fail_scaffold',
      targetItem: phrase.german,
      geminiNudge: [
        '[INSTRUÇÃO INTERNA — não leia isto em voz alta]',
        `supportLevel = ${this.sessionSupport}`,
        scaffoldingDirective(this.sessionSupport, variant.german),
        hint.displayText ? `Pista: ${hint.displayText}` : '',
        `Pergunta: "${variant.situationPrompt}"`,
        'Não classifique como erro definitivo.',
      ].filter(Boolean).join('\n'),
      eventsRecorded,
    };
  }
}
