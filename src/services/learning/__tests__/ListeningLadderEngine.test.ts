import { recommendLevel, advanceLevel, listeningConfigFor } from '@/services/learning/ListeningLadderEngine';
import { assert } from './assert';

export function testListeningLadderEngine() {
  assert(recommendLevel(10) === 1, 'score 10 -> L1');
  assert(recommendLevel(30) === 2, 'score 30 -> L2');
  assert(recommendLevel(55) === 4, 'score 55 -> L4');
  assert(recommendLevel(95) === 9, 'score 95 -> L9');

  assert(advanceLevel(3, true) === 4, 'sucesso sobe');
  assert(advanceLevel(3, false) === 2, 'falha desce');
  assert(advanceLevel(9, true) === 9, 'máximo não ultrapassa');
  assert(advanceLevel(1, false) === 1, 'mínimo não desce');

  const l1 = listeningConfigFor(1);
  assert(l1.speed === 'slow' && l1.showText && l1.showTranslation, 'L1 lento + texto + tradução');
  const l9 = listeningConfigFor(9);
  assert(l9.speed === 'natural' && !l9.showText && l9.noisy, 'L9 natural sem texto com ruído');
}
