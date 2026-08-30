/* CourseEngine — ponto de entrada do curso. Recomenda nível, objetivo,
   jornada e conteúdo, integrando-se ao TeacherEngine/LearningEngine sem
   substituí-los. */
import type {
  CourseLevelId, CourseRecommendation, CourseProgress,
} from './types';
import { LEVEL_BY_ID, LEVEL_ORDER, levelIndex } from './levels';
import { COMPETENCY_BY_ID, competenciesForLevel } from './competencies';
import { categoriesForLevel, CURATED_BY_COMPETENCY } from './content';
import {
  readyForNextLevel, nextCompetency, nextObjectiveLabel, focusSkill,
} from './CourseProgressEngine';
import { getLevelAvailability, getContentAvailability } from './CourseUnlockService';
import type { Phrase, UserProfile } from '@/types';

export interface CourseState {
  progress: CourseProgress;
  recommendation: CourseRecommendation;
}

export function buildRecommendation(p: CourseProgress, userLevel?: CourseLevelId): CourseRecommendation {
  const cur = userLevel ?? p.currentLevel;
  const level = LEVEL_BY_ID[cur] ?? LEVEL_BY_ID[p.currentLevel];
  const journey = LEVEL_ORDER.map((id) => {
    const l = LEVEL_BY_ID[id];
    const avail = getLevelAvailability(id, cur);
    const status: 'done' | 'current' | 'locked' =
      avail === 'completed' ? 'done' : avail === 'current' ? 'current' : 'locked';
    return { level: id, label: l.label, emoji: l.emoji, status };
  });
  return {
    currentLevel: cur,
    levelLabel: level.label,
    levelEmoji: level.emoji,
    nextObjective: nextObjectiveLabel(p),
    nextCompetencyId: nextCompetency(p) ?? undefined,
    germanPercentage: level.germanPercentage,
    journey,
    readyForAssessment: readyForNextLevel(p),
    focusSkill: focusSkill(p) ?? undefined,
  };
}

export function buildCourseState(p: CourseProgress): CourseState {
  return { progress: p, recommendation: buildRecommendation(p) };
}

/** Filtra o pool de frases existente pelo nível atual (categorias relevantes). */
export function phrasesForLevel(allPhrases: Phrase[], level: CourseLevelId): Phrase[] {
  const cats = new Set(categoriesForLevel(level));
  const relevant = allPhrases.filter((p) => cats.has(p.category));
  return relevant.length ? relevant : allPhrases;
}

/** Filtra o pool para uma competência específica. */
export function phrasesForCompetency(allPhrases: Phrase[], competencyId: string): Phrase[] {
  const c = CURATED_BY_COMPETENCY[competencyId];
  if (!c) return allPhrases;
  const cats = new Set(c.categories);
  return allPhrases.filter((p) => cats.has(p.category));
}

/** Tópico de conversação sugerido pelo curso (usa a situação real-world do nível). */
export function courseConversationTopic(p: CourseProgress, _profile: UserProfile): string {
  const level = LEVEL_BY_ID[p.currentLevel];
  const compId = nextCompetency(p);
  if (compId) {
    const comp = COMPETENCY_BY_ID[compId];
    return comp.title.toLowerCase();
  }
  return level.realWorldScenario.toLowerCase();
}

/** Indica se o aluno está num nível onde leitura/escrita devem começar a aparecer. */
export function includeReadingWriting(p: CourseProgress): boolean {
  return levelIndex(p.currentLevel) >= levelIndex('A2');
}

/** Percentual de alemão que o professor deve usar no nível atual. */
export function germanPercentageFor(p: CourseProgress): number {
  return LEVEL_BY_ID[p.currentLevel].germanPercentage;
}

/** Lista de competências de um nível com disponibilidade de acesso (não confundir com domínio). */
export function competencyStatusForLevel(
  p: CourseProgress,
  level: CourseLevelId = p.currentLevel,
  userLevel: CourseLevelId = p.currentLevel,
) {
  return competenciesForLevel(level).map((c) => {
    const mastery = p.competencyMastery[c.id] ?? 0;
    const availability = getContentAvailability({
      contentLevel: c.level,
      userLevel,
      mastery,
      threshold: c.masteryThreshold,
      prerequisites: c.prerequisites,
      competencyMastery: p.competencyMastery,
    });
    return {
      id: c.id,
      title: c.title,
      description: c.description,
      mastery,
      gate: p.competencyGates[c.id] ?? 'learning',
      availability,
      threshold: c.masteryThreshold,
      prerequisites: c.prerequisites,
      core: CURATED_BY_COMPETENCY[c.id]?.core ?? [],
      categories: CURATED_BY_COMPETENCY[c.id]?.categories ?? [],
    };
  });
}
