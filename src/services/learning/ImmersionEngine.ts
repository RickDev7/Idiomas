import type { UserLearningProfile } from '@/services/learning/ConfidenceService';
import type { LearningState } from '@/services/learning/LearningStateEngine';

export interface ImmersionDecision {
  germanPercentage: number;
  showTranslation: boolean;
  showHints: boolean;
  reason: string;
}

export function decideImmersion(
  profile: UserLearningProfile,
  state: LearningState,
  recentCorrectRate: number,
): ImmersionDecision {
  let german = profile.immersionLevel;
  let showTranslation = false;
  let showHints = true;
  let reason = '';

  if (state === 'FRUSTRATED' || state === 'OVERLOADED' || recentCorrectRate < 0.4) {
    german = Math.max(40, german - 20);
    showTranslation = true;
    showHints = true;
    reason = 'Reduzindo alemão para apoiar você.';
  } else if (state === 'AUTOMATIC' || state === 'MASTERING') {
    german = Math.min(100, german + 15);
    showTranslation = false;
    showHints = false;
    reason = 'Aumentando imersão.';
  } else if (state === 'BORED') {
    german = Math.min(95, german + 10);
    showTranslation = false;
    showHints = false;
    reason = 'Variando contexto para manter o desafio.';
  } else if (state === 'COMFORTABLE') {
    german = Math.min(90, german + 5);
    showTranslation = false;
    showHints = true;
    reason = 'Reduzindo suporte gradualmente.';
  } else {
    showTranslation = profile.userLevel === 'zero';
    showHints = true;
    reason = 'Mantendo equilíbrio.';
  }

  return { germanPercentage: german, showTranslation, showHints, reason };
}
