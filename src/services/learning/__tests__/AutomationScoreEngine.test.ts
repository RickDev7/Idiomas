import { emptyConfidence, updateConfidence, type PhraseConfidence } from '@/services/learning/ConfidenceService';
import {
  calculateAutomationScore,
  computeAutomationScore,
  decideNextBestAction,
  getNextBestLearningAction,
  isAutomated,
  persistAutomationScore,
  readAutomationScore,
  toLearningItemState,
  updateAutomationScore,
  AUTOMATED_THRESHOLD,
} from '@/services/learning/AutomationScoreEngine';
import {
  getNextBestLearningActionForTeacher,
  planTodaysTraining,
} from '@/services/teacher/TeacherEngine';
import type { UserProfile } from '@/types';
import type { UserLearningProfile } from '@/services/learning/ConfidenceService';
import { assert } from './assert';

function fakeUser(): UserProfile {
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
  };
}

function fakeLearning(phrases: Record<string, PhraseConfidence>): UserLearningProfile {
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
    phrases,
    bottleneck: null,
  };
}

function base(partial: Partial<PhraseConfidence> & { phraseId: string }): PhraseConfidence {
  return persistAutomationScore({ ...emptyConfidence(partial.phraseId), ...partial });
}

/** Estado baixo ~20 */
function lowAutomation(): PhraseConfidence {
  let c = emptyConfidence('low');
  c = updateConfidence(c, { type: 'heard', correct: true });
  c = updateConfidence(c, { type: 'repeated', correct: true });
  c = updateConfidence(c, { type: 'produced', correct: true, withHelp: true, responseMs: 9000 });
  return base({
    ...c,
    confidence: 25,
    needsHelp: true,
    timesProduced: 3,
    timesCorrect: 1,
    avgResponseMs: 9000,
    state: 'answeredWithHelp',
    contextTransfer: 0,
    lastProduced: new Date().toISOString(),
  });
}

/** Estado médio ~50 */
function midAutomation(): PhraseConfidence {
  let c = emptyConfidence('mid');
  c = updateConfidence(c, { type: 'produced', correct: true, withHelp: false, responseMs: 4500 });
  c = updateConfidence(c, { type: 'produced', correct: true, withHelp: false, responseMs: 4000 });
  return base({
    ...c,
    confidence: 70,
    needsHelp: false,
    timesProduced: 4,
    timesCorrect: 4,
    timesSeen: 6,
    avgResponseMs: 4200,
    state: 'answeredAlone',
    contextTransfer: 20,
    speed: 45,
    lastProduced: new Date().toISOString(),
  });
}

/** Estado alto ~80 */
function highAutomation(): PhraseConfidence {
  return base({
    phraseId: 'high',
    confidence: 90,
    needsHelp: false,
    timesSeen: 12,
    timesProduced: 8,
    timesCorrect: 8,
    avgResponseMs: 2200,
    speed: 70,
    contextTransfer: 80,
    state: 'spontaneous',
    successfulSessions: 3,
    independentSessions: 2,
    spontaneousSessions: 2,
    lastProduced: new Date().toISOString(),
    lastSeen: new Date().toISOString(),
  });
}

export function testAutomationScoreEngine() {
  const low = lowAutomation();
  const mid = midAutomation();
  const high = highAutomation();

  const lowScore = readAutomationScore(low);
  const midScore = readAutomationScore(mid);
  const highScore = readAutomationScore(high);

  assert(calculateAutomationScore(low) === computeAutomationScore(low), 'calculateAutomationScore alias');
  assert(lowScore < 35, `baixo < 35 (got ${lowScore})`);
  assert(midScore >= 35 && midScore < 65, `médio 35–65 (got ${midScore})`);
  assert(highScore >= 65, `alto ≥ 65 (got ${highScore})`);

  // Limites 0 / 20 / 40 / 60 / 80 / 100
  const s0 = calculateAutomationScore(emptyConfidence('z'));
  assert(s0 === 0 || s0 < 15, `score ~0 (got ${s0})`);
  const bands = [20, 40, 60, 80, 100].map((target) => {
    const forced = { ...toLearningItemState(mid), automationScore: target, transferCount: target >= 60 ? 3 : 0, spontaneousCount: target >= 80 ? 2 : 0 };
    return decideNextBestAction(forced).action;
  });
  assert(bands[0] === 'guided' || bands[0] === 'recall' || bands[0] === 'transfer', `20 → practice-ish (${bands[0]})`);
  assert(bands[1] === 'transfer', `40 → transfer (${bands[1]})`);
  assert(bands[2] === 'transfer' || bands[2] === 'spontaneous', `60 → transfer/spont (${bands[2]})`);
  assert(bands[3] === 'spontaneous' || bands[3] === 'independent' || bands[3] === 'maintenance', `80 → high (${bands[3]})`);
  assert(bands[4] === 'spontaneous' || bands[4] === 'independent' || bands[4] === 'maintenance', `100 → high (${bands[4]})`);

  // Persistência + histórico
  assert(typeof low.automationScore === 'number', 'automationScore persistido');
  assert(Boolean(low.lastAutomationUpdate || low.automationUpdatedAt), 'lastAutomationUpdate');
  assert((low.automationHistory?.length ?? 0) >= 1, 'automationHistory append');

  const updated = updateAutomationScore(low, { sessionId: 's1', evidence: 'produced' });
  assert((updated.automationHistory?.length ?? 0) > (low.automationHistory?.length ?? 0), 'histórico não sobrescreve');
  assert(Math.abs(readAutomationScore(updated) - lowScore) <= 12, 'step ≤ MAX_SCORE_STEP');

  // Ajuda alta + accuracy alta → NÃO automated
  const helpHeavy = base({
    phraseId: 'help-acc',
    confidence: 95,
    needsHelp: true,
    timesProduced: 10,
    timesCorrect: 10,
    timesSeen: 12,
    contextTransfer: 70,
    state: 'answeredAlone',
    avgResponseMs: 2000,
    successfulSessions: 3,
    independentSessions: 0,
    lastProduced: new Date().toISOString(),
  });
  assert(!isAutomated(helpHeavy), 'help dependency → não AUTOMATED');
  assert(getNextBestLearningAction(helpHeavy) !== 'independent' || readAutomationScore(helpHeavy) < AUTOMATED_THRESHOLD, 'ajuda impede maintenance cego');

  // Transfer baixo → não automated
  const noXfer = base({
    phraseId: 'no-xfer',
    confidence: 90,
    needsHelp: false,
    timesProduced: 8,
    timesCorrect: 8,
    timesSeen: 10,
    contextTransfer: 10,
    state: 'answeredAlone',
    successfulSessions: 3,
    independentSessions: 2,
    spontaneousSessions: 0,
    lastProduced: new Date().toISOString(),
  });
  assert(!isAutomated(noXfer), 'accuracy alta + transfer baixo → não AUTOMATED');

  // Spontaneous eleva
  const withSpont = base({
    ...noXfer,
    phraseId: 'with-spont',
    contextTransfer: 70,
    state: 'spontaneous',
    spontaneousSessions: 2,
  });
  assert(readAutomationScore(withSpont) > readAutomationScore(noXfer), 'spontaneous sobe score');

  // Sessões evoluem score
  let sess = emptyConfidence('sess');
  sess = updateConfidence(sess, { type: 'produced', correct: true, withHelp: true });
  sess = updateAutomationScore(sess, { sessionId: 'a', evidence: 'produced' });
  const sA = readAutomationScore(sess);
  sess = updateConfidence(sess, { type: 'produced', correct: true, withHelp: false });
  sess = updateAutomationScore({ ...sess, state: 'answeredAlone', needsHelp: false, contextTransfer: 30 }, { sessionId: 'b', evidence: 'produced' });
  const sB = readAutomationScore(sess);
  sess = updateConfidence(sess, { type: 'transfer', correct: true });
  sess = updateAutomationScore(
    { ...sess, state: 'usedInContext', contextTransfer: 55, successfulSessions: 2, independentSessions: 2 },
    { sessionId: 'c', evidence: 'transfer' },
  );
  const sC = readAutomationScore(sess);
  assert(sB >= sA - 2, `sessão2 >= sessão1 (${sA}→${sB})`);
  assert(sC >= sB - 2, `sessão3 >= sessão2 (${sB}→${sC})`);
  assert((sess.automationHistory?.length ?? 0) >= 3, 'histórico multi-sessão');

  // isAutomated exige evidência
  assert(isAutomated(high) || highScore < AUTOMATED_THRESHOLD, 'high com evidência pode ser automated');
  const once = base({
    phraseId: 'once',
    confidence: 99,
    needsHelp: false,
    timesProduced: 1,
    timesCorrect: 1,
    timesSeen: 1,
    contextTransfer: 90,
    state: 'spontaneous',
    successfulSessions: 1,
    independentSessions: 1,
    spontaneousSessions: 1,
    lastProduced: new Date().toISOString(),
  });
  // Score pode ser alto, mas 1 sessão + timesSeen baixo → não automated
  if (readAutomationScore(once) >= AUTOMATED_THRESHOLD) {
    assert(!isAutomated(once), '1 sessão não basta para AUTOMATED');
  }

  // Next Best Action
  const lowAction = getNextBestLearningAction(low);
  assert(lowAction === 'guided' || lowAction === 'recall', `baixo → guided/recall (got ${lowAction})`);
  const midAction = getNextBestLearningAction(mid);
  assert(midAction === 'transfer' || midAction === 'automation', `médio → transfer (got ${midAction})`);
  const highAction = getNextBestLearningAction(high);
  assert(
    highAction === 'spontaneous' || highAction === 'independent',
    `alto → spontaneous/conversation (got ${highAction})`,
  );

  // Mudança PRACTICE → TRANSFER com score
  const before = decideNextBestAction({ ...toLearningItemState(low), automationScore: 28 });
  const after = decideNextBestAction({ ...toLearningItemState(mid), automationScore: 52, transferCount: 0 });
  assert(before.action === 'guided' || before.action === 'recall', `antes PRACTICE (${before.action})`);
  assert(after.action === 'transfer', `depois TRANSFER (${after.action})`);
  assert(!!after.reason && (/transfer/i.test(after.reason) || after.reason.includes('52')), 'reason explicável');

  // TeacherEngine usa o score
  const learning = fakeLearning({ low, mid, high });
  const trainingLowBias = planTodaysTraining(fakeUser(), [], fakeLearning({ low }));
  const trainingHighBias = planTodaysTraining(fakeUser(), [], fakeLearning({ high }));
  assert(trainingLowBias.primaryAction === 'guided' || trainingLowBias.primaryAction === 'recall', 'Teacher: baixo → guided');
  assert(
    trainingHighBias.primaryAction === 'spontaneous' || trainingHighBias.primaryAction === 'independent',
    'Teacher: alto → spontaneous/independent',
  );
  const convoLow = trainingLowBias.stages.find((s) => s.id === 'conversation')!.minutes;
  const convoHigh = trainingHighBias.stages.find((s) => s.id === 'conversation')!.minutes;
  assert(convoHigh > convoLow, 'score alto → mais minutos de conversa');

  assert(
    getNextBestLearningActionForTeacher(learning, 'low') === 'guided' ||
      getNextBestLearningActionForTeacher(learning, 'low') === 'recall',
    'Teacher.getNextBestLearningAction baixo',
  );
  assert(getNextBestLearningActionForTeacher(learning, 'mid') === 'transfer', 'Teacher mid → transfer');
  assert(
    getNextBestLearningActionForTeacher(learning, 'high') === 'spontaneous' ||
      getNextBestLearningActionForTeacher(learning, 'high') === 'independent',
    'Teacher high → spontaneous/independent',
  );

  const again = persistAutomationScore(high);
  assert(Math.abs(readAutomationScore(again) - highScore) <= 20, 'recalcular mantém estabilidade');
  assert(toLearningItemState(low).components !== undefined, 'componentes disponíveis');
}
