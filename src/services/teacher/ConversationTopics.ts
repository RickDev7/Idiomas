/**
 * Temas dinâmicos da tela Conversar — atalhos para contextos pedagógicos reais.
 */
import type { Phrase } from '@/types';
import type { PhraseConfidence, UserLearningProfile } from '@/services/learning/ConfidenceService';
import {
  L0_CHUNK_GRAPH,
  isL0ChunkMature,
  isZeroLanguagePhraseAccepted,
  l0IsQuestionNodeId,
  l0IsSimpleVariationId,
  mergeZeroLanguagePhrases,
  zeroLanguageSeedPhrases,
} from '@/services/teacher/ZeroLanguageMode';

export type ConversationPedagogicalContext = {
  id: string;
  topic: string;
  chunk?: string;
  knownStructures: string[];
  knownVocabulary: string[];
  recentTargets: string[];
  recentVariations: string[];
  difficulty: string;
  reason: string;
  /** Mapeamento interno L0 — não expor na UI */
  baseId?: string;
};

/** @deprecated alias — use ConversationPedagogicalContext */
export type ConversationTopicContext = ConversationPedagogicalContext & {
  topicId?: string;
};

export type ConversationTopic = {
  id: string;
  chunk: string;
  label: string;
  subtitle: string;
  emoji: string;
  topic: string;
  vocabulary: string[];
  learnedStructures: string[];
  recentTargets: string[];
  recentVariations: string[];
  difficulty: string;
  priority: number;
  reason: string;
  baseId: string;
};

const MAX_TOPICS = 6;
const LAST_SHOWN_KEY = 'dt_conversation_topics_shown';

type ChunkMeta = {
  topic: string;
  subtitle: string;
  topicPt: string;
  emoji: string;
  keywords: RegExp[];
};

const CHUNK_META: Record<string, ChunkMeta> = {
  'survival-arbeite': {
    topic: 'work', subtitle: 'Arbeit', topicPt: 'trabalho', emoji: '💼',
    keywords: [/arbeit/i, /arbeitest/i, /büro/i],
  },
  'l0-hook-ich-moechte': {
    topic: 'food', subtitle: 'Essen & Trinken', topicPt: 'comida e bebida', emoji: '🍽',
    keywords: [/möchte/i, /möchtest/i, /essen/i, /trinken/i, /pizza/i, /wasser/i],
  },
  'l0-hook-ich-brauche': {
    topic: 'needs', subtitle: 'Necessidades', topicPt: 'necessidades', emoji: '🛒',
    keywords: [/brauch/i, /hilfe/i, /wasser/i],
  },
  'l0-hook-ich-muss': {
    topic: 'routine', subtitle: 'Rotina', topicPt: 'rotina e obrigações', emoji: '⏰',
    keywords: [/muss/i, /musst/i, /gehen/i, /arbeiten/i],
  },
  'l0-hook-kannst-du': {
    topic: 'requests', subtitle: 'Pedidos', topicPt: 'pedidos e ajuda', emoji: '🙋',
    keywords: [/kannst/i, /helfen/i, /bitte/i],
  },
  'l0-ich-wohne': {
    topic: 'places', subtitle: 'Casa & Lugares', topicPt: 'casa e lugares', emoji: '🏠',
    keywords: [/wohn/i, /haus/i, /wo\b/i],
  },
  'l0-ich-komme': {
    topic: 'origin', subtitle: 'Origem', topicPt: 'origem e nacionalidade', emoji: '🌍',
    keywords: [/komm/i, /aus\b/i],
  },
  'l0-ich-heisse': {
    topic: 'identity', subtitle: 'Apresentação', topicPt: 'apresentação', emoji: '👋',
    keywords: [/heiß/i, /name/i],
  },
  'l0-ich-bin': {
    topic: 'identity', subtitle: 'Apresentação', topicPt: 'apresentação', emoji: '👋',
    keywords: [/ich bin/i],
  },
  'l0-hilfe': {
    topic: 'help', subtitle: 'Ajuda', topicPt: 'pedir ajuda', emoji: '🆘',
    keywords: [/hilfe/i, /brauch/i],
  },
};

const SKIP_VOCAB = new Set([
  'Ich', 'Du', 'Sie', 'Wo', 'Was', 'Wann', 'Wie', 'Kannst', 'Kann', 'Der', 'Die', 'Das',
  'Ein', 'Eine', 'Und', 'Oder', 'Aber', 'Heute', 'Morgen', 'Morgens', 'Abends', 'Pause',
]);

const TOPIC_KEYWORDS: Record<string, RegExp[]> = Object.fromEntries(
  Object.values(CHUNK_META).map((m) => [m.topic, m.keywords]),
);

function phrasePool(phrases: Phrase[]): Map<string, Phrase> {
  return new Map(mergeZeroLanguagePhrases(phrases).map((p) => [p.id, p]));
}

function germanForId(id: string, pool: Map<string, Phrase>): string | null {
  return pool.get(id)?.german || zeroLanguageSeedPhrases().find((p) => p.id === id)?.german || null;
}

function isStudied(conf: PhraseConfidence | undefined): boolean {
  if (!conf) return false;
  if (isZeroLanguagePhraseAccepted(conf)) return true;
  return (conf.timesCorrect ?? 0) > 0 || (conf.confidence ?? 0) >= 25;
}

function phraseIdsForBase(baseId: string): string[] {
  const node = L0_CHUNK_GRAPH[baseId];
  if (!node) return [baseId];
  return [baseId, ...node.simpleVars, ...node.questions];
}

function pushUnique(list: string[], value: string) {
  const v = value.trim();
  if (!v || list.includes(v)) return;
  list.push(v);
}

function extractVocabulary(structures: string[]): string[] {
  const vocab = new Set<string>();
  for (const phrase of structures) {
    const matches = phrase.match(/\b[A-ZÄÖÜ][a-zäöüß]+/g) || [];
    for (const word of matches) {
      if (!SKIP_VOCAB.has(word)) vocab.add(word);
    }
    const lower = phrase.toLowerCase();
    if (lower.includes('essen')) vocab.add('essen');
    if (lower.includes('trinken')) vocab.add('trinken');
  }
  return [...vocab].slice(0, 20);
}

/** Expansões naturais só quando partes já foram estudadas separadamente. */
function deriveComposedStructures(
  structures: string[],
  vocabulary: string[],
  topic: string,
): string[] {
  const out = [...structures];
  if (topic === 'food') {
    const hasQ = structures.some((s) => /Was möchtest du/i.test(s));
    const hasEssen = structures.some((s) => /essen/i.test(s))
      || vocabulary.some((v) => /Pizza|essen/i.test(v));
    const hasTrinken = structures.some((s) => /trinken/i.test(s))
      || vocabulary.some((v) => /Wasser|Kaffee|trinken/i.test(v));
    if (hasQ && hasEssen) pushUnique(out, 'Was möchtest du essen?');
    if (hasQ && hasTrinken) pushUnique(out, 'Was möchtest du trinken?');
  }
  return out;
}

function chunkLabel(baseId: string, pool: Map<string, Phrase>): string {
  const g = germanForId(baseId, pool);
  if (!g) return baseId;
  if (g.endsWith('...')) return g;
  if (g.endsWith('?')) return g.replace(/\?$/, '...?');
  const hook = g.split(/\s+/).slice(0, 2).join(' ');
  return hook.length < g.length ? `${hook}...` : g;
}

function inferDifficulty(
  learning: UserLearningProfile,
  baseId: string,
  studiedIds: string[],
): string {
  if (isL0ChunkMature(learning, baseId)) return 'production';
  const avgConf = studiedIds.reduce((sum, id) => sum + (learning.phrases[id]?.confidence ?? 0), 0)
    / Math.max(1, studiedIds.length);
  if (avgConf >= 60) return 'guided';
  if (avgConf >= 35) return 'developing';
  return 'intro';
}

function recentTargetsForChunk(
  studiedIds: string[],
  learning: UserLearningProfile,
  pool: Map<string, Phrase>,
): string[] {
  return studiedIds
    .map((id) => ({
      german: germanForId(id, pool),
      at: Date.parse(learning.phrases[id]?.lastProduced || '') || 0,
    }))
    .filter((x): x is { german: string; at: number } => !!x.german)
    .sort((a, b) => b.at - a.at)
    .map((x) => x.german)
    .slice(0, 6);
}

function recentVariationsForChunk(studiedIds: string[]): string[] {
  return studiedIds
    .filter((id) => l0IsSimpleVariationId(id) || l0IsQuestionNodeId(id))
    .map((id) => id)
    .slice(0, 8)
    .map((id) => {
      const g = zeroLanguageSeedPhrases().find((p) => p.id === id)?.german;
      return g || id;
    });
}

function computePriority(
  learning: UserLearningProfile,
  baseId: string,
  studiedIds: string[],
  lastShown: string[],
): { priority: number; reason: string } {
  if (!studiedIds.length) return { priority: 0, reason: 'not_studied' };

  let priority = 0.2;
  const reasons: string[] = ['studied'];

  priority += Math.min(0.3, studiedIds.length * 0.06);

  if (isL0ChunkMature(learning, baseId)) {
    priority += 0.15;
    reasons.push('chunk_mature');
  }

  const lastProduced = studiedIds
    .map((id) => Date.parse(learning.phrases[id]?.lastProduced || '') || 0)
    .reduce((a, b) => Math.max(a, b), 0);
  if (lastProduced > 0) {
    const days = (Date.now() - lastProduced) / 86_400_000;
    priority += Math.max(0, 0.28 - days * 0.04);
    if (days < 2) reasons.push('recent');
  }

  const needsReview = studiedIds.some((id) => {
    const c = learning.phrases[id];
    return c && c.confidence > 0 && c.confidence < 40;
  });
  if (needsReview) {
    priority += 0.08;
    reasons.push('needs_review');
  }

  const meta = CHUNK_META[baseId];
  if (meta) {
    const shownIdx = lastShown.indexOf(meta.topic);
    if (shownIdx >= 0) {
      priority -= 0.12 + shownIdx * 0.04;
      reasons.push('diversity_rotate');
    }
  }

  return { priority: Math.min(0.99, Math.max(0.05, priority)), reason: reasons.join('+') };
}

function buildTopicForBase(
  baseId: string,
  learning: UserLearningProfile,
  pool: Map<string, Phrase>,
  lastShown: string[],
): ConversationTopic | null {
  const ids = phraseIdsForBase(baseId);
  const studiedIds = ids.filter((id) => isStudied(learning.phrases[id]));
  if (!studiedIds.length) return null;

  const learnedStructures = studiedIds
    .map((id) => germanForId(id, pool))
    .filter((g): g is string => !!g);

  const meta = CHUNK_META[baseId] || {
    topic: baseId,
    subtitle: pool.get(baseId)?.portuguese?.split(/[.,]/)[0] || 'Conversa',
    topicPt: 'conversa',
    emoji: '💬',
    keywords: [],
  };

  const vocabulary = extractVocabulary(learnedStructures);
  const structures = deriveComposedStructures(learnedStructures, vocabulary, meta.topic);
  const { priority, reason } = computePriority(learning, baseId, studiedIds, lastShown);
  const label = chunkLabel(baseId, pool);

  return {
    id: meta.topic,
    baseId,
    chunk: label,
    label,
    subtitle: meta.subtitle,
    emoji: meta.emoji,
    topic: meta.topic,
    vocabulary,
    learnedStructures: structures,
    recentTargets: recentTargetsForChunk(studiedIds, learning, pool),
    recentVariations: recentVariationsForChunk(studiedIds),
    difficulty: inferDifficulty(learning, baseId, studiedIds),
    priority,
    reason,
  };
}

/** Histórico de temas exibidos — diversifica chips entre visitas. */
export function readLastShownConversationTopics(): string[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LAST_SHOWN_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((t) => typeof t === 'string') : [];
  } catch {
    return [];
  }
}

export function recordConversationTopicsShown(topics: string[]): void {
  if (typeof localStorage === 'undefined' || !topics.length) return;
  try {
    const prev = readLastShownConversationTopics();
    const merged = [...topics, ...prev.filter((t) => !topics.includes(t))].slice(0, 12);
    localStorage.setItem(LAST_SHOWN_KEY, JSON.stringify(merged));
  } catch {
    /* ignore */
  }
}

function applyDiversityRotation(topics: ConversationTopic[], lastShown: string[]): ConversationTopic[] {
  if (topics.length < 2 || !lastShown.length) return topics;
  const last = lastShown[0];
  if (topics[0]?.topic === last) {
    const altIdx = topics.findIndex((t, i) => i > 0 && t.topic !== last);
    if (altIdx > 0) {
      const rotated = [...topics];
      [rotated[0], rotated[altIdx]] = [rotated[altIdx], rotated[0]];
      return rotated;
    }
  }
  return topics;
}

/** Máximo 6 atalhos — só conteúdo estudado, sem preenchimento artificial. */
export function getConversationTopics(
  learning: UserLearningProfile,
  phrases: Phrase[],
  opts?: { lastShownTopics?: string[] },
): ConversationTopic[] {
  const pool = phrasePool(phrases);
  const lastShown = opts?.lastShownTopics ?? readLastShownConversationTopics();
  const topics: ConversationTopic[] = [];

  for (const baseId of Object.keys(L0_CHUNK_GRAPH)) {
    const topic = buildTopicForBase(baseId, learning, pool, lastShown);
    if (topic) topics.push(topic);
  }

  topics.sort((a, b) => b.priority - a.priority);

  const seen = new Set<string>();
  const deduped: ConversationTopic[] = [];
  for (const t of topics) {
    if (seen.has(t.topic)) continue;
    seen.add(t.topic);
    deduped.push(t);
    if (deduped.length >= MAX_TOPICS) break;
  }

  return applyDiversityRotation(deduped, lastShown);
}

export function toConversationContext(topic: ConversationTopic): ConversationPedagogicalContext {
  return {
    id: topic.id,
    topic: topic.topic,
    chunk: topic.chunk,
    knownStructures: [...topic.learnedStructures],
    knownVocabulary: [...topic.vocabulary],
    recentTargets: [...topic.recentTargets],
    recentVariations: [...topic.recentVariations],
    difficulty: topic.difficulty,
    reason: topic.reason,
    baseId: topic.baseId,
  };
}

function scoreOpeningForTopic(question: string, topic: string): number {
  let score = question.length;
  const keywords = TOPIC_KEYWORDS[topic] || [];
  if (keywords.some((k) => k.test(question))) score += 80;
  if (/arbeitest/i.test(question) && topic !== 'work') score -= 100;
  if (/essen|trinken|möchte/i.test(question) && topic === 'work') score -= 50;
  return score;
}

/** Abertura no contexto escolhido — nunca troca de tema (ex: food ≠ Arbeit). */
export function pickConversationOpening(ctx: ConversationPedagogicalContext): string {
  const questions = ctx.knownStructures.filter((s) => s.includes('?'));
  if (questions.length) {
    const ranked = [...questions].sort(
      (a, b) => scoreOpeningForTopic(b, ctx.topic) - scoreOpeningForTopic(a, ctx.topic),
    );
    const best = ranked[0];
    if (scoreOpeningForTopic(best, ctx.topic) > 0) return best;
  }
  return (ctx.chunk || '').replace(/\.\.\.$/, '').trim() || ctx.chunk || '';
}

export function conversationTopicPlanLabel(topic: string): string {
  const entry = Object.values(CHUNK_META).find((m) => m.topic === topic);
  return entry?.topicPt || topic;
}

/** Instrução interna para Gemini — zona de conhecimento + variação sem loop. */
export function buildConversationTopicKickoff(
  ctx: ConversationPedagogicalContext,
  openingGerman: string,
): string {
  const variations = ctx.recentVariations.length
    ? ctx.recentVariations.slice(0, 5).join(' | ')
    : ctx.knownStructures.filter((s) => s.includes('?')).slice(1, 4).join(' | ');

  return [
    '[INSTRUÇÃO INTERNA — não leia isto em voz alta]',
    'CONVERSA GUIADA — contexto pedagógico escolhido pelo aluno.',
    `Tema ativo: ${conversationTopicPlanLabel(ctx.topic)}. Chunk de partida: "${ctx.chunk || ''}".`,
    `Dificuldade: ${ctx.difficulty}.`,
    `Comece falando em alemão com: "${openingGerman}"`,
    'Mantenha-se NO MESMO TEMA durante toda a conversa.',
    `Estruturas permitidas: ${ctx.knownStructures.slice(0, 12).join(' | ')}`,
    `Vocabulário permitido: ${ctx.knownVocabulary.slice(0, 16).join(', ')}`,
    variations ? `Variações sugeridas após respostas corretas: ${variations}` : '',
    'PROIBIDO: mudar para outro tema (ex: comida → trabalho).',
    'PROIBIDO: repetir a mesma pergunta 2x seguidas.',
    'PROIBIDO: ensinar estrutura/vocabulário fora da lista.',
    'Após cada resposta correta: nova pergunta com estrutura+vocabulário+contexto diferentes.',
    'Exemplo food: Was möchtest du essen? → Was möchtest du trinken? → Möchtest du Pizza?',
    'Palavra nova só com explicação curta em português + modelo + tentativa do aluno.',
  ].filter(Boolean).join('\n');
}

export function buildConversationCoachContext(ctx: ConversationPedagogicalContext): string {
  return [
    'CONTEXTO PEDAGÓGICO DA CONVERSA:',
    `Tema: ${conversationTopicPlanLabel(ctx.topic)}`,
    `Chunk: ${ctx.chunk || ''}`,
    `Dificuldade: ${ctx.difficulty}`,
    `Estruturas: ${ctx.knownStructures.join(' | ')}`,
    `Vocabulário: ${ctx.knownVocabulary.join(', ')}`,
    ctx.recentTargets.length ? `Alvos recentes: ${ctx.recentTargets.join(' | ')}` : '',
  ].filter(Boolean).join('\n');
}

/** Garante que abertura pertence ao tema — usado em testes. */
export function openingMatchesTopic(opening: string, topic: string): boolean {
  if (topic === 'work') return /arbeit/i.test(opening);
  if (topic === 'food') return /möcht|essen|trinken/i.test(opening);
  if (topic === 'needs') return /brauch/i.test(opening);
  if (topic === 'routine') return /muss/i.test(opening);
  if (topic === 'requests') return /kannst|helfen/i.test(opening);
  if (topic === 'places') return /wohn|wo\b/i.test(opening);
  return true;
}
