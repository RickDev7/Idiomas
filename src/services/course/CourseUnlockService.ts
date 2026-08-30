/* Desbloqueio da jornada: acesso por nível. Não mistura domínio nem recomendação. */
import type { CourseLevelId } from './types';
import { LEVEL_ORDER, levelIndex } from './levels';
import { COMPETENCY_BY_ID } from './competencies';

export const LEVEL_RANK: Record<CourseLevelId, number> = {
  L0: 0,
  A1: 1,
  A2: 2,
  B1: 3,
  B2: 4,
  C1: 5,
  C2: 6,
};

export type AvailabilityState =
  | 'LOCKED_BY_LEVEL'
  | 'LOCKED_BY_PREREQUISITE'
  | 'AVAILABLE'
  | 'IN_PROGRESS'
  | 'MASTERED'
  | 'NEEDS_REVIEW';

export type LevelAvailability = 'completed' | 'current' | 'locked';

export interface ContentAvailability {
  state: AvailabilityState;
  unlocked: boolean;
  canOpen: boolean;
  unmetPrerequisiteId?: string;
  unmetPrerequisiteTitle?: string;
}

export function getLevelRank(level: CourseLevelId): number {
  return LEVEL_RANK[level] ?? levelIndex(level);
}

/** contentLevel <= userLevel, pela ordem oficial (não comparar strings). */
export function isContentUnlocked(contentLevel: CourseLevelId, userLevel: CourseLevelId): boolean {
  return getLevelRank(contentLevel) <= getLevelRank(userLevel);
}

export function getLevelAvailability(level: CourseLevelId, userLevel: CourseLevelId): LevelAvailability {
  const r = getLevelRank(level);
  const u = getLevelRank(userLevel);
  if (r < u) return 'completed';
  if (r === u) return 'current';
  return 'locked';
}

export function getContentAvailability(input: {
  contentLevel: CourseLevelId;
  userLevel: CourseLevelId;
  mastery: number;
  threshold: number;
  prerequisites?: string[];
  competencyMastery?: Record<string, number>;
}): ContentAvailability {
  const { contentLevel, userLevel, mastery, threshold, prerequisites = [], competencyMastery = {} } = input;

  if (!isContentUnlocked(contentLevel, userLevel)) {
    return { state: 'LOCKED_BY_LEVEL', unlocked: false, canOpen: false };
  }

  const previousLevel = getLevelRank(contentLevel) < getLevelRank(userLevel);
  if (!previousLevel) {
    const unmet = prerequisites.find((id) => (competencyMastery[id] ?? 0) < 50);
    if (unmet) {
      return {
        state: 'LOCKED_BY_PREREQUISITE',
        unlocked: true,
        canOpen: false,
        unmetPrerequisiteId: unmet,
        unmetPrerequisiteTitle: COMPETENCY_BY_ID[unmet]?.title,
      };
    }
  }

  if (mastery >= threshold) {
    return { state: 'MASTERED', unlocked: true, canOpen: true };
  }
  if (mastery > 0 && mastery < Math.min(40, threshold * 0.55)) {
    return { state: 'NEEDS_REVIEW', unlocked: true, canOpen: true };
  }
  if (mastery > 0) {
    return { state: 'IN_PROGRESS', unlocked: true, canOpen: true };
  }
  return { state: 'AVAILABLE', unlocked: true, canOpen: true };
}

export function unlockSummary(userLevel: CourseLevelId): { unlocked: CourseLevelId[]; locked: CourseLevelId[] } {
  const unlocked: CourseLevelId[] = [];
  const locked: CourseLevelId[] = [];
  for (const id of LEVEL_ORDER) {
    if (isContentUnlocked(id, userLevel)) unlocked.push(id);
    else locked.push(id);
  }
  return { unlocked, locked };
}
