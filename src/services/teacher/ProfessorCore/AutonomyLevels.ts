/**
 * Autonomia — dimensão central (≠ repetição após ouvir).
 */
import type { PhraseConfidence, PhraseState } from '@/services/learning/ConfidenceService';
import { stateIndex } from '@/services/learning/ConfidenceService';
import type { AutonomyLevel } from './Types';

export function autonomyFromConfidence(c: PhraseConfidence | undefined): AutonomyLevel {
  if (!c) return 'RECOGNITION';
  if ((c.spontaneousSessions ?? 0) > 0 || stateIndex(c.state) >= stateIndex('spontaneous')) {
    return 'SPONTANEOUS_PRODUCTION';
  }
  if (stateIndex(c.state) >= stateIndex('usedInContext') || (c.contextTransfer ?? 0) >= 50) {
    return 'INDEPENDENT_PRODUCTION';
  }
  if (stateIndex(c.state) >= stateIndex('answeredAlone') && !c.needsHelp) {
    return 'INDEPENDENT_PRODUCTION';
  }
  if (stateIndex(c.state) >= stateIndex('answeredWithHelp') || c.needsHelp) {
    return 'GUIDED_PRODUCTION';
  }
  if (stateIndex(c.state) >= stateIndex('recognized') || (c.recognition ?? 0) >= 40) {
    return 'RECALL';
  }
  return 'RECOGNITION';
}

/** Repetição após modelo ≠ domínio. */
export function isMereRepetition(state: PhraseState): boolean {
  return stateIndex(state) <= stateIndex('repeated');
}

export function autonomyLabel(level: AutonomyLevel): string {
  return level;
}
