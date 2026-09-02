import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'ghost' | 'soft' | 'accent' | 'danger';
type Size = 'md' | 'lg' | 'xl';

interface PrimaryButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  full?: boolean;
  children: ReactNode;
}

const variants: Record<Variant, string> = {
  primary:
    'dt-cta-primary text-[#050816] font-bold shadow-md hover:brightness-110 active:scale-[0.98]',
  accent:
    'text-white font-bold shadow-md active:scale-[0.98] hover:brightness-105',
  ghost:
    'bg-transparent text-[#CBD5E1] hover:text-white hover:bg-white/5',
  soft:
    'dt-glass text-white hover:bg-white/5 active:scale-[0.98]',
  danger:
    'bg-[rgba(239,68,68,0.15)] text-[#EF4444] border border-[rgba(239,68,68,0.35)] hover:bg-[rgba(239,68,68,0.22)] active:scale-[0.98]',
};

const sizes: Record<Size, string> = {
  md: 'px-5 py-3 text-sm rounded-[18px] min-h-11',
  lg: 'px-6 py-4 text-[15px] rounded-[20px] min-h-12',
  xl: 'w-full py-4 text-[16px] font-bold rounded-[22px] min-h-14',
};

const accentStyle = {
  background: 'linear-gradient(135deg, #F97316 0%, #EC4899 100%)',
  boxShadow: '0 8px 28px rgba(236,72,153,0.28)',
} as const;

export function PrimaryButton({
  variant = 'primary',
  size = 'lg',
  full = false,
  className = '',
  style,
  children,
  ...rest
}: PrimaryButtonProps) {
  return (
    <button
      {...rest}
      style={variant === 'accent' ? { ...accentStyle, ...style } : style}
      className={`transition-all duration-200 disabled:opacity-40 disabled:active:scale-100 disabled:shadow-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00F2FE] ${variants[variant]} ${sizes[size]} ${full ? 'w-full' : ''} ${className}`}
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
      className={`flex items-center justify-center w-11 h-11 rounded-full text-[#CBD5E1] hover:text-white dt-glass transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00F2FE] ${className}`}
    >
      <span className="text-lg leading-none flex items-center justify-center">{children}</span>
    </button>
  );
}
