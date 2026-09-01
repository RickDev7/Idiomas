/**
 * Mini Prova — fila de questões a partir do Learning State real.
 * Avaliação objetiva com transferência — não decoração de frases.
 */
import type { Phrase } from '@/types';
import type { PhraseConfidence, UserLearningProfile } from '@/services/learning/ConfidenceService';
import {
  L0_CHUNK_GRAPH,
  isZeroLanguagePhraseAccepted,
  l0ChunkBaseForPhraseId,
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

/** Cenários de transferência por chunk base — testa estrutura, não frase decorada. */
const TRANSFER_BY_BASE: Record<string, string[]> = {
  'l0-hook-ich-moechte': [
    'Du bist im Restaurant. Was möchtest du trinken?',
    'Du bist im Supermarkt. Was möchtest du kaufen?',
    'Was möchtest du heute essen?',
  ],
  'survival-arbeite': [
    'Wo arbeitest du?',
    'Was arbeitest du?',
    'Arbeitest du morgens oder abends?',
  ],
  'l0-hook-ich-brauche': [
    'Was brauchst du heute?',
    'Du bist im Laden. Was brauchst du?',
  ],
  'l0-hook-ich-muss': [
    'Was musst du heute machen?',
    'Wann musst du arbeiten?',
  ],
  'l0-hook-kannst-du': [
    'Kannst du mir helfen?',
    'Du hast ein Problem. Was sagst du?',
  ],
  'l0-ich-wohne': [
    'Wo wohnst du?',
    'Wie ist deine Wohnung?',
  ],
  'l0-ich-heisse': [
    'Wie heißt du?',
    'Stell dich vor.',
  ],
  'l0-ich-komme': [
    'Woher kommst du?',
  ],
  'l0-ich-bin': [
    'Wie geht es dir?',
    'Wie fühlst du dich heute?',
  ],
};

const STRUCTURE_KEYWORDS: Record<string, string[]> = {
  'l0-hook-ich-moechte': ['möcht', 'möchte'],
  'survival-arbeite': ['arbeit'],
  'l0-hook-ich-brauche': ['brauch'],
  'l0-hook-ich-muss': ['muss'],
  'l0-hook-kannst-du': ['kannst', 'helfen'],
  'l0-ich-wohne': ['wohn'],
  'l0-ich-heisse': ['heiß'],
  'l0-ich-komme': ['komm'],
  'l0-ich-bin': ['bin', 'geht'],
};

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

function isMastered(conf: PhraseConfidence | undefined): boolean {
  return isZeroLanguagePhraseAccepted(conf) || (conf?.confidence ?? 0) >= 70;
}

function transferPrompt(phraseId: string, german: string, type: MiniProvaQuestionType, index: number): string {
  const base = l0ChunkBaseForPhraseId(phraseId) || phraseId;
  const transfers = TRANSFER_BY_BASE[base];
  if (transfers?.length && (type === 'variation' || type === 'dialogue' || type === 'comprehension' || type === 'autonomous')) {
    return transfers[index % transfers.length];
  }
  if (german.includes('?')) return german;
  switch (type) {
    case 'comprehension':
      return german;
    case 'production':
      return german.endsWith('?') ? german : `Antworte: ${german}`;
    case 'variation':
    case 'dialogue':
    case 'autonomous':
      return german;
    case 'construction':
      return `Bilde einen Satz: ${german.replace(/\?$/u, '')}`;
    case 'chunk':
      return german;
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

function structureKeywordsFor(phraseId: string, german: string): string[] {
  const base = l0ChunkBaseForPhraseId(phraseId) || phraseId;
  if (STRUCTURE_KEYWORDS[base]) return STRUCTURE_KEYWORDS[base];
  return german.toLowerCase().split(/\s+/).filter((w) => w.length > 4);
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

  const weakPicks = candidates.filter((c) => weakIds.has(c.id));
  const masteredPicks = candidates.filter((c) => isMastered(c.conf) && !weakIds.has(c.id));
  const midPicks = candidates.filter((c) => !weakIds.has(c.id) && !isMastered(c.conf));

  const weakCount = Math.max(2, Math.floor(limit * 0.25));
  const masteredCount = Math.max(2, Math.floor(limit * 0.3));
  const midCount = Math.max(1, limit - weakCount - masteredCount);

  const ordered = [
    ...weakPicks.sort((a, b) => b.priority - a.priority).slice(0, weakCount),
    ...masteredPicks.sort((a, b) => b.conf.confidence - a.conf.confidence).slice(0, masteredCount),
    ...midPicks.sort((a, b) => b.priority - a.priority).slice(0, midCount),
  ].slice(0, limit);

  return ordered.map((c, i) => {
    const german = germanForId(c.id, pool);
    const type = TYPE_ROTATION[i % TYPE_ROTATION.length];
    return {
      phraseId: c.id,
      german,
      type,
      promptDe: transferPrompt(c.id, german, type, i),
      priority: c.priority,
      weak: weakIds.has(c.id),
      expectedKeywords: structureKeywordsFor(c.id, german),
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

const NOT_KNOWN_RE = /weiß (ich )?nicht|keine ahnung|ich habe keine|weiß nicht/i;

export function evaluateMiniProvaResponse(
  userSaid: string,
  question: MiniProvaQuestion,
  opts: { usedHelp: boolean; attempt: number },
): import('@/services/teacher/MiniProvaTypes').MiniProvaAutonomyLevel {
  const said = userSaid.trim().toLowerCase();
  if (!said) return 'no_response';
  if (NOT_KNOWN_RE.test(said)) return 'incorrect';

  const keywords = question.expectedKeywords?.length
    ? question.expectedKeywords
    : structureKeywordsFor(question.phraseId, question.german);
  const hitCount = keywords.filter((k) => said.includes(k.toLowerCase())).length;
  const correct = hitCount >= Math.max(1, Math.ceil(keywords.length * 0.5));

  if (!correct) return 'incorrect';
  if (opts.usedHelp) return 'correct_after_hint';
  if (opts.attempt > 1) return 'correct_after_repeat';
  return 'correct_no_help';
}
