/**
 * ModuleDetails — estado de apresentação do detalhe de um módulo.
 * Deriva só de CurriculumModule / Registry / competências / targets existentes.
 */
import type { UserLearningProfile } from '@/services/learning/ConfidenceService';
import {
  zeroLanguageSeedPhrases,
  L0_BRIDGE_A1_SPECS,
  isZeroLanguagePhraseAccepted,
} from '@/services/teacher/ZeroLanguageMode';
import type { CourseLevelId, CourseProgress } from './types';
import { COMPETENCY_BY_ID } from './competencies';
import { LEVEL_ORDER } from './levels';
import { isCourseLevelId } from '@/services/onboarding/GermanLevelOptions';
import { getA1TargetById } from './A1Curriculum';
import { getA2TargetById } from './A2Curriculum';
import { getB1TargetById } from './B1Curriculum';
import { getB2TargetById } from './B2Curriculum';
import { getC1TargetById } from './C1Curriculum';
import { getC2TargetById } from './C2Curriculum';
import {
  getModulesWithProgress,
  getModuleProgress,
  nextTargetInModule,
  isCurricularTargetReady,
  buildModuleSessionContext,
  storeSelectedModuleContext,
  type CurriculumModule,
  type ModuleSessionContext,
} from './CurriculumModule';
import { getModule, getModules } from './CurriculumModuleRegistry';
import { autonomyLabel, moduleStatusLabel, moduleStatusGlyph } from './MeuCursoPresentation';

export type ModuleTargetActivityStatus = 'completed' | 'current' | 'available' | 'locked';

export interface ModuleTargetActivity {
  id: string;
  german: string | null;
  portuguese: string | null;
  label: string;
  status: ModuleTargetActivityStatus;
  statusLabel: string;
  glyph: string;
  trainable: boolean;
}

export interface ModuleCompetencyView {
  id: string;
  title: string;
  description: string;
}

export type ModuleDetailsCtaKind =
  | 'continue_training'
  | 'continue_next_module'
  | 'view_course'
  | 'locked'
  | 'none';

export interface ModuleDetailsState {
  ok: boolean;
  level: CourseLevelId | null;
  moduleId: string | null;
  module: CurriculumModule | null;
  description: string | null;
  competencies: ModuleCompetencyView[];
  learningObjectives: string[];
  progress: number | null;
  mastery: number | null;
  masteryLabel: string | null;
  autonomy: number | null;
  autonomyLabel: string | null;
  activities: ModuleTargetActivity[];
  nextActivity: ModuleTargetActivity | null;
  statusLabel: string;
  statusGlyph: string;
  lockedReason: string | null;
  prevModule: CurriculumModule | null;
  nextModule: CurriculumModule | null;
  nextModuleUnlocked: boolean;
  levelComplete: boolean;
  journeyComplete: boolean;
  ctaKind: ModuleDetailsCtaKind;
  ctaLabel: string;
  sessionModule: CurriculumModule | null;
}

export function parseCourseLevelParam(raw: string | null | undefined): CourseLevelId | null {
  if (!raw) return null;
  const normalized = decodeURIComponent(raw).trim().toUpperCase();
  if (normalized === '0' || normalized === 'N0') return 'L0';
  if (isCourseLevelId(normalized)) return normalized;
  return null;
}

export function moduleDetailPath(level: CourseLevelId, moduleId: string): string {
  return `/curso/${level.toLowerCase()}/${encodeURIComponent(moduleId)}`;
}

export function lookupModuleTargetText(
  targetId: string,
): { german: string; portuguese: string } | null {
  const a1 = getA1TargetById(targetId);
  if (a1) return { german: a1.german, portuguese: a1.portuguese };
  const a2 = getA2TargetById(targetId);
  if (a2) return { german: a2.german, portuguese: a2.portuguese };
  const b1 = getB1TargetById(targetId);
  if (b1) return { german: b1.german, portuguese: b1.portuguese };
  const b2 = getB2TargetById(targetId);
  if (b2) return { german: b2.german, portuguese: b2.portuguese };
  const c1 = getC1TargetById(targetId);
  if (c1) return { german: c1.german, portuguese: c1.portuguese };
  const c2 = getC2TargetById(targetId);
  if (c2) return { german: c2.german, portuguese: c2.portuguese };
  const seed = zeroLanguageSeedPhrases().find((p) => p.id === targetId);
  if (seed) return { german: seed.german, portuguese: seed.portuguese };
  const bridge = L0_BRIDGE_A1_SPECS.find((p) => p.id === targetId);
  if (bridge) return { german: bridge.german, portuguese: bridge.portuguese };
  return null;
}

function isTargetReady(level: CourseLevelId, targetId: string, learning: UserLearningProfile): boolean {
  const conf = learning.phrases[targetId];
  if (level === 'L0') return isZeroLanguagePhraseAccepted(conf);
  return isCurricularTargetReady(conf);
}

function activityLabel(targetId: string, competencyId: string | null): string {
  const text = lookupModuleTargetText(targetId);
  if (text?.portuguese) return text.portuguese;
  if (competencyId) {
    const title = COMPETENCY_BY_ID[competencyId]?.title;
    if (title) return title;
  }
  if (text?.german) return text.german;
  return targetId;
}

function competencyIdForTarget(level: CourseLevelId, targetId: string): string | null {
  if (level === 'A1') return getA1TargetById(targetId)?.competencyId ?? null;
  if (level === 'A2') return getA2TargetById(targetId)?.competencyId ?? null;
  if (level === 'B1') return getB1TargetById(targetId)?.competencyId ?? null;
  if (level === 'B2') return getB2TargetById(targetId)?.competencyId ?? null;
  if (level === 'C1') return getC1TargetById(targetId)?.competencyId ?? null;
  if (level === 'C2') return getC2TargetById(targetId)?.competencyId ?? null;
  return null;
}

function emptyDetails(partial?: Partial<ModuleDetailsState>): ModuleDetailsState {
  return {
    ok: false,
    level: null,
    moduleId: null,
    module: null,
    description: null,
    competencies: [],
    learningObjectives: [],
    progress: null,
    mastery: null,
    masteryLabel: null,
    autonomy: null,
    autonomyLabel: null,
    activities: [],
    nextActivity: null,
    statusLabel: 'Indisponível',
    statusGlyph: '🔒',
    lockedReason: null,
    prevModule: null,
    nextModule: null,
    nextModuleUnlocked: false,
    levelComplete: false,
    journeyComplete: false,
    ctaKind: 'none',
    ctaLabel: 'Voltar',
    sessionModule: null,
    ...partial,
  };
}

function dedupeObjectives(lines: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    const key = line.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(line);
  }
  return out;
}

export type GetModuleDetailsInput = {
  level: CourseLevelId | null | undefined;
  moduleId: string | null | undefined;
  learning: UserLearningProfile | null | undefined;
  userLevel: CourseLevelId | null | undefined;
  course?: CourseProgress | null;
};

export function getModuleDetailsState(input: GetModuleDetailsInput): ModuleDetailsState {
  const level = input.level ?? null;
  const moduleId = (input.moduleId || '').trim() || null;
  const learning = input.learning;
  const userLevel = input.userLevel ?? null;

  if (!level || !moduleId || !learning || !userLevel) {
    return emptyDetails({ lockedReason: 'Módulo não encontrado.' });
  }

  const def = getModule(level, moduleId);
  if (!def) {
    return emptyDetails({
      level,
      moduleId,
      lockedReason: 'Módulo não encontrado.',
    });
  }

  const views = getModulesWithProgress(level, learning, userLevel, input.course);
  const mod = views.find((m) => m.id === moduleId) ?? null;
  if (!mod) {
    return emptyDetails({
      level,
      moduleId,
      lockedReason: 'Módulo não encontrado.',
    });
  }

  const idx = views.findIndex((m) => m.id === moduleId);
  const prevModule = idx > 0 ? views[idx - 1]! : null;
  const nextModule = idx >= 0 && idx < views.length - 1 ? views[idx + 1]! : null;

  const competencies: ModuleCompetencyView[] = mod.competencyIds
    .map((id) => {
      const c = COMPETENCY_BY_ID[id];
      if (!c) return null;
      return { id, title: c.title, description: c.description };
    })
    .filter((c): c is ModuleCompetencyView => !!c);

  const learningObjectives = dedupeObjectives([
    mod.description,
    ...competencies.map((c) => c.description),
    ...competencies.map((c) => c.title),
  ]);

  const pendingId = mod.locked ? null : nextTargetInModule(mod, learning);

  const activities: ModuleTargetActivity[] = mod.targetIds.map((id) => {
    const text = lookupModuleTargetText(id);
    const ready = isTargetReady(level, id, learning);
    const compId = competencyIdForTarget(level, id) ?? mod.competencyIds[0] ?? null;
    let status: ModuleTargetActivityStatus = 'available';
    if (mod.locked) status = 'locked';
    else if (ready) status = 'completed';
    else if (pendingId === id) status = 'current';
    else status = 'available';

    const glyph =
      status === 'completed' ? '✅' : status === 'current' ? '▶' : status === 'locked' ? '🔒' : '○';
    const statusLabel =
      status === 'completed'
        ? 'Concluída'
        : status === 'current'
          ? 'Próxima'
          : status === 'locked'
            ? 'Bloqueada'
            : 'Disponível';

    return {
      id,
      german: text?.german ?? null,
      portuguese: text?.portuguese ?? null,
      label: activityLabel(id, compId),
      status,
      statusLabel,
      glyph,
      trainable: !mod.locked && !!text?.german,
    };
  });

  const nextActivity =
    activities.find((a) => a.status === 'current')
    ?? (mod.completed ? null : activities.find((a) => a.status === 'available') ?? null);

  const hasEvidence = !mod.locked && (mod.progress > 0 || mod.autonomy > 0 || mod.mastery > 0);
  const autoLabel = autonomyLabel(mod.autonomy, hasEvidence);

  const levelComplete = views.length > 0 && views.every((m) => m.completed);
  const journeyComplete = levelComplete && level === 'C2';
  const nextModuleUnlocked = !!nextModule && !nextModule.locked;

  let ctaKind: ModuleDetailsCtaKind = 'none';
  let ctaLabel = 'Voltar';
  if (mod.locked) {
    ctaKind = 'locked';
    ctaLabel = 'Módulo bloqueado';
  } else if (journeyComplete) {
    ctaKind = 'view_course';
    ctaLabel = 'Ver meu curso';
  } else if (mod.completed && nextModuleUnlocked) {
    ctaKind = 'continue_next_module';
    ctaLabel = 'Continuar para o próximo';
  } else if (mod.completed && !nextModule) {
    ctaKind = 'view_course';
    ctaLabel = level === 'C2' ? 'Ver meu curso' : 'Ver meu curso';
  } else {
    ctaKind = 'continue_training';
    ctaLabel = 'Continuar treino';
  }

  let lockedReason: string | null = null;
  if (mod.locked) {
    lockedReason = prevModule
      ? `Conclua o módulo anterior (Módulo ${prevModule.order} · ${prevModule.title}) para desbloquear este módulo.`
      : 'Este módulo ainda não está disponível no seu nível atual.';
  }

  const progress = mod.locked ? null : getModuleProgress(level, moduleId, learning);

  return {
    ok: true,
    level,
    moduleId,
    module: mod,
    description: mod.description || competencies[0]?.description || null,
    competencies,
    learningObjectives,
    progress,
    mastery: mod.locked ? null : mod.mastery,
    masteryLabel: mod.locked ? null : mod.masteryLabel,
    autonomy: mod.locked || !hasEvidence ? null : mod.autonomy,
    autonomyLabel: autoLabel,
    activities,
    nextActivity,
    statusLabel: moduleStatusLabel(mod.status),
    statusGlyph: moduleStatusGlyph(mod.status),
    lockedReason,
    prevModule,
    nextModule,
    nextModuleUnlocked,
    levelComplete,
    journeyComplete,
    ctaKind,
    ctaLabel,
    sessionModule: mod.locked ? null : mod,
  };
}

/** CTA principal: módulo → context → /sessao?type=lesson (planner restrito). */
export function beginModuleTrainingSession(
  navigate: (to: string) => void,
  state: ModuleDetailsState,
  opts?: {
    /** Quando true e next module unlocked, abre o próximo. */
    preferNextModule?: boolean;
    clearSelectedLearningTarget?: () => void;
  },
): void {
  if (state.ctaKind === 'locked' || state.ctaKind === 'none') {
    navigate('/jornada');
    return;
  }
  if (state.ctaKind === 'view_course') {
    navigate('/jornada');
    return;
  }

  let mod: CurriculumModule | null = state.sessionModule;
  if (
    (opts?.preferNextModule || state.ctaKind === 'continue_next_module')
    && state.nextModule
    && state.nextModuleUnlocked
  ) {
    mod = state.nextModule;
  }
  if (!mod || mod.locked) {
    navigate('/jornada');
    return;
  }

  storeSelectedModuleContext(buildModuleSessionContext(mod));
  opts?.clearSelectedLearningTarget?.();
  navigate('/sessao?type=lesson');
}

/** Atividade específica: module context + selected target (precedência explícita). */
export function beginModuleTargetSession(
  navigate: (to: string) => void,
  state: ModuleDetailsState,
  activity: ModuleTargetActivity,
  beginSelected: (
    navigate: (to: string) => void,
    sel: { source: 'other'; targetId: string; targetPhrase?: string },
  ) => void,
): void {
  if (!state.module || state.module.locked || !activity.trainable) return;
  storeSelectedModuleContext(buildModuleSessionContext(state.module));
  beginSelected(navigate, {
    source: 'other',
    targetId: activity.id,
    targetPhrase: activity.german ?? undefined,
  });
}

export function isValidModuleRoute(
  level: CourseLevelId | null,
  moduleId: string | null,
): boolean {
  if (!level || !moduleId) return false;
  return !!getModule(level, moduleId);
}

export function moduleNavIds(level: CourseLevelId): string[] {
  return getModules(level).map((m) => m.id);
}

export function courseLevelOrder(): CourseLevelId[] {
  return [...LEVEL_ORDER];
}

export type { ModuleSessionContext };
