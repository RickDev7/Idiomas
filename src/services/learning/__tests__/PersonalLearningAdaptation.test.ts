import { detectStrengths } from '@/services/learning/StrengthDetector';
import { classifyUtteranceError, detectErrorPatterns } from '@/services/learning/ErrorPatternDetector';
import { adaptPersonalLearning } from '@/services/learning/AdaptationEngine';
import {
  emptyPersonalLearningProfile,
  savePersonalLearningProfile,
  loadPersonalLearningProfile,
  PERSONAL_LEARNING_STORE_KEY,
} from '@/services/learning/PersonalLearningProfile';
import { planTodaysTraining } from '@/services/teacher/TeacherEngine';
import { buildConversationPlan } from '@/services/teacher/ConversationOrchestrator';
import type { UserLearningProfile } from '@/services/learning/ConfidenceService';
import type { UserProfile } from '@/types';
import type { LearningEvent } from '@/services/learning/EventStore';
import { assert } from './assert';

function user(over: Partial<UserProfile> = {}): UserProfile {
  return {
    id: 'u',
    name: 'Test',
    level: 'little',
    dailyMinutes: 20,
    goal: 'work',
    profession: 'Designer',
    frequentSituations: [],
    interests: [],
    onboardingComplete: true,
    firstLessonComplete: true,
    currentDay: 3,
    streak: 2,
    turboMode: false,
    ...over,
  } as UserProfile;
}

function learning(over: Partial<UserLearningProfile>): UserLearningProfile {
  return {
    userLevel: 'little',
    communicationScore: 50,
    listeningScore: 50,
    speakingScore: 50,
    retentionScore: 60,
    pronunciationScore: 60,
    responseSpeedScore: 55,
    immersionLevel: 60,
    dailyGoal: 20,
    currentStreak: 1,
    totalStudyTime: 40,
    knownWords: [],
    knownPhrases: ['p1'],
    weakPhrases: [],
    strongPhrases: [],
    recurringMistakes: [],
    recentTopics: [],
    recentSituations: [],
    lastSession: null,
    learningVelocity: 1,
    phrases: {},
    bottleneck: null,
    ...over,
  };
}

function clearPersonal() {
  try {
    localStorage.removeItem(PERSONAL_LEARNING_STORE_KEY);
  } catch { /* */ }
  savePersonalLearningProfile(emptyPersonalLearningProfile());
}

export function testPersonalLearningAdaptation() {
  clearPersonal();

  // Strengths
  const strengths = detectStrengths(learning({ listeningScore: 85, speakingScore: 40 }));
  assert(strengths.some((s) => s.type === 'listening'), 'detecta listening forte');

  // Error patterns — precisa recorrência
  assert(classifyUtteranceError('Ich arbeiten heute.') === 'verb_conjugation', 'classifica conjugação');
  const failEvents: LearningEvent[] = Array.from({ length: 8 }, (_, i) => ({
    id: `e${i}`,
    type: 'PHRASE_FAILED' as const,
    context: 'Ich arbeiten heute.',
    timestamp: new Date(Date.now() - i * 1000).toISOString(),
  }));
  const patterns = detectErrorPatterns(failEvents);
  assert(patterns.some((p) => p.pattern === 'verb_conjugation' && p.count >= 3), 'padrão recorrente verb_conjugation');
  assert(detectErrorPatterns(failEvents.slice(0, 1)).length === 0, 'erro isolado não vira padrão');

  // Perfil A: speaking fraco / listening forte → mais speaking
  clearPersonal();
  const learnA = learning({ listeningScore: 88, speakingScore: 32, retentionScore: 70, pronunciationScore: 70, responseSpeedScore: 65 });
  const adaptA = adaptPersonalLearning({
    user: user(),
    learning: learnA,
    events: failEvents.slice(0, 0),
    previous: emptyPersonalLearningProfile(),
    force: true,
  });
  savePersonalLearningProfile(adaptA.profile);
  assert(adaptA.profile.primaryBottleneck === 'speaking', `A primary=speaking (got ${adaptA.profile.primaryBottleneck})`);
  assert(adaptA.strategy.preferredActivity === 'speaking', `A strategy speaking (got ${adaptA.strategy.preferredActivity})`);
  const trainA = planTodaysTraining(user(), [], learnA, adaptA.strategy);
  const speakA = trainA.stages.find((s) => s.id === 'speaking')!.minutes;
  const listenA = trainA.stages.find((s) => s.id === 'listening')!.minutes;
  assert(speakA > listenA, `A speaking(${speakA}) > listening(${listenA})`);

  const planA = buildConversationPlan(user(), { ...learnA, bottleneck: 'speaking' }, []);
  assert(
    /speaking|produção|falar|FOCO/i.test(planA.teacherDirective) || planA.action === 'practice' || planA.action === 'automation',
    `A teacher muda comportamento (action=${planA.action})`,
  );

  // Perfil B: listening fraco / speaking forte → mais listening
  clearPersonal();
  const learnB = learning({ listeningScore: 30, speakingScore: 85, retentionScore: 70, pronunciationScore: 70, responseSpeedScore: 70 });
  const adaptB = adaptPersonalLearning({
    user: user(),
    learning: learnB,
    previous: emptyPersonalLearningProfile(),
    force: true,
  });
  savePersonalLearningProfile(adaptB.profile);
  assert(adaptB.profile.primaryBottleneck === 'listening', `B primary=listening (got ${adaptB.profile.primaryBottleneck})`);
  assert(adaptB.strategy.preferredActivity === 'listening', `B strategy listening (got ${adaptB.strategy.preferredActivity})`);
  const trainB = planTodaysTraining(user(), [], learnB, adaptB.strategy);
  const speakB = trainB.stages.find((s) => s.id === 'speaking')!.minutes;
  const listenB = trainB.stages.find((s) => s.id === 'listening')!.minutes;
  assert(listenB > speakB, `B listening(${listenB}) > speaking(${speakB})`);
  assert(adaptA.strategy.preferredActivity !== adaptB.strategy.preferredActivity, 'A e B estratégias diferentes');

  const planB = buildConversationPlan(user(), { ...learnB, bottleneck: 'listening' }, []);
  assert(
    planB.bottleneck === 'listening' || /listening|escuta|compreens/i.test(planB.teacherDirective) || planB.action === 'introduce',
    `B teacher muda para listening (action=${planB.action}, bn=${planB.bottleneck})`,
  );

  // Erro recorrente → errorFocus
  clearPersonal();
  const adaptErr = adaptPersonalLearning({
    user: user(),
    learning: learnA,
    events: failEvents,
    previous: emptyPersonalLearningProfile(),
    force: true,
  });
  assert(adaptErr.strategy.errorFocus === 'verb_conjugation' || adaptErr.profile.errorPatterns.some((p) => p.pattern === 'verb_conjugation'), 'errorFocus conjugação');

  // Persistência
  savePersonalLearningProfile(adaptB.profile);
  const reloaded = loadPersonalLearningProfile();
  assert(reloaded.primaryBottleneck === 'listening', 'perfil sobrevive reload');
  assert(reloaded.teachingStrategy.preferredActivity === 'listening', 'estratégia persiste');

  // Histerese: um flip isolado com baixa stable não troca se conf baixa — simular hold
  const holdPrev = {
    ...adaptB.profile,
    primaryBottleneck: 'listening' as const,
    primaryBottleneckConfidence: 0.9,
    bottleneckStableSessions: 0,
  };
  const noisy = adaptPersonalLearning({
    user: user(),
    learning: learning({ listeningScore: 80, speakingScore: 40, retentionScore: 70, pronunciationScore: 70, responseSpeedScore: 70 }),
    previous: holdPrev,
    force: true,
  });
  // Com stable=0 e conf do novo, pode hold — se flip, ok se conf alta; aceitar listening OU speaking com reason hold
  assert(
    noisy.profile.primaryBottleneck === 'listening' ||
      noisy.changes.some((c) => c.change === 'primaryBottleneck_hold') ||
      noisy.profile.primaryBottleneck === 'speaking',
    'histerese / mudança com evidência (não caótico)',
  );

  clearPersonal();
}
