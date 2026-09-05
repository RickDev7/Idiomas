/**
 * CurriculumModuleRegistry — units existentes → módulos (referência a targetIds).
 * L0: units + phraseIds derivados de L0_COMPETENCY_PHRASE_IDS (ZeroLanguageMode).
 * A1–C2: units de levels.ts (phraseIds já canônicos).
 */
import type { CourseLevelId, CourseUnit } from './types';
import { LEVEL_BY_ID, LEVEL_ORDER } from './levels';
import { COMPETENCY_BY_ID } from './competencies';
import { phraseIdsForL0Competency } from './L0Curriculum';

/** Definição estática do módulo (sem estado de progresso). */
export interface CurriculumModuleDef {
  id: string;
  level: CourseLevelId;
  title: string;
  description: string;
  order: number;
  unitId: string;
  competencyIds: string[];
  targetIds: string[];
  prerequisiteModuleIds: string[];
}

function friendlyTitle(unit: CourseUnit): string {
  if (unit.competencies.length === 1) {
    const c = COMPETENCY_BY_ID[unit.competencies[0]!];
    if (c?.title) return c.title;
  }
  if (unit.competencies.length > 1) {
    const titles = unit.competencies
      .map((id) => COMPETENCY_BY_ID[id]?.title)
      .filter((t): t is string => !!t);
    if (titles.length) return titles.join(' e ');
  }
  return unit.title;
}

function friendlyDescription(unit: CourseUnit, level: CourseLevelId): string {
  if (unit.competencies.length === 1) {
    const c = COMPETENCY_BY_ID[unit.competencies[0]!];
    if (c?.description) return c.description;
  }
  const levelLabel = LEVEL_BY_ID[level]?.label ?? level;
  return `${levelLabel} · ${unit.title}`;
}

function targetIdsForUnit(level: CourseLevelId, unit: CourseUnit): string[] {
  if (level === 'L0') {
    const ids: string[] = [];
    const seen = new Set<string>();
    for (const comp of unit.competencies) {
      for (const id of phraseIdsForL0Competency(comp)) {
        if (seen.has(id)) continue;
        seen.add(id);
        ids.push(id);
      }
    }
    return ids;
  }
  return [...unit.phraseIds];
}

function listUnits(level: CourseLevelId): CourseUnit[] {
  return LEVEL_BY_ID[level].modules.flatMap((m) => m.units);
}

/** Lista módulos = units do nível, ordem curricular. */
export function listUnitsAsModules(level: CourseLevelId): CurriculumModuleDef[] {
  const units = listUnits(level);
  return units.map((unit, index) => ({
    id: unit.id,
    level,
    title: friendlyTitle(unit),
    description: friendlyDescription(unit, level),
    order: index + 1,
    unitId: unit.id,
    competencyIds: [...unit.competencies],
    targetIds: targetIdsForUnit(level, unit),
    prerequisiteModuleIds: [...unit.prerequisites],
  }));
}

const CACHE = new Map<CourseLevelId, CurriculumModuleDef[]>();

function cached(level: CourseLevelId): CurriculumModuleDef[] {
  let hit = CACHE.get(level);
  if (!hit) {
    hit = listUnitsAsModules(level);
    CACHE.set(level, hit);
  }
  return hit;
}

export function getModules(level: CourseLevelId): CurriculumModuleDef[] {
  return cached(level);
}

export function getModule(level: CourseLevelId, moduleId: string): CurriculumModuleDef | null {
  return cached(level).find((m) => m.id === moduleId) ?? null;
}

export function assertCurriculumModulesIntegrity(): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  const allTargetIds = new Set<string>();

  for (const level of LEVEL_ORDER) {
    const mods = getModules(level);
    if (mods.length === 0) {
      errors.push(`${level}: nenhum módulo`);
      continue;
    }
    const seenMod = new Set<string>();
    for (const m of mods) {
      if (seenMod.has(m.id)) errors.push(`${level}: módulo duplicado ${m.id}`);
      seenMod.add(m.id);
      if (m.order < 1) errors.push(`${m.id}: order inválido`);
      if (!m.title.trim()) errors.push(`${m.id}: título vazio`);
      if (m.targetIds.length === 0) errors.push(`${m.id}: sem targetIds`);
      if (m.competencyIds.length === 0) errors.push(`${m.id}: sem competências`);
      for (const pre of m.prerequisiteModuleIds) {
        if (!mods.some((x) => x.id === pre)) {
          errors.push(`${m.id}: pré-requisito ausente ${pre}`);
        }
      }
      for (const tid of m.targetIds) {
        if (level === 'L0') {
          if (!tid.startsWith('l0-') && tid !== 'survival-arbeite') {
            errors.push(`${m.id}: target L0 suspeito ${tid}`);
          }
        } else {
          const prefix = `${level.toLowerCase()}-`;
          if (!tid.startsWith(prefix)) {
            errors.push(`${m.id}: target fora do nível ${tid}`);
          }
        }
        if (allTargetIds.has(tid)) {
          // Mesmo target em dois módulos = duplicação indevida
          errors.push(`target duplicado entre módulos: ${tid}`);
        }
        allTargetIds.add(tid);
      }
    }
  }

  return { ok: errors.length === 0, errors };
}
