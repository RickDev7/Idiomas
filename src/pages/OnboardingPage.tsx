import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Goal, SelfReportedLevel, SessionDuration } from '@/types';
import { useProfile } from '@/hooks/useProfile';
import { haptic } from '@/services/ui/UiPrefsService';
import {
  OnboardingShell,
  OnboardingHeader,
  OnboardingProgress,
  OnboardingSlide,
  OnboardingButton,
  ProfessionScreen,
  GoalScreen,
  TimeScreen,
  ReadyScreen,
  ReadyCta,
} from '@/components/onboarding/Onboarding';
import {
  LevelSelection,
  DiagnosticPrompt,
  DiagnosticResultView,
} from '@/components/onboarding/LevelSelection';
import { DiagnosticSession } from '@/components/onboarding/DiagnosticSession';
import {
  loadDraft,
  saveDraft,
  clearDraft,
  emptyDraft,
  diagnosticPromptFor,
  requiresDiagnostic,
  finishOnboarding,
  type OnboardingDraft,
  type OnboardingStep,
  type DiagnosticResult,
} from '@/services/onboarding';

function canAdvance(draft: OnboardingDraft): boolean {
  if (draft.step === 0) return true;
  if (draft.step === 1) return !!draft.goal;
  if (draft.step === 2) return draft.dailyMinutes != null;
  if (draft.step === 3) return !!draft.selfReportedLevel;
  return true;
}

export function OnboardingPage() {
  const [draft, setDraft] = useState<OnboardingDraft>(() => loadDraft());
  const [dir, setDir] = useState<1 | -1>(1);
  const [preparing, setPreparing] = useState(false);
  const { updateProfile } = useProfile();
  const navigate = useNavigate();
  const touchStartX = useRef<number | null>(null);

  useEffect(() => {
    saveDraft(draft);
  }, [draft]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' && draft.phase === 'wizard' && canAdvance(draft) && draft.step < 4) next();
      if (e.key === 'ArrowLeft') back();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const patch = (partial: Partial<OnboardingDraft>, nextDir: 1 | -1 = 1) => {
    setDir(nextDir);
    setDraft((d) => ({ ...d, ...partial }));
  };

  const goStep = (step: OnboardingStep, nextDir: 1 | -1 = 1) => {
    patch({ step, phase: 'wizard' }, nextDir);
  };

  const skip = async () => {
    haptic();
    const skipped: OnboardingDraft = {
      ...emptyDraft(),
      step: 4,
      goal: draft.goal ?? 'daily',
      dailyMinutes: draft.dailyMinutes ?? 20,
      selfReportedLevel: draft.selfReportedLevel ?? 'zero',
      profession: draft.profession,
    };
    await commit(skipped, true);
  };

  const commit = async (data: OnboardingDraft, goTrain: boolean) => {
    setPreparing(true);
    try {
      await finishOnboarding(data, updateProfile);
      clearDraft();
      navigate(goTrain ? '/sessao?type=first' : '/');
    } catch {
      setPreparing(false);
    }
  };

  const afterLevelContinue = () => {
    const level = draft.selfReportedLevel;
    if (!level) return;
    if (requiresDiagnostic(level)) {
      patch({ phase: 'diag-run', wantsDiagnostic: true });
      return;
    }
    const kind = diagnosticPromptFor(level);
    if (kind === 'suggested') {
      patch({ phase: 'diag-prompt' });
      return;
    }
    goStep(4);
  };

  const next = () => {
    if (draft.phase !== 'wizard') return;
    if (draft.step === 3) {
      afterLevelContinue();
      return;
    }
    if (draft.step < 4) goStep((draft.step + 1) as OnboardingStep);
  };

  const back = () => {
    if (draft.phase === 'diag-result') {
      patch({ phase: 'diag-prompt' }, -1);
      return;
    }
    if (draft.phase === 'diag-run' || draft.phase === 'diag-prompt') {
      patch({ phase: 'wizard', step: 3 }, -1);
      return;
    }
    if (draft.step > 0) goStep((draft.step - 1) as OnboardingStep, -1);
  };

  const onDiagnosticDone = (result: DiagnosticResult) => {
    patch({ diagnosticResult: result, phase: 'diag-result', wantsDiagnostic: true });
  };

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(dx) < 50) return;
    if (dx < 0 && draft.phase === 'wizard' && canAdvance(draft) && draft.step < 4) next();
    else if (dx > 0) back();
  };

  const wizardIndex = draft.phase === 'wizard' ? draft.step : 3;
  const showFooterButton = draft.phase === 'wizard' && draft.step < 4;
  const showReadyCta = draft.phase === 'wizard' && draft.step === 4;
  const showDiagResultCta = draft.phase === 'diag-result';

  const ctaLabel = draft.step === 3 && requiresDiagnostic(draft.selfReportedLevel)
    ? 'Fazer teste rápido →'
    : 'Continuar →';

  return (
    <OnboardingShell>
      <OnboardingHeader onSkip={skip} />
      <OnboardingProgress
        current={wizardIndex}
        onJump={(i) => goStep(i as OnboardingStep, -1)}
      />

      <div
        className="flex-1 overflow-y-auto px-5 pb-4 scrollbar-hide"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {draft.phase === 'wizard' && (
          <OnboardingSlide dir={dir} key={`w-${draft.step}`}>
            {draft.step === 0 && (
              <ProfessionScreen
                value={draft.profession}
                onChange={(profession) => setDraft((d) => ({ ...d, profession }))}
              />
            )}
            {draft.step === 1 && (
              <GoalScreen
                value={draft.goal}
                onSelect={(goal: Goal) => setDraft((d) => ({ ...d, goal }))}
              />
            )}
            {draft.step === 2 && (
              <TimeScreen
                value={draft.dailyMinutes}
                onSelect={(dailyMinutes: SessionDuration) => setDraft((d) => ({ ...d, dailyMinutes }))}
              />
            )}
            {draft.step === 3 && (
              <LevelSelection
                value={draft.selfReportedLevel}
                onSelect={(selfReportedLevel: SelfReportedLevel) => setDraft((d) => ({ ...d, selfReportedLevel }))}
                onRequestTest={() => patch({ phase: 'diag-run', wantsDiagnostic: true })}
              />
            )}
            {draft.step === 4 && <ReadyScreen />}
          </OnboardingSlide>
        )}

        {draft.phase === 'diag-prompt' && (
          <OnboardingSlide dir={dir}>
            <DiagnosticPrompt
              required={requiresDiagnostic(draft.selfReportedLevel)}
              onTest={() => patch({ phase: 'diag-run', wantsDiagnostic: true })}
              onSkip={() => goStep(4)}
            />
          </OnboardingSlide>
        )}

        {draft.phase === 'diag-run' && (
          <OnboardingSlide dir={dir}>
            <DiagnosticSession
              selfReported={draft.selfReportedLevel}
              onDone={onDiagnosticDone}
            />
          </OnboardingSlide>
        )}

        {draft.phase === 'diag-result' && draft.diagnosticResult && (
          <OnboardingSlide dir={dir}>
            <DiagnosticResultView
              estimatedLabel={draft.diagnosticResult.estimatedLabel}
              skills={{
                speaking: draft.diagnosticResult.skills.speaking,
                listening: draft.diagnosticResult.skills.listening,
                reading: draft.diagnosticResult.skills.reading,
                vocabulary: draft.diagnosticResult.skills.vocabulary,
                communication: draft.diagnosticResult.skills.communication,
              }}
              nextFocus={draft.diagnosticResult.nextFocus}
            />
          </OnboardingSlide>
        )}
      </div>

      <div className="px-5 pb-5 safe-bottom shrink-0">
        {showFooterButton && (
          <OnboardingButton onClick={next} disabled={!canAdvance(draft)}>
            {ctaLabel}
          </OnboardingButton>
        )}
        {showReadyCta && (
          <ReadyCta
            preparing={preparing}
            onStart={() => void commit(draft, true)}
            onLater={() => void commit(draft, false)}
          />
        )}
        {showDiagResultCta && (
          <OnboardingButton onClick={() => goStep(4)}>
            Continuar →
          </OnboardingButton>
        )}
      </div>
    </OnboardingShell>
  );
}
