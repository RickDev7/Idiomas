import { useNavigate } from 'react-router-dom';
import { IconGear } from '@/components/ui/Icons';

export function AppHeader({ onSettings }: { onSettings?: () => void } = {}) {
  const navigate = useNavigate();
  return (
    <header className="flex items-center justify-between px-5 pt-3 pb-1 safe-top shrink-0">
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
        onClick={onSettings ?? (() => navigate('/configuracoes'))}
        aria-label="Configurações"
        className="min-h-11 min-w-11 flex items-center justify-center rounded-full dt-glass hover:bg-surface-light transition-colors"
      >
        <IconGear size={18} />
      </button>
    </header>
  );
}

export function SectionLabel({
  children,
  tone = 'blue',
}: {
  children: string;
  tone?: 'blue' | 'pink' | 'purple' | 'green';
}) {
  const color =
    tone === 'pink' ? 'var(--pink)' :
    tone === 'purple' ? 'var(--purple)' :
    tone === 'green' ? 'var(--success)' :
    'var(--primary)';
  return (
    <p className="text-eyebrow tracking-[0.2em] font-semibold uppercase" style={{ color }}>
      {children}
    </p>
  );
}

export function PageTitle({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <h1 className={`font-[family-name:var(--font-display)] text-[28px] sm:text-[32px] leading-[1.15] font-bold tracking-tight text-text ${className}`}>
      {children}
    </h1>
  );
}

export function PageSubtitle({ children }: { children: React.ReactNode }) {
  return <p className="text-secondary text-text-muted mt-2 leading-relaxed">{children}</p>;
}
