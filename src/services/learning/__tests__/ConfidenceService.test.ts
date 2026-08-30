import { emptyConfidence, updateConfidence, stateIndex, canProduce, isMastered } from '@/services/learning/ConfidenceService';
import { assert } from './assert';

export function testConfidenceService() {
  let c = emptyConfidence('p1');
  assert(c.state === 'new', 'novo começa em new');
  assert(c.confidence === 0, 'confidence inicial 0');

  c = updateConfidence(c, { type: 'heard', correct: true });
  assert(c.state === 'heard', 'ouvir avança para heard');
  assert(c.listening > 0, 'listening subiu');

  c = updateConfidence(c, { type: 'repeated', correct: true });
  assert(stateIndex(c.state) >= stateIndex('repeated'), 'repetir avança');

  c = updateConfidence(c, { type: 'produced', correct: true, responseMs: 4000 });
  assert(c.timesProduced === 1, 'produção registrada');
  assert(canProduce(c), 'pode produzir após acerto');

  c = updateConfidence(c, { type: 'fast', correct: true, responseMs: 2000 });
  assert(c.speed > 0, 'speed subiu com resposta rápida');

  c = updateConfidence(c, { type: 'help', correct: false });
  assert(c.needsHelp === true, 'pedir ajuda marca needsHelp');

  c = updateConfidence(c, { type: 'transfer', correct: true });
  assert(c.contextTransfer > 0, 'transferência registrada');

  c = updateConfidence(c, { type: 'spontaneous', correct: true });
  assert(stateIndex(c.state) >= stateIndex('spontaneous'), 'uso espontâneo avança estado');

  const mastered = { ...c, confidence: 95, state: 'usedInContext' as const, contextTransfer: 55 };
  const updated = updateConfidence(mastered, { type: 'produced', correct: true, responseMs: 1500 });
  assert(isMastered(updated) || updated.state === 'automatic', 'alta confiança + transferência leva a automatic');
}
