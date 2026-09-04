export type SessionKind =
  | 'FIRST_SESSION'
  | 'RETURNING_SESSION'
  | 'REVIEW_SESSION'
  | 'CONTINUATION_SESSION'
  | 'NEW_CONTENT_SESSION'
  | 'FREE_CONVERSATION';

export type OpeningStrategy =
  | 'first_intro'
  | 'welcome_back'
  | 'continue_topic'
  | 'review_weak'
  | 'review_mistake'
  | 'recall_old'
  | 'advance'
  | 'natural'
  /** Home / Meus Chunks / Estrutura — target explícito do usuário. */
  | 'selected_target';

export type SessionStatus = 'CREATED' | 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'ABANDONED';

export interface SessionMistake {
  phrase: string;
  userSaid: string;
}

export interface SessionMessage {
  role: 'user' | 'assistant';
  text: string;
  at: string;
}

/** Sessão de aprendizagem persistida. Encerrar ≠ apagar. */
export interface LearningSession {
  id: string;
  startedAt: string;
  endedAt: string | null;
  status: SessionStatus;
  topic: string;
  goal: string;
  level: string;
  messages: SessionMessage[];
  learnedItems: string[];
  reviewItems: string[];
  mistakes: SessionMistake[];
  lastTeacherMessage: string;
  lastUserResponse: string;
  unfinishedContent: string[];
  nextRecommendedStep: string;
}

export interface LastSessionSummary {
  sessionId?: string;
  date: string;
  durationMinutes: number;
  topic: string;
  phrasesLearned: string[];
  phrasesReviewed: string[];
  mistakes: string[];
  unfinishedContent: string[];
  lastQuestion: string;
  lastTeacherMessage: string;
  lastUserResponse: string;
  nextSuggestedStep: string;
  lastOpening: string;
  sessionKind: SessionKind;
  strongItems?: string[];
  weakItems?: string[];
  unfinishedGoal?: string;
  /** Fase 3 — scaffolding na sessão. */
  averageSupportLevel?: number;
  lowestSupportLevel?: number;
  independentResponses?: number;
}

export interface SessionOpening {
  kind: SessionKind;
  strategy: OpeningStrategy;
  german: string;
  portuguese: string;
  expected?: string;
  hint?: string;
  topic: string;
  reason: string;
  pedagogicalRepeat: boolean;
}

export interface ContinuityState {
  sessionCount: number;
  lastSession: LastSessionSummary | null;
  recentOpenings: { german: string; at: string; usageCount?: number }[];
  currentTopic: string | null;
  currentSession: LearningSession | null;
  recentSessions: LastSessionSummary[];
  topicHistory: string[];
}

export interface StudentMemorySummary {
  facts: string[];
  studied: string[];
  mistakes: string[];
  recentTopics: string[];
  weakPhrases: string[];
  currentGoal: string;
  lastOpening: string;
  hoursSinceLast: number | null;
}

/** Contexto compacto enviado ao Gemini. Não é o histórico bruto. */
export interface SessionContext {
  studentLevel: string;
  recentTopic: string;
  recentPhrases: string[];
  weakPhrases: string[];
  recentMistakes: string[];
  unfinishedGoal: string;
  lastInteraction: string;
  lastTeacherQuestion: string;
  lastUserAnswer: string;
  recommendedContinuation: string;
  sessionKind: SessionKind;
}

export interface OpeningContext {
  sessionCount: number;
  lastSession: LastSessionSummary | null;
  recentOpenings: string[];
  hoursSinceLast: number | null;
  weakPhrases: string[];
  knownPhrases: string[];
  goal: string;
  profession: string;
  name?: string;
  incomplete?: LearningSession | null;
  /** Fase 11 — abertura curta / continuidade L0 */
  zeroLanguageMode?: boolean;
}
