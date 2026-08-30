/* RealUseEngine — métricas de uso real; AutomationScore vive em AutomationScoreEngine (Fase 6). */
import type { PhraseConfidence } from '@/services/learning/ConfidenceService';
import type { LearningEvent } from '@/services/learning/EventStore';
import {
  computeAutomationScore,
  computeAutomationComponents,
  getNextBestLearningAction,
  nextBestLearningAction,
  persistAutomationScore,
  readAutomationScore,
  toLearningItemState,
  isAutomated as isAutomatedItem,
  type LearningItemState,
  type PedagogicalKind,
  type NextBestActionContext,
} from '@/services/learning/AutomationScoreEngine';

export type { LearningItemState, PedagogicalKind, NextBestActionContext };
export {
  computeAutomationScore,
  computeAutomationComponents,
  getNextBestLearningAction,
  nextBestLearningAction,
  persistAutomationScore,
  readAutomationScore,
  toLearningItemState,
};

export function computeIndependenceScore(c: PhraseConfidence): number {
  return toLearningItemState(c).independenceScore;
}

export function isAutomated(c: PhraseConfidence): boolean {
  return isAutomatedItem(c) || c.state === 'automatic';
}

export interface SessionRealUseOutcome {
  independentResponses: number;
  transferredItems: number;
  spontaneousUses: number;
  automatedItems: number;
  recalledItems: number;
  helpedResponses: number;
  realUseScore: number;
  headline: string;
}

export function computeSessionRealUse(
  events: LearningEvent[],
  phrases: Record<string, PhraseConfidence>,
): SessionRealUseOutcome {
  const independentResponses = events.filter((e) => e.type === 'PHRASE_PRODUCED' && (e.helpLevel ?? 0) === 0).length;
  const helpedResponses = events.filter(
    (e) => e.type === 'PHRASE_PRODUCED_WITH_HINT' || e.type === 'HELP_REQUESTED',
  ).length;
  const transferredItems = events.filter((e) => e.type === 'PHRASE_TRANSFERRED').length;
  const spontaneousUses = events.filter((e) => e.type === 'PHRASE_USED_SPONTANEOUSLY').length;
  const recalledItems = events.filter((e) => e.type === 'PHRASE_RECALLED').length;
  const automatedItems = Object.values(phrases).filter(isAutomated).length;

  const realUseScore = Math.min(
    100,
    independentResponses * 12 +
      transferredItems * 18 +
      spontaneousUses * 22 +
      recalledItems * 8 +
      Math.min(20, automatedItems * 5) -
      Math.min(15, helpedResponses * 2),
  );

  const parts: string[] = [];
  if (independentResponses > 0) parts.push(`${independentResponses} frase${independentResponses === 1 ? '' : 's'} sem ajuda`);
  if (transferredItems > 0) parts.push(`${transferredItems} variação${transferredItems === 1 ? '' : 'ões'}`);
  if (spontaneousUses > 0) parts.push(`${spontaneousUses} uso${spontaneousUses === 1 ? '' : 's'} espontâneo${spontaneousUses === 1 ? '' : 's'}`);
  if (recalledItems > 0) parts.push(`${recalledItems} recuperada${recalledItems === 1 ? '' : 's'}`);
  const headline = parts.length
    ? `Hoje você realmente usou alemão: ${parts.join(' · ')}.`
    : independentResponses === 0 && spontaneousUses === 0
      ? 'Hoje você praticou. Na próxima, tente responder sem ajuda.'
      : 'Hoje você usou o que aprendeu.';

  return {
    independentResponses,
    transferredItems,
    spontaneousUses,
    automatedItems,
    recalledItems,
    helpedResponses,
    realUseScore: Math.max(0, realUseScore),
    headline,
  };
}
