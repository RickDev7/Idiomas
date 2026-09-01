/* ReviewRepository — única fonte de due reviews para Home + ReviewPage.
   Não duplica o ReviewEngine: só expõe a mesma fila. */
import {
  getReviewQueue,
  type ReviewQueueItem,
} from '@/services/learning/ReviewEngine';
import {
  startReviewSession,
  type ReviewSessionSnapshot,
} from '@/services/learning/ReviewSession';

const DEFAULT_LIMIT = 12;

export async function getDueReviews(limit = DEFAULT_LIMIT): Promise<ReviewQueueItem[]> {
  return getReviewQueue(limit);
}

export async function getDueReviewCount(limit = DEFAULT_LIMIT): Promise<number> {
  const q = await getReviewQueue(limit);
  return q.length;
}

/** UI e sessão usam o mesmo snapshot da fila. */
export function beginReviewSessionFromQueue(items: ReviewQueueItem[]): ReviewSessionSnapshot {
  return startReviewSession(items);
}

export type { ReviewQueueItem, ReviewSessionSnapshot };
