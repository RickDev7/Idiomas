/**
 * C1_CURRICULUM — fonte única executável do nível C1.
 * Espelha B2Curriculum; não duplica frases (deriva de CURATED + units).
 */
import type { Phrase } from '@/types';
import type { PhraseConfidence, UserLearningProfile } from '@/services/learning/ConfidenceService';
import { isMastered, stateIndex } from '@/services/learning/ConfidenceService';
import { isAutomated, readAutomationScore } from '@/services/learning/AutomationScoreEngine';
import { CURATED } from './content';
import { LEVEL_BY_ID } from './levels';
import { COMPETENCY_BY_ID } from './competencies';
import { scopeCurriculumTargets, scopePhrasePool, isInModuleScope } from './PlannerModuleRestrict';

export interface C1Target {
  id: string;
  level: 'C1';
  unitId: string;
  competencyId: string;
  german: string;
  portuguese: string;
  type?: string;
  order: number;
  category: string;
}

function buildC1Targets(): C1Target[] {
  const out: C1Target[] = [];
  for (const block of CURATED.filter((c) => c.level === 'C1')) {
    const category = block.categories[0] ?? 'daily';
    block.core.forEach((phrase, idx) => {
      if (!phrase.id || !phrase.unitId) {
        throw new Error(`C1 curated phrase missing id/unitId: ${phrase.german}`);
      }
      out.push({
        id: phrase.id,
        level: 'C1',
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

export const C1_CURRICULUM: C1Target[] = buildC1Targets();

const BY_ID = new Map(C1_CURRICULUM.map((t) => [t.id, t]));

export function getC1Targets(): C1Target[] {
  return C1_CURRICULUM;
}

export function getC1TargetById(id: string): C1Target | undefined {
  return BY_ID.get(id);
}

export function getC1TargetsByUnit(unitId: string): C1Target[] {
  return C1_CURRICULUM.filter((t) => t.unitId === unitId);
}

export function getC1TargetsByCompetency(competencyId: string): C1Target[] {
  return C1_CURRICULUM.filter((t) => t.competencyId === competencyId);
}

export function isC1TargetId(id: string | null | undefined): boolean {
  return !!id && BY_ID.has(id);
}

export function c1UnitIdsInOrder(): string[] {
  const units = LEVEL_BY_ID.C1.modules.flatMap((m) => m.units);
  return units.map((u) => u.id);
}

export function c1FirstTarget(): C1Target {
  return C1_CURRICULUM[0];
}

export function c1CurriculumSeedPhrases(): Phrase[] {
  return C1_CURRICULUM.map((t) => ({
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

export function mergeC1CurriculumPhrases(existing: Phrase[]): Phrase[] {
  const byId = new Map(existing.map((p) => [p.id, p]));
  for (const seed of c1CurriculumSeedPhrases()) {
    if (!byId.has(seed.id)) byId.set(seed.id, seed);
  }
  for (const seed of c1CurriculumSeedPhrases()) {
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

/** Pool exclusivo C1 (nunca l0-* / a1-* / a2-* / b1-* / b2-*). */
export function c1PhrasePool(existing: Phrase[] = []): Phrase[] {
  const merged = mergeC1CurriculumPhrases(existing);
  const ids = new Set(C1_CURRICULUM.map((t) => t.id));
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

export function getNextC1Target(
  currentTargetId: string | null | undefined,
  learning: UserLearningProfile,
  opts?: { excludePhraseId?: string | null; skipPhraseIds?: string[] | null; restrictToTargetIds?: readonly string[] | null },
): C1Target | null {
  const skip = new Set<string>(opts?.skipPhraseIds ?? []);
  if (opts?.excludePhraseId) skip.add(opts.excludePhraseId);
  if (currentTargetId) skip.add(currentTargetId);

  const ordered = scopeCurriculumTargets(C1_CURRICULUM, opts?.restrictToTargetIds);
  if (ordered.length === 0) return null;

  const currentRaw = currentTargetId ? BY_ID.get(currentTargetId) : undefined;
  const current = currentRaw && isInModuleScope(currentRaw.id, opts?.restrictToTargetIds) ? currentRaw : undefined;

  const pickFirstOpen = (candidates: C1Target[]): C1Target | null => {
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
    const sameUnit = scopeCurriculumTargets(getC1TargetsByUnit(current.unitId), opts?.restrictToTargetIds).filter((t) => t.order > current.order);
    const nextInUnit = pickFirstOpen(sameUnit);
    if (nextInUnit) return nextInUnit;
  }

  const unitOrder = c1UnitIdsInOrder();
  const startUnitIdx = current ? Math.max(0, unitOrder.indexOf(current.unitId)) : 0;
  for (let i = startUnitIdx; i < unitOrder.length; i++) {
    const unitTargets = scopeCurriculumTargets(getC1TargetsByUnit(unitOrder[i]), opts?.restrictToTargetIds);
    const open = pickFirstOpen(unitTargets);
    if (open) return open;
  }

  for (const t of ordered) {
    if (skip.has(t.id)) continue;
    if (!isReadyForAdvance(learning.phrases[t.id])) return t;
  }

  let weakest: C1Target | null = null;
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

export function pickC1PlannerTarget(
  learning: UserLearningProfile,
  phrases: Phrase[],
  opts?: { excludePhraseId?: string | null; skipPhraseIds?: string[] | null; stickPhraseId?: string | null; restrictToTargetIds?: readonly string[] | null },
): { conf: PhraseConfidence | undefined; phrase: Phrase | null; action: 'introduce' | 'practice' | 'recall' | 'converse' } {
  const pool = scopePhrasePool(c1PhrasePool(phrases), opts?.restrictToTargetIds);

  if (
    opts?.stickPhraseId &&
    isC1TargetId(opts.stickPhraseId) &&
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

  const next = getNextC1Target(null, learning, opts);
  if (!next) {
    return { conf: undefined, phrase: pool[0] ?? null, action: 'converse' };
  }
  const phrase = pool.find((p) => p.id === next.id) ?? {
    ...c1CurriculumSeedPhrases().find((p) => p.id === next.id)!,
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

export function isC1UnitComplete(unitId: string, learning: UserLearningProfile): boolean {
  const targets = getC1TargetsByUnit(unitId);
  if (targets.length === 0) return false;
  return targets.every((t) => isReadyForAdvance(learning.phrases[t.id]));
}

export function isC1CurriculumComplete(learning: UserLearningProfile): boolean {
  return C1_CURRICULUM.every((t) => isReadyForAdvance(learning.phrases[t.id]));
}

export function c1CompetencyMasteryFromLearning(
  competencyId: string,
  learning: UserLearningProfile,
): number {
  const targets = getC1TargetsByCompetency(competencyId);
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

export function assertC1CurriculumIntegrity(): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  const units = LEVEL_BY_ID.C1.modules.flatMap((m) => m.units);
  const unitIds = new Set(units.map((u) => u.id));
  const phraseIdToUnit = new Map<string, string>();

  for (const u of units) {
    for (const pid of u.phraseIds) {
      phraseIdToUnit.set(pid, u.id);
      const target = BY_ID.get(pid);
      if (!target) errors.push(`unit ${u.id} phraseId missing target: ${pid}`);
      else if (target.unitId !== u.id) errors.push(`phrase ${pid} unit mismatch ${target.unitId} vs ${u.id}`);
      else if (target.level !== 'C1') errors.push(`phrase ${pid} wrong level ${target.level}`);
      if (!COMPETENCY_BY_ID[u.competencies[0]]) errors.push(`unit ${u.id} bad competency`);
    }
  }

  for (const t of C1_CURRICULUM) {
    if (!unitIds.has(t.unitId)) errors.push(`target ${t.id} invalid unit ${t.unitId}`);
    if (!phraseIdToUnit.has(t.id)) errors.push(`target ${t.id} not listed in any unit phraseIds`);
    if (t.level !== 'C1') errors.push(`target ${t.id} level=${t.level}`);
    if (!t.id.startsWith('c1-')) errors.push(`target ${t.id} must start with c1-`);
    if (!COMPETENCY_BY_ID[t.competencyId]) errors.push(`target ${t.id} bad competency ${t.competencyId}`);
  }

  if (C1_CURRICULUM.length === 0) errors.push('no C1 targets');
  return { ok: errors.length === 0, errors };
}

/** Colocação pré-reforma escolar C1 (24 targets esqueleto). */
export const C1_LEGACY_PLACEMENT: Record<string, { unitId: string; competencyId: string }> = {
  'c1-nuance-perspektive': { unitId: 'c1.u1', competencyId: 'c1.nuance' },
  'c1-nuance-anders': { unitId: 'c1.u1', competencyId: 'c1.nuance' },
  'c1-nuance-nuance': { unitId: 'c1.u1', competencyId: 'c1.nuance' },
  'c1-argue-zwar': { unitId: 'c1.u2', competencyId: 'c1.argue' },
  'c1-argue-grundlage': { unitId: 'c1.u2', competencyId: 'c1.argue' },
  'c1-argue-folgerung': { unitId: 'c1.u2', competencyId: 'c1.argue' },
  'c1-debate-einwand': { unitId: 'c1.u3', competencyId: 'c1.debate' },
  'c1-debate-entkraeftet': { unitId: 'c1.u3', competencyId: 'c1.debate' },
  'c1-debate-differenzieren': { unitId: 'c1.u3', competencyId: 'c1.debate' },
  'c1-hyp-angenommen': { unitId: 'c1.u4', competencyId: 'c1.hypothesis' },
  'c1-hyp-waere': { unitId: 'c1.u4', competencyId: 'c1.hypothesis' },
  'c1-hyp-szenario': { unitId: 'c1.u4', competencyId: 'c1.hypothesis' },
  'c1-reg-formal': { unitId: 'c1.u5', competencyId: 'c1.register' },
  'c1-reg-informal': { unitId: 'c1.u5', competencyId: 'c1.register' },
  'c1-reg-neutral': { unitId: 'c1.u5', competencyId: 'c1.register' },
  'c1-abs-gesellschaft': { unitId: 'c1.u6', competencyId: 'c1.abstract' },
  'c1-abs-verantwortung': { unitId: 'c1.u6', competencyId: 'c1.abstract' },
  'c1-abs-spannung': { unitId: 'c1.u6', competencyId: 'c1.abstract' },
  'c1-neg-interesse': { unitId: 'c1.u7', competencyId: 'c1.negotiate' },
  'c1-neg-kompromiss': { unitId: 'c1.u7', competencyId: 'c1.negotiate' },
  'c1-neg-entspannen': { unitId: 'c1.u7', competencyId: 'c1.negotiate' },
  'c1-spon-ehrlich': { unitId: 'c1.u8', competencyId: 'c1.spontaneous' },
  'c1-spon-anschluss': { unitId: 'c1.u8', competencyId: 'c1.spontaneous' },
  'c1-spon-fazit': { unitId: 'c1.u8', competencyId: 'c1.spontaneous' },
};

export type C1TargetAuditStatus = 'REUTILIZADO' | 'NOVO';

export type C1TargetAuditRow = {
  targetId: string;
  moduleId: string;
  competencyId: string;
  status: C1TargetAuditStatus;
  previousUnitId: string | null;
  previousCompetencyId: string | null;
  reorganized: boolean;
};

export function auditC1Targets(): {
  rows: C1TargetAuditRow[];
  total: number;
  reused: number;
  novo: number;
  reorganizedAmongReused: number;
  duplicateIds: string[];
} {
  const seen = new Set<string>();
  const duplicateIds: string[] = [];
  const rows: C1TargetAuditRow[] = C1_CURRICULUM.map((t) => {
    if (seen.has(t.id)) duplicateIds.push(t.id);
    seen.add(t.id);
    const legacy = C1_LEGACY_PLACEMENT[t.id];
    const status: C1TargetAuditStatus = legacy ? 'REUTILIZADO' : 'NOVO';
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

export type C1ExitScenario = {
  id: string;
  titlePt: string;
  situationPt: string;
  competencyIds: string[];
  evidenceTargetIds: string[];
};

/** Avaliação situacional de saída C1 (escola de idiomas). */
export const C1_EXIT_SCENARIOS: C1ExitScenario[] = [
  {
    id: 'c1-exit-position',
    titlePt: 'Defender posição complexa',
    situationPt: 'Defender posição sobre tema complexo com evidência e conclusão.',
    competencyIds: ['c1.argue'],
    evidenceTargetIds: ['c1-argue-grundlage', 'c1-argue-beispiel', 'c1-argue-schluss'],
  },
  {
    id: 'c1-exit-counter',
    titlePt: 'Contraponto com nuance',
    situationPt: 'Reconhecer contraponto e responder com nuance.',
    competencyIds: ['c1.debate', 'c1.nuance'],
    evidenceTargetIds: ['c1-debate-einwand', 'c1-debate-zugeben', 'c1-nuance-nuance'],
  },
  {
    id: 'c1-exit-professional',
    titlePt: 'Proposta profissional',
    situationPt: 'Apresentar proposta profissional com prioridade e risco.',
    competencyIds: ['c1.register'],
    evidenceTargetIds: ['c1-pro-praesentation', 'c1-pro-prioritaeten', 'c1-pro-risiko'],
  },
  {
    id: 'c1-exit-synthesis',
    titlePt: 'Síntese de perspectivas',
    situationPt: 'Sintetizar informação de mais de uma fonte ou perspectiva.',
    competencyIds: ['c1.hypothesis'],
    evidenceTargetIds: ['c1-acad-zusammenfassen', 'c1-acad-quellen', 'c1-acad-unterscheiden'],
  },
  {
    id: 'c1-exit-mediate',
    titlePt: 'Mediação ou negociação',
    situationPt: 'Mediar conflito ou negociar solução sob pressão.',
    competencyIds: ['c1.negotiate'],
    evidenceTargetIds: ['c1-neg-kompromiss', 'c1-crisis-mediation', 'c1-crisis-naechste'],
  },
  {
    id: 'c1-exit-ethics',
    titlePt: 'Tema social ou ético',
    situationPt: 'Explicar tema social/ético abstrato com proposta.',
    competencyIds: ['c1.abstract'],
    evidenceTargetIds: ['c1-abs-verantwortung', 'c1-abs-nachhaltigkeit', 'c1-abs-vorschlag'],
  },
  {
    id: 'c1-exit-culture',
    titlePt: 'Análise cultural ou de mídia',
    situationPt: 'Comentar obra, mídia ou experiência cultural.',
    competencyIds: ['c1.nuance'],
    evidenceTargetIds: ['c1-culture-werk', 'c1-culture-medien', 'c1-culture-alternative'],
  },
  {
    id: 'c1-exit-formal',
    titlePt: 'Situação formal complexa',
    situationPt: 'Resolver situação formal (contrato, urgência, pedido).',
    competencyIds: ['c1.negotiate', 'c1.register'],
    evidenceTargetIds: ['c1-crisis-vertrag', 'c1-crisis-dringlichkeit', 'c1-reg-formal'],
  },
  {
    id: 'c1-exit-register',
    titlePt: 'Adaptação de registro',
    situationPt: 'Adaptar o registro entre informal e profissional.',
    competencyIds: ['c1.register', 'c1.spontaneous'],
    evidenceTargetIds: ['c1-reg-formal', 'c1-reg-informal', 'c1-int-register'],
  },
  {
    id: 'c1-exit-discussion',
    titlePt: 'Discussão 7–10 minutos',
    situationPt: 'Sustentar apresentação ou discussão estruturada com reação a contrapontos.',
    competencyIds: ['c1.spontaneous', 'c1.debate'],
    evidenceTargetIds: [
      'c1-int-praesentation',
      'c1-int-diskussion',
      'c1-int-reaktion',
      'c1-spon-fazit',
    ],
  },
];

/**
 * Gate situacional C1: cada cenário exige evidência pronta em ≥50% dos targets
 * e pelo menos 1 produção no cenário. Aprovação: ≥7 de 10 situações.
 */
export function gradeC1ExitAssessment(learning: UserLearningProfile): {
  passed: boolean;
  score: number;
  reason: string;
  scenariosPassed: number;
  scenarioResults: Array<{ id: string; passed: boolean; coverage: number }>;
} {
  const scenarioResults = C1_EXIT_SCENARIOS.map((sc) => {
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
  const score = Math.round((scenariosPassed / C1_EXIT_SCENARIOS.length) * 100);
  const passed = scenariosPassed >= 7;
  return {
    passed,
    score,
    reason: passed
      ? 'Produção situacional C1 suficiente para avançar.'
      : 'Ainda faltam situações comunicativas C1 de comunicação avançada.',
    scenariosPassed,
    scenarioResults,
  };
}
