import type { ReactNode } from 'react';

export function TopicCard({
  label,
  color,
  icon,
  onClick,
}: {
  label: string;
  color: string;
  icon: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Conversar sobre ${label}`}
      className="flex flex-col items-center justify-center gap-2 p-3 rounded-[20px] dt-glass hover:border-primary/40 active:scale-95 transition-all min-h-[76px] w-full"
    >
      <span
        className="w-11 h-11 rounded-2xl flex items-center justify-center"
        style={{ background: `${color}22`, color }}
        aria-hidden
      >
        {icon}
      </span>
      <span className="text-caption font-semibold text-text text-center leading-tight">{label}</span>
    </button>
  );
}
