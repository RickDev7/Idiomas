import { EventStore, type LearningEvent } from '@/services/learning/EventStore';

export type LearningState =
  | 'FRUSTRATED'
  | 'OVERLOADED'
  | 'LEARNING'
  | 'COMFORTABLE'
  | 'MASTERING'
  | 'AUTOMATIC'
  | 'BORED';

export interface LearningStateSnapshot {
  state: LearningState;
  errorRate: number;
  avgResponseMs: number;
  helpRate: number;
  repeatRate: number;
  recentCorrect: number;
  recentTotal: number;
}

export function inferLearningState(events: LearningEvent[]): LearningStateSnapshot {
  const recent = events.slice(-20);
  const total = recent.length;
  if (total === 0) {
    return { state: 'LEARNING', errorRate: 0, avgResponseMs: 0, helpRate: 0, repeatRate: 0, recentCorrect: 0, recentTotal: 0 };
  }

  const failures = recent.filter((e) => e.type === 'PHRASE_FAILED' || e.type === 'LISTENING_FAILURE' || e.type === 'RAPID_RESPONSE_FAILURE').length;
  const successes = recent.filter((e) => e.type === 'PHRASE_PRODUCED' || e.type === 'PHRASE_RECALLED' || e.type === 'LISTENING_SUCCESS' || e.type === 'RAPID_RESPONSE_SUCCESS').length;
  const helps = recent.filter((e) => e.type === 'HELP_REQUESTED' || e.type === 'TRANSLATION_REQUESTED' || e.type === 'REPEAT_REQUESTED').length;
  const repeats = recent.filter((e) => e.type === 'REPEAT_REQUESTED').length;
  const withTime = recent.filter((e) => typeof e.responseTimeMs === 'number');
  const avgResponseMs = withTime.length ? Math.round(withTime.reduce((s, e) => s + (e.responseTimeMs ?? 0), 0) / withTime.length) : 0;

  const errorRate = failures / total;
  const helpRate = helps / total;
  const repeatRate = repeats / total;
  const recentCorrect = successes;
  const correctRate = successes / Math.max(1, successes + failures);

  let state: LearningState;
  if (errorRate >= 0.6 || helpRate >= 0.5) state = 'FRUSTRATED';
  else if (errorRate >= 0.4 || helpRate >= 0.35) state = 'OVERLOADED';
  else if (correctRate >= 0.95 && avgResponseMs > 4000 && helpRate < 0.05) state = 'BORED';
  else if (correctRate >= 0.95 && avgResponseMs > 0 && avgResponseMs < 2500 && helpRate < 0.1) state = 'AUTOMATIC';
  else if (correctRate >= 0.9 && helpRate < 0.15) state = 'MASTERING';
  else if (correctRate >= 0.75 && helpRate < 0.25) state = 'COMFORTABLE';
  else state = 'LEARNING';

  return { state, errorRate, avgResponseMs, helpRate, repeatRate, recentCorrect, recentTotal: total };
}

export async function currentState(): Promise<LearningStateSnapshot> {
  const events = await EventStore.load();
  return inferLearningState(events);
}
