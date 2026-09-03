/**
 * Mapa de Domínio / Jornada — níveis L0–B2 + cards de domínio.
 * Dados do Learning State (sem store novo).
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BottomNav } from '@/components/layout/BottomNav';
import {
  DTPage,
  DTMain,
  DTTopBar,
  DTSectionLabel,
  DTGlassCard,
  DTLevelSelector,
  DTBadge,
  glassStyle,
} from '@/components/dt';
import {
  IconBriefcase,
  IconHouse,
  IconDrop,
  IconWave,
  IconLock,
  IconUtensils,
  IconUsers,
  IconHelp,
} from '@/components/ui/Icons';
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

type DomainState = 'DOMINADO' | 'APRENDENDO' | 'FRACO' | 'AINDA NAO';

type DomainArea = {
  key: string;
  titleDe: string;
  topic: string;
  tint: string;
  Icon: typeof IconBriefcase;
};

const AREAS: DomainArea[] = [
  { key: 'alltag', titleDe: 'COTIDIANO', topic: 'routine', tint: '#A855F7', Icon: IconWave },
  { key: 'arbeit', titleDe: 'TRABALHO', topic: 'work', tint: '#F97316', Icon: IconBriefcase },
  { key: 'einkaufen', titleDe: 'COMPRAS', topic: 'needs', tint: '#00F2FE', Icon: IconDrop },
  { key: 'essen', titleDe: 'COMIDA', topic: 'food', tint: '#EC4899', Icon: IconUtensils },
  { key: 'zuhause', titleDe: 'CASA', topic: 'places', tint: '#8B5CF6', Icon: IconHouse },
  { key: 'sozial', titleDe: 'SOCIAL', topic: 'identity', tint: '#22D3EE', Icon: IconUsers },
  { key: 'hilfe', titleDe: 'AJUDA', topic: 'requests', tint: '#22C55E', Icon: IconHelp },
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

const STATE_PT: Record<DomainState, string> = {
  DOMINADO: 'Dominado',
  APRENDENDO: 'Aprendendo',
  FRACO: 'Fraco',
  'AINDA NAO': 'Ainda não',
};

function deriveState(
  learning: UserLearningProfile,
  topic: string,
): { state: DomainState; pct: number | null } {
  const hints = TOPIC_HINTS[topic] || [];
  const related = Object.values(learning.phrases).filter((c) => {
    if (!c) return false;
    if (c.timesSeen <= 0 && c.timesCorrect <= 0 && c.confidence <= 0 && c.state === 'new') {
      return false;
    }
    const id = c.phraseId.toLowerCase();
    return hints.some((h) => id.includes(h));
  });

  if (related.length === 0) return { state: 'AINDA NAO', pct: null };

  const avg = Math.round(
    related.reduce((s, c) => s + readAutomationScore(c), 0) / related.length,
  );
  const weak = related.some(
    (c) => c.needsHelp || c.confidence < 40 || readAutomationScore(c) < 35,
  );

  if (avg >= 70 && !weak) return { state: 'DOMINADO', pct: avg };
  if (weak) return { state: 'FRACO', pct: avg };
  return { state: 'APRENDENDO', pct: avg };
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

  void UNIFIED_SIMULATOR_SCENARIOS;

  const levelId = LEVELS.includes(currentLevel as CourseLevelId)
    ? (currentLevel as CourseLevelId)
    : 'L0';

  return (
    <DTPage>
      <DTTopBar
        title="JORNADA"
        subtitle="Mapa de aprendizado"
        onBack={() => navigate(-1)}
      />

      <DTMain>
        <div className="pt-3 space-y-6">
          <section>
            <div className="flex items-center justify-between mb-3">
              <DTSectionLabel>Níveis</DTSectionLabel>
              <DTBadge color="#A855F7">Atual: {levelId}</DTBadge>
            </div>
            <DTGlassCard className="p-4 mb-3">
              <DTLevelSelector current={levelId} />
            </DTGlassCard>
            <DTGlassCard className="p-5">
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
                                boxShadow:
                                  '0 0 0 4px rgba(139,92,246,0.25), 0 0 28px rgba(139,92,246,0.7)',
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
                        {locked ? <IconLock size={16} /> : done ? '✓' : lvl}
                      </span>
                      <span
                        className={`text-[11px] font-semibold mt-1.5 ${active ? 'text-[#c4b5fd]' : 'text-[#64748B]'}`}
                      >
                        {lvl}
                      </span>
                      {i < LEVELS.length - 1 && (
                        <span
                          className="w-px h-6 my-1"
                          style={{
                            background:
                              'linear-gradient(180deg, rgba(139,92,246,0.5), rgba(255,255,255,0.08))',
                          }}
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
            </DTGlassCard>
          </section>

          <section>
            <DTSectionLabel className="mb-3">Domínios</DTSectionLabel>
            <div className="grid grid-cols-2 gap-2.5">
              {AREAS.map((area) => {
                const st = areaStats[area.key];
                const state = st?.state ?? 'AINDA NAO';
                const glow =
                  state === 'DOMINADO'
                    ? `0 0 22px ${area.tint}88`
                    : state === 'APRENDENDO'
                      ? `0 0 14px ${area.tint}44`
                      : state === 'FRACO'
                        ? '0 0 14px rgba(236,72,153,0.45)'
                        : undefined;
                const opacity = state === 'AINDA NAO' ? 0.5 : 1;
                return (
                  <DTGlassCard
                    key={area.key}
                    className="p-4"
                    onClick={() => navigate('/situacoes')}
                    style={{
                      border:
                        state === 'FRACO'
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
                          state === 'DOMINADO'
                            ? '#22C55E'
                            : state === 'FRACO'
                              ? '#EC4899'
                              : state === 'APRENDENDO'
                                ? '#00F2FE'
                                : '#64748B',
                      }}
                    >
                      {STATE_PT[state]}
                      {st?.pct != null ? ` · ${st.pct}%` : ''}
                    </p>
                  </DTGlassCard>
                );
              })}
            </div>
          </section>
        </div>
      </DTMain>
      <BottomNav />
    </DTPage>
  );
}
