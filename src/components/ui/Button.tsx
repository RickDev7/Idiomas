import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'ghost' | 'soft' | 'accent';
type Size = 'md' | 'lg' | 'xl';

interface PrimaryButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  full?: boolean;
  children: ReactNode;
}

const variants: Record<Variant, string> = {
  primary:
    'bg-primary text-white shadow-md shadow-primary/25 hover:bg-primary-dark active:scale-[0.98]',
  accent:
    'bg-gradient-to-br from-accent to-[#ff7a3c] text-white shadow-md shadow-accent/25 hover:brightness-105 active:scale-[0.98]',
  ghost:
    'bg-transparent text-text-muted hover:text-text hover:bg-surface-light/50',
  soft:
    'bg-surface-light text-text hover:bg-surface-elevated active:scale-[0.98] border border-border/60',
};

const sizes: Record<Size, string> = {
  md: 'px-5 py-3 text-sm rounded-[var(--radius-md)] min-h-11',
  lg: 'px-6 py-4 text-base rounded-[var(--radius-lg)] min-h-12',
  xl: 'w-full py-5 text-lg font-semibold rounded-[var(--radius-xl)] min-h-14',
};

export function PrimaryButton({
  variant = 'primary',
  size = 'lg',
  full = false,
  className = '',
  children,
  ...rest
}: PrimaryButtonProps) {
  return (
    <button
      {...rest}
      className={`font-medium transition-all duration-200 disabled:opacity-40 disabled:active:scale-100 disabled:shadow-none ${variants[variant]} ${sizes[size]} ${full ? 'w-full' : ''} ${className}`}
    >
      {children}
    </button>
  );
}

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  label: string;
}

export function IconButton({ children, label, className = '', ...rest }: IconButtonProps) {
  return (
    <button
      {...rest}
      aria-label={label}
      className={`flex items-center justify-center w-11 h-11 rounded-[var(--radius-md)] text-text-muted hover:text-text hover:bg-surface-light/60 transition-colors ${className}`}
    >
      <span className="text-lg leading-none">{children}</span>
    </button>
  );
}
