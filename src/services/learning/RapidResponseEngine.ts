import type { Phrase } from '@/types';

export interface RapidResult {
  correct: boolean;
  responseMs: number;
  withinTarget: boolean;
  feedback: string;
}

export function targetMsForLevel(level: 'zero' | 'little' | 'basic', confidence: number): number {
  if (level === 'zero') return confidence < 50 ? 8000 : 5000;
  if (level === 'little') return confidence < 60 ? 5000 : 3000;
  return confidence < 70 ? 3000 : 2000;
}

export function evaluateRapid(
  transcript: string,
  phrase: Phrase,
  responseMs: number,
  targetMs: number,
): RapidResult {
  const expected = phrase.german.toLowerCase();
  const actual = transcript.toLowerCase().trim();
  const words = expected.split(/\s+/).filter(Boolean);
  const hit = words.filter((w) => actual.includes(w)).length;
  const correct = hit / Math.max(1, words.length) >= 0.6;
  const withinTarget = responseMs <= targetMs;
  let feedback: string;
  if (correct && withinTarget) feedback = 'Schnell! Sehr gut.';
  else if (correct) feedback = 'Richtig, mas mais rápido da próxima vez.';
  else feedback = `Fast! Sag: ${phrase.german}`;
  return { correct, responseMs, withinTarget, feedback };
}
