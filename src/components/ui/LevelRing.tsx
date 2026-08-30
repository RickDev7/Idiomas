export function LevelRing({
  value,
  levelDisplay,
  areaLabel,
  badge,
  badgeClass = 'bg-success/15 text-success',
  onDark = false,
}: {
  value: number;
  levelDisplay: string;
  areaLabel: string;
  badge: string;
  badgeClass?: string;
  /** Texto claro para usar sobre foto/fundo escuro. */
  onDark?: boolean;
}) {
  const size = 188;
  const stroke = 14;
  const radius = (size - stroke) / 2;
  const circ = 2 * Math.PI * radius;
  const pct = Math.min(1, Math.max(0, value / 100));
  const offset = circ * (1 - pct);
  const big = levelDisplay.length > 2 ? 'text-[40px]' : 'text-[56px]';
  const labelCls = onDark ? 'text-white/65' : 'text-text-faint';
  const valueCls = onDark ? 'text-white' : 'text-text';
  const track = onDark ? 'rgba(255,255,255,0.18)' : 'rgba(148,163,184,0.12)';

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }} role="img" aria-label={`${areaLabel}: nível ${levelDisplay}, ${value} de 100`}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <defs>
          <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#3b82f6" />
            <stop offset="100%" stopColor="#7c3aed" />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={track} strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="url(#ringGrad)"
          strokeWidth={stroke}
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-700 ease-out"
          style={{ filter: 'drop-shadow(0 0 8px rgba(124,58,237,0.55))' }}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className={`text-eyebrow tracking-[0.16em] font-semibold uppercase ${labelCls}`}>Nível atual</span>
        <span className={`${big} leading-none font-bold mt-1 ${valueCls}`} style={{ fontFamily: 'var(--font-display)' }}>{levelDisplay}</span>
        <span className="text-body text-primary font-semibold mt-1">{areaLabel}</span>
        <span className={`mt-2 inline-flex items-center px-2.5 py-1 rounded-full text-caption font-semibold ${badgeClass}`}>
          {badge}
        </span>
      </div>
    </div>
  );
}
