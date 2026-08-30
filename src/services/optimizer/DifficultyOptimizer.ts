import type { LearningState } from '@/services/learning/LearningStateEngine';

export interface DifficultyParams {
  phraseLength: number;
  speed: 'slow' | 'normal' | 'natural';
  supportLevel: 0 | 1 | 2 | 3;
  complexity: number;
  contextVariation: number;
}

export function optimizeDifficulty(state: LearningState, currentLevel: 'zero' | 'little' | 'basic', recentCorrectRate: number): DifficultyParams {
  let phraseLength = currentLevel === 'zero' ? 3 : currentLevel === 'little' ? 5 : 7;
  let speed: DifficultyParams['speed'] = 'normal';
  let supportLevel: DifficultyParams['supportLevel'] = 2;
  let complexity = 0.4;
  let contextVariation = 0.3;

  if (state === 'FRUSTRATED' || state === 'OVERLOADED' || recentCorrectRate < 0.4) {
    phraseLength = Math.max(2, phraseLength - 2);
    speed = 'slow';
    supportLevel = 3;
    complexity = 0.2;
    contextVariation = 0.1;
  } else if (state === 'AUTOMATIC' || state === 'MASTERING') {
    phraseLength += 2;
    speed = 'natural';
    supportLevel = 0;
    complexity = 0.7;
    contextVariation = 0.7;
  } else if (state === 'BORED') {
    speed = 'natural';
    supportLevel = 0;
    contextVariation = 0.8;
    complexity = 0.6;
  } else if (state === 'COMFORTABLE') {
    supportLevel = 1;
    complexity = 0.5;
    contextVariation = 0.5;
  }

  return { phraseLength, speed, supportLevel, complexity, contextVariation };
}
