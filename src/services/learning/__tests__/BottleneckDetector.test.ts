import { detectBottleneck, detectBottlenecks, immersionAdjustment } from '@/services/learning/BottleneckDetector';
import type { UserLearningProfile } from '@/services/learning/ConfidenceService';
import { assert } from './assert';

function fakeProfile(over: Partial<UserLearningProfile>): UserLearningProfile {
  return {
    userLevel: 'little',
    communicationScore: 50,
    listeningScore: 0,
    speakingScore: 0,
    retentionScore: 0,
    pronunciationScore: 0,
    responseSpeedScore: 0,
    immersionLevel: 60,
    dailyGoal: 20,
    currentStreak: 0,
    totalStudyTime: 0,
    knownWords: [],
    knownPhrases: [],
    weakPhrases: [],
    strongPhrases: [],
    recurringMistakes: [],
    recentTopics: [],
    recentSituations: [],
    lastSession: null,
    learningVelocity: 0,
    phrases: {},
    bottleneck: null,
    ...over,
  };
}

export function testBottleneckDetector() {
  const b = detectBottleneck(fakeProfile({ listeningScore: 82, speakingScore: 38, retentionScore: 75, pronunciationScore: 75, responseSpeedScore: 75 }));
  assert(b !== null, 'detecta gargalo');
  assert(b!.type === 'speaking', 'gargalo é speaking quando listening alto');
  assert((b!.confidence ?? 0) > 0.4, 'confidence no gargalo');

  const report = detectBottlenecks(fakeProfile({
    listeningScore: 35,
    speakingScore: 80,
    retentionScore: 70,
    pronunciationScore: 70,
    responseSpeedScore: 70,
  }));
  assert(report.primary?.type === 'listening', 'primary listening quando speaking alto');

  const none = detectBottleneck(fakeProfile({ listeningScore: 80, speakingScore: 75, retentionScore: 80, pronunciationScore: 80, responseSpeedScore: 80, knownPhrases: ['a'], weakPhrases: [] }));
  assert(none === null, 'sem gargalo quando tudo alto');

  const adj1 = immersionAdjustment(fakeProfile({ immersionLevel: 70 }), 0.3);
  assert(adj1 < 70, 'reduz imersão quando erro alto');

  const adj2 = immersionAdjustment(fakeProfile({ immersionLevel: 70 }), 0.9);
  assert(adj2 > 70, 'aumenta imersão quando acerto alto');
}
