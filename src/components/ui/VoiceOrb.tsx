import { IconMic } from '@/components/ui/Icons';

export type OrbState = 'idle' | 'listening' | 'processing' | 'speaking' | 'error';

interface VoiceOrbProps {
  state: OrbState;
  size?: number;
}

/** Orb clássico (sessão). */
export function VoiceOrb({ state, size = 200 }: VoiceOrbProps) {
  const animation =
    state === 'listening'
      ? 'animate-orb-listen'
      : state === 'speaking'
        ? 'animate-orb-breathe'
        : state === 'processing'
          ? 'animate-orb-think'
          : '';

  const gradient =
    state === 'listening'
      ? 'from-[#00F2FE] via-[#8B5CF6] to-[#DD2476]'
      : state === 'processing'
        ? 'from-[#7a8699] to-[#5b6573]'
        : state === 'error'
          ? 'from-[#f87171] to-[#dc2626]'
          : 'from-[var(--color-orb-1)] to-[var(--color-orb-2)]';

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
      {(state === 'listening' || state === 'speaking') && (
        <>
          <div className="absolute w-full h-full rounded-full bg-cyan-400/10 animate-pulse-ring" />
          <div className="absolute w-full h-full rounded-full bg-purple/10 animate-pulse-ring" style={{ animationDelay: '0.6s' }} />
        </>
      )}
      <div
        className={`relative rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center transition-all duration-500 ${animation}`}
        style={{ width: size * 0.72, height: size * 0.72 }}
      >
        <div className="absolute inset-0 rounded-full bg-gradient-to-br from-white/15 to-transparent" />
        <div className="relative text-white/95 flex items-center justify-center">
          {state === 'processing' ? (
            <span className="flex gap-1.5">
              <span className="w-2 h-2 rounded-full bg-white animate-dot-bounce" />
              <span className="w-2 h-2 rounded-full bg-white animate-dot-bounce" style={{ animationDelay: '0.2s' }} />
              <span className="w-2 h-2 rounded-full bg-white animate-dot-bounce" style={{ animationDelay: '0.4s' }} />
            </span>
          ) : state === 'listening' || state === 'speaking' ? (
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

/**
 * Núcleo de voz — múltiplos anéis + glow cyan/roxo + waveform.
 * Animação baseada em `state` (não inventa áudio real).
 */
export function LiveAudioOrb({ state = 'listening', size = 248 }: { state?: OrbState; size?: number }) {
  const bars = [0.22, 0.4, 0.62, 0.88, 0.55, 1, 0.72, 0.92, 0.48, 0.78, 0.38, 0.58, 0.3, 0.45, 0.65, 0.42];
  const active = state === 'listening' || state === 'speaking' || state === 'processing';
  const hot = state === 'listening' || state === 'speaking';

  return (
    <div
      className="relative flex items-center justify-center motion-safe:transition-transform"
      style={{ width: size, height: size }}
      role="img"
      aria-label={
        state === 'listening'
          ? 'Ouvindo você'
          : state === 'speaking'
            ? 'Professor falando'
            : state === 'processing'
              ? 'Pensando'
              : state === 'error'
                ? 'Erro'
                : 'Pronto'
      }
    >
      <span
        aria-hidden
        className={`absolute rounded-full pointer-events-none ${hot ? 'motion-safe:animate-orb-breathe' : ''}`}
        style={{
          inset: size * -0.18,
          background: hot
            ? 'radial-gradient(circle, rgba(0,242,254,0.32) 0%, rgba(139,92,246,0.2) 40%, transparent 68%)'
            : 'radial-gradient(circle, rgba(0,217,255,0.16) 0%, rgba(139,92,246,0.12) 45%, transparent 72%)',
        }}
      />
      <span
        aria-hidden
        className={`absolute rounded-full pointer-events-none ${active ? 'motion-safe:animate-pulse-ring' : ''}`}
        style={{
          width: size * 1.02,
          height: size * 1.02,
          border: `1.5px solid ${hot ? 'rgba(0,242,254,0.55)' : 'rgba(0,217,255,0.28)'}`,
          boxShadow: hot
            ? '0 0 32px rgba(0,242,254,0.4), inset 0 0 28px rgba(0,242,254,0.1)'
            : '0 0 20px rgba(0,217,255,0.14)',
        }}
      />
      <span
        aria-hidden
        className="absolute rounded-full pointer-events-none"
        style={{
          width: size * 0.9,
          height: size * 0.9,
          border: '1.5px solid rgba(139,92,246,0.42)',
          boxShadow: '0 0 28px rgba(139,92,246,0.28)',
        }}
      />
      <div
        className={`absolute rounded-full ${hot ? 'motion-safe:animate-orb-breathe' : ''}`}
        style={{
          width: size * 0.74,
          height: size * 0.74,
          background:
            'radial-gradient(circle at 36% 28%, rgba(56,189,248,0.5) 0%, rgba(15,23,42,0.55) 36%, rgba(8,12,28,0.96) 58%, rgba(139,92,246,0.55) 100%)',
          border: '2px solid rgba(0,242,254,0.55)',
          boxShadow:
            '0 0 48px rgba(0,242,254,0.42), 0 0 90px rgba(139,92,246,0.32), inset 0 0 40px rgba(0,242,254,0.14)',
        }}
      />
      <div className="relative z-10 flex items-center gap-[3px] h-16 px-2">
        {bars.map((h, i) => (
          <span
            key={i}
            className="w-[3.5px] rounded-full origin-center"
            style={{
              height: `${h * 100}%`,
              background: 'linear-gradient(180deg, #E0F7FF 0%, #00F2FE 45%, #A855F7 100%)',
              boxShadow: hot ? '0 0 12px #00F2FE' : '0 0 5px rgba(0,242,254,0.4)',
              animation:
                state === 'idle' || state === 'error'
                  ? undefined
                  : `waveform-pulse ${state === 'processing' ? '1.2s' : '0.85s'} ease-in-out ${i * 0.045}s infinite`,
              transform: state === 'idle' || state === 'error' ? 'scaleY(0.28)' : undefined,
              opacity: state === 'error' ? 0.4 : 1,
            }}
          />
        ))}
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
