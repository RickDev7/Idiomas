import type { ReactNode } from 'react';

export function EmptyState({
  imageSrc,
  imageAlt = '',
  title,
  subtitle,
  footer,
}: {
  imageSrc: string;
  imageAlt?: string;
  title?: string;
  subtitle?: string;
  footer?: ReactNode;
}) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-6 animate-fade-in px-1 pt-6 pb-2">
      {/* Ilustração integrada com halo — não um quadrado solto */}
      <div className="relative w-[200px] h-[200px] flex items-center justify-center">
        <span
          className="absolute inset-[-12%] rounded-full"
          style={{
            background:
              'radial-gradient(circle, rgba(139,92,246,0.45) 0%, rgba(124,58,237,0.18) 42%, transparent 70%)',
          }}
          aria-hidden
        />
        <span
          className="absolute inset-[8%] rounded-full blur-2xl opacity-70"
          style={{ background: 'radial-gradient(circle, rgba(236,72,153,0.25) 0%, transparent 65%)' }}
          aria-hidden
        />
        <img
          src={imageSrc}
          alt={imageAlt}
          className="relative w-[168px] h-[168px] object-contain"
          style={{
            filter: 'drop-shadow(0 12px 40px color-mix(in srgb, var(--learning-violet) 40%, transparent))',
          }}
          draggable={false}
        />
      </div>
      {title && <p className="text-[18px] font-semibold text-[var(--text-primary)] text-center font-[family-name:var(--font-display)]">{title}</p>}
      {subtitle && <p className="dt-body text-center -mt-2">{subtitle}</p>}
      {footer && <div className="w-full mt-2">{footer}</div>}
    </div>
  );
}

export function SkeletonBlock({ className = '' }: { className?: string }) {
  return (
    <div
      className={`rounded-[22px] ${className}`}
      style={{
        background: 'linear-gradient(90deg, var(--skeleton-from) 0%, var(--skeleton-mid) 50%, var(--skeleton-from) 100%)',
        backgroundSize: '200% 100%',
        animation: 'shimmer 1.4s ease-in-out infinite',
      }}
      aria-hidden
    />
  );
}
