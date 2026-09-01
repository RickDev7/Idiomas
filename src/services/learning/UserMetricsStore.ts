/**
 * Métricas do usuário — chunks, variações e fala autônoma.
 * Tempo/meta diária: DailyGoalStore (@deutsch_turbo:daily_goal)
 */
import type { UserLearningProfile } from '@/services/learning/ConfidenceService';
import {
  DailyGoalStore,
  type DailyGoalView,
} from '@/services/learning/DailyGoalStore';
import {
  L0_CHUNK_GRAPH,
  isZeroLanguagePhraseAccepted,
} from '@/services/teacher/ZeroLanguageMode';

export const USER_METRICS_STORAGE_KEY = '@deutsch_turbo:user_metrics';
export { DEFAULT_DAILY_GOAL_MINUTES } from '@/services/learning/DailyGoalStore';

export type UserMetricsState = {
  date: string;
  learnedChunkIds: string[];
  totalVariationsCreated: number;
  speechPromptsTotal: number;
  speechPromptsCorrectNoHint: number;
};

export type UserMetricsView = DailyGoalView & {
  learnedChunksCount: number;
  totalVariationsCreated: number;
  autonomousSpeechPct: number;
};

type Listener = (state: UserMetricsState) => void;

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function defaultState(): UserMetricsState {
  return {
    date: todayKey(),
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

export function computeMetricsView(
  state: UserMetricsState,
  daily: DailyGoalView = DailyGoalStore.getView(),
): UserMetricsView {
  const autonomousSpeechPct =
    state.speechPromptsTotal > 0
      ? Math.round((state.speechPromptsCorrectNoHint / state.speechPromptsTotal) * 100)
      : 0;

  return {
    ...daily,
    learnedChunksCount: state.learnedChunkIds.length,
    totalVariationsCreated: state.totalVariationsCreated,
    autonomousSpeechPct,
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

  constructor() {
    DailyGoalStore.subscribe(() => this.emit());
  }

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
    DailyGoalStore.addStudySeconds(seconds);
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
    DailyGoalStore.setDailyGoal(minutes);
  }

  dismissMorningPrompt(): void {
    DailyGoalStore.dismissMorningPrompt();
  }
}

export const UserMetricsStore = new UserMetricsStoreImpl();
