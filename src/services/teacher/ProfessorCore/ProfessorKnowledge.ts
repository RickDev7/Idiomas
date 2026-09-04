/**
 * ProfessorKnowledge — agrega conhecimento do IDIOMA (não do aluno).
 * Learning State classifica disponibilidade.
 */
import type { Phrase } from '@/types';
import type { PhraseConfidence, UserLearningProfile } from '@/services/learning/ConfidenceService';
import { isZeroLanguagePhraseAccepted } from '@/services/teacher/ZeroLanguageMode';
import { CHUNK_CATALOG } from './ChunkKnowledge';
import { grammarRulesForPatterns, grammarRulesUpTo } from './GrammarKnowledge';
import { EVERYDAY_SITUATIONS, filterSituationsByKnownPatterns } from './SituationKnowledge';
import { vocabUpToBand } from './VocabularyKnowledge';
import { autonomyFromConfidence } from './AutonomyLevels';
import type {
  ClassifiedContent,
  ContentAvailability,
  CurriculumBand,
  EverydaySituation,
  GrammarRule,
} from './Types';

export function inferCurriculumBand(level: string | undefined): CurriculumBand {
  const l = (level || 'zero').toLowerCase().trim();
  if (l === 'zero' || l === 'l0' || l === 'nível 0' || l === 'nivel 0') return 'L0';
  // App coarse levels → CEFR band (little = A1 no CourseProgressEngine)
  if (l === 'little' || l === 'beginner' || l === 'a1') return 'A1';
  if (l === 'a1+' || l === 'a1plus' || l === 'a1_plus') return 'A1+';
  if (l === 'basic' || l === 'a2') return 'A2';
  if (l === 'intermediate' || l === 'b1') return 'B1';
  if (l.startsWith('b2') || l.startsWith('c') || l === 'advanced' || l === 'very_advanced') return 'B2';
  // CourseLevelId já em maiúsculas (A1, A2…)
  const up = (level || '').toUpperCase();
  if (up === 'L0') return 'L0';
  if (up === 'A1') return 'A1';
  if (up === 'A1+' || up === 'A1PLUS') return 'A1+';
  if (up === 'A2') return 'A2';
  if (up === 'B1') return 'B1';
  if (up === 'B2' || up === 'C1' || up === 'C2') return 'B2';
  return 'L0';
}

export function classifyPhraseAvailability(c: PhraseConfidence | undefined): ContentAvailability {
  if (!c) return 'NOT_YET_STUDIED';
  if (c.needsHelp || (c.confidence > 0 && c.confidence < 40)) return 'WEAK';
  if (isZeroLanguagePhraseAccepted(c) || c.confidence >= 50 || (c.timesCorrect ?? 0) >= 2) {
    return 'KNOWN';
  }
  if (c.timesSeen > 0 || c.confidence > 0 || c.state !== 'new') return 'LEARNING';
  return 'NOT_YET_STUDIED';
}

export function classifyLearningContent(
  learning: UserLearningProfile,
  phrases: Phrase[],
): {
  known: ClassifiedContent[];
  learning: ClassifiedContent[];
  weak: ClassifiedContent[];
  notYetCount: number;
} {
  const byId = new Map(phrases.map((p) => [p.id, p]));
  const known: ClassifiedContent[] = [];
  const learningItems: ClassifiedContent[] = [];
  const weak: ClassifiedContent[] = [];
  let notYetCount = 0;

  const ids = new Set([
    ...Object.keys(learning.phrases),
    ...phrases.map((p) => p.id),
  ]);

  for (const id of ids) {
    const conf = learning.phrases[id];
    const german = byId.get(id)?.german || conf?.phraseId || id;
    const availability = classifyPhraseAvailability(conf);
    const item: ClassifiedContent = {
      id,
      german,
      availability,
      autonomy: autonomyFromConfidence(conf),
      confidence: conf?.confidence ?? 0,
    };
    if (availability === 'KNOWN') known.push(item);
    else if (availability === 'WEAK') weak.push(item);
    else if (availability === 'LEARNING') learningItems.push(item);
    else notYetCount += 1;
  }

  known.sort((a, b) => b.confidence - a.confidence);
  weak.sort((a, b) => a.confidence - b.confidence);
  return {
    known: known.slice(0, 24),
    learning: learningItems.slice(0, 16),
    weak: weak.slice(0, 12),
    notYetCount,
  };
}

/** Vocabulário permitido = lemmas que aparecem em chunks conhecidos/em aprendizagem. */
export function availableVocabularyFromKnown(knownGermans: string[], band: CurriculumBand): string[] {
  const pool = vocabUpToBand(band);
  const blob = knownGermans.join(' ').toLowerCase();
  const matched = pool.filter((v) => blob.includes(v.lemma.toLowerCase())).map((v) => v.lemma);
  if (matched.length >= 4) return matched.slice(0, 20);
  // fallback: vocabulário L0 do domínio do professor, mas marcado como catálogo — caller limita uso
  return pool.filter((v) => v.band === 'L0').map((v) => v.lemma).slice(0, 12);
}

export function suitableSituationsForLearner(knownGermans: string[]): EverydaySituation[] {
  return filterSituationsByKnownPatterns(EVERYDAY_SITUATIONS, knownGermans).slice(0, 6);
}

export function relevantGrammar(knownGermans: string[], band: CurriculumBand): GrammarRule[] {
  const fromPatterns = grammarRulesForPatterns(knownGermans, band);
  if (fromPatterns.length) return fromPatterns;
  return grammarRulesUpTo(band).slice(0, 4);
}

export function allowedStructures(known: ClassifiedContent[], learning: ClassifiedContent[]): string[] {
  const fromState = [...known, ...learning].map((c) => c.german).filter(Boolean);
  if (fromState.length) return fromState.slice(0, 20);
  return CHUNK_CATALOG.filter((c) => c.band === 'L0').map((c) => c.pattern).slice(0, 8);
}

/**
 * Grammar Knowledge ≠ Learning State.
 * Uma regra existe no catálogo mesmo que o aluno nunca a tenha visto.
 */
export function grammarExistsIndependentlyOfLearning(ruleId: string): boolean {
  return grammarRulesUpTo('B2').some((r) => r.id === ruleId);
}
