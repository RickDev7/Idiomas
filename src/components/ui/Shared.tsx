import { IconMic } from '@/components/ui/Icons';

interface MicButtonProps {
  isListening: boolean;
  isSpeaking: boolean;
  isProcessing: boolean;
  onPress: () => void;
  disabled?: boolean;
}

export function MicButton({ isListening, isSpeaking, isProcessing, onPress, disabled }: MicButtonProps) {
  const label = isListening
    ? 'Ouvindo...'
    : isProcessing
      ? 'Entendendo...'
      : isSpeaking
        ? 'Professor...'
        : 'Sua vez';

  return (
    <div className="relative flex items-center justify-center">
      {isListening && (
        <>
          <div className="absolute w-36 h-36 rounded-full bg-[#ff6b6b]/15 animate-pulse-ring" />
          <div className="absolute w-32 h-32 rounded-full bg-[#ff6b6b]/20 animate-pulse-ring" style={{ animationDelay: '0.5s' }} />
        </>
      )}
      <button
        onClick={onPress}
        disabled={disabled}
        aria-label={label}
        className={`relative w-28 h-28 rounded-full flex items-center justify-center transition-all duration-300 shadow-lg border ${
          isListening
            ? 'bg-gradient-to-br from-[#ff6b6b] to-accent text-white scale-105 shadow-[#ff6b6b]/30 border-[#ff6b6b]/40'
            : isProcessing
              ? 'bg-surface-elevated text-text-muted border-border'
              : isSpeaking
                ? 'bg-primary/70 text-white border-primary/40'
                : 'bg-gradient-to-br from-primary to-primary-dark text-white hover:scale-105 active:scale-95 shadow-primary/30 border-primary/40'
        }`}
      >
        <span className="absolute inset-2 rounded-full bg-white/5" />
        <span className="relative">
          {isProcessing ? (
            <span className="flex gap-1.5">
              <span className="w-2 h-2 rounded-full bg-current animate-dot-bounce" />
              <span className="w-2 h-2 rounded-full bg-current animate-dot-bounce" style={{ animationDelay: '0.2s' }} />
              <span className="w-2 h-2 rounded-full bg-current animate-dot-bounce" style={{ animationDelay: '0.4s' }} />
            </span>
          ) : isSpeaking ? (
            <span className="text-2xl">🔊</span>
          ) : (
            <IconMic size={30} />
          )}
        </span>
      </button>
    </div>
  );
}

interface HelpButtonProps {
  icon: string;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}

export function HelpButton({ icon, label, onClick, disabled }: HelpButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="inline-flex flex-col items-center gap-1 px-3 py-2 rounded-[var(--radius-sm)] bg-surface/60 border border-border/50 text-text-muted hover:text-text hover:bg-surface-light/60 transition-colors disabled:opacity-40 min-h-11"
    >
      <span className="text-base" aria-hidden>{icon}</span>
      <span className="text-caption">{label}</span>
    </button>
  );
}

interface CardProps {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
}

export function Card({ children, onClick, className = '' }: CardProps) {
  return (
    <div
      onClick={onClick}
      className={`bg-surface rounded-[var(--radius-lg)] p-4 border border-border/60 ${onClick ? 'cursor-pointer hover:border-primary/50 active:scale-[0.98] transition-all' : ''} ${className}`}
    >
      {children}
    </div>
  );
}

interface ProgressBarProps {
  value: number;
  max?: number;
  color?: string;
}

export function ProgressBar({ value, max = 100, color = 'bg-primary' }: ProgressBarProps) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div className="h-2 bg-surface-light rounded-full overflow-hidden">
      <div className={`h-full ${color} rounded-full transition-all duration-500`} style={{ width: `${pct}%` }} />
    </div>
  );
}
