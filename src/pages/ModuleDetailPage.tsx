/* ModuleDetailPage — briefing de módulo (composição redesign).
 * Lógica de desbloqueio/atividades intacta via ModuleDetails. */
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { BottomNav } from '@/components/layout/BottomNav';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { PrimaryButton } from '@/components/ui/Button';
import { GlassCard } from '@/components/ui/GlassCard';
import { IconBack } from '@/components/ui/Icons';
import { useProfile } from '@/hooks/useProfile';
import { MemoryService } from '@/services/learning/MemoryService';
import type { UserLearningProfile } from '@/services/learning/ConfidenceService';
import { emptyLearningProfile } from '@/services/learning/RealProgress';
import { clearSelectedLearningTarget, beginSelectedLearningSession } from '@/services/teacher/LessonStartIntent';
import { SoundService } from '@/services/ui/SoundService';
import {
  loadCourseProgress,
  getCurrentLevel,
  type CourseProgress,
} from '@/services/course';
import {
  parseCourseLevelParam,
  getModuleDetailsState,
  beginModuleTrainingSession,
  beginModuleTargetSession,
  moduleDetailPath,
} from '@/services/course/ModuleDetails';
import { APP_ROUTES } from '@/services/ui/AppRoutes';

function ProgressBar({
  value,
  tone = 'cyan',
  ariaLabel,
}: {
  value: number;
  tone?: 'cyan' | 'green';
  ariaLabel: string;
}) {
  const color = tone === 'green' ? 'var(--success)' : 'var(--voice-cyan)';
  return (
    <div
      className="h-2.5 rounded-full overflow-hidden"
      style={{ background: 'color-mix(in srgb, var(--text-primary) 8%, transparent)' }}
      role="progressbar"
      aria-valuenow={Math.round(value)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={ariaLabel}
    >
      <div
        className="h-full rounded-full transition-[width] duration-500 ease-out motion-reduce:transition-none"
        style={{ width: `${Math.min(100, Math.max(0, value))}%`, background: color }}
      />
    </div>
  );
}

export function ModuleDetailPage() {
  const { level: levelParam, moduleId: moduleIdParam } = useParams<{
    level: string;
    moduleId: string;
  }>();
  const navigate = useNavigate();
  const { profile, loading } = useProfile();
  const [cp, setCp] = useState<CourseProgress | null>(null);
  const [learning, setLearning] = useState<UserLearningProfile | null>(null);

  const level = useMemo(() => parseCourseLevelParam(levelParam), [levelParam]);
  const moduleId = useMemo(() => {
    if (!moduleIdParam) return null;
    try {
      return decodeURIComponent(moduleIdParam);
    } catch {
      return moduleIdParam;
    }
  }, [moduleIdParam]);

  useEffect(() => {
    if (!profile) return;
    let active = true;
    void Promise.all([
      loadCourseProgress(profile.level),
      MemoryService.loadProfile(profile).catch(() => emptyLearningProfile()),
    ]).then(([p, lp]) => {
      if (!active) return;
      setCp(p);
      setLearning(lp);
    });
    return () => {
      active = false;
    };
  }, [profile]);

  const userLevel = useMemo(
    () => (profile && cp ? getCurrentLevel(profile, cp) : 'L0'),
    [profile, cp],
  );

  const details = useMemo(
    () =>
      getModuleDetailsState({
        level,
        moduleId,
        learning: learning ?? emptyLearningProfile(),
        userLevel,
        course: cp,
      }),
    [level, moduleId, learning, userLevel, cp],
  );

  if (loading || !profile || !cp || !learning) return <LoadingScreen />;

  const mod = details.module;

  const onContinue = () => {
    if (details.ctaKind === 'locked') return;
    SoundService.play('start');
    beginModuleTrainingSession(navigate, details, {
      clearSelectedLearningTarget,
    });
  };

  const onActivity = (activityId: string) => {
    const activity = details.activities.find((a) => a.id === activityId);
    if (!activity || !activity.trainable) return;
    SoundService.play('start');
    beginModuleTargetSession(navigate, details, activity, beginSelectedLearningSession);
  };

  return (
    <div className="flex flex-col h-full max-w-md mx-auto md:max-w-3xl dt-page">
      {/* Header mínimo */}
      <header
        className="flex items-center gap-2 px-3 pb-2 shrink-0"
        style={{ paddingTop: 'calc(0.75rem + env(safe-area-inset-top, 0px))' }}
      >
        <button
          type="button"
          aria-label="Voltar ao Meu Curso"
          onClick={() => navigate(APP_ROUTES.jornada)}
          className="w-11 h-11 rounded-full flex items-center justify-center text-[var(--text-secondary)]"
          style={{ background: 'var(--surface)', border: '1px solid var(--border-subtle)' }}
        >
          <IconBack size={20} />
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] uppercase tracking-[0.16em] font-bold text-[var(--voice-cyan)]">
            Briefing do módulo
          </p>
          <p className="text-[15px] font-bold text-[var(--text-primary)] truncate">
            {details.level ?? '—'}
            {mod ? ` · Módulo ${mod.order}` : ''}
          </p>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-4 pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))] pt-1 space-y-4 md:px-6">
        {!details.ok || !mod ? (
          <GlassCard className="p-5 text-center">
            <p className="text-[16px] font-bold text-[var(--text-primary)]">Módulo não encontrado</p>
            <p className="text-[13px] text-[var(--text-secondary)] mt-2">
              Volte ao Meu Curso e escolha um módulo válido.
            </p>
            <div className="mt-4">
              <PrimaryButton full variant="accent" onClick={() => navigate(APP_ROUTES.jornada)}>
                Meu Curso
              </PrimaryButton>
            </div>
          </GlassCard>
        ) : (
          <>
            {/* Identidade + objetivo */}
            <section
              className="rounded-[28px] p-5 relative overflow-hidden"
              style={{
                background: 'var(--surface)',
                border:
                  mod.status === 'current'
                    ? '1px solid var(--border-cyan)'
                    : '1px solid var(--border-subtle)',
                boxShadow: mod.status === 'current' ? 'var(--shadow-glow)' : undefined,
              }}
            >
              <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--text-faint)]">
                {details.statusGlyph} {details.statusLabel}
              </p>
              <h1 className="mt-2 text-[24px] sm:text-[28px] font-extrabold text-[var(--text-primary)] font-[family-name:var(--font-display)] leading-tight">
                {mod.title}
              </h1>
              {details.description ? (
                <p className="mt-2 text-[14px] text-[var(--text-secondary)] leading-snug">
                  {details.description}
                </p>
              ) : null}
              {details.lockedReason ? (
                <p className="mt-3 text-[13px] text-[var(--warning)] leading-snug" role="status">
                  🔒 {details.lockedReason}
                </p>
              ) : null}
              {details.journeyComplete ? (
                <p className="mt-3 text-[14px] font-semibold text-[var(--success)]" role="status">
                  Jornada concluída — nível terminal C2.
                </p>
              ) : null}
            </section>

            {/* CTA cedo no fluxo */}
            <div data-testid="module-primary-cta" className="space-y-3">
              {details.ctaKind !== 'locked' && details.ctaKind !== 'none' ? (
                <PrimaryButton
                  full
                  size="xl"
                  variant="accent"
                  onClick={onContinue}
                  aria-label={details.ctaLabel}
                >
                  {details.ctaLabel}
                </PrimaryButton>
              ) : null}

              {!mod.locked && details.nextActivity ? (
                <div
                  className="rounded-[20px] px-4 py-3"
                  style={{
                    background: 'color-mix(in srgb, var(--voice-cyan) 10%, transparent)',
                    border: '1px solid color-mix(in srgb, var(--voice-cyan) 28%, transparent)',
                  }}
                >
                  <p className="text-[10px] uppercase tracking-[0.14em] font-bold text-[var(--voice-cyan)]">
                    Próxima atividade
                  </p>
                  <p className="mt-1 text-[15px] font-bold text-[var(--text-primary)] leading-snug">
                    {details.nextActivity.label}
                  </p>
                  {details.nextActivity.german ? (
                    <p className="mt-0.5 text-[13px] text-[var(--text-secondary)] italic line-clamp-2">
                      {details.nextActivity.german}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>

            {/* Progresso */}
            {details.progress != null ? (
              <GlassCard className="p-4">
                <div className="flex items-end justify-between gap-3 mb-3">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.14em] font-bold text-[var(--text-faint)]">
                      Progresso
                    </p>
                    <p className="text-[32px] font-extrabold text-[var(--text-primary)] tabular-nums leading-none mt-1">
                      {details.progress}%
                    </p>
                  </div>
                  <div className="text-right text-[12px] text-[var(--text-secondary)] space-y-0.5">
                    {details.masteryLabel ? (
                      <p>
                        Domínio:{' '}
                        <span className="text-[var(--text-primary)] font-semibold">
                          {details.masteryLabel}
                        </span>
                      </p>
                    ) : null}
                    {details.autonomyLabel ? (
                      <p>
                        Autonomia:{' '}
                        <span className="text-[var(--text-primary)] font-semibold">
                          {details.autonomyLabel}
                        </span>
                      </p>
                    ) : null}
                  </div>
                </div>
                <ProgressBar
                  value={details.progress}
                  tone={details.progress >= 100 ? 'green' : 'cyan'}
                  ariaLabel="Progresso do módulo"
                />
              </GlassCard>
            ) : null}

            {/* Objetivo / situações práticas (competências existentes) */}
            {details.learningObjectives.length > 0 ? (
              <section>
                <p className="text-[10px] uppercase tracking-[0.14em] font-bold text-[var(--text-faint)] mb-2 px-1">
                  Objetivo
                </p>
                <GlassCard className="p-4">
                  <ul className="space-y-2">
                    {details.learningObjectives.slice(0, 5).map((line) => (
                      <li
                        key={line}
                        className="text-[13px] text-[var(--text-primary)] leading-snug flex gap-2"
                      >
                        <span className="text-[var(--voice-cyan)] shrink-0" aria-hidden>
                          •
                        </span>
                        <span>{line}</span>
                      </li>
                    ))}
                  </ul>
                </GlassCard>
              </section>
            ) : null}

            {details.competencies.length > 0 ? (
              <section>
                <p className="text-[10px] uppercase tracking-[0.14em] font-bold text-[var(--text-faint)] mb-2 px-1">
                  Situações práticas
                </p>
                <div className="space-y-2">
                  {details.competencies.map((c) => (
                    <GlassCard key={c.id} className="p-4">
                      <p className="text-[14px] font-semibold text-[var(--text-primary)]">{c.title}</p>
                      <p className="text-[12px] text-[var(--text-secondary)] mt-1 leading-snug">
                        {c.description}
                      </p>
                    </GlassCard>
                  ))}
                </div>
              </section>
            ) : null}

            {/* Conteúdo / atividades */}
            <section>
              <p className="text-[10px] uppercase tracking-[0.14em] font-bold text-[var(--text-faint)] mb-2 px-1">
                Conteúdo do módulo
              </p>
              <GlassCard className="p-3">
                <ul className="space-y-1" aria-label="Atividades do módulo">
                  {details.activities.map((a) => (
                    <li key={a.id}>
                      <button
                        type="button"
                        disabled={!a.trainable}
                        onClick={() => onActivity(a.id)}
                        className="w-full flex items-start gap-2.5 text-left min-h-11 p-2.5 rounded-xl disabled:opacity-70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--voice-cyan)]"
                        style={{
                          background:
                            a.status === 'current'
                              ? 'color-mix(in srgb, var(--voice-cyan) 12%, transparent)'
                              : a.status === 'completed'
                                ? 'color-mix(in srgb, var(--success) 8%, transparent)'
                                : 'transparent',
                        }}
                        aria-label={`${a.label}, ${a.statusLabel}`}
                      >
                        <span className="mt-0.5 text-[14px] w-6 shrink-0 text-center" aria-hidden>
                          {a.glyph}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-[13px] font-semibold text-[var(--text-primary)] leading-snug">
                            {a.label}
                          </p>
                          <p className="text-[11px] text-[var(--text-faint)] mt-0.5">{a.statusLabel}</p>
                          {a.german ? (
                            <p className="text-[11px] text-[var(--text-secondary)] italic mt-0.5 line-clamp-1">
                              {a.german}
                            </p>
                          ) : null}
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              </GlassCard>
            </section>

            {mod.completed && details.nextModule && details.nextModuleUnlocked ? (
              <GlassCard className="p-4">
                <p className="text-[14px] font-bold text-[var(--success)]">Módulo concluído</p>
                <p className="mt-2 text-[12px] text-[var(--text-faint)]">Próximo módulo</p>
                <p className="text-[15px] font-bold text-[var(--text-primary)]">
                  Módulo {details.nextModule.order} · {details.nextModule.title}
                </p>
              </GlassCard>
            ) : null}

            <div className="flex items-center justify-between gap-2 pt-1 pb-2">
              {details.prevModule ? (
                <Link
                  to={moduleDetailPath(details.prevModule.level, details.prevModule.id)}
                  className="text-[13px] font-semibold text-[var(--voice-cyan)] min-h-11 inline-flex items-center px-2"
                >
                  ← Módulo {details.prevModule.order}
                </Link>
              ) : (
                <span />
              )}
              {details.nextModule ? (
                <Link
                  to={moduleDetailPath(details.nextModule.level, details.nextModule.id)}
                  className="text-[13px] font-semibold text-[var(--voice-cyan)] min-h-11 inline-flex items-center px-2"
                  aria-label={
                    details.nextModule.locked
                      ? `Próximo módulo ${details.nextModule.order} (bloqueado)`
                      : `Próximo módulo ${details.nextModule.order}`
                  }
                >
                  Módulo {details.nextModule.order}
                  {details.nextModule.locked ? ' 🔒' : ''} →
                </Link>
              ) : (
                <span />
              )}
            </div>
          </>
        )}
      </main>

      <BottomNav />
    </div>
  );
}
