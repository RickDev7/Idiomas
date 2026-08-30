/* AutomationScoreEngine — Fase 6
   Score 0–100 persistente + histórico + Next Best Action no Live.
   Learned ≠ automated ≠ mastered. O número muda o comportamento.

   Pesos (documentados):
     accuracy 25% · independence 20% · transfer 15% ·
     spontaneous 20% · helpReduction 10% · stability 10%.
   Latência: apenas bônus se rápido; acerto lento NÃO penaliza.
   AUTOMATED (>=80) exige também sessões + independência + transfer/spontaneous.
   Estados: NOT_READY / EMERGING / FUNCTIONAL / AUTOMATED / STABLE.
   NBA: baixo→guided · médio→transfer · alto→spontaneous · automated→maintenance/converse.
*/
import type { PhraseConfidence, PhraseState, AutomationHistoryEntry } from '@/services/learning/ConfidenceService';
import { stateIndex } from '@/services/learning/ConfidenceService';

export type PedagogicalKind =
  | 'introduce'
  | 'guided'
  | 'recall'
  | 'independent'
  | 'transfer'
  | 'spontaneous'
  | 'automation'
  | 'maintenance';

export type AutomationBand =
  | 'NOT_READY'
  | 'EMERGING'
  | 'FUNCTIONAL'
  | 'AUTOMATED'
  | 'STABLE';

export interface AutomationComponents {
  accuracy: number;
  independentUse: number;
  transfer: number;
  spontaneousUse: number;
  helpReduction: number;
  stabilityAcrossSessions: number;
  /** Secundário: bônus se rápido; 0 se lento mas correto (não penaliza). */
  latencyBonus: number;
}

export interface LearningItemState {
  itemId: string;
  state: PhraseState;
  accuracy: number;
  responseTimeMs: number;
  helpLevel: number;
  independentUse: number;
  transferCount: number;
  spontaneousCount: number;
  lastPracticed: string | null;
  lastRecalled?: string | null;
  lastIndependentUse?: string | null;
  lastTransfer?: string | null;
  lastSpontaneous?: string | null;
  lastReviewed?: string | null;
  reviewCount?: number;
  successiveSuccess?: number;
  nextReview?: string | null;
  automationScore: number;
  independenceScore: number;
  automationBand: AutomationBand;
  variationAxesTried?: string[];
  components?: AutomationComponents;
}

export interface NextBestActionContext {
  bottleneck?: string | null;
  daysSincePractice?: number;
  raisingDifficulty?: boolean;
  sessionGoal?: 'conversation' | 'drill' | 'review' | 'auto';
  recentError?: boolean;
  pendingTransfer?: boolean;
  inMicroPractice?: boolean;
  dueReview?: boolean;
  reviewType?: string;
}

export interface NextBestActionDecision {
  action: PedagogicalKind;
  reason: string;
  score: number;
  band: AutomationBand;
}

/**
 * Pesos (Fase 6):
 * accuracy 25% · independence 20% · transfer 15% ·
 * spontaneous 20% · helpReduction 10% · stability 10%.
 * Latência: só bônus se rápido; acerto lento não desce o score.
 */
export const AUTOMATION_WEIGHTS = {
  accuracy: 0.25,
  independence: 0.2,
  transfer: 0.15,
  spontaneous: 0.2,
  helpReduction: 0.1,
  stability: 0.1,
} as const;

export const AUTOMATED_THRESHOLD = 80;
export const MAX_SCORE_STEP = 12;

function clamp01to100(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function daysBetween(iso: string | null | undefined): number {
  if (!iso) return 999;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return 999;
  return Math.max(0, Math.floor((Date.now() - t) / 86_400_000));
}

export function automationBandFromScore(score: number, automated: boolean): AutomationBand {
  if (automated && score >= 90) return 'STABLE';
  if (automated) return 'AUTOMATED';
  if (score < 25) return 'NOT_READY';
  if (score < 50) return 'EMERGING';
  return 'FUNCTIONAL';
}

export function computeAutomationComponents(
  c: PhraseConfidence,
  opts?: { helpLevel?: number },
): AutomationComponents {
  const accuracy =
    c.timesProduced > 0 ? (c.timesCorrect / c.timesProduced) * 100 : c.confidence * 0.25;

  const helpRaw = opts?.helpLevel ?? (c.needsHelp ? 3 : 0);
  const helpReduction = clamp01to100(100 - helpRaw * 22 - (c.needsHelp ? 18 : 0));

  const independentUse =
    stateIndex(c.state) >= stateIndex('answeredAlone')
      ? clamp01to100(
          35 +
            (c.independentSessions ?? 0) * 12 +
            (c.needsHelp ? 0 : 18) +
            Math.min(20, c.timesCorrect * 4),
        )
      : clamp01to100(c.timesCorrect * 4);

  const transfer = clamp01to100(c.contextTransfer);

  const spontMem = c.spontaneousSessions ?? (stateIndex(c.state) >= stateIndex('spontaneous') ? 1 : 0);
  const spontaneousUse = clamp01to100(
    stateIndex(c.state) >= stateIndex('spontaneous')
      ? 70 + Math.min(30, spontMem * 15)
      : spontMem > 0
        ? 50 + spontMem * 15
        : c.contextTransfer * 0.25,
  );

  const sessions = Math.max(c.successfulSessions ?? 0, Math.min(6, Math.floor((c.timesSeen || 0) / 3)));
  const exposure = Math.min(1, (c.timesSeen || 0) / 8);
  const correctRatio = c.timesProduced > 0 ? c.timesCorrect / c.timesProduced : 0;
  const freshness = daysBetween(c.lastProduced || c.lastSeen);
  const freshnessFactor = freshness <= 3 ? 1 : freshness <= 10 ? 0.8 : freshness <= 21 ? 0.5 : 0.25;
  const sessionFactor = sessions >= 3 ? 1 : sessions === 2 ? 0.75 : sessions === 1 ? 0.45 : 0.25;
  const stabilityAcrossSessions = clamp01to100(
    100 * correctRatio * (0.35 + 0.65 * exposure) * freshnessFactor * sessionFactor * (c.needsHelp ? 0.65 : 1),
  );

  let latencyBonus = 0;
  if (c.avgResponseMs > 0 && c.avgResponseMs <= 2800 && correctRatio >= 0.6) {
    latencyBonus = 8;
  }

  return {
    accuracy: clamp01to100(accuracy),
    independentUse,
    transfer,
    spontaneousUse,
    helpReduction,
    stabilityAcrossSessions,
    latencyBonus,
  };
}

export function scoreFromComponents(comp: AutomationComponents): number {
  const raw =
    comp.accuracy * AUTOMATION_WEIGHTS.accuracy +
    comp.independentUse * AUTOMATION_WEIGHTS.independence +
    comp.transfer * AUTOMATION_WEIGHTS.transfer +
    comp.spontaneousUse * AUTOMATION_WEIGHTS.spontaneous +
    comp.helpReduction * AUTOMATION_WEIGHTS.helpReduction +
    comp.stabilityAcrossSessions * AUTOMATION_WEIGHTS.stability +
    comp.latencyBonus * 0.04;
  return clamp01to100(raw);
}

export function calculateAutomationScore(c: PhraseConfidence, helpLevel?: number): number {
  return computeAutomationScore(c, helpLevel);
}

export function computeAutomationScore(c: PhraseConfidence, helpLevel?: number): number {
  return scoreFromComponents(computeAutomationComponents(c, { helpLevel }));
}

function evidenceSummary(c: PhraseConfidence, helpLevel?: number): string {
  const comp = computeAutomationComponents(c, { helpLevel });
  return `acc=${comp.accuracy} indep=${comp.independentUse} xfer=${comp.transfer} spont=${comp.spontaneousUse} help=${comp.helpReduction} stab=${comp.stabilityAcrossSessions}`;
}

function stepToward(prev: number, next: number): number {
  const delta = next - prev;
  if (delta > MAX_SCORE_STEP) return prev + MAX_SCORE_STEP;
  if (delta < -MAX_SCORE_STEP) return prev - MAX_SCORE_STEP;
  return next;
}

export function updateAutomationScore(
  c: PhraseConfidence,
  opts?: { helpLevel?: number; sessionId?: string; evidence?: string },
): PhraseConfidence {
  return persistAutomationScore(c, opts?.helpLevel, opts);
}

export function persistAutomationScore(
  c: PhraseConfidence,
  helpLevel?: number,
  extra?: { sessionId?: string; evidence?: string },
): PhraseConfidence {
  const raw = computeAutomationScore(
    { ...c, automationScore: undefined, automationUpdatedAt: undefined },
    helpLevel,
  );
  const prev =
    typeof c.automationScore === 'number' && Number.isFinite(c.automationScore) ? c.automationScore : null;
  const automationScore = prev === null ? raw : stepToward(prev, raw);
  const now = new Date().toISOString();
  const history: AutomationHistoryEntry[] = [...(c.automationHistory ?? [])];
  history.push({
    score: automationScore,
    date: now,
    evidence: extra?.evidence || evidenceSummary(c, helpLevel),
    sessionId: extra?.sessionId,
  });
  if (history.length > 40) history.splice(0, history.length - 40);

  let successfulSessions = c.successfulSessions ?? 0;
  let independentSessions = c.independentSessions ?? 0;
  let spontaneousSessions = c.spontaneousSessions ?? 0;
  const ev = extra?.evidence || '';
  const successEv = ev === 'produced' || ev === 'transfer' || ev === 'spontaneous';
  if (extra?.sessionId && extra.sessionId !== c.lastEvidenceSessionId && successEv) {
    if ((c.timesCorrect ?? 0) > 0) successfulSessions += 1;
    if (stateIndex(c.state) >= stateIndex('answeredAlone') && !c.needsHelp) independentSessions += 1;
    if (ev === 'spontaneous' || stateIndex(c.state) >= stateIndex('spontaneous')) {
      spontaneousSessions += 1;
    }
  }

  return {
    ...c,
    automationScore,
    automationUpdatedAt: now,
    lastAutomationUpdate: now,
    automationHistory: history,
    successfulSessions,
    independentSessions,
    spontaneousSessions,
    lastEvidenceSessionId: extra?.sessionId ?? c.lastEvidenceSessionId,
  };
}

export function readAutomationScore(c: PhraseConfidence): number {
  if (typeof c.automationScore === 'number' && Number.isFinite(c.automationScore)) {
    return clamp01to100(c.automationScore);
  }
  return computeAutomationScore(c);
}

/**
 * AUTOMATED exige score alto + evidência (sessões, independência, transfer/spontaneous).
 */
export function isAutomated(c: PhraseConfidence): boolean {
  const score = readAutomationScore(c);
  if (score < AUTOMATED_THRESHOLD) return false;
  const sessions = c.successfulSessions ?? 0;
  const indep = c.independentSessions ?? (stateIndex(c.state) >= stateIndex('answeredAlone') ? 1 : 0);
  const transferOk = (c.contextTransfer ?? 0) >= 40;
  const spontOk = (c.spontaneousSessions ?? 0) >= 1 || stateIndex(c.state) >= stateIndex('spontaneous');
  if (c.needsHelp) return false;
  if (sessions < 2 && (c.timesSeen ?? 0) < 6) return false;
  if (indep < 1) return false;
  if (!transferOk && !spontOk) return false;
  return true;
}

export function toLearningItemState(c: PhraseConfidence, helpLevel = 0): LearningItemState {
  const components = computeAutomationComponents(c, { helpLevel });
  const automationScore =
    typeof c.automationScore === 'number' ? clamp01to100(c.automationScore) : scoreFromComponents(components);
  const alone = stateIndex(c.state) >= stateIndex('answeredAlone');
  const independenceScore = clamp01to100(
    (alone ? 35 : 0) +
      (c.needsHelp ? 0 : 20) +
      Math.min(25, c.contextTransfer * 0.25) +
      (stateIndex(c.state) >= stateIndex('spontaneous') ? 20 : c.contextTransfer >= 60 ? 15 : 0),
  );
  const automated = isAutomated({ ...c, automationScore });

  return {
    itemId: c.phraseId,
    state: c.state,
    accuracy: components.accuracy,
    responseTimeMs: c.avgResponseMs,
    helpLevel: c.needsHelp ? Math.max(helpLevel, 1) : helpLevel,
    independentUse: alone ? c.timesCorrect : 0,
    transferCount: Math.round(c.contextTransfer / 25),
    spontaneousCount:
      c.spontaneousSessions ?? (stateIndex(c.state) >= stateIndex('spontaneous') ? 1 : 0),
    lastPracticed: c.lastProduced || c.lastSeen,
    lastRecalled: c.lastRecalled,
    lastIndependentUse: c.lastIndependentUse,
    lastTransfer: c.lastTransfer,
    lastSpontaneous: c.lastSpontaneous,
    lastReviewed: c.lastReviewed,
    reviewCount: c.reviewCount ?? 0,
    successiveSuccess: c.successiveSuccess ?? 0,
    nextReview: c.nextReview ?? null,
    automationScore,
    independenceScore,
    automationBand: automationBandFromScore(automationScore, automated),
    components,
  };
}

export function decideNextBestAction(
  input: PhraseConfidence | LearningItemState | undefined,
  ctx?: NextBestActionContext,
): NextBestActionDecision {
  if (!input) {
    return { action: 'introduce', reason: 'sem evidência — apresentar a estrutura', score: 0, band: 'NOT_READY' };
  }

  const item: LearningItemState =
    'itemId' in input && 'accuracy' in input && !('phraseId' in input)
      ? (input as LearningItemState)
      : 'phraseId' in input
        ? toLearningItemState(input as PhraseConfidence)
        : (input as LearningItemState);

  const score = item.automationScore;
  const band = item.automationBand ?? automationBandFromScore(score, false);
  const days = ctx?.daysSincePractice ?? daysBetween(item.lastPracticed);
  const conf = 'phraseId' in input ? (input as PhraseConfidence) : undefined;
  const automated = conf ? isAutomated(conf) : band === 'AUTOMATED' || band === 'STABLE';

  if (ctx?.inMicroPractice) {
    return { action: 'guided', reason: 'MicroPractice ativo — não mudar ação', score, band };
  }
  if (ctx?.pendingTransfer) {
    return { action: 'transfer', reason: 'transferência em curso', score, band };
  }
  if (ctx?.sessionGoal === 'review' || ctx?.dueReview) {
    const rt = ctx.reviewType || '';
    if (rt.includes('GUIDED')) return { action: 'guided', reason: `REVIEW ${rt} — GUIDED_SPEAKING`, score, band };
    if (rt.includes('TRANSFER')) return { action: 'transfer', reason: `REVIEW ${rt} — TRANSFER`, score, band };
    if (rt.includes('SPONTANEOUS') || rt.includes('MAINTENANCE')) {
      return { action: 'spontaneous', reason: `REVIEW ${rt} — uso real`, score, band };
    }
    if (rt.includes('INDEPENDENT')) return { action: 'independent', reason: `REVIEW ${rt} — produzir sozinho`, score, band };
    return { action: 'recall', reason: `REVIEW ${rt || 'RECALL'} — recuperar em contexto`, score, band };
  }
  if (ctx?.recentError && score < 80) {
    return { action: 'guided', reason: `erro recente; automationScore ${score} — PRACTICE`, score, band };
  }

  if (item.state === 'new' || item.state === 'heard') {
    return { action: 'introduce', reason: 'item novo / só ouvido — INTRODUCE', score, band };
  }

  if (days > 10 && score < 75 && !automated) {
    return { action: 'recall', reason: `esfriou ${days}d, score ${score} — RECALL`, score, band };
  }

  if (ctx?.bottleneck === 'response_speed' && score >= 40 && score < 80) {
    return { action: 'automation', reason: 'gargalo de velocidade — prática de fluência', score, band };
  }

  if (ctx?.bottleneck === 'speaking' && score < 75) {
    if (item.helpLevel > 0 || stateIndex(item.state) < stateIndex('answeredAlone')) {
      return { action: 'guided', reason: 'gargalo speaking — GUIDED_PRACTICE (produção)', score, band };
    }
    return { action: 'independent', reason: 'gargalo speaking — produção independente', score, band };
  }

  if (ctx?.bottleneck === 'listening' && score < 75) {
    return { action: 'introduce', reason: 'gargalo listening — mais input / reconhecimento', score, band };
  }

  if (score < 35) {
    if (stateIndex(item.state) >= stateIndex('answeredAlone') && item.transferCount < 2) {
      return {
        action: 'transfer',
        reason: `score ${score} baixo mas já produz sozinho; transferência insuficiente — TRANSFER`,
        score,
        band,
      };
    }
    if (item.helpLevel > 0 || stateIndex(item.state) < stateIndex('answeredAlone')) {
      return { action: 'guided', reason: `automationScore ${score} — GUIDED_PRACTICE`, score, band };
    }
    return { action: 'recall', reason: `automationScore ${score} — RECALL`, score, band };
  }

  if (score < 65) {
    if (ctx?.raisingDifficulty) {
      return { action: 'recall', reason: `score ${score} e subida de dificuldade — RECALL`, score, band };
    }
    return {
      action: 'transfer',
      reason: `target conhecido, automationScore ${score}, transferência insuficiente — TRANSFER`,
      score,
      band,
    };
  }

  if (score < AUTOMATED_THRESHOLD || !automated) {
    if (item.spontaneousCount < 1) {
      return {
        action: 'spontaneous',
        reason: `automationScore ${score} alto; falta uso espontâneo — SPONTANEOUS`,
        score,
        band,
      };
    }
    if (ctx?.sessionGoal === 'conversation') {
      return { action: 'independent', reason: `score ${score} — CONVERSATION`, score, band };
    }
    return { action: 'spontaneous', reason: `automationScore ${score} — SPONTANEOUS_OPPORTUNITY`, score, band };
  }

  if (ctx?.sessionGoal === 'drill') {
    return { action: 'spontaneous', reason: `automatizado (${score}) mas sessão drill — SPONTANEOUS`, score, band };
  }
  return {
    action: 'maintenance',
    reason: `AUTOMATED (${score}) — CONVERSATION / MAINTENANCE_REVIEW (não repetir)`,
    score,
    band,
  };
}

export function getNextBestLearningAction(
  input: PhraseConfidence | LearningItemState | undefined,
  ctx?: NextBestActionContext,
): PedagogicalKind {
  const d = decideNextBestAction(input, ctx);
  if (d.action === 'maintenance') return 'independent';
  return d.action;
}

export function nextBestLearningAction(
  c: PhraseConfidence | undefined,
  ctx?: NextBestActionContext,
): PedagogicalKind {
  return getNextBestLearningAction(c, ctx);
}

export function averageAutomationScore(phrases: Record<string, PhraseConfidence>): number {
  const vals = Object.values(phrases);
  if (vals.length === 0) return 0;
  const sum = vals.reduce((s, c) => s + readAutomationScore(c), 0);
  return clamp01to100(sum / vals.length);
}

export function reviewPriority(c: PhraseConfidence): number {
  const auto = readAutomationScore(c);
  const days = daysBetween(c.lastProduced || c.lastSeen);
  if (isAutomated(c)) return Math.min(25, days);
  return 100 - auto + Math.min(40, days * 2) + (c.needsHelp ? 15 : 0);
}

export function logAutomationDebug(opts: {
  item: string;
  score: number;
  evidence: string;
  action: string;
  reason: string;
}): void {
  if (typeof console === 'undefined' || !console.debug) return;
  console.debug(
    '[AUTOMATION]',
    `item=${opts.item}`,
    `score=${opts.score}`,
    `evidence=${opts.evidence}`,
    `action=${opts.action}`,
    `reason=${opts.reason}`,
  );
}
