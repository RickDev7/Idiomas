import type { MiniProvaContext } from '@/services/teacher/MiniProvaTypes';

const INTENT_KEY = 'dt_mini_prova_intent';
const RESULT_KEY = 'dt_mini_prova_result';

export function storeMiniProvaContext(ctx: MiniProvaContext): void {
  if (typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.setItem(INTENT_KEY, JSON.stringify(ctx));
  } catch {
    /* ignore */
  }
}

export function readMiniProvaContext(): MiniProvaContext | undefined {
  if (typeof sessionStorage === 'undefined') return undefined;
  try {
    const raw = sessionStorage.getItem(INTENT_KEY);
    if (!raw) return undefined;
    const p = JSON.parse(raw) as Partial<MiniProvaContext>;
    if (!p.id || !Array.isArray(p.questions) || p.questions.length === 0) return undefined;
    return p as MiniProvaContext;
  } catch {
    return undefined;
  }
}

export function clearMiniProvaContext(): void {
  if (typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.removeItem(INTENT_KEY);
  } catch {
    /* ignore */
  }
}

export function storeMiniProvaResult(result: import('@/services/teacher/MiniProvaTypes').MiniProvaResult): void {
  if (typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.setItem(RESULT_KEY, JSON.stringify(result));
  } catch {
    /* ignore */
  }
}

export function readMiniProvaResult(): import('@/services/teacher/MiniProvaTypes').MiniProvaResult | undefined {
  if (typeof sessionStorage === 'undefined') return undefined;
  try {
    const raw = sessionStorage.getItem(RESULT_KEY);
    if (!raw) return undefined;
    return JSON.parse(raw) as import('@/services/teacher/MiniProvaTypes').MiniProvaResult;
  } catch {
    return undefined;
  }
}

export function clearMiniProvaResult(): void {
  if (typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.removeItem(RESULT_KEY);
  } catch {
    /* ignore */
  }
}
