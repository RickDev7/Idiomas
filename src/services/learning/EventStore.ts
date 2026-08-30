export type LearningEventType =
  | 'PHRASE_HEARD'
  | 'PHRASE_RECOGNIZED'
  | 'PHRASE_REPEATED'
  | 'PHRASE_PRODUCED'
  | 'PHRASE_PRODUCED_WITH_HINT'
  | 'PHRASE_RECALLED'
  | 'PHRASE_FAILED'
  | 'PHRASE_USED_SPONTANEOUSLY'
  | 'PHRASE_TRANSFERRED'
  | 'USER_UTTERANCE'
  | 'UNCLASSIFIED_USER_UTTERANCE'
  | 'MICRO_PRACTICE_STARTED'
  | 'MICRO_PRACTICE_ATTEMPT'
  | 'MICRO_PRACTICE_SUCCESS'
  | 'MICRO_PRACTICE_FAILED'
  | 'MICRO_PRACTICE_COMPLETED'
  | 'LISTENING_SUCCESS'
  | 'LISTENING_FAILURE'
  | 'RAPID_RESPONSE_SUCCESS'
  | 'RAPID_RESPONSE_FAILURE'
  | 'MISSION_COMPLETED'
  | 'HELP_REQUESTED'
  | 'SCAFFOLD_REQUESTED'
  | 'SCAFFOLD_USED'
  | 'SCAFFOLD_DECREASED'
  | 'INDEPENDENT_RESPONSE'
  | 'TRANSLATION_REQUESTED'
  | 'REPEAT_REQUESTED'
  | 'SESSION_STARTED'
  | 'SESSION_ENDED'
  | 'REVIEW_STARTED'
  | 'REVIEW_SUCCESS'
  | 'REVIEW_PARTIAL'
  | 'REVIEW_FAILED'
  | 'ADAPTATION_APPLIED'
  | 'STRATEGY_CHANGED'
  | 'BOTTLENECK_DETECTED'
  | 'STRENGTH_DETECTED'
  | 'MEMORY_CREATED'
  | 'MEMORY_UPDATED'
  | 'GOAL_CREATED'
  | 'REAL_WORLD_EVENT_CREATED'
  | 'POST_EVENT_LEARNING'
  | 'TEACHER_ADAPTATION';

export interface LearningEvent {
  id: string;
  type: LearningEventType;
  phraseId?: string;
  responseTimeMs?: number;
  helpLevel?: number;
  confidenceBefore?: number;
  confidenceAfter?: number;
  /** Texto livre / JSON de contexto (sessionId, target, etc.). */
  context?: string;
  timestamp: string;
}

const KEY = 'learning-events';
const MAX_EVENTS = 500;

export class EventStore {
  private static cache: LearningEvent[] | null = null;

  static async load(): Promise<LearningEvent[]> {
    if (this.cache) return this.cache;
    try {
      const raw = localStorage.getItem(KEY);
      this.cache = raw ? (JSON.parse(raw) as LearningEvent[]) : [];
    } catch {
      this.cache = [];
    }
    return this.cache;
  }

  static async record(event: Omit<LearningEvent, 'id' | 'timestamp'>): Promise<LearningEvent> {
    const full: LearningEvent = {
      ...event,
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: new Date().toISOString(),
    };
    const all = await this.load();
    all.push(full);
    if (all.length > MAX_EVENTS) all.splice(0, all.length - MAX_EVENTS);
    this.cache = all;
    try {
      localStorage.setItem(KEY, JSON.stringify(all));
    } catch {
      /* ignore quota */
    }
    return full;
  }

  static async recent(ms: number): Promise<LearningEvent[]> {
    const all = await this.load();
    const cutoff = Date.now() - ms;
    return all.filter((e) => new Date(e.timestamp).getTime() >= cutoff);
  }

  static async forPhrase(phraseId: string): Promise<LearningEvent[]> {
    const all = await this.load();
    return all.filter((e) => e.phraseId === phraseId);
  }

  static async clear(): Promise<void> {
    this.cache = [];
    localStorage.removeItem(KEY);
  }
}
