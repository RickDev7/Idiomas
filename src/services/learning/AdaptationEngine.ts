/* AdaptationEngine — como ensinar ESTE aluno (Fase 9).
   Não compete com TeacherEngine: produz teachingStrategy + focus.
   TeacherEngine decide o turno; Adaptation informa a estratégia. */

import type { UserProfile } from '@/types';
import type { UserLearningProfile } from '@/services/learning/ConfidenceService';
import { detectBottlenecks, type BottleneckType } from '@/services/learning/BottleneckDetector';
import { detectStrengths } from '@/services/learning/StrengthDetector';
import { detectErrorPatterns } from '@/services/learning/ErrorPatternDetector';
import { EventStore, type LearningEvent } from '@/services/learning/EventStore';
import {
  emptyPersonalLearningProfile,
  loadPersonalLearningProfile,
  savePersonalLearningProfile,
  type CorrectionStyle,
  type LearningPaceBand,
  type PersonalLearningProfile,
  type PreferredActivity,
  type ProfileChange,
  type ReviewIntensity,
  type SupportPreference,
  type TeachingStrategy,
} from '@/services/learning/PersonalLearningProfile';
import { averageAutomationScore, readAutomationScore } from '@/services/learning/AutomationScoreEngine';

const MIN_SESSIONS_TO_FLIP = 2;
const FLIP_CONFIDENCE = 0.62;

export interface AdaptationInput {
  user: UserProfile;
  learning: UserLearningProfile;
  events?: LearningEvent[];
  previous?: PersonalLearningProfile | null;
  /** Força atualização mesmo sem sessão completa (testes). */
  force?: boolean;
}

export interface AdaptationResult {
  profile: PersonalLearningProfile;
  strategy: TeachingStrategy;
  changed: boolean;
  changes: ProfileChange[];
}

function estimatePace(learning: UserLearningProfile, events: LearningEvent[]): number {
  const phrases = Object.values(learning.phrases);
  if (phrases.length < 2) return 3;
  const sessions = Math.max(1, events.filter((e) => e.type === 'SESSION_ENDED').length);
  const automated = phrases.filter((p) => (p.automationScore ?? readAutomationScore(p)) >= 70).length;
  const rate = automated / Math.max(1, phrases.length);
  // Sessões por estrutura ~ invertido da taxa de automação
  if (rate >= 0.5) return 2;
  if (rate >= 0.25) return 3;
  if (sessions >= 5 && rate < 0.15) return 5;
  return 4;
}

function paceBand(pace: number): LearningPaceBand {
  if (pace <= 2) return 'fast';
  if (pace >= 5) return 'careful';
  return 'steady';
}

function inferSupportPreference(events: LearningEvent[], prev: SupportPreference): SupportPreference {
  const recent = events.slice(-100);
  const scaffoldOk = recent.filter((e) => e.type === 'SCAFFOLD_USED' || e.type === 'PHRASE_PRODUCED_WITH_HINT').length;
  const translation = recent.filter((e) => e.type === 'TRANSLATION_REQUESTED').length;
  const indep = recent.filter((e) => e.type === 'INDEPENDENT_RESPONSE').length;
  if (scaffoldOk >= 4 && scaffoldOk > translation) return 'context';
  if (translation >= 3 && translation > scaffoldOk) return 'translation';
  if (indep >= 5 && scaffoldOk < 2) return 'minimal';
  return prev || 'example';
}

function conversationMetrics(events: LearningEvent[]): PersonalLearningProfile['conversationPerformance'] {
  const recent = events.slice(-120);
  const produced = recent.filter((e) => e.type === 'PHRASE_PRODUCED' || e.type === 'PHRASE_PRODUCED_WITH_HINT');
  const indep = recent.filter(
    (e) => e.type === 'INDEPENDENT_RESPONSE' || (e.type === 'PHRASE_PRODUCED' && (e.helpLevel ?? 0) === 0),
  );
  const spont = recent.filter((e) => e.type === 'PHRASE_USED_SPONTANEOUSLY');
  const transferOk = recent.filter((e) => e.type === 'PHRASE_TRANSFERRED');
  const help = recent.filter((e) => e.type === 'HELP_REQUESTED' || e.type === 'SCAFFOLD_REQUESTED');
  const withLatency = recent.filter((e) => typeof e.responseTimeMs === 'number' && e.responseTimeMs! > 0);
  const avgLatency =
    withLatency.length === 0
      ? 0
      : withLatency.reduce((s, e) => s + (e.responseTimeMs || 0), 0) / withLatency.length;

  const denom = Math.max(1, produced.length);
  return {
    averageResponseLatencyMs: Math.round(avgLatency),
    independentResponseRate: indep.length / denom,
    spontaneousUseRate: spont.length / Math.max(1, produced.length + spont.length),
    transferSuccessRate: transferOk.length / Math.max(1, transferOk.length + recent.filter((e) => e.type === 'PHRASE_FAILED').length),
    helpDependency: help.length / Math.max(1, produced.length + help.length),
  };
}

function buildSkills(learning: UserLearningProfile): PersonalLearningProfile['skills'] {
  const avgAuto = averageAutomationScore(learning.phrases);
  const indep = Object.values(learning.phrases).filter((p) => !p.needsHelp && p.timesProduced > 0).length;
  const n = Math.max(1, Object.keys(learning.phrases).length);
  const base = (score: number) => ({
    confidence: score,
    accuracy: score,
    independence: Math.round((indep / n) * 100),
    automation: Math.round(avgAuto),
    retention: learning.retentionScore,
  });
  return {
    speaking: base(learning.speakingScore),
    listening: base(learning.listeningScore),
    pronunciation: base(learning.pronunciationScore),
    communication: base(learning.communicationScore),
    fluency: base(learning.responseSpeedScore),
    vocabulary: base(
      Math.max(20, 100 - (learning.weakPhrases.length / Math.max(1, learning.knownPhrases.length + learning.weakPhrases.length)) * 80),
    ),
    grammar: base(learning.recurringMistakes.length >= 2 ? 45 : 65),
  };
}

function focusTextFor(
  bottleneck: BottleneckType,
  errorFocus?: string,
): string {
  if (errorFocus === 'verb_conjugation') return 'Usar verbos no presente sem pensar.';
  switch (bottleneck) {
    case 'speaking':
      return 'Falar sem ajuda.';
    case 'listening':
      return 'Entender o que ouve na conversa.';
    case 'retention':
      return 'Lembrar o que já praticou.';
    case 'response_speed':
      return 'Responder mais rápido, sem traduzir na cabeça.';
    case 'grammar':
      return 'Usar a estrutura certa na hora de falar.';
    case 'vocabulary':
      return 'Usar as palavras certas no momento.';
    case 'pronunciation':
      return 'Soar mais claro ao falar.';
    case 'confidence':
      return 'Tentar sozinho antes de pedir ajuda.';
    default:
      return 'Continuar praticando com confiança.';
  }
}

function buildStrategy(opts: {
  primary: BottleneckType;
  secondary: BottleneckType;
  strengths: string[];
  pace: number;
  support: SupportPreference;
  conv: PersonalLearningProfile['conversationPerformance'];
  retentionScore: number;
  userGoal: string;
  errorFocus?: string;
  experimentArm?: CorrectionStyle;
}): TeachingStrategy {
  const { primary, secondary, strengths, pace, support, conv, retentionScore, userGoal, errorFocus, experimentArm } =
    opts;

  let preferredActivity: PreferredActivity = 'mixed';
  let conversationRatio = 0.65;
  let challengeLevel = 50;
  let reviewIntensity: ReviewIntensity = 'medium';
  let reason = 'equilíbrio padrão';

  if (primary === 'speaking') {
    preferredActivity = 'speaking';
    conversationRatio = 0.45;
    challengeLevel = 42;
    reason = 'speaking é gargalo — mais produção oral, menos só escuta';
  } else if (primary === 'listening') {
    preferredActivity = 'listening';
    conversationRatio = 0.55;
    challengeLevel = 45;
    reason = 'listening é gargalo — mais compreensão auditiva';
  } else if (primary === 'retention') {
    preferredActivity = 'review';
    conversationRatio = 0.5;
    reviewIntensity = 'high';
    challengeLevel = 40;
    reason = 'retenção fraca — mais revisão ativa';
  } else if (primary === 'response_speed') {
    preferredActivity = 'speaking';
    conversationRatio = 0.5;
    challengeLevel = 48;
    reason = 'latência alta — respostas rápidas em fala';
  } else if (primary === 'grammar' || errorFocus) {
    preferredActivity = 'transfer';
    conversationRatio = 0.5;
    challengeLevel = 46;
    reason = `padrão gramatical (${errorFocus || 'grammar'}) — situações que forcem o padrão`;
  }

  if (strengths.includes('listening') && primary === 'speaking') {
    reason += '; listening forte — usar escuta como ponte, mas priorizar falar';
  }
  if (strengths.includes('speaking') && primary === 'listening') {
    reason += '; speaking forte — usar fala curta após escuta';
  }
  if (secondary === 'response_speed') {
    reason += '; secundário: latência de resposta';
  }

  if (retentionScore >= 75) reviewIntensity = reviewIntensity === 'high' ? 'medium' : 'low';
  if (retentionScore < 45) reviewIntensity = 'high';

  if (conv.independentResponseRate >= 0.7 && !primary) {
    preferredActivity = 'mixed';
    conversationRatio = 0.75;
    challengeLevel = 68;
    reason = 'alta independência — mais conversa e desafio';
  }

  const correctionStyle: CorrectionStyle =
    experimentArm ||
    (conv.helpDependency > 0.45 ? 'brief_explanation' : 'short');

  return {
    supportPreference: support,
    preferredActivity,
    correctionStyle,
    pace: paceBand(pace),
    conversationRatio: Math.max(0.3, Math.min(0.85, conversationRatio)),
    reviewIntensity,
    challengeLevel: Math.max(25, Math.min(85, challengeLevel)),
    contextBridge: userGoal === 'work' ? 'trabalho' : userGoal === 'travel' ? 'viagem' : userGoal === 'daily' ? 'rotina' : undefined,
    errorFocus,
    reason,
  };
}

function shouldFlipBottleneck(
  prev: PersonalLearningProfile,
  nextType: BottleneckType,
  nextConf: number,
): boolean {
  if (!nextType) return false;
  if (!prev.primaryBottleneck) return nextConf >= 0.5;
  if (prev.primaryBottleneck === nextType) return true;
  if (nextConf < FLIP_CONFIDENCE) return false;
  return prev.bottleneckStableSessions >= MIN_SESSIONS_TO_FLIP;
}

/** Atualiza / constrói o PersonalLearningProfile (após sessão ou bloco). */
export function adaptPersonalLearning(input: AdaptationInput): AdaptationResult {
  const prev = input.previous ?? loadPersonalLearningProfile();
  const events = input.events ?? [];
  const report = detectBottlenecks(input.learning, events);
  const strengths = detectStrengths(input.learning, events);
  const errorPatterns = detectErrorPatterns(events, input.learning.recurringMistakes);
  const topError = errorPatterns[0];
  const pace = estimatePace(input.learning, events);
  const support = inferSupportPreference(events, prev.preferredSupport);
  const conv = conversationMetrics(events);
  const changes: ProfileChange[] = [];

  let primary = report.primary?.type ?? null;
  let primaryConf = report.primary?.confidence ?? 0;
  let secondary = report.secondary?.type ?? null;
  let secondaryConf = report.secondary?.confidence ?? 0;

  if (primary && !shouldFlipBottleneck(prev, primary, primaryConf)) {
    // Histerese: mantém gargalo anterior até evidência suficiente
    if (prev.primaryBottleneck && prev.primaryBottleneck !== primary) {
      changes.push({
        change: 'primaryBottleneck_hold',
        from: String(primary),
        to: String(prev.primaryBottleneck),
        reason: `evidência insuficiente (conf=${primaryConf.toFixed(2)}, stable=${prev.bottleneckStableSessions})`,
        confidence: primaryConf,
        timestamp: new Date().toISOString(),
        evidence: report.primary?.reason,
      });
      primary = prev.primaryBottleneck;
      primaryConf = prev.primaryBottleneckConfidence;
      secondary = prev.secondaryBottleneck;
      secondaryConf = prev.secondaryBottleneckConfidence;
    }
  }

  const flipped = !!primary && primary !== prev.primaryBottleneck;
  const stableSessions = flipped ? 0 : prev.bottleneckStableSessions + (input.force ? 1 : 1);

  if (flipped) {
    changes.push({
      change: 'primaryBottleneck',
      from: String(prev.primaryBottleneck),
      to: String(primary),
      reason: report.primary?.reason || 'novo gargalo dominante',
      confidence: primaryConf,
      timestamp: new Date().toISOString(),
      evidence: report.primary?.reason,
    });
  }

  const experimentArm: CorrectionStyle | undefined =
    events.filter((e) => e.type === 'SESSION_ENDED').length % 7 === 3
      ? prev.lastExperimentArm === 'short'
        ? 'brief_explanation'
        : 'short'
      : undefined;

  const strategy = buildStrategy({
    primary,
    secondary,
    strengths: strengths.map((s) => s.type),
    pace,
    support,
    conv,
    retentionScore: input.learning.retentionScore,
    userGoal: input.user.goal || 'daily',
    errorFocus: topError?.pattern,
    experimentArm,
  });

  if (strategy.preferredActivity !== prev.teachingStrategy.preferredActivity) {
    changes.push({
      change: 'teachingStrategy.preferredActivity',
      from: prev.teachingStrategy.preferredActivity,
      to: strategy.preferredActivity,
      reason: strategy.reason,
      confidence: primaryConf || 0.6,
      timestamp: new Date().toISOString(),
    });
  }

  const focusBottleneck = (primary || 'balanced') as PersonalLearningProfile['currentLearningFocus']['bottleneck'];
  const keepFocus =
    !flipped &&
    prev.currentLearningFocus.bottleneck === focusBottleneck &&
    prev.currentLearningFocus.evidenceSessions > 0;

  const profile: PersonalLearningProfile = {
    ...emptyPersonalLearningProfile(),
    ...prev,
    version: 1,
    updatedAt: new Date().toISOString(),
    skills: buildSkills(input.learning),
    primaryBottleneck: primary,
    secondaryBottleneck: secondary,
    primaryBottleneckConfidence: primaryConf,
    secondaryBottleneckConfidence: secondaryConf,
    strengths,
    errorPatterns,
    learningPace: pace,
    preferredSupport: support,
    conversationPerformance: conv,
    engagementPatterns: {
      avgSessionMinutes: input.user.dailyMinutes || prev.engagementPatterns.avgSessionMinutes,
      recentSessionCount: events.filter((e) => e.type === 'SESSION_ENDED').length,
      continuationRequests: prev.engagementPatterns.continuationRequests,
    },
    teachingStrategy: strategy,
    learningStrategy: {
      conversationFirst: strategy.conversationRatio >= 0.6,
      guidedPracticeWeight: strategy.preferredActivity === 'speaking' ? 0.55 : 0.35,
      retrievalFrequency: strategy.reviewIntensity === 'high' ? 0.55 : 0.3,
      transferFrequency: strategy.preferredActivity === 'transfer' ? 0.45 : 0.25,
      spontaneousFrequency: conv.independentResponseRate > 0.55 ? 0.35 : 0.2,
      reviewFrequency: strategy.reviewIntensity === 'high' ? 0.5 : strategy.reviewIntensity === 'low' ? 0.15 : 0.3,
    },
    currentLearningFocus: keepFocus
      ? {
          ...prev.currentLearningFocus,
          evidenceSessions: prev.currentLearningFocus.evidenceSessions + 1,
        }
      : {
          text: focusTextFor(primary, topError?.pattern),
          since: new Date().toISOString(),
          bottleneck: focusBottleneck,
          evidenceSessions: 1,
        },
    profileChanges: [...(prev.profileChanges || []), ...changes].slice(-40),
    bottleneckStableSessions: stableSessions,
    lastExperimentArm: strategy.correctionStyle,
  };

  input.learning.bottleneck = primary;

  return {
    profile,
    strategy,
    changed: changes.length > 0,
    changes,
  };
}

export async function refreshPersonalLearningAfterSession(
  user: UserProfile,
  learning: UserLearningProfile,
): Promise<AdaptationResult> {
  const events = await EventStore.recent(21 * 86_400_000);
  const result = adaptPersonalLearning({ user, learning, events, force: true });
  savePersonalLearningProfile(result.profile);

  if (result.changed) {
    for (const c of result.changes) {
      if (c.change === 'primaryBottleneck') {
        await EventStore.record({
          type: 'BOTTLENECK_DETECTED',
          context: JSON.stringify(c),
        });
      } else if (c.change.startsWith('teachingStrategy')) {
        await EventStore.record({
          type: 'STRATEGY_CHANGED',
          context: JSON.stringify(c),
        });
      }
    }
    await EventStore.record({
      type: 'ADAPTATION_APPLIED',
      context: JSON.stringify({
        preferredActivity: result.strategy.preferredActivity,
        focus: result.profile.currentLearningFocus.text,
        reason: result.strategy.reason,
      }),
    });
  }

  if (result.profile.strengths[0]) {
    await EventStore.record({
      type: 'STRENGTH_DETECTED',
      context: JSON.stringify(result.profile.strengths[0]),
    });
  }

  return result;
}

/** Aplica pesos de atividade ao plano diário (TeacherEngine). */
export function applyStrategyToStageWeights(
  preferredActivity: PreferredActivity,
  base: number[],
): number[] {
  // base: [warmup, listening, speaking, new, conversation]
  const w = [...base];
  if (preferredActivity === 'speaking') {
    w[2] *= 1.55;
    w[1] *= 0.7;
    w[4] *= 0.85;
  } else if (preferredActivity === 'listening') {
    w[1] *= 1.6;
    w[2] *= 0.75;
    w[4] *= 0.9;
  } else if (preferredActivity === 'review') {
    w[3] *= 1.3;
    w[2] *= 1.15;
    w[4] *= 0.8;
  } else if (preferredActivity === 'transfer') {
    w[4] *= 1.15;
    w[2] *= 1.1;
  }
  const sum = w.reduce((a, b) => a + b, 0) || 1;
  return w.map((x) => x / sum);
}

export { buildStrategy, shouldFlipBottleneck, estimatePace, focusTextFor };
