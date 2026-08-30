/* HapticService — vibração curta. Respeita UiPrefs.haptics. */
import { UiPrefsService } from '@/services/ui/UiPrefsService';

export function isHapticsSupported(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
}

export const HapticService = {
  isEnabled(): boolean {
    return UiPrefsService.get().haptics;
  },
  setEnabled(on: boolean): void {
    UiPrefsService.set({ haptics: on });
  },
  supported(): boolean {
    return isHapticsSupported();
  },
  /** Vibração curta (padrão: toque no microfone). */
  pulse(pattern: number | number[] = 12): void {
    if (!UiPrefsService.get().haptics) return;
    if (!isHapticsSupported()) return;
    try {
      navigator.vibrate(pattern);
    } catch {
      /* ignore */
    }
  },
  success(): void {
    this.pulse([10, 40, 16]);
  },
  error(): void {
    this.pulse([30, 40, 30]);
  },
};

/** Compatível com imports existentes. */
export function haptic(pattern: number | number[] = 12): void {
  HapticService.pulse(pattern);
}
