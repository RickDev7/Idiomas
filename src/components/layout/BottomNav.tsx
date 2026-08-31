import { NavLink } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { IconHome, IconMic, IconPuzzle, IconChart } from '@/components/ui/Icons';
import { UiPrefsService } from '@/services/ui/UiPrefsService';
import { t } from '@/services/ui/LocaleService';

const navItems = [
  { to: '/', Icon: IconHome, labelKey: 'nav.home', end: true, active: '#FF512F', glow: 'rgba(255,81,47,0.35)' },
  { to: '/conversar', Icon: IconMic, labelKey: 'nav.talk', end: false, active: '#00F2FE', glow: 'rgba(0,242,254,0.35)' },
  { to: '/revisar', Icon: IconPuzzle, labelKey: 'nav.review', end: false, active: '#8B5CF6', glow: 'rgba(139,92,246,0.4)' },
  { to: '/progresso', Icon: IconChart, labelKey: 'nav.progress', end: false, active: '#F59E0B', glow: 'rgba(245,158,11,0.35)' },
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
        {navItems.map(({ to, Icon, labelKey, end, active, glow }) => (
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
                        background: `${active}18`,
                        color: active,
                        boxShadow: `0 0 20px ${glow}`,
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
