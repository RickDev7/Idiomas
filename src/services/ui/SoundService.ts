/* SoundService — sons curtos de UI. NÃO controla a voz do Gemini. */
import { UiPrefsService } from '@/services/ui/UiPrefsService';

export type UiSound = 'start' | 'success' | 'end' | 'tap' | 'error';

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  try {
    if (!ctx) ctx = new AudioContext();
    return ctx;
  } catch {
    return null;
  }
}

function tone(freq: number, durationMs: number, gain = 0.04, type: OscillatorType = 'sine'): void {
  if (!UiPrefsService.get().sound) return;
  const ac = getCtx();
  if (!ac) return;
  void ac.resume().catch(() => {});
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  g.gain.value = gain;
  osc.connect(g);
  g.connect(ac.destination);
  const now = ac.currentTime;
  g.gain.setValueAtTime(gain, now);
  g.gain.exponentialRampToValueAtTime(0.001, now + durationMs / 1000);
  osc.start(now);
  osc.stop(now + durationMs / 1000 + 0.02);
}

export const SoundService = {
  isEnabled(): boolean {
    return UiPrefsService.get().sound;
  },
  setEnabled(on: boolean): void {
    UiPrefsService.set({ sound: on });
  },
  play(kind: UiSound): void {
    if (!UiPrefsService.get().sound) return;
    switch (kind) {
      case 'start':
        tone(520, 80);
        setTimeout(() => tone(680, 90), 70);
        break;
      case 'success':
        tone(660, 70);
        setTimeout(() => tone(880, 100), 60);
        break;
      case 'end':
        tone(440, 90);
        setTimeout(() => tone(330, 120), 80);
        break;
      case 'tap':
        tone(600, 40, 0.025, 'triangle');
        break;
      case 'error':
        tone(220, 140, 0.05, 'square');
        break;
      default:
        break;
    }
  },
  stop(): void {
    try {
      void ctx?.suspend();
    } catch {
      /* ignore */
    }
  },
};
