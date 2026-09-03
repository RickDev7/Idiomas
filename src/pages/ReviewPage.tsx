/**
 * Revisão — sessão de treino ativo (Training Cockpit).
 * Fila única: getDueReviews → beginReviewSessionFromQueue.
 * Visual only — ReviewEngine / ReviewSession intactos.
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BottomNav } from '@/components/layout/BottomNav';
import { IconBack, IconMic, IconPlay } from '@/components/ui/Icons';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import {
  DTPage,
  ProgressRing,
  DTProgressBar,
  DTNeonButton,
} from '@/components/dt';
import {
  beginReviewSessionFromQueue,
  getDueReviews,
} from '@/services/learning/ReviewRepository';
import {
  REVIEW_TYPE_COLORS,
  REVIEW_TYPE_LABELS,
  type ReviewQueueItem,
} from '@/services/learning/ReviewEngine';

function itemCategory(item: ReviewQueueItem): 'Pergunta' | 'Frase' | 'Estrutura' | 'Vocabulário' {
  const g = (item.german || '').trim();
  if (g.endsWith('?')) return 'Pergunta';
  if (g.includes('...') || g.includes('…')) return 'Estrutura';
  const words = g.split(/\s+/).filter(Boolean);
  if (words.length <= 2 && !/[.!?]$/.test(g)) return 'Vocabulário';
  if (words.length <= 4) return 'Frase';
  return 'Estrutura';
}

export function ReviewPage() {
  const navigate = useNavigate();
  const [queue, setQueue] = useState<ReviewQueueItem[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    void getDueReviews(12)
      .then((q) => {
        if (!cancelled) setQueue(q);
      })
      .catch(() => {
        if (!cancelled) setQueue([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (queue === null) return <LoadingScreen />;

  const startReview = () => {
    if (queue.length > 0) {
      beginReviewSessionFromQueue(queue);
    }
    navigate('/sessao?type=review');
  };

  const total = queue.length;
  const current = queue[0] ?? null;
  const next = queue[1] ?? null;
  const peek = queue[2] ?? null;
  const tint = current ? REVIEW_TYPE_COLORS[current.reviewType] || '#8B5CF6' : '#8B5CF6';
  const auto =
    current && typeof current.automationScore === 'number' && Number.isFinite(current.automationScore)
      ? Math.round(current.automationScore)
      : null;
  const sessionPct = total > 0 ? (1 / total) * 100 : 0;

  return (
    <DTPage className="review-cockpit">
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
              Revisão
            </h1>
            <p className="text-[11px] text-[#94A3B8] mt-0.5">Reforce o que você já aprendeu</p>
          </div>
          {total > 0 ? (
            <span className="text-[12px] font-bold text-[#C4B5FD] tabular-nums shrink-0">
              1 / {total}
            </span>
          ) : null}
        </div>

        {total > 0 ? (
          <div
            className="mt-3 h-[3px] rounded-full overflow-hidden"
            style={{ background: 'rgba(255,255,255,0.08)' }}
            aria-hidden
          >
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${Math.max(6, sessionPct)}%`,
                background: 'linear-gradient(90deg, #8B5CF6, #00F2FE)',
                boxShadow: '0 0 10px rgba(0,242,254,0.4)',
              }}
            />
          </div>
        ) : null}
      </header>

      <main className="flex-1 flex flex-col min-h-0 px-4 pb-28 pt-3 overflow-y-auto scrollbar-hide">
        {total === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-4">
            <p className="text-[15px] text-[#CBD5E1] leading-snug max-w-[280px]">
              Nenhum item na fila. Pratique uma sessão e volte depois.
            </p>
            <div className="mt-5 w-full max-w-[260px]">
              <DTNeonButton onClick={() => navigate('/aprender')}>Ir para Aprender</DTNeonButton>
            </div>
          </div>
        ) : (
          <>
            {/* Hero de quantidade */}
            <section className="flex items-center gap-4 mb-4">
              <div style={{ filter: 'drop-shadow(0 0 14px rgba(139,92,246,0.4))' }}>
                <ProgressRing
                  value={total}
                  max={Math.max(total, 12)}
                  size={88}
                  stroke={8}
                  label={String(total)}
                  sublabel="itens"
                  color="#8B5CF6"
                  color2="#00F2FE"
                />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#64748B]">
                  Você tem
                </p>
                <p className="mt-1 text-[28px] font-extrabold text-white tabular-nums leading-none font-[family-name:var(--font-display)]">
                  {total}
                </p>
                <p className="mt-1 text-[13px] text-[#94A3B8]">
                  {total === 1 ? 'item para revisar' : 'itens para revisar'}
                </p>
              </div>
            </section>

            {/* Stack */}
            <section className="review-stack relative mx-auto w-full max-w-[340px]" aria-label="Fila de revisão">
              {peek ? (
                <div className="review-stack-layer review-stack-layer--3" aria-hidden>
                  <p className="text-[12px] font-semibold text-white/50 truncate px-4">
                    {peek.german || peek.phraseId}
                  </p>
                </div>
              ) : null}
              {next ? (
                <div className="review-stack-layer review-stack-layer--2" aria-hidden>
                  <p className="text-[13px] font-semibold text-white/70 truncate px-4">
                    {next.german || next.phraseId}
                  </p>
                </div>
              ) : null}

              <article
                className="review-stack-layer review-stack-layer--1 relative overflow-hidden"
                style={{
                  borderColor: `${tint}55`,
                  boxShadow: `0 16px 40px rgba(0,0,0,0.35), 0 0 28px ${tint}22`,
                }}
              >
                <span
                  className="absolute -bottom-10 left-1/2 -translate-x-1/2 w-56 h-28 rounded-full pointer-events-none"
                  style={{
                    background: `radial-gradient(ellipse, ${tint}33 0%, transparent 70%)`,
                  }}
                  aria-hidden
                />

                <div className="relative flex items-center justify-between gap-2 mb-3">
                  <span
                    className="text-[10px] font-bold uppercase tracking-[0.14em] px-2.5 py-1 rounded-full"
                    style={{ background: `${tint}22`, color: tint }}
                  >
                    {itemCategory(current!)}
                  </span>
                  <span className="text-[10px] font-semibold text-[#64748B] truncate">
                    {REVIEW_TYPE_LABELS[current!.reviewType] || current!.reviewType}
                  </span>
                </div>

                <h2 className="relative text-[28px] font-extrabold text-white leading-tight font-[family-name:var(--font-display)] tracking-tight">
                  {current!.german || current!.phraseId}
                </h2>

                {current!.portuguese ? (
                  <p className="relative mt-2 text-[14px] text-[#94A3B8] leading-snug">
                    {current!.portuguese}
                  </p>
                ) : null}

                {auto != null ? (
                  <div className="relative mt-5">
                    <div className="flex justify-between text-[11px] mb-1.5">
                      <span className="text-[#64748B] uppercase tracking-wide font-semibold">
                        Domínio
                      </span>
                      <span className="text-white font-bold tabular-nums">{auto}%</span>
                    </div>
                    <DTProgressBar value={auto} color={tint} />
                  </div>
                ) : null}
              </article>
            </section>

            {/* CTA */}
            <div className="mt-5 flex flex-col items-center">
              <button
                type="button"
                onClick={startReview}
                aria-label="Começar revisão"
                className="review-cta relative active:scale-[0.98] transition-transform w-full max-w-[320px] min-h-[56px] rounded-[20px] flex items-center justify-center gap-2.5 text-[15px] font-extrabold text-white"
              >
                <IconMic size={22} />
                Começar revisão
                <IconPlay size={16} />
              </button>
            </div>

            {/* Próximo — prévia pequena */}
            {next ? (
              <div className="mt-5 px-1">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#64748B] mb-2">
                  Próximo
                </p>
                <div className="flex items-baseline gap-2 min-w-0">
                  <span className="text-[10px] font-bold uppercase tracking-wide text-[#64748B] shrink-0">
                    {itemCategory(next)}
                  </span>
                  <span className="text-[14px] font-semibold text-[#CBD5E1] truncate">
                    {next.german || next.phraseId}
                  </span>
                </div>
              </div>
            ) : null}
          </>
        )}
      </main>

      <BottomNav />
    </DTPage>
  );
}
