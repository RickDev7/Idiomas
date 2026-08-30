import { planSession, nextBestActivity } from '@/services/learning/NextBestActivityEngine';
import type { UserProfile } from '@/types';
import type { UserLearningProfile } from '@/services/learning/ConfidenceService';
import type { Bottleneck } from '@/services/learning/BottleneckDetector';
import { assert } from './assert';

function fakeUser(over: Partial<UserProfile>): UserProfile {
  return {
    id: 'u',
    name: 'Test',
    level: 'little',
    dailyMinutes: 20,
    goal: 'daily',
    profession: '',
    frequentSituations: [],
    interests: [],
    onboardingComplete: true,
    firstLessonComplete: true,
    currentDay: 1,
    streak: 1,
    lastStudyDate: null,
    immersionPhase: 1,
    turboMode: false,
    speechSpeed: 'normal',
    germanPercentage: 60,
    createdAt: new Date().toISOString(),
    ...over,
  };
}

function fakeLearning(over: Partial<UserLearningProfile>): UserLearningProfile {
  return {
    userLevel: 'little',
    communicationScore: 0,
    listeningScore: 50,
    speakingScore: 50,
    retentionScore: 50,
    pronunciationScore: 50,
    responseSpeedScore: 50,
    immersionLevel: 60,
    dailyGoal: 20,
    currentStreak: 1,
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

export function testNextBestActivityEngine() {
  const phrases = [
    { id: 'p1', german: 'Ich arbeite heute.', portuguese: 'Trabalho hoje.', category: 'work', mastery: 'recognize' as const, reviewStage: 'learning' as const, nextReview: null, timesReviewed: 0, timesCorrect: 0, timesIncorrect: 0, isAutomatic: false, contexts: [] },
    { id: 'p2', german: 'Mir geht es gut.', portuguese: 'Estou bem.', category: 'greetings', mastery: 'recognize' as const, reviewStage: 'learning' as const, nextReview: null, timesReviewed: 0, timesCorrect: 0, timesIncorrect: 0, isAutomatic: false, contexts: [] },
  ];

  const learning = fakeLearning({
    phrases: {
      p1: {
        phraseId: 'p1', state: 'repeated', confidence: 30, recognition: 40, listening: 30, speaking: 20, production: 20, speed: 10, contextTransfer: 0,
        timesSeen: 3, timesProduced: 0, timesCorrect: 0, lastSeen: new Date().toISOString(), lastProduced: null, avgResponseMs: 0, needsHelp: true,
      },
    },
  });

  const bottleneck: Bottleneck = { type: 'speaking', description: '', recommendation: 'Mais fala', score: 40, confidence: 0.8, reason: 'test' };
  const activities = planSession(fakeUser({}), learning, phrases as never, bottleneck);
  assert(activities.length > 0, 'planeia atividades');
  assert(activities.some((a) => a.kind === 'warmup'), 'inclui aquecimento com frases fracas');
  assert(activities.some((a) => a.kind === 'speaking'), 'inclui fala quando gargalo é speaking');

  const next = nextBestActivity(activities, new Set(['warmup', 'review']));
  assert(next !== null, 'encontra próxima atividade não feita');
  assert(next!.kind !== 'warmup' && next!.kind !== 'review', 'pula atividades já feitas');
}
