import { useEffect, useState } from 'react';

export interface ToastMessage {
  id: string;
  text: string;
  tone?: 'default' | 'success' | 'error';
}

let pushFn: ((text: string, tone?: ToastMessage['tone']) => void) | null = null;

export function toast(text: string, tone: ToastMessage['tone'] = 'default') {
  pushFn?.(text, tone);
}

export function ToastHost() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  useEffect(() => {
    pushFn = (text, tone = 'default') => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      setToasts((t) => [...t, { id, text, tone }]);
      setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2600);
    };
    return () => { pushFn = null; };
  }, []);

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 items-center pointer-events-none w-full max-w-sm px-4">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`animate-fade-in px-4 py-2.5 rounded-[var(--radius-md)] text-sm shadow-lg backdrop-blur-md ${
            t.tone === 'success'
              ? 'bg-success/15 text-success border border-success/30'
              : t.tone === 'error'
                ? 'bg-error/15 text-error border border-error/30'
                : 'bg-surface-elevated/90 text-text border border-border'
          }`}
        >
          {t.text}
        </div>
      ))}
    </div>
  );
}
