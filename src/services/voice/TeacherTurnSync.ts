/**
 * Sincronização teacher output ↔ UI — transcript do professor é fonte da verdade.
 */
import { separateTeacherSpeech } from '@/services/ai/TranslationService';
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

/** Extrai alemão do transcript do professor para exibição na UI. */
export function extractTeacherGermanForUi(rawUtterance: string): string {
  const trimmed = (rawUtterance || '').trim();
  if (!trimmed) return '';
  const { german } = separateTeacherSpeech(trimmed);
  return (german || trimmed).trim();
}

function normalizeForCompare(text: string): string {
  return text
    .toLowerCase()
    .replace(/ß/g, 'ss')
    .replace(/[.?!…,;:]+$/u, '')
    .trim();
}

export function pedagogicalMatchesTeacherUtterance(
  pedagogicalTarget: string,
  teacherUtterance: string,
): boolean {
  const p = normalizeForCompare(pedagogicalTarget);
  const t = normalizeForCompare(teacherUtterance);
  if (!p || !t) return true;
  return p === t;
}

export type UiTeacherSyncInput = {
  teacherUtterance: string;
  pedagogicalTarget?: string | null;
  turnId: string;
  sessionGeneration: number;
  /** false durante chunks parciais — evita spam de logs */
  final?: boolean;
};

/**
 * TEACHER AUDIO / TRANSCRIPT IS SOURCE OF TRUTH for current UI turn.
 * Retorna o texto que a UI deve exibir como instrução/pergunta atual.
 */
export function resolveUiTeacherTurn(input: UiTeacherSyncInput): string {
  const teacherUtterance = (input.teacherUtterance || '').trim();
  const displayed = extractTeacherGermanForUi(teacherUtterance);
  const pedagogicalTarget = (input.pedagogicalTarget || '').trim();

  if (DEV && input.final) {
    console.log('[TEACHER_TURN]', {
      teacherUtterance,
      turnId: input.turnId,
      timestamp: Date.now(),
    });
    if (pedagogicalTarget) {
      console.log('[PEDAGOGICAL_TARGET]', { target: pedagogicalTarget });
    }
    console.log('[UI_TARGET_SYNC]', {
      displayed,
      sessionGeneration: input.sessionGeneration,
      turnId: input.turnId,
    });
    if (
      pedagogicalTarget &&
      displayed &&
      !pedagogicalMatchesTeacherUtterance(pedagogicalTarget, displayed)
    ) {
      console.warn('[TARGET_MISMATCH]', {
        pedagogicalTarget,
        teacherUtterance: displayed,
      });
    }
  }

  return displayed;
}

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
  if (decision.reason === 'review_session_complete') return false;

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

/**
 * @deprecated UI nunca sincroniza a partir de target pedagógico — use resolveUiTeacherTurn.
 */
export function shouldUpdateTargetImmediately(_decision: OrchestratorDecision): boolean {
  return false;
}
