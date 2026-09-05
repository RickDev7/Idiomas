/**
 * A2_CURRICULUM — fonte única executável do nível A2.
 * Espelha A1Curriculum; não duplica frases (deriva de CURATED + units).
 */
import type { Phrase } from '@/types';
import type { PhraseConfidence, UserLearningProfile } from '@/services/learning/ConfidenceService';
import { isMastered, stateIndex } from '@/services/learning/ConfidenceService';
import { isAutomated, readAutomationScore } from '@/services/learning/AutomationScoreEngine';
import { CURATED } from './content';
import { LEVEL_BY_ID } from './levels';
import { COMPETENCY_BY_ID } from './competencies';
import { scopeCurriculumTargets, scopePhrasePool, isInModuleScope } from './PlannerModuleRestrict';

export interface A2Target {
  id: string;
  level: 'A2';
  unitId: string;
  competencyId: string;
  german: string;
  portuguese: string;
  type?: string;
  order: number;
  category: string;
}

function buildA2Targets(): A2Target[] {
  const out: A2Target[] = [];
  for (const block of CURATED.filter((c) => c.level === 'A2')) {
    const category = block.categories[0] ?? 'daily';
    block.core.forEach((phrase, idx) => {
      if (!phrase.id || !phrase.unitId) {
        throw new Error(`A2 curated phrase missing id/unitId: ${phrase.german}`);
      }
      out.push({
        id: phrase.id,
        level: 'A2',
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

export const A2_CURRICULUM: A2Target[] = buildA2Targets();

const BY_ID = new Map(A2_CURRICULUM.map((t) => [t.id, t]));

export function getA2Targets(): A2Target[] {
  return A2_CURRICULUM;
}

export function getA2TargetById(id: string): A2Target | undefined {
  return BY_ID.get(id);
}

export function getA2TargetsByUnit(unitId: string): A2Target[] {
  return A2_CURRICULUM.filter((t) => t.unitId === unitId);
}

export function getA2TargetsByCompetency(competencyId: string): A2Target[] {
  return A2_CURRICULUM.filter((t) => t.competencyId === competencyId);
}

export function isA2TargetId(id: string | null | undefined): boolean {
  return !!id && BY_ID.has(id);
}

export function a2UnitIdsInOrder(): string[] {
  const units = LEVEL_BY_ID.A2.modules.flatMap((m) => m.units);
  return units.map((u) => u.id);
}

export function a2FirstTarget(): A2Target {
  return A2_CURRICULUM[0];
}

export function a2CurriculumSeedPhrases(): Phrase[] {
  return A2_CURRICULUM.map((t) => ({
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

export function mergeA2CurriculumPhrases(existing: Phrase[]): Phrase[] {
  const byId = new Map(existing.map((p) => [p.id, p]));
  for (const seed of a2CurriculumSeedPhrases()) {
    if (!byId.has(seed.id)) byId.set(seed.id, seed);
  }
  for (const seed of a2CurriculumSeedPhrases()) {
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

/** Pool exclusivo A2 (nunca l0-* / a1-*). */
export function a2PhrasePool(existing: Phrase[] = []): Phrase[] {
  const merged = mergeA2CurriculumPhrases(existing);
  const ids = new Set(A2_CURRICULUM.map((t) => t.id));
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

export function getNextA2Target(
  currentTargetId: string | null | undefined,
  learning: UserLearningProfile,
  opts?: { excludePhraseId?: string | null; skipPhraseIds?: string[] | null; restrictToTargetIds?: readonly string[] | null },
): A2Target | null {
  const skip = new Set<string>(opts?.skipPhraseIds ?? []);
  if (opts?.excludePhraseId) skip.add(opts.excludePhraseId);
  if (currentTargetId) skip.add(currentTargetId);

  const ordered = scopeCurriculumTargets(A2_CURRICULUM, opts?.restrictToTargetIds);
  if (ordered.length === 0) return null;

  const currentRaw = currentTargetId ? BY_ID.get(currentTargetId) : undefined;
  const current = currentRaw && isInModuleScope(currentRaw.id, opts?.restrictToTargetIds) ? currentRaw : undefined;

  const pickFirstOpen = (candidates: A2Target[]): A2Target | null => {
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
    const sameUnit = scopeCurriculumTargets(getA2TargetsByUnit(current.unitId), opts?.restrictToTargetIds).filter((t) => t.order > current.order);
    const nextInUnit = pickFirstOpen(sameUnit);
    if (nextInUnit) return nextInUnit;
  }

  const unitOrder = a2UnitIdsInOrder();
  const startUnitIdx = current ? Math.max(0, unitOrder.indexOf(current.unitId)) : 0;
  for (let i = startUnitIdx; i < unitOrder.length; i++) {
    const unitTargets = scopeCurriculumTargets(getA2TargetsByUnit(unitOrder[i]), opts?.restrictToTargetIds);
    const open = pickFirstOpen(unitTargets);
    if (open) return open;
  }

  for (const t of ordered) {
    if (skip.has(t.id)) continue;
    if (!isReadyForAdvance(learning.phrases[t.id])) return t;
  }

  let weakest: A2Target | null = null;
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

export function pickA2PlannerTarget(
  learning: UserLearningProfile,
  phrases: Phrase[],
  opts?: { excludePhraseId?: string | null; skipPhraseIds?: string[] | null; stickPhraseId?: string | null; restrictToTargetIds?: readonly string[] | null },
): { conf: PhraseConfidence | undefined; phrase: Phrase | null; action: 'introduce' | 'practice' | 'recall' | 'converse' } {
  const pool = scopePhrasePool(a2PhrasePool(phrases), opts?.restrictToTargetIds);

  if (
    opts?.stickPhraseId &&
    isA2TargetId(opts.stickPhraseId) &&
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

  const next = getNextA2Target(null, learning, opts);
  if (!next) {
    return { conf: undefined, phrase: pool[0] ?? null, action: 'converse' };
  }
  const phrase = pool.find((p) => p.id === next.id) ?? {
    ...a2CurriculumSeedPhrases().find((p) => p.id === next.id)!,
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

export function isA2UnitComplete(unitId: string, learning: UserLearningProfile): boolean {
  const targets = getA2TargetsByUnit(unitId);
  if (targets.length === 0) return false;
  return targets.every((t) => isReadyForAdvance(learning.phrases[t.id]));
}

export function isA2CurriculumComplete(learning: UserLearningProfile): boolean {
  return A2_CURRICULUM.every((t) => isReadyForAdvance(learning.phrases[t.id]));
}

export function a2CompetencyMasteryFromLearning(
  competencyId: string,
  learning: UserLearningProfile,
): number {
  const targets = getA2TargetsByCompetency(competencyId);
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

export function assertA2CurriculumIntegrity(): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  const units = LEVEL_BY_ID.A2.modules.flatMap((m) => m.units);
  const unitIds = new Set(units.map((u) => u.id));
  const phraseIdToUnit = new Map<string, string>();

  for (const u of units) {
    for (const pid of u.phraseIds) {
      phraseIdToUnit.set(pid, u.id);
      const target = BY_ID.get(pid);
      if (!target) errors.push(`unit ${u.id} phraseId missing target: ${pid}`);
      else if (target.unitId !== u.id) errors.push(`phrase ${pid} unit mismatch ${target.unitId} vs ${u.id}`);
      else if (target.level !== 'A2') errors.push(`phrase ${pid} wrong level ${target.level}`);
      if (!COMPETENCY_BY_ID[u.competencies[0]]) errors.push(`unit ${u.id} bad competency`);
    }
  }

  for (const t of A2_CURRICULUM) {
    if (!unitIds.has(t.unitId)) errors.push(`target ${t.id} invalid unit ${t.unitId}`);
    if (!phraseIdToUnit.has(t.id)) errors.push(`target ${t.id} not listed in any unit phraseIds`);
    if (t.level !== 'A2') errors.push(`target ${t.id} level=${t.level}`);
    if (!t.id.startsWith('a2-')) errors.push(`target ${t.id} must start with a2-`);
    if (!COMPETENCY_BY_ID[t.competencyId]) errors.push(`target ${t.id} bad competency ${t.competencyId}`);
  }

  if (A2_CURRICULUM.length === 0) errors.push('no A2 targets');
  return { ok: errors.length === 0, errors };
}

/** Colocação pré-reforma escolar A2 (18 targets esqueleto). */
export const A2_LEGACY_PLACEMENT: Record<string, { unitId: string; competencyId: string }> = {
  'a2-past-gearbeitet': { unitId: 'a2.u1', competencyId: 'a2.past' },
  'a2-past-kino': { unitId: 'a2.u1', competencyId: 'a2.past' },
  'a2-past-gemacht': { unitId: 'a2.u1', competencyId: 'a2.past' },
  'a2-plans-werde': { unitId: 'a2.u2', competencyId: 'a2.plans' },
  'a2-plans-plane': { unitId: 'a2.u2', competencyId: 'a2.plans' },
  'a2-plans-reisen': { unitId: 'a2.u2', competencyId: 'a2.plans' },
  'a2-problem-nicht-gut': { unitId: 'a2.u3', competencyId: 'a2.problem' },
  'a2-problem-mit': { unitId: 'a2.u3', competencyId: 'a2.problem' },
  'a2-problem-wohnung': { unitId: 'a2.u3', competencyId: 'a2.problem' },
  'a2-opinion-finde': { unitId: 'a2.u4', competencyId: 'a2.opinion' },
  'a2-opinion-meinung': { unitId: 'a2.u4', competencyId: 'a2.opinion' },
  'a2-opinion-lieber': { unitId: 'a2.u4', competencyId: 'a2.opinion' },
  'a2-travel-berlin': { unitId: 'a2.u5', competencyId: 'a2.travel' },
  'a2-travel-reise': { unitId: 'a2.u5', competencyId: 'a2.travel' },
  'a2-travel-uebernachten': { unitId: 'a2.u5', competencyId: 'a2.travel' },
  'a2-phone-hier-ist': { unitId: 'a2.u6', competencyId: 'a2.phone' },
  'a2-phone-nachricht': { unitId: 'a2.u6', competencyId: 'a2.phone' },
  'a2-phone-spaeter': { unitId: 'a2.u6', competencyId: 'a2.phone' },
};

export type A2TargetAuditStatus = 'REUTILIZADO' | 'NOVO';

export type A2TargetAuditRow = {
  targetId: string;
  moduleId: string;
  competencyId: string;
  status: A2TargetAuditStatus;
  previousUnitId: string | null;
  previousCompetencyId: string | null;
  reorganized: boolean;
};

export function auditA2Targets(): {
  rows: A2TargetAuditRow[];
  total: number;
  reused: number;
  novo: number;
  reorganizedAmongReused: number;
  duplicateIds: string[];
} {
  const seen = new Set<string>();
  const duplicateIds: string[] = [];
  const rows: A2TargetAuditRow[] = A2_CURRICULUM.map((t) => {
    if (seen.has(t.id)) duplicateIds.push(t.id);
    seen.add(t.id);
    const legacy = A2_LEGACY_PLACEMENT[t.id];
    const status: A2TargetAuditStatus = legacy ? 'REUTILIZADO' : 'NOVO';
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

export type A2ExitScenario = {
  id: string;
  titlePt: string;
  situationPt: string;
  competencyIds: string[];
  evidenceTargetIds: string[];
};

/** Avaliação situacional de saída A2 (escola de idiomas). */
export const A2_EXIT_SCENARIOS: A2ExitScenario[] = [
  {
    id: 'a2-exit-experience',
    titlePt: 'Experiência recente',
    situationPt: 'Contar uma experiência recente em sequência compreensível.',
    competencyIds: ['a2.past'],
    evidenceTargetIds: ['a2-past-wochenende', 'a2-past-gemacht', 'a2-past-gewesen'],
  },
  {
    id: 'a2-exit-housing',
    titlePt: 'Moradia ou bairro',
    situationPt: 'Descrever onde mora e uma necessidade concreta.',
    competencyIds: ['a2.plans'],
    evidenceTargetIds: ['a2-home-wohne', 'a2-home-zimmer', 'a2-problem-wohnung'],
  },
  {
    id: 'a2-exit-health',
    titlePt: 'Sintomas simples',
    situationPt: 'Explicar um problema de saúde e responder perguntas de acompanhamento.',
    competencyIds: ['a2.problem'],
    evidenceTargetIds: ['a2-problem-nicht-gut', 'a2-health-kopfschmerzen', 'a2-health-termin'],
  },
  {
    id: 'a2-exit-work',
    titlePt: 'Situação de trabalho',
    situationPt: 'Resolver uma situação profissional curta (tarefa, atraso ou esclarecimento).',
    competencyIds: ['a2.phone'],
    evidenceTargetIds: ['a2-work-aufgabe', 'a2-work-spaet', 'a2-work-erklaeren'],
  },
  {
    id: 'a2-exit-travel',
    titlePt: 'Viagem ou transporte',
    situationPt: 'Lidar com reserva, horário ou deslocamento.',
    competencyIds: ['a2.travel'],
    evidenceTargetIds: ['a2-travel-hotel', 'a2-travel-zug', 'a2-travel-weg'],
  },
  {
    id: 'a2-exit-complaint',
    titlePt: 'Troca ou reclamação',
    situationPt: 'Explicar um problema com um produto e propor solução.',
    competencyIds: ['a2.opinion'],
    evidenceTargetIds: ['a2-shop-defekt', 'a2-shop-umtauschen', 'a2-shop-guenstiger'],
  },
  {
    id: 'a2-exit-invite',
    titlePt: 'Convite ou encontro',
    situationPt: 'Fazer convite, aceitar/recusar ou combinar um plano.',
    competencyIds: ['a2.opinion'],
    evidenceTargetIds: ['a2-invite-kommen', 'a2-invite-leider', 'a2-plans-werde'],
  },
  {
    id: 'a2-exit-problem',
    titlePt: 'Problema cotidiano',
    situationPt: 'Descrever um imprevisto e pedir ajuda.',
    competencyIds: ['a2.plans', 'a2.opinion'],
    evidenceTargetIds: ['a2-home-heizung', 'a2-home-hilfe', 'a2-invite-helfen'],
  },
  {
    id: 'a2-exit-opinion',
    titlePt: 'Opinião e comparação',
    situationPt: 'Comparar opções e dar uma opinião simples.',
    competencyIds: ['a2.opinion'],
    evidenceTargetIds: ['a2-opinion-finde', 'a2-opinion-lieber', 'a2-shop-guenstiger'],
  },
  {
    id: 'a2-exit-conversation',
    titlePt: 'Conversa funcional 2–3 min',
    situationPt: 'Sustentar diálogo funcional com apoio reduzido (experiência + planos + opinião).',
    competencyIds: ['a2.past', 'a2.opinion'],
    evidenceTargetIds: ['a2-past-erzaehlen', 'a2-plans-plane', 'a2-opinion-meinung', 'a2-invite-kommen'],
  },
];

/**
 * Gate situacional A2: cada cenário exige evidência pronta em ≥50% dos targets
 * e pelo menos 1 produção no cenário. Aprovação: ≥7 de 10 situações.
 */
export function gradeA2ExitAssessment(learning: UserLearningProfile): {
  passed: boolean;
  score: number;
  reason: string;
  scenariosPassed: number;
  scenarioResults: Array<{ id: string; passed: boolean; coverage: number }>;
} {
  const scenarioResults = A2_EXIT_SCENARIOS.map((sc) => {
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
  const score = Math.round((scenariosPassed / A2_EXIT_SCENARIOS.length) * 100);
  const passed = scenariosPassed >= 7;
  return {
    passed,
    score,
    reason: passed
      ? 'Produção situacional A2 suficiente para avançar.'
      : 'Ainda faltam situações comunicativas A2 do cotidiano.',
    scenariosPassed,
    scenarioResults,
  };
}
