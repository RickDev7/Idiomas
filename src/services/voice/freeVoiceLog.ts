/**
 * Diagnóstico FreeVoice — sem secrets.
 */
export function freeVoiceLog(event: string, extra?: Record<string, unknown>): void {
  console.log('[FREE_VOICE]', event, extra ?? {});
}
