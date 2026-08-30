import { StorageService } from '@/services/storage/StorageService';
import type { UserProfile } from '@/types';
import {
  buildLearningProfile,
  emptyConfidence,
  updateConfidence,
  type PhraseConfidence,
  type UserLearningProfile,
} from '@/services/learning/ConfidenceService';
import { persistAutomationScore } from '@/services/learning/AutomationScoreEngine';
import { detectBottleneck } from '@/services/learning/BottleneckDetector';
import {
  completeSession as persistCompletedSession,
  getLastSession,
  getLearningContextSnapshot,
  type EndSessionInput,
} from '@/services/teacher/sessionContinuity';

const STORE_KEY = 'learning-profile';

export class MemoryService {
  static async loadProfile(user: UserProfile): Promise<UserLearningProfile> {
    const words = await StorageService.getAllWords();
    const mistakes = await StorageService.getAllMistakes();
    const progress = await StorageService.getProgress();
    const stored = await this.loadConfidenceMap();
    const profile = buildLearningProfile(user, words, mistakes, progress ?? null, stored);
    profile.bottleneck = detectBottleneck(profile)?.type ?? null;
    return profile;
  }

  static async loadConfidenceMap(): Promise<Record<string, PhraseConfidence>> {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      return raw ? (JSON.parse(raw) as Record<string, PhraseConfidence>) : {};
    } catch {
      return {};
    }
  }

  static async saveConfidenceMap(map: Record<string, PhraseConfidence>): Promise<void> {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(map));
    } catch {
      /* ignore quota */
    }
  }

  static async recordEvent(
    phraseId: string,
    event: Parameters<typeof updateConfidence>[1],
    sessionId?: string,
  ): Promise<PhraseConfidence> {
    const map = await this.loadConfidenceMap();
    const current = map[phraseId] ?? emptyConfidence(phraseId);
    const updated = persistAutomationScore(updateConfidence(current, event), undefined, {
      sessionId,
      evidence: event.type,
    });
    const now = new Date().toISOString();
    if (event.type === 'produced' && event.correct && !event.withHelp) {
      updated.lastIndependentUse = now;
    }
    if (event.type === 'transfer' && event.correct) updated.lastTransfer = now;
    if (event.type === 'spontaneous' && event.correct) updated.lastSpontaneous = now;
    map[phraseId] = updated;
    await this.saveConfidenceMap(map);
    return updated;
  }

  static async recordReviewResult(
    phraseId: string,
    result: import('@/services/learning/ReviewEngine').ReviewResultKind,
    opts: {
      reviewType: import('@/services/learning/ReviewEngine').ReviewType;
      helpLevel?: number;
      responseMs?: number;
      sessionId?: string;
    },
  ): Promise<PhraseConfidence> {
    const { applyReviewResult } = await import('@/services/learning/ReviewEngine');
    const map = await this.loadConfidenceMap();
    const current = map[phraseId] ?? emptyConfidence(phraseId);
    const updated = applyReviewResult(current, result, opts);
    map[phraseId] = updated;
    await this.saveConfidenceMap(map);
    return updated;
  }

  /** Garante AutomationScore persistido em todo o mapa. */
  static async ensureAutomationScores(): Promise<Record<string, PhraseConfidence>> {
    const map = await this.loadConfidenceMap();
    let dirty = false;
    for (const id of Object.keys(map)) {
      const c = map[id];
      if (typeof c.automationScore !== 'number') {
        map[id] = persistAutomationScore(c);
        dirty = true;
      } else if (!c.lastAutomationUpdate && c.automationUpdatedAt) {
        map[id] = { ...c, lastAutomationUpdate: c.automationUpdatedAt };
        dirty = true;
      } else if (!c.automationHistory) {
        map[id] = {
          ...c,
          lastAutomationUpdate: c.lastAutomationUpdate || c.automationUpdatedAt || new Date().toISOString(),
          automationHistory: [
            {
              score: c.automationScore,
              date: c.lastAutomationUpdate || c.automationUpdatedAt || new Date().toISOString(),
              evidence: 'migration',
            },
          ],
        };
        dirty = true;
      }
    }
    if (dirty) await this.saveConfidenceMap(map);
    return map;
  }

  static async getPhraseConfidence(phraseId: string): Promise<PhraseConfidence> {
    const map = await this.loadConfidenceMap();
    return map[phraseId] ?? emptyConfidence(phraseId);
  }

  /** Fase 1A — produções livres (ex.: Cuxhaven) sem inventário. */
  static recordUnclassifiedUtterance(entry: {
    text: string;
    sessionId: string;
    topic?: string;
    lastTeacher?: string;
    timestamp?: string;
  }): void {
    const KEY = 'deutsch-turbo:unclassified-utterances:v1';
    try {
      const raw = localStorage.getItem(KEY);
      const list: Array<typeof entry & { timestamp: string }> = raw ? JSON.parse(raw) : [];
      list.push({ ...entry, timestamp: entry.timestamp || new Date().toISOString() });
      while (list.length > 200) list.shift();
      localStorage.setItem(KEY, JSON.stringify(list));
    } catch { /* ignore */ }
  }

  static loadUnclassifiedUtterances(): Array<{
    text: string;
    sessionId: string;
    topic?: string;
    lastTeacher?: string;
    timestamp: string;
  }> {
    try {
      const raw = localStorage.getItem('deutsch-turbo:unclassified-utterances:v1');
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  static getLastSession() {
    return getLastSession();
  }

  static getLearningContext() {
    return getLearningContextSnapshot();
  }

  static completeSession(input: EndSessionInput = {}) {
    return persistCompletedSession(input);
  }
}

export type { PhraseConfidence, UserLearningProfile };
export { detectBottleneck };
