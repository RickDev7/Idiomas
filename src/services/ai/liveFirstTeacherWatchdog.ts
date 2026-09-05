/**
 * Watchdog do 1º turno do professor + mapeamento de erros Live.
 * Separado de AudioStreamPlayer / ownership / pedagogia.
 */

export const FIRST_TEACHER_TURN_TIMEOUT_MS = 12_000;

export type LiveErrorCode =
  | 'LIVE_QUOTA_EXCEEDED'
  | 'live_first_turn_timeout'
  | 'live_no_response'
  | 'live_closed'
  | 'live_error'
  | 'session_failed'
  | 'session_limit'
  | 'kickoff_failed'
  | 'token_expired'
  | 'invalid_or_expired_token'
  | string;

const FATAL_CODES = new Set([
  'LIVE_QUOTA_EXCEEDED',
  'live_first_turn_timeout',
  'live_no_response',
  'live_closed',
  'session_failed',
  'session_limit',
  'kickoff_failed',
  'token_expired',
  'invalid_or_expired_token',
]);

export function normalizeLiveErrorCode(raw: string | null | undefined): LiveErrorCode {
  const m = String(raw || '').trim();
  if (!m) return 'live_error';
  if (/LIVE_QUOTA_EXCEEDED|exceeded your current quota|RESOURCE_EXHAUSTED/i.test(m)) {
    return 'LIVE_QUOTA_EXCEEDED';
  }
  if (/live_first_turn_timeout|live_no_response/i.test(m)) return 'live_first_turn_timeout';
  if (/session_limit|goAway/i.test(m)) return 'session_limit';
  if (/session_failed/i.test(m)) return 'session_failed';
  if (/kickoff_failed/i.test(m)) return 'kickoff_failed';
  if (/token_expired|invalid_or_expired_token/i.test(m)) return 'token_expired';
  if (/live_closed|live_socket_closed/i.test(m)) return 'live_closed';
  return m;
}

export function isFatalLiveError(raw: string | null | undefined): boolean {
  const code = normalizeLiveErrorCode(raw);
  return FATAL_CODES.has(code) || code === 'LIVE_QUOTA_EXCEEDED';
}

export function liveErrorUserMessage(raw: string | null | undefined): string {
  const code = normalizeLiveErrorCode(raw);
  switch (code) {
    case 'LIVE_QUOTA_EXCEEDED':
      return 'A cota do Gemini Live esgotou por agora. Tente novamente em alguns instantes.';
    case 'live_first_turn_timeout':
    case 'live_no_response':
      return 'Não foi possível iniciar a voz agora. Tente novamente em alguns instantes.';
    case 'session_limit':
      return 'A sessão de voz atingiu o limite. Toque para tentar de novo.';
    case 'session_failed':
    case 'kickoff_failed':
      return 'Não foi possível iniciar a voz agora. Tente novamente em alguns instantes.';
    case 'token_expired':
    case 'invalid_or_expired_token':
      return 'A conexão expirou. Toque para tentar de novo.';
    case 'live_closed':
      return 'A conexão de voz caiu. Tente novamente em alguns instantes.';
    default:
      return 'Não foi possível iniciar a voz agora. Tente novamente em alguns instantes.';
  }
}

/** Agenda trabalho no próximo tick (mesmo padrão do kickoff no backend). */
export function scheduleOnNextTick(task: () => void): void {
  queueMicrotask(task);
}

/**
 * Garante execução única: se scheduleTwice, só o primeiro tick efetivo roda a ação
 * quando a trava `sent` está no objeto compartilhado.
 */
export function scheduleExclusiveKickoff(
  state: { kickoffSent: boolean; skipKickoff?: boolean },
  send: () => void,
): 'scheduled' | 'skipped' {
  if (state.kickoffSent || state.skipKickoff) return 'skipped';
  scheduleOnNextTick(() => {
    if (state.kickoffSent || state.skipKickoff) return;
    state.kickoffSent = true;
    send();
  });
  return 'scheduled';
}

export type FirstTeacherWatchdogMeta = {
  sessionGeneration: number;
  sessionId: string | null;
  targetId: string | null;
  currentLevel: string | null;
};

export class FirstTeacherTurnWatchdog {
  private timer: ReturnType<typeof setTimeout> | 0 = 0;
  private armed = false;
  private resolved = false;

  constructor(
    private readonly timeoutMs: number,
    private readonly onTimeout: (meta: FirstTeacherWatchdogMeta) => void,
  ) {}

  start(meta: FirstTeacherWatchdogMeta): void {
    this.clear();
    this.armed = true;
    this.resolved = false;
    this.timer = setTimeout(() => {
      this.timer = 0;
      if (!this.armed || this.resolved) return;
      this.armed = false;
      this.onTimeout(meta);
    }, this.timeoutMs);
  }

  /** Cancela quando o 1º turno do professor chega (áudio/transcript). */
  markReceived(): boolean {
    if (!this.armed && !this.resolved) return false;
    const wasArmed = this.armed && !this.resolved;
    this.resolved = true;
    this.armed = false;
    this.clearTimerOnly();
    return wasArmed;
  }

  clear(): void {
    this.armed = false;
    this.resolved = false;
    this.clearTimerOnly();
  }

  isArmed(): boolean {
    return this.armed && !this.resolved;
  }

  private clearTimerOnly(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = 0;
    }
  }
}
