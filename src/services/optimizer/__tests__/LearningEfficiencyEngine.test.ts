import { computeEfficiency } from '@/services/optimizer/LearningEfficiencyEngine';
import { assert } from '../../learning/__tests__/assert';

export function testLearningEfficiencyEngine() {
  const high = computeEfficiency({ gain: 30, minutes: 10, retention: 0.9, helpUsed: 1, transfer: 0.5, spontaneous: 0.3, errors: 1 });
  assert(high.score > 0.6, 'ganho alto + boa retenção = score alto');
  assert(high.gainPerMinute === 3, 'gainPerMinute calculado');

  const low = computeEfficiency({ gain: 5, minutes: 15, retention: 0.4, helpUsed: 5, transfer: 0, spontaneous: 0, errors: 4 });
  assert(low.score < 0.4, 'ganho baixo + muita ajuda = score baixo');
  assert(low.label === 'baixo', 'label baixo');

  assert(high.label === 'excelente' || high.label === 'bom', 'label alto para bom resultado');
}
