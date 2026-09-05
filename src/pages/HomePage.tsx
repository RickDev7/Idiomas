/**
 * Home — briefing diário.
 * Composição: header → saudação → hero CTA → 3 cards de apoio → BottomNav.
 * Sem trilha L0–C2, sem CTAs concorrentes, sem lista “O que estudar agora”.
 * Dados reais: profile, ContinueCourse, RealProgress, revisão pendente.
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { useProfile } from '@/hooks/useProfile';
import { useUserMetrics } from '@/hooks/useUserMetrics';
import { DailyGoalSheet } from '@/components/home/DailyGoalSheet';
import { HomeCockpitHeader } from '@/components/home/HomeSections';
import { HomeBriefingSupport } from '@/components/home/HomeBriefingSupport';
import { ContinueCourseCard } from '@/components/home/ContinueCourseCard';
import { BottomNav } from '@/components/layout/BottomNav';
import { DTPage, DTMain } from '@/components/dt';
import {
  getCurrentLevel,
  loadCourseProgress,
  getContinueCourseState,
  beginContinueCourseSession,
  buildModuleSessionContext,
  storeSelectedModuleContext,
  type CourseProgress,
} from '@/services/course';
import { levelJourneyTitle } from '@/services/course/MeuCursoPresentation';
import { SoundService } from '@/services/ui/SoundService';
import { clearSelectedLearningTarget } from '@/services/teacher/LessonStartIntent';
import { haptic } from '@/services/ui/HapticService';
import { MemoryService } from '@/services/learning/MemoryService';
import { getRealProgress, type RealProgress } from '@/services/learning/RealProgress';
import type { UserLearningProfile } from '@/services/learning/ConfidenceService';
import { getDueReviews } from '@/services/learning/ReviewRepository';
import { useChunkTracker } from '@/hooks/useChunkTracker';
import type { CourseLevelId } from '@/services/course/types';

export function HomePage() {
  const { profile, loading } = useProfile();
  const navigate = useNavigate();
  const { setDailyGoal, dismissMorningPrompt, dailyGoalMinutes, showMorningPrompt } =
    useUserMetrics();
  const { activeChunk } = useChunkTracker();
  const [goalSheetOpen, setGoalSheetOpen] = useState(false);
  const [goalSheetMode, setGoalSheetMode] = useState<'morning' | 'edit'>('edit');
  const [course, setCourse] = useState<CourseProgress | null>(null);
  const [learning, setLearning] = useState<UserLearningProfile | null>(null);
  const [progress, setProgress] = useState<RealProgress | null>(null);
  const [dueReviewCount, setDueReviewCount] = useState<number | null>(null);

  useEffect(() => {
    if (!profile) return;
    let cancelled = false;
    void (async () => {
      const cp = await loadCourseProgress(profile.level).catch(() => null);
      const lp = await MemoryService.loadProfile(profile).catch(() => null);
      const level = getCurrentLevel(profile, cp);
      const rp = lp ? await getRealProgress(lp, level).catch(() => null) : null;
      if (cancelled) return;
      setCourse(cp);
      setLearning(lp);
      setProgress(rp);
    })();
    return () => {
      cancelled = true;
    };
  }, [profile]);

  useEffect(() => {
    let cancelled = false;
    void getDueReviews(12)
      .then((q) => {
        if (!cancelled) setDueReviewCount(q.length);
      })
      .catch(() => {
        if (!cancelled) setDueReviewCount(0);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (showMorningPrompt) {
      setGoalSheetMode('morning');
      setGoalSheetOpen(true);
    }
  }, [showMorningPrompt]);

  const currentLevel = profile ? getCurrentLevel(profile, course) : 'L0';

  const continueState = useMemo(() => {
    if (!learning) {
      return getContinueCourseState({
        learning: null,
        userLevel: currentLevel,
        course,
      });
    }
    return getContinueCourseState({
      learning,
      userLevel: currentLevel,
      course,
      explicitTargetId: null,
    });
  }, [learning, currentLevel, course]);

  if (loading || !profile || !profile.onboardingComplete) {
    return <LoadingScreen />;
  }

  const levelId = (['L0', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2'].includes(currentLevel)
    ? currentLevel
    : 'L0') as CourseLevelId;
  const name = profile.name?.trim();

  const onContinueCourse = () => {
    haptic();
    SoundService.play('start');
    beginContinueCourseSession(navigate, continueState, {
      storeModuleContext: storeSelectedModuleContext,
      buildModuleContext: buildModuleSessionContext,
      clearSelectedLearningTarget,
      goJornada: () => navigate('/jornada'),
    });
  };

  const focusText =
    continueState.activityLabel?.trim() ||
    (progress?.autonomousSpeechPercent != null
      ? `Falar com autonomia · ${progress.autonomousSpeechPercent}%`
      : levelJourneyTitle(levelId));

  const nextSkill =
    continueState.targetGerman?.trim() ||
    continueState.moduleTitle?.trim() ||
    activeChunk?.german?.trim() ||
    continueState.headline ||
    'Seu próximo treino';

  const reviewText =
    dueReviewCount == null
      ? 'Carregando…'
      : dueReviewCount === 0
        ? 'Nada pendente agora'
        : dueReviewCount === 1
          ? '1 item'
          : `${dueReviewCount} itens`;

  return (
    <DTPage className="home-briefing">
      <HomeCockpitHeader
        name={name}
        streak={profile.streak || 0}
        level={levelId}
        onStreak={() => navigate('/progresso')}
        onBell={() => navigate('/configuracoes')}
      />

      <DTMain className="pt-2 !space-y-0">
        <div className="flex flex-col gap-3 pb-1">
          <ContinueCourseCard
            state={continueState}
            onContinue={onContinueCourse}
            onOpenCourse={() => navigate('/jornada')}
          />

          <HomeBriefingSupport
            focus={focusText}
            nextSkill={nextSkill}
            reviewPending={reviewText}
            onFocus={() => navigate('/progresso')}
            onNextSkill={onContinueCourse}
            onReview={() => navigate('/revisar')}
          />
        </div>
      </DTMain>

      <BottomNav />
      <DailyGoalSheet
        open={goalSheetOpen}
        mode={goalSheetMode}
        currentGoal={dailyGoalMinutes}
        onSelect={(minutes) => {
          setDailyGoal(minutes);
          dismissMorningPrompt();
        }}
        onClose={() => {
          setGoalSheetOpen(false);
          if (goalSheetMode === 'morning') dismissMorningPrompt();
        }}
      />
    </DTPage>
  );
}
