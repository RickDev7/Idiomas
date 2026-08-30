/* Memória útil do professor pessoal (Fase 10).
   USER_FACTS | GOAL | CONVERSATION | CONTEXT/eventos.
   LINGUISTIC_MEMORY e LEARNING_PROFILE continuam em MemoryService / PersonalLearningProfile. */

export type MemoryKind =
  | 'USER_FACTS'
  | 'LINGUISTIC_MEMORY'
  | 'CONVERSATION_MEMORY'
  | 'LEARNING_PROFILE'
  | 'GOAL_MEMORY'
  | 'CONTEXT_MEMORY';

export interface UserFact {
  id: string;
  key: string;
  value: string;
  confidence: number;
  source: 'user' | 'profile' | 'inferred';
  createdAt: string;
  updatedAt: string;
  lastUsedAt?: string;
}

export interface GoalMemory {
  id: string;
  text: string;
  explicit: boolean;
  confidence: number;
  createdAt: string;
}

export type RealWorldEventType =
  | 'WORK_MEETING'
  | 'BOSS_TALK'
  | 'DOCTOR'
  | 'SCHOOL'
  | 'PHONE'
  | 'BANK'
  | 'INTERVIEW'
  | 'NEIGHBOR'
  | 'SERVICE'
  | 'TRAVEL'
  | 'OTHER';

export type RealWorldEventStatus = 'upcoming' | 'prepared' | 'happened' | 'followed_up';

export interface RealWorldEvent {
  id: string;
  type: RealWorldEventType;
  date: string;
  topic: string;
  raw: string;
  status: RealWorldEventStatus;
  confidence: number;
  learningNotes?: string;
  createdAt: string;
}

export interface ConversationEpisode {
  id: string;
  topic: string;
  summary: string;
  at: string;
  confidence: number;
}

export interface CoachMemoryState {
  version: 1;
  facts: UserFact[];
  goals: GoalMemory[];
  events: RealWorldEvent[];
  episodes: ConversationEpisode[];
  /** ids recentemente mencionados ao aluno — evitar repetir. */
  recentlyRecalled: { id: string; at: string }[];
}

export const COACH_MEMORY_KEY = 'deutsch-turbo:coach-memory:v1';

export function emptyCoachMemory(): CoachMemoryState {
  return { version: 1, facts: [], goals: [], events: [], episodes: [], recentlyRecalled: [] };
}

export function loadCoachMemory(): CoachMemoryState {
  try {
    const raw = localStorage.getItem(COACH_MEMORY_KEY);
    if (!raw) return emptyCoachMemory();
    const p = JSON.parse(raw) as CoachMemoryState;
    if (p?.version !== 1) return emptyCoachMemory();
    return { ...emptyCoachMemory(), ...p, facts: p.facts || [], goals: p.goals || [], events: p.events || [], episodes: p.episodes || [], recentlyRecalled: p.recentlyRecalled || [] };
  } catch {
    return emptyCoachMemory();
  }
}

export function saveCoachMemory(state: CoachMemoryState): void {
  try {
    const trimmed: CoachMemoryState = {
      ...state,
      facts: state.facts.slice(-40),
      goals: state.goals.slice(-8),
      events: state.events.slice(-20),
      episodes: state.episodes.slice(-16),
      recentlyRecalled: state.recentlyRecalled.slice(-24),
    };
    localStorage.setItem(COACH_MEMORY_KEY, JSON.stringify(trimmed));
  } catch { /* quota */ }
}

function id(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export function upsertFact(state: CoachMemoryState, key: string, value: string, confidence: number, source: UserFact['source']): CoachMemoryState {
  const now = new Date().toISOString();
  const existing = state.facts.find((f) => f.key === key);
  if (existing) {
    if (existing.value.toLowerCase() === value.toLowerCase()) {
      return {
        ...state,
        facts: state.facts.map((f) =>
          f.id === existing.id ? { ...f, confidence: Math.max(f.confidence, confidence), updatedAt: now } : f,
        ),
      };
    }
    // reconciliação: dado novo substitui
    return {
      ...state,
      facts: state.facts.map((f) =>
        f.id === existing.id ? { ...f, value, confidence, source, updatedAt: now } : f,
      ),
    };
  }
  return {
    ...state,
    facts: [...state.facts, { id: id('fact'), key, value, confidence, source, createdAt: now, updatedAt: now }],
  };
}

export function addGoal(state: CoachMemoryState, text: string, confidence: number): CoachMemoryState {
  if (state.goals.some((g) => g.text.toLowerCase() === text.toLowerCase())) return state;
  return {
    ...state,
    goals: [...state.goals, { id: id('goal'), text, explicit: true, confidence, createdAt: new Date().toISOString() }],
  };
}

export function addEvent(state: CoachMemoryState, ev: Omit<RealWorldEvent, 'id' | 'createdAt'>): CoachMemoryState {
  const dup = state.events.find(
    (e) => e.type === ev.type && e.date.slice(0, 10) === ev.date.slice(0, 10) && e.status !== 'followed_up',
  );
  if (dup) {
    return {
      ...state,
      events: state.events.map((e) => (e.id === dup.id ? { ...e, ...ev, id: dup.id, createdAt: dup.createdAt } : e)),
    };
  }
  return {
    ...state,
    events: [...state.events, { ...ev, id: id('evt'), createdAt: new Date().toISOString() }],
  };
}

export function updateEvent(state: CoachMemoryState, eventId: string, patch: Partial<RealWorldEvent>): CoachMemoryState {
  return {
    ...state,
    events: state.events.map((e) => (e.id === eventId ? { ...e, ...patch } : e)),
  };
}

export function addEpisode(state: CoachMemoryState, topic: string, summary: string): CoachMemoryState {
  return {
    ...state,
    episodes: [
      ...state.episodes,
      { id: id('ep'), topic, summary: summary.slice(0, 180), at: new Date().toISOString(), confidence: 0.7 },
    ].slice(-16),
  };
}

export function markRecalled(state: CoachMemoryState, ids: string[]): CoachMemoryState {
  const at = new Date().toISOString();
  return {
    ...state,
    recentlyRecalled: [...state.recentlyRecalled, ...ids.map((id) => ({ id, at }))].slice(-24),
    facts: state.facts.map((f) => (ids.includes(f.id) ? { ...f, lastUsedAt: at } : f)),
  };
}

export function seedFromUserProfile(state: CoachMemoryState, profile: { name?: string; profession?: string; goal?: string }): CoachMemoryState {
  let next = state;
  if (profile.profession) next = upsertFact(next, 'profession', profile.profession, 0.95, 'profile');
  if (profile.name) next = upsertFact(next, 'name', profile.name, 0.9, 'profile');
  if (profile.goal === 'work') next = addGoal(next, 'Quero falar alemão no trabalho.', 0.9);
  return next;
}
