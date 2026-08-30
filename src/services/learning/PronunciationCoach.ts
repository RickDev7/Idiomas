import type { Mistake } from '@/types';

export interface PronunciationFocus {
  sound: string;
  examples: string[];
  reason: string;
}

const SOUND_PATTERNS: { sound: string; pattern: RegExp; examples: string[] }[] = [
  { sound: 'ch', pattern: /ch/i, examples: ['ich', 'nicht', 'machen', 'sprechen'] },
  { sound: 'ü', pattern: /ü/i, examples: ['über', 'müde', 'Grüße'] },
  { sound: 'ö', pattern: /ö/i, examples: ['schön', 'König', 'zwölf'] },
  { sound: 'r', pattern: /\br\b/i, examples: ['rot', 'Reise', 'drei'] },
  { sound: 'ei', pattern: /ei/i, examples: ['ein', 'mein', 'klein'] },
  { sound: 'sch', pattern: /sch/i, examples: ['Schule', 'Tisch', 'waschen'] },
];

export function detectPronunciationFocus(mistakes: Mistake[]): PronunciationFocus | null {
  const pronunciationErrors = mistakes.filter((m) => m.type === 'pronunciation' && !m.mastered);
  if (pronunciationErrors.length === 0) return null;
  for (const err of pronunciationErrors) {
    const match = SOUND_PATTERNS.find((p) => p.pattern.test(err.correct));
    if (match) {
      return { sound: match.sound, examples: match.examples, reason: `Som difícil: ${match.sound}` };
    }
  }
  return null;
}

export function buildPronunciationDrill(focus: PronunciationFocus): string[] {
  return focus.examples.slice(0, 4);
}
