import { useEffect, useState, type CSSProperties } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { IconHome, IconMic, IconPuzzle, IconBook, IconChart } from '@/components/ui/Icons';
import { getLocale, t } from '@/services/ui/LocaleService';
import { UiPrefsService } from '@/services/ui/UiPrefsService';
import { BOTTOM_NAV_ITEMS } from '@/services/ui/AppRoutes';

const ICONS = {
  start: IconHome,
  course: IconBook,
  talk: IconMic,
  review: IconPuzzle,
  progress: IconChart,
} as const;

const LABEL_KEYS = {
  start: 'nav.start',
  course: 'nav.course',
  talk: 'nav.talk',
  review: 'nav.review',
  progress: 'nav.progress',
} as const;

function activeStyle(to: string): CSSProperties {
  // Referência: Início coral · Meu Curso violet · demais cyan
  if (to === '/' || to === '') {
    return {
      background: 'rgba(255,107,95,0.16)',
      color: '#FF6B5F',
      boxShadow: '0 0 18px rgba(255,107,95,0.32)',
    };
  }
  if (to.includes('jornada') || to.includes('curso')) {
    return {
      background: 'rgba(139,92,246,0.18)',
      color: '#A78BFA',
      boxShadow: '0 0 18px rgba(139,92,246,0.35)',
    };
  }
  return {
    background: 'rgba(0,217,255,0.14)',
    color: 'var(--voice-cyan)',
    boxShadow: '0 0 18px rgba(0,217,255,0.3)',
  };
}

export function BottomNav() {
  const [, bump] = useState(0);
  useEffect(() => UiPrefsService.subscribe(() => bump((n) => n + 1)), []);
  useLocation();

  const locale = getLocale();
  const navItems = BOTTOM_NAV_ITEMS.map((item) => ({
    to: item.to,
    end: item.end,
    Icon: ICONS[item.key as keyof typeof ICONS],
    label: t(LABEL_KEYS[item.key as keyof typeof LABEL_KEYS], locale),
  }));

  return (
    <nav
      className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full dt-app-column z-40 px-3 safe-bottom"
      aria-label={t('nav.aria', locale)}
      lang={locale === 'pt-BR' ? 'pt-BR' : locale === 'de-DE' ? 'de' : 'en'}
      data-locale={locale}
    >
      <div
        className="mb-2.5 mx-auto flex justify-around items-center h-[62px] px-1 rounded-[28px] dt-bottom-nav"
        style={{
          background: 'linear-gradient(180deg, rgba(16,24,39,0.82) 0%, rgba(11,15,25,0.94) 100%)',
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 12px 40px rgba(0,0,0,0.45)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
        }}
      >
        {navItems.map(({ to, Icon, label, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            aria-label={label}
            className="flex flex-col items-center justify-center gap-0.5 flex-1 h-full min-h-[48px] transition-colors duration-200"
          >
            {({ isActive }) => (
              <span
                className="flex flex-col items-center justify-center gap-0.5 min-w-0 w-full max-w-[72px] px-1 py-1.5 rounded-2xl transition-all duration-200"
                style={isActive ? activeStyle(to) : { color: 'var(--text-faint)' }}
              >
                <span className="flex items-center justify-center w-6 h-6" aria-hidden>
                  <Icon size={20} />
                </span>
                <span className="text-[10px] sm:text-[11px] font-semibold tracking-wide truncate max-w-full">
                  {label}
                </span>
              </span>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
