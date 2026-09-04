/**
 * Graduação L0 → A1 reutilizando CourseProgressEngine + LevelAssessment.
 * NÃO usa "N frases aceitas = A1" como regra única.
 */
import type { UserProfile } from '@/types';
import type { UserLearningProfile } from '@/services/learning/ConfidenceService';
import { isZeroLanguagePhraseAccepted, isL0CoreCurriculumComplete } from '@/services/teacher/ZeroLanguageMode';
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
import { isA1CurriculumComplete, a1CompetencyMasteryFromLearning, getA1TargetsByCompetency } from './A1Curriculum';
import {
  isA2CurriculumComplete,
  a2CompetencyMasteryFromLearning,
  getA2TargetsByCompetency,
} from './A2Curriculum';

/** Evidência L0 por competência (IDs reais do ZeroLanguageMode). */
const L0_COMPETENCY_PHRASE_IDS: Record<string, string[]> = {
  'l0.greet': ['l0-guten-morgen', 'l0-guten-tag', 'l0-guten-abend', 'l0-gute-nacht', 'l0-hallo', 'l0-tschuess'],
  'l0.introduce': ['l0-ich-heisse', 'l0-ich-bin'],
  'l0.basics': ['l0-ich-wohne', 'l0-ich-komme', 'survival-arbeite'],
  'l0.yesno': ['l0-ja', 'l0-nein'],
  'l0.thanks': ['l0-danke', 'l0-bitte'],
  'l0.needs': ['l0-pause', 'l0-hook-ich-moechte', 'l0-hook-ich-brauche'],
  'l0.help': ['l0-hilfe', 'l0-verstehe-nicht'],
  'l0.repeat': ['l0-noch-einmal'],
};

function masteryFromPhraseIds(learning: UserLearningProfile, ids: string[]): number {
  if (ids.length === 0) return 0;
  let accepted = 0;
  let produced = 0;
  let confidenceSum = 0;
  for (const id of ids) {
    const c = learning.phrases[id];
    if (!c) continue;
    if (isZeroLanguagePhraseAccepted(c)) accepted += 1;
    if ((c.timesProduced ?? 0) > 0 || (c.timesCorrect ?? 0) > 0) produced += 1;
    confidenceSum += c.confidence ?? 0;
  }
  const acceptRate = accepted / ids.length;
  const produceRate = produced / ids.length;
  const avgConf = confidenceSum / Math.max(1, ids.filter((id) => learning.phrases[id]).length);
  return Math.round(Math.min(100, acceptRate * 55 + produceRate * 25 + (avgConf / 100) * 20));
}

/** Sincroniza competencyMastery L0 a partir do learning real (não inventa progresso). */
export function syncL0CompetencyMasteryFromLearning(
  progress: CourseProgress,
  learning: UserLearningProfile,
): CourseProgress {
  let p = progress;
  const coreDone = isL0CoreCurriculumComplete(learning);
  for (const comp of competenciesForLevel('L0')) {
    const ids = L0_COMPETENCY_PHRASE_IDS[comp.id] ?? [];
    let m = masteryFromPhraseIds(learning, ids);
    // Cobertura core L0 completa → competências atingem o limiar (ainda exige assessment).
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
 * 1) evidência core L0 aceita (pré-condição de cobertura)
 * 2) sync mastery → readyForNextLevel
 * 3) gradeAssessment('A1', …) aprovado
 * 4) advanceToNextLevel
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

  if (!isL0CoreCurriculumComplete(learning)) {
    return { graduated: false, reason: 'l0_core_incomplete', progress: p };
  }

  p = syncL0CompetencyMasteryFromLearning(p, learning);

  if (!readyForNextLevel(p)) {
    await saveCourseProgress(p);
    return { graduated: false, reason: 'not_ready_for_next_level', progress: p };
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
    reason: 'l0_to_a1_via_readyForNextLevel+gradeAssessment',
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

  const grade = gradeAssessment('A2', spoken, spontaneous, reinforced);
  if (!grade.passed) {
    await saveCourseProgress(p);
    return {
      graduated: false,
      reason: `a2_assessment_failed:${grade.reason}`,
      progress: p,
      assessmentScore: grade.score,
    };
  }

  p = advanceToNextLevel(p); // A1 → A2 (currículo A2 executável)
  await saveCourseProgress(p);

  return {
    graduated: true,
    reason: 'a1_to_a2_via_readyForNextLevel+gradeAssessment',
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
 * Gate A2 → B1 (currículo B1 permanece bloqueado).
 * Mesma arquitetura: complete → mastery sync → readyForNextLevel → assessment → advance.
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

  const grade = gradeAssessment('B1', spoken, spontaneous, reinforced);
  if (!grade.passed) {
    await saveCourseProgress(p);
    return {
      graduated: false,
      reason: `b1_assessment_failed:${grade.reason}`,
      progress: p,
      assessmentScore: grade.score,
    };
  }

  p = advanceToNextLevel(p); // A2 → B1 (currículo B1 permanece bloqueado)
  await saveCourseProgress(p);

  return {
    graduated: true,
    reason: 'a2_to_b1_gate_passed_curriculum_blocked',
    progress: p,
    assessmentScore: grade.score,
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
  if (progress.currentLevel === 'B1' || progress.currentLevel === 'B2') {
    next.level = 'basic';
  }
  if (!next.diagnosticLevel || next.diagnosticLevel === 'L0') {
    next.diagnosticLevel = progress.currentLevel;
  } else if (
    progress.currentLevel === 'A1' ||
    progress.currentLevel === 'A2' ||
    progress.currentLevel === 'B1'
  ) {
    next.diagnosticLevel = progress.currentLevel;
  }
  await saveProfile(next);
  return next;
}
