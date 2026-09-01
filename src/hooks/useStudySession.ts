import { useEffect } from 'react';
import { StudySessionManager } from '@/services/learning/StudySessionManager';

/** Registra tempo de estudo enquanto `active` for true (ex.: mic Live, sessão aberta). */
export function useStudySession(source: string, active: boolean): void {
  useEffect(() => {
    if (!active) return;
    StudySessionManager.start(source);
    return () => StudySessionManager.stop(source);
  }, [source, active]);
}
