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
import { COMPETENCY_BY_ID, resolveCompetencyId } from './competencies';
import { scopeCurriculumTargets, scopePhrasePool, isInModuleScope } from './PlannerModuleRestrict';

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
  const id = resolveCompetencyId(competencyId);
  return A1_CURRICULUM.filter((t) => t.competencyId === id);
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
  opts?: { excludePhraseId?: string | null; skipPhraseIds?: string[] | null; restrictToTargetIds?: readonly string[] | null },
): A1Target | null {
  const skip = new Set<string>(opts?.skipPhraseIds ?? []);
  if (opts?.excludePhraseId) skip.add(opts.excludePhraseId);
  if (currentTargetId) skip.add(currentTargetId);

  const ordered = scopeCurriculumTargets(A1_CURRICULUM, opts?.restrictToTargetIds);
  if (ordered.length === 0) return null;

  const currentRaw = currentTargetId ? BY_ID.get(currentTargetId) : undefined;
  const current = currentRaw && isInModuleScope(currentRaw.id, opts?.restrictToTargetIds) ? currentRaw : undefined;

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
    const sameUnit = scopeCurriculumTargets(getA1TargetsByUnit(current.unitId), opts?.restrictToTargetIds).filter((t) => t.order > current.order);
    const nextInUnit = pickFirstOpen(sameUnit);
    if (nextInUnit) return nextInUnit;
  }

  // 2) Próxima unidade na ordem do currículo
  const unitOrder = a1UnitIdsInOrder();
  const startUnitIdx = current ? Math.max(0, unitOrder.indexOf(current.unitId)) : 0;
  for (let i = startUnitIdx; i < unitOrder.length; i++) {
    const unitTargets = scopeCurriculumTargets(getA1TargetsByUnit(unitOrder[i]), opts?.restrictToTargetIds);
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
  opts?: { excludePhraseId?: string | null; skipPhraseIds?: string[] | null; stickPhraseId?: string | null; restrictToTargetIds?: readonly string[] | null },
): { conf: PhraseConfidence | undefined; phrase: Phrase | null; action: 'introduce' | 'practice' | 'recall' | 'converse' } {
  const pool = scopePhrasePool(a1PhrasePool(phrases), opts?.restrictToTargetIds);

  if (
    opts?.stickPhraseId &&
    isA1TargetId(opts.stickPhraseId) &&
    isInModuleScope(opts.stickPhraseId, opts?.restrictToTargetIds)
  ) {
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
  const comps = new Set(LEVEL_BY_ID.A1.competencies);
  if (comps.size !== 7) errors.push(`expected 7 A1 competencies, got ${comps.size}`);
  if (!comps.has('a1.personal')) errors.push('missing a1.personal');
  if (comps.has('a1.food')) errors.push('a1.food should be merged into a1.shopping');
  return { ok: errors.length === 0, errors };
}

/**
 * Inventário exclusivo A1 (cada target exatamente uma vez).
 * status: REUTILIZADO = id existia antes do A1 escolar; NOVO = id criado no A1 escolar.
 * previousUnit/previousCompetency: colocação pré-reforma (só REUTILIZADO); reorganizado ≠ status.
 */
export type A1TargetAuditStatus = 'REUTILIZADO' | 'NOVO';

export type A1TargetAuditRow = {
  targetId: string;
  moduleId: string;
  competencyId: string;
  status: A1TargetAuditStatus;
  previousUnitId: string | null;
  previousCompetencyId: string | null;
  reorganized: boolean;
};

/** Colocação pré-reforma escolar (20 ids legados). */
const A1_LEGACY_PLACEMENT: Readonly<Record<string, { unitId: string; competencyId: string }>> = {
  'a1-family-mutter': { unitId: 'a1.u1', competencyId: 'a1.family' },
  'a1-family-bruder': { unitId: 'a1.u1', competencyId: 'a1.family' },
  'a1-family-schwester': { unitId: 'a1.u1', competencyId: 'a1.family' },
  'a1-time-drei-uhr': { unitId: 'a1.u2', competencyId: 'a1.numbers_time' },
  'a1-time-montag': { unitId: 'a1.u2', competencyId: 'a1.numbers_time' },
  'a1-time-freitag': { unitId: 'a1.u2', competencyId: 'a1.numbers_time' },
  'a1-routine-aufstehen': { unitId: 'a1.u3', competencyId: 'a1.routine' },
  'a1-routine-arbeit': { unitId: 'a1.u3', competencyId: 'a1.routine' },
  'a1-routine-kochen': { unitId: 'a1.u3', competencyId: 'a1.routine' },
  'a1-shopping-kostet': { unitId: 'a1.u4', competencyId: 'a1.shopping' },
  'a1-shopping-nehme': { unitId: 'a1.u4', competencyId: 'a1.shopping' },
  'a1-shopping-haben': { unitId: 'a1.u4', competencyId: 'a1.shopping' },
  'a1-food-kaffee': { unitId: 'a1.u5', competencyId: 'a1.food' },
  'a1-food-rechnung': { unitId: 'a1.u5', competencyId: 'a1.food' },
  'a1-food-wasser': { unitId: 'a1.u5', competencyId: 'a1.food' },
  'a1-info-bahnhof': { unitId: 'a1.u6', competencyId: 'a1.ask_info' },
  'a1-info-hotel': { unitId: 'a1.u6', competencyId: 'a1.ask_info' },
  'a1-info-bus': { unitId: 'a1.u6', competencyId: 'a1.ask_info' },
  'a1-help-koennen': { unitId: 'a1.u7', competencyId: 'a1.help' },
  'a1-help-brauche': { unitId: 'a1.u7', competencyId: 'a1.help' },
};

export function auditA1Targets(): {
  rows: A1TargetAuditRow[];
  total: number;
  reused: number;
  novo: number;
  reorganizedAmongReused: number;
  duplicateIds: string[];
} {
  const seen = new Set<string>();
  const duplicateIds: string[] = [];
  const rows: A1TargetAuditRow[] = A1_CURRICULUM.map((t) => {
    if (seen.has(t.id)) duplicateIds.push(t.id);
    seen.add(t.id);
    const legacy = A1_LEGACY_PLACEMENT[t.id];
    const status: A1TargetAuditStatus = legacy ? 'REUTILIZADO' : 'NOVO';
    const previousUnitId = legacy?.unitId ?? null;
    const previousCompetencyId = legacy?.competencyId ?? null;
    const reorganized = !!(
      legacy
      && (legacy.unitId !== t.unitId
        || resolveCompetencyId(legacy.competencyId) !== t.competencyId
        || legacy.competencyId !== t.competencyId)
    );
    return {
      targetId: t.id,
      moduleId: t.unitId,
      competencyId: t.competencyId,
      status,
      previousUnitId,
      previousCompetencyId,
      reorganized,
    };
  });
  const reused = rows.filter((r) => r.status === 'REUTILIZADO').length;
  const novo = rows.filter((r) => r.status === 'NOVO').length;
  return {
    rows,
    total: rows.length,
    reused,
    novo,
    reorganizedAmongReused: rows.filter((r) => r.reorganized).length,
    duplicateIds,
  };
}

/** @deprecated Use auditA1Targets().reused — mantido para testes legados. */
export const A1_REUSED_TARGET_IDS = Object.keys(A1_LEGACY_PLACEMENT);

/** @deprecated Use auditA1Targets().novo */
export const A1_NEW_TARGET_IDS = A1_CURRICULUM
  .map((t) => t.id)
  .filter((id) => !A1_LEGACY_PLACEMENT[id]);

export type A1ExitScenario = {
  id: string;
  titlePt: string;
  situationPt: string;
  competencyIds: string[];
  evidenceTargetIds: string[];
};

/** Avaliação situacional de saída A1 (escola de idiomas). */
export const A1_EXIT_SCENARIOS: A1ExitScenario[] = [
  {
    id: 'a1-exit-personal',
    titlePt: 'Apresentação pessoal',
    situationPt: 'Apresentar-se com nome, origem, cidade e ocupação.',
    competencyIds: ['a1.personal'],
    evidenceTargetIds: ['a1-personal-heisse', 'a1-personal-komme', 'a1-personal-wohne', 'a1-personal-beruf'],
  },
  {
    id: 'a1-exit-family',
    titlePt: 'Família',
    situationPt: 'Falar da família ou de uma pessoa próxima.',
    competencyIds: ['a1.family'],
    evidenceTargetIds: ['a1-family-mutter', 'a1-family-bruder', 'a1-family-eltern'],
  },
  {
    id: 'a1-exit-routine',
    titlePt: 'Rotina',
    situationPt: 'Descrever um dia normal com várias frases.',
    competencyIds: ['a1.routine'],
    evidenceTargetIds: ['a1-routine-aufstehen', 'a1-routine-arbeit', 'a1-routine-kochen'],
  },
  {
    id: 'a1-exit-work',
    titlePt: 'Trabalho',
    situationPt: 'Falar do trabalho ou estudos.',
    competencyIds: ['a1.personal', 'a1.routine'],
    evidenceTargetIds: ['a1-personal-beruf', 'a1-routine-arbeit', 'a1-everyday-bei-arbeit'],
  },
  {
    id: 'a1-exit-shopping',
    titlePt: 'Compra',
    situationPt: 'Perguntar preço e fazer um pedido.',
    competencyIds: ['a1.shopping'],
    evidenceTargetIds: ['a1-shopping-kostet', 'a1-shopping-nehme', 'a1-shopping-moechte'],
  },
  {
    id: 'a1-exit-food',
    titlePt: 'Comida / bebida',
    situationPt: 'Pedir comida ou bebida e a conta.',
    competencyIds: ['a1.shopping'],
    evidenceTargetIds: ['a1-food-kaffee', 'a1-food-wasser', 'a1-food-rechnung'],
  },
  {
    id: 'a1-exit-city',
    titlePt: 'Cidade',
    situationPt: 'Pedir informação e orientação na cidade.',
    competencyIds: ['a1.ask_info'],
    evidenceTargetIds: ['a1-info-bahnhof', 'a1-info-hotel', 'a1-info-mit-bus'],
  },
  {
    id: 'a1-exit-appointment',
    titlePt: 'Compromisso',
    situationPt: 'Marcar um encontro ou compromisso simples.',
    competencyIds: ['a1.numbers_time'],
    evidenceTargetIds: ['a1-time-freitag', 'a1-time-treffen', 'a1-time-wann'],
  },
  {
    id: 'a1-exit-plans',
    titlePt: 'Planos',
    situationPt: 'Falar de planos simples para amanhã ou o fim de semana.',
    competencyIds: ['a1.numbers_time'],
    evidenceTargetIds: ['a1-time-morgen', 'a1-time-wochenende', 'a1-time-mit-freunden'],
  },
  {
    id: 'a1-exit-problem',
    titlePt: 'Problema cotidiano',
    situationPt: 'Pedir ajuda, repetição ou resolver um pequeno problema.',
    competencyIds: ['a1.help'],
    evidenceTargetIds: ['a1-help-koennen', 'a1-help-wiederholen', 'a1-everyday-problem'],
  },
];

/**
 * Gate situacional A1: cada cenário exige evidência pronta em ≥50% dos targets
 * e pelo menos 1 produção no cenário. Aprovação: ≥7 de 10 situações.
 */
export function gradeA1ExitAssessment(learning: UserLearningProfile): {
  passed: boolean;
  score: number;
  reason: string;
  scenariosPassed: number;
  scenarioResults: Array<{ id: string; passed: boolean; coverage: number }>;
} {
  const scenarioResults = A1_EXIT_SCENARIOS.map((sc) => {
    const ids = sc.evidenceTargetIds;
    let ready = 0;
    let produced = 0;
    for (const id of ids) {
      const c = learning.phrases[id];
      if (isReadyForAdvance(c)) ready += 1;
      if ((c?.timesProduced ?? 0) > 0 || (c?.timesCorrect ?? 0) > 0) produced += 1;
    }
    const coverage = ready / Math.max(1, ids.length);
    const passed = coverage >= 0.5 && produced >= 1;
    return { id: sc.id, passed, coverage };
  });
  const scenariosPassed = scenarioResults.filter((r) => r.passed).length;
  const score = Math.round((scenariosPassed / A1_EXIT_SCENARIOS.length) * 100);
  const passed = scenariosPassed >= 7;
  return {
    passed,
    score,
    reason: passed
      ? 'Produção situacional A1 suficiente para avançar.'
      : 'Ainda faltam situações comunicativas A1 do cotidiano.',
    scenariosPassed,
    scenarioResults,
  };
}

/** Nenhum nível acima de C2 está implementado — todos L0–C2 são executáveis. */
export function isHigherLevelCurriculumBlocked(level: string): boolean {
  const known = new Set(['L0', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2']);
  return !known.has(level);
}
