/**
 * Revisão — redesign visual Fase 2.
 * Fila única: getDueReviews → beginReviewSessionFromQueue(queue).
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BottomNav } from '@/components/layout/BottomNav';
import { GlassCard, glassStyle } from '@/components/ui/GlassCard';
import {
  IconBack,
  IconPlay,
  IconPuzzle,
} from '@/components/ui/Icons';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import {
  beginReviewSessionFromQueue,
  getDueReviews,
} from '@/services/learning/ReviewRepository';
import {
  REVIEW_TYPE_COLORS,
  REVIEW_TYPE_LABELS,
  type ReviewQueueItem,
} from '@/services/learning/ReviewEngine';

const NEON = ['#00F2FE', '#8B5CF6', '#EC4899', '#F97316', '#22C55E', '#FF8A00'] as const;

function itemKind(item: ReviewQueueItem): 'Frage' | 'Struktur' {
  const g = (item.german || '').trim();
  if (g.endsWith('?')) return 'Frage';
  return 'Struktur';
}

function priorityLabel(priority: number): string {
  if (priority >= 80) return 'Alta';
  if (priority >= 50) return 'Média';
  return 'Baixa';
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
          <h1 className="text-[18px] font-bold text-white font-[family-name:var(--font-display)]">
            Revisão
          </h1>
          <p className="text-[12px] text-[#CBD5E1]">Reforce o que você aprendeu.</p>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto scrollbar-hide px-5 pt-4 pb-28 space-y-5">
        <GlassCard
          variant="violet"
          className="p-6 text-center relative overflow-hidden"
        >
          <span
            className="absolute -top-20 left-1/2 -translate-x-1/2 w-56 h-56 rounded-full pointer-events-none"
            style={{ background: 'radial-gradient(circle, rgba(139,92,246,0.4), transparent 70%)' }}
          />
          <p className="dt-label relative">Fila atual</p>
          <p className="relative mt-2 text-[56px] font-bold leading-none text-white font-[family-name:var(--font-display)] tabular-nums">
            {queue.length}
          </p>
          <p className="relative mt-2 text-[12px] uppercase tracking-[0.16em] font-semibold text-[#CBD5E1]">
            Itens para revisar
          </p>
        </GlassCard>

        {queue.length === 0 ? (
          <GlassCard className="p-5 text-center">
            <p className="text-[14px] text-[#CBD5E1]">
              Nada na fila agora. Pratique uma sessão e volte para reforçar.
            </p>
            <button
              type="button"
              onClick={() => navigate('/aprender')}
              className="mt-4 px-5 py-2.5 rounded-full text-[13px] font-bold text-white"
              style={{
                background: 'linear-gradient(135deg, #8B5CF6, #EC4899)',
                boxShadow: '0 0 20px rgba(139,92,246,0.4)',
              }}
            >
              Ir para Aprender
            </button>
          </GlassCard>
        ) : (
          <section className="space-y-2.5" aria-label="Itens da fila de revisão">
            {queue.map((item, i) => {
              const tint = REVIEW_TYPE_COLORS[item.reviewType] || NEON[i % NEON.length];
              const kind = itemKind(item);
              const auto = Math.round(item.automationScore || 0);
              return (
                <div
                  key={`${item.phraseId}-${i}`}
                  className="rounded-[20px] p-3.5 transition-transform duration-200"
                  style={{
                    ...glassStyle,
                    border: `1px solid ${tint}55`,
                    boxShadow: `0 0 16px ${tint}22`,
                  }}
                >
                  <div className="flex items-start gap-3">
                    <span
                      className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 text-white"
                      style={{
                        background: `${tint}28`,
                        boxShadow: `0 0 14px ${tint}40`,
                        color: tint,
                      }}
                    >
                      <IconPuzzle size={18} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-md"
                          style={{ background: `${tint}22`, color: tint }}
                        >
                          {kind}
                        </span>
                        <span className="text-[10px] font-semibold text-[#64748B]">
                          {REVIEW_TYPE_LABELS[item.reviewType] || item.reviewType}
                        </span>
                      </div>
                      <p className="mt-1.5 text-[15px] font-bold text-white truncate">
                        {item.german || item.phraseId}
                      </p>
                      <div className="mt-2 flex items-center gap-3 text-[11px] text-[#64748B]">
                        <span>Prioridade: {priorityLabel(item.priority)}</span>
                        <span className="tabular-nums">{auto}%</span>
                      </div>
                      <div
                        className="mt-2 h-[4px] rounded-full overflow-hidden"
                        style={{ background: 'rgba(255,255,255,0.08)' }}
                      >
                        <div
                          className="h-full rounded-full transition-all duration-300"
                          style={{
                            width: `${Math.max(4, Math.min(100, auto))}%`,
                            background: `linear-gradient(90deg, ${tint}, #A855F7)`,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </section>
        )}

        <button
          type="button"
          onClick={startReview}
          disabled={queue.length === 0}
          className="w-full min-h-14 rounded-[24px] text-white text-[15px] font-bold active:scale-[0.98] transition-transform duration-200 inline-flex items-center justify-center gap-2.5 disabled:opacity-40"
          style={{
            background: 'linear-gradient(135deg, #8B5CF6 0%, #EC4899 100%)',
            boxShadow: '0 0 28px rgba(139,92,246,0.45)',
          }}
        >
          <IconPlay size={20} /> Iniciar revisão
        </button>
      </main>
      <BottomNav />
    </div>
  );
}
