import type { PhraseConfidence } from '@/services/learning/ConfidenceService';
import { stateIndex } from '@/services/learning/ConfidenceService';
import { readAutomationScore } from '@/services/learning/AutomationScoreEngine';

export interface MemoryStrength {
  phraseId: string;
  strength: number;
  recencyDays: number;
  stability: number;
  retrievability: number;
  nextReviewAt: string;
  intervalDays: number;
}

/** 1 → 3 → 7 → 14 → 30 → 60 (após sucessos sucessivos). */
export const REVIEW_INTERVALS_DAYS = [1, 3, 7, 14, 30, 60];

export function memoryStrength(conf: PhraseConfidence, now = Date.now()): MemoryStrength {
  const lastIso = conf.lastProduced || conf.lastReviewed || conf.lastSeen;
  const parsedLast = lastIso ? Date.parse(lastIso) : NaN;
  const lastSeen = Number.isFinite(parsedLast) ? parsedLast : now;
  const recencyDays = Math.max(0, (now - lastSeen) / 86_400_000);

  const successRate =
    conf.timesSeen > 0 ? conf.timesCorrect / Math.max(1, conf.timesProduced || conf.timesSeen) : 0;
  const auto = readAutomationScore(conf);
  const stability = Math.min(
    100,
    15 +
      successRate * 45 +
      stateIndex(conf.state) * 4 +
      auto * 0.2 +
      Math.min(12, (conf.successiveSuccess ?? 0) * 3) -
      (conf.needsHelp ? 12 : 0),
  );

  const decayPerDay = Math.max(0.05, (100 - stability) / 100);
  const retrievability = Math.max(
    0,
    100 - recencyDays * decayPerDay * 20 - (100 - conf.confidence) * 0.5,
  );

  const strength = Math.round(
    0.35 * conf.confidence + 0.25 * stability + 0.2 * retrievability + 0.2 * auto,
  );

  const successIdx = Math.min(
    REVIEW_INTERVALS_DAYS.length - 1,
    Math.max(0, (conf.successiveSuccess ?? 0) - 1),
  );
  const strengthIdx = Math.min(REVIEW_INTERVALS_DAYS.length - 1, Math.floor(strength / 20));
  const stageIdx = Math.max(successIdx, strengthIdx === 0 ? 0 : Math.min(successIdx + 1, strengthIdx));

  const autoFactor = auto >= 80 ? 1.6 : auto >= 65 ? 1.15 : auto >= 40 ? 1.0 : 0.55;
  let intervalDays = Math.max(1, Math.round(REVIEW_INTERVALS_DAYS[stageIdx] * autoFactor));

  // Frágil + sem sequência de acertos → cedo, mas não "sempre amanhã" após sucesso recente
  if (auto < 40 && (conf.successiveSuccess ?? 0) < 1 && stateIndex(conf.state) >= stateIndex('answeredWithHelp')) {
    intervalDays = Math.min(intervalDays, 1);
  }
  if (auto >= 80 && (conf.successiveSuccess ?? 0) >= 2) {
    intervalDays = Math.max(intervalDays, 7);
  }

  const base = Number.isFinite(parsedLast) ? parsedLast : now;
  const nextReviewAt = new Date(base + intervalDays * 86_400_000).toISOString();

  return {
    phraseId: conf.phraseId,
    strength,
    recencyDays: Math.round(recencyDays * 10) / 10,
    stability: Math.round(stability),
    retrievability: Math.round(retrievability),
    nextReviewAt,
    intervalDays,
  };
}

export function effectiveNextReview(conf: PhraseConfidence, now = Date.now()): string {
  if (conf.nextReview) return conf.nextReview;
  return memoryStrength(conf, now).nextReviewAt;
}

/** Ponte de compatibilidade → ReviewEngine unificado. */
export async function dueForReview(now = new Date()): Promise<string[]> {
  const { dueForReview: unified } = await import('@/services/learning/ReviewEngine');
  return unified(now);
}

export { EventStore } from '@/services/learning/EventStore';
