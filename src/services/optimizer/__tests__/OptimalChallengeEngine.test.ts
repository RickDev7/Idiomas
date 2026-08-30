import { optimalChallenge } from '@/services/optimizer/OptimalChallengeEngine';
import { assert } from '../../learning/__tests__/assert';

export function testOptimalChallengeEngine() {
  const frustrated = optimalChallenge('FRUSTRATED', 0.3);
  assert(frustrated.targetSuccessRate === 0.85, 'frustrado -> meta 85%');

  const bored = optimalChallenge('BORED', 0.95);
  assert(bored.targetSuccessRate === 0.7, 'entediado -> meta 70% (mais difícil)');

  const struggling = optimalChallenge('LEARNING', 0.45);
  assert(struggling.targetSuccessRate === 0.8, 'lutando -> meta 80%');

  const balanced = optimalChallenge('COMFORTABLE', 0.75);
  assert(balanced.targetSuccessRate === 0.75, 'equilibrado -> 75%');
}
