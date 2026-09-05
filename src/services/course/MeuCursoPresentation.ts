/**
 * Apresentação de "Meu Curso" — labels amigáveis derivados do currículo existente.
 * Sem lógica de progresso própria (usa CurriculumModule / CourseUnlock).
 */
import type { CourseLevelId } from './types';
import { LEVEL_ORDER, nextLevel } from './levels';
import type { CurriculumModule } from './CurriculumModule';

/** Título curto do nível na jornada visual. */
export const LEVEL_JOURNEY_TITLE: Record<CourseLevelId, string> = {
  L0: 'Primeiros passos',
  A1: 'Vida cotidiana',
  A2: 'Independência cotidiana',
  B1: 'Autonomia funcional',
  B2: 'Fluência funcional',
  C1: 'Comunicação avançada',
  C2: 'Domínio comunicativo',
};

/** Subtítulo curto (só apresentação — alinhado à referência visual). */
export const LEVEL_JOURNEY_BLURB: Record<CourseLevelId, string> = {
  L0: 'Comece a falar com frases essenciais.',
  A1: 'Fundamentos do dia a dia.',
  A2: 'Fale sobre sua rotina, hábitos e preferências.',
  B1: 'Converse com mais autonomia em situações reais.',
  B2: 'Fluência para trabalho e vida social.',
  C1: 'Nuance, persuasão e registro formal.',
  C2: 'Domínio quase nativo em qualquer contexto.',
};

export function levelJourneyTitle(level: CourseLevelId): string {
  return LEVEL_JOURNEY_TITLE[level] ?? level;
}

export function levelJourneyBlurb(level: CourseLevelId): string {
  return LEVEL_JOURNEY_BLURB[level] ?? '';
}

export function moduleStatusLabel(status: CurriculumModule['status']): string {
  if (status === 'completed') return 'Concluído';
  if (status === 'current') return 'Em andamento';
  if (status === 'available') return 'Disponível';
  return 'Bloqueado';
}

export function moduleStatusGlyph(status: CurriculumModule['status']): string {
  if (status === 'completed') return '✅';
  if (status === 'current') return '▶';
  if (status === 'available') return '○';
  return '🔒';
}

/** Rótulo de autonomia só com evidência (não inventa). */
export function autonomyLabel(autonomy: number | null | undefined, hasEvidence: boolean): string | null {
  if (!hasEvidence) return null;
  if (autonomy == null || !Number.isFinite(autonomy)) return null;
  if (autonomy <= 0) return null;
  if (autonomy >= 70) return 'Alta';
  if (autonomy >= 40) return 'Média';
  return 'Baixa';
}

/**
 * Progresso geral da jornada: média dos níveis desbloqueados com % real.
 * Níveis bloqueados não entram (nem como 0 inventado).
 */
export function overallJourneyPercent(
  percents: Array<{ level: CourseLevelId; percent: number | null; unlocked: boolean }>,
): number | null {
  const vals = percents.filter((p) => p.unlocked && p.percent != null).map((p) => p.percent as number);
  if (vals.length === 0) return null;
  return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
}

export function nextLevelId(current: CourseLevelId): CourseLevelId | null {
  return nextLevel(current);
}

export function isTerminalCourseLevel(level: CourseLevelId): boolean {
  return level === 'C2';
}

export function journeyLevelOrder(): CourseLevelId[] {
  return [...LEVEL_ORDER];
}
