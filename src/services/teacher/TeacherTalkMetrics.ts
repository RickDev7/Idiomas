/**
 * TeacherTalkMetrics — métricas observáveis a partir de transcripts reais.
 * Duração = completedAt - startedAt do SpeakerTurn (não chars, não silêncio).
 * Respeita LiveSessionOwnership via sessionGeneration.
 */
import { isLiveSessionCurrent } from '@/services/voice/LiveSessionRegistry';
import type { ProfessorSessionMode } from '@/services/teacher/ProfessorCore/Types';
import { MODE_POLICIES } from '@/services/teacher/ProfessorCore/ModePolicies';

export type TalkRole = 'assistant' | 'user';

export interface TalkSegmentInput {
  sessionGeneration: number;
  role: TalkRole;
  turnId: string;
  startedAt: string;
  completedAt: string | null;
}

export interface TeacherTalkSnapshot {
  sessionGeneration: number;
  teacherSpeechDurationMs: number;
  studentSpeechDurationMs: number;
  silenceDurationMs: number;
  totalSessionDurationMs: number;
  teacherTurns: number;
  studentTurns: number;
  teacherTalkRatio: number | null;
  studentTalkRatio: number | null;
  reliable: boolean;
  teacherTalkTooHigh: boolean;
  mode: ProfessorSessionMode | null;
}

type InternalSeg = {
  turnId: string;
  role: TalkRole;
  durationMs: number;
};

type SessionBucket = {
  generation: number;
  startedAtMs: number;
  mode: ProfessorSessionMode | null;
  segments: InternalSeg[];
  seenTurnIds: Set<string>;
};

const buckets = new Map<number, SessionBucket>();

function parseIsoMs(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : null;
}

function durationMs(startedAt: string, completedAt: string | null): number | null {
  const a = parseIsoMs(startedAt);
  const b = parseIsoMs(completedAt);
  if (a == null || b == null) return null;
  const d = b - a;
  if (d < 0 || d > 10 * 60_000) return null; // rejeita absurdos
  return d;
}

export function beginTeacherTalkSession(
  sessionGeneration: number,
  mode: ProfessorSessionMode | null = null,
): void {
  buckets.set(sessionGeneration, {
    generation: sessionGeneration,
    startedAtMs: Date.now(),
    mode,
    segments: [],
    seenTurnIds: new Set(),
  });
}

export function endTeacherTalkSession(sessionGeneration: number): void {
  buckets.delete(sessionGeneration);
}

export function resetTeacherTalkMetricsForTests(): void {
  buckets.clear();
}

/**
 * Registra um turno completo de fala.
 * Ignora: geração stale, turnId duplicado, duração inválida, roles inválidos.
 */
export function recordTalkSegment(input: TalkSegmentInput): boolean {
  if (!isLiveSessionCurrent(input.sessionGeneration)) return false;
  if (input.role !== 'assistant' && input.role !== 'user') return false;
  const dur = durationMs(input.startedAt, input.completedAt);
  if (dur == null || dur === 0) return false;

  let bucket = buckets.get(input.sessionGeneration);
  if (!bucket) {
    beginTeacherTalkSession(input.sessionGeneration, null);
    bucket = buckets.get(input.sessionGeneration)!;
  }
  if (bucket.seenTurnIds.has(input.turnId)) return false;
  bucket.seenTurnIds.add(input.turnId);
  bucket.segments.push({
    turnId: input.turnId,
    role: input.role,
    durationMs: dur,
  });
  return true;
}

export function getTeacherTalkSnapshot(
  sessionGeneration: number,
  now = Date.now(),
): TeacherTalkSnapshot {
  const bucket = buckets.get(sessionGeneration);
  const empty: TeacherTalkSnapshot = {
    sessionGeneration,
    teacherSpeechDurationMs: 0,
    studentSpeechDurationMs: 0,
    silenceDurationMs: 0,
    totalSessionDurationMs: 0,
    teacherTurns: 0,
    studentTurns: 0,
    teacherTalkRatio: null,
    studentTalkRatio: null,
    reliable: false,
    teacherTalkTooHigh: false,
    mode: null,
  };
  if (!bucket) return empty;

  let teacherMs = 0;
  let studentMs = 0;
  let teacherTurns = 0;
  let studentTurns = 0;
  for (const s of bucket.segments) {
    if (s.role === 'assistant') {
      teacherMs += s.durationMs;
      teacherTurns += 1;
    } else {
      studentMs += s.durationMs;
      studentTurns += 1;
    }
  }

  const speechTotal = teacherMs + studentMs;
  const sessionDur = Math.max(0, now - bucket.startedAtMs);
  const silence = Math.max(0, sessionDur - speechTotal);
  const reliable = speechTotal >= 1500 && teacherTurns + studentTurns >= 2;

  let teacherTalkRatio: number | null = null;
  let studentTalkRatio: number | null = null;
  if (speechTotal > 0) {
    teacherTalkRatio = teacherMs / speechTotal;
    studentTalkRatio = studentMs / speechTotal;
  }

  const mode = bucket.mode;
  const simTarget = MODE_POLICIES.SIMULATOR.teacherTalkRatioMax;
  const teacherTalkTooHigh =
    mode === 'SIMULATOR' && reliable && teacherTalkRatio != null && teacherTalkRatio > simTarget + 0.1;

  return {
    sessionGeneration,
    teacherSpeechDurationMs: teacherMs,
    studentSpeechDurationMs: studentMs,
    silenceDurationMs: silence,
    totalSessionDurationMs: sessionDur,
    teacherTurns,
    studentTurns,
    teacherTalkRatio,
    studentTalkRatio,
    reliable,
    teacherTalkTooHigh,
    mode,
  };
}

export function setTeacherTalkMode(
  sessionGeneration: number,
  mode: ProfessorSessionMode | null,
): void {
  const b = buckets.get(sessionGeneration);
  if (b) b.mode = mode;
}

/** Campos seguros para anexar ao SimulatorResult (só se confiáveis). */
export function talkMetricsForSimulatorResult(sessionGeneration: number): {
  teacherTalkRatio?: number;
  studentTalkRatio?: number;
  teacherTurns?: number;
  studentTurns?: number;
  teacherSpeechDurationMs?: number;
  studentSpeechDurationMs?: number;
  teacherTalkTooHigh?: boolean;
} {
  const snap = getTeacherTalkSnapshot(sessionGeneration);
  if (!snap.reliable || snap.teacherTalkRatio == null || snap.studentTalkRatio == null) {
    return {};
  }
  return {
    teacherTalkRatio: Math.round(snap.teacherTalkRatio * 1000) / 1000,
    studentTalkRatio: Math.round(snap.studentTalkRatio * 1000) / 1000,
    teacherTurns: snap.teacherTurns,
    studentTurns: snap.studentTurns,
    teacherSpeechDurationMs: snap.teacherSpeechDurationMs,
    studentSpeechDurationMs: snap.studentSpeechDurationMs,
    teacherTalkTooHigh: snap.teacherTalkTooHigh,
  };
}
