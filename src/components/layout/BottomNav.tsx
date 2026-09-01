import { NavLink } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { IconHome, IconMic, IconPuzzle, IconChart } from '@/components/ui/Icons';
import { UiPrefsService } from '@/services/ui/UiPrefsService';
import { t } from '@/services/ui/LocaleService';

const ACTIVE_CYAN = '#00F2FE';
const ACTIVE_GLOW = 'rgba(0,242,254,0.4)';

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
      className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md z-40 safe-bottom"
      style={{
        background: 'linear-gradient(180deg, rgba(15,23,42,0.72) 0%, rgba(7,10,18,0.96) 100%)',
        borderTop: '1px solid rgba(255,255,255,0.08)',
        backdropFilter: 'blur(16px)',
      }}
      aria-label="Navegação principal"
    >
      <div className="flex justify-around items-center h-[72px] px-1">
        {navItems.map(({ to, Icon, labelKey, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className="flex flex-col items-center justify-center gap-1 flex-1 h-full min-h-[48px] transition-colors duration-200"
          >
            {({ isActive }) => (
              <span
                className="flex flex-col items-center justify-center gap-1 min-w-[68px] px-3 py-2 rounded-full transition-all duration-200"
                style={
                  isActive
                    ? {
                        background: `${ACTIVE_CYAN}18`,
                        color: ACTIVE_CYAN,
                        boxShadow: `0 0 20px ${ACTIVE_GLOW}`,
                      }
                    : { color: '#64748b' }
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
