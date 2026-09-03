/**
 * Mini Prova — Avaliação de performance (DT).
 * Visual: pergunta protagonista + áudio/orb + mic dominante.
 * Dados: pergunta e contagem reais via buildMiniProvaContext().
 * Sem tradução durante a prova (apenas a pergunta em alemão).
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BottomNav } from '@/components/layout/BottomNav';
import { DTPage, DTMain, DTAudioOrb, type OrbState } from '@/components/dt';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { IconBack, IconMic } from '@/components/ui/Icons';
import { useProfile } from '@/hooks/useProfile';
import { MemoryService } from '@/services/learning/MemoryService';
import { StorageService } from '@/services/storage/StorageService';
import { buildMiniProvaContext, buildMiniProvaQuestions } from '@/services/teacher/MiniProvaEngine';
import { storeMiniProvaContext } from '@/services/teacher/MiniProvaIntent';
import type { MiniProvaContext } from '@/services/teacher/MiniProvaTypes';

export function MiniProvaPage() {
  const { profile, loading } = useProfile();
  const navigate = useNavigate();

  const [ready, setReady] = useState(false);
  const [ctx, setCtx] = useState<MiniProvaContext | null>(null);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    if (!profile) return;
    let cancelled = false;
    void (async () => {
      const learning = await MemoryService.loadProfile(profile);
      const phrases = await StorageService.getAllPhrases();
      const built = buildMiniProvaContext(learning, phrases);
      let nextCtx: MiniProvaContext | null = built;
      if (!nextCtx) {
        // buildMiniProvaContext() pode retornar null quando há poucas perguntas.
        // Para evitar "empty state" visual quando existe ao menos 1 pergunta,
        // reaproveitamos a lista real via buildMiniProvaQuestions().
        const questions = buildMiniProvaQuestions(learning, phrases);
        if (questions.length > 0) {
          nextCtx = {
            id: `miniprova-${Date.now()}`,
            questions,
            startedAt: new Date().toISOString(),
          };
        }
      }
      if (cancelled) return;
      setCtx(nextCtx);
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [profile]);

  if (loading || !profile || !ready) return <LoadingScreen />;

  const total = ctx?.questions?.length ?? 0;
  const firstPrompt = ctx?.questions?.[0]?.promptDe?.trim() || null;
  const canShowQuestion = total > 0 && !!firstPrompt;
  const displayQuestion = canShowQuestion ? firstPrompt : '—';

  const orbState: OrbState = starting ? 'processing' : 'idle';
  const micLabel = starting ? 'Preparando…' : 'Sua vez';
  const progressPct = total > 0 ? (1 / total) * 100 : 0;

  const startExam = async () => {
    if (starting) return;
    if (!ctx || ctx.questions.length === 0) return;
    setStarting(true);
    try {
      storeMiniProvaContext(ctx);
      navigate('/sessao?type=miniprova');
    } finally {
      setStarting(false);
    }
  };

  const disabledChip = total === 0 || starting;
  const headerCounter = total > 0 ? `1 / ${total}` : '—';

  return (
    <DTPage className="mini-prova-page">
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
              MINI PROVA
            </h1>
            <p className="text-[11px] text-[#94A3B8] mt-0.5">Avaliação</p>
          </div>

          <span
            className="text-[12px] font-bold text-[#C4B5FD] tabular-nums shrink-0"
            style={{ textShadow: '0 0 12px rgba(139,92,246,0.35)' }}
          >
            {headerCounter}
          </span>
        </div>

        {total > 0 ? (
          <div className="mt-3 mini-prova-progress-line" aria-hidden>
            <div className="mini-prova-progress-fill" style={{ width: `${Math.max(6, progressPct)}%` }} />
          </div>
        ) : null}
      </header>

      <DTMain withNav={false} className="pt-4 px-4">
        <div className="mini-prova-cockpit flex flex-col min-h-[520px]">
          <section className="mini-prova-question">
            <p className="mini-prova-label">Pergunta</p>
            <h2 className="mini-prova-question-text">{displayQuestion}</h2>
          </section>

          <section className="mini-prova-audio">
            <DTAudioOrb state={orbState} size={180} />
          </section>

          <section className="mini-prova-mic">
            <button
              type="button"
              onClick={() => void startExam()}
              disabled={starting || disabledChip}
              aria-label={micLabel}
              className="mini-prova-mic-btn relative active:scale-[0.98] transition-transform disabled:opacity-70"
            >
              <span
                className={`mini-prova-mic-halo ${starting ? 'mini-prova-mic-halo--busy' : ''}`}
                aria-hidden
              />
              <span className="mini-prova-mic-core relative z-[1] rounded-full flex items-center justify-center">
                <IconMic size={40} />
              </span>
            </button>
            <p className="mini-prova-mic-text">{micLabel}</p>
            <p className="mini-prova-mic-hint">Toque para responder</p>
          </section>

          <section className="mini-prova-actions" aria-label="Ações secundárias">
            <button
              type="button"
              disabled={disabledChip}
              className="mini-prova-chip"
              onClick={() => void startExam()}
            >
              Não sei
            </button>
            <button
              type="button"
              disabled={disabledChip}
              className="mini-prova-chip mini-prova-chip--violet"
              onClick={() => void startExam()}
            >
              Repetir
            </button>
            <button
              type="button"
              disabled={disabledChip}
              className="mini-prova-chip mini-prova-chip--cyan"
              onClick={() => void startExam()}
            >
              Ajuda
            </button>
          </section>
        </div>
      </DTMain>

      <BottomNav />
    </DTPage>
  );
}
