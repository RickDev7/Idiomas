import type { CSSProperties, ReactNode } from 'react';
import { IconBell, IconClock, IconHouse, IconBriefcase, IconDrop } from '@/components/ui/Icons';
import mascotImg from '@/assets/mascot/deutsch-turbo-mascot.png';

const LEVELS = [
  { id: 'L0', label: 'Iniciante' },
  { id: 'A1', label: 'A1' },
  { id: 'A2', label: 'A2' },
  { id: 'B1', label: 'B1' },
  { id: 'B2', label: 'B2' },
] as const;

export const GLASS: CSSProperties = {
  background: 'rgba(15, 23, 42, 0.65)',
  border: '1px solid rgba(255, 255, 255, 0.08)',
  backdropFilter: 'blur(16px)',
  WebkitBackdropFilter: 'blur(16px)',
};

export function HomeGreetingHeader({
  greeting,
  name,
  streak,
  onStreak,
  onBell,
}: {
  greeting: string;
  name?: string;
  streak: number;
  onStreak?: () => void;
  onBell?: () => void;
}) {
  const title = name ? `${greeting}, ${name}!` : `${greeting}!`;
  return (
    <header className="px-5 pt-4 safe-top animate-fade-in">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <img
            src={mascotImg}
            alt=""
            className="shrink-0 w-12 h-12 rounded-full object-cover border border-white/10"
            style={{ boxShadow: '0 0 16px rgba(139,92,246,0.35)' }}
            draggable={false}
          />
          <div className="min-w-0">
            <h1 className="text-[21px] font-bold leading-tight text-white truncate font-[family-name:var(--font-display)]">
              {title} <span aria-hidden>👋</span>
            </h1>
            <p className="text-[13px] text-[#94A3B8] mt-0.5 leading-snug">Vamos dominar o alemão juntos!</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0 pt-0.5">
          <button
            type="button"
            onClick={onStreak}
            aria-label={`${streak} dias de sequência`}
            className="inline-flex items-center gap-1 pl-2 pr-2.5 py-1.5 rounded-full active:scale-95 transition-transform"
            style={{
              background: 'linear-gradient(135deg, rgba(255,81,47,0.28), rgba(221,36,118,0.22))',
              border: '1px solid rgba(255,81,47,0.45)',
              boxShadow: '0 0 16px rgba(255,81,47,0.25)',
              backdropFilter: 'blur(16px)',
            }}
          >
            <span className="text-sm leading-none" aria-hidden>🔥</span>
            <span className="text-[11px] font-bold text-white whitespace-nowrap">
              <span style={{ color: '#FF512F' }}>{streak}</span> Sequência
            </span>
          </button>
          <button
            type="button"
            onClick={onBell}
            aria-label="Notificações"
            className="w-10 h-10 rounded-full flex items-center justify-center text-[#94A3B8]"
            style={GLASS}
          >
            <IconBell size={18} />
          </button>
        </div>
      </div>
    </header>
  );
}

export function LevelTrack({ current = 'L0' }: { current?: string }) {
  const idx = Math.max(0, LEVELS.findIndex((l) => l.id === current));
  return (
    <section className="px-5 pt-5 animate-fade-in" aria-label="Nível atual">
      <p className="text-[11px] uppercase tracking-[0.16em] font-semibold text-[#64748b] mb-3">Nível atual</p>
      <div className="flex items-start">
        {LEVELS.map((lvl, i) => {
          const active = i === idx;
          return (
            <div key={lvl.id} className="flex items-center flex-1 last:flex-none">
              <div className="flex flex-col items-center gap-1.5 min-w-[52px]">
                <span
                  className="w-11 h-11 rounded-full flex items-center justify-center text-[12px] font-bold"
                  style={
                    active
                      ? {
                          background: 'linear-gradient(145deg, #A855F7 0%, #8B5CF6 55%, #7c3aed 100%)',
                          color: '#fff',
                          border: '2px solid rgba(196,181,253,0.7)',
                          boxShadow: '0 0 0 4px rgba(139,92,246,0.2), 0 0 28px rgba(139,92,246,0.7)',
                        }
                      : {
                          ...GLASS,
                          color: '#64748b',
                        }
                  }
                >
                  {active ? lvl.id : <span className="text-[13px]" aria-hidden>🔒</span>}
                </span>
                <span className={`text-[10px] font-semibold ${active ? 'text-[#c4b5fd]' : 'text-[#64748b]'}`}>
                  {active ? lvl.label : lvl.id}
                </span>
              </div>
              {i < LEVELS.length - 1 && (
                <div
                  className="flex-1 h-0 mx-0.5 mt-[-16px] border-t border-dashed"
                  style={{ borderColor: 'rgba(148,163,184,0.35)' }}
                  aria-hidden
                />
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

export interface TrainingHeroProps {
  totalMinutes: number;
  remainingLabel?: string;
  progressPct?: number;
  onStart: () => void;
  title?: string;
  ariaLabel?: string;
  continueMode?: boolean;
}

export function TrainingHero({
  totalMinutes,
  remainingLabel,
  progressPct = 42,
  onStart,
  title = 'Continuar treino',
  ariaLabel = 'Continuar treino',
}: TrainingHeroProps) {
  const rem = remainingLabel || `${totalMinutes} min restantes`;
  return (
    <section className="px-5 pt-5 animate-slide-up">
      <button
        type="button"
        onClick={onStart}
        aria-label={ariaLabel}
        className="group relative w-full text-left rounded-[28px] p-5 overflow-hidden active:scale-[0.98] transition-transform dt-hero-train"
      >
        <span className="absolute -top-24 -right-10 w-64 h-64 rounded-full bg-white/15 blur-3xl pointer-events-none" />
        <span className="absolute -bottom-16 -left-8 w-40 h-40 rounded-full bg-[#FF512F]/30 blur-2xl pointer-events-none" />
        <div className="relative flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] uppercase tracking-[0.18em] font-bold text-white/80 mb-1.5">
              Treino do dia
            </p>
            <p className="text-[24px] text-white font-bold leading-tight font-[family-name:var(--font-display)]">
              {title}
            </p>
            <span className="inline-flex mt-3 px-3 py-1 rounded-full text-[12px] font-semibold text-white/95 bg-black/20 border border-white/25 backdrop-blur-sm">
              {rem}
            </span>
          </div>
          <span className="relative shrink-0 w-[80px] h-[80px] flex items-center justify-center">
            <span className="absolute inset-0 rounded-full border border-white/30 animate-pulse" style={{ animationDuration: '2.4s' }} />
            <span className="absolute inset-[-8px] rounded-full border border-white/15" />
            <span
              className="relative w-[58px] h-[58px] rounded-full flex items-center justify-center bg-white group-hover:scale-105 transition-transform"
              style={{ boxShadow: '0 0 32px rgba(255,255,255,0.65), 0 0 48px rgba(255,94,98,0.45)' }}
            >
              <span className="w-0 h-0 border-y-[11px] border-y-transparent border-l-[18px] border-l-[#DD2476] ml-1" />
            </span>
          </span>
        </div>
        <div className="relative mt-5 h-[6px] rounded-full bg-black/25 overflow-hidden">
          <div
            className="h-full rounded-full bg-white/90"
            style={{
              width: `${Math.min(100, Math.max(8, progressPct))}%`,
              boxShadow: '0 0 10px rgba(255,255,255,0.5)',
            }}
          />
        </div>
      </button>
    </section>
  );
}

const CHUNK_BRANCHES = [
  { de: 'Ich möchte Wasser.', Icon: IconDrop, tint: '#38bdf8' },
  { de: 'Ich möchte arbeiten.', Icon: IconBriefcase, tint: '#10B981' },
  { de: 'Ich möchte nach Hause.', Icon: IconHouse, tint: '#FF512F' },
] as const;

export function ChunksOfDay({ hook = 'Ich möchte...', pt = 'Quero...' }: { hook?: string; pt?: string }) {
  return (
    <section className="px-5 pt-7 animate-fade-in">
      <p className="text-[11px] uppercase tracking-[0.16em] font-semibold text-[#64748b] mb-4">
        Chunks de hoje <span aria-hidden>✨</span>
      </p>
      <div className="relative flex flex-col items-center">
        <div
          className="relative z-10 w-[min(100%,228px)] rounded-[20px] px-4 py-3.5 text-center"
          style={{
            background: 'linear-gradient(145deg, rgba(139,92,246,0.55), rgba(168,85,247,0.35))',
            border: '1px solid rgba(196,181,253,0.35)',
            boxShadow: '0 0 32px rgba(139,92,246,0.4)',
            backdropFilter: 'blur(16px)',
          }}
        >
          <p className="text-[15px] font-bold text-white leading-tight">{hook}</p>
          <p className="text-[12px] text-white/75 mt-0.5">{pt}</p>
        </div>
        {/* Linhas finas azuis do grafo */}
        <svg className="w-full h-9 overflow-visible" viewBox="0 0 300 36" aria-hidden>
          <path d="M150 0 V14" stroke="#38bdf8" strokeOpacity="0.55" strokeWidth="1.6" fill="none" />
          <path d="M50 14 H250" stroke="#38bdf8" strokeOpacity="0.4" strokeWidth="1.6" fill="none" />
          <path d="M50 14 V36 M150 14 V36 M250 14 V36" stroke="#38bdf8" strokeOpacity="0.4" strokeWidth="1.6" fill="none" />
        </svg>
        <div className="grid grid-cols-3 gap-2.5 w-full">
          {CHUNK_BRANCHES.map((b) => (
            <div
              key={b.de}
              className="rounded-[18px] p-3 text-center min-h-[108px] flex flex-col items-center justify-center gap-2"
              style={GLASS}
            >
              <span
                className="w-10 h-10 rounded-full flex items-center justify-center"
                style={{
                  background: `${b.tint}22`,
                  color: b.tint,
                  boxShadow: `0 0 14px ${b.tint}44`,
                }}
              >
                <b.Icon size={18} />
              </span>
              <p className="text-[11px] font-semibold text-white leading-snug">{b.de}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export interface ProgressMetric {
  icon: ReactNode;
  value: string | number;
  name: string;
  color: string;
  onClick?: () => void;
  ariaLabel?: string;
}

export function ProgressSection({ metrics }: { metrics: ProgressMetric[] }) {
  return (
    <section className="px-5 pt-7 pb-2 animate-fade-in">
      <p className="text-[11px] uppercase tracking-[0.16em] font-semibold text-[#64748b] mb-3">Seu progresso</p>
      <div className="grid grid-cols-2 gap-2.5">
        {metrics.map((m) => (
          <button
            key={m.name}
            type="button"
            onClick={m.onClick}
            aria-label={m.ariaLabel || m.name}
            className="w-full text-left p-3.5 rounded-[20px] active:scale-[0.98] transition-transform"
            style={GLASS}
          >
            <div
              className="inline-flex items-center justify-center w-10 h-10 rounded-[12px] mb-2.5"
              style={{
                background: `${m.color}22`,
                color: m.color,
                boxShadow: `0 0 16px ${m.color}33`,
              }}
            >
              {m.icon}
            </div>
            <p className="text-[22px] font-bold leading-none tracking-tight text-white">{m.value}</p>
            <p className="text-[11px] text-[#94A3B8] mt-1.5 leading-snug">{m.name}</p>
          </button>
        ))}
      </div>
    </section>
  );
}

export function HomeHeader({ onSettings }: { onSettings: () => void }) {
  return (
    <header className="flex items-center justify-between px-5 pt-3 safe-top">
      <span className="text-[11px] tracking-[0.2em] font-semibold text-[#94A3B8]">DEUTSCH TURBO</span>
      <button onClick={onSettings} aria-label="Configurações" className="min-h-11 min-w-11 rounded-full dt-glass flex items-center justify-center">⚙️</button>
    </header>
  );
}

export function Greeting(props: {
  greeting: string;
  name?: string;
  streak: number;
  onStreak?: () => void;
}) {
  return <HomeGreetingHeader {...props} />;
}

export function TrainingAreas() {
  return null;
}

export function FocusCard({ focusText }: { focusText: string }) {
  return (
    <section className="px-5 pt-7 pb-2">
      <div className="rounded-[28px] p-5" style={GLASS}>
        <p className="text-[11px] text-[#a78bfa] font-semibold tracking-[0.14em] mb-1">Seu foco</p>
        <p className="text-[15px] text-white font-medium">{focusText}</p>
      </div>
    </section>
  );
}

export { IconClock, IconHouse, IconBriefcase };
