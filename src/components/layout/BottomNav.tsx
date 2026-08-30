import { NavLink } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { IconHome, IconChat, IconBrain, IconChart } from '@/components/ui/Icons';
import { UiPrefsService } from '@/services/ui/UiPrefsService';
import { t } from '@/services/ui/LocaleService';

const navItems = [
  { to: '/', Icon: IconHome, labelKey: 'nav.home', end: true },
  { to: '/conversar', Icon: IconChat, labelKey: 'nav.talk', end: false },
  { to: '/revisar', Icon: IconBrain, labelKey: 'nav.review', end: false },
  { to: '/progresso', Icon: IconChart, labelKey: 'nav.progress', end: false },
];

export function BottomNav() {
  const [, setTick] = useState(0);
  useEffect(() => UiPrefsService.subscribe(() => setTick((n) => n + 1)), []);

  return (
    <nav
      className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md z-40 safe-bottom dt-bottom-nav"
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
                className={`flex flex-col items-center justify-center gap-1 min-w-[64px] px-3 py-2 rounded-2xl transition-all duration-200 ${
                  isActive
                    ? 'bg-primary/15 text-primary shadow-[0_0_24px_rgba(59,130,246,0.18)]'
                    : 'text-text-faint'
                }`}
              >
                <span className="flex items-center justify-center w-6 h-6" aria-hidden>
                  <Icon size={22} />
                </span>
                <span className={`text-[10px] font-semibold tracking-wide ${isActive ? 'text-primary' : ''}`}>
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
