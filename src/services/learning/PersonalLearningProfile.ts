/* PersonalLearningProfile — como ESTE aluno aprende (Fase 9).
   Separado de UserLearningProfile (o quê consegue fazer).
   Persistência local; não enviar o perfil inteiro ao Gemini. */

import type { BottleneckType } from '@/services/learning/BottleneckDetector';

export type SkillArea =
  | 'speaking'
  | 'listening'
  | 'vocabulary'
  | 'grammar'
  | 'pronunciation'
  | 'reading'
  | 'writing'
  | 'communication'
  | 'fluency';

export interface SkillSnapshot {
  confidence: number;
  accuracy: number;
  independence: number;
  automation: number;
  retention: number;
}

export type SupportPreference = 'context' | 'translation' | 'example' | 'minimal';
export type CorrectionStyle = 'short' | 'brief_explanation';
export type LearningPaceBand = 'fast' | 'steady' | 'careful';
export type PreferredActivity = 'speaking' | 'listening' | 'mixed' | 'review' | 'transfer';
export type ReviewIntensity = 'low' | 'medium' | 'high';

export interface TeachingStrategy {
  supportPreference: SupportPreference;
  preferredActivity: PreferredActivity;
  correctionStyle: CorrectionStyle;
  pace: LearningPaceBand;
  /** 0–1: fração da sessão em conversa vs intervenção. */
  conversationRatio: number;
  reviewIntensity: ReviewIntensity;
  /** 0–100 — dificuldade relativa, NÃO nível CEFR. */
  challengeLevel: number;
  contextBridge?: string;
  errorFocus?: string;
  reason: string;
}

export interface LearningStrategy {
  conversationFirst: boolean;
  guidedPracticeWeight: number;
  retrievalFrequency: number;
  transferFrequency: number;
  spontaneousFrequency: number;
  reviewFrequency: number;
}

export interface StrengthEntry {
  type: string;
  confidence: number;
  reason: string;
}

export interface ErrorPatternEntry {
  pattern: string;
  count: number;
  lastSeen: string;
  confidence: number;
  contexts: string[];
}

export interface ConversationPerformance {
  averageResponseLatencyMs: number;
  independentResponseRate: number;
  spontaneousUseRate: number;
  transferSuccessRate: number;
  helpDependency: number;
}

export interface EngagementPatterns {
  avgSessionMinutes: number;
  recentSessionCount: number;
  continuationRequests: number;
}

export interface LearningFocus {
  text: string;
  since: string;
  bottleneck: Exclude<BottleneckType, null> | 'balanced';
  evidenceSessions: number;
}

export interface ProfileChange {
  change: string;
  from?: string;
  to?: string;
  reason: string;
  confidence: number;
  timestamp: string;
  evidence?: string;
}

export interface PersonalLearningProfile {
  version: 1;
  updatedAt: string;
  skills: Partial<Record<SkillArea, SkillSnapshot>>;
  primaryBottleneck: BottleneckType;
  secondaryBottleneck: BottleneckType;
  primaryBottleneckConfidence: number;
  secondaryBottleneckConfidence: number;
  strengths: StrengthEntry[];
  errorPatterns: ErrorPatternEntry[];
  /** Estimativa: sessões médias até uma estrutura nova estabilizar. */
  learningPace: number;
  preferredSupport: SupportPreference;
  conversationPerformance: ConversationPerformance;
  engagementPatterns: EngagementPatterns;
  teachingStrategy: TeachingStrategy;
  learningStrategy: LearningStrategy;
  currentLearningFocus: LearningFocus;
  profileChanges: ProfileChange[];
  /** Sessões observadas desde a última mudança de gargalo. */
  bottleneckStableSessions: number;
  lastExperimentArm?: CorrectionStyle;
}

const STORE_KEY = 'personal-learning-profile';

export function emptyTeachingStrategy(reason = 'default'): TeachingStrategy {
  return {
    supportPreference: 'context',
    preferredActivity: 'mixed',
    correctionStyle: 'short',
    pace: 'steady',
    conversationRatio: 0.65,
    reviewIntensity: 'medium',
    challengeLevel: 50,
    reason,
  };
}

export function emptyPersonalLearningProfile(): PersonalLearningProfile {
  return {
    version: 1,
    updatedAt: new Date(0).toISOString(),
    skills: {},
    primaryBottleneck: null,
    secondaryBottleneck: null,
    primaryBottleneckConfidence: 0,
    secondaryBottleneckConfidence: 0,
    strengths: [],
    errorPatterns: [],
    learningPace: 3,
    preferredSupport: 'context',
    conversationPerformance: {
      averageResponseLatencyMs: 0,
      independentResponseRate: 0,
      spontaneousUseRate: 0,
      transferSuccessRate: 0,
      helpDependency: 0,
    },
    engagementPatterns: {
      avgSessionMinutes: 0,
      recentSessionCount: 0,
      continuationRequests: 0,
    },
    teachingStrategy: emptyTeachingStrategy('inicial'),
    learningStrategy: {
      conversationFirst: true,
      guidedPracticeWeight: 0.4,
      retrievalFrequency: 0.3,
      transferFrequency: 0.25,
      spontaneousFrequency: 0.2,
      reviewFrequency: 0.3,
    },
    currentLearningFocus: {
      text: 'Ganhar confiança para falar.',
      since: new Date(0).toISOString(),
      bottleneck: 'balanced',
      evidenceSessions: 0,
    },
    profileChanges: [],
    bottleneckStableSessions: 0,
  };
}

export function loadPersonalLearningProfile(): PersonalLearningProfile {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return emptyPersonalLearningProfile();
    const parsed = JSON.parse(raw) as PersonalLearningProfile;
    if (parsed?.version !== 1) return emptyPersonalLearningProfile();
    return {
      ...emptyPersonalLearningProfile(),
      ...parsed,
      teachingStrategy: { ...emptyTeachingStrategy(), ...parsed.teachingStrategy },
      learningStrategy: {
        ...emptyPersonalLearningProfile().learningStrategy,
        ...parsed.learningStrategy,
      },
      conversationPerformance: {
        ...emptyPersonalLearningProfile().conversationPerformance,
        ...parsed.conversationPerformance,
      },
      engagementPatterns: {
        ...emptyPersonalLearningProfile().engagementPatterns,
        ...parsed.engagementPatterns,
      },
      currentLearningFocus: {
        ...emptyPersonalLearningProfile().currentLearningFocus,
        ...parsed.currentLearningFocus,
      },
    };
  } catch {
    return emptyPersonalLearningProfile();
  }
}

export function savePersonalLearningProfile(profile: PersonalLearningProfile): void {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(profile));
  } catch {
    /* quota */
  }
}

/** Resumo seguro para Gemini — só o essencial. */
export function geminiAdaptationSnippet(p: PersonalLearningProfile): string {
  const s = p.teachingStrategy;
  const focus = p.currentLearningFocus?.text || '';
  const lines = [
    focus ? `FOCO DO ALUNO: ${focus}` : '',
    `ESTRATÉGIA: atividade=${s.preferredActivity}; suporte=${s.supportPreference}; correção=${s.correctionStyle}; ritmo=${s.pace}`,
    `conversa≈${Math.round(s.conversationRatio * 100)}%; revisão=${s.reviewIntensity}; desafio=${s.challengeLevel}`,
    s.contextBridge ? `ponte de contexto: ${s.contextBridge}` : '',
    s.errorFocus ? `padrão de erro a trabalhar: ${s.errorFocus}` : '',
  ];
  return lines.filter(Boolean).join('\n');
}

/** Texto amigável para Home — sem números técnicos. */
export function userFacingFocus(p: PersonalLearningProfile): string {
  return p.currentLearningFocus?.text || 'Continuar praticando com confiança.';
}

export { STORE_KEY as PERSONAL_LEARNING_STORE_KEY };
