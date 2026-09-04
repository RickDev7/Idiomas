/**
 * Trace temporário do fluxo Home → kickoff → primeira fala.
 * Ativo em DEV ou localStorage.TARGET_FLOW=1 / TARGET_TRACE=1.
 * Remover ou manter atrás de flag após a correção.
 */
let flowSeq = 0;

export function newTargetFlowSessionId(): string {
  flowSeq += 1;
  const t = Date.now().toString(36);
  return `tf-${t}-${flowSeq}`;
}

export function targetFlowEnabled(): boolean {
  try {
    if (typeof import.meta !== 'undefined' && (import.meta as { env?: { DEV?: boolean } }).env?.DEV) {
      return true;
    }
  } catch {
    /* ignore */
  }
  try {
    if (typeof localStorage === 'undefined') return false;
    return localStorage.getItem('TARGET_FLOW') === '1' || localStorage.getItem('TARGET_TRACE') === '1';
  } catch {
    return false;
  }
}

export type TargetFlowPayload = {
  sessionId?: string | null;
  route?: string | null;
  startPhraseId?: string | null;
  selectedTarget?: string | null;
  selectedTargetId?: string | null;
  openingGerman?: string | null;
  planTarget?: string | null;
  planTargetId?: string | null;
  actionReason?: string | null;
  nextStep?: string | null;
  recommendedContinuation?: string | null;
  lastQuestion?: string | null;
  unfinishedGoal?: string | null;
  pedagogicalTarget?: string | null;
  selectedStart?: boolean;
  kickoffHasGutenAbend?: boolean;
  kickoffSnippet?: string | null;
  note?: string | null;
  [key: string]: unknown;
};

export function targetFlow(step: string, data: TargetFlowPayload = {}): void {
  if (!targetFlowEnabled()) return;
  const route =
    data.route
    ?? (typeof window !== 'undefined' ? `${window.location.pathname}${window.location.search}` : null);
  console.log(`[TARGET_FLOW] ${step}`, {
    sessionId: data.sessionId ?? null,
    route,
    startPhraseId: data.startPhraseId ?? null,
    selectedTarget: data.selectedTarget ?? null,
    selectedTargetId: data.selectedTargetId ?? null,
    openingGerman: data.openingGerman ?? null,
    planTarget: data.planTarget ?? null,
    planTargetId: data.planTargetId ?? null,
    actionReason: data.actionReason ?? null,
    nextStep: data.nextStep ?? null,
    recommendedContinuation: data.recommendedContinuation ?? null,
    lastQuestion: data.lastQuestion ?? null,
    unfinishedGoal: data.unfinishedGoal ?? null,
    pedagogicalTarget: data.pedagogicalTarget ?? null,
    selectedStart: data.selectedStart ?? null,
    kickoffHasGutenAbend: data.kickoffHasGutenAbend ?? null,
    kickoffSnippet: data.kickoffSnippet ?? null,
    note: data.note ?? null,
  });
}
