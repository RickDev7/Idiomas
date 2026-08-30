/* NaturalnessScore — avalia o SISTEMA, não o aluno. */

export interface NaturalnessInputs {
  interruptionsLast10: number;
  briefCorrectionsLast10: number;
  microStartsLast10: number;
  topicRepeats: number;
  turnsSinceLastIntervention: number;
}

export interface NaturalnessResult {
  score: number;
  reasons: string[];
}

export function scoreNaturalness(i: NaturalnessInputs): NaturalnessResult {
  let score = 100;
  const reasons: string[] = [];
  if (i.interruptionsLast10 > 2) {
    score -= (i.interruptionsLast10 - 2) * 10;
    reasons.push('muitas interrupções');
  }
  if (i.briefCorrectionsLast10 > 4) {
    score -= (i.briefCorrectionsLast10 - 4) * 6;
    reasons.push('excesso de correção');
  }
  if (i.microStartsLast10 > 1) {
    score -= i.microStartsLast10 * 12;
    reasons.push('excesso de exercício');
  }
  if (i.topicRepeats > 2) {
    score -= i.topicRepeats * 5;
    reasons.push('repetição de tema');
  }
  if (i.turnsSinceLastIntervention === 0) score -= 4;
  return { score: Math.max(0, Math.min(100, score)), reasons };
}
