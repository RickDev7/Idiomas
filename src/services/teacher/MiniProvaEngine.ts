/**
 * Mini Prova — fila de questões a partir do Learning State real.
 */
import type { Phrase } from '@/types';
import type { PhraseConfidence, UserLearningProfile } from '@/services/learning/ConfidenceService';
import {
  L0_CHUNK_GRAPH,
  isZeroLanguagePhraseAccepted,
  mergeZeroLanguagePhrases,
  zeroLanguageSeedPhrases,
} from '@/services/teacher/ZeroLanguageMode';
import { buildWeakPhraseIds } from '@/services/teacher/SimulatorEngine';
import type { MiniProvaQuestion, MiniProvaQuestionType } from '@/services/teacher/MiniProvaTypes';

const TYPE_ROTATION: MiniProvaQuestionType[] = [
  'production',
  'comprehension',
  'variation',
  'chunk',
  'dialogue',
  'construction',
  'autonomous',
];

function phrasePool(phrases: Phrase[]): Map<string, Phrase> {
  return new Map(mergeZeroLanguagePhrases(phrases).map((p) => [p.id, p]));
}

function germanForId(id: string, pool: Map<string, Phrase>): string {
  return pool.get(id)?.german || zeroLanguageSeedPhrases().find((p) => p.id === id)?.german || id;
}

function isStudied(conf: PhraseConfidence | undefined): boolean {
  if (!conf) return false;
  return isZeroLanguagePhraseAccepted(conf) || (conf.timesCorrect ?? 0) > 0;
}

function promptForType(type: MiniProvaQuestionType, german: string): string {
  switch (type) {
    case 'comprehension':
      return `Verstehe und antworte: ${german}`;
    case 'production':
      return german.includes('?') ? german : `Sag: ${german}`;
    case 'variation':
      return `Benutze die Struktur in einer neuen Situation: ${german.replace(/\?$/u, '')}...`;
    case 'construction':
      return `Bilde einen Satz mit: ${german}`;
    case 'chunk':
      return `Produziere den Chunk: ${german}`;
    case 'dialogue':
      return `Setze das Gespräch fort: ${german}`;
    case 'autonomous':
      return german.includes('?') ? german : `Was sagst du? (${german})`;
    default:
      return german;
  }
}

function priorityScore(id: string, conf: PhraseConfidence | undefined, weakSet: Set<string>): number {
  let score = 10;
  if (weakSet.has(id)) score += 40;
  if (conf?.needsHelp) score += 25;
  if ((conf?.confidence ?? 0) < 40) score += 20;
  if (conf?.timesProduced && conf.timesCorrect / conf.timesProduced < 0.6) score += 15;
  if (isZeroLanguagePhraseAccepted(conf)) score += 5;
  return score;
}

export function buildMiniProvaQuestions(
  learning: UserLearningProfile,
  phrases: Phrase[],
  limit = 20,
): MiniProvaQuestion[] {
  const pool = phrasePool(phrases);
  const weakIds = new Set(buildWeakPhraseIds(learning));
  const candidates: Array<{ id: string; conf: PhraseConfidence; priority: number }> = [];

  for (const [baseId, node] of Object.entries(L0_CHUNK_GRAPH)) {
    const ids = [baseId, ...node.simpleVars, ...node.questions];
    for (const id of ids) {
      const conf = learning.phrases[id];
      if (!isStudied(conf)) continue;
      candidates.push({ id, conf: conf!, priority: priorityScore(id, conf, weakIds) });
    }
  }

  candidates.sort((a, b) => b.priority - a.priority);

  const weakCount = Math.max(1, Math.floor(limit * 0.35));
  const weakPicks = candidates.filter((c) => weakIds.has(c.id)).slice(0, weakCount);
  const weakIdSet = new Set(weakPicks.map((c) => c.id));
  const rest = candidates.filter((c) => !weakIdSet.has(c.id));
  const ordered = [...weakPicks, ...rest].slice(0, limit);

  return ordered.map((c, i) => {
    const german = germanForId(c.id, pool);
    const type = TYPE_ROTATION[i % TYPE_ROTATION.length];
    return {
      phraseId: c.id,
      german,
      type,
      promptDe: promptForType(type, german),
      priority: c.priority,
      weak: weakIds.has(c.id),
    };
  });
}

export function buildMiniProvaContext(
  learning: UserLearningProfile,
  phrases: Phrase[],
): import('@/services/teacher/MiniProvaTypes').MiniProvaContext | null {
  const questions = buildMiniProvaQuestions(learning, phrases);
  if (questions.length < 3) return null;
  return {
    id: `miniprova-${Date.now()}`,
    questions,
    startedAt: new Date().toISOString(),
  };
}

export function evaluateMiniProvaResponse(
  userSaid: string,
  question: MiniProvaQuestion,
  opts: { usedHelp: boolean; attempt: number },
): import('@/services/teacher/MiniProvaTypes').MiniProvaAutonomyLevel {
  const said = userSaid.trim().toLowerCase();
  if (!said) return 'no_response';

  const target = question.german.toLowerCase().replace(/\.\.\./g, '').trim();
  const keywords = target.split(/\s+/).filter((w) => w.length > 3);
  const hitCount = keywords.filter((k) => said.includes(k)).length;
  const correct = hitCount >= Math.max(1, Math.ceil(keywords.length * 0.4));

  if (!correct) return 'incorrect';
  if (opts.usedHelp) return 'correct_after_hint';
  if (opts.attempt > 1) return 'correct_after_repeat';
  return 'correct_no_help';
}
