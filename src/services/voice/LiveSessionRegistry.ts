/**
 * Ownership global da sessão Gemini Live — invalida async órfão e áudio stale.
 */
const DEV = typeof import.meta !== 'undefined' && !!(import.meta as { env?: { DEV?: boolean } }).env?.DEV;

let liveSessionGeneration = 0;

export function beginLiveSession(): number {
  liveSessionGeneration += 1;
  if (DEV) {
    console.log('[LIVE_SESSION]', { sessionId: liveSessionGeneration, created: true });
  }
  return liveSessionGeneration;
}

export function invalidateLiveSession(): number {
  liveSessionGeneration += 1;
  if (DEV) {
    console.log('[LIVE_SESSION]', { sessionId: liveSessionGeneration, closed: true });
  }
  return liveSessionGeneration;
}

export function getLiveSessionGeneration(): number {
  return liveSessionGeneration;
}

export function isLiveSessionCurrent(generation: number): boolean {
  return generation === liveSessionGeneration;
}
