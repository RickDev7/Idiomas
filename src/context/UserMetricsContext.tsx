import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
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
};

const UserMetricsContext = createContext<UserMetricsContextValue | null>(null);

export function UserMetricsProvider({ children }: { children: ReactNode }) {
  const { profile } = useProfile();
  const [state, setState] = useState<UserMetricsState>(() => UserMetricsStore.getState());

  useEffect(() => UserMetricsStore.subscribe(setState), []);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === USER_METRICS_STORAGE_KEY) {
        setState(UserMetricsStore.getState());
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

  const view = useMemo(() => computeMetricsView(state), [state]);

  const value = useMemo<UserMetricsContextValue>(
    () => ({
      ...view,
      state,
      refreshFromLearning,
    }),
    [view, state, refreshFromLearning],
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
