/**
 * Payload visual da tela Sessão Concluída.
 * Sem engine — só transporte de dados reais para a UI.
 */
export type SessionCompletePayload = {
  name?: string;
  headline?: string;
  minutes?: number | null;
  structures?: number | null;
  variations?: number | null;
  autonomyPct?: number | null;
  improved?: string[];
  nextStep?: string | null;
  streak?: number | null;
  spoken?: number | null;
};

const KEY = 'dt_session_complete_v1';

export function storeSessionComplete(payload: SessionCompletePayload): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(payload));
  } catch {
    /* ignore */
  }
}

export function readSessionComplete(): SessionCompletePayload | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SessionCompletePayload;
  } catch {
    return null;
  }
}

export function clearSessionComplete(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
