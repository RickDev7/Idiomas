/* CoursePage — Meu Curso: jornada visual L0→C2 (composição da referência). */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BottomNav } from '@/components/layout/BottomNav';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { PrimaryButton } from '@/components/ui/Button';
import { GlassCard } from '@/components/ui/GlassCard';
import { IconChart } from '@/components/ui/Icons';
import { CourseJourneyPath, type JourneyNodeStatus } from '@/components/home/CourseJourneyPath';
import { DTPage } from '@/components/dt';
import { useProfile } from '@/hooks/useProfile';
import { MemoryService } from '@/services/learning/MemoryService';
import type { UserLearningProfile } from '@/services/learning/ConfidenceService';
import { emptyLearningProfile } from '@/services/learning/RealProgress';
import {
  loadCourseProgress,
  buildRecommendation,
  LEVEL_ORDER,
  isRecoveryActive,
  getCurrentLevel,
  getModules,
  getModulesWithProgress,
  getLevelModulesProgressPercent,
  getCurrentModule,
  isContentUnlocked,
  levelJourneyTitle,
  levelJourneyBlurb,
  overallJourneyPercent,
  nextLevelId,
  moduleDetailPath,
  getContinueCourseState,
  beginContinueCourseSession,
  buildModuleSessionContext,
  storeSelectedModuleContext,
  type CourseProgress,
  type CurriculumModule,
} from '@/services/course';
import { clearSelectedLearningTarget } from '@/services/teacher/LessonStartIntent';

export function CoursePage() {
  const { profile, loading } = useProfile();
  const navigate = useNavigate();
  const [cp, setCp] = useState<CourseProgress | null>(null);
  const [learning, setLearning] = useState<UserLearningProfile | null>(null);

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
  const rec = useMemo(() => (cp ? buildRecommendation(cp, userLevel) : null), [cp, userLevel]);
  const recovering = cp ? isRecoveryActive(cp) : false;
  const lp = learning ?? emptyLearningProfile();

  const currentSnap = useMemo(
    () => getCurrentModule(lp, userLevel, cp, userLevel),
    [lp, userLevel, cp],
  );
  const modulesAtLevel = useMemo(() => getModules(userLevel), [userLevel]);
  const levelPct = useMemo(
    () => getLevelModulesProgressPercent(userLevel, lp, userLevel, cp),
    [userLevel, lp, cp],
  );

  const journeyRows = useMemo(
    () =>
      LEVEL_ORDER.map((id) => {
        const unlocked = isContentUnlocked(id, userLevel);
        const percent = getLevelModulesProgressPercent(id, lp, userLevel, cp);
        const status = rec?.journey.find((j) => j.level === id)?.status ?? 'locked';
        return { id, unlocked, percent, status };
      }),
    [lp, userLevel, cp, rec],
  );

  const overallPct = useMemo(
    () =>
      overallJourneyPercent(
        journeyRows.map((r) => ({
          level: r.id,
          percent: r.percent,
          unlocked: r.unlocked,
        })),
      ),
    [journeyRows],
  );

  const nextLvl = nextLevelId(userLevel);
  const levelComplete =
    modulesAtLevel.length > 0 &&
    getModulesWithProgress(userLevel, lp, userLevel, cp).every((m) => m.completed);

  const continueState = useMemo(
    () => getContinueCourseState({ learning: lp, userLevel, course: cp }),
    [lp, userLevel, cp],
  );

  if (loading || !profile || !cp || !rec) return <LoadingScreen />;

  const currentMod = currentSnap.module;
  const openModule = (mod: CurriculumModule) => {
    navigate(moduleDetailPath(mod.level, mod.id));
  };

  const onContinueCourse = () => {
    beginContinueCourseSession(navigate, continueState, {
      storeModuleContext: storeSelectedModuleContext,
      buildModuleContext: buildModuleSessionContext,
      clearSelectedLearningTarget,
      goJornada: () => navigate('/jornada'),
    });
  };

  return (
    <DTPage>
      <header className="px-5 pt-3 safe-top shrink-0 flex items-center justify-between gap-3">
        <h1 className="text-[22px] font-extrabold text-[var(--text-primary)] font-[family-name:var(--font-display)]">
          Meu Curso
        </h1>
        <button
          type="button"
          onClick={() => navigate('/progresso')}
          aria-label="Progresso"
          className="w-10 h-10 rounded-full flex items-center justify-center text-[var(--text-secondary)]"
          style={{ background: 'rgba(15,23,42,0.65)', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          <IconChart size={16} />
        </button>
      </header>

      <main className="flex-1 overflow-y-auto scrollbar-hide px-4 sm:px-5 pt-4 pb-28">
        <CourseJourneyPath
          nodes={journeyRows.map((row) => {
            const isCurrent = row.id === userLevel;
            const status: JourneyNodeStatus =
              row.status === 'done'
                ? 'done'
                : row.status === 'current' || isCurrent
                  ? 'current'
                  : row.unlocked
                    ? 'available'
                    : 'locked';

            const modules = isCurrent
              ? getModulesWithProgress(row.id, lp, userLevel, cp).slice(0, 6)
              : [];

            return {
              id: row.id,
              title: levelJourneyTitle(row.id),
              blurb: isCurrent ? levelJourneyBlurb(row.id) : undefined,
              status,
              percent: isCurrent ? levelPct : row.unlocked ? row.percent : null,
              onContinue:
                isCurrent && !currentSnap.journeyComplete && continueState.available
                  ? onContinueCourse
                  : undefined,
              onOpenDetails: isCurrent && currentMod ? () => openModule(currentMod) : undefined,
              continueLabel: 'Continuar treino',
              children: isCurrent ? (
                <div className="mt-3 space-y-2">
                  {modules.length > 0 ? (
                    <ul className="space-y-1">
                      {modules.map((m) => (
                        <li key={m.id}>
                          <button
                            type="button"
                            onClick={() => openModule(m)}
                            className="w-full flex items-center gap-2 text-left min-h-9 px-1"
                            aria-label={`Módulo ${m.order} ${m.title}`}
                          >
                            <span
                              className="w-1.5 h-1.5 rounded-full shrink-0"
                              style={{
                                background:
                                  m.status === 'current'
                                    ? 'var(--voice-cyan)'
                                    : m.status === 'completed'
                                      ? 'var(--learning-violet)'
                                      : 'rgba(255,255,255,0.22)',
                              }}
                              aria-hidden
                            />
                            <span className="text-[12px] text-[var(--text-secondary)] truncate flex-1">
                              {m.order}. {m.title}
                            </span>
                            {m.locked ? (
                              <span className="text-[10px] opacity-70" aria-hidden>
                                🔒
                              </span>
                            ) : null}
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {levelComplete && nextLvl && rec.readyForAssessment ? (
                    <PrimaryButton
                      full
                      size="md"
                      onClick={() => navigate('/sessao?type=assessment')}
                      aria-label={`Fazer exame para ${nextLvl}`}
                    >
                      Fazer exame do próximo nível
                    </PrimaryButton>
                  ) : null}
                </div>
              ) : undefined,
            };
          })}
        />

        {recovering && cp.recovery ? (
          <GlassCard
            className="p-4 mt-4"
            style={{
              border: '1px solid color-mix(in srgb, var(--warm-orange) 40%, transparent)',
              background: 'color-mix(in srgb, var(--warm-orange) 12%, transparent)',
            }}
          >
            <p className="dt-label !text-[var(--warm-orange)]">Mudança de estratégia</p>
            <p className="text-[14px] font-semibold text-[var(--text-primary)] mt-1.5">
              {cp.recovery.strategy}
            </p>
            <p className="dt-muted mt-1 leading-relaxed">{cp.recovery.reason}</p>
          </GlassCard>
        ) : null}

        {overallPct != null ? (
          <p className="text-center text-[11px] text-[var(--text-faint)] tabular-nums pt-4 pb-2">
            Progresso geral · {overallPct}%
          </p>
        ) : null}
      </main>
      <BottomNav />
    </DTPage>
  );
}
