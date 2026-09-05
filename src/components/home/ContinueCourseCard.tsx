/* ContinueCourseCard — hero da Home fiel à referência. */
import { PrimaryActionCard } from '@/components/ui/BrandPrimitives';
import type { ContinueCourseState } from '@/services/course';

export function ContinueCourseCard({
  state,
  onContinue,
  onOpenCourse,
}: {
  state: ContinueCourseState;
  onContinue: () => void;
  onOpenCourse?: () => void;
}) {
  if (state.status === 'loading' || state.status === 'no_data') {
    return (
      <section className="px-5" aria-busy="true" aria-label="Continuar curso">
        <div className="dt-speech-surface p-4">
          <p className="dt-label">Curso</p>
          <p className="text-[14px] text-[var(--text-secondary)] mt-2">Carregando…</p>
        </div>
      </section>
    );
  }

  const primaryDisabled = !state.available && state.nextAction !== 'course_complete' && state.nextAction !== 'none';
  const eyebrow = state.status === 'new_user' ? 'Começar curso' : 'Continuar curso';
  const title =
    state.status === 'course_completed'
      ? state.subline || state.headline || 'Curso concluído'
      : 'Seu próximo treino está pronto';
  const minutes = '20 min';

  return (
    <section className="px-0" aria-label="Continuar curso">
      <PrimaryActionCard
        eyebrow={eyebrow}
        title={title}
        timeLabel={minutes}
        actionLabel={state.ctaLabel}
        onAction={() => {
          if (state.nextAction === 'course_complete' || state.nextAction === 'none') {
            (onOpenCourse ?? onContinue)();
            return;
          }
          onContinue();
        }}
        disabled={primaryDisabled}
      />
      {state.status === 'course_completed' && onOpenCourse ? (
        <button
          type="button"
          onClick={onOpenCourse}
          className="mt-2 mx-5 w-[calc(100%-2.5rem)] min-h-11 text-[13px] font-semibold text-[var(--voice-cyan)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--voice-cyan)] rounded-xl"
        >
          Explorar meu curso
        </button>
      ) : null}
    </section>
  );
}
