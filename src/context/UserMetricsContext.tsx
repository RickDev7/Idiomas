import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { DailyGoalStore, DAILY_GOAL_STORAGE_KEY } from '@/services/learning/DailyGoalStore';
import {
  UserMetricsStore,
  USER_METRICS_STORAGE_KEY,
  computeMetricsView,
  type UserMetricsView,
  type UserMetricsState,
} from '@/services/learning/UserMetricsStore';
import { MemoryService } from '@/services/learning/MemoryService';
import { useProfile } from '@/hooks/useProfile';

type UserMetricsContextValue = UserMetricsView & {
  state: UserMetricsState;
  refreshFromLearning: () => Promise<void>;
  setDailyGoal: (minutes: number) => void;
  dismissMorningPrompt: () => void;
};

const UserMetricsContext = createContext<UserMetricsContextValue | null>(null);

export function UserMetricsProvider({ children }: { children: ReactNode }) {
  const { profile } = useProfile();
  const [state, setState] = useState<UserMetricsState>(() => UserMetricsStore.getState());
  const [dailyTick, setDailyTick] = useState(0);

  useEffect(() => UserMetricsStore.subscribe(setState), []);
  useEffect(() => DailyGoalStore.subscribe(() => setDailyTick((n) => n + 1)), []);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === USER_METRICS_STORAGE_KEY || e.key === DAILY_GOAL_STORAGE_KEY) {
        setState(UserMetricsStore.getState());
        setDailyTick((n) => n + 1);
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const refreshFromLearning = useCallback(async () => {
    if (!profile) return;
    try {
      const learning = await MemoryService.loadProfile(profile);
      UserMetricsStore.syncFromLearning(learning);
    } catch {
      /* ignore */
    }
  }, [profile]);

  useEffect(() => {
    void refreshFromLearning();
  }, [refreshFromLearning]);

  useEffect(() => {
    const onFocus = () => { void refreshFromLearning(); };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [refreshFromLearning]);

  const setDailyGoal = useCallback((minutes: number) => {
    UserMetricsStore.setDailyGoal(minutes);
  }, []);

  const dismissMorningPrompt = useCallback(() => {
    UserMetricsStore.dismissMorningPrompt();
  }, []);

  const view = useMemo(() => computeMetricsView(state), [state, dailyTick]);

  const value = useMemo<UserMetricsContextValue>(
    () => ({
      ...view,
      state,
      refreshFromLearning,
      setDailyGoal,
      dismissMorningPrompt,
    }),
    [view, state, refreshFromLearning, setDailyGoal, dismissMorningPrompt],
  );

  return <UserMetricsContext.Provider value={value}>{children}</UserMetricsContext.Provider>;
}

export function useUserMetrics(): UserMetricsContextValue {
  const ctx = useContext(UserMetricsContext);
  if (!ctx) {
    throw new Error('useUserMetrics deve ser usado dentro de UserMetricsProvider');
  }
  return ctx;
}
