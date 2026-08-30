import { IconMic } from '@/components/ui/Icons';

export type OrbState = 'idle' | 'listening' | 'processing' | 'speaking' | 'error';

interface VoiceOrbProps {
  state: OrbState;
  size?: number;
}

export function VoiceOrb({ state, size = 200 }: VoiceOrbProps) {
  const animation =
    state === 'listening'
      ? 'animate-orb-listen'
      : state === 'speaking'
        ? 'animate-orb-breathe'
        : state === 'processing'
          ? 'animate-orb-think'
          : state === 'error'
            ? ''
            : '';

  const gradient =
    state === 'listening'
      ? 'from-[#ff6b6b] to-[#f5a623]'
      : state === 'processing'
        ? 'from-[#7a8699] to-[#5b6573]'
        : state === 'error'
          ? 'from-[#f87171] to-[#dc2626]'
          : 'from-[var(--color-orb-1)] to-[var(--color-orb-2)]';

  const halo =
    state === 'listening'
      ? 'bg-[#ff6b6b]/10'
      : state === 'error'
        ? 'bg-error/10'
        : 'bg-primary/10';

  return (
    <div
      className="relative flex items-center justify-center"
      style={{ width: size, height: size }}
      role="img"
      aria-label={
        state === 'listening' ? 'Ouvindo você' :
        state === 'speaking' ? 'Professor falando' :
        state === 'processing' ? 'Pensando' :
        state === 'error' ? 'Erro de conexão' : 'Pronto'
      }
    >
      {/* Halo / anéis de pulso */}
      {(state === 'listening' || state === 'speaking') && (
        <>
          <div className={`absolute w-full h-full rounded-full ${halo} animate-pulse-ring`} />
          <div className={`absolute w-full h-full rounded-full ${halo} animate-pulse-ring`} style={{ animationDelay: '0.6s' }} />
        </>
      )}

      {/* Núcleo */}
      <div
        className={`relative rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center transition-all duration-500 ${animation}`}
        style={{ width: size * 0.72, height: size * 0.72 }}
      >
        <div className="absolute inset-0 rounded-full bg-gradient-to-br from-white/15 to-transparent" />
        <div className="absolute inset-3 rounded-full bg-gradient-to-t from-black/10 to-transparent" />
        <div className="relative text-white/95 flex items-center justify-center">
          {state === 'processing' ? (
            <span className="flex gap-1.5">
              <span className="w-2 h-2 rounded-full bg-white animate-dot-bounce" />
              <span className="w-2 h-2 rounded-full bg-white animate-dot-bounce" style={{ animationDelay: '0.2s' }} />
              <span className="w-2 h-2 rounded-full bg-white animate-dot-bounce" style={{ animationDelay: '0.4s' }} />
            </span>
          ) : state === 'listening' ? (
            <AudioWave active />
          ) : state === 'speaking' ? (
            <AudioWave active />
          ) : state === 'error' ? (
            <span className="text-3xl">!</span>
          ) : (
            <IconMic size={size * 0.22} className="opacity-90" />
          )}
        </div>
      </div>
    </div>
  );
}

export function AudioWave({ active }: { active: boolean }) {
  const bars = [0, 0.15, 0.3, 0.45, 0.3, 0.15, 0];
  return (
    <div className="flex items-center gap-1 h-8">
      {bars.map((delay, i) => (
        <span
          key={i}
          className="w-1 rounded-full bg-white origin-bottom"
          style={{
            height: '100%',
            animation: active ? `wave-bar 0.9s ease-in-out ${delay}s infinite` : 'none',
            transform: active ? undefined : 'scaleY(0.3)',
          }}
        />
      ))}
    </div>
  );
}
