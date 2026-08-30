/* Rascunho do onboarding — sobrevive a reload sem apagar respostas. */
import type { Goal, SelfReportedLevel, SessionDuration } from '@/types';
import type { DiagnosticResult } from '@/services/course/AdaptiveLevelAssessment';

export type OnboardingStep = 0 | 1 | 2 | 3 | 4;
export type OnboardingPhase = 'wizard' | 'diag-prompt' | 'diag-run' | 'diag-result';

export interface OnboardingDraft {
  step: OnboardingStep;
  phase: OnboardingPhase;
  profession: string;
  goal: Goal | null;
  dailyMinutes: SessionDuration | null;
  selfReportedLevel: SelfReportedLevel | null;
  wantsDiagnostic: boolean | null;
  diagnosticResult: DiagnosticResult | null;
}

const KEY = 'deutsch-turbo:onboarding-draft:v2';

export function emptyDraft(): OnboardingDraft {
  return {
    step: 0,
    phase: 'wizard',
    profession: '',
    goal: null,
    dailyMinutes: null,
    selfReportedLevel: null,
    wantsDiagnostic: null,
    diagnosticResult: null,
  };
}

export function loadDraft(): OnboardingDraft {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return emptyDraft();
    const parsed = JSON.parse(raw) as Partial<OnboardingDraft>;
    return { ...emptyDraft(), ...parsed };
  } catch {
    return emptyDraft();
  }
}

export function saveDraft(draft: OnboardingDraft): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(draft));
  } catch {
    /* quota */
  }
}

export function clearDraft(): void {
  try {
    localStorage.removeItem(KEY);
    localStorage.removeItem('dt_onboarding_step');
    localStorage.removeItem('dt_onboarding_skipped');
  } catch {
    /* ignore */
  }
}
