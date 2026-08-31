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
  type ReviewOpportunity,
  type ReviewType,
} from '@/services/learning/ReviewEngine';
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
import { decideReviewOrConverse, decideSpontaneousOpportunity } from '@/services/teacher/TeacherEngine';
import { EventStore, type LearningEventType } from '@/services/learning/EventStore';
import { MemoryService } from '@/services/learning/MemoryService';
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
  zeroLanguageDirective,
  zeroLanguageKickoff,
  zeroLanguageWrapUpNudge,
  isZeroLanguagePhraseAccepted,
  L0_MAX_IMMEDIATE_CORRECT_STREAK,
  type L0PhrasePhase,
  type L0TurnEvalSnapshot,
  type ProductionErrorType,
} from '@/services/teacher/ZeroLanguageMode';

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

function buildDirective(plan: Omit<ConversationPlan, 'teacherDirective' | 'actionKickoff'>, zeroMode = false, sessionMinutes?: number): string {
  const personal = loadPersonalLearningProfile();
  const adapt = geminiAdaptationSnippet(personal);
  const lines = [
    '=== ORQUESTRAÇÃO DO TEACHERENGINE (obrigatória) ===',
    `AÇÃO ATUAL: ${actionLabel(plan.action)}`,
    `TEMA DA SESSÃO: ${plan.topic}`,
    `ESTÁGIO: ${plan.stageId}`,
    plan.bottleneck ? `GARGALO DETECTADO: ${plan.bottleneck}` : '',
    adapt && !zeroMode ? `=== ADAPTAÇÃO PESSOAL ===\n${adapt}\n=== FIM ADAPTAÇÃO ===` : '',
    plan.actionReason ? `POR QUÊ: ${plan.actionReason}` : '',
    scaffoldingDirective(plan.scaffoldLevel, plan.target?.german),
    plan.target
      ? `FRASE-ALVO:\n- DE: ${plan.target.german}\n- PT: ${plan.target.portuguese}`
      : 'FRASE-ALVO: nenhuma específica.',
    plan.target?.transferPrompt && plan.action === 'transfer' ? plan.target.transferPrompt : '',
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
    personal.teachingStrategy.correctionStyle === 'brief_explanation' && !zeroMode
      ? '- Correção: breve explicação + forma correta + nova tentativa.'
      : '- Se houver correção pedida pelo app: "Quase! Sag: <forma>. Agora você." Depois avalie a nova tentativa.',
    !zeroMode && personal.teachingStrategy.preferredActivity === 'speaking'
      ? '- Priorize perguntas que EXIGEM fala do aluno (produção). Evite monólogos longos do professor.'
      : '',
    !zeroMode && personal.teachingStrategy.preferredActivity === 'listening'
      ? '- Priorize compreensão: diga frases curtas e peça ao aluno para reagir / confirmar o que ouviu.'
      : '',
    !zeroMode && personal.teachingStrategy.errorFocus
      ? `- Trabalhe naturalmente o padrão: ${personal.teachingStrategy.errorFocus}.`
      : '',
    '- Não interrompa demais. Prefira continuidade.',
    '- Produção logo após o modelo = GUIADA (não declare automação).',
    '=== FIM ORQUESTRAÇÃO ===',
  ];
  return lines.filter(Boolean).join('\n');
}

function buildActionKickoff(plan: Omit<ConversationPlan, 'teacherDirective' | 'actionKickoff'>, zeroMode = false): string {
  const target = plan.target;
  if (zeroMode) {
    if (plan.action === 'converse' || !target) {
      return [
        '[INSTRUÇÃO INTERNA — não leia isto em voz alta]',
        'ZERO LANGUAGE MODE — microbloco concluído / sem repetição imediata.',
        'Elogie curto. NÃO peça a mesma frase de novo.',
        'Ou avance para OUTRA frase conhecida, ou encerre o microbloco.',
      ].join('\n');
    }
    return zeroLanguageKickoff({
      targetGerman: target.german,
      targetPt: target.portuguese,
      scaffoldLevel: plan.scaffoldLevel,
      returning: plan.action === 'recall' || plan.action === 'practice',
    });
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
  }) + `\n[ação orquestrada: ${action}]`;
}

export function buildConversationPlan(
  profile: UserProfile,
  learning: UserLearningProfile,
  phrases: Phrase[],
  elapsedMs = 0,
  opts?: { l0BlockReviewPhraseId?: string | null; l0ExcludePhraseId?: string | null },
): ConversationPlan {
  const zeroMode = isZeroLanguageMode(profile);
  const phrasePool = zeroMode ? mergeZeroLanguagePhrases(phrases) : phrases;
  const dueAsPhrases = Object.values(learning.phrases)
    .filter((c) => c.state !== 'automatic' && c.confidence > 0 && c.confidence < 85)
    .slice(0, 5)
    .map((c) => resolvePhrase(c.phraseId, phrasePool))
    .filter((p): p is Phrase => !!p);

  const training = planTodaysTraining(profile, dueAsPhrases, learning);
  const topic = zeroMode
    ? (profile.profession ? 'apresentação e sobrevivência no trabalho' : 'primeiras frases')
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
    })
    : null;
  const picked = zeroPick
    ? { conf: zeroPick.conf, phrase: zeroPick.phrase, action: zeroPick.action as OrchestratorAction }
    : pickPrimaryTarget(learning, phrasePool);

  const sessionMode = decideReviewOrConverse(learning, phrasePool);
  const nba = decideNextBestAction(picked.conf, {
    bottleneck: effectiveBottleneck?.type ?? learning.bottleneck,
    sessionGoal: sessionMode.decision === 'REVIEW' ? 'review' : 'auto',
    dueReview: sessionMode.decision === 'REVIEW',
    reviewType: sessionMode.opportunity?.type,
  });
  let action = zeroMode ? (picked.action as OrchestratorAction) : mapKind(nba.action);

  if (!zeroMode) {
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
      zeroPick?.action === 'converse' ? 'L0_CURRICULUM_COMPLETE — sem repetição imediata' : '',
      nba.reason,
      !zeroMode && personal.teachingStrategy.reason ? `adaptação: ${personal.teachingStrategy.reason}` : '',
    ]
      .filter(Boolean)
      .join(' | '),
  };
  return {
    ...partial,
    teacherDirective: buildDirective(partial, zeroMode, training.totalMinutes),
    actionKickoff: buildActionKickoff(partial, zeroMode),
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
  },
): ConversationPlan {
  const fresh = buildConversationPlan(profile, learning, phrases, elapsedMs, {
    l0BlockReviewPhraseId: opts?.l0BlockReviewPhraseId,
    l0ExcludePhraseId: opts?.l0ExcludePhraseId,
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
      teacherDirective: buildDirective(partial, false, previous.training.totalMinutes),
      actionKickoff: buildActionKickoff(partial, false),
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
  private interruptionsLast10 = 0;
  private briefCorrectionsLast10 = 0;
  private microStartsLast10 = 0;
  private coachContextText = '';
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
  /** L0: erros reais acumulados por bloco (para recovery com evidência). */
  private l0BlockErrors: Record<string, number> = {};
  /** L0: recuperações de bloco já usadas nesta sessão. */
  private l0BlockRecoveries: Record<string, number> = {};
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
    orch.sessionSupport = plan.scaffoldLevel;
    if (merged.reviewIntent) {
      orch.reviewSession = true;
      const opp = pickReviewOpportunity(merged.learning.phrases, phrases, {
        profile: merged.profile,
        phraseId: merged.reviewIntent.phraseId,
        forcedType: merged.reviewIntent.reviewType,
      });
      if (opp) {
        const use = opp;
        orch.pendingReview = use;
        const action = mapReviewTypeToAction(use.type);
        orch.plan = {
          ...orch.plan,
          action,
          actionReason: use.reason,
          target: {
            id: use.itemId,
            german: use.german,
            portuguese: use.portuguese,
            expected: use.expected.toLowerCase(),
            hint: use.prompt,
          },
        };
        orch.ctx.targetItem = use.german;
        orch.ctx.lastAction = action;
        orch.ctx.currentGoal = 'review';
        orch.ctx.mode = use.type === 'GUIDED_SPEAKING_REVIEW' ? 'GUIDED_CONVERSATION' : 'FREE_CONVERSATION';
      }
    }
    orch.persist();
    try {
      saveCoachMemory(seedFromUserProfile(loadCoachMemory(), deps.profile));
      const rel = selectRelevantCoachContext({ user: deps.profile, topic: plan.topic });
      orch.coachContextText = rel.text;
      orch.followUpOpening = rel.followUpOpening;
      orch.followUpEventId = rel.followUpEventId;
    } catch { /* coach memory opcional */ }
    return orch;
  }

  getContext(): ConversationContext {
    return { ...this.ctx };
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
    return {
      zeroLanguageMode: zero,
      teacherDirective: this.plan.teacherDirective,
      pedagogicalAction: this.pendingTransfer
        ? 'transfer'
        : this.pendingReview
          ? mapReviewTypeToAction(this.pendingReview.type)
          : this.plan.action,
      targetPhrase: this.pendingTransfer?.german || this.plan.target?.german,
      targetPhrasePt: this.pendingTransfer?.portuguese || this.plan.target?.portuguese,
      scaffoldLevel: this.sessionSupport,
      sessionTopic: this.plan.topic,
      trainingStage: this.plan.stageId,
      orchestratorKickoff: this.plan.actionKickoff,
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
        return {
          flow: 'continueConversation',
          action: 'converse',
          mode: 'GUIDED_CONVERSATION',
          reason: 'ZERO_LANGUAGE_MODE — TARGET_STUCK evitado; sem repetição imediata',
          targetItem: next?.german ?? this.ctx.targetItem,
          geminiNudge: [
            '[INSTRUÇÃO INTERNA — não leia isto em voz alta]',
            'ZERO LANGUAGE MODE — frase ACEITA. Elogie curto ("Perfeito!").',
            'PROIBIDO: pedir a MESMA frase de novo ("fale de novo para fixar").',
            'PROIBIDO: repetição imediata / drill da frase que acabou de acertar.',
            next && next.id !== phraseId
              ? `Se continuar, use outra frase já conhecida em RECALL leve: "${next.german}".`
              : 'Varie: pergunta natural curta ligada ao tema, OU revise OUTRA frase já aprendida, OU encerre o microbloco com "Muito bem. Vamos seguir."',
            'Domínio (automation) sobe em recall/transfer FUTUROS — não agora.',
          ].join('\n'),
          eventsRecorded: [],
        };
      }

      return {
        flow: 'continueConversation',
        action: this.plan.action === 'recall' ? 'recall' : (this.learning.phrases[next.id]?.timesCorrect ?? 0) === 0 ? 'introduce' : 'practice',
        mode: 'GUIDED_CONVERSATION',
        reason: 'ZERO_LANGUAGE_MODE — frase aceita, próximo alvo',
        targetItem: next.german,
        geminiNudge: [
          '[INSTRUÇÃO INTERNA — não leia isto em voz alta]',
          'ZERO LANGUAGE MODE — frase aceita. Elogie curto ("Perfeito!") e AVANCE.',
          `Nova frase-alvo ÚNICA: "${next.german}" (= ${next.portuguese || ''}). Ciclo PT→modelo→repita→AGUARDE.`,
          'PROIBIDO: voltar para a frase que acabou de acertar.',
          'PROIBIDO: "fale de novo para fixar" na mesma frase.',
          'Não faça perguntas abertas. Não despeje várias frases.',
        ].join('\n'),
        eventsRecorded: [],
      };
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
      this.logL0('TEACHER_TURN_SNAPSHOT', {
        turnId: this.l0TurnEvalSnapshot.turnId,
        currentTargetId: tid,
        currentTargetText: ttext,
        previousTargetId: this.l0PreviousTargetId,
        previousTargetText: this.l0PreviousTargetText,
        expectedAnswer: this.l0TurnEvalSnapshot.expectedAnswer,
        acceptedAnswers: this.l0TurnEvalSnapshot.acceptedAnswers,
        teacherText: text.slice(0, 160),
      });
    }
    this.persist();
    return this.continueResult('fala do professor registrada');
  }

  private async onHelp(text?: string): Promise<OrchestratorDecision> {
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

    // Ainda incorreto — mais ajuda, mesma frase
    this.sessionSupport = escalateSupport(this.sessionSupport);
    this.plan = { ...this.plan, scaffoldLevel: this.sessionSupport };
    this.pendingCorrectionRetry = {
      ...pending,
      attempt: pending.attempt + 1,
      userSaid: trimmed,
      errorType: diagnosis.errorType || pending.errorType,
      hardPart: diagnosis.hardPart || pending.hardPart,
    };
    await saveLearningEvent('PHRASE_FAILED', {
      phraseId: pending.phraseId,
      context: JSON.stringify({
        text: trimmed,
        attempt: this.pendingCorrectionRetry.attempt,
        errorType: this.pendingCorrectionRetry.errorType,
        expected: pending.expected,
      }),
      helpLevel: this.sessionSupport,
    });
    eventsRecorded.push('PHRASE_FAILED');
    await this.recordPhraseEvent(pending.phraseId, { type: 'produced', correct: false });
    recordHelpAttempt(pending.phraseId, this.sessionSupport, false, { helpRequested: true });
    if (isZeroLanguageMode(this.profile)) {
      this.l0PhrasePhase = 'RETRY';
      const block = findZeroLanguageBlock(pending.phraseId);
      if (block && diagnosis.verdict === 'INCORRECT' && diagnosis.errorType !== 'pronunciation_approx') {
        this.l0BlockErrors[block.id] = (this.l0BlockErrors[block.id] ?? 0) + 1;
      }
      const blockErrors = block ? (this.l0BlockErrors[block.id] ?? 0) : 0;
      const recoveriesUsed = block ? (this.l0BlockRecoveries[block.id] ?? 0) : 0;
      if (
        shouldRecoverZeroLanguageBlock(
          pending.phraseId,
          diagnosis.verdict,
          diagnosis.errorType,
          blockErrors,
          recoveriesUsed,
        )
      ) {
        this.pendingBlockRecovery = { phraseId: pending.phraseId, failedGerman: pending.expected };
        if (block) this.l0BlockRecoveries[block.id] = recoveriesUsed + 1;
      }
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
      }),
      eventsRecorded,
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

    if (grammar) {
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

    const l0Accepted = zeroMode
      ? (snap?.acceptedAnswers?.length
        ? snap.acceptedAnswers
        : buildL0AcceptedAnswers(
          this.plan.target?.german || expected || '',
          this.ctx.lastTeacherUtterance || '',
        ))
      : [];
    const l0Diag = zeroMode
      ? diagnoseAgainstAccepted(trimmed, l0Accepted, expected)
      : null;
    const verdict: ProductionVerdict = zeroMode
      ? (l0Diag!.verdict === 'CORRECT'
        ? 'CORRECT'
        : l0Diag!.verdict === 'NEEDS_REPAIR'
          ? 'NEEDS_REPAIR'
          : l0Diag!.verdict === 'INCORRECT'
            ? 'INCORRECT'
            : evaluateProduction(trimmed, expected))
      : evaluateProduction(trimmed, expected);

    // L0: com target explícito, UNKNOWN não pode “passar” — trata como erro da frase atual
    const effectiveVerdict: ProductionVerdict =
      zeroMode && verdict === 'UNKNOWN' && !!(this.plan.target?.german || expected)
        ? 'INCORRECT'
        : verdict;

    if (zeroMode) {
      this.logL0('EVAL_TURN', {
        sessionId: this.sessionId,
        turnId: snap?.turnId ?? `user-${this.userTurns}`,
        utteranceId: utteranceKey,
        currentTargetId: this.plan.target?.id ?? null,
        currentTargetText: this.plan.target?.german ?? null,
        previousTargetId: snap?.previousTargetId ?? this.l0PreviousTargetId,
        previousTargetText: snap?.previousTargetText ?? this.l0PreviousTargetText,
        expectedAnswer: expected,
        acceptedAnswers: l0Accepted,
        userTranscript: trimmed,
        evaluationResult: effectiveVerdict,
        rawVerdict: verdict,
        matchedTargetId: l0Diag?.matchedAnswer ? this.plan.target?.id ?? null : null,
        matchedAnswer: l0Diag?.matchedAnswer ?? null,
        matchScore: effectiveVerdict === 'CORRECT' ? 1 : effectiveVerdict === 'NEEDS_REPAIR' ? 0.5 : 0,
        nearMiss: l0Diag?.errorType === 'pronunciation_approx' || effectiveVerdict === 'NEEDS_REPAIR',
        helpLevel: this.sessionSupport,
        failureCount: this.plan.target?.id
          ? (this.l0BlockErrors[findZeroLanguageBlock(this.plan.target.id)?.id || ''] ?? 0)
          : 0,
        recoveryReason: this.pendingBlockRecovery ? 'pendingBlockRecovery' : null,
        nextTargetId: this.plan.target?.id ?? null,
        nextTargetText: this.plan.target?.german ?? null,
        evaluatedAgainst: expected,
        truncatedExpectedAvoided: this.plan.target?.expected ?? null,
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

    // Oportunidade aberta: resposta válida sem o target — NÃO punir, NÃO abrir micro
    if (
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

    if (spontaneous.confirmed && spontaneous.phraseId) {
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

    if (this.plan.target?.id && effectiveVerdict === 'CORRECT') {
      const targetId = this.plan.target.id;
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
      } else {
        this.refreshPlan();
      }
      this.persist();
      const nba = await this.applyNbaAfterEvidence(targetId);
      if (nba) {
        return { ...nba, eventsRecorded: [...eventsRecorded, ...nba.eventsRecorded] };
      }
    } else if (
      this.plan.target?.id &&
      (effectiveVerdict === 'INCORRECT' || effectiveVerdict === 'NEEDS_REPAIR')
    ) {
      const target = this.plan.target;
      const targetId = target.id;
      const diagnosis = diagnoseProduction(trimmed, target.german);
      await saveLearningEvent('PHRASE_FAILED', {
        phraseId: targetId,
        context: JSON.stringify({
          text: trimmed,
          expected: target.german,
          errorType: diagnosis.errorType || (effectiveVerdict === 'NEEDS_REPAIR' ? 'pronunciation_approx' : 'mismatch'),
          hardPart: diagnosis.hardPart,
          attempt: 1,
        }),
        helpLevel: this.sessionSupport,
      });
      eventsRecorded.push('PHRASE_FAILED');
      await this.recordPhraseEvent(targetId, { type: 'produced', correct: false });
      const helpUpdate = recordHelpAttempt(targetId, this.sessionSupport, false);
      this.sessionSupport = escalateSupport(helpUpdate.nextInSession);
      this.plan = { ...this.plan, scaffoldLevel: this.sessionSupport };
      this.ctx.mode = 'PEDAGOGICAL_INTERVENTION';
      this.ctx.targetItem = target.german;
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
        expected: target.german,
        attempt: 1,
        userSaid: trimmed,
        errorType,
        hardPart: diagnosis.hardPart,
      };
      if (isZeroLanguageMode(this.profile)) {
        this.l0PhrasePhase = effectiveVerdict === 'NEEDS_REPAIR' ? 'NEAR_MISS' : 'INCORRECT';
        const block = findZeroLanguageBlock(targetId);
        if (block && effectiveVerdict === 'INCORRECT' && errorType !== 'pronunciation_approx') {
          this.l0BlockErrors[block.id] = (this.l0BlockErrors[block.id] ?? 0) + 1;
        }
        const blockErrors = block ? (this.l0BlockErrors[block.id] ?? 0) : 0;
        const recoveriesUsed = block ? (this.l0BlockRecoveries[block.id] ?? 0) : 0;
        if (
          shouldRecoverZeroLanguageBlock(targetId, verdict, errorType, blockErrors, recoveriesUsed)
        ) {
          this.pendingBlockRecovery = { phraseId: targetId, failedGerman: target.german };
          if (block) this.l0BlockRecoveries[block.id] = recoveriesUsed + 1;
        } else {
          this.pendingBlockRecovery = null;
        }
      } else if (
        shouldRecoverZeroLanguageBlock(targetId, verdict, errorType)
      ) {
        this.pendingBlockRecovery = { phraseId: targetId, failedGerman: target.german };
      } else {
        this.pendingBlockRecovery = null;
      }
      try {
        const { recordSessionMistake } = await import('@/services/teacher/sessionContinuity');
        recordSessionMistake(trimmed, target.german);
      } catch { /* ignore */ }
      this.persist();
      this.logL0('AFTER_EVAL_MISMATCH', {
        evaluation: errorType,
        attemptCount: 1,
        shouldAdvance: false,
        recoveryLevel: 'RETRY_CURRENT',
        selectedNextTarget: targetId,
      });
      return {
        flow: 'intervenePedagogically',
        action: 'practice',
        mode: 'PEDAGOGICAL_INTERVENTION',
        reason: `target_mismatch:${errorType}`,
        correction: target.german,
        targetItem: target.german,
        geminiNudge: teachFromErrorNudge({
          userSaid: trimmed,
          correction: target.german,
          hardPart: diagnosis.hardPart,
          errorType,
          attempt: 1,
        }),
        eventsRecorded,
      };
    } else if (spontaneous.productionOrigin === 'TRANSFER') {
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
