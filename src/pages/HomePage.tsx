import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { useProfile } from '@/hooks/useProfile';
import { greetingForNow, planTodaysTraining } from '@/services/teacher/TeacherEngine';
import { getTodaySession } from '@/services/storage/initData';
import {
  HomeGreetingHeader,
  LevelTrack,
  TrainingHero,
  ChunksOfDay,
  ProgressSection,
} from '@/components/home/HomeSections';
import { BottomNav } from '@/components/layout/BottomNav';
import { IconCube, IconPuzzle, IconWave, IconClock } from '@/components/ui/Icons';
import {
  getCurrentLevel,
  getStoredCourseProgress,
  type CourseProgress,
} from '@/services/course';
import { getIncompleteSession } from '@/services/teacher/sessionContinuity';
import { t } from '@/services/ui/LocaleService';
import { SoundService } from '@/services/ui/SoundService';

export function HomePage() {
  const { profile, loading } = useProfile();
  const navigate = useNavigate();
  const [course, setCourse] = useState<CourseProgress | null>(null);
  const [incomplete, setIncomplete] = useState(() => getIncompleteSession());

  useEffect(() => {
    if (loading) return;
    if (!profile || !profile.onboardingComplete) {
      navigate('/onboarding', { replace: true });
    }
  }, [loading, profile, navigate]);

  useEffect(() => {
    const refresh = () => {
      setCourse(getStoredCourseProgress());
      setIncomplete(getIncompleteSession());
    };
    refresh();
    window.addEventListener('focus', refresh);
    return () => window.removeEventListener('focus', refresh);
  }, [profile?.diagnosticLevel, profile?.selfReportedLevel, profile?.currentDay]);

  if (loading || !profile || !profile.onboardingComplete) {
    return <LoadingScreen />;
  }

  const training = planTodaysTraining(profile, []);
  const greeting = greetingForNow();
  const currentLevel = getCurrentLevel(profile, course);
  const progressPct = incomplete ? 55 : 42;

  const startTraining = async () => {
    await getTodaySession(profile);
    const type = profile.firstLessonComplete ? 'lesson' : 'first';
    SoundService.play('start');
    navigate(`/sessao?type=${type}`);
  };

  const goProgress = () => navigate('/progresso');

  const metrics = [
    { icon: <IconCube size={18} />, value: 12, name: 'Chunks aprendidos', color: '#8B5CF6', onClick: goProgress },
    { icon: <IconPuzzle size={18} />, value: 48, name: 'Variações criadas', color: '#10B981', onClick: goProgress },
    { icon: <IconWave size={18} />, value: '68%', name: 'Fala autônoma', color: '#FF512F', onClick: goProgress },
    { icon: <IconClock size={18} />, value: '21 min', name: 'Estudados hoje', color: '#38bdf8', onClick: goProgress },
  ];

  const levelId = ['L0', 'A1', 'A2', 'B1', 'B2'].includes(currentLevel) ? currentLevel : 'L0';

  return (
    <div className="flex flex-col h-full max-w-md mx-auto" style={{ background: '#070A12' }}>
      <HomeGreetingHeader
        greeting={greeting}
        name={profile.name}
        streak={profile.streak || 7}
        onStreak={goProgress}
        onBell={() => navigate('/configuracoes')}
      />
      <main className="flex-1 overflow-y-auto scrollbar-hide pb-28">
        <LevelTrack current={levelId} />
        <TrainingHero
          totalMinutes={training.totalMinutes || 20}
          remainingLabel={`${training.totalMinutes || 20} min restantes`}
          progressPct={progressPct}
          onStart={startTraining}
          title={incomplete ? t('home.continue') : 'Continuar treino'}
          ariaLabel={incomplete ? t('home.continue') : 'Continuar treino'}
          continueMode
        />
        <ChunksOfDay />
        <ProgressSection metrics={metrics} />
      </main>
      <BottomNav />
    </div>
  );
}
