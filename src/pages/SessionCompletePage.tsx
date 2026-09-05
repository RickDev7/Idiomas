/**
 * Sessão concluída — conquista + próximo passo.
 * Uma CTA principal (ContinueCourse). Lógica de sessão intacta.
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BottomNav } from '@/components/layout/BottomNav';
import {
  DTPage,
  DTMain,
} from '@/components/dt';
import { PrimaryButton } from '@/components/ui/Button';
import { GlassCard } from '@/components/ui/GlassCard';
import { DT_ASSETS } from '@/assets/deutsch-turbo';
import {
  readSessionComplete,
  clearSessionComplete,
} from '@/services/ui/SessionCompleteStore';
import { useProfile } from '@/hooks/useProfile';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { MemoryService } from '@/services/learning/MemoryService';
import { emptyLearningProfile } from '@/services/learning/RealProgress';
import type { UserLearningProfile } from '@/services/learning/ConfidenceService';
import {
  getCurrentLevel,
  loadCourseProgress,
  getContinueCourseState,
  beginContinueCourseSession,
  buildModuleSessionContext,
  storeSelectedModuleContext,
  type CourseProgress,
} from '@/services/course';
import { clearSelectedLearningTarget } from '@/services/teacher/LessonStartIntent';
import { APP_ROUTES } from '@/services/ui/AppRoutes';

export function SessionCompletePage() {
  const navigate = useNavigate();
  const { profile, loading } = useProfile();
  const data = readSessionComplete();
  const [learning, setLearning] = useState<UserLearningProfile | null>(null);
  const [course, setCourse] = useState<CourseProgress | null>(null);

  useEffect(() => {
    if (!profile) return;
    let active = true;
    void Promise.all([
      MemoryService.loadProfile(profile).catch(() => emptyLearningProfile()),
      loadCourseProgress(profile.level),
    ]).then(([lp, cp]) => {
      if (!active) return;
      setLearning(lp);
      setCourse(cp);
    });
    return () => {
      active = false;
    };
  }, [profile]);

  const userLevel = useMemo(
    () => (profile && course ? getCurrentLevel(profile, course) : 'L0'),
    [profile, course],
  );

  const continueState = useMemo(
    () =>
      getContinueCourseState({
        learning: learning ?? emptyLearningProfile(),
        userLevel,
        course,
      }),
    [learning, userLevel, course],
  );

  if (!data) {
    return (
      <DTPage>
        <div className="flex-1 flex flex-col items-center justify-center px-6">
          <img
            src={DT_ASSETS.mascot}
            alt=""
            className="w-24 h-24 object-contain mb-4"
            style={{ filter: 'drop-shadow(0 10px 28px color-mix(in srgb, var(--voice-cyan) 30%, transparent))' }}
            draggable={false}
          />
          <p className="text-[var(--text-secondary)] text-center">
            Nenhum resumo de sessão encontrado.
          </p>
          <PrimaryButton
            className="mt-4"
            variant="accent"
            onClick={() => navigate(APP_ROUTES.home)}
          >
            Voltar ao início
          </PrimaryButton>
        </div>
      </DTPage>
    );
  }

  if (loading || !profile || !learning || !course) return <LoadingScreen />;

  const name = data.name?.trim() || 'Aluno';

  const done = () => {
    clearSessionComplete();
    navigate(APP_ROUTES.home);
  };

  const onContinueCourse = () => {
    clearSessionComplete();
    if (continueState.isCourseComplete || continueState.nextAction === 'course_complete') {
      navigate(APP_ROUTES.jornada);
      return;
    }
    beginContinueCourseSession(navigate, continueState, {
      storeModuleContext: storeSelectedModuleContext,
      buildModuleContext: buildModuleSessionContext,
      clearSelectedLearningTarget,
      goJornada: () => navigate(APP_ROUTES.jornada),
    });
  };

  const primaryLabel =
    continueState.isCourseComplete || continueState.nextAction === 'course_complete'
      ? 'Ver Meu Curso'
      : continueState.ctaLabel === 'Começar curso'
        ? 'Continuar curso'
        : continueState.ctaLabel || 'Continuar curso';

  const nextHint =
    continueState.subline
    || (continueState.activityLabel
      ? `Próxima atividade: ${continueState.activityLabel}`
      : continueState.moduleTitle
        ? `${continueState.level} · ${continueState.moduleTitle}`
        : data.nextStep?.trim() || null);

  const practiced = data.improved?.slice(0, 6) ?? [];

  return (
    <DTPage>
      <header
        className="px-4 shrink-0 text-center"
        style={{ paddingTop: 'calc(1.25rem + env(safe-area-inset-top, 0px))' }}
      >
        <img
          src={DT_ASSETS.mascot}
          alt=""
          className="mx-auto w-[112px] h-[112px] object-contain"
          style={{ filter: 'drop-shadow(0 12px 32px color-mix(in srgb, var(--voice-cyan) 35%, transparent))' }}
          draggable={false}
        />
        <h1 className="mt-3 text-[22px] font-extrabold text-[var(--text-primary)] font-[family-name:var(--font-display)]">
          {data.headline || 'Sessão concluída'}
        </h1>
        <p className="text-[14px] text-[var(--text-secondary)] mt-1">Muito bem, {name}!</p>
        {data.streak != null && data.streak > 0 ? (
          <p className="mt-2 inline-flex items-center gap-1.5 text-[12px] font-bold text-[var(--active-coral,#FF5E62)]">
            Sequência · {data.streak} dias
          </p>
        ) : null}
      </header>

      <DTMain>
        <div className="pt-4 space-y-4 pb-2">
          {/* Resultado real */}
          <div className="grid grid-cols-2 gap-2.5">
            <GlassCard className="p-4 text-center">
              <p className="text-[28px] font-extrabold text-[var(--voice-cyan)] tabular-nums">
                {data.minutes != null ? data.minutes : '—'}
              </p>
              <p className="text-[11px] text-[var(--text-faint)] mt-1">Minutos</p>
            </GlassCard>
            <GlassCard className="p-4 text-center">
              <p className="text-[28px] font-extrabold text-[var(--learning-violet)] tabular-nums">
                {data.autonomyPct != null ? `${data.autonomyPct}%` : data.structures != null ? data.structures : '—'}
              </p>
              <p className="text-[11px] text-[var(--text-faint)] mt-1">
                {data.autonomyPct != null ? 'Autonomia' : 'Estruturas'}
              </p>
            </GlassCard>
          </div>

          {practiced.length > 0 ? (
            <section>
              <p className="text-[10px] uppercase tracking-[0.14em] font-bold text-[var(--text-faint)] mb-2 px-1">
                O que você praticou
              </p>
              <GlassCard className="p-4 space-y-2">
                {practiced.map((g) => (
                  <p key={g} className="text-[14px] text-[var(--text-primary)] flex gap-2">
                    <span className="text-[var(--success)] font-bold" aria-hidden>
                      ✓
                    </span>
                    <span className="truncate">{g}</span>
                  </p>
                ))}
              </GlassCard>
            </section>
          ) : null}

          {nextHint ? (
            <section>
              <p className="text-[10px] uppercase tracking-[0.14em] font-bold text-[var(--text-faint)] mb-2 px-1">
                Próximo destino
              </p>
              <GlassCard
                className="p-4"
                style={{
                  border: '1px solid color-mix(in srgb, var(--active-coral,#FF5E62) 35%, transparent)',
                }}
              >
                <p className="text-[14px] text-[var(--text-primary)] leading-snug">{nextHint}</p>
              </GlassCard>
            </section>
          ) : null}

          {/* Uma CTA principal */}
          <PrimaryButton
            full
            size="xl"
            variant="accent"
            onClick={onContinueCourse}
            aria-label={primaryLabel}
          >
            {primaryLabel}
          </PrimaryButton>

          <button
            type="button"
            onClick={done}
            className="w-full py-3 text-[14px] font-semibold text-[var(--text-secondary)] min-h-11"
          >
            Ir ao início
          </button>
        </div>
      </DTMain>
      <BottomNav />
    </DTPage>
  );
}
