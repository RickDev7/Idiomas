/**
 * Turn ownership + pedagogical utterance gate for Gemini Live.
 *
 * Mic PCM may stay open (interruption), but USER_UTTERANCE / handleUserUtterance
 * only run when CURRENT_TURN_OWNER === USER and the transcript is reliable.
 *
 * Does NOT filter by language (PT answers / short A1 / names / numbers stay valid).
 */

import {
  assessUserTranscriptReliability,
  transcriptLikelyTeacherEcho,
  transcriptMatchesTarget,
} from '@/services/voice/UserTranscriptReliability';

export type TurnOwner = 'TEACHER' | 'USER';

export type TurnPhase =
  | 'TEACHER_SPEAKING'
  | 'WAITING_FOR_USER_RESPONSE'
  | 'USER_SPEAKING'
  | 'PROCESSING_USER_TURN'
  | 'IDLE';

export type UserUtteranceSkipReason =
  | 'empty_transcript'
  | 'unreliable_transcript'
  | 'teacher_echo'
  | 'teacher_speaking'
  | 'no_active_user_turn'
  | 'unrelated_ambient'
  | 'stale_generation'
  | 'wrong_session'
  | 'no_active_target'
  | 'no_session';

export type PedagogicalUtteranceGateResult =
  | { ok: true; reason: 'accepted'; phase: TurnPhase; owner: TurnOwner }
  | { ok: false; reason: UserUtteranceSkipReason; phase: TurnPhase; owner: TurnOwner };

export type TurnTimingMarks = {
  teacherAudioStartMs: number | null;
  teacherAudioEndMs: number | null;
  micSendStartMs: number | null;
  userTranscriptStartMs: number | null;
  userTranscriptFinalMs: number | null;
  turnCompleteMs: number | null;
};

export type UserTurnOwnershipState = {
  owner: TurnOwner;
  phase: TurnPhase;
  sessionGeneration: number;
  sessionId: string | null;
  waitingForUserResponse: boolean;
  hasActiveTarget: boolean;
  /** Gemini `interrupted` seen for current teacher turn */
  interrupted: boolean;
  teacherAudioActive: boolean;
  playerPlaying: boolean;
  timing: TurnTimingMarks;
};

function nowMs(): number {
  return typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now();
}

export function createUserTurnOwnershipState(
  sessionGeneration = 0,
  sessionId: string | null = null,
): UserTurnOwnershipState {
  return {
    owner: 'TEACHER',
    phase: 'IDLE',
    sessionGeneration,
    sessionId,
    waitingForUserResponse: false,
    hasActiveTarget: false,
    interrupted: false,
    teacherAudioActive: false,
    playerPlaying: false,
    timing: {
      teacherAudioStartMs: null,
      teacherAudioEndMs: null,
      micSendStartMs: null,
      userTranscriptStartMs: null,
      userTranscriptFinalMs: null,
      turnCompleteMs: null,
    },
  };
}

export function markSession(
  state: UserTurnOwnershipState,
  opts: { sessionGeneration: number; sessionId?: string | null; hasActiveTarget?: boolean },
): UserTurnOwnershipState {
  return {
    ...state,
    sessionGeneration: opts.sessionGeneration,
    sessionId: opts.sessionId !== undefined ? opts.sessionId : state.sessionId,
    hasActiveTarget: opts.hasActiveTarget ?? state.hasActiveTarget,
  };
}

export function markTeacherAudioStart(state: UserTurnOwnershipState): UserTurnOwnershipState {
  const t = nowMs();
  return {
    ...state,
    owner: 'TEACHER',
    phase: 'TEACHER_SPEAKING',
    waitingForUserResponse: false,
    teacherAudioActive: true,
    interrupted: false,
    timing: {
      ...state.timing,
      teacherAudioStartMs: state.timing.teacherAudioStartMs ?? t,
      teacherAudioEndMs: null,
    },
  };
}

export function markTeacherReceiving(state: UserTurnOwnershipState): UserTurnOwnershipState {
  return {
    ...state,
    owner: 'TEACHER',
    phase: 'TEACHER_SPEAKING',
    waitingForUserResponse: false,
    teacherAudioActive: true,
  };
}

export function markPlayerPlaying(state: UserTurnOwnershipState, playing: boolean): UserTurnOwnershipState {
  const next = { ...state, playerPlaying: playing };
  if (playing) {
    return {
      ...next,
      owner: 'TEACHER',
      phase: 'TEACHER_SPEAKING',
      waitingForUserResponse: false,
      teacherAudioActive: true,
    };
  }
  return next;
}

/**
 * Teacher transcript/audio turn finished. Opens USER ownership only when local
 * playback is idle (avoids TTS bleed into mic ASR).
 */
export function markTeacherTurnComplete(
  state: UserTurnOwnershipState,
  opts?: { playerPlaying?: boolean },
): UserTurnOwnershipState {
  const t = nowMs();
  const playerPlaying = opts?.playerPlaying ?? state.playerPlaying;
  const stillSpeaking = playerPlaying;
  if (stillSpeaking) {
    return {
      ...state,
      owner: 'TEACHER',
      phase: 'TEACHER_SPEAKING',
      waitingForUserResponse: false,
      teacherAudioActive: true,
      playerPlaying: true,
      interrupted: false,
      timing: {
        ...state.timing,
        teacherAudioEndMs: t,
        turnCompleteMs: t,
      },
    };
  }
  return {
    ...state,
    owner: 'USER',
    phase: 'WAITING_FOR_USER_RESPONSE',
    waitingForUserResponse: true,
    teacherAudioActive: false,
    playerPlaying: false,
    interrupted: false,
    timing: {
      ...state.timing,
      teacherAudioEndMs: t,
      turnCompleteMs: t,
      userTranscriptStartMs: null,
      userTranscriptFinalMs: null,
    },
  };
}

/** Local TTS/playback drained — safe to await the learner. */
export function markTeacherPlaybackIdle(state: UserTurnOwnershipState): UserTurnOwnershipState {
  if (state.phase === 'PROCESSING_USER_TURN') {
    return { ...state, teacherAudioActive: false, playerPlaying: false };
  }
  if (state.owner === 'USER' && state.phase === 'WAITING_FOR_USER_RESPONSE') {
    return { ...state, teacherAudioActive: false, playerPlaying: false };
  }
  // After teacher turn_complete while still playing — now open user turn
  if (state.owner === 'TEACHER' && state.timing.teacherAudioEndMs != null) {
    return {
      ...state,
      owner: 'USER',
      phase: 'WAITING_FOR_USER_RESPONSE',
      waitingForUserResponse: true,
      teacherAudioActive: false,
      playerPlaying: false,
    };
  }
  return { ...state, teacherAudioActive: false, playerPlaying: false };
}

export function markMicSendStart(state: UserTurnOwnershipState): UserTurnOwnershipState {
  return {
    ...state,
    timing: {
      ...state.timing,
      micSendStartMs: state.timing.micSendStartMs ?? nowMs(),
    },
  };
}

export function markUserTranscriptPartial(state: UserTurnOwnershipState): UserTurnOwnershipState {
  if (state.owner !== 'USER' && !state.interrupted) return state;
  return {
    ...state,
    phase: state.phase === 'WAITING_FOR_USER_RESPONSE' || state.phase === 'USER_SPEAKING'
      ? 'USER_SPEAKING'
      : state.phase,
    timing: {
      ...state.timing,
      userTranscriptStartMs: state.timing.userTranscriptStartMs ?? nowMs(),
    },
  };
}

export function markInterrupted(state: UserTurnOwnershipState): UserTurnOwnershipState {
  return {
    ...state,
    interrupted: true,
    // Interruption: user may own the turn even if teacher was speaking
    owner: 'USER',
    phase: 'USER_SPEAKING',
    waitingForUserResponse: true,
    teacherAudioActive: false,
    playerPlaying: false,
  };
}

export function markUserTurnAccepted(state: UserTurnOwnershipState): UserTurnOwnershipState {
  return {
    ...state,
    owner: 'TEACHER',
    phase: 'PROCESSING_USER_TURN',
    waitingForUserResponse: false,
    interrupted: false,
    timing: {
      ...state.timing,
      userTranscriptFinalMs: nowMs(),
    },
  };
}

export function timingMetrics(state: UserTurnOwnershipState): {
  firstUserPcmAfterTeacherMs: number | null;
  userTranscriptDelayMs: number | null;
  turnDurationMs: number | null;
} {
  const { teacherAudioEndMs, micSendStartMs, userTranscriptStartMs, userTranscriptFinalMs } =
    state.timing;
  return {
    firstUserPcmAfterTeacherMs:
      teacherAudioEndMs != null && micSendStartMs != null
        ? Math.round(micSendStartMs - teacherAudioEndMs)
        : null,
    userTranscriptDelayMs:
      teacherAudioEndMs != null && userTranscriptStartMs != null
        ? Math.round(userTranscriptStartMs - teacherAudioEndMs)
        : null,
    turnDurationMs:
      userTranscriptStartMs != null && userTranscriptFinalMs != null
        ? Math.round(userTranscriptFinalMs - userTranscriptStartMs)
        : null,
  };
}

/** Learner meta / short answers — never treat as ambient TV. */
const LEARNER_META = new Set(
  [
    'ja',
    'nein',
    'yes',
    'no',
    'nao',
    'não',
    'sim',
    'ok',
    'okay',
    'hilfe',
    'ajuda',
    'help',
    'wiederholen',
    'repetir',
    'langsam',
    'devagar',
    'was',
    'wie',
    'wer',
    'wo',
    'bitte',
    'danke',
    'obrigado',
    'obrigada',
    'sei',
    'nao sei',
    'não sei',
    'ich',
    'das',
    'ist',
    'meine',
    'mutter',
    'vater',
    'bruder',
    'schwester',
  ].map((w) => w.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()),
);

function normalizeTokens(s: string): string[] {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length > 0);
}

/**
 * Long off-topic monologue (TV/terceiros) with no link to the active prompt.
 * Short A1 answers, numbers, names, PT help — NOT rejected here.
 */
export function looksLikeUnrelatedAmbient(input: {
  text: string;
  lastTeacherText?: string | null;
  targetGerman?: string | null;
}): boolean {
  const tokens = normalizeTokens(input.text);
  if (tokens.length < 8 && input.text.trim().length < 55) return false;

  const context = normalizeTokens(
    `${input.lastTeacherText || ''} ${input.targetGerman || ''}`,
  );
  const ctxSet = new Set(context.filter((w) => w.length > 2));
  let hit = 0;
  for (const w of tokens) {
    if (w.length <= 2) continue;
    if (ctxSet.has(w) || LEARNER_META.has(w)) hit += 1;
  }
  const contentTokens = tokens.filter((w) => w.length > 2);
  if (contentTokens.length === 0) return false;
  const overlap = hit / contentTokens.length;
  return overlap < 0.12;
}

function teacherStillOwns(state: UserTurnOwnershipState): boolean {
  return (
    state.owner === 'TEACHER' ||
    state.phase === 'TEACHER_SPEAKING' ||
    state.teacherAudioActive ||
    state.playerPlaying
  );
}

/**
 * Pure gate before handleUserUtterance.
 * Interruption: teacher_speaking + interrupted + distinct text → accept.
 */
export function assessPedagogicalUserTurn(input: {
  text: string;
  state: UserTurnOwnershipState;
  lastTeacherText?: string | null;
  targetGerman?: string | null;
  sessionGeneration: number;
  sessionId?: string | null;
  /** Explicit interrupt signal from Gemini (when available). */
  interrupted?: boolean;
}): PedagogicalUtteranceGateResult {
  const { state } = input;
  const owner = state.owner;
  const phase = state.phase;

  if (!input.sessionGeneration || !state.sessionGeneration) {
    /* allow gen 0 only if both unset — still check mismatch below */
  }
  if (input.sessionGeneration !== state.sessionGeneration) {
    return { ok: false, reason: 'stale_generation', phase, owner };
  }
  if (
    input.sessionId != null &&
    state.sessionId != null &&
    input.sessionId !== state.sessionId
  ) {
    return { ok: false, reason: 'wrong_session', phase, owner };
  }

  const reliability = assessUserTranscriptReliability({
    text: input.text,
    lastTeacherText: input.lastTeacherText,
    targetGerman: input.targetGerman,
  });
  if (!reliability.ok) {
    if (reliability.reason === 'empty') {
      return { ok: false, reason: 'empty_transcript', phase, owner };
    }
    if (reliability.reason === 'teacher_echo') {
      return { ok: false, reason: 'teacher_echo', phase, owner };
    }
    return { ok: false, reason: 'unreliable_transcript', phase, owner };
  }

  const interrupted = !!(input.interrupted || state.interrupted);
  const distinctFromTeacher =
    !transcriptLikelyTeacherEcho(input.text, input.lastTeacherText)
    || transcriptMatchesTarget(input.text, input.targetGerman);

  if (teacherStillOwns(state)) {
    // Legitimate barge-in: interrupt signal + speech clearly not the teacher
    if (interrupted && distinctFromTeacher) {
      // fall through to accept path
    } else {
      return { ok: false, reason: 'teacher_speaking', phase, owner };
    }
  }

  if (!interrupted && (!state.waitingForUserResponse || owner !== 'USER')) {
    return { ok: false, reason: 'no_active_user_turn', phase, owner };
  }

  if (!state.hasActiveTarget && !interrupted) {
    return { ok: false, reason: 'no_active_target', phase, owner };
  }

  if (
    looksLikeUnrelatedAmbient({
      text: input.text,
      lastTeacherText: input.lastTeacherText,
      targetGerman: input.targetGerman,
    })
  ) {
    return { ok: false, reason: 'unrelated_ambient', phase, owner };
  }

  return { ok: true, reason: 'accepted', phase, owner };
}
