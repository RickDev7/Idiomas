/* ScaffoldingEngine — Fase 3
   Ajuda progressiva (0–5) + fade-out entre sessões e dentro da sessão.
   Preferência UI (helpLevel) ≠ supportLevel da tentativa. */
export type SupportLevel = 0 | 1 | 2 | 3 | 4 | 5;

export type SupportDecision =
  | 'maintainSupport'
  | 'increaseSupport'
  | 'decreaseSupport'
  | 'removeSupport';

/** Tempo mínimo para o aluno pensar antes de considerar “travado”. */
export const RECOVERY_WINDOW_MS = 4500;

export interface ScaffoldHint {
  level: SupportLevel;
  label: string;
  context?: string;
  hint?: string;
  firstWord?: string;
  partial?: string;
  full?: string;
  displayText: string;
}

export interface HelpAttemptRecord {
  supportLevel: SupportLevel;
  correct: boolean;
  helpRequested: boolean;
  responseTimeMs?: number;
  sessionId?: string;
  timestamp: string;
}

export interface PhraseHelpHistory {
  phraseId: string;
  /** Nível sugerido para a próxima sessão (fade). */
  previousHelpLevel: SupportLevel;
  /** Último nível usado numa tentativa. */
  lastHelpLevel: SupportLevel;
  lastSupportLevel: SupportLevel;
  /** Menor nível com acerto sem ajuda (0 = domínio). */
  bestIndependentLevel: SupportLevel;
  averageSupportLevel: number;
  successfulWithoutHelp: number;
  consecutiveSuccess: number;
  consecutiveFail: number;
  helpHistory: HelpAttemptRecord[];
  updatedAt: string;
}

const STORE_KEY = 'deutsch-turbo:scaffolding:v1';
const MAX_HISTORY = 40;

const LABELS: Record<SupportLevel, string> = {
  0: 'sem ajuda',
  1: 'contexto',
  2: 'pista',
  3: 'primeira palavra',
  4: 'frase parcial',
  5: 'frase completa',
};

export function clampLevel(n: number): SupportLevel {
  return Math.max(0, Math.min(5, Math.round(n))) as SupportLevel;
}

function loadMap(): Record<string, PhraseHelpHistory> {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, PhraseHelpHistory>) : {};
  } catch {
    return {};
  }
}

function saveMap(map: Record<string, PhraseHelpHistory>): void {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(map));
  } catch { /* ignore */ }
}

function normalizeHistory(raw: PhraseHelpHistory | undefined, phraseId: string): PhraseHelpHistory | null {
  if (!raw) return null;
  const last = clampLevel(raw.lastSupportLevel ?? raw.lastHelpLevel ?? 3);
  const prev = clampLevel(raw.previousHelpLevel ?? last);
  return {
    phraseId,
    previousHelpLevel: prev,
    lastHelpLevel: last,
    lastSupportLevel: last,
    bestIndependentLevel: clampLevel(
      raw.bestIndependentLevel ?? (raw.successfulWithoutHelp > 0 ? 0 : 5),
    ),
    averageSupportLevel: typeof raw.averageSupportLevel === 'number' ? raw.averageSupportLevel : last,
    successfulWithoutHelp: raw.successfulWithoutHelp ?? 0,
    consecutiveSuccess: raw.consecutiveSuccess ?? 0,
    consecutiveFail: raw.consecutiveFail ?? 0,
    helpHistory: Array.isArray(raw.helpHistory) ? raw.helpHistory : [],
    updatedAt: raw.updatedAt || new Date().toISOString(),
  };
}

export function getPreviousHelpLevel(phraseId: string): SupportLevel {
  const h = getHelpHistory(phraseId);
  return h?.previousHelpLevel ?? 3;
}

export function getHelpHistory(phraseId: string): PhraseHelpHistory | null {
  return normalizeHistory(loadMap()[phraseId], phraseId);
}

export function getLastSupportLevel(phraseId: string): SupportLevel {
  return getHelpHistory(phraseId)?.lastSupportLevel ?? getPreviousHelpLevel(phraseId);
}

/** Situação padrão por estrutura da frase-alvo. */
function defaultSituation(targetGerman: string, portuguese?: string): string {
  const lower = targetGerman.toLowerCase();
  if (/\barbeite|\barbeit/.test(lower) && /\bheute\b/.test(lower)) {
    return 'Du bist bei der Arbeit. Was machst du heute?';
  }
  if (/\barbeite|\barbeit/.test(lower) && /\bmorgen\b/.test(lower)) {
    return 'Du denkst an morgen. Was machst du morgen?';
  }
  if (/brauche|pause/i.test(lower)) {
    return 'Du arbeitest schon lange. Was brauchst du?';
  }
  if (portuguese) return `Situação: você precisa dizer algo como “${portuguese}”.`;
  return 'Pense na situação. O que você diria?';
}

function partialStem(targetGerman: string): string {
  const words = targetGerman.replace(/\.$/, '').trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '';
  if (words.length === 1) return `${words[0].slice(0, Math.max(2, Math.ceil(words[0].length / 2)))}...`;
  const second = words[1];
  const stem = second.slice(0, Math.min(2, second.length));
  return `${words[0]} ${stem}...`;
}

/** Monta a ajuda para o nível atual — não revela tudo de uma vez. */
export function buildScaffoldHint(
  targetGerman: string,
  level: SupportLevel,
  opts?: { portuguese?: string; situation?: string },
): ScaffoldHint {
  const words = targetGerman.replace(/\.$/, '').trim().split(/\s+/).filter(Boolean);
  const first = words[0] || 'Ich';
  const context = opts?.situation || defaultSituation(targetGerman, opts?.portuguese);
  const hint = `Es beginnt mit ${first}...`;
  const firstWord = `${first}...`;
  const partial = partialStem(targetGerman);

  const base: ScaffoldHint = {
    level,
    label: LABELS[level],
    displayText: '',
  };

  if (level <= 0) {
    return { ...base, displayText: '' };
  }
  if (level === 1) {
    return { ...base, context, displayText: context };
  }
  if (level === 2) {
    return { ...base, context, hint, displayText: hint };
  }
  if (level === 3) {
    return { ...base, context, hint, firstWord, displayText: firstWord };
  }
  if (level === 4) {
    return {
      ...base,
      context,
      hint,
      firstWord,
      partial,
      displayText: partial,
    };
  }
  return {
    ...base,
    context,
    hint,
    firstWord,
    partial,
    full: targetGerman,
    displayText: targetGerman,
  };
}

export function increaseSupport(previous: SupportLevel): SupportLevel {
  return clampLevel(previous + 1);
}

export function decreaseSupport(previous: SupportLevel): SupportLevel {
  return clampLevel(previous - 1);
}

export function shouldIncreaseSupport(opts: {
  correct: boolean;
  consecutiveFail?: number;
}): boolean {
  if (opts.correct) return false;
  return true;
}

/** Reduz só com evidência (acerto; 2 independentes → fade extra). */
export function shouldReduceSupport(opts: {
  correct: boolean;
  usedHelp: boolean;
  consecutiveSuccess?: number;
  raisingDifficulty?: boolean;
}): boolean {
  if (!opts.correct || opts.raisingDifficulty) return false;
  if (!opts.usedHelp) return true;
  if ((opts.consecutiveSuccess ?? 0) >= 2) return true;
  return false;
}

export function decideSupportAction(opts: {
  previous: SupportLevel;
  correct: boolean;
  usedHelp: boolean;
  helpRequested?: boolean;
  raisingDifficulty?: boolean;
  consecutiveSuccess?: number;
}): SupportDecision {
  if (opts.helpRequested || (!opts.correct && shouldIncreaseSupport({ correct: false }))) {
    if (opts.previous >= 5) return 'maintainSupport';
    return 'increaseSupport';
  }
  if (opts.correct && shouldReduceSupport(opts)) {
    if (opts.previous <= 1 && !opts.usedHelp) return 'removeSupport';
    if (opts.previous > 0) return 'decreaseSupport';
  }
  return 'maintainSupport';
}

/**
 * Próximo nível após uma tentativa.
 * Fade-out quando acerta; sobe ajuda quando erra.
 */
export function nextSupportAfterAttempt(opts: {
  previous: SupportLevel;
  correct: boolean;
  usedHelp: boolean;
  helpRequested?: boolean;
  raisingDifficulty?: boolean;
  consecutiveSuccess?: number;
}): SupportLevel {
  const decision = decideSupportAction(opts);
  if (decision === 'increaseSupport') return increaseSupport(opts.previous);
  if (decision === 'decreaseSupport') return decreaseSupport(opts.previous);
  if (decision === 'removeSupport') return 0;
  // Acerto com ajuda alta (≥3): fade gradual mesmo em maintain parcial
  if (opts.correct && opts.usedHelp && opts.previous >= 3 && !opts.raisingDifficulty) {
    return decreaseSupport(opts.previous);
  }
  return opts.previous;
}

/** Nível inicial da sessão para um item (histórico entre sessões). */
export function startingSupportForPhrase(
  phraseId: string,
  opts?: { confidence?: number; isNew?: boolean },
): SupportLevel {
  const history = getHelpHistory(phraseId);
  if (history) {
    return history.previousHelpLevel;
  }
  if (opts?.isNew || (opts?.confidence ?? 0) < 30) return 3;
  if ((opts?.confidence ?? 50) < 50) return 2;
  if ((opts?.confidence ?? 70) < 70) return 1;
  return 0;
}

/**
 * Registra tentativa, atualiza previousHelpLevel para a próxima sessão,
 * retorna o nível a usar na próxima tentativa desta sessão.
 */
export function recordHelpAttempt(
  phraseId: string,
  helpLevelUsed: SupportLevel,
  correct: boolean,
  opts?: {
    raisingDifficulty?: boolean;
    helpRequested?: boolean;
    responseTimeMs?: number;
    sessionId?: string;
  },
): { nextInSession: SupportLevel; previousHelpLevel: SupportLevel; decision: SupportDecision; history: PhraseHelpHistory } {
  const map = loadMap();
  const prev = normalizeHistory(map[phraseId], phraseId);
  const consecutiveSuccessPreview = correct ? (prev?.consecutiveSuccess ?? 0) + 1 : 0;

  const decision = decideSupportAction({
    previous: helpLevelUsed,
    correct,
    usedHelp: helpLevelUsed > 0 || !!opts?.helpRequested,
    helpRequested: opts?.helpRequested,
    raisingDifficulty: opts?.raisingDifficulty,
    consecutiveSuccess: consecutiveSuccessPreview,
  });

  let nextInSession = nextSupportAfterAttempt({
    previous: helpLevelUsed,
    correct,
    usedHelp: helpLevelUsed > 0 || !!opts?.helpRequested,
    helpRequested: opts?.helpRequested,
    raisingDifficulty: opts?.raisingDifficulty,
    consecutiveSuccess: consecutiveSuccessPreview,
  });

  let previousHelpLevel = nextInSession;
  const consecutiveSuccess = correct ? (prev?.consecutiveSuccess ?? 0) + 1 : 0;
  const consecutiveFail = correct ? 0 : (prev?.consecutiveFail ?? 0) + 1;

  // Dois acertos independentes (sem ajuda) → fade extra para a próxima sessão
  if (
    correct &&
    helpLevelUsed === 0 &&
    !opts?.helpRequested &&
    consecutiveSuccess >= 2 &&
    !opts?.raisingDifficulty &&
    previousHelpLevel > 0
  ) {
    previousHelpLevel = decreaseSupport(previousHelpLevel);
  }

  const attempt: HelpAttemptRecord = {
    supportLevel: helpLevelUsed,
    correct,
    helpRequested: !!opts?.helpRequested,
    responseTimeMs: opts?.responseTimeMs,
    sessionId: opts?.sessionId,
    timestamp: new Date().toISOString(),
  };
  const helpHistory = [...(prev?.helpHistory ?? []), attempt].slice(-MAX_HISTORY);
  const avg =
    helpHistory.length === 0
      ? helpLevelUsed
      : helpHistory.reduce((s, a) => s + a.supportLevel, 0) / helpHistory.length;

  let successfulWithoutHelp = prev?.successfulWithoutHelp ?? 0;
  let bestIndependentLevel = prev?.bestIndependentLevel ?? 5;
  if (correct && helpLevelUsed === 0 && !opts?.helpRequested) {
    successfulWithoutHelp += 1;
    bestIndependentLevel = 0;
  }

  const history: PhraseHelpHistory = {
    phraseId,
    previousHelpLevel,
    lastHelpLevel: helpLevelUsed,
    lastSupportLevel: helpLevelUsed,
    bestIndependentLevel,
    averageSupportLevel: Math.round(avg * 10) / 10,
    successfulWithoutHelp,
    consecutiveSuccess,
    consecutiveFail,
    helpHistory,
    updatedAt: new Date().toISOString(),
  };
  map[phraseId] = history;
  saveMap(map);

  return { nextInSession, previousHelpLevel, decision, history };
}

/** Escala um passo quando o usuário pede ajuda. */
export function escalateSupport(current: SupportLevel): SupportLevel {
  return increaseSupport(current);
}

export function supportLabel(level: SupportLevel): string {
  return LABELS[level];
}

/** Preferência UI → nível inicial sugerido (quando não há histórico). ≠ supportLevel da tentativa. */
export function supportFromUiPref(pref: 'auto' | 'normal' | 'extra' | 'minimal'): SupportLevel {
  if (pref === 'extra') return 4;
  if (pref === 'minimal') return 0;
  if (pref === 'normal') return 2;
  return 2;
}

/** Persistência explícita (teste / restore). */
export function persistSupportState(history: PhraseHelpHistory): void {
  const map = loadMap();
  map[history.phraseId] = normalizeHistory(history, history.phraseId)!;
  saveMap(map);
}

export function restoreSupportState(phraseId: string): PhraseHelpHistory | null {
  return getHelpHistory(phraseId);
}

/** Stats agregados para SessionSummary. */
export function computeSessionScaffoldStats(phraseIds: string[]): {
  averageSupportLevel: number;
  lowestSupportLevel: SupportLevel;
  independentResponses: number;
} {
  let sum = 0;
  let n = 0;
  let lowest: SupportLevel = 5;
  let independent = 0;
  for (const id of phraseIds) {
    const h = getHelpHistory(id);
    if (!h) continue;
    sum += h.averageSupportLevel;
    n += 1;
    if (h.lastSupportLevel < lowest) lowest = h.lastSupportLevel;
    independent += h.successfulWithoutHelp;
    for (const a of h.helpHistory) {
      if (a.correct && a.supportLevel === 0 && !a.helpRequested) {
        /* already counted via successfulWithoutHelp */
      }
    }
  }
  return {
    averageSupportLevel: n ? Math.round((sum / n) * 10) / 10 : 0,
    lowestSupportLevel: n ? lowest : 0,
    independentResponses: independent,
  };
}

/** Texto compacto para system instruction / nudge do Gemini. */
export function scaffoldingDirective(level: SupportLevel, target?: string): string {
  const hint = target ? buildScaffoldHint(target, level) : null;
  return [
    `SCAFFOLDING ATIVO: nível ${level}/5 (${LABELS[level]}).`,
    'NÃO dê a resposta completa de imediato se o nível for < 5.',
    level === 0 ? 'Sem pista. Deixe o aluno recuperar. Aguarde; não complete a frase.' : '',
    level === 1 ? `Dê só contexto situacional. Ex.: "${hint?.displayText || 'contexto'}"` : '',
    level === 2 ? `Dê uma pista curta. Ex.: "${hint?.displayText || 'Es beginnt mit Ich...'}"` : '',
    level === 3 ? `Mostre só a primeira palavra: ${hint?.firstWord || 'Ich...'}` : '',
    level === 4 ? `Mostre frase parcial: ${hint?.partial || '...'}` : '',
    level === 5 ? 'Pode modelar a frase completa uma vez; depois peça produção sem modelo.' : '',
    'Se o aluno acertar, retire ajuda na próxima vez (fade-out).',
  ].filter(Boolean).join('\n');
}
