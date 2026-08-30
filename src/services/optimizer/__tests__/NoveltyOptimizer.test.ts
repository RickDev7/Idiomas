import { optimizeNovelty } from '@/services/optimizer/NoveltyOptimizer';
import { assert } from '../../learning/__tests__/assert';

export function testNoveltyOptimizer() {
  const frustrated = optimizeNovelty('FRUSTRATED', 0.3, 1);
  assert(frustrated.maxNewPerSession === 1, 'frustrado -> 1 nova');
  assert(frustrated.rate < 0.1, 'frustrado -> taxa baixa');

  const automatic = optimizeNovelty('AUTOMATIC', 0.9, 10);
  assert(automatic.maxNewPerSession >= 3, 'automático -> mais novidade');
  assert(automatic.rate > 0.15, 'automático -> taxa alta');

  const learning = optimizeNovelty('LEARNING', 0.6, 5);
  assert(learning.maxNewPerSession === 2, 'aprendendo -> 2 novas');
  assert(learning.rate === 0.1, 'aprendendo -> taxa média');
}
