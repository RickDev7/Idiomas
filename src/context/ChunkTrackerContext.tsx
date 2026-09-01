import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  ChunkTrackerStore,
  DAILY_CHUNKS_STORAGE_KEY,
  buildChunkDisplaySlots,
  getActiveChunkDisplay,
  getDisplayVariations,
  type ChunkDisplaySlot,
  type ChunkVariationEntry,
  type DailyChunkState,
} from '@/services/learning/ChunkTrackerStore';

export type ChunkTrackerView = {
  state: DailyChunkState;
  activeChunk: { baseId: string; german: string; portuguese: string };
  variations: ChunkVariationEntry[];
  displaySlots: ChunkDisplaySlot[];
  hasPracticedToday: boolean;
  recordCorrect: (input: { phraseId: string; nextPhraseId?: string | null }) => void;
  recordAdvanceVariation: (input: { phraseId: string; baseId: string }) => void;
  resetToday: () => void;
};

const ChunkTrackerContext = createContext<ChunkTrackerView | null>(null);

export function ChunkTrackerProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DailyChunkState>(() => ChunkTrackerStore.getState());

  useEffect(() => {
    setState(ChunkTrackerStore.getState());
    return ChunkTrackerStore.subscribe(setState);
  }, []);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === DAILY_CHUNKS_STORAGE_KEY) {
        setState(ChunkTrackerStore.getState());
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const variations = useMemo(() => getDisplayVariations(state, 3), [state]);

  const value = useMemo<ChunkTrackerView>(
    () => ({
      state,
      activeChunk: getActiveChunkDisplay(state),
      variations,
      displaySlots: buildChunkDisplaySlots(variations),
      hasPracticedToday: state.variations.length > 0,
      recordCorrect: (input) => ChunkTrackerStore.recordCorrect(input),
      recordAdvanceVariation: (input) => ChunkTrackerStore.recordAdvanceVariation(input),
      resetToday: () => ChunkTrackerStore.resetToday(),
    }),
    [state, variations],
  );

  return <ChunkTrackerContext.Provider value={value}>{children}</ChunkTrackerContext.Provider>;
}

export function useChunkTracker(): ChunkTrackerView {
  const ctx = useContext(ChunkTrackerContext);
  if (!ctx) {
    throw new Error('useChunkTracker deve ser usado dentro de ChunkTrackerProvider');
  }
  return ctx;
}

/** @deprecated Use useChunkTracker */
export const useChunkProgress = useChunkTracker;

/** @deprecated Use ChunkTrackerProvider */
export const ChunkProgressProvider = ChunkTrackerProvider;

/** @deprecated Use ChunkTrackerView */
export type ChunkProgressView = ChunkTrackerView;
