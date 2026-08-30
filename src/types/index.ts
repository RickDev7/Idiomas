export type Level = 'zero' | 'little' | 'basic';
export type SelfReportedLevel =
  | 'zero'
  | 'beginner'
  | 'basic'
  | 'intermediate'
  | 'intermediate_plus'
  | 'advanced'
  | 'very_advanced'
  | 'unknown';
export type Goal = 'work' | 'daily' | 'family' | 'travel' | 'conversation';
export type SessionDuration = 10 | 20 | 30 | 60 | 90;
export type ImmersionPhase = 1 | 2 | 3 | 4;
export type MasteryLevel = 'recognize' | 'understand' | 'speak' | 'automatic';
export type ReviewStage = 'new' | 'learning' | 'hard' | 'almost' | 'mastered' | 'automatic';
export type SpeechSpeed = 'slow' | 'normal' | 'natural';
export type HelpLevel = 1 | 2 | 3 | 4 | 5;

export interface UserProfile {
  id: string;
  name: string;
  level: Level;
  dailyMinutes: SessionDuration;
  goal: Goal;
  profession: string;
  frequentSituations: string[];
  interests: string[];
  onboardingComplete: boolean;
  firstLessonComplete: boolean;
  currentDay: number;
  streak: number;
  lastStudyDate: string | null;
  immersionPhase: ImmersionPhase;
  turboMode: boolean;
  speechSpeed: SpeechSpeed;
  germanPercentage: number;
  createdAt: string;
  workContext?: WorkContext;
  /** Autoavaliação do onboarding (não é certificação). */
  selfReportedLevel?: SelfReportedLevel;
  /** Nível estimado pelo diagnóstico curto, se houver. Preferido no treino. */
  diagnosticLevel?: string;
  speakingLevel?: string;
  listeningLevel?: string;
  readingLevel?: string;
  writingLevel?: string;
  vocabularyLevel?: string;
  communicationLevel?: string;
}

export interface WorkContext {
  profession: string;
  tools: string[];
  tasks: string[];
  equipment: string[];
  colleagues: string[];
  frequentSituations: string[];
  workPhrases: string[];
}

export interface Word {
  id: string;
  german: string;
  portuguese: string;
  category: string;
  day?: number;
  mastery: MasteryLevel;
  reviewStage: ReviewStage;
  nextReview: string | null;
  timesReviewed: number;
  timesCorrect: number;
  timesIncorrect: number;
}

export interface Phrase {
  id: string;
  german: string;
  portuguese: string;
  category: string;
  chunk?: string;
  day?: number;
  situation?: string;
  mastery: MasteryLevel;
  reviewStage: ReviewStage;
  nextReview: string | null;
  timesReviewed: number;
  timesCorrect: number;
  timesIncorrect: number;
  isAutomatic: boolean;
  contexts: string[];
}

export interface PersonalPhrase {
  id: string;
  portugueseInput: string;
  german: string;
  createdAt: string;
  mastery: MasteryLevel;
  reviewStage: ReviewStage;
  nextReview: string | null;
  practiced: number;
}

export interface Review {
  id: string;
  itemId: string;
  itemType: 'word' | 'phrase' | 'personal';
  stage: ReviewStage;
  nextReview: string;
  lastReviewed: string | null;
  intervalDays: number;
  easeFactor: number;
  consecutiveCorrect: number;
}

export interface Mistake {
  id: string;
  type: 'grammar' | 'vocabulary' | 'pronunciation' | 'word_order' | 'article';
  userSaid: string;
  correct: string;
  explanation: string;
  context: string;
  count: number;
  lastOccurrence: string;
  mastered: boolean;
  category: string;
}

export interface ConversationMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  german?: string;
  portuguese?: string;
  timestamp: string;
  correction?: string;
  hint?: string;
}

export interface Conversation {
  id: string;
  type: 'free' | 'situation' | 'lesson' | 'micro' | 'review' | 'first' | 'turbo' | 'quick';
  title: string;
  messages: ConversationMessage[];
  startedAt: string;
  endedAt?: string;
  situationId?: string;
  dayNumber?: number;
}

export interface Mission {
  id: string;
  day: number;
  phrase: string;
  german: string;
  context: string;
  completed: boolean;
  completedAt?: string;
  attempted: boolean;
}

export interface Situation {
  id: string;
  title: string;
  category: SituationCategory;
  description: string;
  icon: string;
  difficulty: Level;
  openingLine: string;
  keyPhrases: string[];
  practiced: boolean;
  timesPracticed: number;
}

export type SituationCategory =
  | 'work'
  | 'supermarket'
  | 'bank'
  | 'doctor'
  | 'phone'
  | 'garage'
  | 'home'
  | 'school'
  | 'authorities'
  | 'restaurant'
  | 'transport'
  | 'social'
  | 'hotel'
  | 'travel';

export interface Progress {
  id: string;
  communicationScore: number;
  comprehension: number;
  production: number;
  retention: number;
  vocabulary: number;
  listening: number;
  pronunciation: number;
  conversation: number;
  spontaneity: number;
  totalStudyMinutes: number;
  wordsLearned: number;
  phrasesLearned: number;
  phrasesAutomatic: number;
  conversationsCompleted: number;
  missionsCompleted: number;
  weeklyScores: WeeklyScore[];
  bottlenecks: Bottleneck[];
}

export interface WeeklyScore {
  week: number;
  score: number;
  comprehension: number;
  vocabulary: number;
  fluency: number;
  pronunciation: number;
  grammar: number;
  date: string;
}

export interface Bottleneck {
  id: string;
  type: string;
  description: string;
  recommendation: string;
  detectedAt: string;
}

export interface DailySession {
  id: string;
  date: string;
  dayNumber: number;
  plannedMinutes: number;
  actualMinutes: number;
  activities: SessionActivity[];
  missionCompleted: boolean;
  completed: boolean;
}

export interface SessionActivity {
  type: 'review' | 'listening' | 'speaking' | 'conversation' | 'mission' | 'micro';
  plannedMinutes: number;
  actualMinutes: number;
  completed: boolean;
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  unlockedAt?: string;
  xp: number;
}

export interface DayProgram {
  day: number;
  title: string;
  phase: string;
  objectives: string[];
  phrases: string[];
  words: string[];
  dialogues: string[];
  mission: string;
  listeningLevel: number;
}

export interface AIResponse {
  german: string;
  portuguese?: string;
  correction?: string;
  hint?: string;
  helpLevel?: HelpLevel;
  shouldSpeak: boolean;
  nextPrompt?: string;
  reviewItem?: string;
  emotion?: 'encouraging' | 'neutral' | 'challenging';
}

export interface ConversationContext {
  type: 'free' | 'situation' | 'lesson' | 'micro' | 'review' | 'first' | 'turbo' | 'quick';
  userLevel: Level;
  immersionPhase: ImmersionPhase;
  topic?: string;
  situationId?: string;
  dayNumber?: number;
  previousMessages: ConversationMessage[];
  userProfile: UserProfile;
  dueReviews: (Word | Phrase)[];
  recentMistakes: Mistake[];
  helpRequested?: boolean;
  repeatRequested?: boolean;
  slowerRequested?: boolean;
  explainRequested?: boolean;
}

export interface ListeningExercise {
  id: string;
  level: number;
  title: string;
  audioText: string;
  showText: boolean;
  speed: SpeechSpeed;
  hasBackgroundNoise: boolean;
  questions: { question: string; answer: string }[];
}

export interface QuickResponseExercise {
  id: string;
  prompt: string;
  expectedAnswers: string[];
  timeLimit: number;
  difficulty: Level;
}

export const REVIEW_INTERVALS: Record<ReviewStage, number> = {
  new: 0,
  learning: 1,
  hard: 3,
  almost: 7,
  mastered: 14,
  automatic: 30,
};

export const IMMERSION_PERCENTAGES: Record<ImmersionPhase, number> = {
  1: 80,
  2: 90,
  3: 95,
  4: 100,
};
