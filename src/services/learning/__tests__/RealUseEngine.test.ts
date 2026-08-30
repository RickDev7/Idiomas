import { emptyConfidence, updateConfidence } from '@/services/learning/ConfidenceService';
import {
  computeAutomationScore,
  computeIndependenceScore,
  computeSessionRealUse,
  nextBestLearningAction,
  toLearningItemState,
} from '@/services/learning/RealUseEngine';
import type { LearningEvent } from '@/services/learning/EventStore';
import { assert } from './assert';

function ev(partial: Partial<LearningEvent> & { type: LearningEvent['type'] }): LearningEvent {
  return {
    id: 'e',
    timestamp: new Date().toISOString(),
    ...partial,
  };
}

export function testRealUseEngine() {
  let c = emptyConfidence('pause');
  c = updateConfidence(c, { type: 'heard', correct: true });
  c = updateConfidence(c, { type: 'repeated', correct: true });
  assert(nextBestLearningAction(c) === 'guided' || nextBestLearningAction(c) === 'recall', 'após exposição → guided/recall');

  c = updateConfidence(c, { type: 'produced', correct: true, responseMs: 5000, withHelp: true });
  assert(c.state === 'answeredWithHelp', 'produção com ajuda');
  assert(computeIndependenceScore(c) < 50, 'ajuda baixa independência');

  c = updateConfidence(c, { type: 'produced', correct: true, responseMs: 4000, withHelp: false });
  assert(c.state === 'answeredAlone', 'produção independente');
  assert(nextBestLearningAction(c) === 'transfer', 'sozinho mas sem transfer → transfer');

  c = updateConfidence(c, { type: 'transfer', correct: true });
  c = updateConfidence(c, { type: 'transfer', correct: true });
  c = updateConfidence(c, { type: 'transfer', correct: true });
  assert(c.contextTransfer >= 60, 'transferência acumulada');

  c = updateConfidence(c, { type: 'spontaneous', correct: true });
  assert(c.state === 'spontaneous' || c.state === 'automatic', 'uso espontâneo avança estado');

  c = updateConfidence(c, { type: 'fast', correct: true, responseMs: 2000 });
  const boosted = {
    ...c,
    confidence: 92,
    contextTransfer: 75,
    needsHelp: false,
    avgResponseMs: 2200,
    speed: Math.max(c.speed, 40),
    state: 'automatic' as const,
  };
  const auto = computeAutomationScore(boosted);
  assert(auto >= 70, 'score de automação alto quando estável');
  assert(computeIndependenceScore(boosted) >= 60, 'independência alta sem ajuda + transfer');

  const item = toLearningItemState(boosted, 0);
  assert(item.itemId === 'pause', 'LearningItemState.itemId');
  assert(item.automationScore === auto, 'LearningItemState espelha AutomationScore');
  assert(item.helpLevel === 0, 'sem ajuda → helpLevel 0');

  const events: LearningEvent[] = [
    ev({ type: 'PHRASE_PRODUCED', helpLevel: 0 }),
    ev({ type: 'PHRASE_PRODUCED', helpLevel: 0 }),
    ev({ type: 'PHRASE_PRODUCED', helpLevel: 0 }),
    ev({ type: 'PHRASE_PRODUCED', helpLevel: 0 }),
    ev({ type: 'PHRASE_TRANSFERRED' }),
    ev({ type: 'PHRASE_TRANSFERRED' }),
    ev({ type: 'PHRASE_USED_SPONTANEOUSLY' }),
    ev({ type: 'PHRASE_RECALLED' }),
    ev({ type: 'HELP_REQUESTED', helpLevel: 2 }),
  ];
  const outcome = computeSessionRealUse(events, { pause: c });
  assert(outcome.independentResponses === 4, '4 respostas sem ajuda');
  assert(outcome.transferredItems === 2, '2 transferências');
  assert(outcome.spontaneousUses === 1, '1 espontâneo');
  assert(outcome.recalledItems === 1, '1 recall');
  assert(outcome.realUseScore > 40, 'RealUseScore reflete uso real');
  assert(outcome.headline.includes('sem ajuda'), 'headline enfatiza uso real');

  assert(nextBestLearningAction(undefined) === 'introduce', 'frase nova → INTRODUCE');
  assert(nextBestLearningAction(emptyConfidence('x')) === 'introduce', 'estado new → INTRODUCE');
}
