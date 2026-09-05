/* LevelAssessment — gera uma avaliação de nível como uma sequência de interações
   que parece uma conversa/desafio, não uma prova escolar. Avalia competências do
   nível-alvo e decide aprovação. */
import type { AssessmentSpec, CourseLevelId, CourseProgress } from './types';
import { LEVEL_BY_ID, levelIndex, nextLevel } from './levels';
import { competenciesForLevel } from './competencies';
import { CURATED_BY_COMPETENCY } from './content';
import type { Interaction } from '@/services/teacher/LessonEngine';

export const ASSESSMENTS: AssessmentSpec[] = [
  { id: 'assess.a1', level: 'A1', title: 'Conversa de A1', competencies: ['a1.personal', 'a1.family', 'a1.routine', 'a1.shopping', 'a1.ask_info', 'a1.numbers_time', 'a1.help'], interactions: 8 },
  { id: 'assess.a2', level: 'A2', title: 'Conversa de A2', competencies: ['a2.past', 'a2.plans', 'a2.problem', 'a2.phone', 'a2.travel', 'a2.opinion'], interactions: 8 },
  { id: 'assess.b1', level: 'B1', title: 'Conversa de B1', competencies: ['b1.story', 'b1.opinion_justify', 'b1.work_social', 'b1.news', 'b1.explain_problem', 'b1.present', 'b1.live_daily'], interactions: 8 },
  { id: 'assess.b2', level: 'B2', title: 'Debate de B2', competencies: ['b2.narrative', 'b2.cause_effect', 'b2.argue', 'b2.compare', 'b2.problems_solutions', 'b2.work_pro', 'b2.defend', 'b2.fluent'], interactions: 8 },
  { id: 'assess.c1', level: 'C1', title: 'Debate de C1', competencies: ['c1.nuance', 'c1.argue', 'c1.debate', 'c1.hypothesis', 'c1.register', 'c1.abstract', 'c1.negotiate', 'c1.spontaneous'], interactions: 8 },
  { id: 'assess.c2', level: 'C2', title: 'Conversa de C2', competencies: ['c2.nuance', 'c2.argue', 'c2.discourse', 'c2.inference', 'c2.register', 'c2.mediate', 'c2.critical', 'c2.fluent'], interactions: 10 },
];

export function assessmentFor(target: CourseLevelId): AssessmentSpec | undefined {
  return ASSESSMENTS.find((a) => a.level === target);
}

/** Constrói uma "lição-avaliação" como conversa: o professor conduz perguntas
   abertas que exigem as competências do nível-alvo. */
export function buildAssessmentLesson(target: CourseLevelId): {
  id: string;
  title: string;
  level: CourseLevelId;
  interactions: Interaction[];
} {
  const spec = assessmentFor(target);
  const level = LEVEL_BY_ID[target];
  const comps = (spec?.competencies ?? competenciesForLevel(target).map((c) => c.id))
    .map((id) => CURATED_BY_COMPETENCY[id])
    .filter(Boolean);

  const interactions: Interaction[] = [];
  interactions.push({
    id: 'a.intro',
    type: 'teach',
    german: `Bereit? Wir machen eine kleine Konversation auf ${level.label}-Niveau.`,
    portuguese: `Pronto? Vamos fazer uma pequena conversa no nível ${level.label}.`,
    support: 1,
  });

  comps.forEach((c, i) => {
    const seed = c.core[0] ?? { german: 'Erzählen Sie mir davon.', portuguese: 'Me conte sobre isso.' };
    interactions.push({
      id: `a.q${i}`,
      type: 'open',
      german: seed.german,
      portuguese: seed.portuguese,
      expected: seed.german.split(' ')[0].toLowerCase(),
      hint: seed.german,
      support: 0,
      praise: 'Gut!',
    });
  });

  interactions.push({
    id: 'a.done',
    type: 'done',
    german: 'Sehr gut! Das war eine gute Konversation.',
    portuguese: 'Muito bem! Foi uma boa conversa.',
    support: 0,
  });

  return {
    id: `assessment.${target}`,
    title: spec?.title ?? `Avaliação ${level.label}`,
    level: target,
    interactions,
  };
}

/** Decide aprovação no assessment a partir do desempenho da sessão.
   critério: >= 60% de acerto/produção e >= 50% de espontaneidade. */
export function gradeAssessment(
  target: CourseLevelId,
  spoken: number,
  spontaneous: number,
  reinforced: number,
): { passed: boolean; score: number; reason: string } {
  const total = Math.max(1, spoken + reinforced);
  const productionRate = spoken / total;
  const spontaneityRate = spoken > 0 ? spontaneous / spoken : 0;
  const score = Math.round((productionRate * 0.6 + spontaneityRate * 0.4) * 100);
  const passed = score >= 60 && productionRate >= 0.5;
  const reason = passed
    ? `Desempenho compatível com ${LEVEL_BY_ID[target].label}.`
    : 'Ainda há lacunas — vamos reforçar antes de avançar.';
  return { passed, score, reason };
}

/** Verifica se o assessment do próximo nível está disponível. */
export function nextAssessmentTarget(p: CourseProgress): CourseLevelId | null {
  return nextLevel(p.currentLevel);
}

export function isAssessmentUnlocked(p: CourseProgress): boolean {
  const target = nextAssessmentTarget(p);
  if (!target) return false;
  // só destrava quando o nível atual está consolidado (pré-requisito do CourseProgressEngine)
  return levelIndex(p.currentLevel) >= levelIndex(target) - 1;
}
