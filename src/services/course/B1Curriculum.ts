/**
 * B1_CURRICULUM — fonte única executável do nível B1.
 * Espelha A2Curriculum; não duplica frases (deriva de CURATED + units).
 */
import type { Phrase } from '@/types';
import type { PhraseConfidence, UserLearningProfile } from '@/services/learning/ConfidenceService';
import { isMastered, stateIndex } from '@/services/learning/ConfidenceService';
import { isAutomated, readAutomationScore } from '@/services/learning/AutomationScoreEngine';
import { CURATED } from './content';
import { LEVEL_BY_ID } from './levels';
import { COMPETENCY_BY_ID } from './competencies';
import { scopeCurriculumTargets, scopePhrasePool, isInModuleScope } from './PlannerModuleRestrict';

export interface B1Target {
  id: string;
  level: 'B1';
  unitId: string;
  competencyId: string;
  german: string;
  portuguese: string;
  type?: string;
  order: number;
  category: string;
}

function buildB1Targets(): B1Target[] {
  const out: B1Target[] = [];
  for (const block of CURATED.filter((c) => c.level === 'B1')) {
    const category = block.categories[0] ?? 'daily';
    block.core.forEach((phrase, idx) => {
      if (!phrase.id || !phrase.unitId) {
        throw new Error(`B1 curated phrase missing id/unitId: ${phrase.german}`);
      }
      out.push({
        id: phrase.id,
        level: 'B1',
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

export const B1_CURRICULUM: B1Target[] = buildB1Targets();

const BY_ID = new Map(B1_CURRICULUM.map((t) => [t.id, t]));

export function getB1Targets(): B1Target[] {
  return B1_CURRICULUM;
}

export function getB1TargetById(id: string): B1Target | undefined {
  return BY_ID.get(id);
}

export function getB1TargetsByUnit(unitId: string): B1Target[] {
  return B1_CURRICULUM.filter((t) => t.unitId === unitId);
}

export function getB1TargetsByCompetency(competencyId: string): B1Target[] {
  return B1_CURRICULUM.filter((t) => t.competencyId === competencyId);
}

export function isB1TargetId(id: string | null | undefined): boolean {
  return !!id && BY_ID.has(id);
}

export function b1UnitIdsInOrder(): string[] {
  const units = LEVEL_BY_ID.B1.modules.flatMap((m) => m.units);
  return units.map((u) => u.id);
}

export function b1FirstTarget(): B1Target {
  return B1_CURRICULUM[0];
}

export function b1CurriculumSeedPhrases(): Phrase[] {
  return B1_CURRICULUM.map((t) => ({
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

export function mergeB1CurriculumPhrases(existing: Phrase[]): Phrase[] {
  const byId = new Map(existing.map((p) => [p.id, p]));
  for (const seed of b1CurriculumSeedPhrases()) {
    if (!byId.has(seed.id)) byId.set(seed.id, seed);
  }
  for (const seed of b1CurriculumSeedPhrases()) {
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

/** Pool exclusivo B1 (nunca l0-* / a1-* / a2-*). */
export function b1PhrasePool(existing: Phrase[] = []): Phrase[] {
  const merged = mergeB1CurriculumPhrases(existing);
  const ids = new Set(B1_CURRICULUM.map((t) => t.id));
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

export function getNextB1Target(
  currentTargetId: string | null | undefined,
  learning: UserLearningProfile,
  opts?: { excludePhraseId?: string | null; skipPhraseIds?: string[] | null; restrictToTargetIds?: readonly string[] | null },
): B1Target | null {
  const skip = new Set<string>(opts?.skipPhraseIds ?? []);
  if (opts?.excludePhraseId) skip.add(opts.excludePhraseId);
  if (currentTargetId) skip.add(currentTargetId);

  const ordered = scopeCurriculumTargets(B1_CURRICULUM, opts?.restrictToTargetIds);
  if (ordered.length === 0) return null;

  const currentRaw = currentTargetId ? BY_ID.get(currentTargetId) : undefined;
  const current = currentRaw && isInModuleScope(currentRaw.id, opts?.restrictToTargetIds) ? currentRaw : undefined;

  const pickFirstOpen = (candidates: B1Target[]): B1Target | null => {
    for (const t of candidates) {
      if (skip.has(t.id)) continue;
      const conf = learning.phrases[t.id];
      if (isDeferred(conf)) continue;
      if (isReadyForAdvance(conf)) continue;
      return t;
    }
    return null;
  };

  if (current) {
    const sameUnit = scopeCurriculumTargets(getB1TargetsByUnit(current.unitId), opts?.restrictToTargetIds).filter((t) => t.order > current.order);
    const nextInUnit = pickFirstOpen(sameUnit);
    if (nextInUnit) return nextInUnit;
  }

  const unitOrder = b1UnitIdsInOrder();
  const startUnitIdx = current ? Math.max(0, unitOrder.indexOf(current.unitId)) : 0;
  for (let i = startUnitIdx; i < unitOrder.length; i++) {
    const unitTargets = scopeCurriculumTargets(getB1TargetsByUnit(unitOrder[i]), opts?.restrictToTargetIds);
    const open = pickFirstOpen(unitTargets);
    if (open) return open;
  }

  for (const t of ordered) {
    if (skip.has(t.id)) continue;
    if (!isReadyForAdvance(learning.phrases[t.id])) return t;
  }

  let weakest: B1Target | null = null;
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

export function pickB1PlannerTarget(
  learning: UserLearningProfile,
  phrases: Phrase[],
  opts?: { excludePhraseId?: string | null; skipPhraseIds?: string[] | null; stickPhraseId?: string | null; restrictToTargetIds?: readonly string[] | null },
): { conf: PhraseConfidence | undefined; phrase: Phrase | null; action: 'introduce' | 'practice' | 'recall' | 'converse' } {
  const pool = scopePhrasePool(b1PhrasePool(phrases), opts?.restrictToTargetIds);

  if (
    opts?.stickPhraseId &&
    isB1TargetId(opts.stickPhraseId) &&
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

  const next = getNextB1Target(null, learning, opts);
  if (!next) {
    return { conf: undefined, phrase: pool[0] ?? null, action: 'converse' };
  }
  const phrase = pool.find((p) => p.id === next.id) ?? {
    ...b1CurriculumSeedPhrases().find((p) => p.id === next.id)!,
  };
  const conf = learning.phrases[next.id];
  let action: 'introduce' | 'practice' | 'recall' | 'converse' = 'introduce';
  if (!conf || (conf.timesCorrect ?? 0) === 0) action = 'introduce';
  else if (conf.needsHelp || conf.confidence < 40) action = 'practice';
  else if (conf.nextReview && Date.parse(conf.nextReview) <= Date.now()) action = 'recall';
  else if (isReadyForAdvance(conf) && (conf.timesCorrect ?? 0) >= 3) action = 'converse';
  else action = 'practice';

  return { conf, phrase, action };
}

export function isB1UnitComplete(unitId: string, learning: UserLearningProfile): boolean {
  const targets = getB1TargetsByUnit(unitId);
  if (targets.length === 0) return false;
  return targets.every((t) => isReadyForAdvance(learning.phrases[t.id]));
}

export function isB1CurriculumComplete(learning: UserLearningProfile): boolean {
  return B1_CURRICULUM.every((t) => isReadyForAdvance(learning.phrases[t.id]));
}

export function b1CompetencyMasteryFromLearning(
  competencyId: string,
  learning: UserLearningProfile,
): number {
  const targets = getB1TargetsByCompetency(competencyId);
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

export function assertB1CurriculumIntegrity(): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  const units = LEVEL_BY_ID.B1.modules.flatMap((m) => m.units);
  const unitIds = new Set(units.map((u) => u.id));
  const phraseIdToUnit = new Map<string, string>();

  for (const u of units) {
    for (const pid of u.phraseIds) {
      phraseIdToUnit.set(pid, u.id);
      const target = BY_ID.get(pid);
      if (!target) errors.push(`unit ${u.id} phraseId missing target: ${pid}`);
      else if (target.unitId !== u.id) errors.push(`phrase ${pid} unit mismatch ${target.unitId} vs ${u.id}`);
      else if (target.level !== 'B1') errors.push(`phrase ${pid} wrong level ${target.level}`);
      if (!COMPETENCY_BY_ID[u.competencies[0]]) errors.push(`unit ${u.id} bad competency`);
    }
  }

  for (const t of B1_CURRICULUM) {
    if (!unitIds.has(t.unitId)) errors.push(`target ${t.id} invalid unit ${t.unitId}`);
    if (!phraseIdToUnit.has(t.id)) errors.push(`target ${t.id} not listed in any unit phraseIds`);
    if (t.level !== 'B1') errors.push(`target ${t.id} level=${t.level}`);
    if (!t.id.startsWith('b1-')) errors.push(`target ${t.id} must start with b1-`);
    if (!COMPETENCY_BY_ID[t.competencyId]) errors.push(`target ${t.id} bad competency ${t.competencyId}`);
  }

  if (B1_CURRICULUM.length === 0) errors.push('no B1 targets');
  return { ok: errors.length === 0, errors };
}

/** Colocação pré-reforma escolar B1 (21 targets esqueleto). */
export const B1_LEGACY_PLACEMENT: Record<string, { unitId: string; competencyId: string }> = {
  'b1-story-muenchen': { unitId: 'b1.u1', competencyId: 'b1.story' },
  'b1-story-geklappt': { unitId: 'b1.u1', competencyId: 'b1.story' },
  'b1-story-weil': { unitId: 'b1.u1', competencyId: 'b1.story' },
  'b1-opinion-meinung': { unitId: 'b1.u2', competencyId: 'b1.opinion_justify' },
  'b1-opinion-deshalb': { unitId: 'b1.u2', competencyId: 'b1.opinion_justify' },
  'b1-opinion-seiten': { unitId: 'b1.u2', competencyId: 'b1.opinion_justify' },
  'b1-work-wochenende': { unitId: 'b1.u3', competencyId: 'b1.work_social' },
  'b1-work-besprechen': { unitId: 'b1.u3', competencyId: 'b1.work_social' },
  'b1-work-schlage': { unitId: 'b1.u3', competencyId: 'b1.work_social' },
  'b1-news-nachrichten': { unitId: 'b1.u4', competencyId: 'b1.news' },
  'b1-news-gehoert': { unitId: 'b1.u4', competencyId: 'b1.news' },
  'b1-news-interessiert': { unitId: 'b1.u4', competencyId: 'b1.news' },
  'b1-problem-und-zwar': { unitId: 'b1.u5', competencyId: 'b1.explain_problem' },
  'b1-problem-helfen': { unitId: 'b1.u5', competencyId: 'b1.explain_problem' },
  'b1-problem-folgendes': { unitId: 'b1.u5', competencyId: 'b1.explain_problem' },
  'b1-present-thema': { unitId: 'b1.u6', competencyId: 'b1.present' },
  'b1-present-punkten': { unitId: 'b1.u6', competencyId: 'b1.present' },
  'b1-present-fragen': { unitId: 'b1.u6', competencyId: 'b1.present' },
  'b1-daily-erledigt': { unitId: 'b1.u7', competencyId: 'b1.live_daily' },
  'b1-daily-termin': { unitId: 'b1.u7', competencyId: 'b1.live_daily' },
  'b1-daily-passt': { unitId: 'b1.u7', competencyId: 'b1.live_daily' },
};

export type B1TargetAuditStatus = 'REUTILIZADO' | 'NOVO';

export type B1TargetAuditRow = {
  targetId: string;
  moduleId: string;
  competencyId: string;
  status: B1TargetAuditStatus;
  previousUnitId: string | null;
  previousCompetencyId: string | null;
  reorganized: boolean;
};

export function auditB1Targets(): {
  rows: B1TargetAuditRow[];
  total: number;
  reused: number;
  novo: number;
  reorganizedAmongReused: number;
  duplicateIds: string[];
} {
  const seen = new Set<string>();
  const duplicateIds: string[] = [];
  const rows: B1TargetAuditRow[] = B1_CURRICULUM.map((t) => {
    if (seen.has(t.id)) duplicateIds.push(t.id);
    seen.add(t.id);
    const legacy = B1_LEGACY_PLACEMENT[t.id];
    const status: B1TargetAuditStatus = legacy ? 'REUTILIZADO' : 'NOVO';
    const previousUnitId = legacy?.unitId ?? null;
    const previousCompetencyId = legacy?.competencyId ?? null;
    const reorganized = !!(
      legacy
      && (legacy.unitId !== t.unitId || legacy.competencyId !== t.competencyId)
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
  return {
    rows,
    total: rows.length,
    reused: rows.filter((r) => r.status === 'REUTILIZADO').length,
    novo: rows.filter((r) => r.status === 'NOVO').length,
    reorganizedAmongReused: rows.filter((r) => r.reorganized).length,
    duplicateIds,
  };
}

export type B1ExitScenario = {
  id: string;
  titlePt: string;
  situationPt: string;
  competencyIds: string[];
  evidenceTargetIds: string[];
};

/** Avaliação situacional de saída B1 (escola de idiomas). */
export const B1_EXIT_SCENARIOS: B1ExitScenario[] = [
  {
    id: 'b1-exit-experience',
    titlePt: 'Experiência ou mudança pessoal',
    situationPt: 'Contar uma experiência ou mudança com sequência e motivo.',
    competencyIds: ['b1.story'],
    evidenceTargetIds: ['b1-story-muenchen', 'b1-story-geklappt', 'b1-story-weil'],
  },
  {
    id: 'b1-exit-work',
    titlePt: 'Trabalho, estudo ou meta',
    situationPt: 'Explicar trabalho, experiência ou plano de carreira.',
    competencyIds: ['b1.work_social', 'b1.present'],
    evidenceTargetIds: ['b1-work-aufgaben', 'b1-work-erfahrung', 'b1-present-wahl'],
  },
  {
    id: 'b1-exit-housing',
    titlePt: 'Moradia ou serviço',
    situationPt: 'Resolver um problema de moradia ou reclamar de um serviço.',
    competencyIds: ['b1.explain_problem'],
    evidenceTargetIds: ['b1-home-defekt', 'b1-home-beschwerde', 'b1-problem-helfen'],
  },
  {
    id: 'b1-exit-travel',
    titlePt: 'Situação de viagem',
    situationPt: 'Alterar reserva, pedir reembolso ou lidar com imprevisto de viagem.',
    competencyIds: ['b1.news'],
    evidenceTargetIds: ['b1-travel-aendern', 'b1-travel-erstattung', 'b1-travel-ort'],
  },
  {
    id: 'b1-exit-health',
    titlePt: 'Saúde ou ajuda prática',
    situationPt: 'Explicar sintomas, seguro ou pedir esclarecimento.',
    competencyIds: ['b1.live_daily'],
    evidenceTargetIds: ['b1-health-symptome', 'b1-health-versicherung', 'b1-daily-hilfe-bitten'],
  },
  {
    id: 'b1-exit-culture',
    titlePt: 'Recomendação cultural',
    situationPt: 'Recomendar ou comentar filme, série ou lugar.',
    competencyIds: ['b1.news'],
    evidenceTargetIds: ['b1-media-empfehlen', 'b1-media-serie', 'b1-news-interessiert'],
  },
  {
    id: 'b1-exit-compare',
    titlePt: 'Comparar e decidir',
    situationPt: 'Comparar duas opções e justificar a escolha.',
    competencyIds: ['b1.opinion_justify'],
    evidenceTargetIds: ['b1-opinion-vergleichen', 'b1-opinion-entscheiden', 'b1-opinion-deshalb'],
  },
  {
    id: 'b1-exit-plan',
    titlePt: 'Organizar um plano',
    situationPt: 'Propor e combinar um plano com outra pessoa.',
    competencyIds: ['b1.opinion_justify', 'b1.work_social'],
    evidenceTargetIds: ['b1-opinion-planen', 'b1-opinion-vorschlagen', 'b1-work-schlage'],
  },
  {
    id: 'b1-exit-opinion',
    titlePt: 'Opinião e reação',
    situationPt: 'Expressar opinião e reagir a uma opinião diferente.',
    competencyIds: ['b1.opinion_justify'],
    evidenceTargetIds: ['b1-opinion-meinung', 'b1-opinion-stimme-zu', 'b1-opinion-anders'],
  },
  {
    id: 'b1-exit-conversation',
    titlePt: 'Conversa espontânea 3–5 min',
    situationPt: 'Sustentar diálogo com relato, opinião justificada e reação.',
    competencyIds: ['b1.story', 'b1.opinion_justify', 'b1.live_daily'],
    evidenceTargetIds: [
      'b1-story-entscheidung',
      'b1-opinion-seiten',
      'b1-present-zusammen',
      'b1-daily-unvorhergesehen',
    ],
  },
];

/**
 * Gate situacional B1: cada cenário exige evidência pronta em ≥50% dos targets
 * e pelo menos 1 produção no cenário. Aprovação: ≥7 de 10 situações.
 */
export function gradeB1ExitAssessment(learning: UserLearningProfile): {
  passed: boolean;
  score: number;
  reason: string;
  scenariosPassed: number;
  scenarioResults: Array<{ id: string; passed: boolean; coverage: number }>;
} {
  const scenarioResults = B1_EXIT_SCENARIOS.map((sc) => {
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
  const score = Math.round((scenariosPassed / B1_EXIT_SCENARIOS.length) * 100);
  const passed = scenariosPassed >= 7;
  return {
    passed,
    score,
    reason: passed
      ? 'Produção situacional B1 suficiente para avançar.'
      : 'Ainda faltam situações comunicativas B1 de autonomia funcional.',
    scenariosPassed,
    scenarioResults,
  };
}
