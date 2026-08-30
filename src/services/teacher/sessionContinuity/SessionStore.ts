import type { ContinuityState, LastSessionSummary, LearningSession, SessionMessage, SessionMistake, SessionStatus } from './types';
import { isScriptedGreeting } from './SessionOpeningEngine';

const KEY = 'deutsch-turbo:session-continuity:v1';
const MAX_OPENINGS = 12;
const MAX_RECENT = 8;
const MAX_MESSAGES = 24;

export function emptyContinuityState(): ContinuityState {
  return {
    sessionCount: 0,
    lastSession: null,
    recentOpenings: [],
    currentTopic: null,
    currentSession: null,
    recentSessions: [],
    topicHistory: [],
  };
}

export function loadContinuityState(): ContinuityState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return emptyContinuityState();
    const parsed = JSON.parse(raw) as Partial<ContinuityState>;
    const state: ContinuityState = {
      sessionCount: parsed.sessionCount ?? 0,
      lastSession: parsed.lastSession ?? null,
      recentOpenings: Array.isArray(parsed.recentOpenings) ? parsed.recentOpenings : [],
      currentTopic: parsed.currentTopic ?? null,
      currentSession: parsed.currentSession ?? null,
      recentSessions: Array.isArray(parsed.recentSessions) ? parsed.recentSessions : [],
      topicHistory: Array.isArray(parsed.topicHistory) ? parsed.topicHistory : [],
    };
    return sanitizeGreetingUnfinished(state);
  } catch {
    return emptyContinuityState();
  }
}

/** Dados antigos: saudação gravada como unfinished → próxima sessão reiniciava. */
function sanitizeGreetingUnfinished(state: ContinuityState): ContinuityState {
  let dirty = false;
  let last = state.lastSession;
  let cur = state.currentSession;
  if (last?.unfinishedContent?.some(isScriptedGreeting) || (last?.unfinishedGoal && isScriptedGreeting(last.unfinishedGoal))) {
    last = {
      ...last!,
      unfinishedContent: (last!.unfinishedContent || []).filter((x) => !isScriptedGreeting(x)),
      unfinishedGoal: last!.unfinishedGoal && isScriptedGreeting(last!.unfinishedGoal) ? undefined : last!.unfinishedGoal,
      lastQuestion: last!.lastQuestion && isScriptedGreeting(last!.lastQuestion) ? '' : last!.lastQuestion,
    };
    dirty = true;
  }
  if (cur?.unfinishedContent?.some(isScriptedGreeting)) {
    cur = {
      ...cur,
      unfinishedContent: cur.unfinishedContent.filter((x) => !isScriptedGreeting(x)),
    };
    dirty = true;
  }
  if (!dirty) return state;
  const next = { ...state, lastSession: last, currentSession: cur };
  saveContinuityState(next);
  return next;
}

export function saveContinuityState(state: ContinuityState): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* quota */
  }
}

export function recordOpening(state: ContinuityState, german: string): ContinuityState {
  const existing = state.recentOpenings.find((o) => o.german === german);
  const usageCount = (existing?.usageCount ?? 0) + 1;
  const rest = state.recentOpenings.filter((o) => o.german !== german);
  const next = {
    ...state,
    recentOpenings: [...rest, { german, at: new Date().toISOString(), usageCount }].slice(-MAX_OPENINGS),
  };
  saveContinuityState(next);
  return next;
}

export function ensureSessionStub(state: ContinuityState, summary: LastSessionSummary): ContinuityState {
  if (state.lastSession) return state;
  const next: ContinuityState = {
    ...state,
    lastSession: summary,
    currentTopic: summary.topic || state.currentTopic,
  };
  saveContinuityState(next);
  return next;
}

export function saveLastSession(
  state: ContinuityState,
  summary: LastSessionSummary,
  opts?: { increment?: boolean; clearCurrent?: boolean },
): ContinuityState {
  const increment = opts?.increment !== false;
  const clearCurrent = opts?.clearCurrent !== false;
  const recent = [summary, ...(state.recentSessions || []).filter((s) => s.date !== summary.date)].slice(0, MAX_RECENT);
  const topics = summary.topic
    ? [summary.topic, ...(state.topicHistory || []).filter((t) => t !== summary.topic)].slice(0, 12)
    : (state.topicHistory || []);
  const next: ContinuityState = {
    ...state,
    sessionCount: increment ? state.sessionCount + 1 : state.sessionCount,
    lastSession: summary,
    currentTopic: summary.topic || state.currentTopic,
    currentSession: clearCurrent ? null : state.currentSession,
    recentSessions: recent,
    topicHistory: topics,
  };
  saveContinuityState(next);
  return next;
}

export function hoursSince(iso: string | null | undefined, now = Date.now()): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return (now - t) / 3_600_000;
}

export function newSessionId(): string {
  return `sess-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function startOrResumeSession(meta: {
  topic: string;
  goal: string;
  level: string;
}): LearningSession {
  const state = loadContinuityState();
  const open = state.currentSession;
  if (open && (open.status === 'ACTIVE' || open.status === 'PAUSED' || open.status === 'ABANDONED' || open.status === 'CREATED')) {
    const resumed: LearningSession = { ...open, status: 'ACTIVE' };
    saveContinuityState({ ...state, currentSession: resumed, currentTopic: resumed.topic || meta.topic });
    return resumed;
  }
  const session: LearningSession = {
    id: newSessionId(),
    startedAt: new Date().toISOString(),
    endedAt: null,
    status: 'ACTIVE',
    topic: meta.topic,
    goal: meta.goal,
    level: meta.level,
    messages: [],
    learnedItems: [],
    reviewItems: [],
    mistakes: [],
    lastTeacherMessage: '',
    lastUserResponse: '',
    unfinishedContent: [],
    nextRecommendedStep: '',
  };
  saveContinuityState({ ...state, currentSession: session, currentTopic: meta.topic });
  return session;
}

export function autosaveTurn(role: 'user' | 'assistant', text: string): LearningSession | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  const state = loadContinuityState();
  const cur = state.currentSession;
  if (!cur || cur.status === 'COMPLETED') return null;
  const msg: SessionMessage = { role, text: trimmed.slice(0, 400), at: new Date().toISOString() };
  const messages = [...cur.messages.filter((m) => m.text !== trimmed), msg].slice(-MAX_MESSAGES);
  const next: LearningSession = {
    ...cur,
    status: 'ACTIVE',
    messages,
    lastTeacherMessage: role === 'assistant' ? trimmed.slice(0, 400) : cur.lastTeacherMessage,
    lastUserResponse: role === 'user' ? trimmed.slice(0, 400) : cur.lastUserResponse,
    learnedItems: role === 'user'
      ? uniquePush(cur.learnedItems, germanish(trimmed), 12)
      : cur.learnedItems,
    unfinishedContent: role === 'assistant' && isQuestion(trimmed) && !isScriptedGreeting(trimmed)
      ? [trimmed.slice(0, 180)]
      : role === 'user' && cur.unfinishedContent.length
        ? [] // aluno respondeu → pergunta anterior não fica pendente
        : cur.unfinishedContent,
  };
  saveContinuityState({ ...state, currentSession: next, currentTopic: next.topic || state.currentTopic });
  return next;
}

export function recordSessionMistake(userSaid: string, expected?: string): void {
  const state = loadContinuityState();
  const cur = state.currentSession;
  if (!cur) return;
  const item: SessionMistake = { phrase: expected || guessCorrection(userSaid), userSaid: userSaid.slice(0, 180) };
  const mistakes = [...cur.mistakes.filter((m) => m.userSaid !== item.userSaid), item].slice(-8);
  saveContinuityState({ ...state, currentSession: { ...cur, mistakes } });
}

export function markSessionStatus(status: SessionStatus): LearningSession | null {
  const state = loadContinuityState();
  const cur = state.currentSession;
  if (!cur) return null;
  const next: LearningSession = {
    ...cur,
    status,
    endedAt: status === 'ACTIVE' || status === 'CREATED' ? cur.endedAt : new Date().toISOString(),
  };
  saveContinuityState({ ...state, currentSession: next });
  return next;
}

export function getIncompleteSession(): LearningSession | null {
  const cur = loadContinuityState().currentSession;
  if (!cur) return null;
  if (cur.status === 'COMPLETED') return null;
  if (cur.status === 'CREATED' && cur.messages.length === 0) return null;
  return cur;
}

export function getLastSession(): LastSessionSummary | null {
  return loadContinuityState().lastSession;
}

export function getRecentSessions(): LastSessionSummary[] {
  return loadContinuityState().recentSessions || [];
}

function uniquePush(list: string[], value: string, max: number): string[] {
  if (!value) return list;
  return [value, ...list.filter((x) => x !== value)].slice(0, max);
}

function germanish(text: string): string {
  const t = text.trim();
  if (t.length < 4) return '';
  if (/[äöüßÄÖÜ]/.test(t) || /\b(ich|du|wir|sie|ist|bin|habe|wohn|heiß|arbeit)\b/i.test(t)) {
    return t.replace(/[.!?]+$/, '').slice(0, 80);
  }
  return '';
}

function isQuestion(text: string): boolean {
  return /[?]/.test(text) || /^(wo|was|wie|wer|wann|warum|woher)\b/i.test(text.trim());
}

function guessCorrection(said: string): string {
  if (/arbeiten\b/i.test(said) && !/\barbeite\b/i.test(said)) return 'Ich arbeite.';
  return said.replace(/arbeiten/i, 'arbeite').slice(0, 80);
}
