import type { UserLearningProfile } from '@/services/learning/ConfidenceService';
import type { Phrase } from '@/types';
import { readAutomationScore, computeIndependenceScore } from '@/services/learning/RealUseEngine';
import {
  analyzeSpontaneousUse,
  detectReliableSpontaneousId,
} from '@/services/learning/SpontaneousUseDetector';

export interface ProgressSummary {
  communicationScore: number;
  independenceScore: number;
  comprehensionScore: number;
  retentionScore: number;
  responseSpeedScore: number;
  spontaneousUses: number;
  automationScore: number;
}

export function computeProgress(learning: UserLearningProfile): ProgressSummary {
  const confidences = Object.values(learning.phrases);
  const total = confidences.length || 1;
  const produced = confidences.filter((c) => c.timesProduced > 0).length;
  const automatic = confidences.filter((c) => c.state === 'automatic').length;
  const spontaneousUses = confidences.filter((c) => c.state === 'spontaneous' || c.contextTransfer >= 60).length;
  const avgConfidence = confidences.reduce((s, c) => s + c.confidence, 0) / total;
  const avgSpeed = confidences.filter((c) => c.avgResponseMs > 0).reduce((s, c) => s + c.speed, 0) / Math.max(1, confidences.filter((c) => c.avgResponseMs > 0).length);
  const automationScore = Math.round(
    confidences.reduce((s, c) => s + readAutomationScore(c), 0) / total,
  );
  const independenceScore = Math.round(
    (produced / total) * 30 +
      (automatic / total) * 20 +
      (spontaneousUses / total) * 20 +
      confidences.reduce((s, c) => s + computeIndependenceScore(c), 0) / total * 0.3,
  );

  const communicationScore = Math.round(
    avgConfidence * 0.35 +
    learning.listeningScore * 0.15 +
    learning.speakingScore * 0.15 +
    independenceScore * 0.2 +
    automationScore * 0.15,
  );

  return {
    communicationScore: Math.min(100, communicationScore),
    independenceScore: Math.min(100, independenceScore),
    comprehensionScore: learning.listeningScore,
    retentionScore: learning.retentionScore,
    responseSpeedScore: Math.round(avgSpeed),
    spontaneousUses,
    automationScore: Math.min(100, automationScore),
  };
}

export function weeklyDelta(current: ProgressSummary, previous: ProgressSummary | null): { area: string; delta: number } | null {
  if (!previous) return null;
  const areas: { area: string; delta: number }[] = [
    { area: '🗣️ resposta', delta: current.responseSpeedScore - previous.responseSpeedScore },
    { area: '🎧 compreensão', delta: current.comprehensionScore - previous.comprehensionScore },
    { area: '🧠 retenção', delta: current.retentionScore - previous.retentionScore },
    { area: '🆓 independência', delta: current.independenceScore - previous.independenceScore },
  ];
  areas.sort((a, b) => b.delta - a.delta);
  return areas[0].delta > 0 ? areas[0] : null;
}

export function detectSpontaneousUse(transcript: string, phrases: Phrase[]): string | null {
  return detectReliableSpontaneousId({
    teacherPrompt: '',
    userResponse: transcript,
    targetItems: [],
    knownPhrases: phrases.map((p) => ({ id: p.id, german: p.german })),
    conversationMode: 'FREE_CONVERSATION',
    orchestratorAction: 'converse',
  });
}

export { analyzeSpontaneousUse, detectReliableSpontaneousId };
