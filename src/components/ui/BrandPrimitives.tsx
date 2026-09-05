/**
 * Primitivos de apresentação do redesign.
 * Só layout/visual — props e callbacks vêm do consumidor; sem lógica de negócio.
 */
import type { CSSProperties, ReactNode } from 'react';
import { GlassCard } from '@/components/ui/GlassCard';
import { ProgressRing } from '@/components/ui/ProgressRing';
import { LiveAudioOrb, VoiceOrb, type OrbState } from '@/components/ui/VoiceOrb';
import { EmptyState } from '@/components/ui/EmptyState';
import { DT_ASSETS } from '@/assets/deutsch-turbo';

export function AppShell({
  children,
  withTopography = true,
  className = '',
}: {
  children: ReactNode;
  withTopography?: boolean;
  className?: string;
}) {
  return (
    <div className={`relative flex flex-col h-full max-w-md mx-auto md:max-w-lg dt-page ${className}`}>
      {withTopography ? (
        <div
          aria-hidden
          className="dt-topo-bg pointer-events-none absolute inset-0"
          style={{
            backgroundImage: `url(${DT_ASSETS.topographic})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            mixBlendMode: 'screen',
          }}
        />
      ) : null}
      <div className="relative z-[1] flex flex-col h-full min-h-0">{children}</div>
    </div>
  );
}

export function SectionHeader({
  label,
  title,
  action,
}: {
  label?: string;
  title?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-end justify-between gap-3 mb-2">
      <div className="min-w-0">
        {label ? <p className="dt-label">{label}</p> : null}
        {title ? (
          <h2 className="text-[18px] font-bold text-[var(--text-primary)] font-[family-name:var(--font-display)] mt-0.5">
            {title}
          </h2>
        ) : null}
      </div>
      {action}
    </div>
  );
}

export function MetricCard({
  value,
  label,
  accent = 'violet',
  icon,
}: {
  value: string | number;
  label: string;
  accent?: 'violet' | 'cyan' | 'coral';
  icon?: ReactNode;
}) {
  const color =
    accent === 'cyan'
      ? 'var(--voice-cyan)'
      : accent === 'coral'
        ? 'var(--active-coral)'
        : 'var(--learning-violet)';
  return (
    <GlassCard className="p-3.5 min-h-[72px]">
      <div className="flex items-start gap-2.5">
        {icon ? (
          <span
            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: `color-mix(in srgb, ${color} 18%, transparent)`, color }}
          >
            {icon}
          </span>
        ) : null}
        <div className="min-w-0">
          <p className="text-[20px] font-extrabold tabular-nums leading-none" style={{ color }}>
            {value}
          </p>
          <p className="text-[12px] text-[var(--text-secondary)] mt-1 leading-snug">{label}</p>
        </div>
      </div>
    </GlassCard>
  );
}

export function PrimaryActionCard({
  eyebrow,
  title,
  detail,
  meta,
  timeLabel,
  actionLabel,
  onAction,
  disabled,
}: {
  eyebrow: string;
  title: string;
  detail?: string;
  meta?: string;
  /** Ex.: "20 min" — pill na referência */
  timeLabel?: string;
  actionLabel: string;
  onAction: () => void;
  disabled?: boolean;
}) {
  // Referência: título "Continuar curso" grande + subtítulo curto + 20 min + play coral
  return (
    <section aria-label={eyebrow} className="px-5">
      <button
        type="button"
        onClick={onAction}
        disabled={disabled}
        aria-label={actionLabel}
        className="relative w-full overflow-hidden rounded-[26px] px-5 pt-5 pb-4 dt-hero-coral text-left min-h-[156px] active:scale-[0.99] transition-transform disabled:opacity-50"
      >
        <span className="absolute -top-20 -right-12 w-48 h-48 rounded-full bg-white/15 blur-3xl pointer-events-none" />
        <span className="absolute -bottom-24 -left-10 w-56 h-56 rounded-full bg-[#FF2D55]/20 blur-3xl pointer-events-none" />
        <div className="relative flex flex-col min-h-[124px]">
          <div className="min-w-0 pr-16">
            <h2 className="text-[26px] leading-[1.15] font-extrabold text-white font-[family-name:var(--font-display)]">
              {eyebrow}
            </h2>
            <p className="mt-2 text-[15px] text-white/90 leading-snug line-clamp-2">
              {title || detail || 'Seu próximo treino está pronto'}
            </p>
          </div>
          <div className="mt-auto pt-4 flex items-end justify-between gap-3">
            {timeLabel || meta ? (
              <span
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px] font-semibold text-white/95"
                style={{ background: 'rgba(0,0,0,0.22)' }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
                  <path d="M12 7v5l3 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
                {timeLabel || meta}
              </span>
            ) : (
              <span />
            )}
            <span
              className="shrink-0 w-[58px] h-[58px] rounded-full bg-white flex items-center justify-center"
              style={{ boxShadow: '0 0 0 6px rgba(255,255,255,0.18), 0 10px 28px rgba(0,0,0,0.28)' }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="var(--active-coral)" aria-hidden>
                <path d="M8 5v14l11-7L8 5z" />
              </svg>
            </span>
          </div>
        </div>
      </button>
    </section>
  );
}

export function StatusChip({
  children,
  tone = 'neutral',
}: {
  children: ReactNode;
  tone?: 'neutral' | 'cyan' | 'violet' | 'coral' | 'success' | 'warning' | 'danger';
}) {
  const styles: Record<string, CSSProperties> = {
    neutral: { background: 'rgba(255,255,255,0.06)', color: 'var(--text-secondary)' },
    cyan: { background: 'var(--voice-cyan-glow)', color: 'var(--voice-cyan)' },
    violet: { background: 'color-mix(in srgb, var(--learning-violet) 20%, transparent)', color: 'var(--learning-violet)' },
    coral: { background: 'color-mix(in srgb, var(--active-coral) 20%, transparent)', color: 'var(--active-coral)' },
    success: { background: 'color-mix(in srgb, var(--success) 18%, transparent)', color: 'var(--success)' },
    warning: { background: 'color-mix(in srgb, var(--warning) 18%, transparent)', color: 'var(--warning)' },
    danger: { background: 'color-mix(in srgb, var(--danger) 18%, transparent)', color: 'var(--danger)' },
  };
  return (
    <span
      className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold"
      style={styles[tone]}
    >
      {children}
    </span>
  );
}

export function LearningPathDecoration({ className = '' }: { className?: string }) {
  return (
    <img
      src={DT_ASSETS.learningJourney}
      alt=""
      draggable={false}
      className={`w-full max-h-[140px] object-contain object-center opacity-90 ${className}`}
    />
  );
}

export function VoiceStage({
  state,
  size = 200,
  useAsset = true,
  children,
}: {
  state: OrbState;
  size?: number;
  useAsset?: boolean;
  children?: ReactNode;
}) {
  return (
    <div className="relative flex flex-col items-center justify-center gap-3 py-2" aria-label="Área de voz">
      {useAsset ? (
        <div className="relative" style={{ width: size, height: size }}>
          <img
            src={DT_ASSETS.voiceOrb}
            alt=""
            draggable={false}
            className={`absolute inset-0 w-full h-full object-contain pointer-events-none select-none ${
              state === 'listening' || state === 'speaking' ? 'animate-orb-breathe' : ''
            }`}
            style={{
              opacity: state === 'processing' ? 0.55 : 1,
              filter: state === 'error' ? 'grayscale(0.4) saturate(0.7)' : undefined,
            }}
          />
          <span className="sr-only">
            {state === 'listening'
              ? 'Ouvindo você'
              : state === 'speaking'
                ? 'Professor falando'
                : state === 'processing'
                  ? 'Pensando'
                  : state === 'error'
                    ? 'Erro de conexão'
                    : 'Pronto'}
          </span>
        </div>
      ) : (
        <LiveAudioOrb state={state} size={size} />
      )}
      {children}
    </div>
  );
}

export function TeacherTranscriptCard({
  german,
  portuguese,
  speakerLabel = 'Professor',
}: {
  german: string;
  portuguese?: string | null;
  speakerLabel?: string;
}) {
  return (
    <GlassCard variant="cyan" className="p-4 sm:p-5 w-full" role="region" aria-label={speakerLabel}>
      <p className="text-[10px] uppercase tracking-[0.16em] font-bold text-[var(--voice-cyan)] mb-2">
        {speakerLabel}
      </p>
      <p className="text-[22px] sm:text-[24px] font-bold leading-snug text-[var(--text-primary)] font-[family-name:var(--font-display)]">
        {german}
      </p>
      {portuguese ? (
        <p className="mt-2 text-[14px] text-[var(--text-secondary)] leading-snug">{portuguese}</p>
      ) : null}
    </GlassCard>
  );
}

export function TranslationCard({ children }: { children: ReactNode }) {
  return (
    <GlassCard className="p-3.5">
      <p className="text-[13px] text-[var(--text-secondary)] leading-snug">{children}</p>
    </GlassCard>
  );
}

export function HintDrawer({
  open,
  onToggle,
  label = 'Ver pista',
  children,
}: {
  open: boolean;
  onToggle: () => void;
  label?: string;
  children: ReactNode;
}) {
  return (
    <div className="w-full">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="w-full min-h-[44px] rounded-[16px] text-[13px] font-semibold text-[var(--text-secondary)] border border-[var(--border-subtle)] bg-[var(--surface)] px-4 active:scale-[0.99] transition-transform duration-200"
      >
        {label}
      </button>
      {open ? <div className="mt-2 animate-fade-soft">{children}</div> : null}
    </div>
  );
}

export function ReviewCard({
  german,
  portuguese,
}: {
  german: string;
  portuguese?: string | null;
}) {
  return (
    <GlassCard className="p-5 sm:p-6 text-center min-h-[160px] flex flex-col justify-center">
      <p className="text-[24px] sm:text-[28px] font-extrabold leading-snug text-[var(--text-primary)] font-[family-name:var(--font-display)]">
        {german}
      </p>
      {portuguese ? (
        <p className="mt-3 text-[14px] text-[var(--text-secondary)]">{portuguese}</p>
      ) : null}
    </GlassCard>
  );
}

export function ThemePreviewCard({
  label,
  active,
  onSelect,
  preview,
}: {
  label: string;
  active: boolean;
  onSelect: () => void;
  preview: 'dark' | 'light' | 'system';
}) {
  const swatch =
    preview === 'light'
      ? 'linear-gradient(135deg, #E8EEF6, #FFFFFF)'
      : preview === 'system'
        ? 'linear-gradient(135deg, #0B0F19 50%, #F3F5F9 50%)'
        : 'linear-gradient(135deg, #0B0F19, #172033)';
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      className="flex-1 min-w-0 min-h-[88px] rounded-[18px] p-3 text-left transition-all duration-200 active:scale-[0.98]"
      style={{
        background: 'var(--surface)',
        border: active
          ? '2px solid var(--voice-cyan)'
          : '1px solid var(--border-subtle)',
        boxShadow: active ? 'var(--shadow-glow)' : 'var(--shadow-sm)',
      }}
    >
      <span
        className="block h-8 rounded-lg mb-2 border border-white/10"
        style={{ background: swatch }}
        aria-hidden
      />
      <span className="text-[13px] font-semibold text-[var(--text-primary)]">{label}</span>
    </button>
  );
}

export function LoadingState({ label = 'Carregando…' }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16" role="status" aria-live="polite">
      <div
        className="w-12 h-12 rounded-full border-2 border-[var(--voice-cyan)] border-t-transparent animate-spin motion-reduce:animate-none"
        aria-hidden
      />
      <p className="text-[14px] text-[var(--text-secondary)]">{label}</p>
    </div>
  );
}

export function ErrorState({
  title = 'Algo deu errado',
  detail,
  action,
}: {
  title?: string;
  detail?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12 px-4 text-center" role="alert">
      <img
        src={DT_ASSETS.mascot}
        alt=""
        className="w-20 h-20 object-contain mb-1 opacity-90"
        draggable={false}
      />
      <p className="text-[18px] font-bold text-[var(--text-primary)] font-[family-name:var(--font-display)]">{title}</p>
      {detail ? <p className="text-[14px] text-[var(--text-secondary)] max-w-[28ch]">{detail}</p> : null}
      {action}
    </div>
  );
}

export { VoiceOrb, LiveAudioOrb, EmptyState, ProgressRing };
export type { OrbState };
