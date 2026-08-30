import { emptyConfidence, updateConfidence } from '@/services/learning/ConfidenceService';
import { persistAutomationScore, readAutomationScore } from '@/services/learning/AutomationScoreEngine';
import { memoryStrength } from '@/services/learning/MemoryStrengthEngine';
import {
  applyReviewResult,
  buildReviewOpportunity,
  buildReviewQueue,
  buildReviewQueueItem,
  evaluateReviewAttempt,
  isLearned,
  pickReviewOpportunity,
  selectReviewType,
  buildReviewPrompt,
} from '@/services/learning/ReviewEngine';
import { decideReviewOrConverse } from '@/services/teacher/TeacherEngine';
import { assert } from './assert';

export function testReviewEngine() {
  let learned = emptyConfidence('pause-learned');
  learned = updateConfidence(learned, { type: 'heard', correct: true });
  learned = updateConfidence(learned, { type: 'repeated', correct: true });
  learned = updateConfidence(learned, { type: 'produced', correct: true, withHelp: true, responseMs: 8000 });
  learned = updateConfidence(learned, { type: 'produced', correct: true, withHelp: false, responseMs: 7000 });
  learned = {
    ...learned,
    confidence: 55,
    timesCorrect: 3,
    timesProduced: 4,
    needsHelp: true,
    contextTransfer: 10,
    avgResponseMs: 7500,
    state: 'answeredAlone',
    lastSeen: new Date(Date.now() - 2 * 86_400_000).toISOString(),
    lastProduced: new Date(Date.now() - 2 * 86_400_000).toISOString(),
  };
  learned = persistAutomationScore(learned);

  assert(isLearned(learned), 'item está learned');
  assert((learned.automationScore ?? 100) < 65, 'automation baixa');

  const item = buildReviewQueueItem(learned);
  assert(item !== null, 'learned + baixa automation aparece para revisão');
  assert(item!.learned, 'fila marca learned');
  assert(item!.automationScore < 80, 'score baixo na fila');
  assert(
    item!.reason.toLowerCase().includes('automat') ||
      item!.reason.toLowerCase().includes('ajuda') ||
      item!.reason.toLowerCase().includes('independ'),
    'razão reflete uso real / automação',
  );

  const guided = selectReviewType({ ...learned, needsHelp: true, state: 'answeredWithHelp' });
  assert(guided === 'GUIDED_SPEAKING_REVIEW', 'ajuda → guided speaking');

  const transfer = selectReviewType({
    ...learned,
    needsHelp: false,
    state: 'answeredAlone',
    contextTransfer: 10,
    avgResponseMs: 3000,
    recognition: 70,
    timesCorrect: 4,
    timesProduced: 4,
    confidence: 60,
  });
  assert(transfer === 'TRANSFER_REVIEW', 'sem transfer → TRANSFER_REVIEW');

  const slow = selectReviewType({
    ...learned,
    needsHelp: false,
    state: 'usedInContext',
    contextTransfer: 60,
    avgResponseMs: 8000,
    speed: 20,
    recognition: 80,
    timesCorrect: 5,
    timesProduced: 5,
    confidence: 70,
  });
  assert(
    slow === 'INDEPENDENT_SPEAKING_REVIEW' || slow === 'SPONTANEOUS_REVIEW',
    'lento → independent speaking',
  );

  const automatic = persistAutomationScore({
    ...emptyConfidence('auto-high'),
    state: 'automatic',
    confidence: 95,
    timesSeen: 20,
    timesProduced: 15,
    timesCorrect: 15,
    contextTransfer: 90,
    needsHelp: false,
    avgResponseMs: 2000,
    speed: 80,
    recognition: 90,
    successfulSessions: 4,
    independentSessions: 3,
    spontaneousSessions: 2,
    successiveSuccess: 4,
    lastSeen: new Date().toISOString(),
    lastProduced: new Date().toISOString(),
  });

  const queue = buildReviewQueue({ 'pause-learned': learned, 'auto-high': automatic });
  assert(queue.some((q) => q.phraseId === 'pause-learned'), 'learned frágil na fila');
  assert(
    !queue.some((q) => q.phraseId === 'auto-high') ||
      (queue.find((q) => q.phraseId === 'pause-learned')!.priority >
        (queue.find((q) => q.phraseId === 'auto-high')?.priority ?? 0)),
    'baixa automation tem prioridade sobre automatic',
  );

  const weakPrio = buildReviewQueueItem(learned)!.priority;
  const strongPrio = buildReviewQueueItem({
    ...automatic,
    lastSeen: new Date(Date.now() - 20 * 86_400_000).toISOString(),
    lastProduced: new Date(Date.now() - 20 * 86_400_000).toISOString(),
    nextReview: new Date(Date.now() - 86_400_000).toISOString(),
  })?.priority ?? 0;
  assert(weakPrio > strongPrio, `fraco (${weakPrio}) > forte (${strongPrio})`);

  const phrase = {
    id: 'pause-learned',
    german: 'Ich brauche eine Pause.',
    portuguese: 'Preciso de uma pausa.',
    category: 'work',
    mastery: 'speak' as const,
    reviewStage: 'learning' as const,
    nextReview: null,
    timesReviewed: 0,
    timesCorrect: 0,
    timesIncorrect: 0,
    isAutomatic: false,
    contexts: [],
  };
  const opp = buildReviewOpportunity(learned, phrase);
  assert(!!opp, 'ReviewOpportunity criada');
  assert(opp!.prompt.length > 8, 'prompt contextual');
  assert(!/repita x/i.test(opp!.prompt), 'não é "repita X"');

  const ok = evaluateReviewAttempt('Ich brauche eine Pause.', opp!);
  assert(ok === 'SUCCESS', 'produção correta = SUCCESS');
  const fail = evaluateReviewAttempt('Ich wohne in Hamburg.', opp!);
  assert(fail === 'FAILED', 'outra frase = FAILED');

  const beforeAuto = readAutomationScore(learned);
  const failed = applyReviewResult(learned, 'FAILED', { reviewType: opp!.type, sessionId: 'r1' });
  assert(failed.successiveSuccess === 0, 'falha zera sequência');
  assert(new Date(failed.nextReview!).getTime() < Date.now() + 1.2 * 86_400_000, 'falha aproxima nextReview');
  assert((failed.automationScore ?? 0) >= beforeAuto - 13, 'falha não destrói automação');
  assert((failed.reviewHistory?.length ?? 0) >= 1, 'reviewHistory append');

  const prioBeforeFail = buildReviewQueueItem(learned)!.priority;
  const afterFailItem = buildReviewQueueItem(failed);
  assert(afterFailItem !== null, 'FAILED permanece na fila (não some por wasRecentlyReviewed)');
  assert(
    afterFailItem!.priority >= prioBeforeFail,
    `FAILED sobe/mantém prioridade (${prioBeforeFail} → ${afterFailItem!.priority})`,
  );
  assert(afterFailItem!.priority > 20, `FAILED não deve cair para ~6 (got ${afterFailItem!.priority})`);

  const success = applyReviewResult(
    { ...failed, needsHelp: false, successiveSuccess: 0 },
    'SUCCESS',
    { reviewType: 'RECALL_REVIEW', sessionId: 'r2' },
  );
  assert((success.successiveSuccess ?? 0) >= 1, 'sucesso incrementa sequência');
  assert(new Date(success.nextReview!).getTime() > new Date(failed.nextReview!).getTime(), 'sucesso afasta nextReview');

  const s1 = applyReviewResult(learned, 'SUCCESS', { reviewType: 'RECALL_REVIEW', sessionId: 'a' });
  const s2 = applyReviewResult(s1, 'SUCCESS', { reviewType: 'TRANSFER_REVIEW', sessionId: 'b' });
  const s3 = applyReviewResult(s2, 'SUCCESS', { reviewType: 'SPONTANEOUS_REVIEW', sessionId: 'c' });
  const i1 = memoryStrength(s1).intervalDays;
  const i3 = memoryStrength(s3).intervalDays;
  assert(i3 >= i1, `intervalos crescem (${i1} → ${i3})`);

  const picked = pickReviewOpportunity({ 'pause-learned': learned }, [phrase]);
  assert(picked?.itemId === 'pause-learned', 'pickReviewOpportunity usa memória real');

  const recallP = buildReviewPrompt(phrase.german, 'RECALL_REVIEW');
  const guidedP = buildReviewPrompt(phrase.german, 'GUIDED_SPEAKING_REVIEW');
  const transferP = buildReviewPrompt(phrase.german, 'TRANSFER_REVIEW');
  const spontP = buildReviewPrompt(phrase.german, 'SPONTANEOUS_REVIEW');
  assert(/Was brauchst du/i.test(recallP.prompt), 'RECALL contextual (trabalho)');
  assert(/Fang an/i.test(guidedP.prompt), 'GUIDED dá pista mínima');
  assert(/morgen/i.test(transferP.prompt), 'TRANSFER muda contexto');
  assert(!/repita/i.test(spontP.prompt), 'SPONTANEOUS não pede a frase');
  assert(recallP.prompt !== transferP.prompt, 'tipos produzem prompts diferentes');

  const forced = pickReviewOpportunity({ 'pause-learned': learned }, [phrase], {
    phraseId: 'pause-learned',
    forcedType: 'TRANSFER_REVIEW',
  });
  assert(forced?.type === 'TRANSFER_REVIEW', 'card TRANSFER força o tipo');
  assert(/morgen/i.test(forced!.prompt), 'tipo forçado reconstrói o prompt');

  const learningStub = {
    phrases: { 'pause-learned': learned },
  } as unknown as Parameters<typeof decideReviewOrConverse>[0];
  const mode = decideReviewOrConverse(learningStub, [phrase]);
  assert(mode.decision === 'REVIEW', `fraco due → REVIEW (${mode.decision})`);
  const wait = decideReviewOrConverse(learningStub, [phrase], { inImportantConversation: true });
  assert(wait.decision === 'CONVERSE', 'conversa importante → não interrompe');
}
