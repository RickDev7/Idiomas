/**
 * ProgressionRules — decide INTRODUCE/PRACTICE/VARY/TEST/REVIEW/DEFER/ADVANCE.
 * Reutiliza AutomationScoreEngine (não duplica critérios).
 */
import type { PhraseConfidence } from '@/services/learning/ConfidenceService';
import {
  decideNextBestAction,
  readAutomationScore,
  type PedagogicalKind,
} from '@/services/learning/AutomationScoreEngine';
import type { AutonomyLevel, ProgressionAction } from './Types';
import { autonomyFromConfidence } from './AutonomyLevels';

const MAP: Record<PedagogicalKind, ProgressionAction> = {
  introduce: 'INTRODUCE',
  guided: 'PRACTICE',
  recall: 'REVIEW',
  independent: 'PRACTICE',
  transfer: 'VARY',
  spontaneous: 'ADVANCE',
  automation: 'ADVANCE',
  maintenance: 'REVIEW',
};

export interface ProgressionDecision {
  action: ProgressionAction;
  reason: string;
  pedagogicalKind: PedagogicalKind;
  autonomy: AutonomyLevel;
  score: number;
  targetId: string | null;
}

export function decideProgression(
  conf: PhraseConfidence | undefined,
  opts?: {
    dueReview?: boolean;
    persistentErrors?: number;
    sessionGoal?: 'lesson' | 'review' | 'test' | 'converse';
  },
): ProgressionDecision {
  if (opts?.persistentErrors && opts.persistentErrors >= 3) {
    return {
      action: 'DEFER',
      reason: 'erro persistente — defer + revisão futura',
      pedagogicalKind: 'guided',
      autonomy: autonomyFromConfidence(conf),
      score: conf ? readAutomationScore(conf) : 0,
      targetId: conf?.phraseId ?? null,
    };
  }

  const nba = decideNextBestAction(conf, {
    dueReview: opts?.dueReview,
    sessionGoal: opts?.sessionGoal === 'review' || opts?.sessionGoal === 'test' ? 'review' : opts?.sessionGoal === 'converse' ? 'conversation' : 'auto',
  });

  let action = MAP[nba.action] ?? 'PRACTICE';
  if (opts?.sessionGoal === 'test') action = 'TEST';

  return {
    action,
    reason: nba.reason,
    pedagogicalKind: nba.action,
    autonomy: autonomyFromConfidence(conf),
    score: nba.score,
    targetId: conf?.phraseId ?? null,
  };
}

export function progressionActionLabel(action: ProgressionAction): string {
  return action;
}
