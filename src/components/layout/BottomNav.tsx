import { NavLink } from 'react-router-dom';
import { IconHome, IconMic, IconPuzzle, IconChart } from '@/components/ui/Icons';

const ACTIVE = '#A855F7';
const ACTIVE_GLOW = '0 0 16px rgba(139,92,246,0.4)';

/** Bottom nav global — Início / Conversar / Revisar / Progresso */
const navItems = [
  { to: '/', Icon: IconHome, label: 'Início', end: true },
  { to: '/conversar', Icon: IconMic, label: 'Conversar', end: false },
  { to: '/revisar', Icon: IconPuzzle, label: 'Revisar', end: false },
  { to: '/progresso', Icon: IconChart, label: 'Progresso', end: false },
];

export function BottomNav() {
  return (
    <nav
      className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md z-40 px-3 safe-bottom"
      aria-label="Navegação principal"
    >
      <div
        className="mb-2 mx-auto flex justify-around items-center h-[64px] px-1 rounded-[28px]"
        style={{
          background: 'linear-gradient(180deg, rgba(15,23,42,0.82) 0%, rgba(5,8,22,0.96) 100%)',
          border: '1px solid rgba(139,92,246,0.28)',
          boxShadow: '0 8px 28px rgba(0,0,0,0.45), 0 0 20px rgba(139,92,246,0.1)',
          backdropFilter: 'blur(22px)',
          WebkitBackdropFilter: 'blur(22px)',
        }}
      >
        {navItems.map(({ to, Icon, label, end }) => (
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
                        background: 'rgba(168,85,247,0.2)',
                        color: ACTIVE,
                        boxShadow: ACTIVE_GLOW,
                      }
                    : { color: '#64748B' }
                }
              >
                <span className="flex items-center justify-center w-6 h-6" aria-hidden>
                  <Icon size={22} />
                </span>
                <span className="text-[10px] font-semibold tracking-wide">{label}</span>
                {isActive ? (
                  <span
                    className="w-4 h-0.5 rounded-full mt-0.5"
                    style={{ background: ACTIVE, boxShadow: ACTIVE_GLOW }}
                    aria-hidden
                  />
                ) : null}
              </span>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
