/**
 * Mini Prova — redesign visual Fase 2.
 * Launch premium; perguntas reais via MiniProvaEngine → sessão Live.
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BottomNav } from '@/components/layout/BottomNav';
import { GlassCard, glassStyle } from '@/components/ui/GlassCard';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { IconBack, IconMic } from '@/components/ui/Icons';
import { useProfile } from '@/hooks/useProfile';
import { MemoryService } from '@/services/learning/MemoryService';
import { StorageService } from '@/services/storage/StorageService';
import { buildMiniProvaContext } from '@/services/teacher/MiniProvaEngine';
import { storeMiniProvaContext } from '@/services/teacher/MiniProvaIntent';
import type { MiniProvaQuestion } from '@/services/teacher/MiniProvaTypes';

export function MiniProvaPage() {
  const { profile, loading } = useProfile();
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [questions, setQuestions] = useState<MiniProvaQuestion[]>([]);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    if (!profile) return;
    void (async () => {
      const learning = await MemoryService.loadProfile(profile);
      const phrases = await StorageService.getAllPhrases();
      const ctx = buildMiniProvaContext(learning, phrases);
      setQuestions(ctx?.questions ?? []);
      setReady(true);
    })();
  }, [profile]);

  if (loading || !profile || !ready) return <LoadingScreen />;

  const startExam = async () => {
    if (starting) return;
    setStarting(true);
    try {
      const learning = await MemoryService.loadProfile(profile);
      const phrases = await StorageService.getAllPhrases();
      const ctx = buildMiniProvaContext(learning, phrases);
      if (!ctx) {
        setStarting(false);
        return;
      }
      storeMiniProvaContext(ctx);
      navigate('/sessao?type=miniprova');
    } finally {
      setStarting(false);
    }
  };

  const firstPrompt = questions[0]?.promptDe?.trim() || null;
  const total = questions.length;
  const readyEnough = total >= 3;

  return (
    <div className="flex flex-col h-full max-w-md mx-auto dt-page">
      <header className="px-5 pt-4 safe-top shrink-0 flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate(-1)}
          aria-label="Zurück"
          className="w-10 h-10 rounded-full flex items-center justify-center text-white shrink-0"
          style={glassStyle}
        >
          <IconBack size={18} />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="text-[18px] font-bold text-white font-[family-name:var(--font-display)]">
            MINI-PRÜFUNG
          </h1>
          <p className="text-[12px] text-[#CBD5E1]">Was kannst du schon auf Deutsch?</p>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto scrollbar-hide px-5 pt-4 pb-28 space-y-5">
        {!readyEnough ? (
          <GlassCard className="p-5 text-center">
            <p className="text-[14px] text-[#CBD5E1] leading-relaxed">
              Noch nicht genug Inhalte für eine Mini-Prüfung. Lerne zuerst mehr Lektionen.
            </p>
            <button
              type="button"
              onClick={() => navigate('/aprender')}
              className="mt-4 px-5 py-2.5 rounded-full text-[13px] font-bold text-white"
              style={{ background: 'linear-gradient(135deg, #8B5CF6, #00F2FE)' }}
            >
              Ir para Aprender
            </button>
          </GlassCard>
        ) : (
          <>
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="dt-label">Progresso da prova</p>
                <p className="text-[12px] font-semibold text-[#CBD5E1] tabular-nums">
                  0 / {total}
                </p>
              </div>
              <div
                className="h-[6px] rounded-full overflow-hidden"
                style={{ background: 'rgba(255,255,255,0.08)' }}
                role="progressbar"
                aria-valuenow={0}
                aria-valuemin={0}
                aria-valuemax={total}
              >
                <div
                  className="h-full rounded-full"
                  style={{
                    width: '4%',
                    background: 'linear-gradient(90deg, #8B5CF6, #00F2FE)',
                    boxShadow: '0 0 12px rgba(139,92,246,0.45)',
                  }}
                />
              </div>
            </div>

            <GlassCard variant="violet" className="p-6 text-center relative overflow-hidden">
              <span
                className="absolute -top-16 left-1/2 -translate-x-1/2 w-48 h-48 rounded-full pointer-events-none"
                style={{ background: 'radial-gradient(circle, rgba(139,92,246,0.35), transparent 70%)' }}
              />
              <p className="dt-label relative">Erste Frage</p>
              <p className="relative mt-4 text-[24px] font-bold text-white leading-snug font-[family-name:var(--font-display)]">
                {firstPrompt || '—'}
              </p>
              <p className="relative mt-3 text-[12px] text-[#64748B]">
                Keine Übersetzung · keine vorzeitige Antwort · nur gelerntes Material
              </p>
            </GlassCard>

            <div className="flex flex-col items-center gap-3 py-2">
              <span
                className="w-[88px] h-[88px] rounded-full flex items-center justify-center text-white"
                style={{
                  background: 'linear-gradient(145deg, #A855F7, #8B5CF6)',
                  boxShadow: '0 0 0 6px rgba(139,92,246,0.2), 0 0 40px rgba(139,92,246,0.5)',
                }}
                aria-hidden
              >
                <IconMic size={34} />
              </span>
              <p className="text-[13px] text-[#CBD5E1]">Voice-first · Immersion Deutsch</p>
            </div>

            <GlassCard className="p-4">
              <ul className="text-[12px] text-[#94A3B8] space-y-1.5">
                <li>· Verstehen und Sprechen</li>
                <li>· Nur gelernte Inhalte ({total} Fragen)</li>
                <li>· Keine Hilfe während der Prüfung</li>
              </ul>
            </GlassCard>

            <button
              type="button"
              disabled={starting}
              onClick={() => void startExam()}
              className="w-full py-4 rounded-[20px] text-[15px] font-bold text-white disabled:opacity-60 active:scale-[0.98] transition-transform duration-200"
              style={{
                background: 'linear-gradient(135deg, #8B5CF6 0%, #EC4899 55%, #F97316 100%)',
                boxShadow: '0 0 28px rgba(139,92,246,0.4)',
              }}
            >
              {starting ? 'Vorbereiten…' : 'Antworten'}
            </button>
          </>
        )}
      </main>
      <BottomNav />
    </div>
  );
}
