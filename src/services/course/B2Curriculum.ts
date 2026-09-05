/**
 * B2_CURRICULUM — fonte única executável do nível B2.
 * Espelha B1Curriculum; não duplica frases (deriva de CURATED + units).
 */
import type { Phrase } from '@/types';
import type { PhraseConfidence, UserLearningProfile } from '@/services/learning/ConfidenceService';
import { isMastered, stateIndex } from '@/services/learning/ConfidenceService';
import { isAutomated, readAutomationScore } from '@/services/learning/AutomationScoreEngine';
import { CURATED } from './content';
import { LEVEL_BY_ID } from './levels';
import { COMPETENCY_BY_ID } from './competencies';
import { scopeCurriculumTargets, scopePhrasePool, isInModuleScope } from './PlannerModuleRestrict';

export interface B2Target {
  id: string;
  level: 'B2';
  unitId: string;
  competencyId: string;
  german: string;
  portuguese: string;
  type?: string;
  order: number;
  category: string;
}

function buildB2Targets(): B2Target[] {
  const out: B2Target[] = [];
  for (const block of CURATED.filter((c) => c.level === 'B2')) {
    const category = block.categories[0] ?? 'daily';
    block.core.forEach((phrase, idx) => {
      if (!phrase.id || !phrase.unitId) {
        throw new Error(`B2 curated phrase missing id/unitId: ${phrase.german}`);
      }
      out.push({
        id: phrase.id,
        level: 'B2',
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

export const B2_CURRICULUM: B2Target[] = buildB2Targets();

const BY_ID = new Map(B2_CURRICULUM.map((t) => [t.id, t]));

export function getB2Targets(): B2Target[] {
  return B2_CURRICULUM;
}

export function getB2TargetById(id: string): B2Target | undefined {
  return BY_ID.get(id);
}

export function getB2TargetsByUnit(unitId: string): B2Target[] {
  return B2_CURRICULUM.filter((t) => t.unitId === unitId);
}

export function getB2TargetsByCompetency(competencyId: string): B2Target[] {
  return B2_CURRICULUM.filter((t) => t.competencyId === competencyId);
}

export function isB2TargetId(id: string | null | undefined): boolean {
  return !!id && BY_ID.has(id);
}

export function b2UnitIdsInOrder(): string[] {
  const units = LEVEL_BY_ID.B2.modules.flatMap((m) => m.units);
  return units.map((u) => u.id);
}

export function b2FirstTarget(): B2Target {
  return B2_CURRICULUM[0];
}

export function b2CurriculumSeedPhrases(): Phrase[] {
  return B2_CURRICULUM.map((t) => ({
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

export function mergeB2CurriculumPhrases(existing: Phrase[]): Phrase[] {
  const byId = new Map(existing.map((p) => [p.id, p]));
  for (const seed of b2CurriculumSeedPhrases()) {
    if (!byId.has(seed.id)) byId.set(seed.id, seed);
  }
  for (const seed of b2CurriculumSeedPhrases()) {
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

/** Pool exclusivo B2 (nunca l0-* / a1-* / a2-* / b1-*). */
export function b2PhrasePool(existing: Phrase[] = []): Phrase[] {
  const merged = mergeB2CurriculumPhrases(existing);
  const ids = new Set(B2_CURRICULUM.map((t) => t.id));
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

export function getNextB2Target(
  currentTargetId: string | null | undefined,
  learning: UserLearningProfile,
  opts?: { excludePhraseId?: string | null; skipPhraseIds?: string[] | null; restrictToTargetIds?: readonly string[] | null },
): B2Target | null {
  const skip = new Set<string>(opts?.skipPhraseIds ?? []);
  if (opts?.excludePhraseId) skip.add(opts.excludePhraseId);
  if (currentTargetId) skip.add(currentTargetId);

  const ordered = scopeCurriculumTargets(B2_CURRICULUM, opts?.restrictToTargetIds);
  if (ordered.length === 0) return null;

  const currentRaw = currentTargetId ? BY_ID.get(currentTargetId) : undefined;
  const current = currentRaw && isInModuleScope(currentRaw.id, opts?.restrictToTargetIds) ? currentRaw : undefined;

  const pickFirstOpen = (candidates: B2Target[]): B2Target | null => {
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
    const sameUnit = scopeCurriculumTargets(getB2TargetsByUnit(current.unitId), opts?.restrictToTargetIds).filter((t) => t.order > current.order);
    const nextInUnit = pickFirstOpen(sameUnit);
    if (nextInUnit) return nextInUnit;
  }

  const unitOrder = b2UnitIdsInOrder();
  const startUnitIdx = current ? Math.max(0, unitOrder.indexOf(current.unitId)) : 0;
  for (let i = startUnitIdx; i < unitOrder.length; i++) {
    const unitTargets = scopeCurriculumTargets(getB2TargetsByUnit(unitOrder[i]), opts?.restrictToTargetIds);
    const open = pickFirstOpen(unitTargets);
    if (open) return open;
  }

  for (const t of ordered) {
    if (skip.has(t.id)) continue;
    if (!isReadyForAdvance(learning.phrases[t.id])) return t;
  }

  let weakest: B2Target | null = null;
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

export function pickB2PlannerTarget(
  learning: UserLearningProfile,
  phrases: Phrase[],
  opts?: { excludePhraseId?: string | null; skipPhraseIds?: string[] | null; stickPhraseId?: string | null; restrictToTargetIds?: readonly string[] | null },
): { conf: PhraseConfidence | undefined; phrase: Phrase | null; action: 'introduce' | 'practice' | 'recall' | 'converse' } {
  const pool = scopePhrasePool(b2PhrasePool(phrases), opts?.restrictToTargetIds);

  if (
    opts?.stickPhraseId &&
    isB2TargetId(opts.stickPhraseId) &&
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

  const next = getNextB2Target(null, learning, opts);
  if (!next) {
    return { conf: undefined, phrase: pool[0] ?? null, action: 'converse' };
  }
  const phrase = pool.find((p) => p.id === next.id) ?? {
    ...b2CurriculumSeedPhrases().find((p) => p.id === next.id)!,
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

export function isB2UnitComplete(unitId: string, learning: UserLearningProfile): boolean {
  const targets = getB2TargetsByUnit(unitId);
  if (targets.length === 0) return false;
  return targets.every((t) => isReadyForAdvance(learning.phrases[t.id]));
}

export function isB2CurriculumComplete(learning: UserLearningProfile): boolean {
  return B2_CURRICULUM.every((t) => isReadyForAdvance(learning.phrases[t.id]));
}

export function b2CompetencyMasteryFromLearning(
  competencyId: string,
  learning: UserLearningProfile,
): number {
  const targets = getB2TargetsByCompetency(competencyId);
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

export function assertB2CurriculumIntegrity(): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  const units = LEVEL_BY_ID.B2.modules.flatMap((m) => m.units);
  const unitIds = new Set(units.map((u) => u.id));
  const phraseIdToUnit = new Map<string, string>();

  for (const u of units) {
    for (const pid of u.phraseIds) {
      phraseIdToUnit.set(pid, u.id);
      const target = BY_ID.get(pid);
      if (!target) errors.push(`unit ${u.id} phraseId missing target: ${pid}`);
      else if (target.unitId !== u.id) errors.push(`phrase ${pid} unit mismatch ${target.unitId} vs ${u.id}`);
      else if (target.level !== 'B2') errors.push(`phrase ${pid} wrong level ${target.level}`);
      if (!COMPETENCY_BY_ID[u.competencies[0]]) errors.push(`unit ${u.id} bad competency`);
    }
  }

  for (const t of B2_CURRICULUM) {
    if (!unitIds.has(t.unitId)) errors.push(`target ${t.id} invalid unit ${t.unitId}`);
    if (!phraseIdToUnit.has(t.id)) errors.push(`target ${t.id} not listed in any unit phraseIds`);
    if (t.level !== 'B2') errors.push(`target ${t.id} level=${t.level}`);
    if (!t.id.startsWith('b2-')) errors.push(`target ${t.id} must start with b2-`);
    if (!COMPETENCY_BY_ID[t.competencyId]) errors.push(`target ${t.id} bad competency ${t.competencyId}`);
  }

  if (B2_CURRICULUM.length === 0) errors.push('no B2 targets');
  return { ok: errors.length === 0, errors };
}

/** Colocação pré-reforma escolar B2 (24 targets esqueleto). */
export const B2_LEGACY_PLACEMENT: Record<string, { unitId: string; competencyId: string }> = {
  'b2-narrative-erfahrung': { unitId: 'b2.u1', competencyId: 'b2.narrative' },
  'b2-narrative-damals': { unitId: 'b2.u1', competencyId: 'b2.narrative' },
  'b2-narrative-rueckblick': { unitId: 'b2.u1', competencyId: 'b2.narrative' },
  'b2-cause-dadurch': { unitId: 'b2.u2', competencyId: 'b2.cause_effect' },
  'b2-cause-waere': { unitId: 'b2.u2', competencyId: 'b2.cause_effect' },
  'b2-cause-folglich': { unitId: 'b2.u2', competencyId: 'b2.cause_effect' },
  'b2-argue-auffassung': { unitId: 'b2.u3', competencyId: 'b2.argue' },
  'b2-argue-dagegen': { unitId: 'b2.u3', competencyId: 'b2.argue' },
  'b2-argue-laesst': { unitId: 'b2.u3', competencyId: 'b2.argue' },
  'b2-compare-optionen': { unitId: 'b2.u4', competencyId: 'b2.compare' },
  'b2-compare-vorteile': { unitId: 'b2.u4', competencyId: 'b2.compare' },
  'b2-compare-abwaegen': { unitId: 'b2.u4', competencyId: 'b2.compare' },
  'b2-solve-problem': { unitId: 'b2.u5', competencyId: 'b2.problems_solutions' },
  'b2-solve-vorschlag': { unitId: 'b2.u5', competencyId: 'b2.problems_solutions' },
  'b2-solve-schritt': { unitId: 'b2.u5', competencyId: 'b2.problems_solutions' },
  'b2-work-optionen': { unitId: 'b2.u6', competencyId: 'b2.work_pro' },
  'b2-work-kompromiss': { unitId: 'b2.u6', competencyId: 'b2.work_pro' },
  'b2-work-verhandelbar': { unitId: 'b2.u6', competencyId: 'b2.work_pro' },
  'b2-defend-entscheidung': { unitId: 'b2.u7', competencyId: 'b2.defend' },
  'b2-defend-widersprechen': { unitId: 'b2.u7', competencyId: 'b2.defend' },
  'b2-defend-halten': { unitId: 'b2.u7', competencyId: 'b2.defend' },
  'b2-fluent-ehrlich': { unitId: 'b2.u8', competencyId: 'b2.fluent' },
  'b2-fluent-hoere': { unitId: 'b2.u8', competencyId: 'b2.fluent' },
  'b2-fluent-sinn': { unitId: 'b2.u8', competencyId: 'b2.fluent' },
};

export type B2TargetAuditStatus = 'REUTILIZADO' | 'NOVO';

export type B2TargetAuditRow = {
  targetId: string;
  moduleId: string;
  competencyId: string;
  status: B2TargetAuditStatus;
  previousUnitId: string | null;
  previousCompetencyId: string | null;
  reorganized: boolean;
};

export function auditB2Targets(): {
  rows: B2TargetAuditRow[];
  total: number;
  reused: number;
  novo: number;
  reorganizedAmongReused: number;
  duplicateIds: string[];
} {
  const seen = new Set<string>();
  const duplicateIds: string[] = [];
  const rows: B2TargetAuditRow[] = B2_CURRICULUM.map((t) => {
    if (seen.has(t.id)) duplicateIds.push(t.id);
    seen.add(t.id);
    const legacy = B2_LEGACY_PLACEMENT[t.id];
    const status: B2TargetAuditStatus = legacy ? 'REUTILIZADO' : 'NOVO';
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

export type B2ExitScenario = {
  id: string;
  titlePt: string;
  situationPt: string;
  competencyIds: string[];
  evidenceTargetIds: string[];
};

/** Avaliação situacional de saída B2 (escola de idiomas). */
export const B2_EXIT_SCENARIOS: B2ExitScenario[] = [
  {
    id: 'b2-exit-argue',
    titlePt: 'Defender opinião',
    situationPt: 'Defender uma opinião com argumentos, exemplo e conclusão.',
    competencyIds: ['b2.argue'],
    evidenceTargetIds: ['b2-argue-auffassung', 'b2-argue-beispiel', 'b2-argue-schluss'],
  },
  {
    id: 'b2-exit-compare',
    titlePt: 'Comparar e decidir',
    situationPt: 'Comparar duas opções e justificar a decisão.',
    competencyIds: ['b2.compare'],
    evidenceTargetIds: ['b2-compare-optionen', 'b2-compare-abwaegen', 'b2-compare-begruenden'],
  },
  {
    id: 'b2-exit-objection',
    titlePt: 'Lidar com objeção',
    situationPt: 'Reagir a uma objeção e manter ou ajustar a posição.',
    competencyIds: ['b2.defend', 'b2.argue'],
    evidenceTargetIds: ['b2-argue-einwand', 'b2-defend-widersprechen', 'b2-conflict-zuhoeren'],
  },
  {
    id: 'b2-exit-presentation',
    titlePt: 'Apresentação profissional curta',
    situationPt: 'Fazer apresentação profissional clara com pontos principais.',
    competencyIds: ['b2.work_pro'],
    evidenceTargetIds: ['b2-work-praesentation', 'b2-work-prozess', 'b2-work-feedback'],
  },
  {
    id: 'b2-exit-negotiate',
    titlePt: 'Negociar solução',
    situationPt: 'Negociar solução para um problema ou conflito.',
    competencyIds: ['b2.defend', 'b2.work_pro'],
    evidenceTargetIds: ['b2-work-kompromiss', 'b2-conflict-ausweg', 'b2-solve-vorschlag'],
  },
  {
    id: 'b2-exit-culture',
    titlePt: 'Experiência cultural ou viagem',
    situationPt: 'Relatar experiência cultural/viagem e justificar preferência.',
    competencyIds: ['b2.narrative'],
    evidenceTargetIds: ['b2-narrative-erfahrung', 'b2-culture-empfehlen', 'b2-culture-anpassung'],
  },
  {
    id: 'b2-exit-society',
    titlePt: 'Tema social ou tecnológico',
    situationPt: 'Discutir tema social/tecnológico familiar com nuance.',
    competencyIds: ['b2.cause_effect'],
    evidenceTargetIds: ['b2-society-technik', 'b2-society-medien', 'b2-society-datenschutz'],
  },
  {
    id: 'b2-exit-service',
    titlePt: 'Serviço ou reclamação',
    situationPt: 'Reclamar ou resolver situação de serviço/contrato.',
    competencyIds: ['b2.problems_solutions'],
    evidenceTargetIds: ['b2-service-beschwerde', 'b2-service-vertrag', 'b2-service-bedingungen'],
  },
  {
    id: 'b2-exit-register',
    titlePt: 'Registro profissional',
    situationPt: 'Adaptar a fala para contexto profissional.',
    competencyIds: ['b2.fluent', 'b2.work_pro'],
    evidenceTargetIds: ['b2-fluent-register', 'b2-work-frist', 'b2-work-verhandelbar'],
  },
  {
    id: 'b2-exit-discussion',
    titlePt: 'Discussão espontânea 5–7 min',
    situationPt: 'Sustentar discussão estruturada com reação ao interlocutor.',
    competencyIds: ['b2.fluent', 'b2.argue', 'b2.defend'],
    evidenceTargetIds: [
      'b2-fluent-diskussion',
      'b2-fluent-zusammen',
      'b2-fluent-reaktion',
      'b2-argue-konsens',
    ],
  },
];

/**
 * Gate situacional B2: cada cenário exige evidência pronta em ≥50% dos targets
 * e pelo menos 1 produção no cenário. Aprovação: ≥7 de 10 situações.
 */
export function gradeB2ExitAssessment(learning: UserLearningProfile): {
  passed: boolean;
  score: number;
  reason: string;
  scenariosPassed: number;
  scenarioResults: Array<{ id: string; passed: boolean; coverage: number }>;
} {
  const scenarioResults = B2_EXIT_SCENARIOS.map((sc) => {
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
  const score = Math.round((scenariosPassed / B2_EXIT_SCENARIOS.length) * 100);
  const passed = scenariosPassed >= 7;
  return {
    passed,
    score,
    reason: passed
      ? 'Produção situacional B2 suficiente para avançar.'
      : 'Ainda faltam situações comunicativas B2 de fluência funcional.',
    scenariosPassed,
    scenarioResults,
  };
}
