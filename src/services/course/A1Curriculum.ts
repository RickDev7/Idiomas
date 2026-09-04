/**
 * A1_CURRICULUM — fonte única executável do nível A1.
 * Não duplica frases: deriva de CURATED + units em levels.ts.
 */
import type { Phrase } from '@/types';
import type { PhraseConfidence, UserLearningProfile } from '@/services/learning/ConfidenceService';
import { isMastered, stateIndex } from '@/services/learning/ConfidenceService';
import { isAutomated, readAutomationScore } from '@/services/learning/AutomationScoreEngine';
import { CURATED } from './content';
import { LEVEL_BY_ID } from './levels';
import { COMPETENCY_BY_ID } from './competencies';

export interface A1Target {
  id: string;
  level: 'A1';
  unitId: string;
  competencyId: string;
  german: string;
  portuguese: string;
  type?: string;
  order: number;
  category: string;
}

function buildA1Targets(): A1Target[] {
  const out: A1Target[] = [];
  for (const block of CURATED.filter((c) => c.level === 'A1')) {
    const category = block.categories[0] ?? 'daily';
    block.core.forEach((phrase, idx) => {
      if (!phrase.id || !phrase.unitId) {
        throw new Error(`A1 curated phrase missing id/unitId: ${phrase.german}`);
      }
      out.push({
        id: phrase.id,
        level: 'A1',
        unitId: phrase.unitId,
        competencyId: block.competencyId,
        german: phrase.german,
        portuguese: phrase.portuguese,
        type: phrase.type,
        order: phrase.order ?? idx + 1,
        category,
      });
    });
  }
  return out.sort((a, b) => a.order - b.order);
}

/** Registry canônico A1 (ordem curricular). */
export const A1_CURRICULUM: A1Target[] = buildA1Targets();

const BY_ID = new Map(A1_CURRICULUM.map((t) => [t.id, t]));

export function getA1Targets(): A1Target[] {
  return A1_CURRICULUM;
}

export function getA1TargetById(id: string): A1Target | undefined {
  return BY_ID.get(id);
}

export function getA1TargetsByUnit(unitId: string): A1Target[] {
  return A1_CURRICULUM.filter((t) => t.unitId === unitId);
}

export function getA1TargetsByCompetency(competencyId: string): A1Target[] {
  return A1_CURRICULUM.filter((t) => t.competencyId === competencyId);
}

export function isA1TargetId(id: string | null | undefined): boolean {
  return !!id && BY_ID.has(id);
}

export function a1UnitIdsInOrder(): string[] {
  const units = LEVEL_BY_ID.A1.modules.flatMap((m) => m.units);
  return units.map((u) => u.id);
}

export function a1FirstTarget(): A1Target {
  return A1_CURRICULUM[0];
}

/** Seeds Phrase[] para o pool Live (sem depender do IndexedDB). */
export function a1CurriculumSeedPhrases(): Phrase[] {
  return A1_CURRICULUM.map((t) => ({
    id: t.id,
    german: t.german,
    portuguese: t.portuguese,
    category: t.category,
    chunk: t.german.replace(/[.…]+$/, '').trim(),
    mastery: 'recognize' as const,
    reviewStage: 'new' as const,
    nextReview: null,
    timesReviewed: 0,
    timesCorrect: 0,
    timesIncorrect: 0,
    isAutomatic: false,
    contexts: [t.competencyId, t.unitId],
  }));
}

/** Mescla seeds A1 no pool sem duplicar IDs. */
export function mergeA1CurriculumPhrases(existing: Phrase[]): Phrase[] {
  const byId = new Map(existing.map((p) => [p.id, p]));
  for (const seed of a1CurriculumSeedPhrases()) {
    if (!byId.has(seed.id)) byId.set(seed.id, seed);
  }
  // Preferir seeds A1 para IDs canônicos (texto/categoria corretos)
  for (const seed of a1CurriculumSeedPhrases()) {
    const cur = byId.get(seed.id);
    if (cur) {
      byId.set(seed.id, {
        ...cur,
        german: seed.german,
        portuguese: seed.portuguese,
        category: seed.category,
        contexts: seed.contexts,
      });
    }
  }
  return [...byId.values()];
}

/** Pool exclusivo A1 (nunca l0-*). */
export function a1PhrasePool(existing: Phrase[] = []): Phrase[] {
  const merged = mergeA1CurriculumPhrases(existing);
  const ids = new Set(A1_CURRICULUM.map((t) => t.id));
  return merged.filter((p) => ids.has(p.id));
}

function isReadyForAdvance(conf: PhraseConfidence | undefined): boolean {
  if (!conf) return false;
  if (isMastered(conf) || isAutomated(conf)) return true;
  if ((conf.timesCorrect ?? 0) >= 2 && conf.confidence >= 55) return true;
  if (stateIndex(conf.state) >= stateIndex('answeredAlone') && (conf.timesCorrect ?? 0) >= 1) return true;
  return false;
}

function isDeferred(conf: PhraseConfidence | undefined): boolean {
  if (!conf) return false;
  return !!conf.needsHelp && (conf.timesProduced ?? 0) > (conf.timesCorrect ?? 0) + 1;
}

/**
 * Próximo target curricular A1.
 * Respeita ordem, unidade, mastery, deferred; nunca devolve l0-*.
 */
export function getNextA1Target(
  currentTargetId: string | null | undefined,
  learning: UserLearningProfile,
  opts?: { excludePhraseId?: string | null; skipPhraseIds?: string[] | null },
): A1Target | null {
  const skip = new Set<string>(opts?.skipPhraseIds ?? []);
  if (opts?.excludePhraseId) skip.add(opts.excludePhraseId);
  if (currentTargetId) skip.add(currentTargetId);

  const ordered = A1_CURRICULUM;
  const current = currentTargetId ? BY_ID.get(currentTargetId) : undefined;

  const pickFirstOpen = (candidates: A1Target[]): A1Target | null => {
    for (const t of candidates) {
      if (skip.has(t.id)) continue;
      const conf = learning.phrases[t.id];
      if (isDeferred(conf)) continue;
      if (isReadyForAdvance(conf)) continue;
      return t;
    }
    return null;
  };

  // 1) Continuar na unidade atual
  if (current) {
    const sameUnit = getA1TargetsByUnit(current.unitId).filter((t) => t.order > current.order);
    const nextInUnit = pickFirstOpen(sameUnit);
    if (nextInUnit) return nextInUnit;
  }

  // 2) Próxima unidade na ordem do currículo
  const unitOrder = a1UnitIdsInOrder();
  const startUnitIdx = current ? Math.max(0, unitOrder.indexOf(current.unitId)) : 0;
  for (let i = startUnitIdx; i < unitOrder.length; i++) {
    const unitTargets = getA1TargetsByUnit(unitOrder[i]);
    const open = pickFirstOpen(unitTargets);
    if (open) return open;
  }

  // 3) Qualquer A1 ainda aberto (incluindo deferred se nada mais restar)
  for (const t of ordered) {
    if (skip.has(t.id)) continue;
    if (!isReadyForAdvance(learning.phrases[t.id])) return t;
  }

  // 4) Currículo completo — reforço do mais fraco (ainda A1)
  let weakest: A1Target | null = null;
  let weakestScore = Infinity;
  for (const t of ordered) {
    if (skip.has(t.id)) continue;
    const conf = learning.phrases[t.id];
    const score = conf ? readAutomationScore(conf) : 0;
    if (score < weakestScore) {
      weakestScore = score;
      weakest = t;
    }
  }
  return weakest;
}

export function pickA1PlannerTarget(
  learning: UserLearningProfile,
  phrases: Phrase[],
  opts?: { excludePhraseId?: string | null; skipPhraseIds?: string[] | null; stickPhraseId?: string | null },
): { conf: PhraseConfidence | undefined; phrase: Phrase | null; action: 'introduce' | 'practice' | 'recall' | 'converse' } {
  const pool = a1PhrasePool(phrases);

  if (opts?.stickPhraseId && isA1TargetId(opts.stickPhraseId)) {
    const stuck = pool.find((p) => p.id === opts.stickPhraseId) ?? null;
    if (stuck) {
      const conf = learning.phrases[stuck.id];
      const action =
        !conf || (conf.timesCorrect ?? 0) === 0
          ? 'introduce'
          : stateIndex(conf.state) < stateIndex('answeredAlone')
            ? 'practice'
            : 'practice';
      return { conf, phrase: stuck, action };
    }
  }

  const next = getNextA1Target(null, learning, opts);
  if (!next) {
    return { conf: undefined, phrase: pool[0] ?? null, action: 'converse' };
  }
  const phrase = pool.find((p) => p.id === next.id) ?? {
    ...a1CurriculumSeedPhrases().find((p) => p.id === next.id)!,
  };
  const conf = learning.phrases[next.id];
  let action: 'introduce' | 'practice' | 'recall' | 'converse' = 'introduce';
  if (!conf || (conf.timesCorrect ?? 0) === 0) action = 'introduce';
  else if (conf.needsHelp || conf.confidence < 40) action = 'practice';
  else if (conf.nextReview && Date.parse(conf.nextReview) <= Date.now()) action = 'recall';
  else if (isReadyForAdvance(conf)) action = 'converse';
  else action = 'practice';

  return { conf, phrase, action };
}

/** Unidade A1 está completa quando todos os targets estão prontos para avanço. */
export function isA1UnitComplete(unitId: string, learning: UserLearningProfile): boolean {
  const targets = getA1TargetsByUnit(unitId);
  if (targets.length === 0) return false;
  return targets.every((t) => isReadyForAdvance(learning.phrases[t.id]));
}

/** Currículo A1 completo (evidência de produção, não só exposição). */
export function isA1CurriculumComplete(learning: UserLearningProfile): boolean {
  return A1_CURRICULUM.every((t) => isReadyForAdvance(learning.phrases[t.id]));
}

export function a1CompetencyMasteryFromLearning(
  competencyId: string,
  learning: UserLearningProfile,
): number {
  const targets = getA1TargetsByCompetency(competencyId);
  if (targets.length === 0) return 0;
  let sum = 0;
  for (const t of targets) {
    const conf = learning.phrases[t.id];
    if (!conf) continue;
    if (isMastered(conf) || isAutomated(conf)) sum += 100;
    else if (isReadyForAdvance(conf)) sum += 80;
    else if ((conf.timesCorrect ?? 0) > 0) sum += Math.min(70, 30 + conf.confidence * 0.4);
    else if ((conf.timesProduced ?? 0) > 0) sum += 15;
  }
  return Math.round(sum / targets.length);
}

export function assertA1CurriculumIntegrity(): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  const units = LEVEL_BY_ID.A1.modules.flatMap((m) => m.units);
  const unitIds = new Set(units.map((u) => u.id));
  const phraseIdToUnit = new Map<string, string>();

  for (const u of units) {
    for (const pid of u.phraseIds) {
      phraseIdToUnit.set(pid, u.id);
      const target = BY_ID.get(pid);
      if (!target) errors.push(`unit ${u.id} phraseId missing target: ${pid}`);
      else if (target.unitId !== u.id) errors.push(`phrase ${pid} unit mismatch ${target.unitId} vs ${u.id}`);
      else if (target.level !== 'A1') errors.push(`phrase ${pid} wrong level ${target.level}`);
      if (!COMPETENCY_BY_ID[u.competencies[0]]) errors.push(`unit ${u.id} bad competency`);
    }
  }

  for (const t of A1_CURRICULUM) {
    if (!unitIds.has(t.unitId)) errors.push(`target ${t.id} invalid unit ${t.unitId}`);
    if (!phraseIdToUnit.has(t.id)) errors.push(`target ${t.id} not listed in any unit phraseIds`);
    if (t.level !== 'A1') errors.push(`target ${t.id} level=${t.level}`);
    if (!COMPETENCY_BY_ID[t.competencyId]) errors.push(`target ${t.id} bad competency ${t.competencyId}`);
  }

  if (A1_CURRICULUM.length === 0) errors.push('no A1 targets');
  return { ok: errors.length === 0, errors };
}

/** A2/B1/B2 ainda sem currículo executável. */
export function isHigherLevelCurriculumBlocked(level: string): boolean {
  return level === 'A2' || level === 'B1' || level === 'B2' || level === 'C1' || level === 'C2';
}
