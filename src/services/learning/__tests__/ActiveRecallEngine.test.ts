import { buildActiveRecall, pickActiveRecallTarget } from '@/services/learning/ActiveRecallEngine';
import type { Phrase } from '@/types';
import type { UserLearningProfile, PhraseConfidence } from '@/services/learning/ConfidenceService';
import { assert } from './assert';

function fakeProfile(over: Partial<UserLearningProfile>): UserLearningProfile {
  return {
    userLevel: 'little', communicationScore: 0, listeningScore: 0, speakingScore: 0, retentionScore: 0,
    pronunciationScore: 0, responseSpeedScore: 0, immersionLevel: 60, dailyGoal: 20, currentStreak: 1,
    totalStudyTime: 0, knownWords: [], knownPhrases: [], weakPhrases: [], strongPhrases: [],
    recurringMistakes: [], recentTopics: [], recentSituations: [], lastSession: null,
    learningVelocity: 0, phrases: {}, bottleneck: null, ...over,
  };
}

export function testActiveRecallEngine() {
  const phrase: Phrase = {
    id: 'p1', german: 'Ich arbeite heute.', portuguese: 'Eu trabalho hoje.', category: 'work',
    mastery: 'recognize', reviewStage: 'learning', nextReview: null, timesReviewed: 0,
    timesCorrect: 0, timesIncorrect: 0, isAutomatic: false, contexts: [],
  };

  const conf: PhraseConfidence = {
    phraseId: 'p1', state: 'answeredAlone', confidence: 80, recognition: 80, listening: 80,
    speaking: 80, production: 80, speed: 70, contextTransfer: 40, timesSeen: 5, timesProduced: 3,
    timesCorrect: 3, lastSeen: new Date().toISOString(), lastProduced: new Date().toISOString(),
    avgResponseMs: 3000, needsHelp: false,
  };
  const easy = buildActiveRecall(phrase, conf);
  assert(easy.difficulty === 'easy', 'frase dominada -> easy');

  const hard = buildActiveRecall(phrase, undefined);
  assert(hard.difficulty === 'hard', 'frase nova -> hard');

  const learning = fakeProfile({
    phrases: {
      p1: { ...conf, state: 'repeated', confidence: 35 },
    },
  });
  const target = pickActiveRecallTarget(learning, [phrase]);
  assert(target !== null, 'encontra alvo de active recall');
  assert(target!.id === 'p1', 'alvo é a frase em estágio intermediário');
}
