import type { Phrase, SessionDuration, UserProfile } from '@/types';
import {
  courseConversationTopic,
  germanPercentageFor,
  phrasesForLevel,
  phrasesForCompetency,
  nextCompetency,
  type CourseProgress,
} from '@/services/course';
import type { UserLearningProfile } from '@/services/learning/ConfidenceService';
import {
  averageAutomationScore,
  getNextBestLearningAction,
  isAutomated,
  readAutomationScore,
  reviewPriority,
  type PedagogicalKind,
} from '@/services/learning/AutomationScoreEngine';
import { applyStrategyToStageWeights } from '@/services/learning/AdaptationEngine';
import {
  loadPersonalLearningProfile,
  type TeachingStrategy,
} from '@/services/learning/PersonalLearningProfile';
import {
  buildReviewQueue,
  pickReviewOpportunity,
  reviewPriorityScore,
  type ReviewOpportunity,
} from '@/services/learning/ReviewEngine';
import {
  decideSupportAction,
  decreaseSupport,
  increaseSupport,
  type SupportDecision,
  type SupportLevel,
} from '@/services/learning/ScaffoldingEngine';
import { shouldCreateSpontaneousOpportunity } from '@/services/learning/SpontaneousUseDetector';

export type TrainingStageId = 'warmup' | 'listening' | 'speaking' | 'new' | 'conversation';

export interface TrainingStage {
  id: TrainingStageId;
  minutes: number;
}

export interface TodaysTraining {
  totalMinutes: number;
  stages: TrainingStage[];
  topic: string;
  reviewPhrases: string[];
  newPhrases: string[];
  /** Automação média da sessão (0–100). */
  averageAutomation?: number;
  /** Ação pedagógica dominante sugerida pelo AutomationScore. */
  primaryAction?: PedagogicalKind;
}

const TOPICS_BY_GOAL: Record<string, string[]> = {
  work: ['seu trabalho', 'o que você faz no escritório', 'uma reunião simples'],
  daily: ['sua rotina', 'o que você comeu hoje', 'o tempo'],
  family: ['sua família', 'o fim de semana em casa'],
  travel: ['uma viagem', 'chegar a um lugar'],
  conversation: ['o seu dia', 'o que você gosta de fazer'],
};

export function greetingForNow(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Bom dia';
  if (hour < 18) return 'Boa tarde';
  return 'Boa noite';
}

export function suggestConversationTopic(profile: UserProfile): string {
  const pool = TOPICS_BY_GOAL[profile.goal] || TOPICS_BY_GOAL.daily;
  const extra = profile.profession ? `seu trabalho como ${profile.profession}` : pool[0];
  if (profile.goal === 'work' && profile.profession) return extra;
  return pool[profile.currentDay % pool.length];
}

/** Tópico de conversação com consciência do curso: usa a competência/objetivo atual. */
export function suggestConversationTopicCourse(profile: UserProfile, course: CourseProgress | null): string {
  if (!course) return suggestConversationTopic(profile);
  const compId = nextCompetency(course);
  if (compId) return courseConversationTopic(course, profile);
  return suggestConversationTopic(profile);
}

/** Filtra frases pelo nível do curso quando disponível; senão retorna o pool. */
export function phrasesForCourse(allPhrases: Phrase[], course: CourseProgress | null): Phrase[] {
  if (!course) return allPhrases;
  const compId = nextCompetency(course);
  if (compId) {
    const byComp = phrasesForCompetency(allPhrases, compId);
    if (byComp.length) return byComp;
  }
  return phrasesForLevel(allPhrases, course.currentLevel);
}

/** Percentual de alemão do professor considerando o nível do curso. */
export function courseGermanPercentage(course: CourseProgress | null): number {
  return course ? germanPercentageFor(course) : 80;
}

function splitMinutes(
  total: number,
  turbo: boolean,
  avgAutomation = 40,
  strategy?: TeachingStrategy | null,
): TrainingStage[] {
  // Score alto → menos prática direta, mais conversa
  // Score baixo → mais speaking/new (guided/recall)
  let weights: number[];
  if (avgAutomation < 35) {
    weights = turbo ? [0.12, 0.18, 0.35, 0.2, 0.15] : [0.14, 0.18, 0.32, 0.2, 0.16];
  } else if (avgAutomation < 65) {
    weights = turbo ? [0.1, 0.18, 0.28, 0.16, 0.28] : [0.12, 0.18, 0.26, 0.16, 0.28];
  } else {
    weights = turbo ? [0.06, 0.12, 0.18, 0.1, 0.54] : [0.08, 0.14, 0.18, 0.1, 0.5];
  }
  if (strategy?.preferredActivity) {
    weights = applyStrategyToStageWeights(strategy.preferredActivity, weights);
  }
  // conversationRatio: empurra tempo para conversation vs speaking/listening
  if (strategy && typeof strategy.conversationRatio === 'number') {
    const cr = strategy.conversationRatio;
    weights[4] = Math.max(0.08, weights[4] * (0.6 + cr));
    const shrink = 1 - (cr - 0.5) * 0.25;
    weights[1] *= shrink;
    weights[2] *= shrink;
    const sum = weights.reduce((a, b) => a + b, 0) || 1;
    weights = weights.map((w) => w / sum);
  }
  const ids: TrainingStageId[] = ['warmup', 'listening', 'speaking', 'new', 'conversation'];
  const raw = weights.map((w) => Math.max(1, Math.round(total * w)));
  const diff = total - raw.reduce((a, b) => a + b, 0);
  raw[raw.length - 1] = Math.max(1, raw[raw.length - 1] + diff);
  return ids.map((id, i) => ({ id, minutes: raw[i] }));
}

export function planTodaysTraining(
  profile: UserProfile,
  duePhrases: Phrase[],
  learning?: UserLearningProfile | null,
  strategyOverride?: TeachingStrategy | null,
): TodaysTraining {
  const minutes = profile.dailyMinutes as SessionDuration;
  const topic = suggestConversationTopic(profile);
  const avgAutomation = learning ? averageAutomationScore(learning.phrases) : 40;
  const strategy = strategyOverride ?? loadPersonalLearningProfile().teachingStrategy;

  let reviewPhrases: string[];
  if (learning && Object.keys(learning.phrases).length > 0) {
    reviewPhrases = buildReviewQueue(learning.phrases, duePhrases)
      .slice(0, 3)
      .map((q) => q.german || q.phraseId);
    if (reviewPhrases.length === 0) {
      reviewPhrases = Object.values(learning.phrases)
        .filter((c) => c.state !== 'automatic' && !isAutomated(c))
        .sort((a, b) => reviewPriority(b) - reviewPriority(a))
        .slice(0, 3)
        .map((c) => duePhrases.find((p) => p.id === c.phraseId)?.german || c.phraseId);
    }
  } else {
    reviewPhrases = duePhrases.slice(0, 3).map((p) => p.german);
  }

  const newPhrases =
    avgAutomation >= 80
      ? []
      : duePhrases.length
        ? []
        : ['Ich brauche eine Pause.', 'Was soll ich machen?'];

  let primaryAction: PedagogicalKind =
    avgAutomation < 35
      ? 'guided'
      : avgAutomation < 65
        ? 'transfer'
        : avgAutomation < 85
          ? 'spontaneous'
          : 'independent';

  if (strategy.preferredActivity === 'speaking' && avgAutomation < 80) {
    primaryAction = avgAutomation < 45 ? 'guided' : 'independent';
  } else if (strategy.preferredActivity === 'listening') {
    primaryAction = 'introduce';
  } else if (strategy.preferredActivity === 'review') {
    primaryAction = 'recall';
  } else if (strategy.preferredActivity === 'transfer') {
    primaryAction = 'transfer';
  }

  return {
    totalMinutes: minutes,
    stages: splitMinutes(minutes, profile.turboMode, avgAutomation, strategy),
    topic: strategy.contextBridge
      ? (strategy.contextBridge === 'trabalho' && profile.profession
          ? `seu trabalho como ${profile.profession}`
          : strategy.contextBridge)
      : topic,
    reviewPhrases,
    newPhrases,
    averageAutomation: avgAutomation,
    primaryAction,
  };
}

export type TeacherSessionDecision = 'REVIEW' | 'CONVERSE';

/** Fase 7 — o professor escolhe REVIEW só se o item está due e a necessidade é alta. */
export function decideReviewOrConverse(
  learning: UserLearningProfile | null | undefined,
  phrases: Phrase[] = [],
  opts?: { inImportantConversation?: boolean; now?: Date },
): { decision: TeacherSessionDecision; reason: string; opportunity: ReviewOpportunity | null } {
  if (!learning) {
    return { decision: 'CONVERSE', reason: 'sem memória — CONVERSE', opportunity: null };
  }
  if (opts?.inImportantConversation) {
    return {
      decision: 'CONVERSE',
      reason: 'conversa importante — aguardar oportunidade natural',
      opportunity: null,
    };
  }
  const opp = pickReviewOpportunity(learning.phrases, phrases, { now: opts?.now });
  if (!opp) {
    return { decision: 'CONVERSE', reason: 'nada due — CONVERSE', opportunity: null };
  }
  const scored = reviewPriorityScore(learning.phrases[opp.itemId], opts?.now ?? new Date());
  if (scored.due && opp.priority >= 40) {
    return {
      decision: 'REVIEW',
      reason: `item due (${opp.type}) prioridade ${opp.priority} — REVIEW`,
      opportunity: opp,
    };
  }
  return {
    decision: 'CONVERSE',
    reason: 'prioridade baixa — CONVERSE até oportunidade natural',
    opportunity: opp,
  };
}

/** Conecta TeacherEngine ↔ AutomationScore para um item. */
export function getNextBestLearningActionForTeacher(
  learning: UserLearningProfile | null | undefined,
  phraseId?: string,
): PedagogicalKind {
  if (!learning) return 'introduce';
  if (phraseId && learning.phrases[phraseId]) {
    return getNextBestLearningAction(learning.phrases[phraseId], {
      bottleneck: learning.bottleneck,
      sessionGoal: 'auto',
    });
  }
  const avg = averageAutomationScore(learning.phrases);
  if (avg < 35) return 'guided';
  if (avg < 65) return 'transfer';
  if (avg < 85) return 'spontaneous';
  return 'independent';
}

export function immersionLabel(profile: UserProfile): string {
  const pct = Math.max(0, Math.min(100, profile.germanPercentage ?? 80));
  return `${pct}%`;
}

export function immersionGuidanceForTeacher(pct: number): string {
  const p = Math.max(0, Math.min(100, pct));
  if (p <= 25) {
    return 'IMERSÃO BAIXA: use português com frequência para explicar. Alemão em frases curtas e repetidas.';
  }
  if (p <= 50) {
    return 'IMERSÃO MÉDIA: fale mais em alemão, mas explique em português quando o aluno hesitar ou pedir ajuda.';
  }
  if (p <= 75) {
    return 'IMERSÃO ALTA: alemão predominante. Português só para correção rápida ou quando o aluno não entender.';
  }
  if (p <= 90) {
    return 'IMERSÃO MUITO ALTA: quase só alemão. Português somente se o aluno demonstrar que não entendeu.';
  }
  return 'IMERSÃO MÁXIMA: alemão por padrão. Português só em situações realmente necessárias (bloqueio total).';
}

export function intensiveGuidanceForTeacher(turbo: boolean): string {
  if (!turbo) return 'MODO NORMAL: ritmo equilibrado, correções naturais, sem pressionar demais.';
  return 'MODO INTENSIVO: mais oportunidades de produção, correções mais frequentes, rapid response e recuperação ativa — sem excesso de palavras novas nem fadiga.';
}

export function formatStudyTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h <= 0) return `${m} min`;
  return `${h}h ${m}min`;
}

export function stageFromElapsed(elapsedMs: number, training: TodaysTraining): number {
  const totalMs = Math.max(1, training.totalMinutes) * 60 * 1000;
  const ratio = Math.min(0.99, elapsedMs / totalMs);
  return Math.min(training.stages.length - 1, Math.floor(ratio * training.stages.length));
}

/** Decisão pedagógica de scaffolding (não confundir com preferência UI helpLevel). */
export function decideSupportForAttempt(input: {
  lastSupportLevel: SupportLevel;
  successHistory: boolean[];
  independence: number;
  recentErrors: number;
  correct: boolean;
  usedHelp: boolean;
  helpRequested?: boolean;
}): { decision: SupportDecision; nextLevel: SupportLevel } {
  const consecutiveSuccess = (() => {
    let n = 0;
    for (let i = input.successHistory.length - 1; i >= 0; i--) {
      if (!input.successHistory[i]) break;
      n++;
    }
    return n + (input.correct ? 1 : 0);
  })();
  const decision = decideSupportAction({
    previous: input.lastSupportLevel,
    correct: input.correct,
    usedHelp: input.usedHelp,
    helpRequested: input.helpRequested,
    consecutiveSuccess,
  });
  let nextLevel = input.lastSupportLevel;
  if (decision === 'increaseSupport' || (!input.correct && input.recentErrors >= 0)) {
    if (!input.correct) nextLevel = increaseSupport(input.lastSupportLevel);
  } else if (decision === 'decreaseSupport') {
    nextLevel = decreaseSupport(input.lastSupportLevel);
  } else if (decision === 'removeSupport' || (input.correct && !input.usedHelp && input.independence >= 2)) {
    nextLevel = 0;
  }
  return { decision, nextLevel };
}

export {
  prepareSession,
  endSession,
  completeSession,
  pauseSession,
  getSessionOpening,
  buildSessionContext,
  getIncompleteSession,
} from '@/services/teacher/sessionContinuity';

export { getNextBestLearningAction, readAutomationScore };

export type AfterTransferAction = 'CONTINUE' | 'CONVERSE' | 'SPONTANEOUS';

/** Após transferência bem-sucedida: voltar à conversa (SPONTANEOUS refinado na Fase 5). */
export function decideNextAfterTransfer(input: {
  transferHistory?: { successfulTransfers?: number; transferContextCount?: number } | null;
  recentTransferPerformance: 'success' | 'fail' | 'none';
}): AfterTransferAction {
  if (input.recentTransferPerformance === 'fail') return 'CONTINUE';
  if (input.recentTransferPerformance === 'success') {
    // Após transfer bem-sucedido: conversa; oportunidade espontânea vem depois
    return 'CONVERSE';
  }
  const n = input.transferHistory?.successfulTransfers ?? 0;
  if (n >= 3) return 'CONVERSE';
  return 'CONTINUE';
}

/** TeacherEngine: oferecer TRANSFER só após produção, não após erro. */
export { decideTransfer } from '@/services/learning/TransferEngine';

export type TeacherSpontaneousDecision = 'CREATE_SPONTANEOUS_OPPORTUNITY' | 'CONTINUE' | 'CONVERSE';

/** TeacherEngine: criar oportunidade espontânea (required=false) — não a todo instante. */
export function decideSpontaneousOpportunity(input: {
  hasProduced: boolean;
  transferSuccess?: number;
  spontaneousCount?: number;
  sessionOpportunities: number;
  recentError: boolean;
  turnsSinceLastOpportunity: number;
}): TeacherSpontaneousDecision {
  if (
    shouldCreateSpontaneousOpportunity({
      hasProduced: input.hasProduced,
      transferSuccess: input.transferSuccess,
      spontaneousCount: input.spontaneousCount,
      sessionOpportunities: input.sessionOpportunities,
      recentError: input.recentError,
      turnsSinceLastOpportunity: input.turnsSinceLastOpportunity,
    })
  ) {
    return 'CREATE_SPONTANEOUS_OPPORTUNITY';
  }
  return 'CONTINUE';
}
