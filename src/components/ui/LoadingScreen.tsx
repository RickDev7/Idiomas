import { DT_ASSETS } from '@/assets/deutsch-turbo';

export function LoadingScreen({ label = 'Carregando…' }: { label?: string }) {
  return (
    <div className="flex flex-col h-full max-w-md mx-auto md:max-w-lg items-center justify-center gap-5 dt-page px-6">
      <div className="relative flex items-center justify-center">
        <span
          className="absolute inset-[-28%] rounded-full animate-pulse-ring"
          style={{ background: 'radial-gradient(circle, var(--voice-cyan-glow), transparent 70%)' }}
          aria-hidden
        />
        <span
          className="absolute inset-[-12%] rounded-full"
          style={{ background: 'radial-gradient(circle, color-mix(in srgb, var(--learning-violet) 28%, transparent), transparent 72%)' }}
          aria-hidden
        />
        <img
          src={DT_ASSETS.mascot}
          alt=""
          className="relative w-[88px] h-[88px] object-contain"
          style={{ filter: 'drop-shadow(0 8px 24px color-mix(in srgb, var(--voice-cyan) 35%, transparent))' }}
          draggable={false}
        />
      </div>
      <p className="text-[14px] font-semibold text-[var(--text-secondary)]">{label}</p>
    </div>
  );
}
