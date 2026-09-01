/**
 * Sincronização teacher output ↔ UI target — evita nudge duplicado em Gemini Live.
 */
import type { ConversationOrchestrator } from '@/services/teacher/ConversationOrchestrator';

const DEV = typeof import.meta !== 'undefined' && !!(import.meta as { env?: { DEV?: boolean } }).env?.DEV;

export type TeacherAudioSource =
  | 'KICKOFF'
  | 'GEMINI_LIVE'
  | 'NUDGE'
  | 'PRACTICE'
  | 'CONVERSE'
  | 'RETRY'
  | 'TTS'
  | 'HELP'
  | 'UNKNOWN';

export type OrchestratorDecision = Awaited<ReturnType<ConversationOrchestrator['handle']>>;

export type TeacherTurnLogContext = {
  sessionGeneration: number;
  turnId: string;
  targetId?: string | null;
  targetText?: string | null;
};

export function logTeacherAudio(
  ctx: TeacherTurnLogContext,
  source: TeacherAudioSource,
  text?: string,
): void {
  if (!DEV) return;
  console.log('[TEACHER_AUDIO]', {
    sessionGeneration: ctx.sessionGeneration,
    turnId: ctx.turnId,
    targetId: ctx.targetId ?? null,
    targetText: ctx.targetText ?? null,
    source,
    text: text?.slice(0, 120) ?? '',
    timestamp: Date.now(),
  });
}

export function logUiTarget(ctx: TeacherTurnLogContext): void {
  if (!DEV) return;
  console.log('[UI_TARGET]', {
    sessionGeneration: ctx.sessionGeneration,
    turnId: ctx.turnId,
    targetId: ctx.targetId ?? null,
    targetText: ctx.targetText ?? null,
    timestamp: Date.now(),
  });
}

export function logTeacherTranscript(ctx: TeacherTurnLogContext, text: string): void {
  if (!DEV) return;
  console.log('[TEACHER_TRANSCRIPT]', {
    sessionGeneration: ctx.sessionGeneration,
    turnId: ctx.turnId,
    text: text.slice(0, 160),
    timestamp: Date.now(),
  });
}

export function isOpeningDecision(decision: OrchestratorDecision): boolean {
  return (
    decision.reason === 'sessão iniciada com plano TeacherEngine' ||
    !!decision.reason?.startsWith('review_started:') ||
    decision.reason === 'follow_up_real_world_event'
  );
}

export function isPedagogicalOverrideFlow(decision: OrchestratorDecision): boolean {
  return (
    decision.flow === 'intervenePedagogically' ||
    decision.flow === 'startMicroPractice' ||
    decision.flow === 'resumeConversation'
  );
}

export function shouldEmitPedagogicalNudge(
  decision: OrchestratorDecision,
  opts: {
    liveVoiceActive: boolean;
    naturalTeacherResponseExpected: boolean;
    assistantSpeaking: boolean;
    teacherReceiving: boolean;
    playerPlaying: boolean;
  },
): boolean {
  if (!decision.geminiNudge) return false;
  if (isOpeningDecision(decision)) return false;

  const shouldSendFlow =
    decision.flow === 'intervenePedagogically' ||
    decision.flow === 'startMicroPractice' ||
    decision.flow === 'resumeConversation' ||
    (decision.flow === 'continueConversation' &&
      decision.geminiNudge.includes('INSTRUÇÃO INTERNA'));

  if (!shouldSendFlow) return false;
  if (isPedagogicalOverrideFlow(decision)) return true;

  if (!opts.liveVoiceActive) return true;

  if (!opts.naturalTeacherResponseExpected) return true;

  if (opts.assistantSpeaking || opts.teacherReceiving || opts.playerPlaying) {
    return false;
  }

  return true;
}

/** UI target só após o professor falar, exceto micro/intervenção imediata. */
export function shouldUpdateTargetImmediately(decision: OrchestratorDecision): boolean {
  if (!decision.targetItem) return false;
  if (decision.reason === 'fala do professor registrada') return false;
  return isPedagogicalOverrideFlow(decision);
}
