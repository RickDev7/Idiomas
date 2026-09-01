/**
 * Acumula tempo de estudo enquanto sessões ativas (Live, revisão, lição).
 */
import { UserMetricsStore } from '@/services/learning/UserMetricsStore';

const TICK_MS = 15_000;

class StudySessionManagerImpl {
  private sources = new Set<string>();
  private timer: ReturnType<typeof setInterval> | null = null;

  start(source: string): void {
    this.sources.add(source);
    this.ensureTimer();
  }

  stop(source: string): void {
    this.sources.delete(source);
    if (this.sources.size === 0) this.clearTimer();
  }

  isActive(): boolean {
    return this.sources.size > 0;
  }

  private ensureTimer(): void {
    if (this.timer) return;
    this.timer = setInterval(() => {
      if (this.sources.size > 0) {
        UserMetricsStore.addStudySeconds(TICK_MS / 1000);
      }
    }, TICK_MS);
  }

  private clearTimer(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}

export const StudySessionManager = new StudySessionManagerImpl();
