import { useEffect, useState } from 'react';
import { BottomNav } from '@/components/layout/BottomNav';
import { AppHeader, SectionLabel, PageTitle, PageSubtitle } from '@/components/ui/PageHeader';
import { ProgressBar } from '@/components/ui/Shared';
import { LevelRing } from '@/components/ui/LevelRing';
import { IconFlame, IconEar, IconBolt, IconChat, IconClock, IconGearSmall } from '@/components/ui/Icons';
import { useProgress, useProfile } from '@/hooks/useProfile';
import { formatStudyTime } from '@/services/teacher/TeacherEngine';
import { MemoryService } from '@/services/learning/MemoryService';
import { computeProgress, type ProgressSummary } from '@/services/learning/ProgressEngine';
import {
  getCurrentLevel,
  getLevelPresentation,
  getStoredCourseProgress,
  type CourseLevelId,
} from '@/services/course';

const LEVEL_BADGE: Record<CourseLevelId, { label: string; className: string }> = {
  L0: { label: 'Iniciante', className: 'bg-success/15 text-success' },
  A1: { label: 'Iniciante', className: 'bg-success/15 text-success' },
  A2: { label: 'Intermediário', className: 'bg-primary/15 text-primary' },
  B1: { label: 'Intermediário', className: 'bg-primary/15 text-primary' },
  B2: { label: 'Avançado', className: 'bg-accent/15 text-accent' },
  C1: { label: 'Avançado', className: 'bg-accent/15 text-accent' },
  C2: { label: 'Fluente', className: 'bg-purple/15 text-purple' },
};

export function ProgressPage() {
  const { progress } = useProgress();
  const { profile } = useProfile();
  const [summary, setSummary] = useState<ProgressSummary | null>(null);
  const course = getStoredCourseProgress();
  const currentLevel = profile ? getCurrentLevel(profile, course) : 'L0';
  const levelView = getLevelPresentation(currentLevel);
  const badge = LEVEL_BADGE[currentLevel] ?? LEVEL_BADGE.L0;
  const levelDisplay = currentLevel === 'L0' ? '0' : currentLevel;

  useEffect(() => {
    if (!profile) return;
    MemoryService.loadProfile(profile).then((learning) => {
      setSummary(computeProgress(learning));
    }).catch(() => setSummary(null));
  }, [profile]);

  const communication = summary?.communicationScore ?? progress?.communicationScore ?? 0;
  const independence = summary?.independenceScore ?? 0;
  const comprehension = summary?.comprehensionScore ?? progress?.listening ?? 0;
  const automation = summary?.automationScore ?? 0;
  const streak = profile?.streak ?? 0;
  const totalMin = progress?.totalStudyMinutes ?? 0;

  const skills = [
    { icon: <IconChat size={18} />, name: 'Comunicação', desc: 'Falar e se expressar', value: communication, color: '#7c3aed', bar: 'bg-[#7c3aed]' },
    { icon: <IconEar size={18} />, name: 'Compreensão', desc: 'Entender o que ouve', value: comprehension, color: '#10b981', bar: 'bg-success' },
    { icon: <IconBolt size={18} />, name: 'Independência', desc: 'Falar sem ajuda', value: independence, color: '#f59e0b', bar: 'bg-accent' },
    { icon: <IconGearSmall size={18} />, name: 'Automação', desc: 'Usar sem pensar', value: automation, color: '#a78bfa', bar: 'bg-[#a78bfa]' },
  ];

  return (
    <div className="flex flex-col h-full bg-background max-w-md mx-auto">
      <AppHeader />
      <main className="flex-1 overflow-y-auto scrollbar-hide px-5 pt-3 pb-28">
        <SectionLabel tone="pink">Progresso</SectionLabel>
        <PageTitle className="mt-1.5">
          Seu alemão <span className="text-primary" aria-hidden>📈</span>
        </PageTitle>
        <PageSubtitle>Acompanhe sua evolução diária.</PageSubtitle>

        <div
          className="mt-6 rounded-[28px] shadow-lg relative overflow-hidden animate-slide-up aspect-[3/2] min-h-[260px] flex items-center justify-center"
          style={{
            border: '1px solid var(--border)',
            boxShadow: 'var(--shadow-glow-purple)',
          }}
        >
          <img
            src="/assets/berlin-skyline.png"
            alt=""
            className="absolute inset-0 w-full h-full object-cover object-center pointer-events-none select-none"
            draggable={false}
          />
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                'radial-gradient(circle at 50% 42%, rgba(8,18,32,0.55) 0%, rgba(8,18,32,0.22) 52%, rgba(8,18,32,0.35) 100%)',
            }}
            aria-hidden
          />
          <div className="relative z-10 flex justify-center py-6 px-5">
            <LevelRing
              value={communication}
              levelDisplay={levelDisplay}
              areaLabel="Comunicação"
              badge={badge.label}
              badgeClass={badge.className}
              onDark
            />
          </div>
        </div>

        <div className="mt-4 rounded-[28px] dt-glass p-5">
          <p className="text-eyebrow text-text-faint tracking-[0.16em] font-semibold uppercase mb-4">Competências</p>
          <div className="space-y-5">
            {skills.map((s) => (
              <div key={s.name}>
                <div className="flex items-center gap-3 mb-2">
                  <span className="w-9 h-9 rounded-full flex items-center justify-center shrink-0" style={{ background: `${s.color}22`, color: s.color }}>
                    {s.icon}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-body font-semibold text-text leading-tight">{s.name}</p>
                    <p className="text-caption text-text-faint leading-tight mt-0.5">{s.desc}</p>
                  </div>
                  <span className="text-body font-bold text-text">
                    {s.value}<span className="text-caption text-text-faint font-normal"> /100</span>
                  </span>
                </div>
                <ProgressBar value={s.value} color={s.bar} />
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 pb-2">
          <div className="rounded-[22px] dt-glass p-4">
            <span className="w-9 h-9 rounded-full bg-accent/15 flex items-center justify-center text-accent">
              <IconFlame size={18} />
            </span>
            <p className="text-h2 font-bold text-text mt-2.5">
              {streak} <span className="text-body font-semibold">{streak === 1 ? 'dia' : 'dias'}</span>
            </p>
            <p className="text-caption text-text-faint mt-0.5">Sequência atual</p>
          </div>
          <div className="rounded-[22px] dt-glass p-4">
            <span className="w-9 h-9 rounded-full bg-[#7c3aed]/15 flex items-center justify-center text-[#a78bfa]">
              <IconClock size={18} />
            </span>
            <p className="text-h2 font-bold text-text mt-2.5">{formatStudyTime(totalMin)}</p>
            <p className="text-caption text-text-faint mt-0.5">Tempo total de estudo</p>
          </div>
        </div>
        <p className="sr-only">Nível do curso: {levelView.label}</p>
      </main>
      <BottomNav />
    </div>
  );
}
