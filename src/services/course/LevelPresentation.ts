/* Apresentação visual do nível do curso. Não calcula o nível — só rotula o valor oficial. */
import type { CourseLevelId, CourseProgress } from './types';
import { levelIndex } from './levels';
import { overallLevel } from './CourseProgressEngine';
import type { UserProfile } from '@/types';
import {
  courseLevelFromSelfReported,
  isCourseLevelId,
} from '@/services/onboarding/GermanLevelOptions';

export type LevelPresentationIcon =
  | 'sprout'
  | 'signal'
  | 'chat'
  | 'arrowUp'
  | 'rocket'
  | 'target'
  | 'trophy';

export interface LevelPresentation {
  level: CourseLevelId;
  label: string;
  icon: LevelPresentationIcon;
  accent: string;
  description: string;
}

const PRESENTATION: Record<CourseLevelId, Omit<LevelPresentation, 'level'>> = {
  L0: {
    label: 'Nível 0',
    icon: 'sprout',
    accent: '#34d399',
    description: 'Seu nível atual',
  },
  A1: {
    label: 'A1',
    icon: 'signal',
    accent: '#93c5fd',
    description: 'Seu nível atual',
  },
  A2: {
    label: 'A2',
    icon: 'chat',
    accent: '#5b8cff',
    description: 'Seu nível atual',
  },
  B1: {
    label: 'B1',
    icon: 'arrowUp',
    accent: '#8b5cf6',
    description: 'Seu nível atual',
  },
  B2: {
    label: 'B2',
    icon: 'rocket',
    accent: '#f5a623',
    description: 'Seu nível atual',
  },
  C1: {
    label: 'C1',
    icon: 'target',
    accent: '#f87171',
    description: 'Seu nível atual',
  },
  C2: {
    label: 'C2',
    icon: 'trophy',
    accent: '#eab308',
    description: 'Seu nível atual',
  },
};

function higherLevel(a: CourseLevelId, b: CourseLevelId): CourseLevelId {
  return levelIndex(a) >= levelIndex(b) ? a : b;
}

/** Overall persistido do curso: o maior entre o overall calculado e o nível oficial da jornada. */
function liveOverall(course: CourseProgress): CourseLevelId {
  return higherLevel(overallLevel(course), course.currentLevel);
}

export function getLevelPresentation(level: CourseLevelId): LevelPresentation {
  const meta = PRESENTATION[level] ?? PRESENTATION.L0;
  return { level, ...meta };
}

/**
 * Fonte de verdade do nível exibido (Home e demais superfícies).
 * 1. diagnosticLevel
 * 2. overallLevel do curso (se persistido)
 * 3. selfReportedLevel mapeado
 * 4. Nível 0
 * Se o curso evoluiu acima do diagnóstico, o overall ao vivo vence.
 */
export function getCurrentLevel(
  profile: Pick<UserProfile, 'selfReportedLevel' | 'diagnosticLevel'>,
  course?: CourseProgress | null,
): CourseLevelId {
  const live = course ? liveOverall(course) : null;

  if (profile.diagnosticLevel && isCourseLevelId(profile.diagnosticLevel)) {
    if (live && levelIndex(live) > levelIndex(profile.diagnosticLevel)) return live;
    return profile.diagnosticLevel;
  }

  if (live) return live;

  if (profile.selfReportedLevel) return courseLevelFromSelfReported(profile.selfReportedLevel);

  return 'L0';
}

/** @deprecated use getCurrentLevel */
export function resolveDisplayLevel(
  profile: Pick<UserProfile, 'level' | 'selfReportedLevel' | 'diagnosticLevel'>,
  course: CourseProgress | null | undefined,
): CourseLevelId {
  return getCurrentLevel(profile, course);
}
