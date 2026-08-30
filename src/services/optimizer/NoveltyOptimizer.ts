import type { LearningState } from '@/services/learning/LearningStateEngine';

export interface NoveltyDecision {
  rate: number;
  maxNewPerSession: number;
  reason: string;
}

export function optimizeNovelty(state: LearningState, recentRetention: number, day: number): NoveltyDecision {
  if (state === 'FRUSTRATED' || state === 'OVERLOADED' || recentRetention < 0.4) {
    return { rate: 0.05, maxNewPerSession: 1, reason: 'sobrecarga — mínima novidade' };
  }
  if (state === 'AUTOMATIC' || state === 'MASTERING' || recentRetention > 0.85) {
    const max = day < 7 ? 3 : 4;
    return { rate: 0.22, maxNewPerSession: max, reason: 'alto rendimento — mais novidade' };
  }
  if (state === 'BORED') {
    return { rate: 0.2, maxNewPerSession: 3, reason: 'tédio — variar contexto' };
  }
  if (state === 'COMFORTABLE') {
    return { rate: 0.15, maxNewPerSession: 2, reason: 'confortável — novidade moderada' };
  }
  return { rate: 0.1, maxNewPerSession: 2, reason: 'aprendendo — novidade controlada' };
}
