/* SpontaneousUseDetector — Fase 5
   Precisão > quantidade. Preferir UNKNOWN a falso positivo.
   TRANSFER ≠ SPONTANEOUS ≠ GUIDED ≠ REQUESTED. */

export type ProductionOrigin =
  | 'REQUESTED'
  | 'GUIDED'
  | 'TRANSFER'
  | 'SPONTANEOUS'
  | 'UNKNOWN';

export type SpontaneousClassification =
  | 'SPONTANEOUS'
  | 'POSSIBLE_SPONTANEOUS'
  | 'UNKNOWN'
  | 'GUIDED'
  | 'REQUESTED'
  | 'TRANSFER'
  | 'NONE';

/** Compatível com callers antigos. */
export type SpontaneousVerdict =
  | 'spontaneous'
  | 'expected'
  | 'guided'
  | 'partial'
  | 'none'
  | 'transfer'
  | 'possible'
  | 'unknown';

export interface SpontaneousTarget {
  id: string;
  german: string;
  expected?: string;
}

export interface SpontaneousOpportunity {
  targetItemId: string;
  context: string;
  /** Nunca obrigatório — aluno pode responder de outra forma. */
  required: false;
  promptHint: string;
  createdAt: string;
}

export interface SpontaneousDetectionInput {
  teacherPrompt: string;
  userResponse: string;
  targetItems: SpontaneousTarget[];
  knownPhrases: SpontaneousTarget[];
  recentAttempts?: Array<{ phraseId?: string; text?: string; teacherSaid?: string }>;
  recentHints?: string[];
  recentRequests?: string[];
  pedagogicalKind?: string;
  conversationMode?: string;
  orchestratorAction?: string;
  /** Transfer pendente nesta sessão Live. */
  pendingTransfer?: boolean;
  /** Oportunidade espontânea ativa (required=false). */
  opportunity?: SpontaneousOpportunity | null;
  sessionId?: string;
  debugLog?: boolean;
}

export interface SpontaneousDetectionResult {
  verdict: SpontaneousVerdict;
  classification: SpontaneousClassification;
  productionOrigin: ProductionOrigin;
  phraseId: string | null;
  german: string | null;
  confidence: number;
  reason: string;
  isSpontaneous: boolean;
  /** Confiança ≥ 0.85 e origem SPONTANEOUS. */
  confirmed: boolean;
  debug?: SpontaneousDebug;
}

export interface SpontaneousDebug {
  teacherRequested: boolean;
  recentlyPrompted: boolean;
  semanticMatch: number;
  contextMatch: number;
  transferElicited: boolean;
  confidence: number;
  classification: SpontaneousClassification;
}

const EXPLICIT_ASK =
  /\b(?:sag(?:e)?|wiederhole|diga|diz|say|repeat|versuch(?:e)?|versuche es|sprich(?:\s+es)?\s+nach|fale|bitte\s+sag)\b/i;

const QUOTED = /["«»„“]([^"«»„“]{3,80})["«»„“]/g;
const AFTER_COLON = /(?:sag(?:e)?|wiederhole|diga|say|repeat|bitte\s+sag)\s*[:：]\s*([^.!?\n]{3,80})/gi;

/** Perguntas que elicitam a estrutura-alvo (transfer), não espontâneo. */
const TRANSFER_ELICIT =
  /\b(?:was\s+brauchst\s+du|was\s+machst\s+du(?:\s+\w+)?|und\s+morgen|und\s+heute|wo\s+arbeitest|arbeitest\s+du)\b/i;

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function contentTokens(s: string): string[] {
  const stop = new Set(['der', 'die', 'das', 'ein', 'eine', 'und', 'oder', 'mit', 'auf', 'fur', 'für', 'kurz', 'auch', 'noch']);
  return normalize(s)
    .split(' ')
    .filter((w) => w.length > 0 && (!stop.has(w) || w === 'ich' || w === 'du'));
}

/** Similaridade estrutural (ordem + cobertura), 0–1. Não é critério único. */
export function structureSimilarity(user: string, phrase: string): number {
  const u = normalize(user);
  const p = normalize(phrase).replace(/\s+$/g, '');
  if (!u || !p) return 0;
  if (u === p) return 1;
  // Variação leve: mesmas palavras-chave em ordem diferente (Heute arbeite ich)
  const pt = contentTokens(phrase);
  const ut = contentTokens(user);
  if (pt.length === 0) return 0;

  if (u.includes(p) || (p.includes(u) && u.length >= Math.max(6, p.length * 0.7))) {
    // Frase parcial "Ich brauche" dentro de target completo → não 0.95
    if (ut.length < Math.max(3, Math.ceil(pt.length * 0.7))) {
      return ut.length / pt.length;
    }
    return 0.92;
  }

  let pi = 0;
  let ordered = 0;
  for (const w of ut) {
    if (pi < pt.length && w === pt[pi]) {
      ordered++;
      pi++;
    }
  }
  const orderedScore = ordered / pt.length;
  const setU = new Set(ut);
  const bagHits = pt.filter((w) => setU.has(w)).length;
  const bagScore = bagHits / pt.length;
  // Reordenação (Heute arbeite ich): bag alto + ordered baixo ainda conta
  const reorderBonus = bagScore >= 0.85 && orderedScore < 0.7 ? 0.12 : 0;
  return Math.min(1, Math.max(orderedScore * 0.65 + bagScore * 0.35, bagScore * 0.88) + reorderBonus);
}

export function extractExplicitModels(teacherPrompt: string): string[] {
  const models: string[] = [];
  const t = teacherPrompt || '';
  for (const m of t.matchAll(QUOTED)) {
    if (m[1]) models.push(normalize(m[1]));
  }
  for (const m of t.matchAll(AFTER_COLON)) {
    if (m[1]) models.push(normalize(m[1]));
  }
  const sagLine = t.match(
    /\b(?:sag(?:e)?|diga|wiederhole|bitte\s+sag|say)\s*[:：]?\s*(ich\b[^.!?\n]{2,60})/i,
  );
  if (sagLine?.[1]) models.push(normalize(sagLine[1]));
  return [...new Set(models.filter((m) => m.split(' ').length >= 2))];
}

export function teacherExplicitlyRequests(teacherPrompt: string, phraseGerman: string): boolean {
  const t = normalize(teacherPrompt);
  const p = normalize(phraseGerman);
  if (!t || !p) return false;
  const models = extractExplicitModels(teacherPrompt);
  if (models.some((m) => structureSimilarity(m, p) >= 0.85 || structureSimilarity(p, m) >= 0.85)) {
    return true;
  }
  if (EXPLICIT_ASK.test(teacherPrompt) && (t.includes(p) || structureSimilarity(t, p) >= 0.75)) {
    return true;
  }
  // "Repeat." / "Wiederhole." sem modelo — ainda é pedido de repetição se frase no contexto recente
  if (/^(repeat|wiederhole|noch\s+einmal\.?)$/i.test(teacherPrompt.trim())) return true;
  return false;
}

/** Elicitação de transfer: pergunta que pede a estrutura (Was brauchst du?). */
export function isTransferElicitation(teacherPrompt: string, phraseGerman: string): boolean {
  const t = teacherPrompt || '';
  const p = normalize(phraseGerman);
  if (!TRANSFER_ELICIT.test(t)) return false;
  // Was brauchst du? + Pause / Hilfe
  if (/\bwas\s+brauchst\s+du\b/i.test(t) && /\bbrauch/.test(p)) return true;
  if (/\bwas\s+machst\s+du\b/i.test(t) && /\barbeit/.test(p)) return true;
  if (/\bund\s+(morgen|heute|montag)\b/i.test(t) && /\barbeit/.test(p)) return true;
  if (/\bwo\s+arbeitest\b/i.test(t) && /\barbeit/.test(p)) return true;
  return false;
}

/** Situação aberta onde o target é útil mas NÃO solicitado. */
export function isOpenSituation(teacherPrompt: string): boolean {
  const t = teacherPrompt || '';
  if (EXPLICIT_ASK.test(t) && extractExplicitModels(t).length > 0) return false;
  if (TRANSFER_ELICIT.test(t) && /\bwas\s+brauchst\s+du\b|\bund\s+morgen\b|\bwas\s+machst\s+du\b/i.test(t)) {
    // Essas são elicitação dirigida — não oportunidade puramente aberta
    return false;
  }
  return (
    /\?/.test(t) ||
    /\bwie\s+(geht|fühl)/i.test(t) ||
    /\bdu\s+(bist|arbeitest|siehst)\b/i.test(t) ||
    /\blange\b/i.test(t) ||
    /\bmüde\b/i.test(t)
  );
}

/** Relevância contextual: target faz sentido na cena do professor. */
export function contextRelevance(teacherPrompt: string, phraseGerman: string): number {
  const t = normalize(teacherPrompt);
  const p = normalize(phraseGerman);
  if (!t || !p) return 0.3;

  let score = 0.35;
  // Trabalho / fadiga → Pause
  if (/\bpause|brauch/.test(p)) {
    if (/\barbeit|lange|müde|müde|erschöpft|fenster|putz|meeting|fahrt|training|sport/.test(t)) {
      score += 0.45;
    }
    if (/\bfühl|geht es|wie geht/.test(t)) score += 0.25;
  }
  // Arbeit → rotina / hoje
  if (/\barbeit/.test(p)) {
    if (/\bheute|morgen|arbeit|büro|job|tag/.test(t)) score += 0.4;
  }
  // Ajuda
  if (/\bhilfe/.test(p)) {
    if (/\bproblem|hilfe|schwer|versteh|schwierig/.test(t)) score += 0.45;
  }
  // Professor mencionou a palavra-chave do target → baixar (risco de falso positivo)
  const keyNouns = p.split(' ').filter((w) => w.length > 4 && !['brauche', 'arbeite'].includes(w));
  for (const n of keyNouns) {
    if (t.includes(n) && !isOpenSituation(teacherPrompt)) score -= 0.25;
  }
  return Math.max(0, Math.min(1, score));
}

function wasImmediateEcho(
  user: string,
  phraseId: string,
  recent?: SpontaneousDetectionInput['recentAttempts'],
): boolean {
  if (!recent?.length) return false;
  const u = normalize(user);
  for (const a of recent.slice(-4)) {
    if (a.phraseId === phraseId && a.teacherSaid && structureSimilarity(normalize(a.teacherSaid), u) >= 0.85) {
      return true;
    }
    if (a.teacherSaid && structureSimilarity(normalize(a.teacherSaid), u) >= 0.88) return true;
  }
  return false;
}

function recentlyPromptedAsModel(
  phraseGerman: string,
  recent?: SpontaneousDetectionInput['recentAttempts'],
  recentRequests?: string[],
): boolean {
  const p = normalize(phraseGerman);
  for (const r of recentRequests || []) {
    if (structureSimilarity(r, p) >= 0.85) return true;
  }
  for (const a of recent?.slice(-5) || []) {
    if (a.teacherSaid && teacherExplicitlyRequests(a.teacherSaid, phraseGerman)) return true;
    if (a.teacherSaid && structureSimilarity(normalize(a.teacherSaid), p) >= 0.9) return true;
  }
  return false;
}

function bestPhraseMatch(
  user: string,
  phrases: SpontaneousTarget[],
): { phrase: SpontaneousTarget; score: number } | null {
  let best: { phrase: SpontaneousTarget; score: number } | null = null;
  for (const p of phrases) {
    const score = Math.max(
      structureSimilarity(user, p.german),
      p.expected ? structureSimilarity(user, p.expected) : 0,
    );
    if (!best || score > best.score) best = { phrase: p, score };
  }
  // Exige cobertura mínima — "Ich brauche" sozinho não passa
  if (!best || best.score < 0.55) return null;
  const ut = contentTokens(user);
  const pt = contentTokens(best.phrase.german);
  if (ut.length < Math.max(3, Math.ceil(pt.length * 0.65))) {
    return { phrase: best.phrase, score: Math.min(best.score, ut.length / Math.max(pt.length, 1)) };
  }
  return best;
}

function verdictFromClassification(c: SpontaneousClassification): SpontaneousVerdict {
  if (c === 'SPONTANEOUS') return 'spontaneous';
  if (c === 'POSSIBLE_SPONTANEOUS') return 'possible';
  if (c === 'GUIDED') return 'guided';
  if (c === 'REQUESTED') return 'expected';
  if (c === 'TRANSFER') return 'transfer';
  if (c === 'UNKNOWN') return 'unknown';
  return 'none';
}

function originFromClassification(c: SpontaneousClassification): ProductionOrigin {
  if (c === 'SPONTANEOUS' || c === 'POSSIBLE_SPONTANEOUS') return 'SPONTANEOUS';
  if (c === 'GUIDED') return 'GUIDED';
  if (c === 'REQUESTED') return 'REQUESTED';
  if (c === 'TRANSFER') return 'TRANSFER';
  return 'UNKNOWN';
}

/**
 * Classifica a produção do usuário.
 * Confirmado só com confidence ≥ 0.85 e origem espontânea clara.
 */
export function analyzeSpontaneousUse(input: SpontaneousDetectionInput): SpontaneousDetectionResult {
  const user = (input.userResponse || '').trim();
  const empty = (extra: Partial<SpontaneousDetectionResult>): SpontaneousDetectionResult => ({
    verdict: 'none',
    classification: 'NONE',
    productionOrigin: 'UNKNOWN',
    phraseId: null,
    german: null,
    confidence: 0,
    reason: 'resposta vazia',
    isSpontaneous: false,
    confirmed: false,
    ...extra,
  });

  if (!user) return empty({});

  // Durante transfer pendente: nunca spontaneous
  if (input.pendingTransfer || input.orchestratorAction === 'transfer') {
    const pool = [...input.knownPhrases, ...input.targetItems];
    const match = bestPhraseMatch(user, pool);
    const conf = match?.score ?? 0;
    const result: SpontaneousDetectionResult = {
      verdict: 'transfer',
      classification: 'TRANSFER',
      productionOrigin: 'TRANSFER',
      phraseId: match?.phrase.id ?? null,
      german: match?.phrase.german ?? null,
      confidence: conf,
      reason: 'produção sob transferência ativa — não espontâneo',
      isSpontaneous: false,
      confirmed: false,
    };
    logCheck(input, result, false, false, conf, 0, true);
    return result;
  }

  const pool = [
    ...input.knownPhrases,
    ...input.targetItems.filter((t) => !input.knownPhrases.some((k) => k.id === t.id)),
  ];
  const match = bestPhraseMatch(user, pool);
  if (!match) {
    return empty({ reason: 'nenhuma estrutura conhecida', classification: 'NONE' });
  }

  const { phrase, score: semanticMatch } = match;
  const teacher = input.teacherPrompt || '';
  const teacherRequested = teacherExplicitlyRequests(teacher, phrase.german);
  const recentlyPrompted = recentlyPromptedAsModel(phrase.german, input.recentAttempts, input.recentRequests);
  const transferElicited = isTransferElicitation(teacher, phrase.german);
  const ctxMatch = contextRelevance(teacher, phrase.german);
  const openSit = isOpenSituation(teacher);
  const opportunityHit =
    !!input.opportunity &&
    (input.opportunity.targetItemId === phrase.id || !input.opportunity.required);

  // Frase parcial
  if (semanticMatch < 0.72) {
    const result: SpontaneousDetectionResult = {
      verdict: 'partial',
      classification: 'UNKNOWN',
      productionOrigin: 'UNKNOWN',
      phraseId: phrase.id,
      german: phrase.german,
      confidence: semanticMatch,
      reason: 'estrutura incompleta / parcial',
      isSpontaneous: false,
      confirmed: false,
    };
    logCheck(input, result, teacherRequested, recentlyPrompted, semanticMatch, ctxMatch, transferElicited);
    return result;
  }

  if (teacherRequested) {
    const result: SpontaneousDetectionResult = {
      verdict: 'guided',
      classification: 'GUIDED',
      productionOrigin: 'GUIDED',
      phraseId: phrase.id,
      german: phrase.german,
      confidence: semanticMatch,
      reason: 'professor solicitou a frase explicitamente',
      isSpontaneous: false,
      confirmed: false,
    };
    logCheck(input, result, true, recentlyPrompted, semanticMatch, ctxMatch, transferElicited);
    return result;
  }

  if (wasImmediateEcho(user, phrase.id, input.recentAttempts) || recentlyPrompted) {
    const result: SpontaneousDetectionResult = {
      verdict: 'guided',
      classification: 'GUIDED',
      productionOrigin: 'GUIDED',
      phraseId: phrase.id,
      german: phrase.german,
      confidence: semanticMatch,
      reason: 'eco imediato / modelo recente — não espontâneo',
      isSpontaneous: false,
      confirmed: false,
    };
    logCheck(input, result, teacherRequested, true, semanticMatch, ctxMatch, transferElicited);
    return result;
  }

  if (transferElicited) {
    const result: SpontaneousDetectionResult = {
      verdict: 'transfer',
      classification: 'TRANSFER',
      productionOrigin: 'TRANSFER',
      phraseId: phrase.id,
      german: phrase.german,
      confidence: semanticMatch,
      reason: 'elicitação de transfer (ex.: Was brauchst du?) — não espontâneo',
      isSpontaneous: false,
      confirmed: false,
    };
    logCheck(input, result, false, recentlyPrompted, semanticMatch, ctxMatch, true);
    return result;
  }

  const elicitingActions = new Set(['introduce', 'practice', 'recall', 'review', 'automation']);
  const isTarget = input.targetItems.some(
    (t) => t.id === phrase.id || structureSimilarity(t.german, phrase.german) >= 0.9,
  );
  if (
    isTarget &&
    elicitingActions.has(input.orchestratorAction || '') &&
    !openSit &&
    !opportunityHit
  ) {
    const result: SpontaneousDetectionResult = {
      verdict: 'expected',
      classification: 'REQUESTED',
      productionOrigin: 'REQUESTED',
      phraseId: phrase.id,
      german: phrase.german,
      confidence: semanticMatch,
      reason: 'produção esperada do alvo do turno',
      isSpontaneous: false,
      confirmed: false,
    };
    logCheck(input, result, false, recentlyPrompted, semanticMatch, ctxMatch, false);
    return result;
  }

  // Confiança combinada: semântica + contexto (precisão)
  let confidence = semanticMatch * 0.55 + ctxMatch * 0.45;
  if (opportunityHit && openSit) confidence = Math.min(1, confidence + 0.12);
  if (openSit && ctxMatch >= 0.55) confidence = Math.min(1, confidence + 0.08);
  if (input.orchestratorAction === 'spontaneous' || input.pedagogicalKind === 'spontaneous') {
    confidence = Math.min(1, confidence + 0.05);
  }
  // Professor mencionou substantivo-chave (Pause) sem pedido — cautela
  const keyHit = /\bpause\b/i.test(teacher) && /\bpause\b/i.test(phrase.german);
  if (keyHit && !openSit) confidence = Math.min(confidence, 0.58);

  let classification: SpontaneousClassification = 'UNKNOWN';
  if (confidence >= 0.85 && (openSit || opportunityHit || ctxMatch >= 0.6)) {
    classification = 'SPONTANEOUS';
  } else if (confidence >= 0.6 && confidence < 0.85 && (openSit || ctxMatch >= 0.5)) {
    classification = 'POSSIBLE_SPONTANEOUS';
  } else if (semanticMatch >= 0.85 && !openSit && ctxMatch < 0.45) {
    classification = 'UNKNOWN';
  } else {
    classification = 'UNKNOWN';
  }

  const confirmed = classification === 'SPONTANEOUS';
  const result: SpontaneousDetectionResult = {
    verdict: verdictFromClassification(classification),
    classification,
    productionOrigin: originFromClassification(classification),
    phraseId: phrase.id,
    german: phrase.german,
    confidence: Math.round(confidence * 100) / 100,
    reason: confirmed
      ? 'uso espontâneo confirmado: contexto útil, sem pedido, estrutura relevante'
      : classification === 'POSSIBLE_SPONTANEOUS'
        ? 'possível espontâneo — não confirma progresso máximo'
        : 'incerto — não classificar como spontaneous',
    isSpontaneous: confirmed,
    confirmed,
  };
  logCheck(input, result, teacherRequested, recentlyPrompted, semanticMatch, ctxMatch, transferElicited);
  return result;
}

function logCheck(
  input: SpontaneousDetectionInput,
  result: SpontaneousDetectionResult,
  teacherRequested: boolean,
  recentlyPrompted: boolean,
  semanticMatch: number,
  contextMatch: number,
  transferElicited: boolean,
): void {
  if (input.debugLog === false) return;
  if (input.debugLog !== true && typeof import.meta !== 'undefined') {
    try {
      if (!(import.meta as { env?: { DEV?: boolean } }).env?.DEV) return;
    } catch { /* node */ }
  }
  // Em Node (testes): só loga se debugLog === true
  if (input.debugLog !== true && typeof process !== 'undefined') {
    return;
  }
  const debug: SpontaneousDebug = {
    teacherRequested,
    recentlyPrompted,
    semanticMatch: Math.round(semanticMatch * 100) / 100,
    contextMatch: Math.round(contextMatch * 100) / 100,
    transferElicited,
    confidence: result.confidence,
    classification: result.classification,
  };
  result.debug = debug;
  if (typeof console !== 'undefined' && console.debug) {
    console.debug(
      '[SPONTANEOUS CHECK]',
      `teacherRequested=${debug.teacherRequested}`,
      `recentlyPrompted=${debug.recentlyPrompted}`,
      `semanticMatch=${debug.semanticMatch}`,
      `contextMatch=${debug.contextMatch}`,
      `transferElicited=${debug.transferElicited}`,
      `confidence=${debug.confidence}`,
      `classification=${debug.classification}`,
    );
  }
}

export function detectReliableSpontaneousId(input: SpontaneousDetectionInput): string | null {
  const r = analyzeSpontaneousUse(input);
  return r.confirmed && r.phraseId ? r.phraseId : null;
}

/* ─── Memória de espontaneidade + oportunidades ─── */

const STORE_KEY = 'deutsch-turbo:spontaneous:v1';
export const MAX_SPONTANEOUS_OPPORTUNITIES_PER_SESSION = 3;

export interface SpontaneousItemMemory {
  phraseId: string;
  spontaneousCount: number;
  lastSpontaneousAt: string | null;
  lastSessionId?: string;
  eventIds: string[];
  updatedAt: string;
}

function loadMap(): Record<string, SpontaneousItemMemory> {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, SpontaneousItemMemory>) : {};
  } catch {
    return {};
  }
}

function saveMap(map: Record<string, SpontaneousItemMemory>): void {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(map));
  } catch { /* ignore */ }
}

export function getSpontaneousMemory(phraseId: string): SpontaneousItemMemory | null {
  return loadMap()[phraseId] ?? null;
}

export function restoreSpontaneousMemory(phraseId: string): SpontaneousItemMemory | null {
  return getSpontaneousMemory(phraseId);
}

/** Idempotente: mesmo eventId não incrementa de novo. */
export function recordConfirmedSpontaneous(opts: {
  phraseId: string;
  eventId: string;
  sessionId?: string;
}): SpontaneousItemMemory {
  const map = loadMap();
  const prev = map[opts.phraseId] ?? {
    phraseId: opts.phraseId,
    spontaneousCount: 0,
    lastSpontaneousAt: null,
    eventIds: [],
    updatedAt: new Date().toISOString(),
  };
  if (prev.eventIds.includes(opts.eventId)) {
    return prev;
  }
  const next: SpontaneousItemMemory = {
    phraseId: opts.phraseId,
    spontaneousCount: prev.spontaneousCount + 1,
    lastSpontaneousAt: new Date().toISOString(),
    lastSessionId: opts.sessionId,
    eventIds: [...prev.eventIds, opts.eventId].slice(-40),
    updatedAt: new Date().toISOString(),
  };
  map[opts.phraseId] = next;
  saveMap(map);
  return next;
}

export function makeSpontaneousEventId(sessionId: string, phraseId: string, userText: string): string {
  const n = normalize(userText).slice(0, 48);
  return `spont:${sessionId}:${phraseId}:${n}`;
}

export function shouldCreateSpontaneousOpportunity(input: {
  hasProduced: boolean;
  transferSuccess?: number;
  spontaneousCount?: number;
  sessionOpportunities: number;
  recentError: boolean;
  turnsSinceLastOpportunity: number;
}): boolean {
  if (input.recentError) return false;
  if (input.sessionOpportunities >= MAX_SPONTANEOUS_OPPORTUNITIES_PER_SESSION) return false;
  if (!input.hasProduced) return false;
  if (input.turnsSinceLastOpportunity < 3) return false;
  // Já usou espontaneamente várias vezes — menos prioridade
  if ((input.spontaneousCount ?? 0) >= 3 && input.turnsSinceLastOpportunity < 8) return false;
  return true;
}

export function buildSpontaneousOpportunity(
  phrase: SpontaneousTarget,
  opts?: { profession?: string; level?: string },
): SpontaneousOpportunity {
  const g = phrase.german.toLowerCase();
  let promptHint = 'Wie geht es dir?';
  let context = 'geral';
  if (/pause|brauch/.test(g)) {
    context = 'trabalho / fadiga';
    const job = (opts?.profession || '').toLowerCase();
    if (/reinig|putz|fenster|limpez/.test(job)) {
      promptHint = 'Du hast schon viele Fenster gereinigt. Wie fühlst du dich?';
    } else {
      promptHint = 'Du arbeitest schon lange. Wie fühlst du dich?';
    }
  } else if (/arbeit/.test(g)) {
    context = 'rotina';
    promptHint = 'Erzähl mir kurz von deinem Tag.';
  }
  return {
    targetItemId: phrase.id,
    context,
    required: false,
    promptHint,
    createdAt: new Date().toISOString(),
  };
}

export function buildSpontaneousOpportunityNudge(opp: SpontaneousOpportunity): string {
  return [
    '[INSTRUÇÃO INTERNA — não leia isto em voz alta]',
    'AÇÃO: CREATE_SPONTANEOUS_OPPORTUNITY (required=false).',
    'Crie uma situação NATURAL. NÃO peça a frase-alvo. NÃO diga "sag" / "repeat".',
    `Contexto: ${opp.context}`,
    `Sugestão de fala: "${opp.promptHint}"`,
    'O aluno pode responder qualquer coisa válida. Se usar a estrutura aprendida, ótimo — mas não force.',
    'Não anuncie teste. Feedback curto se acertar ("Sehr gut.") — sem jargão pedagógico.',
  ].join('\n');
}
