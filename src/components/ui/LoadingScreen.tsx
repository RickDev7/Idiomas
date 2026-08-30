export function LoadingScreen({ label = 'Carregando…' }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 bg-background animate-fade-soft">
      <div className="relative w-16 h-16">
        <div className="absolute inset-0 rounded-full bg-gradient-to-br from-primary to-primary-dark animate-orb-breathe" />
        <div className="absolute inset-2 rounded-full bg-background flex items-center justify-center text-primary font-bold text-sm">DT</div>
      </div>
      <p className="text-text-faint text-sm">{label}</p>
    </div>
  );
}
