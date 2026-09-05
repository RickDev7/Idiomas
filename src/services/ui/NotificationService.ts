/* NotificationService — lembretes locais via Notification API.
   Push remoto / background no Android depende de SW + servidor — documentado em SETTINGS.md. */
import { UiPrefsService } from '@/services/ui/UiPrefsService';

export type BrowserNotificationPermission = NotificationPermission | 'unsupported';

const REMINDER_KEY = 'dt_notif_last_shown';
let remindTimer: ReturnType<typeof setInterval> | null = null;

export function browserNotificationPermission(): BrowserNotificationPermission {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  return Notification.permission;
}

export const NotificationService = {
  isEnabled(): boolean {
    return UiPrefsService.get().notifications;
  },
  permission(): BrowserNotificationPermission {
    return browserNotificationPermission();
  },
  async enable(): Promise<{ ok: boolean; permission: BrowserNotificationPermission }> {
    const perm = browserNotificationPermission();
    if (perm === 'unsupported') {
      UiPrefsService.set({ notifications: false });
      return { ok: false, permission: 'unsupported' };
    }
    let next = perm;
    if (perm === 'default') {
      try {
        next = await Notification.requestPermission();
      } catch {
        next = 'denied';
      }
    }
    const ok = next === 'granted';
    UiPrefsService.set({ notifications: ok });
    if (ok) this.startLocalReminders();
    else this.stopLocalReminders();
    return { ok, permission: next };
  },
  disable(): void {
    UiPrefsService.set({ notifications: false });
    this.stopLocalReminders();
  },
  /** Lembrete local enquanto o PWA está aberto (não substitui push remoto). */
  startLocalReminders(): void {
    this.stopLocalReminders();
    if (!UiPrefsService.get().notifications) return;
    if (browserNotificationPermission() !== 'granted') return;
    // Checa a cada 30 min se já passou ~20h desde o último lembrete.
    remindTimer = setInterval(() => {
      void this.maybeRemind();
    }, 30 * 60 * 1000);
    void this.maybeRemind();
  },
  stopLocalReminders(): void {
    if (remindTimer) {
      clearInterval(remindTimer);
      remindTimer = null;
    }
  },
  async maybeRemind(): Promise<void> {
    if (!UiPrefsService.get().notifications) return;
    if (browserNotificationPermission() !== 'granted') return;
    try {
      const last = Number(localStorage.getItem(REMINDER_KEY) || 0);
      if (Date.now() - last < 20 * 60 * 60 * 1000) return;
      const n = new Notification('Deutsch Turbo', {
        body: 'Hora de treinar seu alemão. Continue sua sequência!',
        tag: 'dt-study-reminder',
        silent: false,
      });
      localStorage.setItem(REMINDER_KEY, String(Date.now()));
      setTimeout(() => n.close(), 8000);
    } catch {
      /* ignore */
    }
  },
  async showTest(): Promise<boolean> {
    if (!UiPrefsService.get().notifications) return false;
    if (browserNotificationPermission() !== 'granted') return false;
    try {
      const n = new Notification('Deutsch Turbo', {
        body: 'Notificações ativas. Vamos lembrar você de treinar.',
        tag: 'dt-test',
      });
      setTimeout(() => n.close(), 5000);
      return true;
    } catch {
      return false;
    }
  },
};
