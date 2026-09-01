import type { SimulatorContext } from '@/services/teacher/SimulatorTypes';

const INTENT_KEY = 'dt_simulator_intent';
const RESULT_KEY = 'dt_simulator_result';

export function storeSimulatorContext(ctx: SimulatorContext): void {
  if (typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.setItem(INTENT_KEY, JSON.stringify(ctx));
  } catch {
    /* ignore */
  }
}

export function readSimulatorContext(): SimulatorContext | undefined {
  if (typeof sessionStorage === 'undefined') return undefined;
  try {
    const raw = sessionStorage.getItem(INTENT_KEY);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as Partial<SimulatorContext>;
    if (!parsed.id || !parsed.scenario || !parsed.endsAt) return undefined;
    return parsed as SimulatorContext;
  } catch {
    return undefined;
  }
}

export function clearSimulatorContext(): void {
  if (typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.removeItem(INTENT_KEY);
  } catch {
    /* ignore */
  }
}

export function storeSimulatorResult(result: import('@/services/teacher/SimulatorTypes').SimulatorResult): void {
  if (typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.setItem(RESULT_KEY, JSON.stringify(result));
  } catch {
    /* ignore */
  }
}

export function readSimulatorResult(): import('@/services/teacher/SimulatorTypes').SimulatorResult | undefined {
  if (typeof sessionStorage === 'undefined') return undefined;
  try {
    const raw = sessionStorage.getItem(RESULT_KEY);
    if (!raw) return undefined;
    return JSON.parse(raw) as import('@/services/teacher/SimulatorTypes').SimulatorResult;
  } catch {
    return undefined;
  }
}

export function clearSimulatorResult(): void {
  if (typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.removeItem(RESULT_KEY);
  } catch {
    /* ignore */
  }
}
