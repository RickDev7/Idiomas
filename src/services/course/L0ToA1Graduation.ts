/**
 * Graduação L0 → A1 reutilizando CourseProgressEngine + LevelAssessment.
 * NÃO usa "N frases aceitas = A1" como regra única.
 */
import type { UserProfile } from '@/types';
import type { UserLearningProfile } from '@/services/learning/ConfidenceService';
import {
  loadCourseProgress,
  saveCourseProgress,
  readyForNextLevel,
  advanceToNextLevel,
  bumpCompetency,
  getStoredCourseProgress,
} from './CourseProgressEngine';
import type { CourseProgress } from './types';
import { competenciesForLevel, COMPETENCY_BY_ID } from './competencies';
import { gradeAssessment, nextAssessmentTarget } from './LevelAssessment';
import {
  isL0CurriculumComplete,
  gradeL0ExitAssessment,
  l0CompetencyMasteryFromLearning,
} from './L0Curriculum';
import { isA1CurriculumComplete, a1CompetencyMasteryFromLearning, getA1TargetsByCompetency, gradeA1ExitAssessment } from './A1Curriculum';
import {
  isA2CurriculumComplete,
  a2CompetencyMasteryFromLearning,
  getA2TargetsByCompetency,
  gradeA2ExitAssessment,
} from './A2Curriculum';
import {
  isB1CurriculumComplete,
  b1CompetencyMasteryFromLearning,
  getB1TargetsByCompetency,
  gradeB1ExitAssessment,
} from './B1Curriculum';
import {
  isB2CurriculumComplete,
  b2CompetencyMasteryFromLearning,
  getB2TargetsByCompetency,
  gradeB2ExitAssessment,
} from './B2Curriculum';
import {
  isC1CurriculumComplete,
  c1CompetencyMasteryFromLearning,
  getC1TargetsByCompetency,
  gradeC1ExitAssessment,
} from './C1Curriculum';
import {
  isC2CurriculumComplete,
  c2CompetencyMasteryFromLearning,
  gradeC2ExitAssessment,
} from './C2Curriculum';

/** Sincroniza competencyMastery L0 a partir do learning real (não inventa progresso). */
export function syncL0CompetencyMasteryFromLearning(
  progress: CourseProgress,
  learning: UserLearningProfile,
): CourseProgress {
  let p = progress;
  const coreDone = isL0CurriculumComplete(learning);
  for (const comp of competenciesForLevel('L0')) {
    let m = l0CompetencyMasteryFromLearning(comp.id, learning);
    // Cobertura curricular L0 completa → competências atingem o limiar (ainda exige exit + assessment).
    if (coreDone && m < comp.masteryThreshold) {
      m = comp.masteryThreshold;
    }
    const cur = p.competencyMastery[comp.id] ?? 0;
    if (m > cur) {
      p = bumpCompetency(p, comp.id, m - cur);
    }
  }
  return p;
}

function learningAssessmentStats(learning: UserLearningProfile): {
  spoken: number;
  spontaneous: number;
  reinforced: number;
} {
  let spoken = 0;
  let spontaneous = 0;
  let reinforced = 0;
  for (const c of Object.values(learning.phrases)) {
    const correct = c.timesCorrect ?? 0;
    spoken += correct;
    // reforço ≈ tentativas com ajuda / erros implícitos
    if (c.needsHelp) reinforced += 1;
    if ((c.timesProduced ?? 0) > correct) reinforced += (c.timesProduced ?? 0) - correct;
    spontaneous += c.spontaneousSessions ?? 0;
    if (c.state === 'spontaneous' || c.state === 'automatic') spontaneous += 1;
  }
  return { spoken, spontaneous, reinforced };
}

export type GraduationResult = {
  graduated: boolean;
  reason: string;
  progress: CourseProgress | null;
  assessmentScore?: number;
};

/**
 * Avalia e, se aprovado, avança L0 → A1.
 * Requisitos cumulativos (não só contagem de frases):
 * 1) currículo L0 dos 8 módulos completo (completion)
 * 2) sync mastery → readyForNextLevel (mastery + autonomy/skills)
 * 3) gradeL0ExitAssessment — situações comunicativas
 * 4) gradeAssessment('A1', …) — assessment existente
 * 5) advanceToNextLevel
 */
export async function maybeGraduateL0ToA1(
  profile: UserProfile,
  learning: UserLearningProfile,
): Promise<GraduationResult> {
  const stored = getStoredCourseProgress();
  let p = stored ?? (await loadCourseProgress(profile.level));

  if (p.currentLevel !== 'L0') {
    return { graduated: false, reason: `already_${p.currentLevel}`, progress: p };
  }

  if (!isL0CurriculumComplete(learning)) {
    return { graduated: false, reason: 'l0_core_incomplete', progress: p };
  }

  p = syncL0CompetencyMasteryFromLearning(p, learning);

  if (!readyForNextLevel(p)) {
    await saveCourseProgress(p);
    return { graduated: false, reason: 'not_ready_for_next_level', progress: p };
  }

  const exitGrade = gradeL0ExitAssessment(learning);
  if (!exitGrade.passed) {
    await saveCourseProgress(p);
    return {
      graduated: false,
      reason: `l0_exit_failed:${exitGrade.reason}`,
      progress: p,
      assessmentScore: exitGrade.score,
    };
  }

  const target = nextAssessmentTarget(p);
  if (target !== 'A1') {
    return { graduated: false, reason: `unexpected_target_${target}`, progress: p };
  }

  const stats = learningAssessmentStats(learning);
  const grade = gradeAssessment('A1', stats.spoken, stats.spontaneous, stats.reinforced);
  if (!grade.passed) {
    await saveCourseProgress(p);
    return {
      graduated: false,
      reason: `assessment_failed:${grade.reason}`,
      progress: p,
      assessmentScore: grade.score,
    };
  }

  p = advanceToNextLevel(p); // L0 → A1
  await saveCourseProgress(p);

  return {
    graduated: true,
    reason: 'l0_to_a1_via_completion+mastery+exit+gradeAssessment',
    progress: p,
    assessmentScore: grade.score,
  };
}

/** Sincroniza mastery A1 a partir do learning e decide graduação A1 → A2 (currículo A2 executável). */
export async function maybeGraduateA1ToA2(
  profile: UserProfile,
  learning: UserLearningProfile,
): Promise<GraduationResult> {
  const stored = getStoredCourseProgress();
  let p = stored ?? (await loadCourseProgress(profile.level));

  if (p.currentLevel !== 'A1') {
    return { graduated: false, reason: `not_a1_${p.currentLevel}`, progress: p };
  }

  if (!isA1CurriculumComplete(learning)) {
    return { graduated: false, reason: 'a1_curriculum_incomplete', progress: p };
  }

  for (const comp of competenciesForLevel('A1')) {
    const m = a1CompetencyMasteryFromLearning(comp.id, learning);
    const cur = p.competencyMastery[comp.id] ?? 0;
    if (m > cur) p = bumpCompetency(p, comp.id, m - cur);
  }

  // Skills no piso A1
  for (const k of ['listening', 'speaking', 'vocabulary', 'grammar'] as const) {
    if (p.skillLevels[k] === 'L0') p.skillLevels[k] = 'A1';
  }

  if (!readyForNextLevel(p)) {
    await saveCourseProgress(p);
    return { graduated: false, reason: 'not_ready_for_a2_assessment', progress: p };
  }

  const exitGrade = gradeA1ExitAssessment(learning);
  if (!exitGrade.passed) {
    await saveCourseProgress(p);
    return {
      graduated: false,
      reason: `a1_exit_incomplete:${exitGrade.reason}`,
      progress: p,
      assessmentScore: exitGrade.score,
    };
  }

  /**
   * gradeAssessment(nextLevel): igual L0→A1 / A2→B1…
   * NÃO carrega currículo A2 — só pontua produção (spoken/spontaneous/reinforced)
   * já filtrada aos IDs A1 abaixo. O parâmetro é o nível-destino para o rótulo.
   */
  const nextTarget = nextAssessmentTarget(p);
  if (nextTarget !== 'A2') {
    await saveCourseProgress(p);
    return { graduated: false, reason: `unexpected_next_${nextTarget}`, progress: p };
  }

  const stats = learningAssessmentStats(learning);
  const a1Ids = new Set(
    competenciesForLevel('A1').flatMap((c) => getA1TargetsByCompetency(c.id).map((t) => t.id)),
  );
  let spoken = 0;
  let spontaneous = 0;
  let reinforced = 0;
  for (const [id, c] of Object.entries(learning.phrases)) {
    if (!a1Ids.has(id)) continue;
    spoken += c.timesCorrect ?? 0;
    if (c.needsHelp) reinforced += 1;
    if ((c.timesProduced ?? 0) > (c.timesCorrect ?? 0)) {
      reinforced += (c.timesProduced ?? 0) - (c.timesCorrect ?? 0);
    }
    spontaneous += c.spontaneousSessions ?? 0;
  }
  if (spoken === 0) {
    spoken = stats.spoken;
    spontaneous = stats.spontaneous;
    reinforced = stats.reinforced;
  }

  const grade = gradeAssessment(nextTarget, spoken, spontaneous, reinforced);
  if (!grade.passed) {
    await saveCourseProgress(p);
    return {
      graduated: false,
      reason: `a2_readiness_failed:${grade.reason}`,
      progress: p,
      assessmentScore: grade.score,
    };
  }

  p = advanceToNextLevel(p); // A1 → A2 (currículo A2 executável)
  await saveCourseProgress(p);

  return {
    graduated: true,
    reason: 'a1_to_a2_via_complete+ready+exit+gradeAssessment(next)',
    progress: p,
    assessmentScore: grade.score,
  };
}

/** Após acerto A1: bump da competência do target. */
export async function recordA1TargetSuccess(
  profile: UserProfile,
  competencyId: string,
  delta = 8,
): Promise<CourseProgress | null> {
  if (!COMPETENCY_BY_ID[competencyId]) return null;
  try {
    let p = getStoredCourseProgress() ?? (await loadCourseProgress(profile.level));
    p = bumpCompetency(p, competencyId, delta);
    await saveCourseProgress(p);
    return p;
  } catch {
    return null;
  }
}

/** Após acerto A2: bump da competência do target. */
export async function recordA2TargetSuccess(
  profile: UserProfile,
  competencyId: string,
  delta = 8,
): Promise<CourseProgress | null> {
  if (!COMPETENCY_BY_ID[competencyId]) return null;
  try {
    let p = getStoredCourseProgress() ?? (await loadCourseProgress(profile.level));
    p = bumpCompetency(p, competencyId, delta);
    await saveCourseProgress(p);
    return p;
  } catch {
    return null;
  }
}

/**
 * Gate A2 → B1 (currículo B1 executável via B1Curriculum).
 * Fluxo: complete → mastery sync → readyForNextLevel → exit situacional A2
 * → gradeAssessment(nextAssessmentTarget=B1) com evidência só A2 → advance.
 *
 * Semântica de gradeAssessment(destino): o 1º argumento é o nível-destino
 * (rótulo/threshold), NÃO o nível avaliado. Stats já filtrados aos IDs A2.
 */
export async function maybeGraduateA2ToB1(
  profile: UserProfile,
  learning: UserLearningProfile,
): Promise<GraduationResult> {
  const stored = getStoredCourseProgress();
  let p = stored ?? (await loadCourseProgress(profile.level));

  if (p.currentLevel !== 'A2') {
    return { graduated: false, reason: `not_a2_${p.currentLevel}`, progress: p };
  }

  if (!isA2CurriculumComplete(learning)) {
    return { graduated: false, reason: 'a2_curriculum_incomplete', progress: p };
  }

  for (const comp of competenciesForLevel('A2')) {
    const m = a2CompetencyMasteryFromLearning(comp.id, learning);
    const cur = p.competencyMastery[comp.id] ?? 0;
    if (m > cur) p = bumpCompetency(p, comp.id, m - cur);
  }

  for (const k of ['listening', 'speaking', 'vocabulary', 'grammar'] as const) {
    if (p.skillLevels[k] === 'L0' || p.skillLevels[k] === 'A1') p.skillLevels[k] = 'A2';
  }

  if (!readyForNextLevel(p)) {
    await saveCourseProgress(p);
    return { graduated: false, reason: 'not_ready_for_b1_assessment', progress: p };
  }

  const exitGrade = gradeA2ExitAssessment(learning);
  if (!exitGrade.passed) {
    await saveCourseProgress(p);
    return {
      graduated: false,
      reason: `a2_exit_incomplete:${exitGrade.reason}`,
      progress: p,
      assessmentScore: exitGrade.score,
    };
  }

  const nextTarget = nextAssessmentTarget(p);
  if (nextTarget !== 'B1') {
    await saveCourseProgress(p);
    return { graduated: false, reason: `unexpected_next_${nextTarget}`, progress: p };
  }

  const stats = learningAssessmentStats(learning);
  const a2Ids = new Set(
    competenciesForLevel('A2').flatMap((c) => getA2TargetsByCompetency(c.id).map((t) => t.id)),
  );
  let spoken = 0;
  let spontaneous = 0;
  let reinforced = 0;
  for (const [id, c] of Object.entries(learning.phrases)) {
    if (!a2Ids.has(id)) continue;
    spoken += c.timesCorrect ?? 0;
    if (c.needsHelp) reinforced += 1;
    if ((c.timesProduced ?? 0) > (c.timesCorrect ?? 0)) {
      reinforced += (c.timesProduced ?? 0) - (c.timesCorrect ?? 0);
    }
    spontaneous += c.spontaneousSessions ?? 0;
  }
  if (spoken === 0) {
    spoken = stats.spoken;
    spontaneous = stats.spontaneous;
    reinforced = stats.reinforced;
  }

  const grade = gradeAssessment(nextTarget, spoken, spontaneous, reinforced);
  if (!grade.passed) {
    await saveCourseProgress(p);
    return {
      graduated: false,
      reason: `b1_assessment_failed:${grade.reason}`,
      progress: p,
      assessmentScore: grade.score,
    };
  }

  p = advanceToNextLevel(p); // A2 → B1 (currículo B1 executável)
  await saveCourseProgress(p);

  return {
    graduated: true,
    reason: 'a2_to_b1_via_readyForNextLevel+exit+gradeAssessment',
    progress: p,
    assessmentScore: grade.score,
  };
}

/** Após acerto B1: bump da competência do target. */
export async function recordB1TargetSuccess(
  profile: UserProfile,
  competencyId: string,
  delta = 8,
): Promise<CourseProgress | null> {
  if (!COMPETENCY_BY_ID[competencyId]) return null;
  try {
    let p = getStoredCourseProgress() ?? (await loadCourseProgress(profile.level));
    p = bumpCompetency(p, competencyId, delta);
    await saveCourseProgress(p);
    return p;
  } catch {
    return null;
  }
}

/**
 * Gate B1 → B2 (currículo B2 executável).
 * Fluxo: complete → mastery sync → readyForNextLevel → exit situacional B1
 * → gradeAssessment(nextAssessmentTarget=B2) com evidência só B1 → advance.
 *
 * Semântica de gradeAssessment(destino): o 1º argumento é o nível-destino
 * (rótulo/threshold), NÃO o nível avaliado. Stats já filtrados aos IDs B1.
 */
export async function maybeGraduateB1ToB2(
  profile: UserProfile,
  learning: UserLearningProfile,
): Promise<GraduationResult> {
  const stored = getStoredCourseProgress();
  let p = stored ?? (await loadCourseProgress(profile.level));

  if (p.currentLevel !== 'B1') {
    return { graduated: false, reason: `not_b1_${p.currentLevel}`, progress: p };
  }

  if (!isB1CurriculumComplete(learning)) {
    return { graduated: false, reason: 'b1_curriculum_incomplete', progress: p };
  }

  for (const comp of competenciesForLevel('B1')) {
    const m = b1CompetencyMasteryFromLearning(comp.id, learning);
    const cur = p.competencyMastery[comp.id] ?? 0;
    if (m > cur) p = bumpCompetency(p, comp.id, m - cur);
  }

  for (const k of ['listening', 'speaking', 'vocabulary', 'grammar'] as const) {
    if (
      p.skillLevels[k] === 'L0' ||
      p.skillLevels[k] === 'A1' ||
      p.skillLevels[k] === 'A2'
    ) {
      p.skillLevels[k] = 'B1';
    }
  }

  if (!readyForNextLevel(p)) {
    await saveCourseProgress(p);
    return { graduated: false, reason: 'not_ready_for_b2_assessment', progress: p };
  }

  const exitGrade = gradeB1ExitAssessment(learning);
  if (!exitGrade.passed) {
    await saveCourseProgress(p);
    return {
      graduated: false,
      reason: `b1_exit_incomplete:${exitGrade.reason}`,
      progress: p,
      assessmentScore: exitGrade.score,
    };
  }

  const nextTarget = nextAssessmentTarget(p);
  if (nextTarget !== 'B2') {
    await saveCourseProgress(p);
    return { graduated: false, reason: `unexpected_next_${nextTarget}`, progress: p };
  }

  const stats = learningAssessmentStats(learning);
  const b1Ids = new Set(
    competenciesForLevel('B1').flatMap((c) => getB1TargetsByCompetency(c.id).map((t) => t.id)),
  );
  let spoken = 0;
  let spontaneous = 0;
  let reinforced = 0;
  for (const [id, c] of Object.entries(learning.phrases)) {
    if (!b1Ids.has(id)) continue;
    spoken += c.timesCorrect ?? 0;
    if (c.needsHelp) reinforced += 1;
    if ((c.timesProduced ?? 0) > (c.timesCorrect ?? 0)) {
      reinforced += (c.timesProduced ?? 0) - (c.timesCorrect ?? 0);
    }
    spontaneous += c.spontaneousSessions ?? 0;
  }
  if (spoken === 0) {
    spoken = stats.spoken;
    spontaneous = stats.spontaneous;
    reinforced = stats.reinforced;
  }

  const grade = gradeAssessment(nextTarget, spoken, spontaneous, reinforced);
  if (!grade.passed) {
    await saveCourseProgress(p);
    return {
      graduated: false,
      reason: `b2_assessment_failed:${grade.reason}`,
      progress: p,
      assessmentScore: grade.score,
    };
  }

  p = advanceToNextLevel(p); // B1 → B2
  await saveCourseProgress(p);

  return {
    graduated: true,
    reason: 'b1_to_b2_via_readyForNextLevel+exit+gradeAssessment',
    progress: p,
    assessmentScore: grade.score,
  };
}

/** Após acerto B2: bump da competência do target. */
export async function recordB2TargetSuccess(
  profile: UserProfile,
  competencyId: string,
  delta = 8,
): Promise<CourseProgress | null> {
  if (!COMPETENCY_BY_ID[competencyId]) return null;
  try {
    let p = getStoredCourseProgress() ?? (await loadCourseProgress(profile.level));
    p = bumpCompetency(p, competencyId, delta);
    await saveCourseProgress(p);
    return p;
  } catch {
    return null;
  }
}

/**
 * Gate B2 → C1 (currículo C1 executável).
 * Fluxo: complete → mastery sync → readyForNextLevel → exit situacional B2
 * → gradeAssessment(nextAssessmentTarget=C1) com evidência só B2 → advance.
 *
 * Semântica de gradeAssessment(destino): o 1º argumento é o nível-destino
 * (rótulo/threshold), NÃO o nível avaliado. Stats já filtrados aos IDs B2.
 */
export async function maybeGraduateB2ToC1(
  profile: UserProfile,
  learning: UserLearningProfile,
): Promise<GraduationResult> {
  const stored = getStoredCourseProgress();
  let p = stored ?? (await loadCourseProgress(profile.level));

  if (p.currentLevel !== 'B2') {
    return { graduated: false, reason: `not_b2_${p.currentLevel}`, progress: p };
  }

  if (!isB2CurriculumComplete(learning)) {
    return { graduated: false, reason: 'b2_curriculum_incomplete', progress: p };
  }

  for (const comp of competenciesForLevel('B2')) {
    const m = b2CompetencyMasteryFromLearning(comp.id, learning);
    const cur = p.competencyMastery[comp.id] ?? 0;
    if (m > cur) p = bumpCompetency(p, comp.id, m - cur);
  }

  for (const k of ['listening', 'speaking', 'vocabulary', 'grammar'] as const) {
    if (
      p.skillLevels[k] === 'L0' ||
      p.skillLevels[k] === 'A1' ||
      p.skillLevels[k] === 'A2' ||
      p.skillLevels[k] === 'B1'
    ) {
      p.skillLevels[k] = 'B2';
    }
  }

  if (!readyForNextLevel(p)) {
    await saveCourseProgress(p);
    return { graduated: false, reason: 'not_ready_for_c1_assessment', progress: p };
  }

  const exitGrade = gradeB2ExitAssessment(learning);
  if (!exitGrade.passed) {
    await saveCourseProgress(p);
    return {
      graduated: false,
      reason: `b2_exit_incomplete:${exitGrade.reason}`,
      progress: p,
      assessmentScore: exitGrade.score,
    };
  }

  const nextTarget = nextAssessmentTarget(p);
  if (nextTarget !== 'C1') {
    await saveCourseProgress(p);
    return { graduated: false, reason: `unexpected_next_${nextTarget}`, progress: p };
  }

  const stats = learningAssessmentStats(learning);
  const b2Ids = new Set(
    competenciesForLevel('B2').flatMap((c) => getB2TargetsByCompetency(c.id).map((t) => t.id)),
  );
  let spoken = 0;
  let spontaneous = 0;
  let reinforced = 0;
  for (const [id, c] of Object.entries(learning.phrases)) {
    if (!b2Ids.has(id)) continue;
    spoken += c.timesCorrect ?? 0;
    if (c.needsHelp) reinforced += 1;
    if ((c.timesProduced ?? 0) > (c.timesCorrect ?? 0)) {
      reinforced += (c.timesProduced ?? 0) - (c.timesCorrect ?? 0);
    }
    spontaneous += c.spontaneousSessions ?? 0;
  }
  if (spoken === 0) {
    spoken = stats.spoken;
    spontaneous = stats.spontaneous;
    reinforced = stats.reinforced;
  }

  const grade = gradeAssessment(nextTarget, spoken, spontaneous, reinforced);
  if (!grade.passed) {
    await saveCourseProgress(p);
    return {
      graduated: false,
      reason: `c1_assessment_failed:${grade.reason}`,
      progress: p,
      assessmentScore: grade.score,
    };
  }

  p = advanceToNextLevel(p); // B2 → C1 (currículo C1 executável)
  await saveCourseProgress(p);

  return {
    graduated: true,
    reason: 'b2_to_c1_via_readyForNextLevel+exit+gradeAssessment',
    progress: p,
    assessmentScore: grade.score,
  };
}

/** Após acerto C1: bump da competência do target. */
export async function recordC1TargetSuccess(
  profile: UserProfile,
  competencyId: string,
  delta = 8,
): Promise<CourseProgress | null> {
  if (!COMPETENCY_BY_ID[competencyId]) return null;
  try {
    let p = getStoredCourseProgress() ?? (await loadCourseProgress(profile.level));
    p = bumpCompetency(p, competencyId, delta);
    await saveCourseProgress(p);
    return p;
  } catch {
    return null;
  }
}

/**
 * Gate C1 → C2 (currículo C2 executável).
 * Fluxo: complete → mastery sync → readyForNextLevel → exit situacional C1
 * → gradeAssessment(nextAssessmentTarget=C2) com evidência só C1 → advance.
 *
 * Semântica de gradeAssessment(destino): o 1º argumento é o nível-destino
 * (rótulo/threshold), NÃO o nível avaliado. Stats já filtrados aos IDs C1.
 */
export async function maybeGraduateC1ToC2(
  profile: UserProfile,
  learning: UserLearningProfile,
): Promise<GraduationResult> {
  const stored = getStoredCourseProgress();
  let p = stored ?? (await loadCourseProgress(profile.level));

  if (p.currentLevel !== 'C1') {
    return { graduated: false, reason: `not_c1_${p.currentLevel}`, progress: p };
  }

  if (!isC1CurriculumComplete(learning)) {
    return { graduated: false, reason: 'c1_curriculum_incomplete', progress: p };
  }

  for (const comp of competenciesForLevel('C1')) {
    const m = c1CompetencyMasteryFromLearning(comp.id, learning);
    const cur = p.competencyMastery[comp.id] ?? 0;
    if (m > cur) p = bumpCompetency(p, comp.id, m - cur);
  }

  for (const k of ['listening', 'speaking', 'vocabulary', 'grammar'] as const) {
    if (
      p.skillLevels[k] === 'L0' ||
      p.skillLevels[k] === 'A1' ||
      p.skillLevels[k] === 'A2' ||
      p.skillLevels[k] === 'B1' ||
      p.skillLevels[k] === 'B2'
    ) {
      p.skillLevels[k] = 'C1';
    }
  }

  if (!readyForNextLevel(p)) {
    await saveCourseProgress(p);
    return { graduated: false, reason: 'not_ready_for_c2_assessment', progress: p };
  }

  const exitGrade = gradeC1ExitAssessment(learning);
  if (!exitGrade.passed) {
    await saveCourseProgress(p);
    return {
      graduated: false,
      reason: `c1_exit_incomplete:${exitGrade.reason}`,
      progress: p,
      assessmentScore: exitGrade.score,
    };
  }

  const nextTarget = nextAssessmentTarget(p);
  if (nextTarget !== 'C2') {
    await saveCourseProgress(p);
    return { graduated: false, reason: `unexpected_next_${nextTarget}`, progress: p };
  }

  const stats = learningAssessmentStats(learning);
  const c1Ids = new Set(
    competenciesForLevel('C1').flatMap((c) => getC1TargetsByCompetency(c.id).map((t) => t.id)),
  );
  let spoken = 0;
  let spontaneous = 0;
  let reinforced = 0;
  for (const [id, c] of Object.entries(learning.phrases)) {
    if (!c1Ids.has(id)) continue;
    spoken += c.timesCorrect ?? 0;
    if (c.needsHelp) reinforced += 1;
    if ((c.timesProduced ?? 0) > (c.timesCorrect ?? 0)) {
      reinforced += (c.timesProduced ?? 0) - (c.timesCorrect ?? 0);
    }
    spontaneous += c.spontaneousSessions ?? 0;
  }
  if (spoken === 0) {
    spoken = stats.spoken;
    spontaneous = stats.spontaneous;
    reinforced = stats.reinforced;
  }

  const grade = gradeAssessment(nextTarget, spoken, spontaneous, reinforced);
  if (!grade.passed) {
    await saveCourseProgress(p);
    return {
      graduated: false,
      reason: `c2_assessment_failed:${grade.reason}`,
      progress: p,
      assessmentScore: grade.score,
    };
  }

  p = advanceToNextLevel(p); // C1 → C2 (currículo C2 executável)
  await saveCourseProgress(p);

  return {
    graduated: true,
    reason: 'c1_to_c2_via_readyForNextLevel+exit+gradeAssessment',
    progress: p,
    assessmentScore: grade.score,
  };
}

/** Após acerto C2: bump da competência do target. */
export async function recordC2TargetSuccess(
  profile: UserProfile,
  competencyId: string,
  delta = 8,
): Promise<CourseProgress | null> {
  if (!COMPETENCY_BY_ID[competencyId]) return null;
  try {
    let p = getStoredCourseProgress() ?? (await loadCourseProgress(profile.level));
    p = bumpCompetency(p, competencyId, delta);
    await saveCourseProgress(p);
    return p;
  } catch {
    return null;
  }
}

/**
 * Terminal C2 — não há currículo D1/superior. Nunca avança past C2.
 */
export async function maybeGraduateC2ToHigher(
  profile: UserProfile,
  learning: UserLearningProfile,
): Promise<GraduationResult> {
  const stored = getStoredCourseProgress();
  let p = stored ?? (await loadCourseProgress(profile.level));

  if (p.currentLevel !== 'C2') {
    return { graduated: false, reason: 'not_c2', progress: p };
  }

  if (!isC2CurriculumComplete(learning)) {
    return { graduated: false, reason: 'incomplete', progress: p };
  }

  for (const comp of competenciesForLevel('C2')) {
    const m = c2CompetencyMasteryFromLearning(comp.id, learning);
    const cur = p.competencyMastery[comp.id] ?? 0;
    if (m > cur) p = bumpCompetency(p, comp.id, m - cur);
  }

  for (const k of ['listening', 'speaking', 'vocabulary', 'grammar'] as const) {
    if (
      p.skillLevels[k] === 'L0' ||
      p.skillLevels[k] === 'A1' ||
      p.skillLevels[k] === 'A2' ||
      p.skillLevels[k] === 'B1' ||
      p.skillLevels[k] === 'B2' ||
      p.skillLevels[k] === 'C1'
    ) {
      p.skillLevels[k] = 'C2';
    }
  }

  // readyForNextLevel é false em C2 (não existe nextLevel). Exigir mastery; se OK → exit situacional → terminal.
  const comps = competenciesForLevel('C2');
  const allStrong = comps.every((c) => (p.competencyMastery[c.id] ?? 0) >= c.masteryThreshold);
  if (!allStrong) {
    await saveCourseProgress(p);
    return { graduated: false, reason: 'not ready', progress: p };
  }

  const exitGrade = gradeC2ExitAssessment(learning);
  if (!exitGrade.passed) {
    await saveCourseProgress(p);
    return {
      graduated: false,
      reason: `c2_exit_incomplete:${exitGrade.reason}`,
      progress: p,
      assessmentScore: exitGrade.score,
    };
  }

  // Nunca advanceToNextLevel / nunca criar D1 — C2 é terminal.
  await saveCourseProgress(p);
  return {
    graduated: false,
    reason: 'c2_terminal_no_higher_curriculum',
    progress: p,
    assessmentScore: exitGrade.score,
  };
}

export async function applyProfileLevelAfterGraduation(
  profile: UserProfile,
  progress: CourseProgress,
  saveProfile: (p: UserProfile) => Promise<void> | void,
): Promise<UserProfile> {
  const next = { ...profile };
  if (progress.currentLevel === 'A1' && profile.level === 'zero') {
    next.level = 'little';
  }
  if (progress.currentLevel === 'A2' && (profile.level === 'zero' || profile.level === 'little')) {
    next.level = 'basic';
  }
  if (
    progress.currentLevel === 'B1' ||
    progress.currentLevel === 'B2' ||
    progress.currentLevel === 'C1' ||
    progress.currentLevel === 'C2'
  ) {
    next.level = 'basic';
  }
  if (!next.diagnosticLevel || next.diagnosticLevel === 'L0') {
    next.diagnosticLevel = progress.currentLevel;
  } else if (
    progress.currentLevel === 'A1' ||
    progress.currentLevel === 'A2' ||
    progress.currentLevel === 'B1' ||
    progress.currentLevel === 'B2' ||
    progress.currentLevel === 'C1' ||
    progress.currentLevel === 'C2'
  ) {
    next.diagnosticLevel = progress.currentLevel;
  }
  await saveProfile(next);
  return next;
}
