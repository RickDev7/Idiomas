/**
 * Home cockpit — composição fiel à referência:
 * logo DEUTSCH/TURBO · saudação · (hero/rows vêm dos consumidores).
 */
import { IconBell } from '@/components/ui/Icons';

export function germanGreetingForNow(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Guten Morgen';
  if (hour < 18) return 'Guten Tag';
  return 'Guten Abend';
}

export function portugueseGreetingForNow(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Bom dia';
  if (hour < 18) return 'Boa tarde';
  return 'Boa noite';
}

/** Header compacto — referência: DEUTSCH TURBO + streak pill. */
export function HomeCockpitHeader({
  name,
  streak,
  level: _level,
  onStreak,
  onBell,
}: {
  name?: string;
  streak: number;
  level?: string;
  onStreak?: () => void;
  onBell?: () => void;
}) {
  const greet = portugueseGreetingForNow();

  return (
    <header className="px-5 pt-3 safe-top shrink-0">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex items-center gap-1.5">
          <p className="text-[15px] font-extrabold tracking-[0.04em] leading-none truncate font-[family-name:var(--font-display)]">
            <span className="text-white">DEUTSCH</span>{' '}
            <span style={{ color: 'var(--active-coral)' }}>TURBO</span>
          </p>
          <span
            aria-hidden
            className="inline-flex items-center justify-center shrink-0"
            style={{
              filter: 'drop-shadow(0 0 8px rgba(255,107,95,0.55))',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path
                d="M13 2L4 14h7l-1 8 10-14h-7l1-6z"
                fill="var(--active-coral)"
              />
            </svg>
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onStreak}
            aria-label={`${streak} dias de sequência`}
            className="inline-flex items-center gap-1.5 min-h-9 pl-2.5 pr-3 rounded-full active:scale-95 transition-transform"
            style={{
              background: 'rgba(15,23,42,0.72)',
              border: '1px solid rgba(255,107,95,0.35)',
              boxShadow: '0 0 16px rgba(255,107,95,0.22)',
            }}
          >
            <span aria-hidden>🔥</span>
            <span className="text-[13px] font-extrabold text-white tabular-nums">{streak}</span>
          </button>
          {onBell ? (
            <button
              type="button"
              onClick={onBell}
              aria-label="Configurações"
              className="w-9 h-9 rounded-full flex items-center justify-center text-[var(--text-faint)]"
              style={{ background: 'rgba(15,23,42,0.55)', border: '1px solid rgba(255,255,255,0.08)' }}
            >
              <IconBell size={15} />
            </button>
          ) : null}
        </div>
      </div>

      <div className="mt-5">
        <h1 className="text-[28px] font-extrabold leading-none text-white font-[family-name:var(--font-display)] tracking-tight">
          {greet} <span aria-hidden>👋</span>
        </h1>
        <p className="mt-2 text-[14px] text-[var(--text-secondary)] leading-snug">
          {name ? `${name} · ` : null}Pronto para acelerar seu alemão?
        </p>
      </div>
    </header>
  );
}
