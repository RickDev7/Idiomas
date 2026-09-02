/**
 * Catálogo unificado de situações.
 * Fonte legada UI: data/content.ts SITUATIONS (não apagar).
 * Camada pedagógica: EverydaySituation normalizada para Professor Core / filtros.
 */
import { SITUATIONS } from '@/data/content';
import type { Situation, SituationCategory } from '@/types';
import type { CurriculumBand, EverydaySituation } from './Types';
import type { SimulatorScenario } from '@/services/teacher/SimulatorTypes';

/** Domínio pedagógico ← categoria legada. */
export const CATEGORY_TO_DOMAIN: Record<SituationCategory, string> = {
  work: 'arbeit',
  supermarket: 'supermarkt',
  bank: 'behoerde',
  doctor: 'gesundheit',
  phone: 'alltag',
  garage: 'alltag',
  home: 'zuhause',
  school: 'alltag',
  authorities: 'behoerde',
  restaurant: 'restaurant',
  transport: 'transport',
  social: 'sozial',
  hotel: 'alltag',
  travel: 'transport',
};

const DIFFICULTY_TO_BAND: Record<string, CurriculumBand> = {
  zero: 'L0',
  little: 'A1',
  basic: 'A1',
  intermediate: 'A1+',
  advanced: 'A2',
};

/** Overlays pedagógicos (prompts / requiredPatterns) por id legado — não substitui SITUATIONS. */
const PEDAGOGICAL_OVERLAY: Record<
  string,
  { promptsDe?: string[]; requiredPatterns?: string[]; settingDe?: string; titleDe?: string }
> = {
  work: {
    titleDe: 'Arbeit',
    settingDe: 'Ihr seid bei der Arbeit.',
    promptsDe: ['Was machst du gerade?', 'Arbeitest du heute?', 'Brauchst du Hilfe?'],
    requiredPatterns: ['Ich arbeite', 'Ich muss', 'Ich brauche', 'Kannst du'],
  },
  restaurant: {
    titleDe: 'Restaurant',
    settingDe: 'Ihr seid im Restaurant.',
    promptsDe: ['Was möchtest du trinken?', 'Was möchtest du essen?', 'Mit oder ohne Gas?'],
    requiredPatterns: ['Ich möchte'],
  },
  supermarket: {
    titleDe: 'Supermarkt',
    settingDe: 'Du bist im Supermarkt.',
    promptsDe: ['Was möchtest du kaufen?', 'Wo finde ich…?'],
    requiredPatterns: ['Ich möchte', 'Ich brauche'],
  },
  shopping: {
    titleDe: 'Einkaufen',
    settingDe: 'Du bist im Geschäft.',
    promptsDe: ['Was möchtest du kaufen?'],
    requiredPatterns: ['Ich möchte', 'Ich brauche'],
  },
  transport: {
    titleDe: 'Unterwegs',
    settingDe: 'Du bist unterwegs.',
    promptsDe: ['Wo ist der Bahnhof?', 'Wann fährt der Bus?'],
    requiredPatterns: ['Ich muss', 'Ich gehe', 'Ich möchte wissen'],
  },
  home: {
    titleDe: 'Zuhause',
    settingDe: 'Ihr sprecht über Zuhause.',
    promptsDe: ['Was machst du heute?', 'Was möchtest du heute machen?'],
    requiredPatterns: ['Ich muss', 'Ich möchte', 'Ich gehe'],
  },
  authorities: {
    titleDe: 'Behörde',
    settingDe: 'Du brauchst Information bei der Behörde.',
    promptsDe: ['Ich möchte wissen…', 'Wann ist der Termin?'],
    requiredPatterns: ['Ich möchte wissen', 'Ich brauche'],
  },
  social: {
    titleDe: 'Sozial',
    settingDe: 'Du triffst eine Person.',
    promptsDe: ['Wie heißt du?', 'Was machst du?'],
    requiredPatterns: ['Ich heiße', 'Ich komme', 'Ich bin', 'Ich arbeite'],
  },
  doctor: {
    titleDe: 'Gesundheit',
    settingDe: 'Du bist beim Arzt.',
    promptsDe: ['Was fehlt Ihnen?', 'Ich brauche einen Termin.'],
    requiredPatterns: ['Ich brauche', 'Ich habe'],
  },
};

/** Situações pedagógicas extras (não estão no catálogo UI legado). */
const EXTRA_PEDAGOGICAL: EverydaySituation[] = [
  {
    id: 'sit.cafe',
    domain: 'restaurant',
    titleDe: 'Café',
    titlePt: 'Café',
    settingDe: 'Ihr seid im Café.',
    promptsDe: ['Was möchtest du trinken?', 'Mit oder ohne Gas?'],
    requiredPatterns: ['Ich möchte'],
    band: 'L0',
  },
  {
    id: 'sit.routine',
    domain: 'zuhause',
    titleDe: 'Alltag',
    titlePt: 'Rotina',
    settingDe: 'Es ist ein normaler Tag.',
    promptsDe: ['Was machst du heute?', 'Was musst du machen?'],
    requiredPatterns: ['Ich muss', 'Ich möchte', 'Ich gehe'],
    band: 'L0',
  },
];

/**
 * Cenários do Simulator — mesma família temática (topic) alinhada ao L0 / ConversationTopics.
 * Fonte única para SimulatorEngine (evitar SCENARIOS locais divergentes).
 */
export const UNIFIED_SIMULATOR_SCENARIOS: SimulatorScenario[] = [
  { id: 'meet', emoji: '👋', titlePt: 'Conhecer alguém', titleDe: 'Jemanden kennenlernen', topic: 'identity', settingDe: 'Du triffst eine neue Person.', roleDe: 'Ich bin dein Gesprächspartner.' },
  { id: 'work', emoji: '💼', titlePt: 'Trabalho', titleDe: 'Arbeit', topic: 'work', settingDe: 'Ihr seid bei der Arbeit.', roleDe: 'Ich bin dein Kollege.' },
  { id: 'food', emoji: '🍽', titlePt: 'Restaurante', titleDe: 'Restaurant', topic: 'food', settingDe: 'Ihr seid im Restaurant.', roleDe: 'Ich bin der Kellner.' },
  { id: 'needs', emoji: '🛒', titlePt: 'Compras', titleDe: 'Einkaufen', topic: 'needs', settingDe: 'Ihr seid im Laden.', roleDe: 'Ich bin im Geschäft.' },
  { id: 'routine', emoji: '⏰', titlePt: 'Rotina', titleDe: 'Alltag', topic: 'routine', settingDe: 'Es ist ein normaler Tag.', roleDe: 'Ich frage nach deinem Tag.' },
  { id: 'help', emoji: '🆘', titlePt: 'Pedir ajuda', titleDe: 'Hilfe', topic: 'requests', settingDe: 'Du brauchst Hilfe.', roleDe: 'Ich kann dir helfen.' },
  { id: 'home', emoji: '🏠', titlePt: 'Casa', titleDe: 'Zuhause', topic: 'places', settingDe: 'Ihr sprecht über Zuhause.', roleDe: 'Ich frage über dein Zuhause.' },
  { id: 'cafe', emoji: '☕', titlePt: 'Café', titleDe: 'Café', topic: 'food', settingDe: 'Ihr seid im Café.', roleDe: 'Ich bin im Café.' },
];

export function adaptLegacySituation(s: Situation): EverydaySituation {
  const overlay = PEDAGOGICAL_OVERLAY[s.id] || {};
  const patternsFromKeys = (s.keyPhrases || [])
    .map((p) => p.replace(/\.\.\.|…/g, '').trim())
    .filter((p) => p.length >= 3)
    .slice(0, 4);
  return {
    id: `legacy.${s.id}`,
    domain: CATEGORY_TO_DOMAIN[s.category] || s.category,
    titleDe: overlay.titleDe || s.title,
    titlePt: s.title,
    settingDe: overlay.settingDe || s.description,
    promptsDe: overlay.promptsDe || [s.openingLine, ...s.keyPhrases].filter(Boolean).slice(0, 4),
    requiredPatterns: overlay.requiredPatterns || patternsFromKeys,
    band: DIFFICULTY_TO_BAND[s.difficulty] || 'L0',
  };
}

/** Situações normalizadas: legado + extras pedagógicos (ids únicos). */
export function getNormalizedSituations(): EverydaySituation[] {
  const fromLegacy = SITUATIONS.map(adaptLegacySituation);
  const legacyIds = new Set(fromLegacy.map((s) => s.id));
  const extras = EXTRA_PEDAGOGICAL.filter((e) => !legacyIds.has(e.id));
  return [...fromLegacy, ...extras];
}

/** API legada intacta — consumidores UI continuam usando SITUATIONS. */
export function getLegacySituations(): Situation[] {
  return SITUATIONS;
}

export function normalizedSituationIds(): string[] {
  return getNormalizedSituations().map((s) => s.id);
}

/** Garante que não há IDs duplicados no catálogo normalizado. */
export function assertUniqueSituationIds(situations = getNormalizedSituations()): boolean {
  const seen = new Set<string>();
  for (const s of situations) {
    if (seen.has(s.id)) return false;
    seen.add(s.id);
  }
  return true;
}
