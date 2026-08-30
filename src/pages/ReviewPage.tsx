import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BottomNav } from '@/components/layout/BottomNav';
import { AppHeader, SectionLabel, PageTitle, PageSubtitle } from '@/components/ui/PageHeader';
import { EmptyState, SkeletonBlock } from '@/components/ui/EmptyState';
import { IconCheck, IconPlay, IconChat, IconRefresh, IconBolt, IconSparkle, IconBrain } from '@/components/ui/Icons';
import {
  REVIEW_TYPE_COLORS,
  REVIEW_TYPE_LABELS,
  type ReviewQueueItem,
  type ReviewType,
} from '@/services/learning/ReviewEngine';
import { getDueReviews } from '@/services/learning/ReviewRepository';

const TYPE_ICONS: Partial<Record<ReviewType, React.ReactNode>> = {
  RECOGNITION_REVIEW: <IconChat size={20} />,
  RECALL_REVIEW: <IconBrain size={20} />,
  GUIDED_SPEAKING_REVIEW: <IconBolt size={20} />,
  INDEPENDENT_SPEAKING_REVIEW: <IconRefresh size={20} />,
  TRANSFER_REVIEW: <IconRefresh size={20} />,
  SPONTANEOUS_REVIEW: <IconSparkle size={18} />,
  MAINTENANCE_REVIEW: <IconCheck size={20} />,
};

export function ReviewPage() {
  const navigate = useNavigate();
  const [queue, setQueue] = useState<ReviewQueueItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const items = await getDueReviews(12);
        if (!cancelled) setQueue(items);
      } catch {
        if (!cancelled) {
          setQueue([]);
          setError(true);
        }
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const empty = loaded && queue.length === 0 && !error;
  const count = queue.length;

  const startReview = (item?: ReviewQueueItem) => {
    const first = item ?? queue[0];
    navigate(
      first
        ? `/sessao?type=review&phrase=${encodeURIComponent(first.phraseId)}&mode=${first.reviewType}`
        : '/sessao?type=review',
    );
  };

  return (
    <div className="flex flex-col h-full bg-background max-w-md mx-auto">
      <AppHeader />
      <main className="flex-1 overflow-y-auto scrollbar-hide px-5 pt-4 pb-28 flex flex-col">
        <SectionLabel tone="pink">Revisar</SectionLabel>
        <div className="flex items-center gap-2 mt-1.5">
          <PageTitle>
            {!loaded ? 'Revisão' : empty ? 'Você está em dia!' : error ? 'Não foi possível carregar' : 'Revisão de hoje'}
          </PageTitle>
          {loaded && empty && <IconCheck size={26} className="text-success shrink-0" aria-hidden />}
          {loaded && !empty && !error && <IconSparkle size={18} className="text-primary shrink-0" aria-hidden />}
        </div>
        <PageSubtitle>
          {!loaded
            ? 'Carregando fila de revisão…'
            : empty
              ? 'Ótimo trabalho! Não há nada para revisar agora.'
              : error
                ? 'Tente de novo em instantes. Sua memória continua salva.'
                : `Seu professor encontrou ${count} ${count === 1 ? 'item' : 'itens'} com base na memória, retenção e automação.`}
        </PageSubtitle>

        {!loaded ? (
          <div className="mt-8 space-y-3" aria-busy="true" aria-label="Carregando revisões">
            <SkeletonBlock className="h-20" />
            <SkeletonBlock className="h-20" />
            <SkeletonBlock className="h-20" />
          </div>
        ) : empty ? (
          <EmptyState
            imageSrc="/assets/review-brain.png"
            imageAlt=""
            footer={
              <div
                className="w-full rounded-[24px] p-4 flex items-start gap-3.5"
                style={{
                  background: 'linear-gradient(135deg, rgba(139,92,246,0.18) 0%, var(--surface) 100%)',
                  border: '1px solid var(--border)',
                  boxShadow: 'var(--shadow-sm)',
                }}
              >
                <span
                  className="shrink-0 w-11 h-11 rounded-full flex items-center justify-center"
                  style={{ background: 'rgba(139,92,246,0.22)', color: '#c4b5fd' }}
                >
                  <IconSparkle size={18} />
                </span>
                <p className="text-secondary text-text leading-snug pt-0.5">
                  Continue assim! A revisão diária fortalece sua memória e acelera sua evolução.
                </p>
              </div>
            }
          />
        ) : error ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center">
            <p className="text-secondary text-text-muted">A fila de revisão não carregou.</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="min-h-11 px-5 rounded-full dt-glass text-body font-semibold"
            >
              Tentar de novo
            </button>
          </div>
        ) : (
          <>
            <div className="mt-6 space-y-3.5">
              {queue.map((item, idx) => {
                const color = REVIEW_TYPE_COLORS[item.reviewType];
                const badge = REVIEW_TYPE_LABELS[item.reviewType];
                return (
                  <ReviewCard
                    key={item.phraseId}
                    color={color}
                    icon={TYPE_ICONS[item.reviewType] ?? <IconChat size={20} />}
                    badge={badge}
                    german={item.german || item.phraseId}
                    portuguese={item.portuguese || item.reason}
                    hint={item.reason}
                    delayMs={idx * 70}
                    onClick={() => startReview(item)}
                  />
                );
              })}
            </div>

            <div className="mt-auto pt-7">
              <button
                type="button"
                onClick={() => startReview()}
                className="w-full min-h-14 rounded-[24px] text-white text-base font-semibold active:scale-[0.98] transition-transform inline-flex items-center justify-center gap-2.5"
                style={{
                  background: 'linear-gradient(180deg, #8b5cf6 0%, #7c3aed 100%)',
                  boxShadow: 'var(--shadow-glow-purple)',
                }}
              >
                <IconPlay size={20} /> Começar revisão
              </button>
              <p className="text-caption text-text-faint mt-3 text-center">
                Prioridade: o que você sabe mas ainda não automatizou.
              </p>
            </div>
          </>
        )}
      </main>
      <BottomNav />
    </div>
  );
}

function ReviewCard({
  color, icon, badge, german, portuguese, hint, delayMs, onClick,
}: {
  color: string;
  icon: React.ReactNode;
  badge: string;
  german: string;
  portuguese?: string;
  hint?: string;
  delayMs: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Revisar: ${german}`}
      className="w-full flex items-center gap-3.5 p-4 rounded-[24px] dt-glass hover:border-primary/30 active:scale-[0.99] transition-all text-left animate-fade-in min-h-11"
      style={{ animationDelay: `${delayMs}ms` }}
    >
      <span
        className="shrink-0 w-11 h-11 rounded-[14px] flex items-center justify-center text-white shadow-sm"
        style={{ background: color }}
        aria-hidden
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span
          className="block text-body font-semibold text-text leading-snug"
          style={{ overflowWrap: 'anywhere', wordBreak: 'break-word' }}
        >
          {german}
        </span>
        {portuguese && (
          <span
            className="block text-secondary text-text-muted mt-0.5 leading-snug"
            style={{ overflowWrap: 'anywhere', wordBreak: 'break-word' }}
          >
            {portuguese}
          </span>
        )}
        <span className="flex flex-wrap items-center gap-1.5 mt-2">
          <span
            className="inline-flex items-center px-2.5 py-0.5 rounded-full text-caption font-semibold"
            style={{ background: `${color}22`, color }}
          >
            {badge}
          </span>
          {hint && hint !== portuguese && (
            <span className="text-caption text-text-faint leading-snug">{hint}</span>
          )}
        </span>
      </span>
      <span className="shrink-0 text-text-faint" aria-hidden>›</span>
    </button>
  );
}
