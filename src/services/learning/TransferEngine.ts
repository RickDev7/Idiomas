/* TransferEngine — transferência de frase aprendida → uso flexível.
   Reutiliza VariationEngine (um eixo por vez). Não duplicar lógica de variação. */
import type { Phrase } from '@/types';
import type { PhraseConfidence } from '@/services/learning/ConfidenceService';
import { stateIndex } from '@/services/learning/ConfidenceService';
import type { LearningItemState } from '@/services/learning/RealUseEngine';
import { toLearningItemState } from '@/services/learning/RealUseEngine';
import {
  generateVariations,
  pickNextVariation,
  variationConversationDirective,
  type Variation,
  type VariationAxis,
} from '@/services/learning/VariationEngine';

/** Compatível com callers legados; mapeia eixos PT → kind EN. */
export type TransferKind =
  | 'time'
  | 'person'
  | 'negation'
  | 'question'
  | 'context'
  | 'tense'
  | 'object'
  | 'situation';

export interface TransferVariant {
  german: string;
  portuguese: string;
  baseId: string;
  kind: TransferKind;
  expected: string;
  hint: string;
  /** Role-play / conversa */
  rolePlay?: string;
  communicativeNeed?: string;
  situationPrompt?: string;
  axis?: VariationAxis;
}

const AXIS_TO_KIND: Record<VariationAxis, TransferKind> = {
  tempo: 'time',
  pessoa: 'person',
  contexto: 'context',
  pergunta: 'question',
  objeto: 'object',
  situação: 'situation',
  negação: 'negation',
};

export function variationToTransfer(v: Variation): TransferVariant {
  return {
    german: v.german,
    portuguese: v.portuguese,
    baseId: v.baseId,
    kind: AXIS_TO_KIND[v.axis],
    expected: v.expected,
    hint: v.hint,
    rolePlay: v.rolePlay,
    communicativeNeed: v.communicativeNeed,
    situationPrompt: v.situationPrompt,
    axis: v.axis,
  };
}

export function buildTransferVariants(phrase: Phrase, _confidence?: PhraseConfidence): TransferVariant[] {
  return generateVariations(phrase, { maxPerAxis: 1 })
    .map(variationToTransfer)
    .slice(0, 7);
}

export function shouldTransfer(confidence: PhraseConfidence): boolean {
  return (
    stateIndex(confidence.state) >= stateIndex('answeredAlone') &&
    confidence.confidence >= 65 &&
    confidence.contextTransfer < 60
  );
}

/** Transferência ligada ao LearningItemState (não só PhraseConfidence). */
export function shouldTransferItem(item: LearningItemState): boolean {
  return (
    stateIndex(item.state) >= stateIndex('answeredAlone') &&
    item.independenceScore >= 40 &&
    item.transferCount < 4 &&
    item.automationScore < 85
  );
}

/**
 * Escolhe a próxima transferência para o item — um eixo por vez,
 * avançando conforme transferCount do LearningItemState.
 */
export function pickTransferForItem(
  phrase: Phrase,
  item: LearningItemState,
  opts?: { usedAxes?: VariationAxis[] },
): TransferVariant | null {
  if (!shouldTransferItem(item) && item.transferCount >= 4) {
    // Ainda permite se confiança pediu transfer via shouldTransfer path
    if (item.transferCount >= 7) return null;
  }
  const v = pickNextVariation(phrase, {
    transferCount: item.transferCount,
    usedAxes: opts?.usedAxes,
  });
  return v ? variationToTransfer(v) : null;
}

export function pickTransferFromConfidence(
  phrase: Phrase,
  confidence: PhraseConfidence,
  helpLevel = 0,
): TransferVariant | null {
  const item = toLearningItemState(confidence, helpLevel);
  if (!shouldTransfer(confidence) && !shouldTransferItem(item)) return null;
  return pickTransferForItem(phrase, item);
}

/** Prompt de conversa (role-play) — nunca lista de exercícios. */
export function buildTransferConversationPrompt(variant: TransferVariant): string {
  if (variant.rolePlay && variant.situationPrompt) {
    return variationConversationDirective({
      axis: variant.axis || 'contexto',
      baseId: variant.baseId,
      baseGerman: '',
      german: variant.german,
      portuguese: variant.portuguese,
      expected: variant.expected,
      hint: variant.hint,
      rolePlay: variant.rolePlay,
      communicativeNeed: variant.communicativeNeed || '',
      situationPrompt: variant.situationPrompt,
    });
  }
  return `Peça uma variação natural (eixo ${variant.kind}): alvo "${variant.german}".`;
}

export type { Variation, VariationAxis };
export { generateVariations, pickNextVariation, variationConversationDirective };

const TRANSFER_STORE = 'deutsch-turbo:transfer-history:v1';
export const MAX_TRANSFERS_PER_SESSION = 3;

export interface TransferAttemptRecord {
  axis: VariationAxis | string;
  sourcePhrase: string;
  variant: string;
  context: string;
  success: boolean;
  helpLevel: number;
  independent: boolean;
  sessionId?: string;
  timestamp: string;
}

export interface PhraseTransferHistory {
  phraseId: string;
  transferCount: number;
  transferSuccess: number;
  successfulTransfers: number;
  transferContextCount: number;
  contextsUsed: string[];
  usedAxes: VariationAxis[];
  lastTransfer: TransferAttemptRecord | null;
  attempts: TransferAttemptRecord[];
  updatedAt: string;
}

function loadTransferMap(): Record<string, PhraseTransferHistory> {
  try {
    const raw = localStorage.getItem(TRANSFER_STORE);
    return raw ? (JSON.parse(raw) as Record<string, PhraseTransferHistory>) : {};
  } catch {
    return {};
  }
}

function saveTransferMap(map: Record<string, PhraseTransferHistory>): void {
  try {
    localStorage.setItem(TRANSFER_STORE, JSON.stringify(map));
  } catch { /* ignore */ }
}

export function getTransferHistory(phraseId: string): PhraseTransferHistory | null {
  return loadTransferMap()[phraseId] ?? null;
}

export function persistTransferHistory(history: PhraseTransferHistory): void {
  const map = loadTransferMap();
  map[history.phraseId] = history;
  saveTransferMap(map);
}

export function restoreTransferHistory(phraseId: string): PhraseTransferHistory | null {
  return getTransferHistory(phraseId);
}

function emptyHistory(phraseId: string): PhraseTransferHistory {
  return {
    phraseId,
    transferCount: 0,
    transferSuccess: 0,
    successfulTransfers: 0,
    transferContextCount: 0,
    contextsUsed: [],
    usedAxes: [],
    lastTransfer: null,
    attempts: [],
    updatedAt: new Date().toISOString(),
  };
}

export function recordTransferAttempt(opts: {
  phraseId: string;
  sourcePhrase: string;
  variant: TransferVariant;
  success: boolean;
  helpLevel?: number;
  sessionId?: string;
}): PhraseTransferHistory {
  const map = loadTransferMap();
  const prev = map[opts.phraseId] ?? emptyHistory(opts.phraseId);
  const independent = opts.success && (opts.helpLevel ?? 0) === 0;
  const rec: TransferAttemptRecord = {
    axis: opts.variant.axis || opts.variant.kind,
    sourcePhrase: opts.sourcePhrase,
    variant: opts.variant.german,
    context: opts.variant.situationPrompt || opts.variant.kind,
    success: opts.success,
    helpLevel: opts.helpLevel ?? 0,
    independent,
    sessionId: opts.sessionId,
    timestamp: new Date().toISOString(),
  };
  const usedAxes = [...prev.usedAxes];
  if (opts.variant.axis && !usedAxes.includes(opts.variant.axis)) usedAxes.push(opts.variant.axis);
  const contextsUsed = [...prev.contextsUsed];
  const ctxKey = rec.context;
  if (opts.success && ctxKey && !contextsUsed.includes(ctxKey)) contextsUsed.push(ctxKey);

  const history: PhraseTransferHistory = {
    phraseId: opts.phraseId,
    transferCount: prev.transferCount + 1,
    transferSuccess: prev.transferSuccess + (opts.success ? 1 : 0),
    successfulTransfers: prev.successfulTransfers + (opts.success ? 1 : 0),
    transferContextCount: contextsUsed.length,
    contextsUsed,
    usedAxes,
    lastTransfer: rec,
    attempts: [...prev.attempts, rec].slice(-40),
    updatedAt: rec.timestamp,
  };
  map[opts.phraseId] = history;
  saveTransferMap(map);
  return history;
}

export type TransferDecision = 'TRANSFER' | 'CONTINUE' | 'CONVERSE';

/**
 * TeacherEngine: quando oferecer transferência (não após erro, não no primeiro teach).
 */
export function decideTransfer(input: {
  producedNow: boolean;
  recentError: boolean;
  hasProducedBefore: boolean;
  sessionTransfers: number;
  turnsSinceLastTransfer: number;
  pendingTransfer: boolean;
  hasVariant: boolean;
}): TransferDecision {
  if (input.pendingTransfer) return 'CONTINUE';
  if (input.recentError) return 'CONTINUE';
  if (!input.hasVariant) return 'CONTINUE';
  if (input.sessionTransfers >= MAX_TRANSFERS_PER_SESSION) return 'CONVERSE';
  if (input.sessionTransfers > 0 && input.turnsSinceLastTransfer < 2) return 'CONVERSE';
  if (!input.producedNow && !input.hasProducedBefore) return 'CONTINUE';
  if (input.producedNow && input.hasVariant) return 'TRANSFER';
  return 'CONTINUE';
}

function norm(s: string): string {
  return s.toLowerCase().replace(/[^\wäöüß\s]/gi, '').replace(/\s+/g, ' ').trim();
}

/** Relação real com o target — não basta uma palavra igual; repetir a fonte não é transfer. */
export function isSuccessfulTransfer(utterance: string, sourceGerman: string, variant: TransferVariant): boolean {
  const u = norm(utterance);
  const source = norm(sourceGerman);
  const target = norm(variant.german);
  if (!u) return false;
  if (u === source) return false;
  if (u === target) return true;
  const tw = target.split(' ').filter((w) => w.length > 2);
  if (tw.length === 0) return false;
  const hits = tw.filter((w) => u.includes(w)).length;
  if (hits / tw.length >= 0.7) return true;
  // Contexto: mesma estrutura, prompt diferente (ex. Pause no trabalho vs casa)
  if (variant.kind === 'context' || variant.kind === 'situation' || variant.axis === 'contexto' || variant.axis === 'situação') {
    const sw = source.split(' ').filter((w) => w.length > 3);
    const structHits = sw.filter((w) => u.includes(w)).length;
    return structHits / Math.max(1, sw.length) >= 0.7;
  }
  return false;
}

export function isExactRepetition(utterance: string, sourceGerman: string): boolean {
  return norm(utterance) === norm(sourceGerman);
}

export function pickTransferForLive(
  phrase: Phrase,
  opts?: {
    userLevel?: string;
    selfReportedLevel?: string;
    profession?: string;
    preferAxis?: VariationAxis;
  },
): TransferVariant | null {
  const hist = getTransferHistory(phrase.id);
  const v = pickNextVariation(phrase, {
    transferCount: hist?.successfulTransfers ?? hist?.transferCount ?? 0,
    usedAxes: hist?.usedAxes,
    preferAxis: opts?.preferAxis,
    userLevel: opts?.userLevel,
    selfReportedLevel: opts?.selfReportedLevel,
    profession: opts?.profession,
  });
  return v ? variationToTransfer(v) : null;
}

export function buildTransferGeminiNudge(variant: TransferVariant, sourceGerman: string): string {
  return [
    '[INSTRUÇÃO INTERNA — não leia isto em voz alta]',
    'AÇÃO: TRANSFER. Uma variação, um eixo. Dentro da conversa — não é aula nova.',
    `Frase já produzida: "${sourceGerman}".`,
    variationConversationDirective({
      axis: variant.axis || 'tempo',
      baseId: variant.baseId,
      baseGerman: sourceGerman,
      german: variant.german,
      portuguese: variant.portuguese,
      expected: variant.expected,
      hint: variant.hint,
      rolePlay: variant.rolePlay || '',
      communicativeNeed: variant.communicativeNeed || '',
      situationPrompt: variant.situationPrompt || `Und?`,
    }),
    `supportLevel vem do app. NÃO dê a resposta ("${variant.german}") agora.`,
  ].join('\n');
}

export function transferEventContext(opts: {
  targetItemId: string;
  sourcePhrase: string;
  variant: TransferVariant;
  sessionId: string;
  success: boolean;
  helpLevel: number;
}): string {
  return JSON.stringify({
    targetItemId: opts.targetItemId,
    sourcePhrase: opts.sourcePhrase,
    variant: opts.variant.german,
    axis: opts.variant.axis || opts.variant.kind,
    context: opts.variant.situationPrompt || opts.variant.kind,
    sessionId: opts.sessionId,
    success: opts.success,
    helpLevel: opts.helpLevel,
    independent: opts.success && opts.helpLevel === 0,
  });
}
