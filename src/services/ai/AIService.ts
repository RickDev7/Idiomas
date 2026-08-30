import type { AIServiceInterface } from '@/services/ai/MockAIService';
import { MockAIService } from '@/services/ai/MockAIService';

/**
 * Factory for the tutor AI.
 * Frontend never holds API keys. Real providers must be called via a backend proxy
 * using VITE_AI_PROXY_URL (e.g. /api/ai).
 */
export type AIProvider = 'mock' | 'openai' | 'glm' | 'gemini';

export class ProxyAIService extends MockAIService {
  private endpoint: string;
  private provider: Exclude<AIProvider, 'mock'>;

  constructor(endpoint: string, provider: Exclude<AIProvider, 'mock'>) {
    super();
    this.endpoint = endpoint;
    this.provider = provider;
  }

  private async proxy(action: string, payload: unknown): Promise<unknown | null> {
    try {
      const res = await fetch(this.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: this.provider, action, payload }),
      });
      if (!res.ok) return null;
      return res.json();
    } catch {
      return null;
    }
  }

  override async continueConversation(
    context: Parameters<AIServiceInterface['continueConversation']>[0],
    userMessage: string,
  ) {
    const remote = await this.proxy('continueConversation', { context, userMessage });
    if (remote && typeof remote === 'object' && 'german' in remote) {
      return remote as Awaited<ReturnType<AIServiceInterface['continueConversation']>>;
    }
    return super.continueConversation(context, userMessage);
  }
}

let instance: AIServiceInterface | null = null;

export function createAIService(): AIServiceInterface {
  const provider = (import.meta.env.VITE_AI_PROVIDER as AIProvider | undefined) || 'mock';
  const endpoint = import.meta.env.VITE_AI_PROXY_URL as string | undefined;

  if (provider !== 'mock' && endpoint) {
    return new ProxyAIService(endpoint, provider);
  }
  return new MockAIService();
}

export function getConfiguredAIService(): AIServiceInterface {
  if (!instance) instance = createAIService();
  return instance;
}
