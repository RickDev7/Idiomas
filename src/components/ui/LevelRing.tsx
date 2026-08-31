import type { ReactNode } from 'react';

export function LevelRing({
  value,
  levelDisplay,
  areaLabel,
  badge,
  badgeClass = 'bg-success/15 text-success',
  onDark = true,
  gradientFrom = '#00F2FE',
  gradientMid = '#3B82F6',
  gradientTo = '#8B5CF6',
  centerIcon,
}: {
  value: number;
  levelDisplay: string;
  areaLabel: string;
  badge: string;
  badgeClass?: string;
  onDark?: boolean;
  gradientFrom?: string;
  gradientMid?: string;
  gradientTo?: string;
  centerIcon?: ReactNode;
}) {
  const size = 220;
  const stroke = 16;
  const radius = (size - stroke) / 2;
  const circ = 2 * Math.PI * radius;
  const pct = Math.min(1, Math.max(0, value / 100));
  const offset = circ * (1 - pct);
  const big = levelDisplay.length > 2 ? 'text-[40px]' : 'text-[52px]';
  const labelCls = onDark ? 'text-[#94A3B8]' : 'text-text-faint';
  const valueCls = onDark ? 'text-white' : 'text-text';
  const track = 'rgba(255,255,255,0.1)';
  const gradId = `ringGrad-${gradientFrom.replace('#', '')}-${gradientTo.replace('#', '')}`;

  return (
    <div
      className="relative flex items-center justify-center"
      style={{ width: size, height: size }}
      role="img"
      aria-label={`${areaLabel}: nível ${levelDisplay}, ${value}%`}
    >
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <defs>
          <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={gradientFrom} />
            <stop offset="45%" stopColor={gradientMid} />
            <stop offset="100%" stopColor={gradientTo} />
          </linearGradient>
          <filter id={`${gradId}-glow`} x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="3.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={track} strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={`url(#${gradId})`}
          strokeWidth={stroke}
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-700 ease-out"
          filter={`url(#${gradId}-glow)`}
          style={{ filter: `drop-shadow(0 0 12px ${gradientFrom}99)` }}
        />
      </svg>
      <div className="absolute flex flex-col items-center px-2 text-center">
        <span className={`text-[10px] tracking-[0.16em] font-semibold uppercase ${labelCls}`}>Nível atual</span>
        <span className={`${big} leading-none font-bold mt-1 ${valueCls}`} style={{ fontFamily: 'var(--font-display)' }}>
          {levelDisplay}
        </span>
        <span className={`mt-1.5 inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold ${badgeClass}`}>
          {badge}
        </span>
        <span className={`mt-1.5 text-[12px] font-semibold ${labelCls}`}>
          {value}% {areaLabel}
        </span>
        {centerIcon && <span className="mt-2 text-[#10B981]">{centerIcon}</span>}
      </div>
    </div>
  );
}
