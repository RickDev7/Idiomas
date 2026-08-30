import { memoryStrength } from '@/services/learning/MemoryStrengthEngine';
import type { PhraseConfidence } from '@/services/learning/ConfidenceService';
import {
  buildReviewQueueItem,
  selectReviewType,
  type ReviewType,
} from '@/services/learning/ReviewEngine';

export interface ReviewDecision {
  phraseId: string;
  dueNow: boolean;
  urgency: number;
  reason: string;
  reviewType?: ReviewType;
}

export function reviewDecision(conf: PhraseConfidence, now = new Date()): ReviewDecision {
  const m = memoryStrength(conf);
  const queueItem = buildReviewQueueItem(conf, null, now);
  const dueBySchedule = new Date(m.nextReviewAt).getTime() <= now.getTime();
  const dueNow = Boolean(queueItem) || dueBySchedule;
  const urgency = Math.max(
    0,
    Math.min(
      100,
      queueItem?.priority ??
        50 +
          Math.max(0, now.getTime() - new Date(m.nextReviewAt).getTime()) / 86_400_000 * 10 +
          (100 - m.strength) * 0.3,
    ),
  );
  let reason = queueItem?.reason ?? 'no prazo';
  if (!queueItem) {
    const overdueMs = now.getTime() - new Date(m.nextReviewAt).getTime();
    if (overdueMs > 3 * 86_400_000) reason = 'atrasado';
    else if (overdueMs > 0) reason = 'vencendo';
    else if (m.strength < 40) reason = 'frágil';
  }
  return {
    phraseId: conf.phraseId,
    dueNow,
    urgency,
    reason,
    reviewType: queueItem?.reviewType ?? selectReviewType(conf, m),
  };
}

export function optimizeInterval(stability: number, lastRetention: number): number {
  const base = Math.max(1, stability / 10);
  const factor = lastRetention > 0.85 ? 1.4 : lastRetention > 0.6 ? 1.0 : 0.6;
  return Math.max(1, Math.round(base * factor));
}
