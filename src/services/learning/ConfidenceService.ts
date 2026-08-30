import type { Level, Mistake, UserProfile, Word } from '@/types';

export type PhraseState =
  | 'new'
  | 'heard'
  | 'repeated'
  | 'recognized'
  | 'answeredWithHelp'
  | 'answeredAlone'
  | 'answeredFast'
  | 'usedInContext'
  | 'spontaneous'
  | 'automatic';

export interface AutomationHistoryEntry {
  score: number;
  date: string;
  evidence: string;
  sessionId?: string;
}

export interface ReviewHistoryEntry {
  reviewType: string;
  result: 'SUCCESS' | 'PARTIAL' | 'FAILED';
  timestamp: string;
  helpLevel?: number;
}

export interface PhraseConfidence {
  phraseId: string;
  state: PhraseState;
  confidence: number;
  recognition: number;
  listening: number;
  speaking: number;
  production: number;
  speed: number;
  contextTransfer: number;
  timesSeen: number;
  timesProduced: number;
  timesCorrect: number;
  lastSeen: string | null;
  lastProduced: string | null;
  avgResponseMs: number;
  needsHelp: boolean;
  automationScore?: number;
  automationUpdatedAt?: string;
  /** Alias persistido (Fase 6). */
  lastAutomationUpdate?: string;
  automationHistory?: AutomationHistoryEntry[];
  successfulSessions?: number;
  independentSessions?: number;
  spontaneousSessions?: number;
  lastEvidenceSessionId?: string;
  /** Fase 7 — revisão / retenção. */
  lastRecalled?: string | null;
  lastIndependentUse?: string | null;
  lastTransfer?: string | null;
  lastSpontaneous?: string | null;
  lastReviewed?: string | null;
  reviewCount?: number;
  successiveSuccess?: number;
  nextReview?: string | null;
  reviewHistory?: ReviewHistoryEntry[];
}

export interface UserLearningProfile {
  userLevel: Level;
  communicationScore: number;
  listeningScore: number;
  speakingScore: number;
  retentionScore: number;
  pronunciationScore: number;
  responseSpeedScore: number;
  immersionLevel: number;
  dailyGoal: number;
  currentStreak: number;
  totalStudyTime: number;
  knownWords: string[];
  knownPhrases: string[];
  weakPhrases: string[];
  strongPhrases: string[];
  recurringMistakes: string[];
  recentTopics: string[];
  recentSituations: string[];
  lastSession: string | null;
  learningVelocity: number;
  phrases: Record<string, PhraseConfidence>;
  bottleneck: string | null;
}

const STATE_ORDER: PhraseState[] = [
  'new',
  'heard',
  'repeated',
  'recognized',
  'answeredWithHelp',
  'answeredAlone',
  'answeredFast',
  'usedInContext',
  'spontaneous',
  'automatic',
];

export function stateIndex(s: PhraseState): number {
  return STATE_ORDER.indexOf(s);
}

export function emptyConfidence(phraseId: string): PhraseConfidence {
  return {
    phraseId,
    state: 'new',
    confidence: 0,
    recognition: 0,
    listening: 0,
    speaking: 0,
    production: 0,
    speed: 0,
    contextTransfer: 0,
    timesSeen: 0,
    timesProduced: 0,
    timesCorrect: 0,
    lastSeen: null,
    lastProduced: null,
    avgResponseMs: 0,
    needsHelp: false,
  };
}

export function buildLearningProfile(
  profile: UserProfile,
  words: Word[],
  mistakes: Mistake[],
  progress: { communicationScore: number; listening: number; production: number; retention: number; pronunciation: number; totalStudyMinutes: number } | null,
  stored: Record<string, PhraseConfidence>,
): UserLearningProfile {
  const knownPhrases = Object.values(stored).filter((c) => c.confidence >= 60).map((c) => c.phraseId);
  const weakPhrases = Object.values(stored).filter((c) => c.confidence > 0 && c.confidence < 40).map((c) => c.phraseId);
  const strongPhrases = Object.values(stored).filter((c) => c.confidence >= 85).map((c) => c.phraseId);
  const knownWords = words.filter((w) => w.mastery !== 'recognize').map((w) => w.id);
  const recurring = mistakes.filter((m) => m.count >= 2 && !m.mastered).map((m) => m.id);

  return {
    userLevel: profile.level,
    communicationScore: progress?.communicationScore ?? 0,
    listeningScore: progress?.listening ?? 0,
    speakingScore: progress?.production ?? 0,
    retentionScore: progress?.retention ?? 0,
    pronunciationScore: progress?.pronunciation ?? 0,
    responseSpeedScore: 50,
    immersionLevel: profile.germanPercentage,
    dailyGoal: profile.dailyMinutes,
    currentStreak: profile.streak,
    totalStudyTime: progress?.totalStudyMinutes ?? 0,
    knownWords,
    knownPhrases,
    weakPhrases,
    strongPhrases,
    recurringMistakes: recurring,
    recentTopics: [],
    recentSituations: profile.frequentSituations,
    lastSession: profile.lastStudyDate,
    learningVelocity: 0,
    phrases: stored,
    bottleneck: null,
  };
}

export function updateConfidence(
  current: PhraseConfidence,
  event: {
    type: 'heard' | 'repeated' | 'recognized' | 'produced' | 'help' | 'transfer' | 'fast' | 'spontaneous';
    correct: boolean;
    responseMs?: number;
    withHelp?: boolean;
  },
): PhraseConfidence {
  const next = { ...current };
  next.timesSeen += 1;
  next.lastSeen = new Date().toISOString();

  const bump = (field: keyof PhraseConfidence, amount: number) => {
    next[field] = Math.min(100, (next[field] as number) + amount) as never;
  };

  if (event.type === 'heard') {
    bump('listening', 15);
    bump('recognition', 10);
    if (current.state === 'new') next.state = 'heard';
    next.confidence = Math.min(100, next.confidence + 8);
  } else if (event.type === 'repeated') {
    bump('speaking', 12);
    bump('production', 8);
    if (stateIndex(current.state) < stateIndex('repeated')) next.state = 'repeated';
    next.confidence = Math.min(100, next.confidence + 10);
  } else if (event.type === 'recognized') {
    bump('recognition', 15);
    bump('listening', 10);
    if (stateIndex(current.state) < stateIndex('recognized')) next.state = 'recognized';
    next.confidence = Math.min(100, next.confidence + 12);
  } else if (event.type === 'produced') {
    next.timesProduced += 1;
    next.lastProduced = new Date().toISOString();
    if (event.responseMs) {
      next.avgResponseMs =
        next.avgResponseMs === 0
          ? event.responseMs
          : Math.round(next.avgResponseMs * 0.7 + event.responseMs * 0.3);
    }
    if (event.correct) {
      next.timesCorrect += 1;
      bump('production', 20);
      bump('speaking', 15);
      if (event.withHelp) {
        next.needsHelp = true;
        if (stateIndex(current.state) < stateIndex('answeredWithHelp')) next.state = 'answeredWithHelp';
        next.confidence = Math.min(100, next.confidence + 10);
      } else {
        next.needsHelp = false;
        if (stateIndex(current.state) < stateIndex('answeredAlone')) next.state = 'answeredAlone';
        next.confidence = Math.min(100, next.confidence + 18);
      }
    } else {
      bump('production', 5);
      next.needsHelp = true;
      next.confidence = Math.max(0, next.confidence - 4);
    }
  } else if (event.type === 'help') {
    next.needsHelp = true;
    if (stateIndex(current.state) < stateIndex('answeredWithHelp')) next.state = 'answeredWithHelp';
    next.confidence = Math.max(0, next.confidence - 2);
  } else if (event.type === 'transfer') {
    bump('contextTransfer', 25);
    if (stateIndex(current.state) < stateIndex('usedInContext')) next.state = 'usedInContext';
    next.confidence = Math.min(100, next.confidence + 15);
  } else if (event.type === 'spontaneous') {
    bump('contextTransfer', 30);
    bump('production', 10);
    bump('speed', 8);
    if (stateIndex(current.state) < stateIndex('spontaneous')) next.state = 'spontaneous';
    next.needsHelp = false;
    next.confidence = Math.min(100, next.confidence + 20);
  } else if (event.type === 'fast') {
    bump('speed', 20);
    if (event.responseMs) {
      next.avgResponseMs = next.avgResponseMs === 0 ? event.responseMs : Math.round(next.avgResponseMs * 0.7 + event.responseMs * 0.3);
    }
    if (stateIndex(current.state) < stateIndex('answeredFast')) next.state = 'answeredFast';
    next.confidence = Math.min(100, next.confidence + 12);
  }

  if (next.confidence >= 90 && stateIndex(next.state) >= stateIndex('usedInContext') && next.contextTransfer >= 50) {
    next.state = 'automatic';
  }
  return next;
}

export function isMastered(c: PhraseConfidence): boolean {
  return c.state === 'automatic' && c.confidence >= 90;
}

export function canProduce(c: PhraseConfidence): boolean {
  return stateIndex(c.state) >= stateIndex('answeredAlone');
}
