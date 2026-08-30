import { MockAIService } from '@/services/ai/MockAIService';
import { resolveBackendUrl, httpBackendBase } from '@/utils/backendUrl';

/**
 * GeminiAIService — tarefas de texto/planejamento/análise (não realtime).
 * A conversa por voz em tempo real é feita pelo GeminiLiveService.
 * Aqui usamos o backend proxy para funções estruturadas.
 */
export class GeminiAIService extends MockAIService {
  private backendUrl: string;

  constructor(backendUrl?: string) {
    super();
    this.backendUrl = resolveBackendUrl(backendUrl);
  }

  private async proxy(action: string, payload: unknown): Promise<any | null> {
    try {
      const res = await fetch(`${httpBackendBase(this.backendUrl)}/api/gemini/text`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, payload }),
      });
      if (!res.ok) return null;
      return res.json();
    } catch {
      return null;
    }
  }

  async call(action: string, payload: unknown): Promise<any | null> {
    return this.proxy(action, payload);
  }
}
