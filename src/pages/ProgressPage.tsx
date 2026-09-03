/**
 * Progresso — narrativa de domínio (DT design system).
 * Dados: getRealProgress / Learning State. Sem métricas inventadas.
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { BottomNav } from '@/components/layout/BottomNav';
import { IconCube, IconPuzzle, IconWave, IconBriefcase } from '@/components/ui/Icons';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import {
  DTPage,
  DTMain,
  DTTopBar,
  DTSectionLabel,
  DTGlassCard,
  DTMetricCard,
  DTProgressRing,
  DTNeonButton,
  DTBadge,
  glassStyle,
} from '@/components/dt';
import { useProfile } from '@/hooks/useProfile';
import { MemoryService } from '@/services/learning/MemoryService';
import {
  getCurrentLevel,
  getLevelPresentation,
  getStoredCourseProgress,
} from '@/services/course';
import { getRealProgress, type RealProgress } from '@/services/learning/RealProgress';
import { UNIFIED_SIMULATOR_SCENARIOS } from '@/services/teacher/ProfessorCore/SituationCatalog';
import { L0_CHUNK_GRAPH } from '@/services/teacher/ZeroLanguageMode';
import { readAutomationScore } from '@/services/learning/AutomationScoreEngine';
import type { UserLearningProfile } from '@/services/learning/ConfidenceService';

const TOPIC_HINTS: Record<string, string[]> = {
  work: ['arbeit'],
  home: ['wohn', 'hause'],
  needs: ['brauch'],
  food: ['moecht', 'essen'],
  places: ['wohn'],
  identity: ['heiss', 'komm'],
  routine: ['muss'],
  requests: ['kannst', 'hilfe'],
  help: ['hilfe'],
};

function countActiveDomains(learning: UserLearningProfile): number {
  let n = 0;
  for (const scenario of UNIFIED_SIMULATOR_SCENARIOS) {
    const hints = TOPIC_HINTS[scenario.topic] || [];
    const hit = Object.values(learning.phrases).some((c) => {
      if (!c || (c.timesSeen <= 0 && c.timesCorrect <= 0 && c.confidence <= 0)) return false;
      const id = c.phraseId.toLowerCase();
      return hints.some((h) => id.includes(h));
    });
    if (hit) n += 1;
  }
  return n;
}

function ActivityChart({ days }: { days: RealProgress['activityDays'] }) {
  if (days.length === 0) {
    return (
      <DTGlassCard className="p-4 text-center">
        <p className="text-[13px] text-[#64748B]">Ainda sem dados de atividade.</p>
      </DTGlassCard>
    );
  }

  const values = days.map((d) => d.productions + d.reviews + d.chunksGained);
  const max = Math.max(1, ...values);
  const w = 280;
  const h = 72;
  const pad = 6;
  const points = values.map((v, i) => {
    const x = pad + (i / Math.max(1, values.length - 1)) * (w - pad * 2);
    const y = h - pad - (v / max) * (h - pad * 2);
    return `${x},${y}`;
  });

  return (
    <DTGlassCard className="p-3 overflow-hidden">
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-16" aria-label="Atividade recente">
        <defs>
          <linearGradient id="actStrokeDt" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#00F2FE" />
            <stop offset="100%" stopColor="#8B5CF6" />
          </linearGradient>
          <linearGradient id="actFillDt" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="rgba(0,242,254,0.3)" />
            <stop offset="100%" stopColor="rgba(0,242,254,0)" />
          </linearGradient>
        </defs>
        <polygon
          points={`${pad},${h - pad} ${points.join(' ')} ${w - pad},${h - pad}`}
          fill="url(#actFillDt)"
        />
        <polyline
          points={points.join(' ')}
          fill="none"
          stroke="url(#actStrokeDt)"
          strokeWidth="2.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </svg>
      <div className="flex justify-between px-1">
        {days.map((d) => (
          <span key={d.date} className="text-[9px] text-[#64748B] truncate max-w-[40px]">
            {d.label}
          </span>
        ))}
      </div>
    </DTGlassCard>
  );
}

export function ProgressPage() {
  const navigate = useNavigate();
  const { profile, loading } = useProfile();
  const [progress, setProgress] = useState<RealProgress | null>(null);
  const [learning, setLearning] = useState<UserLearningProfile | null>(null);
  const course = getStoredCourseProgress();
  const currentLevel = profile ? getCurrentLevel(profile, course) : 'L0';
  const levelView = getLevelPresentation(currentLevel);

  useEffect(() => {
    if (!profile) return;
    let cancelled = false;
    void MemoryService.loadProfile(profile)
      .then(async (lp) => {
        const p = await getRealProgress(lp, currentLevel);
        if (!cancelled) {
          setLearning(lp);
          setProgress(p);
        }
      })
      .catch(() => {
        if (!cancelled) setProgress(null);
      });
    return () => {
      cancelled = true;
    };
  }, [profile, currentLevel]);

  const situationsCount = useMemo(
    () => (learning ? countActiveDomains(learning) : null),
    [learning],
  );

  const structureCount = useMemo(() => {
    if (!learning) return null;
    return Object.keys(L0_CHUNK_GRAPH).filter((id) => {
      const c = learning.phrases[id];
      return c && (c.timesCorrect > 0 || c.confidence > 0 || readAutomationScore(c) > 0);
    }).length;
  }, [learning]);

  if (loading || !profile) return <LoadingScreen />;

  const mastery = progress?.masteryPercent ?? null;
  const contentsDone = progress?.learnedChunks ?? null;
  const contentsTotal = progress?.learnedChunksTotal ?? null;
  const focus = progress?.weakAreas?.[0] ?? null;

  const domains: { icon: ReactNode; tint: string; label: string; value: string; to?: string }[] = [
    {
      icon: <IconCube size={16} />,
      tint: '#8B5CF6',
      label: 'Chunks',
      value: progress ? String(progress.learnedChunks) : '—',
      to: '/chunks',
    },
    {
      icon: <IconPuzzle size={16} />,
      tint: '#00F2FE',
      label: 'Estruturas',
      value: structureCount != null ? String(structureCount) : '—',
      to: '/chunks',
    },
    {
      icon: <IconBriefcase size={16} />,
      tint: '#F97316',
      label: 'Situações',
      value: situationsCount != null ? String(situationsCount) : '—',
      to: '/situacoes',
    },
    {
      icon: <IconWave size={16} />,
      tint: '#EC4899',
      label: 'Autonomia',
      value:
        progress?.autonomousSpeechPercent != null
          ? `${progress.autonomousSpeechPercent}%`
          : '—',
    },
  ];

  return (
    <DTPage>
      <DTTopBar
        title="Progresso"
        subtitle="Seu domínio"
        right={
          <button
            type="button"
            onClick={() => navigate('/lernweg')}
            className="px-3 py-2 rounded-full text-[11px] font-bold text-[#00F2FE]"
            style={{ ...glassStyle, border: '1px solid rgba(0,242,254,0.35)' }}
          >
            Jornada
          </button>
        }
      />

      <DTMain withNav className="pt-3 space-y-5">
        {/* Hero — domínio */}
        <div
          className="rounded-[28px] p-5 flex flex-col items-center relative overflow-hidden"
          style={{
            ...glassStyle,
            border: '1px solid rgba(139,92,246,0.4)',
            boxShadow: '0 0 28px rgba(139,92,246,0.18)',
          }}
        >
          <span
            className="absolute -top-20 w-52 h-52 rounded-full pointer-events-none"
            style={{ background: 'radial-gradient(circle, rgba(139,92,246,0.4), transparent 70%)' }}
          />
          <DTProgressRing
            value={mastery ?? 0}
            size={132}
            stroke={10}
            color="#8B5CF6"
            label={mastery != null ? `${mastery}%` : '—'}
          />
          <p className="relative mt-3 text-[22px] font-extrabold text-white font-[family-name:var(--font-display)]">
            {currentLevel}
          </p>
          <p className="relative text-[13px] text-[#CBD5E1]">{levelView.label}</p>
          {contentsDone != null && contentsTotal != null ? (
            <p className="relative mt-2 text-[12px] font-semibold text-[#94A3B8] tabular-nums">
              {contentsDone} de {contentsTotal} itens estudados
            </p>
          ) : null}
        </div>

        {/* Domínios horizontais */}
        <section>
          <DTSectionLabel className="mb-2">Domínios</DTSectionLabel>
          <div className="flex gap-2 overflow-x-auto scrollbar-hide">
            {domains.map((d) => (
              <div key={d.label} className="shrink-0 w-[108px]">
                <DTMetricCard
                  value={d.value}
                  label={d.label}
                  color={d.tint}
                  icon={d.icon}
                  onClick={d.to ? () => navigate(d.to!) : undefined}
                />
              </div>
            ))}
          </div>
        </section>

        {/* Atividade */}
        <section>
          <DTSectionLabel className="mb-2">Atividade</DTSectionLabel>
          <ActivityChart days={progress?.activityDays ?? []} />
        </section>

        {/* Próximo foco */}
        <section>
          <DTSectionLabel className="mb-2">Ainda precisa treinar</DTSectionLabel>
          {focus ? (
            <button
              type="button"
              onClick={() => navigate('/revisar')}
              className="w-full text-left rounded-[20px] p-4 active:scale-[0.98] transition-transform"
              style={{
                ...glassStyle,
                border: '1px solid rgba(236,72,153,0.4)',
              }}
            >
              <DTBadge color="#EC4899">Ponto fraco</DTBadge>
              <p className="mt-2 text-[16px] font-bold text-white">{focus.german}</p>
              {focus.reason ? (
                <p className="mt-1 text-[12px] text-[#94A3B8]">{focus.reason}</p>
              ) : null}
              <p className="mt-3 text-[12px] font-bold text-[#00F2FE]">Treinar agora →</p>
            </button>
          ) : (
            <DTGlassCard className="p-4">
              <p className="text-[13px] text-[#64748B]">
                Ainda não há dados suficientes para um foco.
              </p>
            </DTGlassCard>
          )}
        </section>

        {progress && progress.reviewQueueCount > 0 ? (
          <DTNeonButton onClick={() => navigate('/revisar')}>
            {progress.reviewQueueCount} itens para revisar
          </DTNeonButton>
        ) : null}
      </DTMain>

      <BottomNav />
    </DTPage>
  );
}
