import { PreferenceModel, type LearningMethod, type ContentType, type MethodResult } from '@/services/optimizer/PreferenceModel';
import { EventStore } from '@/services/learning/EventStore';
import { MemoryService } from '@/services/learning/MemoryService';

export interface Experiment {
  id: string;
  method: LearningMethod;
  contentType: ContentType;
  phraseIds: string[];
  startedAt: string;
  baselineConfidence: Record<string, number>;
  baselineResponseMs: number;
}

const METHODS_BY_CONTENT: Record<ContentType, LearningMethod[]> = {
  vocabulary: ['listen_repeat', 'listen_translate_repeat', 'pattern_practice'],
  pronunciation: ['shadowing', 'listen_repeat'],
  questions: ['rapid_response', 'guided_conversation'],
  listening: ['graded_listening', 'shadowing'],
  production: ['guided_conversation', 'active_recall', 'transfer_drill'],
  structures: ['pattern_practice', 'transfer_drill'],
  conversation: ['free_conversation', 'guided_conversation', 'situation_try_teach_repeat'],
};

export class LearningExperimentEngine {
  static async pickMethod(contentType: ContentType, day: number): Promise<LearningMethod> {
    const candidates = METHODS_BY_CONTENT[contentType] ?? ['listen_repeat'];
    if (day <= 7) {
      return candidates[Math.floor(Math.random() * candidates.length)];
    }
    const best = await PreferenceModel.bestMethod(contentType, 0.2);
    return best ?? candidates[0];
  }

  static async startExperiment(
    method: LearningMethod,
    contentType: ContentType,
    phraseIds: string[],
  ): Promise<Experiment> {
    const baselineConfidence: Record<string, number> = {};
    for (const id of phraseIds) {
      const c = await MemoryService.getPhraseConfidence(id);
      baselineConfidence[id] = c.confidence;
    }
    return {
      id: `exp-${Date.now()}`,
      method,
      contentType,
      phraseIds,
      startedAt: new Date().toISOString(),
      baselineConfidence,
      baselineResponseMs: 0,
    };
  }

  static async finalize(experiment: Experiment, result: Omit<MethodResult, 'method' | 'contentType' | 'timestamp'>): Promise<void> {
    await PreferenceModel.record({
      ...result,
      method: experiment.method,
      contentType: experiment.contentType,
      timestamp: new Date().toISOString(),
    });
    await EventStore.record({ type: 'SESSION_ENDED', context: `experiment:${experiment.method}` });
  }

  static methodsForContent(contentType: ContentType): LearningMethod[] {
    return METHODS_BY_CONTENT[contentType] ?? ['listen_repeat'];
  }
}
