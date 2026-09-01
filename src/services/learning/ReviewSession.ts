/**
 * Snapshot da sessão de revisão — mesma fila para UI e Gemini Live.
 */
import type { ReviewQueueItem, ReviewType } from '@/services/learning/ReviewEngine';

export const REVIEW_SESSION_STORAGE_KEY = 'dt_review_session';
export const MAX_REVIEW_ITEM_ATTEMPTS = 2;

export type ReviewItemResult = {
  phraseId: string;
  german?: string;
  result: 'SUCCESS' | 'PARTIAL' | 'FAILED' | 'DEFERRED';
  reviewType: ReviewType;
};

export type ReviewSessionSnapshot = {
  id: string;
  items: ReviewQueueItem[];
  currentIndex: number;
  total: number;
  results: ReviewItemResult[];
  /** Tentativas no item atual (1-based após incremento) */
  itemAttempts: number;
  startedAt: string;
  completed: boolean;
};

export function createReviewSessionSnapshot(items: ReviewQueueItem[]): ReviewSessionSnapshot {
  return {
    id: `review-${Date.now()}`,
    items: items.map((i) => ({ ...i })),
    currentIndex: 0,
    total: items.length,
    results: [],
    itemAttempts: 0,
    startedAt: new Date().toISOString(),
    completed: false,
  };
}

export function persistReviewSession(snapshot: ReviewSessionSnapshot): void {
  if (typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.setItem(REVIEW_SESSION_STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    /* quota */
  }
}

export function readReviewSessionSnapshot(): ReviewSessionSnapshot | null {
  if (typeof sessionStorage === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(REVIEW_SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ReviewSessionSnapshot>;
    if (!parsed.id || !Array.isArray(parsed.items)) return null;
    return {
      id: parsed.id,
      items: parsed.items as ReviewQueueItem[],
      currentIndex: typeof parsed.currentIndex === 'number' ? parsed.currentIndex : 0,
      total: typeof parsed.total === 'number' ? parsed.total : parsed.items.length,
      results: Array.isArray(parsed.results) ? parsed.results as ReviewItemResult[] : [],
      itemAttempts: typeof parsed.itemAttempts === 'number' ? parsed.itemAttempts : 0,
      startedAt: typeof parsed.startedAt === 'string' ? parsed.startedAt : new Date().toISOString(),
      completed: !!parsed.completed,
    };
  } catch {
    return null;
  }
}

export function clearReviewSessionSnapshot(): void {
  if (typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.removeItem(REVIEW_SESSION_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/** Grava snapshot e retorna — UI e sessão usam o mesmo objeto. */
export function startReviewSession(items: ReviewQueueItem[]): ReviewSessionSnapshot {
  const snapshot = createReviewSessionSnapshot(items);
  persistReviewSession(snapshot);
  return snapshot;
}

export function getCurrentReviewQueueItem(snapshot: ReviewSessionSnapshot): ReviewQueueItem | null {
  if (snapshot.completed) return null;
  return snapshot.items[snapshot.currentIndex] ?? null;
}

export function reviewSessionProgress(snapshot: ReviewSessionSnapshot | null): {
  current: number;
  total: number;
  completed: number;
  mastered: number;
  needsLater: number;
} | null {
  if (!snapshot || snapshot.total === 0) return null;
  const mastered = snapshot.results.filter((r) => r.result === 'SUCCESS').length;
  const needsLater = snapshot.results.filter((r) => r.result === 'FAILED' || r.result === 'DEFERRED').length;
  const completed = snapshot.results.length;
  return {
    current: Math.min(snapshot.currentIndex + 1, snapshot.total),
    total: snapshot.total,
    completed,
    mastered,
    needsLater,
  };
}

export function summarizeReviewSession(snapshot: ReviewSessionSnapshot): {
  total: number;
  reviewed: number;
  mastered: number;
  withHelp: number;
  needsLater: number;
} {
  const reviewed = snapshot.results.length;
  const mastered = snapshot.results.filter((r) => r.result === 'SUCCESS').length;
  const withHelp = snapshot.results.filter((r) => r.result === 'PARTIAL').length;
  const needsLater = snapshot.results.filter((r) => r.result === 'FAILED' || r.result === 'DEFERRED').length;
  return {
    total: snapshot.total,
    reviewed,
    mastered,
    withHelp,
    needsLater,
  };
}
