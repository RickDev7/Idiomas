import type { ReactNode } from 'react';
import { BottomNav } from './BottomNav';

interface LayoutProps {
  children: ReactNode;
  showNav?: boolean;
  right?: ReactNode;
  left?: ReactNode;
  title?: string;
  subtitle?: string;
  showMenu?: boolean;
}

export function Layout({ children, showNav = true, right, left, title, subtitle }: LayoutProps) {
  const hasHeader = title || right || left;
  return (
    <div className="relative flex flex-col h-full bg-background max-w-md mx-auto">
      {hasHeader && (
        <header className="flex items-center justify-between px-5 pt-5 pb-3 shrink-0 safe-top">
          <div className="flex items-center gap-2 min-w-0">
            {left}
            <div className="min-w-0">
              {title && <h1 className="text-h2 text-text truncate">{title}</h1>}
              {subtitle && <p className="text-caption text-text-faint mt-0.5 truncate">{subtitle}</p>}
            </div>
          </div>
          {right}
        </header>
      )}
      <main className={`flex-1 overflow-y-auto scrollbar-hide ${showNav ? 'pb-24' : ''}`}>
        {children}
      </main>
      {showNav && <BottomNav />}
    </div>
  );
}
