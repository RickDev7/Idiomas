import type { CSSProperties, HTMLAttributes, ReactNode } from 'react';

export const glassStyle: CSSProperties = {
  background: 'var(--surface-glass)',
  border: '1px solid var(--border)',
  backdropFilter: 'blur(18px)',
  WebkitBackdropFilter: 'blur(18px)',
};

export const glassVioletStyle: CSSProperties = {
  ...glassStyle,
  border: '1px solid var(--border-violet)',
  boxShadow: '0 0 18px rgba(139, 92, 246, 0.18)',
};

export const glassCyanStyle: CSSProperties = {
  ...glassStyle,
  border: '1px solid var(--border-cyan)',
  boxShadow: '0 0 18px rgba(0, 242, 254, 0.14)',
};

type GlassCardProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
  variant?: 'default' | 'violet' | 'cyan';
  radius?: number;
  asButton?: boolean;
};

/** Card glass reutilizável — Design System Fase 1. */
export function GlassCard({
  children,
  variant = 'default',
  radius = 24,
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
