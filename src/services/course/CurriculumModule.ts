/**
 * CurriculumModule — projeção de unidades/competências existentes em módulos.
 * Não duplica targets; não altera Live/pedagogia; deriva progresso de learning + CourseProgress.
 */
import type { PhraseConfidence, UserLearningProfile } from '@/services/learning/ConfidenceService';
import { isMastered, stateIndex } from '@/services/learning/ConfidenceService';
import { isAutomated, readAutomationScore } from '@/services/learning/AutomationScoreEngine';
import { isZeroLanguagePhraseAccepted } from '@/services/teacher/ZeroLanguageMode';
import type { CourseLevelId, CourseProgress } from './types';
import { COMPETENCY_BY_ID } from './competencies';
import { isContentUnlocked } from './CourseUnlockService';
import {
  getModules,
  getModule,
  listUnitsAsModules,
  type CurriculumModuleDef,
} from './CurriculumModuleRegistry';

export type { CurriculumModuleDef };

/** Vista rica do módulo (estado + métricas derivadas). */
export interface CurriculumModule extends CurriculumModuleDef {
  available: boolean;
  locked: boolean;
  completed: boolean;
  progress: number;
  mastery: number;
  autonomy: number;
  status: 'completed' | 'current' | 'available' | 'locked';
  masteryLabel: string;
}

export interface CurrentModuleSnapshot {
  level: CourseLevelId;
  module: CurriculumModule | null;
  targetId: string | null;
  journeyComplete: boolean;
}

export interface ModuleSessionContext {
  level: CourseLevelId;
  moduleId: string;
  unitId: string;
  title: string;
  competencyIds: string[];
  targetIds: string[];
}

const MODULE_SESSION_KEY = 'dt_selected_module_context';

/** Mesmo critério dos currículos A1–C2 (local a cada *Curriculum.ts). */
export function isCurricularTargetReady(conf: PhraseConfidence | undefined): boolean {
  if (!conf) return false;
  if (isMastered(conf) || isAutomated(conf)) return true;
  if ((conf.timesCorrect ?? 0) >= 2 && conf.confidence >= 55) return true;
  if (stateIndex(conf.state) >= stateIndex('answeredAlone') && (conf.timesCorrect ?? 0) >= 1) return true;
  return false;
}

function isTargetReady(level: CourseLevelId, targetId: string, learning: UserLearningProfile): boolean {
  const conf = learning.phrases[targetId];
  if (level === 'L0') return isZeroLanguagePhraseAccepted(conf);
  return isCurricularTargetReady(conf);
}

function targetProgressScore(level: CourseLevelId, targetId: string, learning: UserLearningProfile): number {
  const conf = learning.phrases[targetId];
  if (!conf) return 0;
  if (level === 'L0') {
    if (isZeroLanguagePhraseAccepted(conf)) return 100;
    if ((conf.timesCorrect ?? 0) > 0 || (conf.timesProduced ?? 0) > 0) {
      return Math.min(70, 25 + (conf.confidence ?? 0) * 0.4);
    }
    return 0;
  }
  if (isMastered(conf) || isAutomated(conf)) return 100;
  if (isCurricularTargetReady(conf)) return 80;
  if ((conf.timesCorrect ?? 0) > 0) return Math.min(70, 30 + conf.confidence * 0.4);
  if ((conf.timesProduced ?? 0) > 0) return 15;
  return 0;
}

function targetAutonomyScore(targetId: string, learning: UserLearningProfile): number {
  const conf = learning.phrases[targetId];
  if (!conf) return 0;
  if (isAutomated(conf) || conf.state === 'automatic' || conf.state === 'spontaneous') return 100;
  const auto = readAutomationScore(conf);
  if (typeof auto === 'number' && Number.isFinite(auto)) return Math.max(0, Math.min(100, auto));
  if (stateIndex(conf.state) >= stateIndex('answeredAlone')) return 55;
  if ((conf.timesCorrect ?? 0) > 0) return 30;
  return 0;
}

export function masteryLabelFromScore(score: number): string {
  if (score >= 85) return 'Excelente';
  if (score >= 70) return 'Bom';
  if (score >= 45) return 'Em progresso';
  if (score > 0) return 'Iniciante';
  return 'A iniciar';
}

export function getModuleProgress(
  level: CourseLevelId,
  moduleId: string,
  learning: UserLearningProfile,
): number {
  const mod = getModule(level, moduleId);
  if (!mod || mod.targetIds.length === 0) return 0;
  const sum = mod.targetIds.reduce((acc, id) => acc + targetProgressScore(level, id, learning), 0);
  return Math.round(sum / mod.targetIds.length);
}

export function getModuleMastery(
  level: CourseLevelId,
  moduleId: string,
  learning: UserLearningProfile,
  course?: CourseProgress | null,
): number {
  const mod = getModule(level, moduleId);
  if (!mod) return 0;
  if (course && mod.competencyIds.length > 0) {
    const vals = mod.competencyIds.map((id) => course.competencyMastery[id] ?? 0);
    const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
    if (avg > 0) return Math.round(avg);
  }
  return getModuleProgress(level, moduleId, learning);
}

export function getModuleAutonomy(
  level: CourseLevelId,
  moduleId: string,
  learning: UserLearningProfile,
): number {
  const mod = getModule(level, moduleId);
  if (!mod || mod.targetIds.length === 0) return 0;
  const sum = mod.targetIds.reduce((acc, id) => acc + targetAutonomyScore(id, learning), 0);
  return Math.round(sum / mod.targetIds.length);
}

export function isModuleCompleted(
  level: CourseLevelId,
  moduleId: string,
  learning: UserLearningProfile,
): boolean {
  const mod = getModule(level, moduleId);
  if (!mod || mod.targetIds.length === 0) return false;
  return mod.targetIds.every((id) => isTargetReady(level, id, learning));
}

/**
 * Desbloqueio DENTRO do nível: nível acessível + pré-requisitos de unidade concluídos.
 * Gates L0→A1→… continuam autoridade entre níveis (isContentUnlocked).
 */
export function isModuleUnlocked(
  level: CourseLevelId,
  moduleId: string,
  learning: UserLearningProfile,
  userLevel: CourseLevelId,
): boolean {
  if (!isContentUnlocked(level, userLevel)) return false;
  const mod = getModule(level, moduleId);
  if (!mod) return false;
  if (mod.prerequisiteModuleIds.length === 0) return true;
  return mod.prerequisiteModuleIds.every((pre) => isModuleCompleted(level, pre, learning));
}

function enrichModule(
  def: CurriculumModuleDef,
  learning: UserLearningProfile,
  userLevel: CourseLevelId,
  course: CourseProgress | null | undefined,
  currentId: string | null,
): CurriculumModule {
  const unlocked = isModuleUnlocked(def.level, def.id, learning, userLevel);
  const completed = unlocked && isModuleCompleted(def.level, def.id, learning);
  const progress = unlocked ? getModuleProgress(def.level, def.id, learning) : 0;
  const mastery = unlocked ? getModuleMastery(def.level, def.id, learning, course) : 0;
  const autonomy = unlocked ? getModuleAutonomy(def.level, def.id, learning) : 0;
  const locked = !unlocked;
  let status: CurriculumModule['status'] = 'locked';
  if (completed) status = 'completed';
  else if (unlocked && def.id === currentId) status = 'current';
  else if (unlocked) status = 'available';
  return {
    ...def,
    available: unlocked,
    locked,
    completed,
    progress,
    mastery,
    autonomy,
    status,
    masteryLabel: masteryLabelFromScore(mastery),
  };
}

export function getModulesWithProgress(
  level: CourseLevelId,
  learning: UserLearningProfile,
  userLevel: CourseLevelId,
  course?: CourseProgress | null,
): CurriculumModule[] {
  const defs = getModules(level);
  const currentId = pickCurrentModuleId(level, learning, userLevel);
  return defs.map((d) => enrichModule(d, learning, userLevel, course, currentId));
}

function pickCurrentModuleId(
  level: CourseLevelId,
  learning: UserLearningProfile,
  userLevel: CourseLevelId,
): string | null {
  if (!isContentUnlocked(level, userLevel)) return null;
  for (const def of getModules(level)) {
    if (!isModuleUnlocked(level, def.id, learning, userLevel)) continue;
    if (!isModuleCompleted(level, def.id, learning)) return def.id;
  }
  return null;
}

export function getCurrentModule(
  learning: UserLearningProfile,
  userLevel: CourseLevelId,
  course?: CourseProgress | null,
  level: CourseLevelId = userLevel,
): CurrentModuleSnapshot {
  if (!isContentUnlocked(level, userLevel)) {
    return { level, module: null, targetId: null, journeyComplete: false };
  }
  const views = getModulesWithProgress(level, learning, userLevel, course);
  const current = views.find((m) => m.status === 'current') ?? null;
  if (current) {
    const targetId = nextTargetInModule(current, learning);
    return { level, module: current, targetId, journeyComplete: false };
  }
  const allDone = views.length > 0 && views.every((m) => m.completed);
  return {
    level,
    module: views.length ? views[views.length - 1]! : null,
    targetId: null,
    journeyComplete: allDone && level === 'C2',
  };
}

export function getNextModule(
  level: CourseLevelId,
  learning: UserLearningProfile,
  userLevel: CourseLevelId,
  course?: CourseProgress | null,
): CurriculumModule | null {
  const views = getModulesWithProgress(level, learning, userLevel, course);
  const current = views.find((m) => m.status === 'current');
  if (current) {
    const idx = views.findIndex((m) => m.id === current.id);
    return views[idx + 1] ?? null;
  }
  const firstLocked = views.find((m) => m.locked);
  return firstLocked ?? null;
}

export function nextTargetInModule(
  mod: CurriculumModuleDef,
  learning: UserLearningProfile,
): string | null {
  for (const id of mod.targetIds) {
    if (!isTargetReady(mod.level, id, learning)) return id;
  }
  return mod.targetIds[0] ?? null;
}

/** Progresso agregado do nível via módulos (0–100). */
export function getLevelModulesProgressPercent(
  level: CourseLevelId,
  learning: UserLearningProfile,
  userLevel: CourseLevelId,
  course?: CourseProgress | null,
): number | null {
  if (!isContentUnlocked(level, userLevel)) return null;
  const views = getModulesWithProgress(level, learning, userLevel, course);
  if (views.length === 0) return 0;
  const sum = views.reduce((acc, m) => acc + m.progress, 0);
  return Math.round(sum / views.length);
}

export function storeSelectedModuleContext(ctx: ModuleSessionContext): void {
  if (typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.setItem(MODULE_SESSION_KEY, JSON.stringify(ctx));
  } catch {
    /* ignore */
  }
}

export function readSelectedModuleContext(): ModuleSessionContext | null {
  if (typeof sessionStorage === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(MODULE_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ModuleSessionContext>;
    if (!parsed.level || !parsed.moduleId || !parsed.unitId || !Array.isArray(parsed.targetIds)) {
      return null;
    }
    return {
      level: parsed.level,
      moduleId: parsed.moduleId,
      unitId: parsed.unitId,
      title: typeof parsed.title === 'string' ? parsed.title : '',
      competencyIds: Array.isArray(parsed.competencyIds) ? parsed.competencyIds.map(String) : [],
      targetIds: parsed.targetIds.map(String),
    };
  } catch {
    return null;
  }
}

export function clearSelectedModuleContext(): void {
  if (typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.removeItem(MODULE_SESSION_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * Valida o contexto antes do runtime usar.
 * - nível/módulo/unidade coerentes com o registry
 * - módulo pertence ao nível da sessão (sem downgrade / nível errado)
 * - refresca targetIds do registry (não confia só no storage)
 */
export function validateModuleSessionContext(
  ctx: ModuleSessionContext | null | undefined,
  sessionLevel: CourseLevelId | null | undefined,
): ModuleSessionContext | null {
  if (!ctx || !sessionLevel) return null;
  if (ctx.level !== sessionLevel) return null;
  const mod = getModule(ctx.level, ctx.moduleId);
  if (!mod) return null;
  if (mod.unitId !== ctx.unitId) return null;
  if (!mod.targetIds.length) return null;
  return {
    level: mod.level,
    moduleId: mod.id,
    unitId: mod.unitId,
    title: mod.title,
    competencyIds: [...mod.competencyIds],
    targetIds: [...mod.targetIds],
  };
}

/**
 * Lê, valida e limpa o storage (consumo único por abertura de sessão).
 * Contexto inválido → null + limpeza (não contamina a próxima sessão).
 */
export function consumeSelectedModuleContext(
  sessionLevel: CourseLevelId | null | undefined,
): ModuleSessionContext | null {
  const raw = readSelectedModuleContext();
  clearSelectedModuleContext();
  return validateModuleSessionContext(raw, sessionLevel);
}

/** Contexto pedagógico para o Live (nível / módulo / unidade / target). */
export function formatModulePedagogicalContext(
  ctx: ModuleSessionContext | null,
  targetId?: string | null,
): string | null {
  if (!ctx) return null;
  const order = listUnitsAsModules(ctx.level).find((m) => m.id === ctx.moduleId)?.order ?? '?';
  const comps = ctx.competencyIds
    .map((id) => COMPETENCY_BY_ID[id]?.title ?? id)
    .filter(Boolean)
    .join(', ');
  const lines = [
    `NÍVEL: ${ctx.level}`,
    `MÓDULO: ${order} — ${ctx.title}`,
    `UNIDADE: ${ctx.unitId}`,
  ];
  if (targetId) lines.push(`TARGET: ${targetId}`);
  if (comps) lines.push(`COMPETÊNCIA: ${comps}`);
  return lines.join('\n');
}

export function buildModuleSessionContext(mod: CurriculumModuleDef): ModuleSessionContext {
  return {
    level: mod.level,
    moduleId: mod.id,
    unitId: mod.unitId,
    title: mod.title,
    competencyIds: [...mod.competencyIds],
    targetIds: [...mod.targetIds],
  };
}
