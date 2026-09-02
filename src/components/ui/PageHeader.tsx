import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { IconBack, IconGear } from '@/components/ui/Icons';
import { glassStyle } from '@/components/ui/GlassCard';

export function AppHeader({ onSettings }: { onSettings?: () => void } = {}) {
  const navigate = useNavigate();
  return (
    <header className="flex items-center justify-between px-5 pt-3 pb-1 safe-top shrink-0">
      <div className="flex items-center gap-2.5 min-h-11">
        <span
          className="w-9 h-9 rounded-[12px] flex items-end justify-center gap-0.5 pb-1.5"
          style={{
            background: 'linear-gradient(145deg, #00F2FE 0%, #8B5CF6 100%)',
            boxShadow: '0 0 16px rgba(0,242,254,0.28)',
          }}
          aria-hidden
        >
          <span className="w-1 h-2 bg-white/95 rounded-sm" />
          <span className="w-1 h-3.5 bg-white/95 rounded-sm" />
          <span className="w-1 h-2.5 bg-white/95 rounded-sm" />
        </span>
        <span className="dt-label !text-[#CBD5E1] tracking-[0.14em]">DEUTSCH TURBO</span>
      </div>
      <button
        type="button"
        onClick={onSettings ?? (() => navigate('/configuracoes'))}
        aria-label="Configurações"
        className="min-h-11 min-w-11 flex items-center justify-center rounded-full text-[#CBD5E1] hover:text-white transition-colors"
        style={glassStyle}
      >
        <IconGear size={18} />
      </button>
    </header>
  );
}

/** Header padrão: voltar + título + subtítulo opcional. */
export function DtPageHeader({
  title,
  subtitle,
  onBack,
  right,
}: {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  right?: ReactNode;
}) {
  const navigate = useNavigate();
  return (
    <header className="px-5 pt-4 safe-top shrink-0 flex items-center gap-3">
      <button
        type="button"
        onClick={onBack ?? (() => navigate(-1))}
        aria-label="Voltar"
        className="w-10 h-10 rounded-full flex items-center justify-center text-white shrink-0"
        style={glassStyle}
      >
        <IconBack size={18} />
      </button>
      <div className="min-w-0 flex-1">
        <h1 className="text-[18px] font-bold text-white font-[family-name:var(--font-display)] tracking-wide truncate">
          {title}
        </h1>
        {subtitle ? <p className="text-[12px] text-[#CBD5E1] truncate">{subtitle}</p> : null}
      </div>
      {right}
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
    <p className="dt-label" style={{ color }}>
      {children}
    </p>
  );
}

export function PageTitle({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <h1 className={`font-[family-name:var(--font-display)] text-[24px] sm:text-[28px] leading-[1.15] font-bold tracking-tight text-white ${className}`}>
      {children}
    </h1>
  );
}

export function PageSubtitle({ children }: { children: React.ReactNode }) {
  return <p className="text-[14px] text-[#CBD5E1] mt-2 leading-relaxed">{children}</p>;
}
