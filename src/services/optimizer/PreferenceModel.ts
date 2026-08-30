export type LearningMethod =
  | 'listen_repeat'
  | 'listen_translate_repeat'
  | 'shadowing'
  | 'situation_try_teach_repeat'
  | 'rapid_response'
  | 'guided_conversation'
  | 'free_conversation'
  | 'pattern_practice'
  | 'graded_listening'
  | 'active_recall'
  | 'transfer_drill';

export type ContentType =
  | 'vocabulary'
  | 'pronunciation'
  | 'questions'
  | 'listening'
  | 'production'
  | 'structures'
  | 'conversation';

export interface MethodResult {
  method: LearningMethod;
  contentType: ContentType;
  gain: number;
  minutes: number;
  retention1d: number | null;
  retention3d: number | null;
  retention7d: number | null;
  transfer: number;
  spontaneous: number;
  helpUsed: number;
  timestamp: string;
}

export interface PreferenceEntry {
  method: LearningMethod;
  contentType: ContentType;
  score: number;
  sampleCount: number;
  confidence: number;
  lastUpdated: string;
}

const KEY = 'learning-preferences';

export class PreferenceModel {
  private static cache: Record<string, PreferenceEntry> | null = null;

  static async load(): Promise<Record<string, PreferenceEntry>> {
    if (this.cache) return this.cache;
    try {
      const raw = localStorage.getItem(KEY);
      this.cache = raw ? (JSON.parse(raw) as Record<string, PreferenceEntry>) : {};
    } catch {
      this.cache = {};
    }
    return this.cache;
  }

  static async save(map: Record<string, PreferenceEntry>): Promise<void> {
    this.cache = map;
    try {
      localStorage.setItem(KEY, JSON.stringify(map));
    } catch {
      /* ignore */
    }
  }

  static key(method: LearningMethod, contentType: ContentType): string {
    return `${method}:${contentType}`;
  }

  static async record(result: MethodResult): Promise<PreferenceEntry> {
    const map = await this.load();
    const k = this.key(result.method, result.contentType);
    const existing = map[k];
    const sampleCount = (existing?.sampleCount ?? 0) + 1;
    const efficiency = result.minutes > 0 ? result.gain / result.minutes : 0;
    const retention = result.retention1d ?? 1;
    const composite = 0.4 * efficiency + 0.3 * retention + 0.2 * (result.transfer + result.spontaneous) / 2 + 0.1 * (1 - Math.min(1, result.helpUsed / 3));
    const score = existing
      ? existing.score * (existing.sampleCount / sampleCount) + composite * (1 / sampleCount)
      : composite;
    const confidence = Math.min(1, sampleCount / 10);
    const entry: PreferenceEntry = {
      method: result.method,
      contentType: result.contentType,
      score: Math.max(0, Math.min(1, score)),
      sampleCount,
      confidence,
      lastUpdated: new Date().toISOString(),
    };
    map[k] = entry;
    await this.save(map);
    return entry;
  }

  static async bestMethod(contentType: ContentType, explore = 0.15): Promise<LearningMethod | null> {
    const map = await this.load();
    const entries = Object.values(map).filter((e) => e.contentType === contentType);
    if (entries.length === 0) return null;
    if (Math.random() < explore) {
      return entries[Math.floor(Math.random() * entries.length)].method;
    }
    entries.sort((a, b) => b.score * b.confidence - a.score * a.confidence);
    return entries[0].method;
  }

  static async all(): Promise<PreferenceEntry[]> {
    const map = await this.load();
    return Object.values(map);
  }
}
