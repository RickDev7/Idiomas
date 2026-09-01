/**
 * Simulador de conversa — seleção de cenário e contexto a partir do Learning State.
 */
import type { Phrase } from '@/types';
import type { PhraseConfidence, UserLearningProfile } from '@/services/learning/ConfidenceService';
import {
  L0_CHUNK_GRAPH,
  isL0ChunkMature,
  isZeroLanguagePhraseAccepted,
  l0ChunkBaseForPhraseId,
  mergeZeroLanguagePhrases,
  zeroLanguageSeedPhrases,
} from '@/services/teacher/ZeroLanguageMode';
import type {
  SimulatorContext,
  SimulatorDurationMinutes,
  SimulatorMode,
  SimulatorScenario,
  SimulatorTrainingStyle,
} from '@/services/teacher/SimulatorTypes';
import { buildImmersionSimulatorKickoff } from '@/services/teacher/ImmersionPolicy';

const SCENARIOS: SimulatorScenario[] = [
  { id: 'meet', emoji: '👋', titlePt: 'Conhecer alguém', titleDe: 'Jemanden kennenlernen', topic: 'identity', settingDe: 'Du triffst eine neue Person.', roleDe: 'Ich bin dein Gesprächspartner.' },
  { id: 'work', emoji: '💼', titlePt: 'Trabalho', titleDe: 'Arbeit', topic: 'work', settingDe: 'Ihr seid bei der Arbeit.', roleDe: 'Ich bin dein Kollege.' },
  { id: 'food', emoji: '🍽', titlePt: 'Restaurante', titleDe: 'Restaurant', topic: 'food', settingDe: 'Ihr seid im Restaurant.', roleDe: 'Ich bin der Kellner.' },
  { id: 'needs', emoji: '🛒', titlePt: 'Compras', titleDe: 'Einkaufen', topic: 'needs', settingDe: 'Ihr seid im Laden.', roleDe: 'Ich bin im Geschäft.' },
  { id: 'routine', emoji: '⏰', titlePt: 'Rotina', titleDe: 'Alltag', topic: 'routine', settingDe: 'Es ist ein normaler Tag.', roleDe: 'Ich frage nach deinem Tag.' },
  { id: 'help', emoji: '🆘', titlePt: 'Pedir ajuda', titleDe: 'Hilfe', topic: 'requests', settingDe: 'Du brauchst Hilfe.', roleDe: 'Ich kann dir helfen.' },
  { id: 'home', emoji: '🏠', titlePt: 'Casa', titleDe: 'Zuhause', topic: 'places', settingDe: 'Ihr sprecht über Zuhause.', roleDe: 'Ich frage über dein Zuhause.' },
  { id: 'cafe', emoji: '☕', titlePt: 'Café', titleDe: 'Café', topic: 'food', settingDe: 'Ihr seid im Café.', roleDe: 'Ich bin im Café.' },
];

const TOPIC_FOR_BASE: Record<string, string> = {
  'survival-arbeite': 'work',
  'l0-hook-ich-moechte': 'food',
  'l0-hook-ich-brauche': 'needs',
  'l0-hook-ich-muss': 'routine',
  'l0-hook-kannst-du': 'requests',
  'l0-ich-wohne': 'places',
  'l0-ich-komme': 'identity',
  'l0-ich-heisse': 'identity',
  'l0-ich-bin': 'identity',
  'l0-hilfe': 'help',
};

function phrasePool(phrases: Phrase[]): Map<string, Phrase> {
  return new Map(mergeZeroLanguagePhrases(phrases).map((p) => [p.id, p]));
}

function germanForId(id: string, pool: Map<string, Phrase>): string | null {
  return pool.get(id)?.german || zeroLanguageSeedPhrases().find((p) => p.id === id)?.german || null;
}

function isStudied(conf: PhraseConfidence | undefined): boolean {
  if (!conf) return false;
  return isZeroLanguagePhraseAccepted(conf) || (conf.timesCorrect ?? 0) > 0 || conf.confidence >= 25;
}

function studiedIdsForBase(baseId: string, learning: UserLearningProfile): string[] {
  const node = L0_CHUNK_GRAPH[baseId];
  if (!node) return [];
  const ids = [baseId, ...node.simpleVars, ...node.questions];
  return ids.filter((id) => isStudied(learning.phrases[id]));
}

function extractVocabulary(structures: string[]): string[] {
  const vocab = new Set<string>();
  const skip = new Set(['Ich', 'Du', 'Was', 'Wo', 'Wann', 'Wie', 'Und', 'Nein', 'Ja']);
  for (const phrase of structures) {
    const matches = phrase.match(/\b[A-ZÄÖÜ][a-zäöüß]+/g) || [];
    for (const w of matches) {
      if (!skip.has(w)) vocab.add(w);
    }
    if (/essen/i.test(phrase)) vocab.add('essen');
    if (/trinken/i.test(phrase)) vocab.add('trinken');
  }
  return [...vocab].slice(0, 20);
}

function compatibleTopics(learning: UserLearningProfile): Set<string> {
  const topics = new Set<string>();
  for (const baseId of Object.keys(L0_CHUNK_GRAPH)) {
    const studied = studiedIdsForBase(baseId, learning);
    if (studied.length === 0) continue;
    const topic = TOPIC_FOR_BASE[baseId];
    if (topic) topics.add(topic);
  }
  return topics;
}

export function listCompatibleScenarios(learning: UserLearningProfile): SimulatorScenario[] {
  const topics = compatibleTopics(learning);
  if (topics.size === 0) return [];
  return SCENARIOS.filter((s) => topics.has(s.topic));
}

function pickScenario(
  learning: UserLearningProfile,
  mode: SimulatorMode,
  surprise: boolean,
  weakPhraseIds: string[],
): SimulatorScenario {
  const compatible = listCompatibleScenarios(learning);
  if (compatible.length === 0) {
    return SCENARIOS[0];
  }
  if (surprise) {
    return compatible[Math.floor(Math.random() * compatible.length)];
  }
  if (mode === 'weak' && weakPhraseIds.length) {
    const base = l0ChunkBaseForPhraseId(weakPhraseIds[0]);
    const topic = base ? TOPIC_FOR_BASE[base] : null;
    const hit = compatible.find((s) => s.topic === topic);
    if (hit) return hit;
  }
  const recent = Object.values(learning.phrases)
    .filter((c) => c.lastProduced && isStudied(c))
    .sort((a, b) => Date.parse(b.lastProduced!) - Date.parse(a.lastProduced!));
  if (recent.length) {
    const base = l0ChunkBaseForPhraseId(recent[0].phraseId);
    const topic = base ? TOPIC_FOR_BASE[base] : null;
    const hit = compatible.find((s) => s.topic === topic);
    if (hit) return hit;
  }
  return compatible[0];
}

function collectStructures(
  learning: UserLearningProfile,
  phrases: Phrase[],
  mode: SimulatorMode,
  scenario: SimulatorScenario,
  weakPhraseIds: string[],
): { structures: string[]; baseIds: string[] } {
  const pool = phrasePool(phrases);
  const structures: string[] = [];
  const baseIds: string[] = [];

  const bases = Object.keys(L0_CHUNK_GRAPH).filter((baseId) => {
    const topic = TOPIC_FOR_BASE[baseId];
    if (topic !== scenario.topic) return false;
    return studiedIdsForBase(baseId, learning).length > 0;
  });

  const orderedBases =
    mode === 'weak'
      ? [...bases].sort((a, b) => {
          const aWeak = weakPhraseIds.some((id) => l0ChunkBaseForPhraseId(id) === a) ? 1 : 0;
          const bWeak = weakPhraseIds.some((id) => l0ChunkBaseForPhraseId(id) === b) ? 1 : 0;
          return bWeak - aWeak;
        })
      : [...bases].sort((a, b) => {
          const aAt = Date.parse(learning.phrases[a]?.lastProduced || '') || 0;
          const bAt = Date.parse(learning.phrases[b]?.lastProduced || '') || 0;
          return bAt - aAt;
        });

  if (mode === 'free') {
    for (const baseId of Object.keys(L0_CHUNK_GRAPH)) {
      if (studiedIdsForBase(baseId, learning).length === 0) continue;
      if (!orderedBases.includes(baseId)) orderedBases.push(baseId);
    }
  }

  for (const baseId of orderedBases) {
    baseIds.push(baseId);
    for (const id of studiedIdsForBase(baseId, learning)) {
      const g = germanForId(id, pool);
      if (g && !structures.includes(g)) structures.push(g);
    }
  }

  return { structures: structures.slice(0, 16), baseIds };
}

function pickOpening(structures: string[], scenario: SimulatorScenario): string {
  const questions = structures.filter((s) => s.includes('?'));
  const topicQs = questions.filter((q) => {
    if (scenario.topic === 'work') return /arbeit/i.test(q);
    if (scenario.topic === 'food') return /möcht|essen|trinken/i.test(q);
    if (scenario.topic === 'needs') return /brauch/i.test(q);
    if (scenario.topic === 'routine') return /muss/i.test(q);
    if (scenario.topic === 'requests') return /kannst|helfen/i.test(q);
    if (scenario.topic === 'places') return /wohn|wo\b/i.test(q);
    if (scenario.topic === 'identity') return /heiß|komm|bin/i.test(q);
    return true;
  });
  if (topicQs.length) return topicQs[0];
  if (questions.length) return questions[0];
  const statement = structures.find((s) => !s.includes('?'));
  return statement || 'Hallo!';
}

export function buildWeakPhraseIds(learning: UserLearningProfile): string[] {
  return Object.values(learning.phrases)
    .filter((c) => {
      const base = l0ChunkBaseForPhraseId(c.phraseId);
      if (!base && !L0_CHUNK_GRAPH[c.phraseId]) return false;
      return (
        c.needsHelp ||
        c.confidence < 40 ||
        (c.timesProduced > 0 && c.timesCorrect / c.timesProduced < 0.6)
      );
    })
    .sort((a, b) => a.confidence - b.confidence)
    .map((c) => c.phraseId)
    .slice(0, 8);
}

export function buildSimulatorContext(input: {
  learning: UserLearningProfile;
  phrases: Phrase[];
  mode: SimulatorMode;
  durationMinutes: SimulatorDurationMinutes;
  trainingStyle: SimulatorTrainingStyle;
  surprise?: boolean;
}): SimulatorContext | null {
  const compatible = listCompatibleScenarios(input.learning);
  if (compatible.length === 0) return null;

  const weakPhraseIds = buildWeakPhraseIds(input.learning);
  const surprise = !!input.surprise;
  const scenario = pickScenario(input.learning, input.mode, surprise, weakPhraseIds);
  const { structures, baseIds } = collectStructures(
    input.learning,
    input.phrases,
    input.mode,
    scenario,
    weakPhraseIds,
  );
  if (structures.length === 0) return null;

  const vocabulary = extractVocabulary(structures);
  const primaryBase = baseIds[0] || Object.keys(L0_CHUNK_GRAPH)[0];
  const pool = phrasePool(input.phrases);
  const chunk = germanForId(primaryBase, pool)?.replace(/\?$/u, '...') || '...';
  const difficulty =
    input.trainingStyle === 'real_test'
      ? 'production'
      : baseIds.some((id) => isL0ChunkMature(input.learning, id))
        ? 'guided'
        : 'developing';

  const weakStructures = weakPhraseIds
    .map((id) => germanForId(id, pool))
    .filter((g): g is string => !!g)
    .slice(0, 6);

  const focusStructures =
    input.mode === 'weak' || weakStructures.length > 0
      ? weakStructures.length
        ? weakStructures
        : structures.slice(0, 6)
      : structures.slice(0, 6);

  const recentVariations = structures
    .filter((s) => /möchte|arbeite|brauche|muss|arbeitest|brauchst/i.test(s))
    .slice(0, 6);

  return {
    id: `sim-${scenario.id}-${input.mode}`,
    topic: scenario.topic,
    chunk,
    knownStructures: structures,
    knownVocabulary: vocabulary,
    recentTargets: structures.slice(0, 6),
    recentVariations,
    difficulty,
    reason: `simulator:${input.mode}`,
    baseId: primaryBase,
    simulatorMode: input.mode,
    trainingStyle: input.trainingStyle,
    durationMinutes: input.durationMinutes,
    surprise,
    scenario,
    weakPhraseIds,
    focusStructures,
    endsAt: Date.now() + input.durationMinutes * 60_000,
  };
}

export function buildSimulatorKickoff(ctx: SimulatorContext, openingGerman: string): string {
  const weakStructures = ctx.weakPhraseIds
    .map((id) => ctx.knownStructures.find((s) => s.toLowerCase().includes(id.slice(0, 8))) || '')
    .filter(Boolean);
  return buildImmersionSimulatorKickoff({
    settingDe: ctx.scenario.settingDe,
    roleDe: ctx.scenario.roleDe,
    durationMinutes: ctx.durationMinutes,
    openingGerman,
    structures: ctx.knownStructures,
    vocabulary: ctx.knownVocabulary,
    focusStructures: ctx.focusStructures,
    weakStructures: weakStructures.length ? weakStructures : ctx.focusStructures,
  });
}

export function pickSimulatorOpening(ctx: SimulatorContext): string {
  return pickOpening(ctx.knownStructures, ctx.scenario);
}

export function scenarioLabel(ctx: SimulatorContext, german = true): string {
  const title = german ? ctx.scenario.titleDe : ctx.scenario.titlePt;
  return `${ctx.scenario.emoji} ${title}`;
}
