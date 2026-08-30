import type { LearningState } from '@/services/learning/LearningStateEngine';
import { optimizeNovelty } from '@/services/optimizer/NoveltyOptimizer';
import { optimizeDifficulty } from '@/services/optimizer/DifficultyOptimizer';
import { optimalChallenge } from '@/services/optimizer/OptimalChallengeEngine';
import { LearningExperimentEngine, type Experiment } from '@/services/optimizer/LearningExperimentEngine';
import type { ContentType, LearningMethod } from '@/services/optimizer/PreferenceModel';

export interface MetaDecision {
  method: LearningMethod;
  contentType: ContentType;
  novelty: ReturnType<typeof optimizeNovelty>;
  difficulty: ReturnType<typeof optimizeDifficulty>;
  challenge: ReturnType<typeof optimalChallenge>;
  experiment: Experiment | null;
}

export class MetaTeacherEngine {
  static async decide(
    state: LearningState,
    level: 'zero' | 'little' | 'basic',
    recentCorrectRate: number,
    recentRetention: number,
    day: number,
    contentType: ContentType,
    phraseIds: string[],
  ): Promise<MetaDecision> {
    const method = await LearningExperimentEngine.pickMethod(contentType, day);
    const novelty = optimizeNovelty(state, recentRetention, day);
    const difficulty = optimizeDifficulty(state, level, recentCorrectRate);
    const challenge = optimalChallenge(state, recentCorrectRate);
    let experiment: Experiment | null = null;
    try {
      experiment = await LearningExperimentEngine.startExperiment(method, contentType, phraseIds);
    } catch {
      experiment = null;
    }
    return { method, contentType, novelty, difficulty, challenge, experiment };
  }
}
