/* ErrorPatternDetector — padrões recorrentes (não erros isolados). Fase 9. */

import type { LearningEvent } from '@/services/learning/EventStore';
import type { ErrorPatternEntry } from '@/services/learning/PersonalLearningProfile';

export type ErrorPatternId =
  | 'verb_conjugation'
  | 'article_usage'
  | 'word_order'
  | 'preposition'
  | 'pronunciation_approx'
  | 'other';

const MIN_COUNT = 3;

export function classifyUtteranceError(text: string): ErrorPatternId | null {
  const t = text.trim();
  if (!t) return null;

  // "Ich arbeiten", "du arbeitest" ok; infinitivo após sujeito comum
  if (/\b(ich|du|er|sie|es|wir|ihr)\s+\w*(en|eln|ern)\b/i.test(t) && !/\b(ich|du|er|sie|es|wir|ihr)\s+(bin|bist|ist|sind|seid|habe|hast|hat|haben|hab|will|kann|muss|möchte)\b/i.test(t)) {
    if (/\bich\s+\w+en\b/i.test(t) || /\bdu\s+\w+en\b/i.test(t) || /\ber\s+\w+en\b/i.test(t)) {
      return 'verb_conjugation';
    }
  }
  if (/\b(ein|eine|der|die|das|den|dem)\s+\w+/i.test(t) === false && /\b(ich brauche|ich habe|ich sehe)\s+[a-zäöüß]+/i.test(t)) {
    // sem artigo onde costuma haver — fraco; só se padrão claro
  }
  if (/\b(zu|nach|mit|von|für|bei)\s+(der|die|das|den|dem)\b/i.test(t) && /\b(zu der|mit dem)\b/i.test(t)) {
    return 'preposition';
  }
  if (/\bweil\s+\w+\s+(ich|du|er)\b/i.test(t)) {
    return 'word_order';
  }
  return null;
}

export function detectErrorPatterns(
  events: LearningEvent[],
  recurringMistakeIds: string[] = [],
): ErrorPatternEntry[] {
  const buckets = new Map<string, { count: number; lastSeen: string; contexts: string[] }>();

  for (const e of events) {
    if (e.type !== 'PHRASE_FAILED' && e.type !== 'UNCLASSIFIED_USER_UTTERANCE' && e.type !== 'USER_UTTERANCE') {
      continue;
    }
    const text = e.context || '';
    const pattern = classifyUtteranceError(text);
    if (!pattern) continue;
    const cur = buckets.get(pattern) || { count: 0, lastSeen: e.timestamp, contexts: [] };
    cur.count += 1;
    cur.lastSeen = e.timestamp;
    if (text && cur.contexts.length < 6) cur.contexts.push(text.slice(0, 80));
    buckets.set(pattern, cur);
  }

  // Mistakes IndexedDB recorrentes → outros
  for (const id of recurringMistakeIds) {
    if (/arbeit|verb|conjug/i.test(id)) {
      const cur = buckets.get('verb_conjugation') || { count: 0, lastSeen: new Date().toISOString(), contexts: [] };
      cur.count += 2;
      buckets.set('verb_conjugation', cur);
    }
  }

  const out: ErrorPatternEntry[] = [];
  for (const [pattern, data] of buckets) {
    if (data.count < MIN_COUNT) continue;
    out.push({
      pattern,
      count: data.count,
      lastSeen: data.lastSeen,
      confidence: clamp01(0.4 + Math.min(0.5, (data.count - MIN_COUNT) * 0.08)),
      contexts: data.contexts,
    });
  }

  return out.sort((a, b) => b.count - a.count || b.confidence - a.confidence);
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}
