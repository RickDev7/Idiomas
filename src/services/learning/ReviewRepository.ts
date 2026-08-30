/* ReviewRepository — única fonte de due reviews para Home + ReviewPage.
   Não duplica o ReviewEngine: só expõe a mesma fila. */
import {
  getReviewQueue,
  type ReviewQueueItem,
} from '@/services/learning/ReviewEngine';

const DEFAULT_LIMIT = 12;

export async function getDueReviews(limit = DEFAULT_LIMIT): Promise<ReviewQueueItem[]> {
  return getReviewQueue(limit);
}

export async function getDueReviewCount(limit = DEFAULT_LIMIT): Promise<number> {
  const q = await getReviewQueue(limit);
  return q.length;
}

export type { ReviewQueueItem };
