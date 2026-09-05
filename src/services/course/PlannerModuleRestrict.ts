/**
 * Restrição opcional do planner a um módulo selecionado (targetIds).
 * Sem restrição → comportamento idêntico ao planner atual.
 */

export type PlannerModuleRestrictOpts = {
  /** Quando definido e não vazio, só estes IDs são elegíveis. */
  restrictToTargetIds?: readonly string[] | null;
};

export function hasModuleRestrict(
  restrictToTargetIds?: readonly string[] | null,
): restrictToTargetIds is readonly string[] {
  return Array.isArray(restrictToTargetIds) && restrictToTargetIds.length > 0;
}

export function isInModuleScope(
  id: string,
  restrictToTargetIds?: readonly string[] | null,
): boolean {
  if (!hasModuleRestrict(restrictToTargetIds)) return true;
  return restrictToTargetIds.includes(id);
}

export function scopeCurriculumTargets<T extends { id: string }>(
  all: readonly T[],
  restrictToTargetIds?: readonly string[] | null,
): T[] {
  if (!hasModuleRestrict(restrictToTargetIds)) return [...all];
  const set = new Set(restrictToTargetIds);
  return all.filter((t) => set.has(t.id));
}

export function scopePhrasePool<T extends { id: string }>(
  pool: readonly T[],
  restrictToTargetIds?: readonly string[] | null,
): T[] {
  return scopeCurriculumTargets(pool, restrictToTargetIds);
}
