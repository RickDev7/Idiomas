/**
 * Camada de apresentação premium — só UI.
 * Sem lógica pedagógica / Live / progresso.
 */
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { LiveAudioOrb, type OrbState } from '@/components/ui/VoiceOrb';
import { IconMic, IconSpeaker } from '@/components/ui/Icons';

function useSessionOrbSize(override?: number): number {
  const [size, setSize] = useState(override ?? 200);
  useEffect(() => {
    if (override && override > 0) {
      setSize(override);
      return;
    }
    const calc = () => {
      const h = window.innerHeight;
      // Referência: orb dominante — ~28–32% da altura
      setSize(Math.round(Math.min(260, Math.max(168, h * 0.3))));
    };
    calc();
    window.addEventListener('resize', calc);
    return () => window.removeEventListener('resize', calc);
  }, [override]);
  return size;
}

/** Coluna de app mobile (~390–420px), centralizada no desktop. */
export function AppColumn({
  children,
  className = '',
  immersive = false,
}: {
  children: ReactNode;
  className?: string;
  immersive?: boolean;
}) {
  return (
    <div
      className={`dt-app-column relative flex flex-col h-full mx-auto overflow-hidden dt-page ${
        immersive ? 'dt-app-column--immersive' : ''
      } ${className}`}
    >
      <div className="dt-atmosphere" aria-hidden />
      <div className="relative z-[1] flex flex-col h-full min-h-0">{children}</div>
    </div>
  );
}

/** Progresso em segmentos ▰ ▰ ▰ ▱ */
export function SegmentedProgress({
  current,
  total,
  className = '',
}: {
  current: number;
  total: number;
  className?: string;
}) {
  const n = Math.max(1, Math.min(8, total || 4));
  const filled = Math.max(0, Math.min(n, current));
  return (
    <div
      className={`flex items-center justify-center gap-[5px] ${className}`}
      role="progressbar"
      aria-valuenow={filled}
      aria-valuemin={0}
      aria-valuemax={n}
      aria-label="Progresso da sessão"
    >
      {Array.from({ length: n }).map((_, i) => {
        const on = i < filled;
        return (
          <span
            key={i}
            className="rounded-full motion-safe:transition-all duration-500"
            style={{
              width: on ? 20 : 16,
              height: 4,
              background: on
                ? 'linear-gradient(90deg, #00F2FE, #3A7BD5 55%, #8B5CF6)'
                : 'rgba(255,255,255,0.12)',
              boxShadow: on ? '0 0 8px rgba(0,242,254,0.4)' : undefined,
              opacity: on ? 1 : 0.5,
            }}
          />
        );
      })}
    </div>
  );
}

export function PremiumOrb({
  state,
  size: sizeProp,
  label,
}: {
  state: OrbState;
  size?: number;
  label?: string;
}) {
  const size = useSessionOrbSize(sizeProp);
  return (
    <div className="dt-premium-orb flex flex-col items-center">
      <div className="relative">
        <span className="dt-premium-orb__sparkles" aria-hidden />
        <LiveAudioOrb state={state} size={size} />
      </div>
      {label ? (
        <p
          className="mt-2 text-[10px] font-bold tracking-[0.16em] uppercase"
          style={{
            color:
              state === 'speaking'
                ? 'var(--learning-violet)'
                : state === 'listening'
                  ? 'var(--voice-cyan)'
                  : 'var(--text-faint)',
          }}
        >
          {label}
        </p>
      ) : null}
    </div>
  );
}

/** Card de fala compacto — DE dominante, PT secundário, sem pedágogo. */
export function SpeechSurface({
  german,
  portuguese,
  onReplay,
  emptyHint,
  roleLabel,
}: {
  german?: string;
  portuguese?: string;
  onReplay?: () => void;
  emptyHint?: string;
  roleLabel?: string;
}) {
  if (!german) {
    return (
      <div className="dt-speech-surface dt-speech-surface--compact text-center">
        <p className="text-[14px] text-[var(--text-secondary)] leading-snug">{emptyHint}</p>
      </div>
    );
  }
  return (
    <div className="dt-speech-surface dt-speech-surface--compact motion-safe:animate-fade-soft">
      {roleLabel ? (
        <p className="text-[9px] font-bold tracking-[0.14em] uppercase text-[var(--text-faint)] mb-1.5">
          {roleLabel}
        </p>
      ) : null}
      <div className="flex items-start gap-2.5">
        <p className="dt-speech-de flex-1 font-extrabold text-[var(--text-primary)] font-[family-name:var(--font-display)]">
          {german}
        </p>
        {onReplay ? (
          <button
            type="button"
            aria-label="Ouvir novamente"
            onClick={onReplay}
            className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-[var(--voice-cyan)]"
            style={{ background: 'var(--voice-cyan-glow)' }}
          >
            <IconSpeaker size={14} />
          </button>
        ) : null}
      </div>
      {portuguese ? <p className="dt-speech-pt mt-2 font-medium">{portuguese}</p> : null}
    </div>
  );
}

export function MicCTA({
  active,
  disabled,
  label,
  onClick,
  size = 96,
}: {
  active?: boolean;
  disabled?: boolean;
  label: string;
  onClick: () => void;
  size?: number;
}) {
  return (
    <div className="flex flex-col items-center">
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-label={label}
        className="dt-mic-cta relative active:scale-[0.96] transition-transform disabled:opacity-70"
      >
        <span className={`dt-mic-cta__halo ${active ? 'is-hot' : ''}`} aria-hidden />
        <span
          className={`dt-mic-cta__core relative z-[1] rounded-full flex items-center justify-center ${
            active ? 'is-hot' : ''
          }`}
          style={{ width: size, height: size }}
        >
          <IconMic size={Math.round(size * 0.36)} className="text-[#0B0F19]" />
        </span>
      </button>
      <p className="mt-2 text-[13px] font-extrabold tracking-wide text-[var(--text-primary)]">
        {label}
      </p>
    </div>
  );
}

export function DiscreteActions({
  items,
}: {
  items: Array<{ key: string; icon: ReactNode; label: string; onClick: () => void }>;
}) {
  return (
    <div className="flex items-center justify-center gap-6">
      {items.map((a) => (
        <button
          key={a.key}
          type="button"
          onClick={a.onClick}
          className="flex flex-col items-center gap-1 active:scale-95 transition-transform"
          aria-label={a.label}
        >
          <span className="dt-discrete-action w-9 h-9 rounded-full flex items-center justify-center text-[var(--text-secondary)]">
            {a.icon}
          </span>
          <span className="text-[9px] font-semibold text-[var(--text-faint)]">{a.label}</span>
        </button>
      ))}
    </div>
  );
}

export function GlassRow({
  icon,
  label,
  value,
  tone = 'violet',
  onClick,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  tone?: 'violet' | 'cyan' | 'coral';
  onClick?: () => void;
}) {
  const color =
    tone === 'cyan'
      ? 'var(--voice-cyan)'
      : tone === 'coral'
        ? 'var(--active-coral)'
        : 'var(--learning-violet)';
  const labelColor =
    tone === 'coral'
      ? 'var(--active-coral)'
      : tone === 'cyan'
        ? 'var(--voice-cyan)'
        : 'color-mix(in srgb, var(--learning-violet) 55%, #B8C4E0)';

  const body = (
    <>
      <span
        className="w-12 h-12 rounded-[16px] flex items-center justify-center shrink-0"
        style={{ background: `color-mix(in srgb, ${color} 18%, transparent)`, color }}
        aria-hidden
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1 text-left flex flex-col justify-center gap-1">
        <span className="block text-[12.5px] font-semibold leading-none" style={{ color: labelColor }}>
          {label}
        </span>
        <span className="block text-[15.5px] font-semibold text-[var(--text-primary)] leading-tight line-clamp-1">
          {value}
        </span>
      </span>
      <span
        className="text-[19px] shrink-0 pl-1 leading-none font-light"
        style={{ color: 'rgba(255,255,255,0.28)' }}
        aria-hidden
      >
        ›
      </span>
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label={`${label}: ${value}`}
        className="w-full text-left active:scale-[0.99] transition-transform duration-150"
      >
        <div className="dt-glass-row flex items-center gap-4 px-4 min-h-[72px] h-[72px]">{body}</div>
      </button>
    );
  }
  return (
    <div className="dt-glass-row flex items-center gap-4 px-4 min-h-[72px] h-[72px]" role="group" aria-label={`${label}: ${value}`}>
      {body}
    </div>
  );
}

/**
 * Extrai fala curta para o palco.
 * Preferência: target curricular > 1ª frase curta > texto completo truncado.
 * Pedagogy longa vai para overflow (pista).
 */
export function pickStageSpeech(opts: {
  shownGerman: string;
  targetPhrase?: string | null;
}): { primary: string; overflow: string | null } {
  const de = (opts.shownGerman || '').trim();
  const target = (opts.targetPhrase || '').trim();
  if (!de && !target) return { primary: '', overflow: null };

  const pedagogy =
    /significa|vamos aprender|escute|repita|agora você|jetzt wiederholen|bedeutet|lass uns|hören sie|wiederholen sie|vamos|escuta|repita|nova frase|frase nova|próximo passo|agora diga|try to say|listen|repeat|learn a new/i.test(
      de,
    );

  if (target && (pedagogy || (de && de.length > 72 && de !== target))) {
    return { primary: target, overflow: de && de !== target ? de : null };
  }
  if (!de) return { primary: target, overflow: null };

  if (de.length > 110) {
    const first = de.split(/(?<=[.!?…])\s+/)[0]?.trim() || de;
    if (first.length >= 8 && first.length < de.length * 0.8) {
      return { primary: first, overflow: de };
    }
    return { primary: `${de.slice(0, 96).trim()}…`, overflow: de };
  }
  return { primary: de, overflow: null };
}

/** Nunca exibir IDs técnicos (ex.: l0-guten-morgen) na UI. */
export function humanPhraseLabel(
  german: string | undefined | null,
  phraseId?: string | null,
  fallback = 'Frase para revisar',
): string {
  const g = (german || '').trim();
  if (!g) return fallback;
  // ID técnico: kebab/snake sem espaços e sem letras alemãs típicas de frase
  const looksLikeId =
    /^[a-z0-9]+([-_][a-z0-9]+)+$/i.test(g) && !/[äöüß.?!,\s]/i.test(g);
  if (looksLikeId) {
    if (phraseId && g === phraseId) return fallback;
    return fallback;
  }
  return g;
}
