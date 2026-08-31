import type { CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { BottomNav } from '@/components/layout/BottomNav';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { IconBack, IconMic, IconKeyboard, IconWave, IconSparkle } from '@/components/ui/Icons';
import { LiveAudioOrb } from '@/components/ui/VoiceOrb';
import { useProfile } from '@/hooks/useProfile';
import { suggestConversationTopic } from '@/services/teacher/TeacherEngine';

const GLASS: CSSProperties = {
  background: 'rgba(15, 23, 42, 0.65)',
  border: '1px solid rgba(255, 255, 255, 0.08)',
  backdropFilter: 'blur(16px)',
  WebkitBackdropFilter: 'blur(16px)',
};

const SUPPORT_CHIPS = [
  'Ich möchte...',
  'Ich brauche...',
  'Ich muss...',
  'Kannst du...?',
  'Ich arbeite...',
  'Wo...?',
];

export function TalkPage() {
  const { profile, loading } = useProfile();
  const navigate = useNavigate();

  if (loading || !profile) return <LoadingScreen />;

  const topic = suggestConversationTopic(profile);
  const startFree = (t?: string) => navigate(`/sessao?type=free&topic=${encodeURIComponent(t ?? topic)}`);
  const startListen = () => navigate(`/sessao?type=free&topic=${encodeURIComponent(topic)}&mode=listen`);

  return (
    <div className="flex flex-col h-full max-w-md mx-auto" style={{ background: '#070A12' }}>
      <header className="px-5 pt-4 safe-top shrink-0 flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate(-1)}
          aria-label="Voltar"
          className="w-10 h-10 rounded-full flex items-center justify-center text-white shrink-0"
          style={GLASS}
        >
          <IconBack size={18} />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="text-[17px] font-bold text-white leading-tight font-[family-name:var(--font-display)]">
            CONVERSAR
          </h1>
          <p className="text-[12px] text-[#94A3B8] mt-0.5 truncate">Fale com seu professor de IA</p>
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
        <div className="rounded-[20px] px-4 py-3.5 max-w-[94%]" style={GLASS}>
          <span
            className="inline-flex px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide mb-1.5"
            style={{ background: 'rgba(59,130,246,0.28)', color: '#93c5fd' }}
          >
            Professor de IA
          </span>
          <p className="text-[14px] text-white leading-snug">
            Vamos usar o que você aprendeu! O que você gostaria de dizer?
          </p>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center py-5 min-h-[240px]">
          <LiveAudioOrb state="listening" size={220} />
          <p className="mt-4 text-[14px] font-semibold tracking-wide" style={{ color: '#00F2FE', textShadow: '0 0 12px rgba(0,242,254,0.45)' }}>
            Ouvindo você...
          </p>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {SUPPORT_CHIPS.map((chip) => (
            <button
              key={chip}
              type="button"
              onClick={() => startFree(chip)}
              className="px-2 py-2.5 rounded-full text-[11px] font-semibold text-white active:scale-95 transition-transform truncate"
              style={{
                ...GLASS,
                border: '1px solid rgba(0,242,254,0.28)',
              }}
            >
              {chip}
            </button>
          ))}
        </div>

        <div className="mt-7 flex items-end justify-between gap-2 px-1">
          <button
            type="button"
            onClick={() => startFree()}
            className="flex flex-col items-center gap-1.5 w-[78px] text-[#94A3B8] active:scale-95 transition-transform"
          >
            <span className="w-12 h-12 rounded-full flex items-center justify-center" style={GLASS}>
              <IconKeyboard size={20} />
            </span>
            <span className="text-[10px] font-semibold">Digitar</span>
          </button>

          <button
            type="button"
            onClick={() => startFree()}
            className="flex flex-col items-center gap-2 active:scale-[0.97] transition-transform"
            aria-label="Começar conversa"
          >
            <span
              className="w-[84px] h-[84px] rounded-full flex items-center justify-center text-white"
              style={{
                background: '#00F2FE',
                boxShadow: '0 0 0 6px rgba(0,242,254,0.18), 0 0 40px rgba(0,242,254,0.55), 0 10px 28px rgba(0,242,254,0.35)',
              }}
            >
              <IconMic size={32} className="text-[#070A12]" />
            </span>
            <span className="text-[11px] font-bold text-white">Começar conversa</span>
          </button>

          <button
            type="button"
            onClick={startListen}
            className="flex flex-col items-center gap-1.5 w-[78px] text-[#94A3B8] active:scale-95 transition-transform"
          >
            <span className="w-12 h-12 rounded-full flex items-center justify-center" style={GLASS}>
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
