/* StrengthDetector — forças observáveis (Fase 9). Sem diagnóstico de personalidade. */

import type { UserLearningProfile } from '@/services/learning/ConfidenceService';
import type { StrengthEntry } from '@/services/learning/PersonalLearningProfile';
import type { LearningEvent } from '@/services/learning/EventStore';

export function detectStrengths(
  learning: UserLearningProfile,
  events: LearningEvent[] = [],
): StrengthEntry[] {
  const out: StrengthEntry[] = [];
  const recent = events.slice(-80);

  if (learning.listeningScore >= 70 && learning.listeningScore - learning.speakingScore >= 12) {
    out.push({
      type: 'listening',
      confidence: clamp01(0.55 + (learning.listeningScore - 70) / 60),
      reason: `listeningScore ${learning.listeningScore} bem acima de speaking ${learning.speakingScore}`,
    });
  } else if (learning.listeningScore >= 75) {
    out.push({
      type: 'listening',
      confidence: clamp01(0.5 + (learning.listeningScore - 75) / 50),
      reason: `listeningScore ${learning.listeningScore}`,
    });
  }

  if (learning.speakingScore >= 70 && learning.speakingScore - learning.listeningScore >= 12) {
    out.push({
      type: 'speaking',
      confidence: clamp01(0.55 + (learning.speakingScore - 70) / 60),
      reason: `speakingScore ${learning.speakingScore} bem acima de listening`,
    });
  } else if (learning.speakingScore >= 75) {
    out.push({
      type: 'speaking',
      confidence: clamp01(0.5 + (learning.speakingScore - 75) / 50),
      reason: `speakingScore ${learning.speakingScore}`,
    });
  }

  if (learning.strongPhrases.length >= 3) {
    out.push({
      type: 'vocabulary',
      confidence: clamp01(0.45 + learning.strongPhrases.length * 0.05),
      reason: `${learning.strongPhrases.length} frases com alta confiança`,
    });
  }

  if (learning.retentionScore >= 75) {
    out.push({
      type: 'retention',
      confidence: clamp01(0.5 + (learning.retentionScore - 75) / 50),
      reason: `retentionScore ${learning.retentionScore}`,
    });
  }

  const heard = recent.filter((e) => e.type === 'PHRASE_HEARD' || e.type === 'LISTENING_SUCCESS').length;
  const listenFail = recent.filter((e) => e.type === 'LISTENING_FAILURE').length;
  if (heard >= 4 && listenFail / Math.max(1, heard + listenFail) < 0.25) {
    out.push({
      type: 'contextual_comprehension',
      confidence: 0.7,
      reason: `${heard} escutas recentes com baixa falha`,
    });
  }

  const indep = recent.filter((e) => e.type === 'INDEPENDENT_RESPONSE' || (e.type === 'PHRASE_PRODUCED' && (e.helpLevel ?? 0) === 0)).length;
  const produced = recent.filter((e) => e.type === 'PHRASE_PRODUCED' || e.type === 'PHRASE_PRODUCED_WITH_HINT').length;
  if (produced >= 5 && indep / produced >= 0.6) {
    out.push({
      type: 'independent_production',
      confidence: clamp01(0.55 + indep / produced * 0.3),
      reason: `${indep}/${produced} produções independentes recentes`,
    });
  }

  return out.sort((a, b) => b.confidence - a.confidence).slice(0, 5);
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}
