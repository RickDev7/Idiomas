interface TopBarProps {
  left?: React.ReactNode;
  right?: React.ReactNode;
  center?: React.ReactNode;
}

export function TopBar({ left, right, center }: TopBarProps) {
  return (
    <header className="flex items-center justify-between px-5 pt-5 pb-3 safe-top min-h-14">
      <div className="flex-1 flex items-center">{left}</div>
      {center && <div className="flex-1 flex justify-center">{center}</div>}
      <div className="flex-1 flex items-center justify-end">{right}</div>
    </header>
  );
}

export function ProgressDots({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex gap-1.5 items-center" aria-label={`Passo ${current + 1} de ${total}`}>
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          className={`h-1.5 rounded-full transition-all duration-300 ${
            i < current ? 'w-5 bg-primary' : i === current ? 'w-6 bg-primary' : 'w-5 bg-border'
          }`}
        />
      ))}
    </div>
  );
}
