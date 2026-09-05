/* ============================================================
   DEUTSCH TURBO — Mascote oficial
   PNG RGBA transparente (deutsch-turbo-mascot-alpha.png).
   Sem caixa preta: o fundo do asset é alpha, não #000.
   ============================================================ */
import mascotImg from '@/assets/deutsch-turbo/deutsch-turbo-mascot-alpha.png';
import { haptic } from '@/services/ui/UiPrefsService';

export type MascotSize = 'small' | 'medium' | 'large' | 'hero' | 'onboarding';
export type MascotState = 'idle' | 'speaking' | 'listening' | 'thinking' | 'success' | 'teacher';

const SIZES: Record<MascotSize, number> = {
  small: 44,
  medium: 64,
  large: 96,
  hero: 150,
  onboarding: 220,
};

interface MascotProps {
  size?: MascotSize;
  state?: MascotState;
  ringColor?: string;
  className?: string;
  onClick?: () => void;
  alt?: string;
}

export function DeutschTurboMascot({
  size = 'medium',
  state = 'idle',
  ringColor = '#5b8cff',
  className = '',
  onClick,
  alt = 'Professor Deutsch Turbo',
}: MascotProps) {
  const px = SIZES[size];
  const isCard = size === 'large' || size === 'hero' || size === 'onboarding';

  const stateAnim =
    state === 'speaking'
      ? 'animate-orb-breathe'
      : state === 'listening'
        ? 'animate-pulse-ring'
        : state === 'thinking'
          ? 'animate-orb-think'
          : state === 'success'
            ? 'animate-scale-in'
            : 'animate-orb-breathe';

  const interactive = onClick ? 'cursor-pointer active:scale-95 transition-transform' : '';
  const radius = isCard ? 'rounded-[28%]' : 'rounded-full';
  const objFit = isCard ? 'object-contain' : 'object-cover';
  const objPos = isCard ? 'center center' : 'center 8%';

  return (
    <div
      role={onClick ? 'button' : 'img'}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick ? () => { haptic(8); onClick(); } : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); haptic(8); onClick(); } } : undefined}
      aria-label={alt}
      className={`relative inline-flex items-center justify-center ${interactive} ${className}`}
      style={{ width: px, height: px }}
    >
      <span
        aria-hidden
        className={`absolute -inset-1 ${radius} ${stateAnim}`}
        style={{
          background: `radial-gradient(circle at 50% 42%, ${ringColor}33 0%, ${ringColor}11 50%, transparent 75%)`,
        }}
      />
      <span
        aria-hidden
        className={`relative overflow-hidden ${radius}`}
        style={{
          width: px,
          height: px,
          background: 'transparent',
          boxShadow: `0 0 0 1.5px ${ringColor}40, 0 8px 22px color-mix(in srgb, ${ringColor} 28%, transparent)`,
        }}
      >
        <img
          src={mascotImg}
          alt=""
          draggable={false}
          className={`w-full h-full ${objFit} select-none`}
          style={{ objectPosition: objPos }}
        />
      </span>
    </div>
  );
}
