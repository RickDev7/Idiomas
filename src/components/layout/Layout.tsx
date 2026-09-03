import type { ReactNode } from 'react';
import { BottomNav } from './BottomNav';
import { DTPage, DTTopBar, DTMain } from '@/components/dt';

interface LayoutProps {
  children: ReactNode;
  showNav?: boolean;
  right?: ReactNode;
  left?: ReactNode;
  title?: string;
  subtitle?: string;
  showMenu?: boolean;
}

/** Layout global — mesmo shell DT de todas as páginas. */
export function Layout({ children, showNav = true, right, left, title, subtitle }: LayoutProps) {
  const hasHeader = !!(title || right || left);
  return (
    <DTPage>
      {hasHeader && (
        <DTTopBar
          title={title}
          subtitle={subtitle}
          right={
            <div className="flex items-center gap-2">
              {left}
              {right}
            </div>
          }
        />
      )}
      <DTMain withNav={showNav} className={hasHeader ? 'pt-2' : 'pt-3'}>
        {children}
      </DTMain>
      {showNav && <BottomNav />}
    </DTPage>
  );
}
