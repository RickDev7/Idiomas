import type { ConversationPedagogicalContext } from '@/services/teacher/ConversationTopics';

const STORAGE_KEY = 'dt_conversation_topic_intent';

export function storeConversationTopicContext(ctx: ConversationPedagogicalContext): void {
  if (typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(ctx));
  } catch {
    /* quota / private mode */
  }
}

function normalizeContext(parsed: Partial<ConversationPedagogicalContext>): ConversationPedagogicalContext | undefined {
  const id = parsed.id || (parsed as { topicId?: string }).topicId;
  const topic = parsed.topic;
  const chunk = parsed.chunk;
  if (!id || !topic) return undefined;
  return {
    id,
    topic,
    chunk,
    knownStructures: Array.isArray(parsed.knownStructures) ? parsed.knownStructures : [],
    knownVocabulary: Array.isArray(parsed.knownVocabulary) ? parsed.knownVocabulary : [],
    recentTargets: Array.isArray(parsed.recentTargets) ? parsed.recentTargets : [],
    recentVariations: Array.isArray(parsed.recentVariations) ? parsed.recentVariations : [],
    difficulty: typeof parsed.difficulty === 'string' ? parsed.difficulty : 'guided',
    reason: typeof parsed.reason === 'string' ? parsed.reason : 'selected',
    baseId: parsed.baseId,
  };
}

export function readConversationTopicContext(): ConversationPedagogicalContext | undefined {
  if (typeof sessionStorage === 'undefined') return undefined;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return undefined;
    return normalizeContext(JSON.parse(raw) as Partial<ConversationPedagogicalContext>);
  } catch {
    return undefined;
  }
}

export function clearConversationTopicContext(): void {
  if (typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
