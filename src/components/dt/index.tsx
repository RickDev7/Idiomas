/**
 * Deutsch Turbo — Design System components (DT*)
 * Reutiliza GlassCard / ProgressRing / VoiceOrb / Button onde possível.
 * Uma linguagem visual para todo o app (ref: deutsch-turbo-reference.png).
 */
import type {
  CSSProperties,
  ReactNode,
} from 'react';
import { GlassCard, glassStyle, glassVioletStyle, glassCyanStyle } from '@/components/ui/GlassCard';
import { ProgressRing } from '@/components/ui/ProgressRing';
import { LiveAudioOrb, VoiceOrb, type OrbState } from '@/components/ui/VoiceOrb';
import { PrimaryButton, IconButton } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { IconBack, IconPlay, IconLock } from '@/components/ui/Icons';

export { glassStyle, glassVioletStyle, glassCyanStyle, GlassCard, ProgressRing, LiveAudioOrb, VoiceOrb };
export type { OrbState };

/* ─── Page shell ─── */
export function DTPage({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex flex-col h-full max-w-md mx-auto dt-page ${className}`}>
      {children}
    </div>
  );
}

export function DTMain({
  children,
  withNav = true,
  className = '',
}: {
  children: ReactNode;
  withNav?: boolean;
  className?: string;
}) {
  return (
    <main
      className={`flex-1 overflow-y-auto scrollbar-hide px-4 ${withNav ? 'pb-28' : 'pb-8'} ${className}`}
    >
      {children}
    </main>
  );
}

/* ─── Top bar ─── */
export function DTTopBar({
  title,
  subtitle,
  onBack,
  right,
  center,
}: {
  title?: string;
  subtitle?: string;
  onBack?: () => void;
  right?: ReactNode;
  center?: ReactNode;
}) {
  return (
    <header className="px-4 pt-3 safe-top shrink-0 flex items-center gap-3">
      {onBack ? (
        <DTIconButton label="Voltar" onClick={onBack}>
          <IconBack size={18} />
        </DTIconButton>
      ) : null}
      {center ? (
        <div className="min-w-0 flex-1 flex justify-center">{center}</div>
      ) : (
        <div className="min-w-0 flex-1">
          {title ? (
            <h1 className="text-[17px] font-bold text-white font-[family-name:var(--font-display)] tracking-wide uppercase">
              {title}
            </h1>
          ) : null}
          {subtitle ? <p className="text-[12px] text-[#CBD5E1] mt-0.5">{subtitle}</p> : null}
        </div>
      )}
      {right ? <div className="shrink-0">{right}</div> : null}
    </header>
  );
}

export function DTSectionLabel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <p className={`dt-label ${className}`}>{children}</p>;
}

/* ─── Cards ─── */
export function DTGlassCard({
  children,
  variant = 'default',
  className = '',
  style,
  onClick,
}: {
  children: ReactNode;
  variant?: 'default' | 'violet' | 'cyan';
  className?: string;
  style?: CSSProperties;
  onClick?: () => void;
}) {
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`w-full text-left rounded-[22px] transition-transform active:scale-[0.98] ${className}`}
        style={{
          ...(variant === 'violet' ? glassVioletStyle : variant === 'cyan' ? glassCyanStyle : glassStyle),
          ...style,
        }}
      >
        {children}
      </button>
    );
  }
  return (
    <GlassCard variant={variant} className={className} style={style}>
      {children}
    </GlassCard>
  );
}

export function DTHeroCard({
  eyebrow,
  title,
  detail,
  onAction,
  actionLabel = 'Continuar',
  onBadgeClick,
  badge,
}: {
  eyebrow: string;
  title: string;
  detail?: string;
  onAction: () => void;
  actionLabel?: string;
  onBadgeClick?: () => void;
  badge?: string;
}) {
  return (
    <section className="relative">
      <div className="relative overflow-hidden rounded-[28px] p-5 min-h-[168px] dt-hero-train">
        <span className="absolute -top-16 -right-10 w-44 h-44 rounded-full bg-white/20 blur-3xl pointer-events-none" />
        <span className="absolute -bottom-20 -left-8 w-52 h-52 rounded-full bg-[#FF512F]/30 blur-3xl pointer-events-none" />
        <p className="relative text-[10px] uppercase tracking-[0.2em] font-bold text-white/75">{eyebrow}</p>
        <h2 className="relative mt-2 text-[26px] leading-tight font-extrabold text-white font-[family-name:var(--font-display)]">
          {title}
        </h2>
        {detail ? <p className="relative mt-1.5 text-[13px] text-white/85">{detail}</p> : null}
        {badge ? (
          <button
            type="button"
            onClick={onBadgeClick}
            className="relative mt-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[12px] font-semibold text-white/95 bg-black/25 border border-white/20"
          >
            {badge}
          </button>
        ) : null}
        <div className="relative mt-5 flex items-center justify-between gap-3">
          <span className="text-[13px] font-bold text-white/90">{actionLabel}</span>
          <button
            type="button"
            onClick={onAction}
            aria-label={actionLabel}
            className="w-16 h-16 rounded-full flex items-center justify-center bg-white text-[#050816] active:scale-95 transition-transform"
            style={{
              boxShadow:
                '0 0 0 4px rgba(255,255,255,0.25), 0 0 0 10px rgba(168,85,247,0.35), 0 0 36px rgba(236,72,153,0.55)',
            }}
          >
            <IconPlay size={26} />
          </button>
        </div>
      </div>
    </section>
  );
}

export function DTMetricCard({
  value,
  label,
  color = '#8B5CF6',
  icon,
  onClick,
}: {
  value: string | number;
  label: string;
  color?: string;
  icon?: ReactNode;
  onClick?: () => void;
}) {
  const Comp = onClick ? 'button' : 'div';
  return (
    <Comp
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className="rounded-[18px] p-3 text-left min-h-[92px] flex flex-col justify-between active:scale-[0.98] transition-transform"
      style={glassStyle}
    >
      {icon ? (
        <span
          className="w-8 h-8 rounded-lg flex items-center justify-center mb-2"
          style={{ background: `${color}22`, color }}
        >
          {icon}
        </span>
      ) : (
        <span className="w-1.5 h-1.5 rounded-full mb-2" style={{ background: color, boxShadow: `0 0 8px ${color}` }} />
      )}
      <div>
        <p className="text-[20px] font-extrabold text-white tabular-nums leading-none">{value}</p>
        <p className="text-[10px] text-[#94A3B8] mt-1.5 leading-snug">{label}</p>
      </div>
    </Comp>
  );
}

export function DTChunkCard({
  german,
  portuguese,
  pct,
  icon,
  tint = '#8B5CF6',
  onClick,
}: {
  german: string;
  portuguese?: string;
  pct: number | null;
  icon?: ReactNode;
  tint?: string;
  onClick?: () => void;
}) {
  const bar = pct != null ? Math.max(4, Math.min(100, pct)) : 0;
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-[18px] p-3.5 text-left active:scale-[0.98] transition-transform"
      style={glassStyle}
    >
      <div className="flex items-center gap-3">
        <span
          className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0"
          style={{ background: `${tint}22`, color: tint, boxShadow: `0 0 14px ${tint}33` }}
        >
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-bold text-white truncate">{german}</p>
          {portuguese ? <p className="text-[11px] text-[#94A3B8] truncate mt-0.5">{portuguese}</p> : null}
          <div className="mt-2 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${bar}%`,
                background: `linear-gradient(90deg, ${tint}, #00F2FE)`,
                boxShadow: pct != null ? `0 0 8px ${tint}88` : undefined,
              }}
            />
          </div>
        </div>
        <span className="text-[14px] font-bold text-white tabular-nums shrink-0">
          {pct != null ? `${pct}%` : '—'}
        </span>
      </div>
    </button>
  );
}

export function DTProgressRing(props: {
  value: number;
  size?: number;
  stroke?: number;
  label?: string;
  sublabel?: string;
  color?: string;
}) {
  return (
    <div className="relative" style={{ filter: 'drop-shadow(0 0 14px rgba(139,92,246,0.35))' }}>
      <ProgressRing {...props} color={props.color || '#8B5CF6'} />
    </div>
  );
}

export function DTProgressBar({
  value,
  max = 100,
  color = '#8B5CF6',
  className = '',
}: {
  value: number;
  max?: number;
  color?: string;
  className?: string;
}) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className={`h-1.5 rounded-full overflow-hidden ${className}`} style={{ background: 'rgba(255,255,255,0.08)' }}>
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{
          width: `${Math.max(pct > 0 ? 4 : 0, pct)}%`,
          background: `linear-gradient(90deg, ${color}, #00F2FE)`,
          boxShadow: pct > 0 ? `0 0 8px ${color}99` : undefined,
        }}
      />
    </div>
  );
}

export function DTNeonButton({
  children,
  onClick,
  disabled,
  variant = 'primary',
  className = '',
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'accent' | 'soft';
  className?: string;
}) {
  return (
    <PrimaryButton
      variant={variant === 'accent' ? 'accent' : variant === 'soft' ? 'soft' : 'primary'}
      size="xl"
      full
      onClick={onClick}
      disabled={disabled}
      className={className}
    >
      {children}
    </PrimaryButton>
  );
}

export function DTIconButton({
  children,
  label,
  onClick,
  className = '',
}: {
  children: ReactNode;
  label: string;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <IconButton
      label={label}
      onClick={onClick}
      className={`w-10 h-10 rounded-full flex items-center justify-center text-white shrink-0 ${className}`}
      style={glassStyle}
    >
      {children}
    </IconButton>
  );
}

export function DTBadge({
  children,
  color = '#00F2FE',
}: {
  children: ReactNode;
  color?: string;
}) {
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold"
      style={{
        color,
        background: `${color}18`,
        border: `1px solid ${color}55`,
        boxShadow: `0 0 12px ${color}22`,
      }}
    >
      {children}
    </span>
  );
}

export function DTAudioOrb({ state = 'listening', size = 200 }: { state?: OrbState; size?: number }) {
  return <LiveAudioOrb state={state} size={size} />;
}

export function DTAudioWaveform({ active = true, bars = 16 }: { active?: boolean; bars?: number }) {
  const heights = Array.from({ length: bars }, (_, i) => 0.25 + ((i * 37) % 70) / 100);
  return (
    <div className="flex items-end justify-center gap-1 h-10" aria-hidden>
      {heights.map((h, i) => (
        <span
          key={i}
          className={`w-1 rounded-full ${active ? 'animate-wave-bar' : ''}`}
          style={{
            height: `${h * 100}%`,
            background: 'linear-gradient(180deg, #00F2FE, #8B5CF6)',
            animationDelay: `${i * 0.05}s`,
            opacity: active ? 1 : 0.35,
            boxShadow: active ? '0 0 8px rgba(0,242,254,0.5)' : undefined,
          }}
        />
      ))}
    </div>
  );
}

const LEVELS = ['L0', 'A1', 'A2', 'B1', 'B2'] as const;

export function DTLevelSelector({ current = 'L0' }: { current?: string }) {
  const idx = Math.max(0, LEVELS.findIndex((l) => l === current));
  return (
    <div className="flex items-center justify-between gap-2 px-1" aria-label="Nível atual">
      {LEVELS.map((lvl, i) => {
        const active = i === idx;
        const locked = i > idx;
        const done = i < idx;
        return (
          <div key={lvl} className="flex flex-col items-center gap-1.5 flex-1">
            <span
              className="w-12 h-12 rounded-full flex items-center justify-center text-[12px] font-bold transition-all"
              style={
                active
                  ? {
                      background: 'linear-gradient(145deg, #A855F7, #8B5CF6)',
                      color: '#fff',
                      boxShadow: '0 0 0 3px rgba(139,92,246,0.35), 0 0 22px rgba(139,92,246,0.55)',
                    }
                  : done
                    ? {
                        background: 'rgba(34,197,94,0.18)',
                        color: '#22C55E',
                        border: '1px solid rgba(34,197,94,0.4)',
                      }
                    : {
                        ...glassStyle,
                        color: '#64748B',
                        opacity: locked ? 0.7 : 1,
                      }
              }
            >
              {locked ? <IconLock size={14} /> : done ? '✓' : lvl}
            </span>
            <span className={`text-[10px] font-semibold ${active ? 'text-[#c4b5fd]' : 'text-[#64748B]'}`}>
              {lvl}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function DTSituationNode({
  label,
  detail,
  tint,
  icon,
  active,
  onClick,
}: {
  label: string;
  detail?: string;
  tint: string;
  icon: ReactNode;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-center gap-1 active:scale-95 transition-transform"
    >
      <span
        className="w-14 h-14 rounded-full flex items-center justify-center"
        style={{
          background: active ? `linear-gradient(145deg, ${tint}, #8B5CF6)` : `${tint}22`,
          color: active ? '#fff' : tint,
          border: `1px solid ${tint}${active ? 'ff' : '66'}`,
          boxShadow: active ? `0 0 20px ${tint}66` : undefined,
        }}
      >
        {icon}
      </span>
      <span className="text-[10px] font-bold text-white">{label}</span>
      {detail ? <span className="text-[9px] text-[#64748B] tabular-nums">{detail}</span> : null}
    </button>
  );
}

export function DTStat({
  label,
  value,
  tint,
}: {
  label: string;
  value: string;
  tint?: string;
}) {
  return (
    <DTGlassCard className="p-4">
      <p className="text-[10px] uppercase tracking-wide text-[#64748B]">{label}</p>
      <p className="text-[20px] font-bold text-white mt-1 tabular-nums" style={tint ? { color: tint } : undefined}>
        {value}
      </p>
    </DTGlassCard>
  );
}

export function DTEmptyState(props: {
  imageSrc: string;
  imageAlt?: string;
  title?: string;
  subtitle?: string;
  footer?: ReactNode;
}) {
  return <EmptyState {...props} />;
}

export function DTSettingsRow({
  icon,
  label,
  value,
  onClick,
  trailing,
}: {
  icon?: ReactNode;
  label: string;
  value?: string;
  onClick?: () => void;
  trailing?: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-3 px-1 py-3.5 text-left border-b border-white/[0.06] last:border-0 active:opacity-80"
    >
      {icon ? (
        <span className="w-9 h-9 rounded-xl flex items-center justify-center text-[#00F2FE]" style={glassStyle}>
          {icon}
        </span>
      ) : null}
      <span className="flex-1 min-w-0">
        <span className="block text-[14px] font-semibold text-white">{label}</span>
        {value ? <span className="block text-[12px] text-[#64748B] mt-0.5">{value}</span> : null}
      </span>
      {trailing}
    </button>
  );
}
