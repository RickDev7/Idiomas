import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BottomNav } from '@/components/layout/BottomNav';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { IconBack, IconMic, IconWave, IconSparkle } from '@/components/ui/Icons';
import { LiveAudioOrb } from '@/components/ui/VoiceOrb';
import { glassStyle } from '@/components/ui/GlassCard';
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

/** Preview visual do orb — sessão real só inicia em /sessao (Gemini Live). */
type PreviewState = 'idle' | 'listening';

export function TalkPage() {
  const { profile, loading } = useProfile();
  const navigate = useNavigate();
  const [topics, setTopics] = useState<ConversationTopic[]>([]);
  const [topicsLoading, setTopicsLoading] = useState(true);
  const [previewState] = useState<PreviewState>('listening');

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
    return () => { cancelled = true; };
  }, [profile]);

  if (loading || !profile) return <LoadingScreen />;

  const fallbackTopic = suggestConversationTopic(profile);
  const startFree = (topic?: ConversationTopic) => {
    if (topic) {
      storeConversationTopicContext(toConversationContext(topic));
      navigate(`/sessao?type=free&topic=${encodeURIComponent(topic.topic)}`);
      return;
    }
    navigate(`/sessao?type=free&topic=${encodeURIComponent(fallbackTopic)}`);
  };
  const startListen = () => navigate(`/sessao?type=free&topic=${encodeURIComponent(fallbackTopic)}&mode=listen`);

  const statusLabel =
    previewState === 'listening' ? 'Zuhören…' : 'Bereit';

  return (
    <div className="flex flex-col h-full max-w-md mx-auto dt-page">
      <header className="px-5 pt-4 safe-top shrink-0 flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate(-1)}
          aria-label="Voltar"
          className="w-10 h-10 rounded-full flex items-center justify-center text-white shrink-0"
          style={glassStyle}
        >
          <IconBack size={18} />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="text-[17px] font-bold text-white leading-tight font-[family-name:var(--font-display)]">
            Conversar
          </h1>
          <p className="text-[12px] text-[#CBD5E1] mt-0.5 truncate">Fale com seu professor de IA</p>
        </div>
        <span
          className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold text-white"
          style={{
            background: 'linear-gradient(135deg, rgba(0,242,254,0.28), rgba(168,85,247,0.28))',
            border: '1px solid rgba(168,85,247,0.45)',
            boxShadow: '0 0 18px rgba(139,92,246,0.35)',
          }}
        >
          <IconSparkle size={13} /> Gemini Live
        </span>
      </header>

      <main className="flex-1 overflow-y-auto scrollbar-hide px-5 pt-4 pb-28 flex flex-col">
        <div className="rounded-[20px] px-4 py-3.5 max-w-[94%]" style={glassStyle}>
          <span
            className="inline-flex px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide mb-1.5"
            style={{ background: 'rgba(139,92,246,0.28)', color: '#c4b5fd' }}
          >
            Professor de IA
          </span>
          <p className="text-[14px] text-white leading-snug">
            Vamos usar o que você aprendeu! O que você gostaria de dizer?
          </p>
        </div>

        <button
          type="button"
          onClick={() => navigate('/simulador')}
          className="mt-4 w-full rounded-[20px] px-4 py-4 text-left active:scale-[0.98] transition-transform"
          style={{
            ...glassStyle,
            border: '1px solid rgba(249,115,22,0.45)',
            boxShadow: '0 0 18px rgba(249,115,22,0.15)',
          }}
        >
          <p className="text-[14px] font-bold text-white">SIMULATOR</p>
          <p className="text-[12px] text-[#94A3B8] mt-1">
            Sprich so viel Deutsch wie möglich — ohne Druck
          </p>
        </button>

        <button
          type="button"
          onClick={() => navigate('/mini-prova')}
          className="mt-2 w-full rounded-[20px] px-4 py-4 text-left active:scale-[0.98] transition-transform"
          style={{
            ...glassStyle,
            border: '1px solid rgba(168,85,247,0.45)',
            boxShadow: '0 0 18px rgba(168,85,247,0.15)',
          }}
        >
          <p className="text-[14px] font-bold text-white">MINI-PRÜFUNG</p>
          <p className="text-[12px] text-[#94A3B8] mt-1">
            Was kannst du schon auf Deutsch?
          </p>
        </button>

        <div className="flex-1 flex flex-col items-center justify-center py-5 min-h-[240px]">
          <LiveAudioOrb state={previewState} size={220} />
          <p
            className="mt-4 text-[14px] font-semibold tracking-wide"
            style={{ color: '#00F2FE', textShadow: '0 0 12px rgba(0,242,254,0.45)' }}
          >
            {statusLabel}
          </p>
          <p className="mt-1 text-[11px] text-[#64748B] text-center px-6">
            Estados ao vivo: Zuhören · Professor spricht · Du sprichst
          </p>
        </div>

        {!topicsLoading && topics.length > 0 ? (
          <div className="grid grid-cols-3 gap-2">
            {topics.map((chip) => (
              <button
                key={chip.baseId}
                type="button"
                onClick={() => startFree(chip)}
                title={chip.subtitle}
                className="px-2 py-2.5 rounded-full text-[11px] font-semibold text-white active:scale-95 transition-transform"
                style={{
                  ...glassStyle,
                  border: '1px solid rgba(0,242,254,0.28)',
                }}
              >
                <span className="block truncate leading-tight">{chip.label}</span>
                {chip.subtitle ? (
                  <span className="block truncate text-[9px] font-medium text-[#94A3B8] mt-0.5 leading-tight">
                    {chip.emoji ? `${chip.emoji} ` : ''}{chip.subtitle}
                  </span>
                ) : null}
              </button>
            ))}
          </div>
        ) : null}

        <div className="mt-7 flex items-end justify-center gap-10 px-1">
          <button
            type="button"
            onClick={() => startFree()}
            className="flex flex-col items-center gap-2 active:scale-[0.97] transition-transform"
            aria-label="Começar conversa"
          >
            <span
              className="w-[84px] h-[84px] rounded-full flex items-center justify-center text-white"
              style={{
                background: 'linear-gradient(145deg, #00F2FE, #22D3EE)',
                boxShadow:
                  '0 0 0 6px rgba(0,242,254,0.18), 0 0 40px rgba(0,242,254,0.55), 0 10px 28px rgba(0,242,254,0.35)',
              }}
            >
              <IconMic size={32} className="text-[#050816]" />
            </span>
            <span className="text-[11px] font-bold text-white">Começar conversa</span>
          </button>

          <button
            type="button"
            onClick={startListen}
            className="flex flex-col items-center gap-1.5 w-[78px] text-[#94A3B8] active:scale-95 transition-transform"
          >
            <span className="w-12 h-12 rounded-full flex items-center justify-center" style={glassStyle}>
              <IconWave size={20} />
            </span>
            <span className="text-[10px] font-semibold text-center leading-tight">Somente ouvir</span>
          </button>
        </div>
      </main>
      <BottomNav />
    </div>
  );
}
