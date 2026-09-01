/**
 * Meta diária flexível + tempo estudado hoje.
 * Persistência: @deutsch_turbo:daily_goal
 */

export const DAILY_GOAL_STORAGE_KEY = '@deutsch_turbo:daily_goal';
export const DEFAULT_DAILY_GOAL_MINUTES = 30;
export const GOAL_PRESETS = [10, 20, 30, 60] as const;

export type DailyGoalState = {
  date: string;
  dailyGoalMinutes: number;
  secondsStudiedToday: number;
  showMorningPrompt: boolean;
};

export type DailyGoalView = {
  dailyGoalMinutes: number;
  minutesStudiedToday: number;
  minutesRemaining: number;
  dailyProgressPct: number;
  goalReached: boolean;
  overtimeMinutes: number;
  heroBadgeLabel: string;
  minutesStudiedLabel: string;
  showMorningPrompt: boolean;
};

type Listener = (state: DailyGoalState) => void;

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function clampGoal(minutes: number): number {
  return Math.max(5, Math.min(120, Math.round(minutes)));
}

function defaultState(): DailyGoalState {
  return {
    date: todayKey(),
    dailyGoalMinutes: DEFAULT_DAILY_GOAL_MINUTES,
    secondsStudiedToday: 0,
    showMorningPrompt: false,
  };
}

function normalizeState(raw: Partial<DailyGoalState> | null): DailyGoalState {
  const today = todayKey();
  if (!raw || typeof raw !== 'object') return defaultState();

  const prevGoal =
    typeof raw.dailyGoalMinutes === 'number' && raw.dailyGoalMinutes > 0
      ? clampGoal(raw.dailyGoalMinutes)
      : DEFAULT_DAILY_GOAL_MINUTES;

  if (raw.date !== today) {
    return {
      date: today,
      dailyGoalMinutes: prevGoal,
      secondsStudiedToday: 0,
      showMorningPrompt: true,
    };
  }

  return {
    date: today,
    dailyGoalMinutes: prevGoal,
    secondsStudiedToday:
      typeof raw.secondsStudiedToday === 'number' ? Math.max(0, raw.secondsStudiedToday) : 0,
    showMorningPrompt: !!raw.showMorningPrompt,
  };
}

function loadState(): DailyGoalState {
  if (typeof localStorage === 'undefined') return defaultState();
  try {
    migrateFromUserMetrics();
    const raw = localStorage.getItem(DAILY_GOAL_STORAGE_KEY);
    if (!raw) return defaultState();
    return normalizeState(JSON.parse(raw) as Partial<DailyGoalState>);
  } catch {
    return defaultState();
  }
}

function saveState(state: DailyGoalState): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(DAILY_GOAL_STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

/** Migra meta/tempo legados de @deutsch_turbo:user_metrics (uma vez). */
function migrateFromUserMetrics(): void {
  if (typeof localStorage === 'undefined') return;
  if (localStorage.getItem(DAILY_GOAL_STORAGE_KEY)) return;
  try {
    const raw = localStorage.getItem('@deutsch_turbo:user_metrics');
    if (!raw) return;
    const parsed = JSON.parse(raw) as Partial<{
      date: string;
      dailyGoalMinutes: number;
      secondsStudiedToday: number;
    }>;
    if (
      typeof parsed.dailyGoalMinutes !== 'number' &&
      typeof parsed.secondsStudiedToday !== 'number'
    ) {
      return;
    }
    const migrated = normalizeState({
      date: parsed.date ?? todayKey(),
      dailyGoalMinutes: parsed.dailyGoalMinutes,
      secondsStudiedToday: parsed.secondsStudiedToday,
      showMorningPrompt: false,
    });
    saveState(migrated);
  } catch {
    /* ignore */
  }
}

export function computeDailyGoalView(state: DailyGoalState): DailyGoalView {
  const minutesStudiedToday = state.secondsStudiedToday / 60;
  const minutesRounded = Math.max(0, Math.round(minutesStudiedToday));
  const goal = state.dailyGoalMinutes;
  const goalReached = minutesStudiedToday >= goal;
  const minutesRemaining = Math.max(0, Math.ceil(goal - minutesStudiedToday));
  const overtimeMinutes = goalReached
    ? Math.max(0, Math.round(minutesStudiedToday - goal))
    : 0;
  const dailyProgressPct = Math.min(
    100,
    Math.round((minutesStudiedToday / Math.max(1, goal)) * 100),
  );

  const heroBadgeLabel = goalReached
    ? `🔥 Meta atingida! +${overtimeMinutes} min`
    : `${minutesRemaining} min restantes`;

  return {
    dailyGoalMinutes: goal,
    minutesStudiedToday: minutesRounded,
    minutesRemaining,
    dailyProgressPct,
    goalReached,
    overtimeMinutes,
    heroBadgeLabel,
    minutesStudiedLabel: `${minutesRounded} min`,
    showMorningPrompt: state.showMorningPrompt,
  };
}

class DailyGoalStoreImpl {
  private listeners = new Set<Listener>();
  private state: DailyGoalState = loadState();

  getState(): DailyGoalState {
    this.state = normalizeState(this.state);
    return this.state;
  }

  getView(): DailyGoalView {
    return computeDailyGoalView(this.getState());
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
    const normalized = normalizeState(this.state);
    if (normalized.date !== this.state.date || normalized.showMorningPrompt !== this.state.showMorningPrompt) {
      this.state = normalized;
      saveState(this.state);
    }
  }

  addStudySeconds(seconds: number): void {
    if (seconds <= 0) return;
    this.touch();
    this.state.secondsStudiedToday += seconds;
    saveState(this.state);
    this.emit();
  }

  setDailyGoal(minutes: number): void {
    this.touch();
    this.state.dailyGoalMinutes = clampGoal(minutes);
    this.state.showMorningPrompt = false;
    saveState(this.state);
    this.emit();
  }

  dismissMorningPrompt(): void {
    this.touch();
    if (!this.state.showMorningPrompt) return;
    this.state.showMorningPrompt = false;
    saveState(this.state);
    this.emit();
  }
}

export const DailyGoalStore = new DailyGoalStoreImpl();
