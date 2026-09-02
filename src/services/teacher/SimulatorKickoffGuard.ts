/**
 * Garante que o mesmo intent + geração Live produz no máximo um kickoff de simulador.
 */
const handled = new Set<string>();

export function simulatorKickoffKey(intentId: string, sessionGeneration: number): string {
  return `${intentId}:${sessionGeneration}`;
}

/** Retorna true se este kickoff ainda não foi tratado (e marca como tratado). */
export function tryClaimSimulatorKickoff(intentId: string, sessionGeneration: number): boolean {
  const key = simulatorKickoffKey(intentId, sessionGeneration);
  if (handled.has(key)) return false;
  handled.add(key);
  return true;
}

export function isSimulatorKickoffClaimed(intentId: string, sessionGeneration: number): boolean {
  return handled.has(simulatorKickoffKey(intentId, sessionGeneration));
}

export function resetSimulatorKickoffGuard(): void {
  handled.clear();
}
