/**
 * Conversar — referência: orb enorme + tema + CTA grande.
 * Sessão Live em /sessao?type=free. Handlers preservados.
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BottomNav } from '@/components/layout/BottomNav';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { IconMic } from '@/components/ui/Icons';
import { DTPage } from '@/components/dt';
import { PremiumOrb } from '@/components/premium';
import { useProfile } from '@/hooks/useProfile';
import { suggestConversationTopic } from '@/services/teacher/TeacherEngine';
import { MemoryService } from '@/services/learning/MemoryService';
import { StorageService } from '@/services/storage/StorageService';
import {
  getConversationTopics,
  recordConversationTopicsShown,
  toConversationContext,
  type ConversationTopic,
} from '@/services/teacher/ConversationTopics';
import { storeConversationTopicContext } from '@/services/teacher/ConversationTopicIntent';
import { clearSelectedLearningTarget } from '@/services/teacher/LessonStartIntent';
import { useChunkTracker } from '@/hooks/useChunkTracker';
import { SoundService } from '@/services/ui/SoundService';

export function TalkPage() {
  const { profile, loading } = useProfile();
  const navigate = useNavigate();
  const { activeChunk } = useChunkTracker();
  const [topics, setTopics] = useState<ConversationTopic[]>([]);
  const [starting, setStarting] = useState(false);
  const [selected, setSelected] = useState<ConversationTopic | null>(null);

  useEffect(() => {
    if (!profile) return;
    let cancelled = false;
    void (async () => {
      try {
        const learning = await MemoryService.loadProfile(profile);
        const phrases = await StorageService.getAllPhrases();
        const dynamic = getConversationTopics(learning, phrases);
        if (!cancelled) {
          setTopics(dynamic);
          recordConversationTopicsShown(dynamic.map((t) => t.topic));
          if (dynamic[0]) setSelected(dynamic[0]);
        }
      } finally {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [profile]);

  if (loading || !profile) return <LoadingScreen />;

  const fallbackTopic = suggestConversationTopic(profile);
  const themeLine =
    selected?.label?.trim() ||
    (activeChunk?.german || '').trim() ||
    topics[0]?.label ||
    'Conversa livre';

  const startFree = (topic?: ConversationTopic) => {
    if (starting) return;
    setStarting(true);
    clearSelectedLearningTarget();
    SoundService.play('start');
    const pick = topic ?? selected ?? undefined;
    if (pick) {
      storeConversationTopicContext(toConversationContext(pick));
      navigate(`/sessao?type=free&topic=${encodeURIComponent(pick.topic)}`);
      return;
    }
    navigate(`/sessao?type=free&topic=${encodeURIComponent(fallbackTopic)}`);
  };

  return (
    <DTPage className="talk-hub">
      <header className="px-5 pt-3 safe-top shrink-0">
        <h1 className="text-[17px] font-extrabold text-center text-[var(--text-primary)] font-[family-name:var(--font-display)]">
          Conversar
        </h1>
      </header>

      <main className="flex-1 flex flex-col min-h-0 px-5 pb-28 pt-1 overflow-hidden">
        <div className="flex-1 flex flex-col items-center justify-center min-h-0">
          <PremiumOrb state={starting ? 'processing' : 'idle'} size={280} />
          <p className="mt-6 text-[11px] uppercase tracking-[0.18em] font-bold text-[var(--text-faint)]">
            Tema
          </p>
          <p className="mt-2 text-[22px] font-extrabold text-center text-[var(--text-primary)] leading-snug font-[family-name:var(--font-display)] max-w-[280px]">
            {themeLine}
          </p>
        </div>

        <div className="shrink-0 pt-4 pb-2 flex flex-col items-center gap-3">
          <button
            type="button"
            onClick={() => startFree()}
            disabled={starting}
            aria-label="Começar conversa"
            className="w-full min-h-[58px] rounded-[22px] flex items-center justify-center gap-2.5 font-extrabold text-[16px] text-[#0B0F19] active:scale-[0.98] transition-transform disabled:opacity-70"
            style={{
              background: 'linear-gradient(135deg, #00F2FE 0%, #3A7BD5 100%)',
              boxShadow: '0 0 36px rgba(0,242,254,0.42), 0 12px 28px rgba(0,0,0,0.28)',
            }}
          >
            <IconMic size={22} />
            {starting ? 'Conectando…' : 'Começar conversa'}
          </button>
          <div className="flex items-center gap-4 text-[12px] font-semibold text-[var(--text-faint)]">
            <button type="button" onClick={() => navigate('/simulador')} className="min-h-10 px-1">
              Simulador
            </button>
            <span aria-hidden>·</span>
            <button type="button" onClick={() => navigate('/mini-prova')} className="min-h-10 px-1">
              Mini Prova
            </button>
          </div>
        </div>
      </main>

      <BottomNav />
    </DTPage>
  );
}
