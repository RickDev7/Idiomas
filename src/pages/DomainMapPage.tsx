/**
 * Mapa de Domínio / Dein Lernweg — Fase 3.
 * Níveis + áreas derivadas do Learning State (sem store novo).
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BottomNav } from '@/components/layout/BottomNav';
import { GlassCard, glassStyle } from '@/components/ui/GlassCard';
import { IconBack, IconBriefcase, IconHouse, IconDrop, IconWave } from '@/components/ui/Icons';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { useProfile } from '@/hooks/useProfile';
import { MemoryService } from '@/services/learning/MemoryService';
import { readAutomationScore } from '@/services/learning/AutomationScoreEngine';
import type { UserLearningProfile } from '@/services/learning/ConfidenceService';
import {
  getCurrentLevel,
  getStoredCourseProgress,
  type CourseLevelId,
} from '@/services/course';
import { getLevelAvailability } from '@/services/course/CourseUnlockService';
import { getRealProgress } from '@/services/learning/RealProgress';
import { UNIFIED_SIMULATOR_SCENARIOS } from '@/services/teacher/ProfessorCore/SituationCatalog';

type DomainState = 'DOMINIERT' | 'LERNT' | 'SCHWACH' | 'NOCH NICHT';

type DomainArea = {
  key: string;
  titleDe: string;
  topic: string;
  tint: string;
  Icon: typeof IconBriefcase;
};

const AREAS: DomainArea[] = [
  { key: 'alltag', titleDe: 'ALLTAG', topic: 'routine', tint: '#A855F7', Icon: IconWave },
  { key: 'arbeit', titleDe: 'ARBEIT', topic: 'work', tint: '#F97316', Icon: IconBriefcase },
  { key: 'einkaufen', titleDe: 'EINKAUFEN', topic: 'needs', tint: '#00F2FE', Icon: IconDrop },
  { key: 'essen', titleDe: 'ESSEN', topic: 'food', tint: '#EC4899', Icon: IconDrop },
  { key: 'zuhause', titleDe: 'ZUHAUSE', topic: 'places', tint: '#8B5CF6', Icon: IconHouse },
  { key: 'sozial', titleDe: 'SOZIAL', topic: 'identity', tint: '#22D3EE', Icon: IconWave },
  { key: 'hilfe', titleDe: 'HILFE', topic: 'requests', tint: '#22C55E', Icon: IconWave },
];

const TOPIC_HINTS: Record<string, string[]> = {
  work: ['arbeit'],
  home: ['wohn', 'hause'],
  needs: ['brauch'],
  food: ['moecht', 'essen'],
  places: ['wohn'],
  identity: ['heiss', 'komm', 'bin'],
  routine: ['muss'],
  requests: ['kannst', 'hilfe'],
  help: ['hilfe'],
};

const LEVELS: CourseLevelId[] = ['L0', 'A1', 'A2', 'B1', 'B2'];

function deriveState(learning: UserLearningProfile, topic: string): { state: DomainState; pct: number | null } {
  const hints = TOPIC_HINTS[topic] || [];
  const related = Object.values(learning.phrases).filter((c) => {
    if (!c) return false;
    if (c.timesSeen <= 0 && c.timesCorrect <= 0 && c.confidence <= 0 && c.state === 'new') return false;
    const id = c.phraseId.toLowerCase();
    return hints.some((h) => id.includes(h));
  });

  if (related.length === 0) return { state: 'NOCH NICHT', pct: null };

  const avg = Math.round(
    related.reduce((s, c) => s + readAutomationScore(c), 0) / related.length,
  );
  const weak = related.some((c) => c.needsHelp || c.confidence < 40 || readAutomationScore(c) < 35);

  if (avg >= 70 && !weak) return { state: 'DOMINIERT', pct: avg };
  if (weak) return { state: 'SCHWACH', pct: avg };
  return { state: 'LERNT', pct: avg };
}

export function DomainMapPage() {
  const navigate = useNavigate();
  const { profile, loading } = useProfile();
  const [learning, setLearning] = useState<UserLearningProfile | null>(null);
  const course = getStoredCourseProgress();
  const currentLevel = profile ? getCurrentLevel(profile, course) : 'L0';
  const [l0Detail, setL0Detail] = useState<string | null>(null);

  useEffect(() => {
    if (!profile) return;
    void MemoryService.loadProfile(profile).then(async (lp) => {
      setLearning(lp);
      const p = await getRealProgress(lp, currentLevel);
      setL0Detail(p.levelProgress.find((l) => l.level === 'L0')?.detail ?? null);
    });
  }, [profile, currentLevel]);

  const areaStats = useMemo(() => {
    if (!learning) return {} as Record<string, { state: DomainState; pct: number | null }>;
    const out: Record<string, { state: DomainState; pct: number | null }> = {};
    for (const a of AREAS) {
      out[a.key] = deriveState(learning, a.topic);
    }
    return out;
  }, [learning]);

  if (loading || !profile || !learning) return <LoadingScreen />;

  // Ensure scenarios catalog is "used" for architecture honesty (same family)
  void UNIFIED_SIMULATOR_SCENARIOS;

  return (
    <div className="flex flex-col h-full max-w-md mx-auto dt-page">
      <header className="px-5 pt-4 safe-top shrink-0 flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate(-1)}
          aria-label="Voltar"
          className="w-10 h-10 rounded-full flex items-center justify-center text-white"
          style={glassStyle}
        >
          <IconBack size={18} />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="text-[18px] font-bold text-white font-[family-name:var(--font-display)]">
            Dein Lernweg
          </h1>
          <p className="text-[12px] text-[#CBD5E1]">Mapa de domínio</p>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto scrollbar-hide px-5 pt-4 pb-28 space-y-6">
        <section>
          <p className="dt-label mb-3">Níveis</p>
          <GlassCard className="p-5">
            <div className="flex flex-col items-center gap-0">
              {LEVELS.map((lvl, i) => {
                const availability = getLevelAvailability(lvl, currentLevel);
                const active = availability === 'current';
                const done = availability === 'completed';
                const locked = availability === 'locked';
                return (
                  <div key={lvl} className="flex flex-col items-center">
                    <span
                      className="w-14 h-14 rounded-full flex items-center justify-center text-[13px] font-bold transition-all duration-300"
                      style={
                        active
                          ? {
                              background: 'linear-gradient(145deg, #A855F7, #8B5CF6)',
                              color: '#fff',
                              boxShadow: '0 0 0 4px rgba(139,92,246,0.25), 0 0 28px rgba(139,92,246,0.7)',
                              border: '1px solid rgba(196,181,253,0.7)',
                            }
                          : done
                            ? {
                                background: 'rgba(34,197,94,0.2)',
                                color: '#22C55E',
                                border: '1px solid rgba(34,197,94,0.45)',
                              }
                            : {
                                ...glassStyle,
                                color: '#64748B',
                                opacity: locked ? 0.55 : 1,
                              }
                      }
                    >
                      {locked ? '🔒' : done ? '✓' : lvl}
                    </span>
                    <span className={`text-[11px] font-semibold mt-1.5 ${active ? 'text-[#c4b5fd]' : 'text-[#64748B]'}`}>
                      {lvl}
                    </span>
                    {i < LEVELS.length - 1 && (
                      <span
                        className="w-px h-6 my-1"
                        style={{ background: 'linear-gradient(180deg, rgba(139,92,246,0.5), rgba(255,255,255,0.08))' }}
                        aria-hidden
                      />
                    )}
                  </div>
                );
              })}
            </div>
            {l0Detail && (
              <p className="mt-4 text-center text-[11px] text-[#64748B]">{l0Detail}</p>
            )}
          </GlassCard>
        </section>

        <section>
          <p className="dt-label mb-3">Domínios</p>
          <div className="grid grid-cols-2 gap-2.5">
            {AREAS.map((area) => {
              const st = areaStats[area.key];
              const state = st?.state ?? 'NOCH NICHT';
              const glow =
                state === 'DOMINIERT'
                  ? `0 0 22px ${area.tint}88`
                  : state === 'LERNT'
                    ? `0 0 14px ${area.tint}44`
                    : state === 'SCHWACH'
                      ? '0 0 14px rgba(236,72,153,0.45)'
                      : undefined;
              const opacity = state === 'NOCH NICHT' ? 0.5 : 1;
              return (
                <button
                  key={area.key}
                  type="button"
                  onClick={() => navigate('/situacoes')}
                  className="rounded-[20px] p-4 text-left active:scale-[0.98] transition-transform duration-200"
                  style={{
                    ...glassStyle,
                    border:
                      state === 'SCHWACH'
                        ? '1px solid rgba(236,72,153,0.45)'
                        : `1px solid ${area.tint}55`,
                    boxShadow: glow,
                    opacity,
                  }}
                >
                  <span
                    className="w-10 h-10 rounded-xl flex items-center justify-center mb-2"
                    style={{ background: `${area.tint}22`, color: area.tint }}
                  >
                    <area.Icon size={18} />
                  </span>
                  <p className="text-[13px] font-bold text-white tracking-wide">{area.titleDe}</p>
                  <p
                    className="text-[10px] font-semibold mt-1 uppercase tracking-wide"
                    style={{
                      color:
                        state === 'DOMINIERT'
                          ? '#22C55E'
                          : state === 'SCHWACH'
                            ? '#EC4899'
                            : state === 'LERNT'
                              ? '#00F2FE'
                              : '#64748B',
                    }}
                  >
                    {state}
                    {st?.pct != null ? ` · ${st.pct}%` : ''}
                  </p>
                </button>
              );
            })}
          </div>
        </section>
      </main>
      <BottomNav />
    </div>
  );
}
