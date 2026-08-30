import { useEffect } from 'react';

/**
 * Empurra o layout quando o teclado virtual abre (iOS/Android),
 * usando visualViewport para o campo de digitação não ficar escondido.
 */
export function useKeyboardInset(active = true): void {
  useEffect(() => {
    if (!active || typeof window === 'undefined') return;
    const vv = window.visualViewport;
    if (!vv) return;

    const sync = () => {
      const inset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      document.documentElement.style.setProperty('--keyboard-inset', `${Math.round(inset)}px`);
    };

    sync();
    vv.addEventListener('resize', sync);
    vv.addEventListener('scroll', sync);
    window.addEventListener('focusin', sync);

    return () => {
      vv.removeEventListener('resize', sync);
      vv.removeEventListener('scroll', sync);
      window.removeEventListener('focusin', sync);
      document.documentElement.style.setProperty('--keyboard-inset', '0px');
    };
  }, [active]);
}
