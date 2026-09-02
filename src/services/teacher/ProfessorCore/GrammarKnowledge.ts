/**
 * GrammarKnowledge = adapter pedagógico sobre course/grammar.ts (fonte curricular única).
 * Não duplica o catálogo — só normaliza e enriquece para o Professor Core.
 */
import {
  GRAMMAR,
  GRAMMAR_BY_ID,
  grammarForLevel,
  grammarUnlocked,
} from '@/services/course/grammar';
import type { CourseLevelId, GrammarTopic } from '@/services/course/types';
import type { CurriculumBand, GrammarRule } from './Types';

const BAND_ORDER: CurriculumBand[] = ['L0', 'A1', 'A1+', 'A2', 'B1', 'B2'];

/** Enriquecimento pedagógico por id do curso — não é segunda fonte de conteúdo. */
const PEDAGOGICAL_ENRICHMENT: Record<
  string,
  { titleDe?: string; titlePt?: string; relatedChunkPatterns?: string[]; bandOverride?: CurriculumBand }
> = {
  'g.l0.pronouns': {
    titleDe: 'Personalpronomen',
    titlePt: 'Pronomes pessoais',
    relatedChunkPatterns: ['Ich', 'Du'],
  },
  'g.l0.sein': {
    titleDe: 'Verb sein',
    titlePt: 'Verbo sein',
    relatedChunkPatterns: ['Ich bin', 'Du bist'],
  },
  'g.l0.haben': {
    titleDe: 'Verb haben',
    titlePt: 'Verbo haben',
    relatedChunkPatterns: ['Ich habe', 'Hast du'],
  },
  'g.l0.ja_nein': {
    titleDe: 'Ja/Nein',
    titlePt: 'Ja / Nein',
    relatedChunkPatterns: ['Ja', 'Nein'],
  },
  'g.a1.verbs_common': {
    titleDe: 'Häufige Verben',
    titlePt: 'Verbos frequentes',
    relatedChunkPatterns: ['Ich arbeite', 'Ich gehe', 'Ich komme'],
  },
  'g.a1.articles': {
    titleDe: 'Artikel',
    titlePt: 'Artigos',
    relatedChunkPatterns: [],
  },
  'g.a1.plural': {
    titleDe: 'Plural',
    titlePt: 'Plural básico',
  },
  'g.a1.negation': {
    titleDe: 'Negation',
    titlePt: 'Negação',
    relatedChunkPatterns: ['nicht', 'kein'],
  },
  'g.a1.questions': {
    titleDe: 'Fragen',
    titlePt: 'Perguntas W- / Ja-Nein',
    relatedChunkPatterns: ['Was', 'Wo', 'Wann', 'Wie', 'Kannst du'],
  },
  'g.a1.word_order': {
    titleDe: 'Wortstellung V2',
    titlePt: 'Ordem básica (V2)',
    relatedChunkPatterns: ['Ich'],
  },
  'g.a1.modal': {
    titleDe: 'Modalverben',
    titlePt: 'Verbos modais',
    relatedChunkPatterns: ['Ich möchte', 'Ich muss', 'Ich kann', 'Kannst du'],
  },
  'g.a1.accusative': {
    titleDe: 'Akkusativ',
    titlePt: 'Acusativo básico',
    relatedChunkPatterns: ['Ich möchte', 'Ich brauche', 'Ich habe'],
  },
  'g.a1.possessives': {
    titleDe: 'Possessivartikel',
    titlePt: 'Possessivos',
  },
  'g.a2.dative': {
    titleDe: 'Dativ',
    titlePt: 'Dativo',
    bandOverride: 'A1+',
    relatedChunkPatterns: ['Kannst du mir'],
  },
  'g.a2.separable': {
    titleDe: 'Trennbare Verben',
    titlePt: 'Verbos separáveis',
    bandOverride: 'A1+',
  },
  'g.a2.subordinate': {
    titleDe: 'Nebensätze',
    titlePt: 'Subordinadas',
    relatedChunkPatterns: [],
  },
};

export function bandIndex(band: CurriculumBand): number {
  return BAND_ORDER.indexOf(band);
}

export function courseLevelToBand(level: CourseLevelId): CurriculumBand {
  if (level === 'L0') return 'L0';
  if (level === 'A1') return 'A1';
  if (level === 'A2') return 'A2';
  if (level === 'B1') return 'B1';
  if (level === 'B2' || level === 'C1' || level === 'C2') return 'B2';
  return 'L0';
}

/** Níveis do curso incluídos até o band pedagógico. */
export function courseLevelsUpToBand(band: CurriculumBand): CourseLevelId[] {
  const max = bandIndex(band);
  const levels: CourseLevelId[] = [];
  if (max >= bandIndex('L0')) levels.push('L0');
  if (max >= bandIndex('A1')) levels.push('A1');
  if (max >= bandIndex('A1+')) {
    /* A1+ puxa A1 + tópicos A2 marcados como A1+ via enrichment */
  }
  if (max >= bandIndex('A2')) levels.push('A2');
  if (max >= bandIndex('B1')) levels.push('B1');
  if (max >= bandIndex('B2')) levels.push('B2', 'C1', 'C2');
  return levels;
}

export function adaptGrammarTopic(topic: GrammarTopic): GrammarRule {
  const enrich = PEDAGOGICAL_ENRICHMENT[topic.id] || {};
  return {
    id: topic.id,
    band: enrich.bandOverride || courseLevelToBand(topic.level),
    titleDe: enrich.titleDe || topic.title,
    titlePt: enrich.titlePt || topic.title,
    summary: topic.summary,
    examples: [...topic.examples],
    relatedChunkPatterns: enrich.relatedChunkPatterns || [],
  };
}

function topicIncludedForBand(topic: GrammarTopic, band: CurriculumBand): boolean {
  const rule = adaptGrammarTopic(topic);
  return bandIndex(rule.band) <= bandIndex(band);
}

/** Regras normalizadas até o band — sempre derivadas de course/grammar.ts. */
export function grammarRulesUpTo(band: CurriculumBand): GrammarRule[] {
  return GRAMMAR.filter((t) => topicIncludedForBand(t, band)).map(adaptGrammarTopic);
}

export function grammarRulesForPatterns(patterns: string[], band: CurriculumBand): GrammarRule[] {
  const pool = grammarRulesUpTo(band);
  if (!patterns.length) return pool.slice(0, 4);
  const lower = patterns.map((p) => p.toLowerCase());
  return pool
    .filter((r) =>
      r.relatedChunkPatterns.some((pat) =>
        lower.some((p) => p.includes(pat.toLowerCase().slice(0, 8))),
      ),
    )
    .slice(0, 5);
}

/** Compat: lista completa adaptada (não é catálogo paralelo). */
export const GRAMMAR_RULES: GrammarRule[] = GRAMMAR.map(adaptGrammarTopic);

/** Reexporta a fonte curricular para testes/consumidores do adapter. */
export {
  GRAMMAR as COURSE_GRAMMAR,
  GRAMMAR_BY_ID as COURSE_GRAMMAR_BY_ID,
  grammarForLevel,
  grammarUnlocked,
};

export function getCourseGrammarTopic(id: string): GrammarTopic | undefined {
  return GRAMMAR_BY_ID[id];
}

export function isCourseGrammarSourceOfTruth(): boolean {
  return (
    COURSE_GRAMMAR_LEN() > 0 &&
    GRAMMAR_RULES.length === COURSE_GRAMMAR_LEN() &&
    GRAMMAR_RULES.every((r) => !!getCourseGrammarTopic(r.id))
  );
}

function COURSE_GRAMMAR_LEN(): number {
  return GRAMMAR.length;
}
