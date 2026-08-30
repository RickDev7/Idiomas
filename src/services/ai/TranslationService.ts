/* Tradução DE→PT após o turno completo.
   Cache + dedupe + 429 controlado. Nunca traduz chunk a chunk. */

import { resolveBackendUrl, httpBackendBase } from '@/utils/backendUrl';

export type TranslationStatus = 'HIDDEN' | 'LOADING' | 'READY' | 'ERROR';

export type TranslationErrorCode =
  | 'EMPTY'
  | 'TIMEOUT'
  | 'TRANSLATION_RATE_LIMIT'
  | 'TRANSLATION_UNAVAILABLE'
  | 'NETWORK';

export interface TranslationResult {
  status: TranslationStatus;
  text: string;
  error?: string;
  errorCode?: TranslationErrorCode;
  slow?: boolean;
  retryAfterMs?: number;
}

const cache = new Map<string, string>();
const inFlight = new Map<string, Promise<TranslationResult>>();
let rateLimitedUntil = 0;
let requestSeq = 0;

const TIMEOUT_MS = 12_000;
const SLOW_MS = 4_000;
const MAX_RETRIES = 2;
const DEV = typeof import.meta !== 'undefined' && !!(import.meta as { env?: { DEV?: boolean } }).env?.DEV;

/** Frases frequentes — não gastam quota. */
export const LOCAL_DE_PT: Record<string, string> = {
  hallo: 'Olá!',
  hi: 'Oi!',
  'guten morgen': 'Bom dia!',
  'guten tag': 'Boa tarde!',
  'guten abend': 'Boa noite!',
  'gute nacht': 'Boa noite!',
  'wie geht es dir': 'Como você está?',
  'wie geht es ihnen': 'Como o senhor/a senhora está?',
  'wie heisst du': 'Como você se chama?',
  'wie heissen sie': 'Como o senhor/a senhora se chama?',
  'wo wohnst du': 'Onde você mora?',
  'woher kommst du': 'De onde você vem?',
  'was machst du': 'O que você faz?',
  'was machst du heute': 'O que você faz hoje?',
  'was hast du gestern gemacht': 'O que você fez ontem?',
  'was hast du gestern nach der arbeit gemacht': 'O que você fez ontem depois do trabalho?',
  'was brauchst du': 'O que você precisa?',
  'was brauchst du jetzt': 'O que você precisa agora?',
  'was brauchst du da': 'O que você precisa aí?',
  'ich heisse': 'Eu me chamo…',
  'ich wohne': 'Eu moro…',
  'ich arbeite': 'Eu trabalho…',
  'ich brauche eine pause': 'Preciso de uma pausa.',
  'sehr gut': 'Muito bem!',
  gut: 'Bem.',
  danke: 'Obrigado.',
  bitte: 'Por favor. / De nada.',
  ja: 'Sim.',
  nein: 'Não.',
  'ich verstehe nicht': 'Eu não entendo.',
  'noch einmal bitte': 'Mais uma vez, por favor.',
  'langsamer bitte': 'Mais devagar, por favor.',
  'erinnerst du dich': 'Você se lembra?',
  'lass uns anfangen': 'Vamos começar.',
  'lass uns weitermachen': 'Vamos continuar.',
  bereit: 'Pronto?',
  'schon dich wiederzusehen': 'Que bom te ver de novo.',
  'alles klar': 'Tudo bem?',
  'alles gut': 'Tudo bem?',
  'kein problem': 'Sem problema!',
  'ich habe gefragt': 'Eu perguntei:',
  'arbeitest du heute': 'Você trabalha hoje?',
  'arbeitest du': 'Você trabalha?',
  'ja oder nein': 'Sim ou não?',
  'sag mal': 'Diga:',
  'sag mir': 'Diga:',
  'fang an mit': 'Comece com:',
  'mir geht es gut': 'Estou bem.',
  'jetzt du': 'Agora você!',
  'wie gehts': 'Como vai?',
  'wie geht s': 'Como vai?',
  'wie geht es': 'Como vai?',
};

function backendUrl(): string {
  return httpBackendBase(resolveBackendUrl());
}

export function normalizeGerman(text: string): string {
  return text
    .toLowerCase()
    .replace(/ß/g, 'ss')
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, ' ')
    .replace(/[“”„"«»'`´]/g, ' ')
    .replace(/[.!?…,;:()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function keyFor(german: string): string {
  return normalizeGerman(german);
}

export function textHash(german: string): string {
  const n = keyFor(german);
  let h = 2166136261;
  for (let i = 0; i < n.length; i++) {
    h ^= n.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16);
}

export function isTranslationRateLimited(now = Date.now()): boolean {
  return now < rateLimitedUntil;
}

export function getTranslationRateLimitRemaining(now = Date.now()): number {
  return Math.max(0, rateLimitedUntil - now);
}

function markRateLimited(retryAfterMs: number) {
  const wait = Math.max(2_000, Math.min(60_000, retryAfterMs || 8_000));
  rateLimitedUntil = Math.max(rateLimitedUntil, Date.now() + wait);
}

const PT_WORD = /\b(você|voce|vocês|voces|não|nao|olá|ola|obrigad[oa]|hoje|trabalha|chama|estou|estás|esta|está|sou|moro|preciso|quero|isso|muito|tudo|bem|sim|então|entao|porque|quando|onde|como)\b/i;
const DE_WORD = /\b(ich|du|sie|wir|ihr|ist|sind|habe|hast|hat|bin|bist|das|der|die|den|ein|eine|nicht|und|oder|was|wie|wo|wer|warum|heute|gestern|morgen|kein|keine|ja|nein|bitte|danke|gut|sehr|auch|noch|mal|bitte)\b/i;
function tidyDisplay(text: string): string {
  return text
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+'/g, ' ')
    .replace(/'\s+/g, ' ')
    .replace(/^'+|'+$/g, '')
    .trim();
}

function splitClauses(text: string): string[] {
  return text
    .split(/(?<=[.!?…:])['"“”«»]*\s+/)
    .map((s) => s.trim())
    .filter((s) => normalizeGerman(s).length > 0);
}

export function isMostlyPortuguese(text: string): boolean {
  const pt = (text.match(new RegExp(PT_WORD.source, 'gi')) || []).length;
  const de = (text.match(new RegExp(DE_WORD.source, 'gi')) || []).length;
  if (pt === 0) return false;
  return pt > de;
}

/** Alemão e português em blocos separados. Nunca deixa PT no campo ALEMÃO. */
export function separateTeacherSpeech(raw: string): { german: string; embeddedPortuguese: string } {
  let text = (raw || '').trim();
  if (!text) return { german: '', embeddedPortuguese: '' };
  const ptParts: string[] = [];

  text = text.replace(
    /(?:Das heißt|Das bedeutet|Auf Portugiesisch)\s*[:–—-]?\s*([^]*?)(?=(?:\s+(?:Ja|Nein|Und|Aber|Also|Gut|Kein|Keine|Ich|Du|Wir|Ihr|Was|Wie|Wo|Wer|Warum)\b)|$)/gi,
    (_m, pt: string) => {
      const t = String(pt || '').trim();
      if (t) ptParts.push(t);
      return ' ';
    },
  );

  const germanClauses: string[] = [];
  for (const clause of splitClauses(text)) {
    if (isMostlyPortuguese(clause)) ptParts.push(clause);
    else germanClauses.push(clause);
  }

  return {
    german: tidyDisplay(germanClauses.join(' ')),
    embeddedPortuguese: tidyDisplay(ptParts.join(' ')),
  };
}

function exactLocal(normalized: string): string | null {
  return LOCAL_DE_PT[normalized] ?? null;
}

/** Traduz o texto inteiro. Nunca devolve só a primeira palavra se houver mais frases. */
export function lookupLocalTranslation(german: string): string | null {
  const separated = separateTeacherSpeech(german);
  const source = separated.german || german;
  const n = normalizeGerman(source);
  if (!n) return separated.embeddedPortuguese || null;
  const whole = exactLocal(n);
  if (whole) return whole;

  const clauses = splitClauses(source);
  if (clauses.length < 2) return null;

  const parts: string[] = [];
  for (const clause of clauses) {
    if (isMostlyPortuguese(clause)) {
      parts.push(clause);
      continue;
    }
    const t = exactLocal(normalizeGerman(clause));
    if (!t) return null;
    parts.push(t);
  }
  return parts.join(' ');
}

function translationCoversSource(german: string, portuguese: string): boolean {
  const src = splitClauses(german).length;
  const dst = splitClauses(portuguese).length;
  if (src >= 2 && dst < src) return false;
  return true;
}

export function cachedTranslation(german: string): string | null {
  const local = lookupLocalTranslation(german);
  const stored = cache.get(keyFor(german));
  if (local && stored && local.length > stored.length) return local;
  if (local) return local;
  if (stored && translationCoversSource(german, stored)) return stored;
  return null;
}

export function rememberTranslation(german: string, portuguese: string): void {
  const g = german.trim();
  const p = portuguese.trim();
  if (!g || !p) return;
  if (!translationCoversSource(g, p)) return;
  cache.set(keyFor(g), p);
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(Object.assign(new Error('aborted'), { name: 'AbortError' }));
      return;
    }
    const t = setTimeout(resolve, ms);
    const onAbort = () => {
      clearTimeout(t);
      reject(Object.assign(new Error('aborted'), { name: 'AbortError' }));
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

function parseRetryAfter(res: Response, body: { retryAfter?: number; retryAfterMs?: number }): number {
  if (typeof body.retryAfterMs === 'number' && body.retryAfterMs > 0) return body.retryAfterMs;
  if (typeof body.retryAfter === 'number' && body.retryAfter > 0) {
    return body.retryAfter < 1_000 ? body.retryAfter * 1000 : body.retryAfter;
  }
  const hdr = res.headers.get('retry-after');
  if (hdr) {
    const sec = Number(hdr);
    if (Number.isFinite(sec) && sec > 0) return sec * 1000;
  }
  return 8_000;
}

async function fetchTranslateOnce(
  text: string,
  opts: { signal?: AbortSignal; requestId: string; attempt: number },
): Promise<TranslationResult> {
  const hash = textHash(text);
  const started = Date.now();
  log('TRANSLATION REQUEST', {
    id: opts.requestId,
    textHash: hash,
    length: text.length,
    source: 'turn_complete',
    model: 'gemini-text',
    attempt: opts.attempt,
  });

  const remaining = getTranslationRateLimitRemaining();
  if (remaining > 0) {
    log('TRANSLATION ERROR', { id: opts.requestId, status: 429, reason: 'client_rate_limit_gate', retryAfterMs: remaining });
    return {
      status: 'ERROR',
      text: '',
      error: 'Tradução indisponível no momento.',
      errorCode: 'TRANSLATION_RATE_LIMIT',
      retryAfterMs: remaining,
    };
  }

  const res = await fetch(`${backendUrl()}/api/gemini/text`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'translate',
      payload: { text, to: 'pt-BR' },
    }),
    signal: opts.signal,
  });

  const latency = Date.now() - started;
  let body: { text?: string; error?: string; retryAfter?: number; retryAfterMs?: number } = {};
  try {
    body = (await res.json()) as typeof body;
  } catch {
    body = {};
  }

  if (res.status === 429 || body.error === 'TRANSLATION_RATE_LIMIT') {
    const retryAfterMs = parseRetryAfter(res, body);
    markRateLimited(retryAfterMs);
    log('TRANSLATION ERROR', { id: opts.requestId, status: 429, reason: 'TRANSLATION_RATE_LIMIT', latency, retryAfterMs });
    return {
      status: 'ERROR',
      text: '',
      error: 'Tradução indisponível no momento.',
      errorCode: 'TRANSLATION_RATE_LIMIT',
      retryAfterMs,
    };
  }

  if (!res.ok) {
    const code: TranslationErrorCode =
      res.status >= 500 ? 'TRANSLATION_UNAVAILABLE' : 'TRANSLATION_UNAVAILABLE';
    log('TRANSLATION ERROR', { id: opts.requestId, status: res.status, reason: body.error || 'http_error', latency });
    return {
      status: 'ERROR',
      text: '',
      error: 'Tradução indisponível no momento.',
      errorCode: code,
      retryAfterMs: body.retryAfterMs,
    };
  }

  const pt = (body.text || '').trim().replace(/^["«»]|["«»]$/g, '');
  if (!pt) {
    log('TRANSLATION ERROR', { id: opts.requestId, status: res.status, reason: 'empty_body', latency });
    return { status: 'ERROR', text: '', error: 'Tradução indisponível no momento.', errorCode: 'TRANSLATION_UNAVAILABLE' };
  }

  rememberTranslation(text, pt);
  log('TRANSLATION RESPONSE', { id: opts.requestId, status: res.status, latency, textHash: hash });
  return { status: 'READY', text: pt };
}

async function translateWithRetries(
  text: string,
  opts?: { signal?: AbortSignal },
): Promise<TranslationResult> {
  const requestId = `tr-${++requestSeq}-${textHash(text).slice(0, 6)}`;
  let last: TranslationResult = {
    status: 'ERROR',
    text: '',
    error: 'Tradução indisponível no momento.',
    errorCode: 'TRANSLATION_UNAVAILABLE',
  };

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const ctrl = new AbortController();
      const onAbort = () => ctrl.abort();
      opts?.signal?.addEventListener('abort', onAbort);
      const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
      try {
        last = await fetchTranslateOnce(text, { signal: ctrl.signal, requestId, attempt });
      } finally {
        clearTimeout(timer);
        opts?.signal?.removeEventListener('abort', onAbort);
      }

      if (last.status === 'READY') return last;

      if (last.errorCode === 'TRANSLATION_RATE_LIMIT') {
        // No máximo 1 retry após backoff; depois ERROR (UI mostra Tentar novamente).
        if (attempt >= MAX_RETRIES) return last;
        const wait = Math.max(Math.min(last.retryAfterMs || 3_000, 8_000), attempt * 2_000);
        try {
          await sleep(wait, opts?.signal);
        } catch {
          return { ...last, errorCode: 'TIMEOUT', error: 'Tradução indisponível no momento.', slow: true };
        }
        continue;
      }
      return last;
    } catch (err) {
      const aborted = (err as { name?: string })?.name === 'AbortError';
      log('TRANSLATION ERROR', {
        id: requestId,
        status: aborted ? 'timeout' : 'network',
        reason: aborted ? 'TIMEOUT' : 'NETWORK',
      });
      if (aborted && attempt < MAX_RETRIES) {
        try {
          await sleep(2_000 * attempt, opts?.signal);
        } catch {
          return {
            status: 'ERROR',
            text: '',
            error: 'Tradução indisponível no momento.',
            errorCode: 'TIMEOUT',
            slow: true,
          };
        }
        continue;
      }
      return {
        status: 'ERROR',
        text: '',
        error: 'Tradução indisponível no momento.',
        errorCode: aborted ? 'TIMEOUT' : 'NETWORK',
        slow: aborted,
      };
    }
  }
  return last;
}

export async function translateGermanToPortuguese(
  german: string,
  opts?: { signal?: AbortSignal },
): Promise<TranslationResult> {
  const separated = separateTeacherSpeech(german);
  const text = (separated.german || german).trim();
  if (!text) {
    if (separated.embeddedPortuguese) return { status: 'READY', text: separated.embeddedPortuguese };
    return { status: 'ERROR', text: '', error: 'Texto vazio.', errorCode: 'EMPTY' };
  }

  const local = lookupLocalTranslation(text);
  const stored = cache.get(keyFor(text));
  const hit = local || (stored && translationCoversSource(text, stored) ? stored : null);
  if (hit) {
    rememberTranslation(text, hit);
    return { status: 'READY', text: hit };
  }

  const hash = keyFor(text);
  const existing = inFlight.get(hash);
  if (existing) return existing;

  const promise = translateWithRetries(text, opts).finally(() => {
    inFlight.delete(hash);
  });
  inFlight.set(hash, promise);
  return promise;
}

export const SLOW_HINT_MS = SLOW_MS;

/** Testes / reset de estado de rate-limit. */
export function __resetTranslationStateForTests() {
  cache.clear();
  inFlight.clear();
  rateLimitedUntil = 0;
}

function log(label: string, value: unknown) {
  if (!DEV) return;
  try {
    console.log(`[${label}]`, value);
  } catch {
    /* ignore */
  }
}
