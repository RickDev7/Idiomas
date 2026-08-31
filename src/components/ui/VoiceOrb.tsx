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

/** Esfera holográfica 3D + waveform ciano horizontal (Conversar). */
export function LiveAudioOrb({ state = 'listening', size = 220 }: { state?: OrbState; size?: number }) {
  const bars = [0.28, 0.48, 0.72, 0.95, 0.62, 1, 0.78, 0.9, 0.55, 0.82, 0.42, 0.58, 0.35];
  return (
    <div
      className="relative flex items-center justify-center"
      style={{ width: size, height: size }}
      role="img"
      aria-label="Visualizador de áudio Gemini Live"
    >
      <div
        className="absolute inset-0 rounded-full animate-orb-breathe"
        style={{
          background:
            'radial-gradient(circle at 32% 28%, rgba(0,242,254,0.45) 0%, rgba(59,130,246,0.28) 35%, rgba(139,92,246,0.3) 58%, rgba(221,36,118,0.18) 78%, transparent 85%)',
          filter: 'blur(1.5px)',
        }}
      />
      <div
        className="absolute rounded-full"
        style={{
          width: size * 0.82,
          height: size * 0.82,
          background:
            'radial-gradient(circle at 38% 32%, rgba(56,189,248,0.35) 0%, rgba(15,23,42,0.35) 38%, rgba(7,10,18,0.92) 62%, rgba(139,92,246,0.45) 100%)',
          border: '1.5px solid rgba(0,242,254,0.55)',
          boxShadow:
            '0 0 48px rgba(0,242,254,0.4), 0 0 90px rgba(139,92,246,0.35), inset 0 0 48px rgba(0,242,254,0.12)',
        }}
      />
      {/* Waveform horizontal ciano ciber */}
      <div className="relative z-10 flex items-center gap-[4px] h-14 px-2">
        {bars.map((h, i) => (
          <span
            key={i}
            className="w-[4px] rounded-full origin-center"
            style={{
              height: `${h * 100}%`,
              background: 'linear-gradient(180deg, #67e8f9 0%, #00F2FE 50%, #A855F7 100%)',
              boxShadow: '0 0 10px #00F2FE, 0 0 18px rgba(0,242,254,0.55)',
              animation: state === 'idle' ? undefined : `waveform-pulse 0.85s ease-in-out ${i * 0.055}s infinite`,
              transform: state === 'idle' ? 'scaleY(0.3)' : undefined,
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
