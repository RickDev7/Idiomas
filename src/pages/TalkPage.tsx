/**
 * Conversar — entrada do AI Language Coach (voice cockpit).
 * Preview visual; sessão Live real em /sessao?type=free.
 * Sem dashboard, sem cards de Simulador/Mini Prova, sem input de texto.
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BottomNav } from '@/components/layout/BottomNav';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { IconBack, IconMic } from '@/components/ui/Icons';
import { DTPage, DTAudioOrb } from '@/components/dt';
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
import { useChunkTracker } from '@/hooks/useChunkTracker';
import { SoundService } from '@/services/ui/SoundService';

export function TalkPage() {
  const { profile, loading } = useProfile();
  const navigate = useNavigate();
  const { activeChunk } = useChunkTracker();
  const [topics, setTopics] = useState<ConversationTopic[]>([]);
  const [topicsLoading, setTopicsLoading] = useState(true);
  const [starting, setStarting] = useState(false);

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
        }
      } finally {
        if (!cancelled) setTopicsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [profile]);

  if (loading || !profile) return <LoadingScreen />;

  const fallbackTopic = suggestConversationTopic(profile);
  const visibleTopics = topics.slice(0, 3);
  const previewLine =
    (activeChunk?.german || '').trim() ||
    visibleTopics[0]?.label ||
    '';

  const startFree = (topic?: ConversationTopic) => {
    if (starting) return;
    setStarting(true);
    SoundService.play('start');
    if (topic) {
      storeConversationTopicContext(toConversationContext(topic));
      navigate(`/sessao?type=free&topic=${encodeURIComponent(topic.topic)}`);
      return;
    }
    navigate(`/sessao?type=free&topic=${encodeURIComponent(fallbackTopic)}`);
  };

  return (
    <DTPage className="talk-cockpit">
      <header className="px-4 pt-3 safe-top shrink-0">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            aria-label="Voltar"
            className="w-9 h-9 rounded-full flex items-center justify-center text-white shrink-0"
            style={{ background: 'rgba(255,255,255,0.05)' }}
          >
            <IconBack size={18} />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="text-[16px] font-extrabold text-white uppercase tracking-wide font-[family-name:var(--font-display)]">
              Conversar
            </h1>
          </div>
          <span
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold text-[#67E8F9] shrink-0"
            style={{
              background: 'rgba(0,242,254,0.12)',
              border: '1px solid rgba(0,242,254,0.35)',
            }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-[#00F2FE] animate-pulse" aria-hidden />
            Live
          </span>
        </div>
      </header>

      <main className="flex-1 flex flex-col min-h-0 px-4 pb-28 pt-2 overflow-y-auto scrollbar-hide">
        {/* Professor */}
        <div className="flex flex-col items-center pt-1">
          <span
            className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-[0.12em] text-[#C4B5FD]"
            style={{
              background: 'rgba(139,92,246,0.15)',
              border: '1px solid rgba(139,92,246,0.35)',
            }}
          >
            Professor de IA
          </span>

          {previewLine ? (
            <p className="mt-3 text-center text-[22px] font-extrabold text-white leading-snug font-[family-name:var(--font-display)] max-w-[320px] px-2">
              {previewLine}
            </p>
          ) : (
            <p className="mt-3 text-center text-[14px] text-[#94A3B8] max-w-[280px]">
              Seu professor está pronto para conversar em alemão.
            </p>
          )}
        </div>

        {/* Orb dominante */}
        <div className="flex-1 flex flex-col items-center justify-center min-h-[240px] py-4 relative">
          <span className="talk-orb-halo" aria-hidden />
          <DTAudioOrb state={starting ? 'processing' : 'idle'} size={240} />
          <p
            className="mt-4 text-[12px] font-bold uppercase tracking-[0.16em]"
            style={{ color: '#A78BFA', textShadow: '0 0 12px rgba(139,92,246,0.35)' }}
          >
            {starting ? 'Conectando…' : 'Sua vez'}
          </p>
        </div>

        {/* Chips dinâmicos — máx. 3 */}
        {!topicsLoading && visibleTopics.length > 0 ? (
          <div className="flex flex-wrap justify-center gap-2 pb-3">
            {visibleTopics.map((chip) => (
              <button
                key={chip.baseId}
                type="button"
                onClick={() => startFree(chip)}
                title={chip.subtitle}
                className="shrink-0 px-3 py-1.5 rounded-full text-[11px] font-semibold text-[#E2E8F0] active:scale-95 transition-transform"
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.1)',
                }}
              >
                {chip.emoji ? `${chip.emoji} ` : ''}
                {chip.label}
              </button>
            ))}
          </div>
        ) : null}

        {/* Mic CTA */}
        <div className="flex flex-col items-center pb-2">
          <button
            type="button"
            onClick={() => startFree()}
            disabled={starting}
            aria-label="Toque para falar"
            className="talk-mic-btn relative active:scale-[0.96] transition-transform disabled:opacity-80"
          >
            <span className="talk-mic-halo" aria-hidden />
            <span className="talk-mic-core relative z-[1] w-[88px] h-[88px] rounded-full flex items-center justify-center">
              <IconMic size={34} className="text-white" />
            </span>
          </button>
          <p className="mt-2.5 text-[12px] font-bold text-white">Toque para falar</p>

          {/* Atalhos secundários — links, não cards */}
          <div className="mt-4 flex items-center gap-3 text-[11px] font-semibold">
            <button
              type="button"
              onClick={() => navigate('/simulador')}
              className="text-[#F97316]/90 hover:text-[#F97316]"
            >
              Simulador
            </button>
            <span className="text-[#334155]" aria-hidden>
              ·
            </span>
            <button
              type="button"
              onClick={() => navigate('/mini-prova')}
              className="text-[#A855F7]/90 hover:text-[#A855F7]"
            >
              Mini Prova
            </button>
          </div>
        </div>
      </main>

      <BottomNav />
    </DTPage>
  );
}
