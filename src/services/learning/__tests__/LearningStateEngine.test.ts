import { inferLearningState } from '@/services/learning/LearningStateEngine';
import type { LearningEvent } from '@/services/learning/EventStore';
import { assert } from './assert';

export function testLearningStateEngine() {
  const base: LearningEvent[] = [];
  for (let i = 0; i < 15; i++) base.push({ id: `e${i}`, type: 'PHRASE_PRODUCED', timestamp: new Date().toISOString(), responseTimeMs: 3000 });
  const snap = inferLearningState(base);
  assert(['COMFORTABLE', 'MASTERING', 'LEARNING'].includes(snap.state), 'muitos acertos -> estado confortável+');

  const frustrated: LearningEvent[] = [];
  for (let i = 0; i < 12; i++) frustrated.push({ id: `f${i}`, type: 'PHRASE_FAILED', timestamp: new Date().toISOString() });
  for (let i = 0; i < 6; i++) frustrated.push({ id: `h${i}`, type: 'HELP_REQUESTED', timestamp: new Date().toISOString() });
  const snap2 = inferLearningState(frustrated);
  assert(snap2.state === 'FRUSTRATED', 'muitas falhas + ajuda -> FRUSTRATED');

  const bored: LearningEvent[] = [];
  for (let i = 0; i < 18; i++) bored.push({ id: `b${i}`, type: 'PHRASE_PRODUCED', timestamp: new Date().toISOString(), responseTimeMs: 6000 });
  const snap3 = inferLearningState(bored);
  assert(snap3.state === 'BORED' || snap3.state === 'COMFORTABLE', 'acertos lentos -> BORED/COMFORTABLE');

  const automatic: LearningEvent[] = [];
  for (let i = 0; i < 20; i++) automatic.push({ id: `a${i}`, type: 'RAPID_RESPONSE_SUCCESS', timestamp: new Date().toISOString(), responseTimeMs: 1800 });
  const snap4 = inferLearningState(automatic);
  assert(snap4.state === 'AUTOMATIC', 'respostas rápidas -> AUTOMATIC');
}
