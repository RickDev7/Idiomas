/**
 * C2_CURRICULUM — fonte única executável do nível C2.
 * Espelha C1Curriculum; não duplica frases (deriva de CURATED + units).
 */
import type { Phrase } from '@/types';
import type { PhraseConfidence, UserLearningProfile } from '@/services/learning/ConfidenceService';
import { isMastered, stateIndex } from '@/services/learning/ConfidenceService';
import { isAutomated, readAutomationScore } from '@/services/learning/AutomationScoreEngine';
import { CURATED } from './content';
import { LEVEL_BY_ID } from './levels';
import { COMPETENCY_BY_ID } from './competencies';
import { scopeCurriculumTargets, scopePhrasePool, isInModuleScope } from './PlannerModuleRestrict';

export interface C2Target {
  id: string;
  level: 'C2';
  unitId: string;
  competencyId: string;
  german: string;
  portuguese: string;
  type?: string;
  order: number;
  category: string;
}

function buildC2Targets(): C2Target[] {
  const out: C2Target[] = [];
  for (const block of CURATED.filter((c) => c.level === 'C2')) {
    const category = block.categories[0] ?? 'daily';
    block.core.forEach((phrase, idx) => {
      if (!phrase.id || !phrase.unitId) {
        throw new Error(`C2 curated phrase missing id/unitId: ${phrase.german}`);
      }
      out.push({
        id: phrase.id,
        level: 'C2',
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

export const C2_CURRICULUM: C2Target[] = buildC2Targets();

const BY_ID = new Map(C2_CURRICULUM.map((t) => [t.id, t]));

export function getC2Targets(): C2Target[] {
  return C2_CURRICULUM;
}

export function getC2TargetById(id: string): C2Target | undefined {
  return BY_ID.get(id);
}

export function getC2TargetsByUnit(unitId: string): C2Target[] {
  return C2_CURRICULUM.filter((t) => t.unitId === unitId);
}

export function getC2TargetsByCompetency(competencyId: string): C2Target[] {
  return C2_CURRICULUM.filter((t) => t.competencyId === competencyId);
}

export function isC2TargetId(id: string | null | undefined): boolean {
  return !!id && BY_ID.has(id);
}

export function c2UnitIdsInOrder(): string[] {
  const units = LEVEL_BY_ID.C2.modules.flatMap((m) => m.units);
  return units.map((u) => u.id);
}

export function c2FirstTarget(): C2Target {
  return C2_CURRICULUM[0];
}

export function c2CurriculumSeedPhrases(): Phrase[] {
  return C2_CURRICULUM.map((t) => ({
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

export function mergeC2CurriculumPhrases(existing: Phrase[]): Phrase[] {
  const byId = new Map(existing.map((p) => [p.id, p]));
  for (const seed of c2CurriculumSeedPhrases()) {
    if (!byId.has(seed.id)) byId.set(seed.id, seed);
  }
  for (const seed of c2CurriculumSeedPhrases()) {
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

/** Pool exclusivo C2 (nunca l0-* / a1-* / a2-* / b1-* / b2-* / c1-*). */
export function c2PhrasePool(existing: Phrase[] = []): Phrase[] {
  const merged = mergeC2CurriculumPhrases(existing);
  const ids = new Set(C2_CURRICULUM.map((t) => t.id));
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

export function getNextC2Target(
  currentTargetId: string | null | undefined,
  learning: UserLearningProfile,
  opts?: { excludePhraseId?: string | null; skipPhraseIds?: string[] | null; restrictToTargetIds?: readonly string[] | null },
): C2Target | null {
  const skip = new Set<string>(opts?.skipPhraseIds ?? []);
  if (opts?.excludePhraseId) skip.add(opts.excludePhraseId);
  if (currentTargetId) skip.add(currentTargetId);

  const ordered = scopeCurriculumTargets(C2_CURRICULUM, opts?.restrictToTargetIds);
  if (ordered.length === 0) return null;

  const currentRaw = currentTargetId ? BY_ID.get(currentTargetId) : undefined;
  const current = currentRaw && isInModuleScope(currentRaw.id, opts?.restrictToTargetIds) ? currentRaw : undefined;

  const pickFirstOpen = (candidates: C2Target[]): C2Target | null => {
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
    const sameUnit = scopeCurriculumTargets(getC2TargetsByUnit(current.unitId), opts?.restrictToTargetIds).filter((t) => t.order > current.order);
    const nextInUnit = pickFirstOpen(sameUnit);
    if (nextInUnit) return nextInUnit;
  }

  const unitOrder = c2UnitIdsInOrder();
  const startUnitIdx = current ? Math.max(0, unitOrder.indexOf(current.unitId)) : 0;
  for (let i = startUnitIdx; i < unitOrder.length; i++) {
    const unitTargets = scopeCurriculumTargets(getC2TargetsByUnit(unitOrder[i]), opts?.restrictToTargetIds);
    const open = pickFirstOpen(unitTargets);
    if (open) return open;
  }

  for (const t of ordered) {
    if (skip.has(t.id)) continue;
    if (!isReadyForAdvance(learning.phrases[t.id])) return t;
  }

  let weakest: C2Target | null = null;
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

export function pickC2PlannerTarget(
  learning: UserLearningProfile,
  phrases: Phrase[],
  opts?: { excludePhraseId?: string | null; skipPhraseIds?: string[] | null; stickPhraseId?: string | null; restrictToTargetIds?: readonly string[] | null },
): { conf: PhraseConfidence | undefined; phrase: Phrase | null; action: 'introduce' | 'practice' | 'recall' | 'converse' } {
  const pool = scopePhrasePool(c2PhrasePool(phrases), opts?.restrictToTargetIds);

  if (
    opts?.stickPhraseId &&
    isC2TargetId(opts.stickPhraseId) &&
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

  const next = getNextC2Target(null, learning, opts);
  if (!next) {
    return { conf: undefined, phrase: pool[0] ?? null, action: 'converse' };
  }
  const phrase = pool.find((p) => p.id === next.id) ?? {
    ...c2CurriculumSeedPhrases().find((p) => p.id === next.id)!,
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

export function isC2UnitComplete(unitId: string, learning: UserLearningProfile): boolean {
  const targets = getC2TargetsByUnit(unitId);
  if (targets.length === 0) return false;
  return targets.every((t) => isReadyForAdvance(learning.phrases[t.id]));
}

export function isC2CurriculumComplete(learning: UserLearningProfile): boolean {
  return C2_CURRICULUM.every((t) => isReadyForAdvance(learning.phrases[t.id]));
}

export function c2CompetencyMasteryFromLearning(
  competencyId: string,
  learning: UserLearningProfile,
): number {
  const targets = getC2TargetsByCompetency(competencyId);
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

export function assertC2CurriculumIntegrity(): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  const units = LEVEL_BY_ID.C2.modules.flatMap((m) => m.units);
  const unitIds = new Set(units.map((u) => u.id));
  const phraseIdToUnit = new Map<string, string>();

  for (const u of units) {
    for (const pid of u.phraseIds) {
      phraseIdToUnit.set(pid, u.id);
      const target = BY_ID.get(pid);
      if (!target) errors.push(`unit ${u.id} phraseId missing target: ${pid}`);
      else if (target.unitId !== u.id) errors.push(`phrase ${pid} unit mismatch ${target.unitId} vs ${u.id}`);
      else if (target.level !== 'C2') errors.push(`phrase ${pid} wrong level ${target.level}`);
      if (!COMPETENCY_BY_ID[u.competencies[0]]) errors.push(`unit ${u.id} bad competency`);
    }
  }

  for (const t of C2_CURRICULUM) {
    if (!unitIds.has(t.unitId)) errors.push(`target ${t.id} invalid unit ${t.unitId}`);
    if (!phraseIdToUnit.has(t.id)) errors.push(`target ${t.id} not listed in any unit phraseIds`);
    if (t.level !== 'C2') errors.push(`target ${t.id} level=${t.level}`);
    if (!t.id.startsWith('c2-')) errors.push(`target ${t.id} must start with c2-`);
    if (!COMPETENCY_BY_ID[t.competencyId]) errors.push(`target ${t.id} bad competency ${t.competencyId}`);
  }

  if (C2_CURRICULUM.length === 0) errors.push('no C2 targets');
  return { ok: errors.length === 0, errors };
}

/** Colocação pré-reforma escolar C2 (24 targets esqueleto). */
export const C2_LEGACY_PLACEMENT: Record<string, { unitId: string; competencyId: string }> = {
  'c2-nuance-ambivalent': { unitId: 'c2.u1', competencyId: 'c2.nuance' },
  'c2-nuance-nuancenreich': { unitId: 'c2.u1', competencyId: 'c2.nuance' },
  'c2-nuance-praezise': { unitId: 'c2.u1', competencyId: 'c2.nuance' },
  'c2-argue-vorbehalt': { unitId: 'c2.u2', competencyId: 'c2.argue' },
  'c2-argue-mehrschichtig': { unitId: 'c2.u2', competencyId: 'c2.argue' },
  'c2-argue-zugestaendnis': { unitId: 'c2.u2', competencyId: 'c2.argue' },
  'c2-disc-aufbau': { unitId: 'c2.u3', competencyId: 'c2.discourse' },
  'c2-disc-roterfaden': { unitId: 'c2.u3', competencyId: 'c2.discourse' },
  'c2-disc-schluss': { unitId: 'c2.u3', competencyId: 'c2.discourse' },
  'c2-inf-implizit': { unitId: 'c2.u4', competencyId: 'c2.inference' },
  'c2-inf-deuten': { unitId: 'c2.u4', competencyId: 'c2.inference' },
  'c2-inf-ableiten': { unitId: 'c2.u4', competencyId: 'c2.inference' },
  'c2-reg-formell': { unitId: 'c2.u5', competencyId: 'c2.register' },
  'c2-reg-umgang': { unitId: 'c2.u5', competencyId: 'c2.register' },
  'c2-reg-wechseln': { unitId: 'c2.u5', competencyId: 'c2.register' },
  'c2-med-interessen': { unitId: 'c2.u6', competencyId: 'c2.mediate' },
  'c2-med-bruecke': { unitId: 'c2.u6', competencyId: 'c2.mediate' },
  'c2-med-persuasion': { unitId: 'c2.u6', competencyId: 'c2.mediate' },
  'c2-crit-begriff': { unitId: 'c2.u7', competencyId: 'c2.critical' },
  'c2-crit-widerspruch': { unitId: 'c2.u7', competencyId: 'c2.critical' },
  'c2-crit-reflexion': { unitId: 'c2.u7', competencyId: 'c2.critical' },
  'c2-flu-spontan': { unitId: 'c2.u8', competencyId: 'c2.fluent' },
  'c2-flu-anpassen': { unitId: 'c2.u8', competencyId: 'c2.fluent' },
  'c2-flu-abschluss': { unitId: 'c2.u8', competencyId: 'c2.fluent' },
};

export type C2TargetAuditStatus = 'REUTILIZADO' | 'NOVO';

export type C2TargetAuditRow = {
  targetId: string;
  moduleId: string;
  competencyId: string;
  status: C2TargetAuditStatus;
  previousUnitId: string | null;
  previousCompetencyId: string | null;
  reorganized: boolean;
};

export function auditC2Targets(): {
  rows: C2TargetAuditRow[];
  total: number;
  reused: number;
  novo: number;
  reorganizedAmongReused: number;
  duplicateIds: string[];
} {
  const seen = new Set<string>();
  const duplicateIds: string[] = [];
  const rows: C2TargetAuditRow[] = C2_CURRICULUM.map((t) => {
    if (seen.has(t.id)) duplicateIds.push(t.id);
    seen.add(t.id);
    const legacy = C2_LEGACY_PLACEMENT[t.id];
    const status: C2TargetAuditStatus = legacy ? 'REUTILIZADO' : 'NOVO';
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

export type C2ExitScenario = {
  id: string;
  titlePt: string;
  situationPt: string;
  competencyIds: string[];
  evidenceTargetIds: string[];
};

/** Avaliação situacional de saída C2 (nível terminal). */
export const C2_EXIT_SCENARIOS: C2ExitScenario[] = [
  {
    id: 'c2-exit-position',
    titlePt: 'Defender posição com ressalvas',
    situationPt: 'Defender posição complexa com evidência, ressalvas e conclusão.',
    competencyIds: ['c2.argue'],
    evidenceTargetIds: ['c2-argue-these', 'c2-argue-evidenz', 'c2-argue-vorbehalt', 'c2-argue-schluss'],
  },
  {
    id: 'c2-exit-synthesis',
    titlePt: 'Sintetizar perspectivas',
    situationPt: 'Sintetizar duas ou mais perspectivas ou fontes.',
    competencyIds: ['c2.inference'],
    evidenceTargetIds: ['c2-acad-quellen', 'c2-acad-synthese', 'c2-inf-ableiten'],
  },
  {
    id: 'c2-exit-counter',
    titlePt: 'Contraponto difícil',
    situationPt: 'Responder a contraponto difícil com nuance e reformulação.',
    competencyIds: ['c2.discourse', 'c2.argue'],
    evidenceTargetIds: ['c2-argue-zugestaendnis', 'c2-disc-reformulieren', 'c2-disc-grad'],
  },
  {
    id: 'c2-exit-proposal',
    titlePt: 'Proposta profissional ou acadêmica',
    situationPt: 'Apresentar proposta com opções, risco e recomendação.',
    competencyIds: ['c2.fluent', 'c2.register'],
    evidenceTargetIds: ['c2-int-praesentation', 'c2-reg-fuehrung', 'c2-reg-akademisch'],
  },
  {
    id: 'c2-exit-negotiate',
    titlePt: 'Negociar conflito complexo',
    situationPt: 'Negociar solução e alinhar interesses sob pressão.',
    competencyIds: ['c2.mediate'],
    evidenceTargetIds: ['c2-med-interessen', 'c2-med-bruecke', 'c2-crisis-naechste'],
  },
  {
    id: 'c2-exit-ethics',
    titlePt: 'Tema ético, social ou abstrato',
    situationPt: 'Discutir ética, sustentabilidade ou desigualdade com equilíbrio.',
    competencyIds: ['c2.critical'],
    evidenceTargetIds: ['c2-ethik-technik', 'c2-ethik-nachhaltigkeit', 'c2-ethik-ungleichheit'],
  },
  {
    id: 'c2-exit-media',
    titlePt: 'Análise de mídia, cultura ou informação',
    situationPt: 'Analisar representação, narrativa ou credibilidade.',
    competencyIds: ['c2.nuance'],
    evidenceTargetIds: ['c2-culture-medien', 'c2-culture-narrativ', 'c2-culture-glaubwuerdigkeit'],
  },
  {
    id: 'c2-exit-crisis',
    titlePt: 'Comunicação de crise',
    situationPt: 'Comunicar situação crítica com clareza e diplomacia.',
    competencyIds: ['c2.mediate', 'c2.register'],
    evidenceTargetIds: ['c2-crisis-entscheidung', 'c2-crisis-risiko', 'c2-crisis-vertrag', 'c2-reg-diplomatie'],
  },
  {
    id: 'c2-exit-register',
    titlePt: 'Adaptação de registro',
    situationPt: 'Adaptar o registro a contextos diferentes.',
    competencyIds: ['c2.register', 'c2.fluent'],
    evidenceTargetIds: ['c2-reg-formell', 'c2-reg-umgang', 'c2-reg-wechseln', 'c2-flu-anpassen'],
  },
  {
    id: 'c2-exit-discussion',
    titlePt: 'Discussão 10–12 minutos',
    situationPt: 'Sustentar apresentação, mediação ou discussão estruturada de 10–12 minutos.',
    competencyIds: ['c2.fluent', 'c2.discourse'],
    evidenceTargetIds: [
      'c2-int-praesentation',
      'c2-int-mediation',
      'c2-int-reaktion',
      'c2-int-diskussion',
      'c2-flu-abschluss',
    ],
  },
];

/**
 * Gate situacional C2 (terminal): cada cenário exige evidência pronta em ≥50% dos targets
 * e pelo menos 1 produção no cenário. Aprovação: ≥7 de 10 situações.
 * Não desbloqueia nível posterior.
 */
export function gradeC2ExitAssessment(learning: UserLearningProfile): {
  passed: boolean;
  score: number;
  reason: string;
  scenariosPassed: number;
  scenarioResults: Array<{ id: string; passed: boolean; coverage: number }>;
} {
  const scenarioResults = C2_EXIT_SCENARIOS.map((sc) => {
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
  const score = Math.round((scenariosPassed / C2_EXIT_SCENARIOS.length) * 100);
  const passed = scenariosPassed >= 7;
  return {
    passed,
    score,
    reason: passed
      ? 'Produção situacional C2 suficiente para conclusão terminal do currículo.'
      : 'Ainda faltam situações comunicativas C2 de domínio avançado.',
    scenariosPassed,
    scenarioResults,
  };
}
