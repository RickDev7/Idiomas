/* Autoavaliação cotidiana (tela 4). Sem jargão CEFR para o aluno. */
import type { Level, SelfReportedLevel, UserProfile } from '@/types';
import type { CourseLevelId } from '@/services/course/types';

export type DiagnosticPromptKind = 'none' | 'optional' | 'suggested' | 'recommended';

export type LevelIconId =
  | 'sprout'
  | 'star'
  | 'chat'
  | 'signal'
  | 'arrowUp'
  | 'rocket'
  | 'trophy'
  | 'target';

export interface GermanLevelOption {
  id: SelfReportedLevel;
  icon: LevelIconId;
  color: string;
  label: string;
  desc: string;
  special?: boolean;
  diagnostic: DiagnosticPromptKind;
  requiresDiagnostic: boolean;
  estimatedCEFR: string;
  startCourse: CourseLevelId;
  coarse: Level;
}

export const GERMAN_LEVEL_OPTIONS: GermanLevelOption[] = [
  {
    id: 'zero',
    icon: 'sprout',
    color: '#22c55e',
    label: 'Zero',
    desc: 'Nunca estudei alemão.',
    diagnostic: 'none',
    requiresDiagnostic: false,
    estimatedCEFR: 'pré-A1',
    startCourse: 'L0',
    coarse: 'zero',
  },
  {
    id: 'beginner',
    icon: 'star',
    color: '#eab308',
    label: 'Iniciante',
    desc: 'Sei algumas palavras e frases.',
    diagnostic: 'optional',
    requiresDiagnostic: false,
    estimatedCEFR: 'A1',
    startCourse: 'A1',
    coarse: 'little',
  },
  {
    id: 'basic',
    icon: 'chat',
    color: '#16a34a',
    label: 'Básico',
    desc: 'Consigo entender e falar frases simples.',
    diagnostic: 'optional',
    requiresDiagnostic: false,
    estimatedCEFR: 'A1/A2',
    startCourse: 'A2',
    coarse: 'basic',
  },
  {
    id: 'intermediate',
    icon: 'signal',
    color: '#3b82f6',
    label: 'Intermediário',
    desc: 'Consigo conversar sobre assuntos cotidianos.',
    diagnostic: 'suggested',
    requiresDiagnostic: false,
    estimatedCEFR: 'A2/B1',
    startCourse: 'A2',
    coarse: 'basic',
  },
  {
    id: 'intermediate_plus',
    icon: 'arrowUp',
    color: '#8b5cf6',
    label: 'Intermediário+',
    desc: 'Consigo me virar, mas ainda travo ou cometo erros.',
    diagnostic: 'suggested',
    requiresDiagnostic: false,
    estimatedCEFR: 'B1/B2',
    startCourse: 'B1',
    coarse: 'basic',
  },
  {
    id: 'advanced',
    icon: 'rocket',
    color: '#f97316',
    label: 'Avançado',
    desc: 'Consigo conversar sobre assuntos complexos.',
    diagnostic: 'suggested',
    requiresDiagnostic: false,
    estimatedCEFR: 'B2/C1',
    startCourse: 'B2',
    coarse: 'basic',
  },
  {
    id: 'very_advanced',
    icon: 'trophy',
    color: '#ef4444',
    label: 'Muito avançado',
    desc: 'Quero melhorar fluência, precisão e naturalidade.',
    diagnostic: 'suggested',
    requiresDiagnostic: false,
    estimatedCEFR: 'C1/C2',
    startCourse: 'C1',
    coarse: 'basic',
  },
  {
    id: 'unknown',
    icon: 'target',
    color: '#8b5cf6',
    label: 'Não sei meu nível',
    desc: 'Faça um teste rápido comigo.',
    special: true,
    diagnostic: 'recommended',
    requiresDiagnostic: true,
    estimatedCEFR: 'a calibrar',
    startCourse: 'L0',
    coarse: 'zero',
  },
];

export const LEVEL_OPTION_BY_ID: Record<SelfReportedLevel, GermanLevelOption> =
  Object.fromEntries(GERMAN_LEVEL_OPTIONS.map((o) => [o.id, o])) as Record<SelfReportedLevel, GermanLevelOption>;

export function optionFor(id: SelfReportedLevel | null | undefined): GermanLevelOption | undefined {
  if (!id) return undefined;
  return LEVEL_OPTION_BY_ID[id];
}

export function courseLevelFromSelfReported(id: SelfReportedLevel | null | undefined): CourseLevelId {
  return optionFor(id)?.startCourse ?? 'L0';
}

export function coarseLevelFromSelfReported(id: SelfReportedLevel | null | undefined): Level {
  return optionFor(id)?.coarse ?? 'zero';
}

/** Nível que o treino deve usar: evidência de desempenho primeiro, depois autoavaliação. */
export function startingCourseLevel(
  profile: Pick<UserProfile, 'level' | 'selfReportedLevel' | 'diagnosticLevel'>,
): CourseLevelId {
  if (profile.diagnosticLevel && isCourseLevelId(profile.diagnosticLevel)) return profile.diagnosticLevel;
  if (profile.selfReportedLevel) return courseLevelFromSelfReported(profile.selfReportedLevel);
  if (profile.level === 'zero') return 'L0';
  if (profile.level === 'little') return 'A1';
  return 'A2';
}

export function isCourseLevelId(v: string): v is CourseLevelId {
  return v === 'L0' || v === 'A1' || v === 'A2' || v === 'B1' || v === 'B2' || v === 'C1' || v === 'C2';
}

export function isAbsoluteBeginner(id: SelfReportedLevel | null | undefined): boolean {
  return !id || id === 'zero';
}

export function diagnosticPromptFor(id: SelfReportedLevel | null): DiagnosticPromptKind {
  return optionFor(id)?.diagnostic ?? 'none';
}

export function requiresDiagnostic(id: SelfReportedLevel | null): boolean {
  return optionFor(id)?.requiresDiagnostic === true;
}
