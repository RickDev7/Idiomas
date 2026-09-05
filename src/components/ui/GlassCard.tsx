import type { CSSProperties, HTMLAttributes, ReactNode } from 'react';

/** Estilos glass theme-aware (tokens em index.css). */
export const glassStyle: CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--border-subtle)',
  boxShadow: 'var(--shadow-md), inset 0 1px 0 var(--glass-inset)',
  backdropFilter: 'blur(18px)',
  WebkitBackdropFilter: 'blur(18px)',
};

export const glassVioletStyle: CSSProperties = {
  ...glassStyle,
  background: 'var(--surface-strong)',
  border: '1px solid color-mix(in srgb, var(--learning-violet) 40%, transparent)',
  boxShadow: 'var(--shadow-glow-purple), inset 0 1px 0 var(--glass-inset)',
};

export const glassCyanStyle: CSSProperties = {
  ...glassStyle,
  background: 'var(--surface-strong)',
  border: '1px solid color-mix(in srgb, var(--voice-cyan) 40%, transparent)',
  boxShadow: 'var(--shadow-glow), inset 0 1px 0 var(--glass-inset)',
};

type GlassCardProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
  variant?: 'default' | 'violet' | 'cyan';
  radius?: number;
  asButton?: boolean;
};

/** Card glass reutilizável — Design System Deutsch Turbo. */
export function GlassCard({
  children,
  variant = 'default',
  radius = 22,
  className = '',
  style,
  ...rest
}: GlassCardProps) {
  const base =
    variant === 'violet' ? glassVioletStyle : variant === 'cyan' ? glassCyanStyle : glassStyle;
  return (
    <div
      className={className}
      style={{ ...base, borderRadius: radius, ...style }}
      {...rest}
    >
      {children}
    </div>
  );
}
