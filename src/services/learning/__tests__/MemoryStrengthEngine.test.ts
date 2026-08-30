import { memoryStrength } from '@/services/learning/MemoryStrengthEngine';
import { emptyConfidence, updateConfidence } from '@/services/learning/ConfidenceService';
import { assert } from './assert';

export function testMemoryStrengthEngine() {
  let c = emptyConfidence('p1');
  c = updateConfidence(c, { type: 'produced', correct: true, responseMs: 3000 });
  c = updateConfidence(c, { type: 'produced', correct: true, responseMs: 2500 });
  const m = memoryStrength(c);
  assert(m.strength > 0, 'força calculada');
  assert(m.recencyDays < 1, 'recência baixa agora');
  assert(new Date(m.nextReviewAt).getTime() > Date.now(), 'próxima revisão no futuro');

  const old = new Date(Date.now() - 10 * 86_400_000).toISOString();
  const weak = { ...c, confidence: 10, lastSeen: old, lastProduced: old, lastReviewed: old };
  const mWeak = memoryStrength(weak);
  assert(mWeak.retrievability < 50, 'frase fraca + antiga tem baixa retrievability');
}
