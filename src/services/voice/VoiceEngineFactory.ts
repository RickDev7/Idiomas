import type { VoiceProvider } from '@/services/voice/voiceTypes';
import { normalizeVoiceProvider } from '@/services/voice/voiceTypes';
import { FreeVoiceEngine } from '@/services/voice/FreeVoiceEngine';
import { TextVoiceEngine } from '@/services/voice/TextVoiceEngine';
import { freeVoiceLog } from '@/services/voice/freeVoiceLog';
import type { VoiceEngine } from '@/services/voice/VoiceEngine';

export type BrowserVoiceProvider = Exclude<VoiceProvider, 'gemini-live'>;
export { isVoiceProvider, normalizeVoiceProvider } from '@/services/voice/voiceTypes';

export const VoiceEngineFactory = {
  /**
   * Cria engine de voz browser/text.
   * 'gemini-live' não instancia aqui — a sessão Live usa GeminiConversation.
   */
  create(provider: VoiceProvider): VoiceEngine {
    const id = normalizeVoiceProvider(provider);
    freeVoiceLog('factory_create', { provider: id });
    if (id === 'text') return new TextVoiceEngine();
    if (id === 'free-browser') return new FreeVoiceEngine();
    // gemini-live: engine browser como fallback para páginas que usam VoiceService
    // (ListeningPage etc.). A sessão Live não passa por aqui.
    return new FreeVoiceEngine();
  },

  createBrowser(provider: BrowserVoiceProvider): VoiceEngine {
    return this.create(provider);
  },
};
