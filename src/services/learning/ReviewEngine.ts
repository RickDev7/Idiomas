/* ReviewEngine — Fase 7
   Memória → prioridade → tipo real → resultado → nextReview.
   Não é flashcard: cada tipo muda o que o professor faz no Live. */
import type { PhraseConfidence, ReviewHistoryEntry } from '@/services/learning/ConfidenceService';
import { stateIndex, updateConfidence } from '@/services/learning/ConfidenceService';
import {
  effectiveNextReview,
  memoryStrength,
  type MemoryStrength,
} from '@/services/learning/MemoryStrengthEngine';
import {
  isAutomated,
  persistAutomationScore,
  toLearningItemState,
  type LearningItemState,
} from '@/services/learning/AutomationScoreEngine';
import type { Phrase, Review, ReviewStage, UserProfile } from '@/types';

export type ReviewType =
  | 'RECOGNITION_REVIEW'
  | 'RECALL_REVIEW'
  | 'GUIDED_SPEAKING_REVIEW'
  | 'INDEPENDENT_SPEAKING_REVIEW'
  | 'TRANSFER_REVIEW'
  | 'SPONTANEOUS_REVIEW'
  | 'MAINTENANCE_REVIEW';

export type ReviewResultKind = 'SUCCESS' | 'PARTIAL' | 'FAILED';

export interface ReviewQueueItem {
  phraseId: string;
  german?: string;
  portuguese?: string;
  reviewType: ReviewType;
  priority: number;
  reason: string;
  dueAt: string;
  automationScore: number;
  memoryStrength: number;
  independenceScore: number;
  retrievability: number;
  learned: boolean;
}

export interface ReviewOpportunity {
  itemId: string;
  german: string;
  portuguese: string;
  type: ReviewType;
  reason: string;
  context: string;
  priority: number;
  prompt: string;
  expected: string;
}

export const REVIEW_TYPE_LABELS: Record<ReviewType, string> = {
  RECOGNITION_REVIEW: 'Reconhecer',
  RECALL_REVIEW: 'Recuperar',
  GUIDED_SPEAKING_REVIEW: 'Falar com ajuda',
  INDEPENDENT_SPEAKING_REVIEW: 'Falar sozinho',
  TRANSFER_REVIEW: 'Transferir',
  SPONTANEOUS_REVIEW: 'Uso espontâneo',
  MAINTENANCE_REVIEW: 'Manutenção',
};

export const REVIEW_TYPE_COLORS: Record<ReviewType, string> = {
  RECOGNITION_REVIEW: '#5b8cff',
  RECALL_REVIEW: '#8b5cf6',
  GUIDED_SPEAKING_REVIEW: '#f5a623',
  INDEPENDENT_SPEAKING_REVIEW: '#34d399',
  TRANSFER_REVIEW: '#ff7a45',
  SPONTANEOUS_REVIEW: '#06b6d4',
  MAINTENANCE_REVIEW: '#94a3b8',
};

export function isLearned(c: PhraseConfidence): boolean {
  return (
    stateIndex(c.state) >= stateIndex('answeredWithHelp') ||
    c.timesCorrect >= 2 ||
    c.confidence >= 45
  );
}

export function isAutomatedEnough(c: PhraseConfidence, item?: LearningItemState): boolean {
  if (c.state === 'automatic') return true;
  return isAutomated(item ? { ...c, automationScore: item.automationScore } : c);
}

export function hoursSince(iso: string | null | undefined, now = Date.now()): number {
  if (!iso) return 9999;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return 9999;
  return Math.max(0, (now - t) / 3_600_000);
}

export function wasRecentlyReviewed(c: PhraseConfidence, now = Date.now(), hours = 0.35): boolean {
  return hoursSince(c.lastReviewed, now) < hours;
}

export function lastReviewResult(c: PhraseConfidence): 'SUCCESS' | 'PARTIAL' | 'FAILED' | null {
  const hist = c.reviewHistory;
  if (!hist?.length) return null;
  return hist[hist.length - 1]?.result ?? null;
}

/** Só sucesso recente deve “esfriar” a fila — falha/parcial continuam due. */
export function wasRecentlySuccessfulReview(c: PhraseConfidence, now = Date.now(), hours = 0.35): boolean {
  return lastReviewResult(c) === 'SUCCESS' && wasRecentlyReviewed(c, now, hours);
}

export function recentlySucceeded(c: PhraseConfidence, now = Date.now()): boolean {
  if (lastReviewResult(c) === 'FAILED' || lastReviewResult(c) === 'PARTIAL') return false;
  const last = c.lastReviewed || c.lastIndependentUse || c.lastProduced;
  return hoursSince(last, now) < 12 && (c.successiveSuccess ?? 0) >= 1 && !c.needsHelp;
}

export function selectReviewType(c: PhraseConfidence, mem?: MemoryStrength): ReviewType {
  const item = toLearningItemState(c);
  const auto = item.automationScore;
  const m = mem ?? memoryStrength(c);
  const slow = c.avgResponseMs > 5500 || (c.speed > 0 && c.speed < 40);
  const learned = isLearned(c);

  if (isAutomated(c) || c.state === 'automatic') return 'MAINTENANCE_REVIEW';

  if (learned && (c.needsHelp || item.helpLevel > 0 || stateIndex(c.state) < stateIndex('answeredAlone'))) {
    return 'GUIDED_SPEAKING_REVIEW';
  }

  const neverProduced = c.timesProduced < 1 && c.timesCorrect < 1 && !c.lastProduced;
  if (neverProduced && (stateIndex(c.state) < stateIndex('recognized') || c.recognition < 40)) {
    return 'RECOGNITION_REVIEW';
  }

  if (m.retrievability < 45 || m.recencyDays >= 5) {
    return 'RECALL_REVIEW';
  }

  if (item.transferCount < 2 || c.contextTransfer < 50) {
    return 'TRANSFER_REVIEW';
  }

  if (slow && auto < 75) {
    return 'INDEPENDENT_SPEAKING_REVIEW';
  }

  if (auto >= 60 && item.spontaneousCount < 1 && stateIndex(c.state) < stateIndex('spontaneous')) {
    return 'SPONTANEOUS_REVIEW';
  }

  if (auto < 65) return 'INDEPENDENT_SPEAKING_REVIEW';
  return 'SPONTANEOUS_REVIEW';
}

function buildReason(c: PhraseConfidence, type: ReviewType, item: LearningItemState, m: MemoryStrength): string {
  if (!isAutomatedEnough(c, item) && isLearned(c)) {
    return 'Aprendida, mas ainda não automatizada';
  }
  if (item.independenceScore < 45) return 'Baixa independência';
  if (m.retrievability < 45) return 'Baixa retenção';
  if (c.needsHelp) return 'Erros / ajuda recorrente';
  if (item.transferCount < 2) return 'Transferência fraca';
  if (type === 'MAINTENANCE_REVIEW') return 'Manutenção leve — uso real, sem drill';
  return REVIEW_TYPE_LABELS[type];
}

export function reviewPriorityScore(
  c: PhraseConfidence,
  now = new Date(),
): { priority: number; mem: MemoryStrength; item: LearningItemState; due: boolean } {
  const mem = memoryStrength(c, now.getTime());
  const item = toLearningItemState(c);
  const auto = item.automationScore;
  const nextAt = c.nextReview || mem.nextReviewAt;
  const dueBySchedule = new Date(nextAt) <= now;
  const freshSuccess = recentlySucceeded(c, now.getTime());

  let priority = 0;

  if (isLearned(c) && !isAutomatedEnough(c, item)) {
    priority += 55 + (80 - auto) * 0.4;
  }

  if (item.independenceScore < 50) priority += 25 + (50 - item.independenceScore) * 0.3;

  if (mem.retrievability < 55) priority += 20 + (55 - mem.retrievability) * 0.25;

  if (c.needsHelp) priority += 22;
  if (c.timesProduced > 0 && c.timesCorrect / c.timesProduced < 0.6) priority += 15;

  if (isLearned(c) && (item.transferCount < 2 || c.contextTransfer < 45)) priority += 18;

  if (!c.lastSpontaneous && auto >= 50 && auto < 80) priority += 8;

  if (dueBySchedule) {
    const overdueDays = Math.max(0, (now.getTime() - new Date(nextAt).getTime()) / 86_400_000);
    priority += 15 + Math.min(30, overdueDays * 4);
  }

  if (mem.strength < 50) priority += 12;

  const lastResult = lastReviewResult(c);
  if (lastResult === 'FAILED') {
    priority += 40;
  } else if (lastResult === 'PARTIAL') {
    priority += 22;
  } else if (lastResult === 'SUCCESS' && wasRecentlySuccessfulReview(c, now.getTime(), 0.35)) {
    priority = Math.min(priority, 6);
  }

  if (isAutomatedEnough(c, item) && mem.retrievability >= 70 && !dueBySchedule && lastResult !== 'FAILED') {
    priority = Math.min(priority, 8);
  }

  const due =
    (dueBySchedule && !freshSuccess) ||
    (isLearned(c) && !isAutomatedEnough(c, item) && !freshSuccess) ||
    mem.retrievability < 40 ||
    (c.needsHelp && isLearned(c) && !freshSuccess) ||
    lastResult === 'FAILED' ||
    lastResult === 'PARTIAL';

  return { priority: Math.round(priority), mem, item, due };
}

export function buildReviewQueueItem(
  c: PhraseConfidence,
  phrase?: Phrase | null,
  now = new Date(),
): ReviewQueueItem | null {
  const { priority, mem, item, due } = reviewPriorityScore(c, now);
  if (!due) return null;
  // Sucesso recente some da fila; falha/parcial permanece.
  if (wasRecentlySuccessfulReview(c, now.getTime(), 0.2)) return null;

  const reviewType = selectReviewType(c, mem);
  return {
    phraseId: c.phraseId,
    german: phrase?.german,
    portuguese: phrase?.portuguese,
    reviewType,
    priority,
    reason: buildReason(c, reviewType, item, mem),
    dueAt: c.nextReview || mem.nextReviewAt,
    automationScore: item.automationScore,
    memoryStrength: mem.strength,
    independenceScore: item.independenceScore,
    retrievability: mem.retrievability,
    learned: isLearned(c),
  };
}

export function buildReviewQueue(
  map: Record<string, PhraseConfidence>,
  phrases: Phrase[] = [],
  now = new Date(),
  limit = 12,
): ReviewQueueItem[] {
  const byId = new Map(phrases.map((p) => [p.id, p]));
  const items: ReviewQueueItem[] = [];

  for (const c of Object.values(map)) {
    const phrase = byId.get(c.phraseId) || phrases.find((p) => p.german === c.phraseId) || null;
    const item = buildReviewQueueItem(c, phrase, now);
    if (item) items.push(item);
  }

  return items.sort((a, b) => b.priority - a.priority).slice(0, limit);
}

export function buildReviewPrompt(
  german: string,
  type: ReviewType,
  opts?: { profession?: string; portuguese?: string },
): { prompt: string; context: string } {
  const work = /pause|brauche|arbeit/i.test(german);
  const profession = opts?.profession || 'Arbeit';

  if (type === 'RECOGNITION_REVIEW') {
    return {
      context: 'reconhecer significado e depois usar',
      prompt: `Was bedeutet: "${german}"? Danach benutze den Satz.`,
    };
  }
  if (type === 'RECALL_REVIEW') {
    if (work) {
      return {
        context: 'trabalho — recuperar sem modelo',
        prompt: 'Du arbeitest schon lange. Was brauchst du?',
      };
    }
    return {
      context: 'situação real — recuperar',
      prompt: 'Was sagst du in dieser Situation?',
    };
  }
  if (type === 'GUIDED_SPEAKING_REVIEW') {
    return {
      context: 'produção com ajuda mínima',
      prompt: work ? 'Was brauchst du? Fang an mit: Ich brauche…' : 'Sag es. Fang an mit dem ersten Wort.',
    };
  }
  if (type === 'INDEPENDENT_SPEAKING_REVIEW') {
    return {
      context: 'produção independente',
      prompt: work ? 'Was brauchst du jetzt?' : 'Sag das, ohne Hilfe.',
    };
  }
  if (type === 'TRANSFER_REVIEW') {
    if (work) {
      return {
        context: 'mesmo sentido, contexto novo (tempo/lugar)',
        prompt: 'Und morgen bei der Arbeit — was brauchst du dann?',
      };
    }
    return {
      context: 'variar o contexto',
      prompt: 'Und morgen? Wie sagst du das?',
    };
  }
  if (type === 'SPONTANEOUS_REVIEW') {
    return {
      context: 'situação aberta — não pedir a frase',
      prompt: work
        ? `Es ist heiß, du putzt schon seit Stunden (${profession}). Was sagst du?`
        : 'Die Situation ist unangenehm. Was sagst du?',
    };
  }
  return {
    context: 'manutenção em conversa',
    prompt: work ? 'Und heute — alles gut bei der Arbeit?' : 'Wie war das heute?',
  };
}

export function buildReviewOpportunity(
  c: PhraseConfidence,
  phrase: Phrase | null,
  opts?: { profile?: UserProfile; now?: Date },
): ReviewOpportunity | null {
  const now = opts?.now ?? new Date();
  const item = buildReviewQueueItem(c, phrase, now);
  if (!item) return null;
  const german = phrase?.german || item.german || c.phraseId;
  const portuguese = phrase?.portuguese || item.portuguese || '';
  const { prompt, context } = buildReviewPrompt(german, item.reviewType, {
    profession: opts?.profile?.profession,
    portuguese,
  });
  return {
    itemId: c.phraseId,
    german,
    portuguese,
    type: item.reviewType,
    reason: item.reason,
    context,
    priority: item.priority,
    prompt,
    expected: german,
  };
}

export function pickReviewOpportunity(
  map: Record<string, PhraseConfidence>,
  phrases: Phrase[],
  opts?: {
    profile?: UserProfile;
    now?: Date;
    skipIds?: string[];
    phraseId?: string;
    forcedType?: ReviewType;
  },
): ReviewOpportunity | null {
  const now = opts?.now ?? new Date();
  const skip = new Set(opts?.skipIds ?? []);
  if (opts?.phraseId && map[opts.phraseId]) {
    const c = map[opts.phraseId];
    const p = phrases.find((x) => x.id === opts.phraseId) || null;
    const german = p?.german || c.phraseId;
    const type = opts.forcedType || selectReviewType(c);
    const built = buildReviewPrompt(german, type, {
      profession: opts.profile?.profession,
      portuguese: p?.portuguese,
    });
    const scored = reviewPriorityScore(c, now);
    return {
      itemId: opts.phraseId,
      german,
      portuguese: p?.portuguese || '',
      type,
      reason: buildReason(c, type, scored.item, scored.mem),
      context: built.context,
      priority: Math.max(scored.priority, 80),
      prompt: built.prompt,
      expected: german,
    };
  }
  const queue = buildReviewQueue(map, phrases, now, 8);
  for (const q of queue) {
    if (skip.has(q.phraseId)) continue;
    const c = map[q.phraseId];
    if (!c) continue;
    const p = phrases.find((x) => x.id === q.phraseId) || null;
    const opp = buildReviewOpportunity(c, p, { profile: opts?.profile, now });
    if (opp) return opp;
  }
  return null;
}

/** Converte item da fila (snapshot) em oportunidade de revisão — mesma fonte que a UI. */
export function opportunityFromQueueItem(
  item: ReviewQueueItem,
  map: Record<string, PhraseConfidence>,
  phrases: Phrase[],
  opts?: { profile?: UserProfile; now?: Date },
): ReviewOpportunity | null {
  const c = map[item.phraseId];
  const p = phrases.find((x) => x.id === item.phraseId) || null;
  const german = item.german || p?.german || c?.phraseId || item.phraseId;
  const portuguese = item.portuguese || p?.portuguese || '';
  const type = item.reviewType;
  const { prompt, context } = buildReviewPrompt(german, type, {
    profession: opts?.profile?.profession,
    portuguese,
  });
  return {
    itemId: item.phraseId,
    german,
    portuguese,
    type,
    reason: item.reason,
    context,
    priority: item.priority,
    prompt,
    expected: german,
  };
}

export function mapReviewTypeToAction(type: ReviewType): 'recall' | 'practice' | 'transfer' | 'spontaneous' | 'converse' {
  if (type === 'GUIDED_SPEAKING_REVIEW') return 'practice';
  if (type === 'TRANSFER_REVIEW') return 'transfer';
  if (type === 'SPONTANEOUS_REVIEW') return 'spontaneous';
  if (type === 'MAINTENANCE_REVIEW' || type === 'INDEPENDENT_SPEAKING_REVIEW') return 'converse';
  return 'recall';
}

export function buildReviewGeminiNudge(opp: ReviewOpportunity): string {
  const typeLine: Record<ReviewType, string> = {
    RECOGNITION_REVIEW: 'RECOGNITION: fale a frase em alemão e pergunte o significado. Depois peça para USAR, não só traduzir.',
    RECALL_REVIEW: 'RECALL: crie o contexto. NÃO mostre o modelo. NÃO diga "repita".',
    GUIDED_SPEAKING_REVIEW: 'GUIDED SPEAKING: pergunta real + pista mínima (primeira palavra). Sem frase completa.',
    INDEPENDENT_SPEAKING_REVIEW: 'INDEPENDENT SPEAKING: faça o aluno produzir sozinho. Sem modelo, sem tradução primeiro.',
    TRANSFER_REVIEW: 'TRANSFER: mesmo sentido em outro contexto (tempo/lugar). Um eixo só. Não é repetição.',
    SPONTANEOUS_REVIEW: 'SPONTANEOUS: situação aberta. NÃO peça a frase. Se o aluno usar, feedback curto.',
    MAINTENANCE_REVIEW: 'MAINTENANCE: conversa leve. Não transforme em drill. Não repetir a mesma frase.',
  };
  return [
    '[INSTRUÇÃO INTERNA — não leia isto em voz alta]',
    `REVISÃO (${opp.type}). Não anuncie "review" nem "teste".`,
    typeLine[opp.type],
    `Motivo: ${opp.reason}`,
    `Contexto: ${opp.context}`,
    `Alvo (não leia como modelo se o tipo for recall/spontaneous): "${opp.german}"`,
    `Fale agora, em alemão: "${opp.prompt}"`,
    'Traduções só se o aluno pedir. Produção em alemão é o objetivo.',
  ].join('\n');
}

export function evaluateReviewAttempt(
  text: string,
  opp: ReviewOpportunity,
): ReviewResultKind {
  const user = text.trim().toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
  const exp = opp.expected.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').replace(/[.…!?]/g, '');
  const pt = (opp.portuguese || '').toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
  if (!user) return 'FAILED';

  if (opp.type === 'RECOGNITION_REVIEW' && pt && user.includes(pt.slice(0, Math.min(12, pt.length)))) {
    return 'SUCCESS';
  }

  const expTokens = exp.split(/\s+/).filter((w) => w.length > 2);
  const hits = expTokens.filter((t) => user.includes(t)).length;
  const ratio = expTokens.length ? hits / expTokens.length : 0;
  if (user.includes(exp) || ratio >= 0.85) return 'SUCCESS';
  if (ratio >= 0.45) return 'PARTIAL';
  return 'FAILED';
}

export function applyReviewResult(
  c: PhraseConfidence,
  result: ReviewResultKind,
  opts: {
    reviewType: ReviewType;
    helpLevel?: number;
    responseMs?: number;
    sessionId?: string;
  },
): PhraseConfidence {
  const now = new Date().toISOString();
  const help = opts.helpLevel ?? 0;
  let next = { ...c };
  const history: ReviewHistoryEntry[] = [...(c.reviewHistory ?? [])];
  history.push({ reviewType: opts.reviewType, result, timestamp: now, helpLevel: help });
  if (history.length > 30) history.splice(0, history.length - 30);

  next.lastReviewed = now;
  next.reviewCount = (c.reviewCount ?? 0) + 1;
  next.reviewHistory = history;

  if (result === 'SUCCESS') {
    next.successiveSuccess = (c.successiveSuccess ?? 0) + 1;
    if (opts.reviewType === 'RECALL_REVIEW' || opts.reviewType === 'RECOGNITION_REVIEW') {
      next.lastRecalled = now;
      next = updateConfidence(next, { type: 'recognized', correct: true });
    }
    if (
      opts.reviewType === 'INDEPENDENT_SPEAKING_REVIEW' ||
      opts.reviewType === 'GUIDED_SPEAKING_REVIEW' ||
      opts.reviewType === 'RECALL_REVIEW'
    ) {
      next = updateConfidence(next, {
        type: 'produced',
        correct: true,
        withHelp: help > 0 || opts.reviewType === 'GUIDED_SPEAKING_REVIEW',
        responseMs: opts.responseMs,
      });
      if (help === 0 && opts.reviewType !== 'GUIDED_SPEAKING_REVIEW') {
        next.lastIndependentUse = now;
      }
    }
    if (opts.reviewType === 'TRANSFER_REVIEW') {
      next = updateConfidence(next, { type: 'transfer', correct: true });
      next.lastTransfer = now;
    }
    if (opts.reviewType === 'SPONTANEOUS_REVIEW' || opts.reviewType === 'MAINTENANCE_REVIEW') {
      next = updateConfidence(next, { type: 'spontaneous', correct: true });
      next.lastSpontaneous = now;
    }
  } else if (result === 'PARTIAL') {
    next.successiveSuccess = Math.max(0, (c.successiveSuccess ?? 0));
    next = updateConfidence(next, {
      type: 'produced',
      correct: true,
      withHelp: true,
      responseMs: opts.responseMs,
    });
  } else {
    next.successiveSuccess = 0;
    next = updateConfidence(next, { type: 'produced', correct: false, responseMs: opts.responseMs });
  }

  const prevAuto = typeof c.automationScore === 'number' ? c.automationScore : undefined;
  next = persistAutomationScore(next, help, { sessionId: opts.sessionId, evidence: `review:${result}` });
  if (result === 'FAILED' && prevAuto != null && (next.automationScore ?? 0) < prevAuto - 12) {
    next = { ...next, automationScore: Math.max(0, prevAuto - 12) };
  }

  if (result === 'FAILED') {
    next.nextReview = new Date(Date.now() + 1 * 86_400_000).toISOString();
  } else if (result === 'PARTIAL') {
    next.nextReview = new Date(Date.now() + 2 * 86_400_000).toISOString();
  } else {
    next.nextReview = memoryStrength(next).nextReviewAt;
  }

  return next;
}

export async function dueForReview(now = new Date()): Promise<string[]> {
  const map = await loadConfidenceMap();
  return buildReviewQueue(map, [], now).map((i) => i.phraseId);
}

export async function getReviewQueue(limit = 8, now = new Date()): Promise<ReviewQueueItem[]> {
  const map = await loadConfidenceMap();
  const { StorageService } = await import('@/services/storage/StorageService');
  const phrases = await StorageService.getAllPhrases().catch(() => [] as Phrase[]);
  return buildReviewQueue(map, phrases, now, limit);
}

export function toLegacyReview(item: ReviewQueueItem): Review {
  const stage: ReviewStage =
    item.automationScore >= 80
      ? 'almost'
      : item.learned
        ? 'learning'
        : 'hard';
  return {
    id: `rev-${item.phraseId}`,
    itemId: item.phraseId,
    itemType: 'phrase',
    stage,
    nextReview: item.dueAt.split('T')[0],
    lastReviewed: null,
    intervalDays: 1,
    easeFactor: 2.5,
    consecutiveCorrect: 0,
  };
}

async function loadConfidenceMap(): Promise<Record<string, PhraseConfidence>> {
  const { MemoryService } = await import('@/services/learning/MemoryService');
  return MemoryService.loadConfidenceMap();
}

export { effectiveNextReview };
