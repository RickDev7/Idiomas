import { NavLink } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { IconHome, IconMic, IconPuzzle, IconChart } from '@/components/ui/Icons';
import { UiPrefsService } from '@/services/ui/UiPrefsService';
import { t } from '@/services/ui/LocaleService';

const ACTIVE = '#A855F7';
const ACTIVE_GLOW = '0 0 14px rgba(139,92,246,0.28)';

const navItems = [
  { to: '/', Icon: IconHome, labelKey: 'nav.home', end: true },
  { to: '/conversar', Icon: IconMic, labelKey: 'nav.talk', end: false },
  { to: '/revisar', Icon: IconPuzzle, labelKey: 'nav.review', end: false },
  { to: '/progresso', Icon: IconChart, labelKey: 'nav.progress', end: false },
];

export function BottomNav() {
  const [, setTick] = useState(0);
  useEffect(() => UiPrefsService.subscribe(() => setTick((n) => n + 1)), []);

  return (
    <nav
      className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md z-40 px-3 safe-bottom"
      aria-label="Navegação principal"
    >
      <div
        className="mb-2 mx-auto flex justify-around items-center h-[64px] px-1 rounded-[28px]"
        style={{
          background: 'linear-gradient(180deg, rgba(15,23,42,0.82) 0%, rgba(5,8,22,0.94) 100%)',
          border: '1px solid rgba(139,92,246,0.22)',
          boxShadow: '0 8px 28px rgba(0,0,0,0.4), 0 0 16px rgba(139,92,246,0.08)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
        }}
      >
        {navItems.map(({ to, Icon, labelKey, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className="flex flex-col items-center justify-center gap-0.5 flex-1 h-full min-h-[48px] transition-colors duration-200"
          >
            {({ isActive }) => (
              <span
                className="flex flex-col items-center justify-center gap-0.5 min-w-[64px] px-2.5 py-1.5 rounded-2xl transition-all duration-200"
                style={
                  isActive
                    ? {
                        background: 'rgba(168,85,247,0.18)',
                        color: ACTIVE,
                        boxShadow: ACTIVE_GLOW,
                      }
                    : { color: '#64748B' }
                }
              >
                <span className="flex items-center justify-center w-6 h-6" aria-hidden>
                  <Icon size={22} />
                </span>
                <span className="text-[10px] font-semibold tracking-wide">
                  {t(labelKey)}
                </span>
              </span>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
