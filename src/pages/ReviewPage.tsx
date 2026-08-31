import { useEffect, useState, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { BottomNav } from '@/components/layout/BottomNav';
import {
  IconBack,
  IconBolt,
  IconCheck,
  IconHelp,
  IconPlay,
  IconPuzzle,
} from '@/components/ui/Icons';
import { getDueReviews } from '@/services/learning/ReviewRepository';
import type { ReviewQueueItem } from '@/services/learning/ReviewEngine';
import { useProfile } from '@/hooks/useProfile';
import { MemoryService } from '@/services/learning/MemoryService';
import { computeProgress } from '@/services/learning/ProgressEngine';

const GLASS: CSSProperties = {
  background: 'rgba(15, 23, 42, 0.65)',
  border: '1px solid rgba(255, 255, 255, 0.08)',
  backdropFilter: 'blur(16px)',
  WebkitBackdropFilter: 'blur(16px)',
};

const SLOT_OPTIONS = [
  { id: 'wasser', de: 'Wasser.', pt: 'Água.', color: '#38bdf8', bg: 'rgba(56,189,248,0.16)', emoji: '💧' },
  { id: 'arbeiten', de: 'arbeiten.', pt: 'trabalhar.', color: '#10B981', bg: 'rgba(16,185,129,0.14)', emoji: '💼' },
  { id: 'hause', de: 'nach Hause.', pt: 'para casa.', color: '#FF512F', bg: 'rgba(255,81,47,0.14)', emoji: '🏠' },
] as const;

export function ReviewPage() {
  const navigate = useNavigate();
  const { profile } = useProfile();
  const [queue, setQueue] = useState<ReviewQueueItem[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [automation, setAutomation] = useState(68);
  const hits = [true, true, true, true, true, true, false, false];

  useEffect(() => {
    getDueReviews(12).then(setQueue).catch(() => setQueue([]));
  }, []);

  useEffect(() => {
    if (!profile) return;
    MemoryService.loadProfile(profile)
      .then((learning) => setAutomation(Math.round(computeProgress(learning).automationScore || 68)))
      .catch(() => {});
  }, [profile]);

  const startReview = () => {
    const first = queue[0];
    navigate(
      first
        ? `/sessao?type=review&phrase=${encodeURIComponent(first.phraseId)}&mode=${first.reviewType}`
        : '/sessao?type=review',
    );
  };

  const filled = SLOT_OPTIONS.find((o) => o.id === selected);

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
            REVISÃO
          </h1>
          <p className="text-[12px] text-[#94A3B8] mt-0.5 truncate">Consolide suas estruturas</p>
        </div>
        <button
          type="button"
          aria-label="Informações"
          className="w-10 h-10 rounded-full flex items-center justify-center text-[#94A3B8] shrink-0"
          style={GLASS}
        >
          <IconHelp size={18} />
        </button>
      </header>

      <main className="flex-1 overflow-y-auto scrollbar-hide px-5 pt-5 pb-28">
        <div className="rounded-[24px] p-5 flex items-center gap-4" style={GLASS}>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] uppercase tracking-[0.14em] font-semibold text-[#64748b] mb-1.5">
              Estrutura atual
            </p>
            <p className="text-[28px] font-bold text-white leading-tight font-[family-name:var(--font-display)]">
              Ich möchte...
            </p>
            <p className="text-[14px] text-[#94A3B8] mt-1">Quero...</p>
          </div>
          <span
            className="shrink-0 w-[72px] h-[72px] rounded-2xl flex items-center justify-center text-white"
            style={{
              background: 'linear-gradient(145deg, #A855F7 0%, #8B5CF6 50%, #DD2476 100%)',
              boxShadow: '0 0 36px rgba(139,92,246,0.75), 0 0 18px rgba(221,36,118,0.4)',
            }}
            aria-hidden
          >
            <IconPuzzle size={34} />
          </span>
        </div>

        <section className="mt-6">
          <p className="text-[11px] uppercase tracking-[0.16em] font-semibold text-[#64748b] mb-3">
            Monte suas frases
          </p>
          <div
            className="rounded-[20px] px-4 py-5 flex items-center justify-center gap-2.5 flex-wrap"
            style={GLASS}
          >
            <span
              className="px-3.5 py-2.5 rounded-xl text-[16px] font-bold text-white"
              style={{ background: 'rgba(15,23,42,0.95)', border: '1px solid rgba(255,255,255,0.12)' }}
            >
              Ich möchte
            </span>
            <span
              className="min-w-[112px] px-4 py-2.5 rounded-xl border-2 border-dashed text-center text-[14px] font-semibold"
              style={
                filled
                  ? { borderColor: `${filled.color}66`, background: filled.bg, color: filled.color }
                  : {
                      borderColor: 'rgba(148,163,184,0.5)',
                      background: 'rgba(100,116,139,0.18)',
                      color: '#64748b',
                    }
              }
            >
              {filled ? filled.de : '[ ... ]'}
            </span>
          </div>

          <div className="mt-3.5 grid grid-cols-3 gap-2.5">
            {SLOT_OPTIONS.map((opt) => {
              const active = selected === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setSelected(opt.id)}
                  className="rounded-[20px] p-3 min-h-[112px] flex flex-col items-center justify-center gap-1.5 active:scale-[0.97] transition-transform"
                  style={{
                    background: opt.bg,
                    border: active ? `1px solid ${opt.color}99` : `1px solid ${opt.color}33`,
                    boxShadow: active ? `0 0 20px ${opt.color}55` : `0 0 10px ${opt.color}22`,
                  }}
                >
                  <span className="text-[22px] leading-none" aria-hidden>
                    {opt.emoji}
                  </span>
                  <span className="text-[12px] font-bold text-white text-center leading-tight">{opt.de}</span>
                  <span className="text-[10px] font-medium text-center leading-tight" style={{ color: opt.color }}>
                    {opt.pt}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <section className="mt-6 rounded-[22px] p-4" style={GLASS}>
          <div className="flex items-center gap-3 mb-3">
            <span
              className="w-9 h-9 rounded-full flex items-center justify-center"
              style={{
                background: 'rgba(255,81,47,0.2)',
                color: '#FF512F',
                boxShadow: '0 0 14px rgba(255,81,47,0.35)',
              }}
            >
              <IconBolt size={18} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] uppercase tracking-[0.12em] font-semibold text-[#64748b]">
                Nível de automatização
              </p>
              <p className="text-[15px] font-bold text-white mt-0.5">
                {automation}% <span className="text-[13px] font-semibold text-[#FBBF24]">Muito bom!</span>
              </p>
            </div>
          </div>
          <div className="h-3 rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.min(100, automation)}%`,
                background: 'linear-gradient(90deg, #FBBF24 0%, #FF512F 55%, #DD2476 100%)',
                boxShadow: '0 0 14px rgba(255,81,47,0.55)',
              }}
            />
          </div>
          <p className="text-[12px] text-[#94A3B8] mt-3 leading-snug">
            Continue praticando para ficar automático!
          </p>
        </section>

        <section className="mt-6">
          <p className="text-[11px] uppercase tracking-[0.16em] font-semibold text-[#64748b] mb-3">
            Histórico de acertos
          </p>
          <div className="flex items-center gap-2.5 overflow-x-auto scrollbar-hide py-1">
            {hits.map((hit, i) => (
              <span
                key={i}
                className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center"
                style={
                  hit
                    ? {
                        background: 'rgba(16,185,129,0.22)',
                        border: '1px solid rgba(16,185,129,0.55)',
                        color: '#10B981',
                        boxShadow: '0 0 12px rgba(16,185,129,0.35)',
                      }
                    : {
                        background: 'transparent',
                        border: '1.5px solid rgba(255,255,255,0.14)',
                        color: '#64748b',
                      }
                }
                aria-label={hit ? 'Acerto' : 'Pendente'}
              >
                {hit ? <IconCheck size={18} /> : null}
              </span>
            ))}
          </div>
        </section>

        <button
          type="button"
          onClick={startReview}
          className="mt-7 w-full min-h-14 rounded-[24px] text-white text-[15px] font-semibold active:scale-[0.98] transition-transform inline-flex items-center justify-center gap-2.5"
          style={{
            background: 'linear-gradient(180deg, #A855F7 0%, #8B5CF6 100%)',
            boxShadow: '0 0 28px rgba(139,92,246,0.5)',
          }}
        >
          <IconPlay size={20} /> {queue.length > 0 ? `Revisar ${queue.length} itens` : 'Praticar em voz'}
        </button>
      </main>
      <BottomNav />
    </div>
  );
}
