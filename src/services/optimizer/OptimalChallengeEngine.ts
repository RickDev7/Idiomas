import type { LearningState } from '@/services/learning/LearningStateEngine';

export interface ChallengeTarget {
  targetSuccessRate: number;
  description: string;
}

export function optimalChallenge(state: LearningState, recentCorrectRate: number): ChallengeTarget {
  if (state === 'FRUSTRATED' || state === 'OVERLOADED') {
    return { targetSuccessRate: 0.85, description: 'Voltar para a zona de sucesso.' };
  }
  if (recentCorrectRate > 0.9 && (state === 'AUTOMATIC' || state === 'MASTERING' || state === 'BORED')) {
    return { targetSuccessRate: 0.7, description: 'Aumentar para "consigo, mas preciso pensar".' };
  }
  if (recentCorrectRate < 0.5) {
    return { targetSuccessRate: 0.8, description: 'Reduzir até acertar ~80%.' };
  }
  return { targetSuccessRate: 0.75, description: 'Manter zona ótima de desafio.' };
}
