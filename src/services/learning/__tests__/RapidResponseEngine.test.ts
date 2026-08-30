import { targetMsForLevel, evaluateRapid } from '@/services/learning/RapidResponseEngine';
import type { Phrase } from '@/types';
import { assert } from './assert';

export function testRapidResponseEngine() {
  assert(targetMsForLevel('zero', 30) === 8000, 'zero + baixa confidence = 8s');
  assert(targetMsForLevel('zero', 70) === 5000, 'zero + alta confidence = 5s');
  assert(targetMsForLevel('basic', 80) === 2000, 'basic + alta = 2s');

  const phrase: Phrase = {
    id: 'p1', german: 'Ich arbeite heute.', portuguese: 'Trabalho hoje.', category: 'work',
    mastery: 'recognize', reviewStage: 'learning', nextReview: null, timesReviewed: 0, timesCorrect: 0, timesIncorrect: 0, isAutomatic: false, contexts: [],
  };
  const r1 = evaluateRapid('ich arbeite heute', phrase, 2000, 5000);
  assert(r1.correct && r1.withinTarget, 'acerto rápido');

  const r2 = evaluateRapid('ich arbeite', phrase, 6000, 5000);
  assert(r2.correct && !r2.withinTarget, 'acerto lento');

  const r3 = evaluateRapid('xxx', phrase, 1000, 5000);
  assert(!r3.correct, 'erro não conta como acerto');
}
