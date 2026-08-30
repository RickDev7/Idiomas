import { reviewDecision, optimizeInterval } from '@/services/optimizer/ReviewOptimizer';
import { emptyConfidence, updateConfidence } from '@/services/learning/ConfidenceService';
import { assert } from '../../learning/__tests__/assert';

export function testReviewOptimizer() {
  let c = emptyConfidence('p1');
  c = updateConfidence(c, { type: 'heard', correct: true });
  const recent = reviewDecision(c);
  // Só "heard" ainda não é learned → não deve forçar revisão por automation
  assert(!recent.dueNow || recent.reason === 'no prazo', 'frase só ouvida não vence por automação');

  const old = { ...c, lastSeen: new Date(Date.now() - 20 * 86_400_000).toISOString(), confidence: 15 };
  const overdue = reviewDecision(old);
  assert(overdue.dueNow, 'frase antiga + fraca vence');
  assert(overdue.urgency > 50, 'urgência alta para frase atrasada');

  // Learned + baixa automation → due (Fase 7)
  let learned = updateConfidence(c, { type: 'produced', correct: true, responseMs: 8000, withHelp: true });
  learned = {
    ...learned,
    state: 'answeredAlone',
    timesCorrect: 3,
    timesProduced: 4,
    confidence: 50,
    needsHelp: true,
    contextTransfer: 5,
  };
  const learnedDue = reviewDecision(learned);
  assert(learnedDue.dueNow, 'learned + baixa automation aparece na revisão');
  assert(Boolean(learnedDue.reviewType), 'tem reviewType');

  const short = optimizeInterval(30, 0.5);
  const long = optimizeInterval(80, 0.9);
  assert(short < long, 'retenção baixa -> intervalo curto; alta -> longo');
}
