/**
 * ContinueCourse — resumo de continuação curricular derivado das APIs existentes.
 * Não cria progresso paralelo; não força target no clique (módulo → planner).
 */
import type { UserLearningProfile } from '@/services/learning/ConfidenceService';
import {
  zeroLanguageSeedPhrases,
  L0_BRIDGE_A1_SPECS,
  isZeroLanguagePhraseAccepted,
} from '@/services/teacher/ZeroLanguageMode';
import type { CourseLevelId, CourseProgress } from './types';
import { COMPETENCY_BY_ID } from './competencies';
import { nextLevel } from './levels';
import { isContentUnlocked } from './CourseUnlockService';
import { getA1TargetById } from './A1Curriculum';
import { getA2TargetById } from './A2Curriculum';
import { getB1TargetById } from './B1Curriculum';
import { getB2TargetById } from './B2Curriculum';
import { getC1TargetById } from './C1Curriculum';
import { getC2TargetById } from './C2Curriculum';
import {
  getCurrentModule,
  getModulesWithProgress,
  getModuleProgress,
  isModuleCompleted,
  nextTargetInModule,
  isCurricularTargetReady,
  type CurriculumModule,
  type ModuleSessionContext,
} from './CurriculumModule';
import { getModules } from './CurriculumModuleRegistry';

export type ContinueCourseStatus =
  | 'loading'
  | 'ready'
  | 'new_user'
  | 'in_progress'
  | 'module_completed'
  | 'level_completed'
  | 'course_completed'
  | 'no_data'
  | 'invalid';

export type ContinueCourseNextAction =
  | 'start_course'
  | 'continue_module'
  | 'next_module'
  | 'next_level'
  | 'course_complete'
  | 'none';

export interface ContinueCourseState {
  status: ContinueCourseStatus;
  level: CourseLevelId | null;
  moduleId: string | null;
  moduleOrder: number | null;
  moduleTitle: string | null;
  moduleProgress: number | null;
  moduleCount: number | null;
  targetId: string | null;
  targetGerman: string | null;
  targetPortuguese: string | null;
  activityLabel: string | null;
  competencyId: string | null;
  competencyTitle: string | null;
  nextAction: ContinueCourseNextAction;
  available: boolean;
  isCourseComplete: boolean;
  ctaLabel: string;
  headline: string;
  subline: string | null;
  /** Módulo a abrir na sessão (contexto). */
  sessionModule: CurriculumModule | null;
  /** Target explícito válido (só se já selecionado / pendente no módulo). */
  explicitTargetId: string | null;
}

function lookupTargetText(targetId: string): { german: string; portuguese: string } | null {
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

function activityLabelFromTarget(
  targetId: string | null,
  competencyId: string | null,
): string | null {
  if (competencyId) {
    const title = COMPETENCY_BY_ID[competencyId]?.title;
    if (title) return title;
  }
  if (!targetId) return null;
  const text = lookupTargetText(targetId);
  if (text?.portuguese) return text.portuguese;
  if (text?.german) return text.german;
  return null;
}

function hasAnyCurricularEvidence(
  level: CourseLevelId,
  learning: UserLearningProfile,
): boolean {
  for (const mod of getModules(level)) {
    for (const id of mod.targetIds) {
      const c = learning.phrases[id];
      if (!c) continue;
      if ((c.timesCorrect ?? 0) > 0 || (c.timesProduced ?? 0) > 0 || (c.timesSeen ?? 0) > 0 || c.confidence > 0) {
        return true;
      }
    }
  }
  return false;
}

function isTargetPending(level: CourseLevelId, targetId: string, learning: UserLearningProfile): boolean {
  const conf = learning.phrases[targetId];
  if (level === 'L0') return !isZeroLanguagePhraseAccepted(conf);
  return !isCurricularTargetReady(conf);
}

function emptyState(
  status: ContinueCourseStatus,
  partial?: Partial<ContinueCourseState>,
): ContinueCourseState {
  return {
    status,
    level: null,
    moduleId: null,
    moduleOrder: null,
    moduleTitle: null,
    moduleProgress: null,
    moduleCount: null,
    targetId: null,
    targetGerman: null,
    targetPortuguese: null,
    activityLabel: null,
    competencyId: null,
    competencyTitle: null,
    nextAction: 'none',
    available: false,
    isCourseComplete: false,
    ctaLabel: 'Continuar curso',
    headline: 'Continue seu alemão',
    subline: null,
    sessionModule: null,
    explicitTargetId: null,
    ...partial,
  };
}

export type GetContinueCourseStateInput = {
  learning: UserLearningProfile | null | undefined;
  userLevel: CourseLevelId | null | undefined;
  course?: CourseProgress | null;
  /** Target explícito (ex.: sessionStorage LessonStartIntent), se válido. */
  explicitTargetId?: string | null;
};

/**
 * Deriva o estado de continuação curricular.
 * Prioridade: target explícito válido → módulo atual → próximo módulo → próximo nível → C2 fim.
 */
export function getContinueCourseState(input: GetContinueCourseStateInput): ContinueCourseState {
  const learning = input.learning;
  const userLevel = input.userLevel;

  if (!learning || !userLevel) {
    return emptyState('no_data', {
      headline: 'Seu curso',
      subline: 'Carregando progresso…',
    });
  }

  if (!isContentUnlocked(userLevel, userLevel)) {
    return emptyState('invalid', {
      level: userLevel,
      headline: 'Progresso indisponível',
      subline: 'Não foi possível determinar o ponto de continuação.',
    });
  }

  const snap = getCurrentModule(learning, userLevel, input.course, userLevel);
  const modules = getModules(userLevel);
  const views = getModulesWithProgress(userLevel, learning, userLevel, input.course);
  const levelDone = views.length > 0 && views.every((m) => m.completed);

  if (snap.journeyComplete || (userLevel === 'C2' && levelDone)) {
    return emptyState('course_completed', {
      level: 'C2',
      moduleId: snap.module?.id ?? null,
      moduleOrder: snap.module?.order ?? null,
      moduleTitle: snap.module?.title ?? null,
      moduleProgress: snap.module ? getModuleProgress('C2', snap.module.id, learning) : 100,
      moduleCount: modules.length,
      nextAction: 'course_complete',
      available: false,
      isCourseComplete: true,
      ctaLabel: 'Ver meu curso',
      headline: '🏆 Jornada concluída',
      subline: 'Você chegou ao nível mais avançado disponível no curso.',
      sessionModule: snap.module,
    });
  }

  // Target explícito válido (mesmo nível / módulo curricular, ainda pendente)
  const explicit = (input.explicitTargetId || '').trim() || null;
  let explicitValid: string | null = null;
  if (explicit) {
    const inLevel = modules.some((m) => m.targetIds.includes(explicit));
    if (inLevel && isTargetPending(userLevel, explicit, learning)) {
      explicitValid = explicit;
    }
  }

  if (levelDone) {
    const nxt = nextLevel(userLevel);
    const unlocked = nxt ? isContentUnlocked(nxt, userLevel) : false;
    return emptyState('level_completed', {
      level: userLevel,
      moduleId: snap.module?.id ?? null,
      moduleOrder: snap.module?.order ?? null,
      moduleTitle: snap.module?.title ?? null,
      moduleProgress: 100,
      moduleCount: modules.length,
      nextAction: unlocked && nxt ? 'next_level' : 'none',
      available: unlocked && !!nxt,
      isCourseComplete: false,
      ctaLabel: unlocked && nxt ? 'Continuar curso' : 'Ver meu curso',
      headline: 'Nível concluído',
      subline: nxt
        ? unlocked
          ? `Próximo nível: ${nxt}`
          : `Próximo nível ${nxt} aguarda os gates de progressão.`
        : null,
      sessionModule: null,
    });
  }

  const current = snap.module;
  const evidence = hasAnyCurricularEvidence(userLevel, learning);

  // Novo usuário: sem evidência curricular no nível
  if (!evidence && current && current.progress === 0 && current.order === 1) {
    const first = current;
    const tid = nextTargetInModule(first, learning);
    const text = tid ? lookupTargetText(tid) : null;
    const compId = first.competencyIds[0] ?? null;
    return {
      status: 'new_user',
      level: userLevel,
      moduleId: first.id,
      moduleOrder: first.order,
      moduleTitle: first.title,
      moduleProgress: 0,
      moduleCount: modules.length,
      targetId: tid,
      targetGerman: text?.german ?? null,
      targetPortuguese: text?.portuguese ?? null,
      activityLabel: activityLabelFromTarget(tid, compId),
      competencyId: compId,
      competencyTitle: compId ? COMPETENCY_BY_ID[compId]?.title ?? null : null,
      nextAction: 'start_course',
      available: true,
      isCourseComplete: false,
      ctaLabel: 'Começar curso',
      headline: 'Comece sua jornada de alemão',
      subline: null,
      sessionModule: first,
      explicitTargetId: null,
    };
  }

  if (!current) {
    return emptyState('invalid', {
      level: userLevel,
      headline: 'Continue seu alemão',
      subline: 'Abra Meu Curso para ver os módulos.',
      ctaLabel: 'Ver meu curso',
      available: true,
      nextAction: 'none',
    });
  }

  // Celebrar módulo anterior concluído quando o atual começa do zero (order > 1)
  const prev = views.find((m) => m.order === current.order - 1);
  const justAdvanced =
    prev?.completed === true
    && current.progress === 0
    && !isModuleCompleted(userLevel, current.id, learning);

  const pendingId = explicitValid ?? snap.targetId ?? nextTargetInModule(current, learning);
  const text = pendingId ? lookupTargetText(pendingId) : null;
  const compId = current.competencyIds[0] ?? null;

  const progress = getModuleProgress(userLevel, current.id, learning);

  if (justAdvanced) {
    return {
      status: 'module_completed',
      level: userLevel,
      moduleId: current.id,
      moduleOrder: current.order,
      moduleTitle: current.title,
      moduleProgress: progress,
      moduleCount: modules.length,
      targetId: pendingId,
      targetGerman: text?.german ?? null,
      targetPortuguese: text?.portuguese ?? null,
      activityLabel: activityLabelFromTarget(pendingId, compId),
      competencyId: compId,
      competencyTitle: compId ? COMPETENCY_BY_ID[compId]?.title ?? null : null,
      nextAction: 'next_module',
      available: true,
      isCourseComplete: false,
      ctaLabel: 'Continuar',
      headline: `Você concluiu o Módulo ${prev!.order}`,
      subline: `Próximo: Módulo ${current.order} · ${current.title}`,
      sessionModule: current,
      explicitTargetId: explicitValid,
    };
  }

  return {
    status: 'in_progress',
    level: userLevel,
    moduleId: current.id,
    moduleOrder: current.order,
    moduleTitle: current.title,
    moduleProgress: progress,
    moduleCount: modules.length,
    targetId: pendingId,
    targetGerman: text?.german ?? null,
    targetPortuguese: text?.portuguese ?? null,
    activityLabel: activityLabelFromTarget(pendingId, compId),
    competencyId: compId,
    competencyTitle: compId ? COMPETENCY_BY_ID[compId]?.title ?? null : null,
    nextAction: 'continue_module',
    available: true,
    isCourseComplete: false,
    ctaLabel: 'Continuar curso',
    headline: 'Continue seu alemão',
    subline: null,
    sessionModule: current,
    explicitTargetId: explicitValid,
  };
}

/** Abre a sessão curricular existente com contexto de módulo (planner escolhe o target). */
export function beginContinueCourseSession(
  navigate: (to: string) => void,
  state: ContinueCourseState,
  opts: {
    storeModuleContext: (ctx: ModuleSessionContext) => void;
    buildModuleContext: (mod: CurriculumModule) => ModuleSessionContext;
    clearSelectedLearningTarget: () => void;
    goJornada?: () => void;
  },
): void {
  if (state.isCourseComplete || state.nextAction === 'course_complete') {
    opts.goJornada?.() ?? navigate('/jornada');
    return;
  }
  if (state.nextAction === 'none' && !state.sessionModule) {
    opts.goJornada?.() ?? navigate('/jornada');
    return;
  }
  if (state.nextAction === 'next_level') {
    opts.goJornada?.() ?? navigate('/jornada');
    return;
  }
  const mod = state.sessionModule;
  if (mod) {
    opts.storeModuleContext(opts.buildModuleContext(mod));
  }
  opts.clearSelectedLearningTarget();
  navigate('/sessao?type=lesson');
}
