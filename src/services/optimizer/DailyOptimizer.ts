import type { UserProfile } from '@/types';
import type { UserLearningProfile } from '@/services/learning/ConfidenceService';
import type { Bottleneck } from '@/services/learning/BottleneckDetector';
import type { LearningState } from '@/services/learning/LearningStateEngine';
import { planSession, type PlannedActivity } from '@/services/learning/NextBestActivityEngine';
import { optimizeNovelty } from '@/services/optimizer/NoveltyOptimizer';
import { optimizeDifficulty } from '@/services/optimizer/DifficultyOptimizer';
import { optimalChallenge } from '@/services/optimizer/OptimalChallengeEngine';
import type { CourseRecovery } from '@/services/course/types';
import { applyRecoveryToActivities } from '@/services/course/CoursePlateauEngine';

export interface DailyPlan {
  activities: PlannedActivity[];
  novelty: ReturnType<typeof optimizeNovelty>;
  difficulty: ReturnType<typeof optimizeDifficulty>;
  challenge: ReturnType<typeof optimalChallenge>;
  focusArea: string;
}

export function optimizeDay(
  profile: UserProfile,
  learning: UserLearningProfile,
  bottleneck: Bottleneck | null,
  state: LearningState,
  recentCorrectRate: number,
  recentRetention: number,
  allPhrases: { id: string; category: string }[],
  recovery?: CourseRecovery | null,
): DailyPlan {
  let activities = planSession(profile, learning, allPhrases as never, bottleneck);
  const novelty = optimizeNovelty(state, recentRetention, profile.currentDay);
  const difficulty = optimizeDifficulty(state, profile.level, recentCorrectRate);
  const challenge = optimalChallenge(state, recentCorrectRate);

  if (novelty.maxNewPerSession < 2) {
    const newContent = activities.find((a) => a.kind === 'newContent');
    if (newContent) newContent.phraseIds = newContent.phraseIds.slice(0, novelty.maxNewPerSession);
  }

  if (recovery) {
    activities = applyRecoveryToActivities(activities, recovery, profile.dailyMinutes);
  }

  const focusArea = recovery?.strategy ?? bottleneck?.type ?? (state === 'BORED' ? 'transferência' : 'conversação');

  return { activities, novelty, difficulty, challenge, focusArea };
}
