/**
 * Progresso — redesign visual Fase 3 (Dein Dominium).
 * Dados: getRealProgress / Learning State.
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { BottomNav } from '@/components/layout/BottomNav';
import { GlassCard, glassStyle } from '@/components/ui/GlassCard';
import { ProgressRing } from '@/components/ui/ProgressRing';
import { IconCube, IconPuzzle, IconWave, IconBriefcase } from '@/components/ui/Icons';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
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
      <GlassCard className="p-5 text-center">
        <p className="text-[13px] text-[#64748B]">Noch keine Aktivitätsdaten — starte eine Session.</p>
      </GlassCard>
    );
  }

  const values = days.map((d) => d.productions + d.reviews + d.chunksGained);
  const max = Math.max(1, ...values);
  const w = 280;
  const h = 96;
  const pad = 8;
  const points = values.map((v, i) => {
    const x = pad + (i / Math.max(1, values.length - 1)) * (w - pad * 2);
    const y = h - pad - (v / max) * (h - pad * 2);
    return `${x},${y}`;
  });

  return (
    <GlassCard className="p-4 overflow-hidden">
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-24" aria-label="Aktivitätsverlauf">
        <defs>
          <linearGradient id="actStroke" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#00F2FE" />
            <stop offset="100%" stopColor="#8B5CF6" />
          </linearGradient>
          <linearGradient id="actFill" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="rgba(0,242,254,0.35)" />
            <stop offset="100%" stopColor="rgba(0,242,254,0)" />
          </linearGradient>
        </defs>
        <polygon
          points={`${pad},${h - pad} ${points.join(' ')} ${w - pad},${h - pad}`}
          fill="url(#actFill)"
        />
        <polyline
          points={points.join(' ')}
          fill="none"
          stroke="url(#actStroke)"
          strokeWidth="2.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {values.map((v, i) => {
          const x = pad + (i / Math.max(1, values.length - 1)) * (w - pad * 2);
          const y = h - pad - (v / max) * (h - pad * 2);
          return <circle key={days[i].date} cx={x} cy={y} r="3.5" fill="#00F2FE" />;
        })}
      </svg>
      <div className="flex justify-between mt-1 px-1">
        {days.map((d) => (
          <span key={d.date} className="text-[9px] text-[#64748B] truncate max-w-[48px]">
            {d.label}
          </span>
        ))}
      </div>
    </GlassCard>
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

  return (
    <div className="flex flex-col h-full max-w-md mx-auto dt-page">
      <header className="px-5 pt-4 safe-top shrink-0 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[18px] font-bold text-white font-[family-name:var(--font-display)]">
            Progresso
          </h1>
          <p className="text-[12px] text-[#CBD5E1]">Dein Dominium</p>
        </div>
        <button
          type="button"
          onClick={() => navigate('/lernweg')}
          className="px-3 py-2 rounded-full text-[11px] font-bold text-white"
          style={{
            ...glassStyle,
            border: '1px solid rgba(0,242,254,0.35)',
            color: '#00F2FE',
          }}
        >
          Lernweg
        </button>
      </header>

      <main className="flex-1 overflow-y-auto scrollbar-hide px-5 pt-4 pb-28 space-y-5">
        <GlassCard variant="violet" className="p-6 flex flex-col items-center relative overflow-hidden">
          <span
            className="absolute -top-20 w-56 h-56 rounded-full pointer-events-none"
            style={{ background: 'radial-gradient(circle, rgba(139,92,246,0.4), transparent 70%)' }}
          />
          <ProgressRing
            value={mastery ?? 0}
            size={140}
            stroke={11}
            color="#8B5CF6"
            label={mastery != null ? `${mastery}%` : '—'}
          />
          <p className="relative mt-3 dt-label">Dein Dominium</p>
          <p className="relative text-[20px] font-bold text-white mt-1">
            {currentLevel} · {levelView.label}
          </p>
          {progress?.masteryDetail && (
            <p className="relative text-[12px] text-[#94A3B8] text-center mt-2 px-2">
              {progress.masteryDetail}
            </p>
          )}
        </GlassCard>

        <div className="grid grid-cols-2 gap-2.5">
          <StatTile
            icon={<IconCube size={18} />}
            tint="#8B5CF6"
            label="Chunks"
            value={progress ? String(progress.learnedChunks) : '—'}
            onClick={() => navigate('/chunks')}
          />
          <StatTile
            icon={<IconPuzzle size={18} />}
            tint="#00F2FE"
            label="Strukturen"
            value={structureCount != null ? String(structureCount) : '—'}
            onClick={() => navigate('/chunks')}
          />
          <StatTile
            icon={<IconBriefcase size={18} />}
            tint="#F97316"
            label="Situationen"
            value={situationsCount != null ? String(situationsCount) : '—'}
            onClick={() => navigate('/situacoes')}
          />
          <StatTile
            icon={<IconWave size={18} />}
            tint="#EC4899"
            label="Autonomie"
            value={
              progress?.autonomousSpeechPercent != null
                ? `${progress.autonomousSpeechPercent}%`
                : '—'
            }
          />
        </div>

        <section>
          <p className="dt-label mb-2">Aktivität</p>
          <ActivityChart days={progress?.activityDays ?? []} />
        </section>

        {progress && progress.recentAdvances.length > 0 && (
          <section>
            <p className="dt-label mb-2">Letzte Fortschritte</p>
            <GlassCard className="p-4 space-y-2">
              {progress.recentAdvances.map((a) => (
                <button
                  key={a.phraseId}
                  type="button"
                  onClick={() => navigate(`/estrutura/${encodeURIComponent(a.phraseId)}`)}
                  className="w-full text-left text-[14px] text-white flex items-center gap-2 active:opacity-80"
                >
                  <span className="text-[#22C55E]">+</span>
                  <span className="truncate">{a.german}</span>
                </button>
              ))}
            </GlassCard>
          </section>
        )}

        {progress && progress.weakAreas.length > 0 && (
          <section>
            <p className="dt-label mb-2">Noch üben</p>
            <GlassCard className="p-4 space-y-2">
              {progress.weakAreas.map((w) => (
                <button
                  key={w.phraseId}
                  type="button"
                  onClick={() => navigate('/revisar')}
                  className="w-full text-left text-[14px] text-white flex items-center gap-2"
                >
                  <span className="text-[#EC4899]">⚠</span>
                  <span className="truncate flex-1">{w.german}</span>
                  <span className="text-[10px] text-[#64748B] shrink-0">{w.reason}</span>
                </button>
              ))}
            </GlassCard>
          </section>
        )}

        {progress && progress.reviewQueueCount > 0 && (
          <button
            type="button"
            onClick={() => navigate('/revisar')}
            className="w-full py-3.5 rounded-[18px] text-[14px] font-bold text-white"
            style={{
              background: 'linear-gradient(135deg, #F97316, #EC4899)',
              boxShadow: '0 0 20px rgba(249,115,22,0.3)',
            }}
          >
            {progress.reviewQueueCount} Itens zur Revision
          </button>
        )}
      </main>
      <BottomNav />
    </div>
  );
}

function StatTile({
  icon,
  tint,
  label,
  value,
  onClick,
}: {
  icon: ReactNode;
  tint: string;
  label: string;
  value: string;
  onClick?: () => void;
}) {
  const Comp = onClick ? 'button' : 'div';
  return (
    <Comp
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className="rounded-[20px] p-4 text-left active:scale-[0.98] transition-transform duration-200"
      style={glassStyle}
    >
      <span
        className="w-9 h-9 rounded-xl flex items-center justify-center mb-2"
        style={{ background: `${tint}22`, color: tint, boxShadow: `0 0 12px ${tint}33` }}
      >
        {icon}
      </span>
      <p className="text-[20px] font-bold text-white tabular-nums">{value}</p>
      <p className="text-[11px] text-[#64748B] mt-0.5 uppercase tracking-wide">{label}</p>
    </Comp>
  );
}
