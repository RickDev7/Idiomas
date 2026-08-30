import { optimizeDifficulty } from '@/services/optimizer/DifficultyOptimizer';
import { assert } from '../../learning/__tests__/assert';

export function testDifficultyOptimizer() {
  const frustrated = optimizeDifficulty('FRUSTRATED', 'zero', 0.3);
  assert(frustrated.speed === 'slow', 'frustrado -> lento');
  assert(frustrated.supportLevel === 3, 'frustrado -> suporte máximo');
  assert(frustrated.phraseLength <= 3, 'frustrado -> frases curtas');

  const automatic = optimizeDifficulty('AUTOMATIC', 'basic', 0.95);
  assert(automatic.speed === 'natural', 'automático -> natural');
  assert(automatic.supportLevel === 0, 'automático -> sem suporte');
  assert(automatic.phraseLength > 7, 'automático -> frases longas');

  const bored = optimizeDifficulty('BORED', 'little', 0.95);
  assert(bored.contextVariation > 0.7, 'entediado -> muita variação de contexto');

  const comfortable = optimizeDifficulty('COMFORTABLE', 'little', 0.8);
  assert(comfortable.supportLevel === 1, 'confortável -> suporte médio');
}
