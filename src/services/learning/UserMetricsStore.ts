/**
 * Métricas do usuário — tempo de estudo, chunks, variações e fala autônoma.
 * Persistência: @deutsch_turbo:user_metrics
 */
import type { UserLearningProfile } from '@/services/learning/ConfidenceService';
import {
  L0_CHUNK_GRAPH,
  isZeroLanguagePhraseAccepted,
} from '@/services/teacher/ZeroLanguageMode';

export const USER_METRICS_STORAGE_KEY = '@deutsch_turbo:user_metrics';
export const DEFAULT_DAILY_GOAL_MINUTES = 30;

export type UserMetricsState = {
  date: string;
  dailyGoalMinutes: number;
  /** Segundos estudados hoje (precisão para barra de progresso). */
  secondsStudiedToday: number;
  learnedChunkIds: string[];
  totalVariationsCreated: number;
  speechPromptsTotal: number;
  speechPromptsCorrectNoHint: number;
};

export type UserMetricsView = {
  dailyGoalMinutes: number;
  minutesStudiedToday: number;
  minutesRemaining: number;
  dailyProgressPct: number;
  learnedChunksCount: number;
  totalVariationsCreated: number;
  autonomousSpeechPct: number;
  minutesStudiedLabel: string;
};

type Listener = (state: UserMetricsState) => void;

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function defaultState(): UserMetricsState {
  return {
    date: todayKey(),
    dailyGoalMinutes: DEFAULT_DAILY_GOAL_MINUTES,
    secondsStudiedToday: 0,
    learnedChunkIds: [],
    totalVariationsCreated: 0,
    speechPromptsTotal: 0,
    speechPromptsCorrectNoHint: 0,
  };
}

function normalizeState(raw: Partial<UserMetricsState> | null): UserMetricsState {
  const base = defaultState();
  if (!raw || typeof raw !== 'object') return base;
  if (raw.date !== todayKey()) return defaultState();
  return {
    date: todayKey(),
    dailyGoalMinutes:
      typeof raw.dailyGoalMinutes === 'number' && raw.dailyGoalMinutes > 0
        ? raw.dailyGoalMinutes
        : base.dailyGoalMinutes,
    secondsStudiedToday:
      typeof raw.secondsStudiedToday === 'number' ? Math.max(0, raw.secondsStudiedToday) : 0,
    learnedChunkIds: Array.isArray(raw.learnedChunkIds)
      ? [...new Set(raw.learnedChunkIds.filter((id) => typeof id === 'string'))]
      : [],
    totalVariationsCreated:
      typeof raw.totalVariationsCreated === 'number' ? Math.max(0, raw.totalVariationsCreated) : 0,
    speechPromptsTotal:
      typeof raw.speechPromptsTotal === 'number' ? Math.max(0, raw.speechPromptsTotal) : 0,
    speechPromptsCorrectNoHint:
      typeof raw.speechPromptsCorrectNoHint === 'number'
        ? Math.max(0, raw.speechPromptsCorrectNoHint)
        : 0,
  };
}

function loadState(): UserMetricsState {
  if (typeof localStorage === 'undefined') return defaultState();
  try {
    const raw = localStorage.getItem(USER_METRICS_STORAGE_KEY);
    if (!raw) return defaultState();
    return normalizeState(JSON.parse(raw) as Partial<UserMetricsState>);
  } catch {
    return defaultState();
  }
}

function saveState(state: UserMetricsState): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(USER_METRICS_STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

export function computeMetricsView(state: UserMetricsState): UserMetricsView {
  const minutesStudiedToday = state.secondsStudiedToday / 60;
  const minutesRounded = Math.max(0, Math.round(minutesStudiedToday));
  const goal = state.dailyGoalMinutes;
  const minutesRemaining = Math.max(0, Math.ceil(goal - minutesStudiedToday));
  const dailyProgressPct = Math.min(
    100,
    Math.round((minutesStudiedToday / Math.max(1, goal)) * 100),
  );
  const autonomousSpeechPct =
    state.speechPromptsTotal > 0
      ? Math.round((state.speechPromptsCorrectNoHint / state.speechPromptsTotal) * 100)
      : 0;

  return {
    dailyGoalMinutes: goal,
    minutesStudiedToday: minutesRounded,
    minutesRemaining,
    dailyProgressPct,
    learnedChunksCount: state.learnedChunkIds.length,
    totalVariationsCreated: state.totalVariationsCreated,
    autonomousSpeechPct,
    minutesStudiedLabel: `${minutesRounded} min`,
  };
}

/** Sincroniza chunks base e variações a partir do perfil de aprendizagem. */
export function deriveLearningCounts(learning: UserLearningProfile): {
  learnedChunkIds: string[];
  totalVariationsCreated: number;
} {
  const learnedChunkIds = Object.keys(L0_CHUNK_GRAPH).filter((baseId) =>
    isZeroLanguagePhraseAccepted(learning.phrases[baseId]),
  );

  let totalVariationsCreated = 0;
  for (const node of Object.values(L0_CHUNK_GRAPH)) {
    for (const varId of node.simpleVars) {
      if (isZeroLanguagePhraseAccepted(learning.phrases[varId])) {
        totalVariationsCreated += 1;
      }
    }
    for (const qId of node.questions) {
      if (isZeroLanguagePhraseAccepted(learning.phrases[qId])) {
        totalVariationsCreated += 1;
      }
    }
  }

  return { learnedChunkIds, totalVariationsCreated };
}

class UserMetricsStoreImpl {
  private listeners = new Set<Listener>();
  private state: UserMetricsState = loadState();

  getState(): UserMetricsState {
    this.state = normalizeState(this.state);
    return this.state;
  }

  getView(): UserMetricsView {
    return computeMetricsView(this.getState());
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(): void {
    const snap = this.getState();
    for (const fn of this.listeners) fn(snap);
  }

  private touch(): void {
    if (this.state.date !== todayKey()) {
      this.state = defaultState();
    }
  }

  addStudySeconds(seconds: number): void {
    if (seconds <= 0) return;
    this.touch();
    this.state.secondsStudiedToday += seconds;
    saveState(this.state);
    this.emit();
  }

  recordSpeechOutcome(input: { correct: boolean; withHint: boolean }): void {
    this.touch();
    this.state.speechPromptsTotal += 1;
    if (input.correct && !input.withHint) {
      this.state.speechPromptsCorrectNoHint += 1;
    }
    saveState(this.state);
    this.emit();
  }

  recordVariationCompleted(): void {
    this.touch();
    this.state.totalVariationsCreated += 1;
    saveState(this.state);
    this.emit();
  }

  syncFromLearning(learning: UserLearningProfile): void {
    this.touch();
    const derived = deriveLearningCounts(learning);
    this.state.learnedChunkIds = derived.learnedChunkIds;
    this.state.totalVariationsCreated = Math.max(
      this.state.totalVariationsCreated,
      derived.totalVariationsCreated,
    );
    saveState(this.state);
    this.emit();
  }

  setDailyGoal(minutes: number): void {
    this.touch();
    this.state.dailyGoalMinutes = Math.max(5, Math.min(120, minutes));
    saveState(this.state);
    this.emit();
  }
}

export const UserMetricsStore = new UserMetricsStoreImpl();
