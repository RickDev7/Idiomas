/**
 * Tracker diário de chunks L0 — eventos pedagógicos + localStorage.
 * Chave: @deutsch_turbo:daily_chunks
 */
import {
  L0_CHUNK_GRAPH,
  L0_CHUNK_HOOK_IDS,
  l0ChunkBaseForPhraseId,
  l0IsQuestionNodeId,
  l0IsSimpleVariationId,
  zeroLanguageSeedPhrases,
} from '@/services/teacher/ZeroLanguageMode';

export const DAILY_CHUNKS_STORAGE_KEY = '@deutsch_turbo:daily_chunks';
const LEGACY_STORAGE_KEY = 'deutsch-turbo:chunk-progress-today:v1';
export const DEFAULT_CHUNK_BASE_ID = 'l0-hook-ich-moechte';

export type ChunkVisualIcon = 'drop' | 'briefcase' | 'house' | 'default';
export type ChunkVariationStatus = 'validated' | 'pending';

export type ChunkVariationEntry = {
  phraseId: string;
  german: string;
  portuguese: string;
  practicedAt: string;
  tint: string;
  icon: ChunkVisualIcon;
  status: ChunkVariationStatus;
};

export type DailyChunkState = {
  date: string;
  activeBaseId: string;
  variations: ChunkVariationEntry[];
};

export type ChunkTrackerEvent =
  | { type: 'CORRECT'; phraseId: string; nextPhraseId?: string | null }
  | { type: 'ADVANCE_VARIATION'; phraseId: string; baseId: string };

type Listener = (state: DailyChunkState) => void;

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function phraseLookup() {
  return new Map(zeroLanguageSeedPhrases().map((p) => [p.id, p]));
}

export function inferChunkVisual(german: string): { tint: string; icon: ChunkVisualIcon } {
  const g = german.toLowerCase();
  if (g.includes('wasser')) return { tint: '#38bdf8', icon: 'drop' };
  if (g.includes('arbeit')) return { tint: '#10B981', icon: 'briefcase' };
  if (g.includes('haus') || g.includes('hause') || g.includes('gehen') || g.includes('pause')) {
    return { tint: '#FF512F', icon: 'house' };
  }
  if (g.includes('hilfe') || g.includes('helfen')) return { tint: '#A855F7', icon: 'default' };
  return { tint: '#8B5CF6', icon: 'default' };
}

function isChunkRelated(phraseId: string): boolean {
  if (L0_CHUNK_GRAPH[phraseId]) return true;
  if ((L0_CHUNK_HOOK_IDS as readonly string[]).includes(phraseId)) return true;
  return l0ChunkBaseForPhraseId(phraseId) !== null;
}

function resolvePhraseMeta(phraseId: string): { german: string; portuguese: string } | null {
  const hit = phraseLookup().get(phraseId);
  if (!hit) return null;
  return { german: hit.german, portuguese: hit.portuguese };
}

function defaultState(): DailyChunkState {
  return {
    date: todayKey(),
    activeBaseId: DEFAULT_CHUNK_BASE_ID,
    variations: [],
  };
}

function normalizeState(raw: Partial<DailyChunkState> | null): DailyChunkState {
  const base = defaultState();
  if (!raw || typeof raw !== 'object') return base;
  const date = typeof raw.date === 'string' ? raw.date : base.date;
  const activeBaseId =
    typeof raw.activeBaseId === 'string' && (L0_CHUNK_GRAPH[raw.activeBaseId] || phraseLookup().has(raw.activeBaseId))
      ? raw.activeBaseId
      : base.activeBaseId;
  const variations = Array.isArray(raw.variations)
    ? raw.variations
        .filter((v) => v && typeof v.phraseId === 'string' && typeof v.german === 'string')
        .map((v) => ({
          ...v,
          status: v.status === 'validated' ? 'validated' as const : 'pending' as const,
          portuguese: typeof v.portuguese === 'string' ? v.portuguese : '',
          practicedAt: typeof v.practicedAt === 'string' ? v.practicedAt : new Date().toISOString(),
          tint: typeof v.tint === 'string' ? v.tint : '#8B5CF6',
          icon: (v.icon as ChunkVisualIcon) || 'default',
        }))
    : [];
  if (date !== todayKey()) return defaultState();
  return { date, activeBaseId, variations };
}

function loadState(): DailyChunkState {
  if (typeof localStorage === 'undefined') return defaultState();
  try {
    let raw = localStorage.getItem(DAILY_CHUNKS_STORAGE_KEY);
    if (!raw) {
      raw = localStorage.getItem(LEGACY_STORAGE_KEY);
      if (raw) {
        localStorage.setItem(DAILY_CHUNKS_STORAGE_KEY, raw);
        localStorage.removeItem(LEGACY_STORAGE_KEY);
      }
    }
    if (!raw) return defaultState();
    return normalizeState(JSON.parse(raw) as Partial<DailyChunkState>);
  } catch {
    return defaultState();
  }
}

function saveState(state: DailyChunkState): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(DAILY_CHUNKS_STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* quota / private mode */
  }
}

function buildVariationEntry(phraseId: string, status: ChunkVariationStatus = 'validated'): ChunkVariationEntry | null {
  const meta = resolvePhraseMeta(phraseId);
  if (!meta) return null;
  const { tint, icon } = inferChunkVisual(meta.german);
  return {
    phraseId,
    german: meta.german,
    portuguese: meta.portuguese,
    practicedAt: new Date().toISOString(),
    tint,
    icon,
    status,
  };
}

function upsertVariation(state: DailyChunkState, entry: ChunkVariationEntry): void {
  const idx = state.variations.findIndex((v) => v.phraseId === entry.phraseId);
  if (idx >= 0) {
    state.variations[idx] = { ...state.variations[idx], ...entry, practicedAt: entry.practicedAt };
  } else {
    state.variations.push(entry);
  }
  state.variations.sort((a, b) => Date.parse(b.practicedAt) - Date.parse(a.practicedAt));
  if (state.variations.length > 12) state.variations = state.variations.slice(0, 12);
}

function applyTrackerEvent(state: DailyChunkState, event: ChunkTrackerEvent): DailyChunkState {
  if (state.date !== todayKey()) state = defaultState();

  if (event.type === 'ADVANCE_VARIATION') {
    if (L0_CHUNK_GRAPH[event.baseId] || phraseLookup().has(event.baseId)) {
      state.activeBaseId = event.baseId;
    }
    if (l0IsSimpleVariationId(event.phraseId) || l0IsQuestionNodeId(event.phraseId)) {
      const entry = buildVariationEntry(event.phraseId, 'pending');
      if (entry) upsertVariation(state, entry);
    }
    return state;
  }

  const { phraseId, nextPhraseId } = event;
  if (!isChunkRelated(phraseId)) return state;

  const baseId = l0ChunkBaseForPhraseId(phraseId);
  const isBaseHook = Boolean(L0_CHUNK_GRAPH[phraseId]);

  if (isBaseHook) {
    state.activeBaseId = phraseId;
  } else if (baseId) {
    state.activeBaseId = baseId;
    if (l0IsSimpleVariationId(phraseId) || l0IsQuestionNodeId(phraseId)) {
      const entry = buildVariationEntry(phraseId, 'validated');
      if (entry) upsertVariation(state, entry);
    }
  }

  if (nextPhraseId) {
    const nextBase = l0ChunkBaseForPhraseId(nextPhraseId);
    const nextIsHook = Boolean(L0_CHUNK_GRAPH[nextPhraseId]);
    if (nextIsHook && (L0_CHUNK_HOOK_IDS as readonly string[]).includes(nextPhraseId)) {
      state.activeBaseId = nextPhraseId;
    } else if (nextBase && isBaseHook && nextBase !== phraseId) {
      state.activeBaseId = nextBase;
    }
  }

  return state;
}

class ChunkTrackerStoreImpl {
  private listeners = new Set<Listener>();
  private state: DailyChunkState = loadState();

  getState(): DailyChunkState {
    this.state = normalizeState(this.state);
    return this.state;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(): void {
    const snap = this.getState();
    for (const fn of this.listeners) fn(snap);
  }

  recordCorrect(input: { phraseId: string; nextPhraseId?: string | null }): void {
    if (!isChunkRelated(input.phraseId)) return;
    this.state = applyTrackerEvent(this.state, {
      type: 'CORRECT',
      phraseId: input.phraseId,
      nextPhraseId: input.nextPhraseId ?? null,
    });
    saveState(this.state);
    this.emit();
  }

  recordAdvanceVariation(input: { phraseId: string; baseId: string }): void {
    this.state = applyTrackerEvent(this.state, {
      type: 'ADVANCE_VARIATION',
      phraseId: input.phraseId,
      baseId: input.baseId,
    });
    saveState(this.state);
    this.emit();
  }

  dispatch(event: ChunkTrackerEvent): void {
    if (event.type === 'CORRECT') {
      this.recordCorrect({ phraseId: event.phraseId, nextPhraseId: event.nextPhraseId });
      return;
    }
    this.recordAdvanceVariation({ phraseId: event.phraseId, baseId: event.baseId });
  }

  resetToday(): void {
    this.state = defaultState();
    saveState(this.state);
    this.emit();
  }
}

export const ChunkTrackerStore = new ChunkTrackerStoreImpl();

/** @deprecated Use ChunkTrackerStore */
export const ChunkProgressStore = ChunkTrackerStore;

export function getActiveChunkDisplay(state: DailyChunkState): {
  baseId: string;
  german: string;
  portuguese: string;
} {
  const meta = resolvePhraseMeta(state.activeBaseId);
  if (meta) {
    return { baseId: state.activeBaseId, german: meta.german, portuguese: meta.portuguese };
  }
  return {
    baseId: state.activeBaseId,
    german: 'Ich möchte...',
    portuguese: 'Quero...',
  };
}

export function getDisplayVariations(state: DailyChunkState, limit = 3): ChunkVariationEntry[] {
  return state.variations.slice(0, limit);
}

export type ChunkDisplaySlot =
  | { kind: 'variation'; data: ChunkVariationEntry }
  | { kind: 'placeholder'; index: number; hint: string; tint: string; icon: ChunkVisualIcon };

const PLACEHOLDER_HINTS: Array<{ hint: string; tint: string; icon: ChunkVisualIcon }> = [
  { hint: 'Pratique no Live', tint: '#38bdf8', icon: 'drop' },
  { hint: 'Monte uma variação', tint: '#10B981', icon: 'briefcase' },
  { hint: 'Complete o gancho', tint: '#FF512F', icon: 'house' },
];

export function buildChunkDisplaySlots(variations: ChunkVariationEntry[]): ChunkDisplaySlot[] {
  const slots: ChunkDisplaySlot[] = variations.slice(0, 3).map((data) => ({ kind: 'variation', data }));
  while (slots.length < 3) {
    const p = PLACEHOLDER_HINTS[slots.length];
    slots.push({ kind: 'placeholder', index: slots.length, ...p });
  }
  return slots;
}

/** @deprecated Use DailyChunkState */
export type TodayChunkProgress = DailyChunkState;

/** @deprecated Use ChunkTrackerEvent */
export type ChunkProgressEvent = ChunkTrackerEvent;
