import type { ReactNode } from 'react';
import { IconGear } from '@/components/ui/Icons';
import { DeutschTurboMascot } from '@/components/ui/Mascot';

export function HomeHeader({ onSettings }: { onSettings: () => void }) {
  return (
    <header className="flex items-center justify-between px-5 pt-3 safe-top">
      <div className="flex items-center gap-2.5 min-h-11">
        <span
          className="w-9 h-9 rounded-[12px] flex items-end justify-center gap-0.5 pb-1.5 shadow-md"
          style={{ background: 'linear-gradient(145deg, #f59e0b 0%, #ef4444 100%)' }}
          aria-hidden
        >
          <span className="w-1 h-2 bg-white/95 rounded-sm" />
          <span className="w-1 h-3.5 bg-white/95 rounded-sm" />
          <span className="w-1 h-2.5 bg-white/95 rounded-sm" />
        </span>
        <span className="text-eyebrow text-text-muted tracking-[0.2em] font-semibold">DEUTSCH TURBO</span>
      </div>
      <button
        onClick={onSettings}
        aria-label="Configurações"
        className="min-h-11 min-w-11 flex items-center justify-center rounded-full dt-glass"
      >
        <IconGear size={18} />
      </button>
    </header>
  );
}

export function Greeting({
  greeting,
  name,
  streak,
  onStreak,
}: {
  greeting: string;
  name?: string;
  streak: number;
  onStreak?: () => void;
}) {
  const title = name ? `${greeting}, ${name}!` : `${greeting}!`;
  return (
    <div className="px-5 pt-5 animate-fade-in">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-display font-[family-name:var(--font-display)] font-bold">
            {title} <span className="inline-block" aria-hidden>👋</span>
          </h1>
          <p className="text-secondary text-text-muted mt-1.5">Seu treino de hoje está pronto.</p>
        </div>
        <button
          onClick={onStreak}
          aria-label="Ver progresso e sequência"
          className="shrink-0 inline-flex items-center gap-2 pl-2.5 pr-3 py-2 rounded-2xl dt-glass active:scale-95 transition-transform min-h-11"
        >
          <span className="text-base leading-none" aria-hidden>🔥</span>
          <span className="text-left">
            <span className="block text-secondary text-text font-bold leading-none">
              {streak} {streak === 1 ? 'dia' : 'dias'}
            </span>
            <span className="block text-caption text-text-faint leading-none mt-0.5">Sequência</span>
          </span>
        </button>
      </div>
    </div>
  );
}

export interface TrainingHeroProps {
  totalMinutes: number;
  warmupMinutes: number;
  levelLabel: string;
  levelIcon?: ReactNode;
  onStart: () => void;
  title?: string;
  subtitle?: string;
  ariaLabel?: string;
  /** Continuar = gradiente laranja/rosa da referência */
  continueMode?: boolean;
}

export function TrainingHero({
  totalMinutes,
  warmupMinutes,
  levelLabel,
  levelIcon = '🎯',
  onStart,
  title = 'Começar treino',
  subtitle = 'Conversa guiada com seu professor',
  ariaLabel = 'Começar treino',
  continueMode = false,
}: TrainingHeroProps) {
  // Referência: Continuar = laranja→rosa; Começar = azul→roxo
  const bg = continueMode
    ? 'linear-gradient(135deg, #f97316 0%, #ef4444 50%, #ec4899 100%)'
    : 'linear-gradient(135deg, #2563eb 0%, #3b82f6 40%, #8b5cf6 100%)';
  const glow = continueMode ? 'var(--shadow-glow-orange)' : 'var(--shadow-glow)';

  return (
    <div className="px-5 pt-5 animate-slide-up">
      <button
        onClick={onStart}
        className="group relative w-full text-left rounded-[28px] p-5 overflow-hidden active:scale-[0.98] transition-transform"
        style={{ background: bg, boxShadow: glow }}
        aria-label={ariaLabel}
      >
        <span className="absolute -top-16 -right-10 w-52 h-52 rounded-full bg-white/10 blur-2xl pointer-events-none" />
        <span className="absolute bottom-0 left-0 w-40 h-24 rounded-full bg-black/10 blur-xl pointer-events-none" />
        <div className="relative flex items-center gap-3.5">
          <DeutschTurboMascot size="large" state="teacher" className="shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-[22px] text-white font-bold leading-tight font-[family-name:var(--font-display)]">{title}</p>
            <p className="text-[13px] text-white/88 mt-1.5 leading-snug">{subtitle}</p>
          </div>
          <span className="shrink-0 w-14 h-14 rounded-full bg-white flex items-center justify-center shadow-lg group-hover:scale-105 group-active:scale-95 transition-transform">
            <span
              className="w-0 h-0 border-y-[9px] border-y-transparent border-l-[14px] ml-0.5"
              style={{ borderLeftColor: continueMode ? '#ef4444' : '#3b82f6' }}
            />
          </span>
        </div>
        <div className="relative grid grid-cols-3 gap-2 mt-5">
          <HeroPill icon="⏱️" value={`${totalMinutes} min`} label="Duração" />
          <HeroPill icon="⚡" value={`${warmupMinutes} min`} label="Aquecimento" />
          <HeroPill icon={levelIcon} value={levelLabel} label="Nível" />
        </div>
      </button>
    </div>
  );
}

function HeroPill({ icon, value, label }: { icon: ReactNode; value: string; label: string }) {
  return (
    <div className="rounded-2xl bg-white/15 backdrop-blur-md px-2.5 py-2.5 text-center border border-white/15">
      <p className="text-sm leading-none mb-1 flex items-center justify-center text-white">{icon}</p>
      <p className="text-secondary text-white font-bold leading-tight truncate">{value}</p>
      <p className="text-caption text-white/75 leading-tight mt-0.5 truncate">{label}</p>
    </div>
  );
}

export interface ProgressMetric {
  icon: ReactNode;
  value: number;
  name: string;
  color: string;
  trackClass: string;
  barClass: string;
  onClick?: () => void;
  ariaLabel?: string;
}

export function ProgressSection({ metrics }: { metrics: ProgressMetric[] }) {
  return (
    <section className="px-5 pt-7 animate-fade-in">
      <p className="text-eyebrow text-text-faint tracking-[0.16em] font-semibold mb-3">📈 SEU PROGRESSO</p>
      <div className="grid grid-cols-3 gap-2.5">
        {metrics.map((m) => (
          <ProgressMetricCard key={m.name} {...m} />
        ))}
      </div>
    </section>
  );
}

function ProgressMetricCard({ icon, value, name, color, trackClass, barClass, onClick, ariaLabel }: ProgressMetric) {
  const pct = Math.min(100, value);
  const className = 'w-full text-left p-3.5 rounded-[22px] dt-glass';
  const inner = (
    <>
      <div className="inline-flex items-center justify-center w-9 h-9 rounded-[12px] mb-2.5" style={{ background: `${color}22`, color }}>
        {icon}
      </div>
      <p className="text-[28px] font-bold leading-none tracking-tight">{value}</p>
      <p className="text-caption text-text-muted mt-1.5">{name}</p>
      <div className={`h-1.5 rounded-full overflow-hidden mt-2.5 ${trackClass}`}>
        <div className={`h-full rounded-full ${barClass}`} style={{ width: `${pct}%` }} />
      </div>
    </>
  );
  if (!onClick) return <div className={className}>{inner}</div>;
  return (
    <button type="button" onClick={onClick} aria-label={ariaLabel || `Ver progresso de ${name}`} className={`${className} active:scale-[0.98] transition-transform`}>
      {inner}
    </button>
  );
}

export interface TrainingArea {
  icon: ReactNode;
  title: string;
  desc: string;
  tag: string;
  tagClass: string;
  circleClass: string;
  onClick?: () => void;
  ariaLabel?: string;
}

export function TrainingAreas({ areas }: { areas: TrainingArea[] }) {
  return (
    <section className="px-5 pt-7">
      <p className="text-eyebrow text-text-faint tracking-[0.16em] font-semibold mb-3">🎯 HOJE VAMOS TRABALHAR</p>
      <div className="grid grid-cols-3 gap-2.5">
        {areas.map((a) => {
          const className = 'p-3.5 rounded-[22px] dt-glass flex flex-col items-center text-center';
          const inner = (
            <>
              <div className={`w-11 h-11 rounded-full flex items-center justify-center mb-2.5 ${a.circleClass}`}>{a.icon}</div>
              <p className="text-body text-text font-semibold leading-tight">{a.title}</p>
              <p className="text-caption text-text-faint mt-1 leading-tight">{a.desc}</p>
              <span className={`mt-2.5 text-caption font-medium px-2.5 py-1 rounded-full ${a.tagClass}`}>{a.tag}</span>
            </>
          );
          if (!a.onClick) return <div key={a.title} className={className}>{inner}</div>;
          return (
            <button key={a.title} type="button" onClick={a.onClick} aria-label={a.ariaLabel || a.title} className={`${className} w-full active:scale-[0.98] transition-transform`}>
              {inner}
            </button>
          );
        })}
      </div>
    </section>
  );
}

export function FocusCard({ focusText, onClick }: { focusText: string; onClick?: () => void }) {
  const inner = (
    <div className="relative flex items-center gap-3.5">
      <span className="shrink-0 w-11 h-11 rounded-full flex items-center justify-center" style={{ background: 'rgba(124,58,237,0.2)' }}>
        <span className="text-xl" aria-hidden>🎯</span>
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-eyebrow tracking-[0.14em] font-semibold mb-1" style={{ color: '#a78bfa' }}>SEU FOCO DE HOJE</p>
        <p className="text-body text-text font-medium leading-snug">{focusText}</p>
      </div>
    </div>
  );
  const skin = {
    background: 'linear-gradient(120deg, var(--focus-from) 0%, rgba(124,58,237,0.14) 55%, rgba(59,130,246,0.12) 100%)',
  };
  return (
    <section className="px-5 pt-7 pb-2">
      {onClick ? (
        <button type="button" onClick={onClick} aria-label="Começar o foco de hoje" className="relative w-full text-left rounded-[28px] p-5 overflow-hidden border border-border active:scale-[0.99] transition-transform" style={skin}>
          {inner}
        </button>
      ) : (
        <div className="relative w-full rounded-[28px] p-5 overflow-hidden border border-border" style={skin}>{inner}</div>
      )}
    </section>
  );
}
