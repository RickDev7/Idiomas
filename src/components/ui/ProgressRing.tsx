interface ProgressRingProps {
  value: number;
  max?: number;
  size?: number;
  stroke?: number;
  label?: string;
  sublabel?: string;
  color?: string;
  color2?: string;
}

/** Ring premium com glow — design system DT. */
export function ProgressRing({
  value,
  max = 100,
  size = 120,
  stroke = 8,
  label,
  sublabel,
  color = '#8B5CF6',
  color2 = '#00F2FE',
}: ProgressRingProps) {
  const pct = Math.min(1, Math.max(0, value / max));
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - pct);
  const gradId = `dt-ring-${Math.round(size)}-${Math.round(value)}`;

  return (
    <div
      className="relative flex items-center justify-center"
      style={{
        width: size,
        height: size,
        filter: `drop-shadow(0 0 12px ${color}66)`,
      }}
    >
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={color} />
            <stop offset="100%" stopColor={color2} />
          </linearGradient>
        </defs>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={`url(#${gradId})`}
          strokeWidth={stroke}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-700 ease-out"
        />
      </svg>
      <div className="absolute flex flex-col items-center px-2 text-center">
        {label && (
          <span className="text-[22px] font-extrabold text-white tabular-nums leading-none font-[family-name:var(--font-display)]">
            {label}
          </span>
        )}
        {sublabel && <span className="text-[10px] text-[#64748B] mt-1 uppercase tracking-wide">{sublabel}</span>}
      </div>
    </div>
  );
}
