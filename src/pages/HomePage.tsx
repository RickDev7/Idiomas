import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { useProfile, useProgress } from '@/hooks/useProfile';
import { greetingForNow, planTodaysTraining } from '@/services/teacher/TeacherEngine';
import { getTodaySession } from '@/services/storage/initData';
import { AppHeader } from '@/components/ui/PageHeader';
import { Greeting, TrainingHero, ProgressSection } from '@/components/home/HomeSections';
import { CourseJourneyCard } from '@/components/home/CourseJourneyCard';
import { BottomNav } from '@/components/layout/BottomNav';
import { IconChat, IconEar, IconBolt, IconSprout } from '@/components/ui/Icons';
import {
  getCurrentLevel,
  getLevelPresentation,
  getStoredCourseProgress,
  type CourseProgress,
} from '@/services/course';
import { getIncompleteSession } from '@/services/teacher/sessionContinuity';
import { t } from '@/services/ui/LocaleService';
import { SoundService } from '@/services/ui/SoundService';
import { MemoryService } from '@/services/learning/MemoryService';
import { computeProgress } from '@/services/learning/ProgressEngine';

export function HomePage() {
  const { profile, loading } = useProfile();
  const { progress } = useProgress();
  const navigate = useNavigate();
  const [course, setCourse] = useState<CourseProgress | null>(null);
  const [incomplete, setIncomplete] = useState(() => getIncompleteSession());
  const [automation, setAutomation] = useState(0);
  const [commScore, setCommScore] = useState<number | null>(null);
  const [compScore, setCompScore] = useState<number | null>(null);

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

  useEffect(() => {
    if (!profile) return;
    MemoryService.loadProfile(profile).then((learning) => {
      const p = computeProgress(learning);
      setAutomation(p.automationScore);
      setCommScore(p.communicationScore);
      setCompScore(p.comprehensionScore);
    }).catch(() => {});
  }, [profile]);

  if (loading || !profile || !profile.onboardingComplete) {
    return <LoadingScreen />;
  }

  const training = planTodaysTraining(profile, []);
  const greeting = greetingForNow();
  const warmupMinutes = training.stages.find((s) => s.id === 'warmup')?.minutes ?? 2;
  const currentLevel = getCurrentLevel(profile, course);
  const levelView = getLevelPresentation(currentLevel);

  const comm = commScore ?? progress?.communicationScore ?? 0;
  const comp = compScore ?? progress?.listening ?? 0;

  const startTraining = async () => {
    await getTodaySession(profile);
    const type = profile.firstLessonComplete ? 'lesson' : 'first';
    SoundService.play('start');
    navigate(`/sessao?type=${type}`);
  };

  const goProgress = () => navigate('/progresso');

  const metrics = [
    { icon: <IconChat size={18} />, value: comm, name: 'Comunicação', color: '#8b5cf6', trackClass: 'bg-[#8b5cf6]/15', barClass: 'bg-[#8b5cf6]', onClick: goProgress },
    { icon: <IconEar size={18} />, value: comp, name: 'Compreensão', color: '#10b981', trackClass: 'bg-success/15', barClass: 'bg-success', onClick: goProgress },
    { icon: <IconBolt size={18} />, value: automation, name: 'Automação', color: '#a78bfa', trackClass: 'bg-[#a78bfa]/15', barClass: 'bg-[#a78bfa]', onClick: goProgress },
  ];

  const topicPt: Record<string, string> = {
    daily: 'rotina',
    work: 'trabalho',
    family: 'família',
    travel: 'viagem',
    survival: 'sobrevivência',
    presentation: 'apresentação',
  };
  const continueTopic = incomplete?.topic ? (topicPt[incomplete.topic] || incomplete.topic) : '';

  return (
    <div className="flex flex-col h-full bg-background max-w-md mx-auto">
      <AppHeader onSettings={() => navigate('/configuracoes')} />
      <main className="flex-1 overflow-y-auto scrollbar-hide pb-28">
        <Greeting greeting={greeting} name={profile.name} streak={profile.streak} onStreak={() => navigate('/progresso')} />
        <CourseJourneyCard profile={profile} />
        <TrainingHero
          totalMinutes={training.totalMinutes}
          warmupMinutes={warmupMinutes}
          levelLabel={levelView.label}
          levelIcon={currentLevel === 'L0' ? <IconSprout size={14} /> : '🎯'}
          onStart={startTraining}
          continueMode={!!incomplete}
          title={incomplete ? t('home.continue') : t('home.start')}
          subtitle={
            incomplete
              ? (continueTopic ? `Você parou enquanto praticava ${continueTopic}.` : 'Continuando de onde você parou.')
              : 'Conversa guiada com seu professor'
          }
          ariaLabel={incomplete ? t('home.continue') : t('home.start')}
        />
        <ProgressSection metrics={metrics} />
      </main>
      <BottomNav />
    </div>
  );
}
