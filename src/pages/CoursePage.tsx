/* CoursePage — "Sua jornada" detalhada: níveis 0→C2, competências, gates,
   habilidades, módulos e recovery quando há platô. Visual polido Fase 5. */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BottomNav } from '@/components/layout/BottomNav';
import { DtPageHeader } from '@/components/ui/PageHeader';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { PrimaryButton } from '@/components/ui/Button';
import { GlassCard } from '@/components/ui/GlassCard';
import { useProfile } from '@/hooks/useProfile';
import {
  loadCourseProgress, buildRecommendation, competencyStatusForLevel,
  LEVEL_BY_ID, LEVEL_ORDER, GRAMMAR_BY_ID, isRecoveryActive,
  getCurrentLevel,
  type CourseProgress, type CourseLevelId, type SkillId,
  type AvailabilityState,
} from '@/services/course';

const AVAIL_META: Record<AvailabilityState, { label: string; color: string; bg: string }> = {
  LOCKED_BY_LEVEL: { label: 'Bloqueado', color: '#64748B', bg: 'rgba(255,255,255,0.06)' },
  LOCKED_BY_PREREQUISITE: { label: 'Complete primeiro', color: '#CBD5E1', bg: 'rgba(255,255,255,0.06)' },
  AVAILABLE: { label: 'Disponível', color: '#00F2FE', bg: 'rgba(0,242,254,0.14)' },
  IN_PROGRESS: { label: 'Em progresso', color: '#F97316', bg: 'rgba(249,115,22,0.14)' },
  MASTERED: { label: 'Dominado', color: '#22C55E', bg: 'rgba(34,197,94,0.14)' },
  NEEDS_REVIEW: { label: 'Reforçar', color: '#F59E0B', bg: 'rgba(245,158,11,0.14)' },
};

const LEVEL_STATUS_LABEL = {
  done: '✓ Concluído',
  current: 'ATUAL',
  locked: 'Bloqueado',
} as const;

const SKILL_LABEL: Record<SkillId, string> = {
  listening: 'Escuta',
  speaking: 'Fala',
  reading: 'Leitura',
  writing: 'Escrita',
  pronunciation: 'Pronúncia',
  grammar: 'Gramática',
  vocabulary: 'Vocabulário',
  communication: 'Comunicação',
};

const SKILL_SHOW: SkillId[] = ['listening', 'speaking', 'vocabulary', 'grammar'];

export function CoursePage() {
  const { profile, loading } = useProfile();
  const navigate = useNavigate();
  const [cp, setCp] = useState<CourseProgress | null>(null);
  const [expanded, setExpanded] = useState<CourseLevelId | null>(null);

  useEffect(() => {
    if (!profile) return;
    let active = true;
    loadCourseProgress(profile.level)
      .then((p) => {
        if (active) {
          setCp(p);
          setExpanded(getCurrentLevel(profile, p));
        }
      })
      .catch(() => {});
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

  if (loading || !profile || !cp || !rec) return <LoadingScreen />;

  const openCompetency = (canOpen: boolean, lockedByLevel: boolean) => {
    if (lockedByLevel || !canOpen) return;
    void navigate('/sessao?type=lesson');
  };

  return (
    <div className="flex flex-col h-full max-w-md mx-auto dt-page">
      <DtPageHeader title="JORNADA" subtitle="Sua jornada de domínio" onBack={() => navigate('/')} />

      <main className="flex-1 overflow-y-auto scrollbar-hide px-5 pt-4 pb-28">
        <p className="dt-label">Sua jornada</p>
        <h1 className="mt-1.5 text-[24px] font-bold text-white font-[family-name:var(--font-display)]">
          {rec.levelEmoji} Nível {rec.levelLabel}
        </h1>
        <p className="dt-body mt-2">
          {rec.readyForAssessment
            ? 'Você está pronto para o próximo exame.'
            : `Próximo objetivo: ${rec.nextObjective}.`}
        </p>

        {recovering && cp.recovery && (
          <GlassCard
            className="mt-5 p-4"
            style={{
              border: '1px solid rgba(249,115,22,0.35)',
              background: 'rgba(249,115,22,0.1)',
            }}
          >
            <p className="dt-label !text-[#F97316]">Mudança de estratégia</p>
            <p className="text-[14px] font-semibold text-white mt-1.5">{cp.recovery.strategy}</p>
            <p className="dt-muted mt-1 leading-relaxed">{cp.recovery.reason}</p>
          </GlassCard>
        )}

        {rec.focusSkill && (
          <p className="mt-4 dt-body">
            Seu foco agora:{' '}
            <span className="font-semibold text-white">{SKILL_LABEL[rec.focusSkill]}</span>
          </p>
        )}

        <div className="mt-4 grid grid-cols-4 gap-2">
          {SKILL_SHOW.map((id) => (
            <GlassCard key={id} className="p-2.5 text-center" radius={16}>
              <p className="text-[10px] text-[#64748B] leading-tight">{SKILL_LABEL[id]}</p>
              <p className="text-[13px] font-bold text-white mt-1">{cp.skillLevels[id]}</p>
            </GlassCard>
          ))}
        </div>

        {rec.readyForAssessment && (
          <div className="mt-5">
            <PrimaryButton full size="lg" onClick={() => navigate('/sessao?type=assessment')}>
              Fazer exame do próximo nível
            </PrimaryButton>
          </div>
        )}

        <div className="mt-6 space-y-3">
          {LEVEL_ORDER.map((id) => {
            const level = LEVEL_BY_ID[id];
            const status = rec.journey.find((j) => j.level === id)?.status ?? 'locked';
            const isExpanded = expanded === id;
            const isCurrent = id === userLevel;
            const comps = isExpanded ? competencyStatusForLevel(cp, id, userLevel) : [];

            return (
              <GlassCard
                key={id}
                className="overflow-hidden transition-all duration-200"
                variant={isCurrent ? 'cyan' : 'default'}
              >
                <button
                  type="button"
                  onClick={() => setExpanded(isExpanded ? null : id)}
                  className="w-full flex items-center gap-3 p-4 text-left min-h-11"
                  aria-expanded={isExpanded}
                >
                  <span
                    className="w-11 h-11 rounded-2xl flex items-center justify-center text-xl shrink-0"
                    style={
                      status === 'done'
                        ? { background: 'rgba(34,197,94,0.15)' }
                        : status === 'current'
                          ? {
                              background: 'linear-gradient(145deg, #00F2FE, #8B5CF6)',
                              color: '#050816',
                            }
                          : { background: 'rgba(255,255,255,0.06)', color: '#64748B' }
                    }
                  >
                    {status === 'locked' ? '🔒' : level.emoji}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-[14px] font-bold text-white leading-tight">
                        Nível {level.label}
                      </p>
                      {level.cefr && level.id !== 'L0' && (
                        <span className="text-[10px] text-[#64748B] px-1.5 py-0.5 rounded bg-white/5">
                          {level.cefr}
                        </span>
                      )}
                    </div>
                    <p className="text-[12px] text-[#CBD5E1] leading-tight mt-0.5 line-clamp-1">
                      {status === 'locked'
                        ? `Desbloqueie ao chegar ao ${level.label}.`
                        : level.objective}
                    </p>
                  </div>
                  <span
                    className="text-[10px] font-semibold px-2 py-1 rounded-full shrink-0"
                    style={
                      status === 'done'
                        ? { background: 'rgba(34,197,94,0.15)', color: '#22C55E' }
                        : status === 'current'
                          ? { background: 'rgba(0,242,254,0.14)', color: '#00F2FE' }
                          : { background: 'rgba(255,255,255,0.06)', color: '#64748B' }
                    }
                  >
                    {LEVEL_STATUS_LABEL[status]}
                  </span>
                </button>

                {isExpanded && (
                  <div className="px-4 pb-4 pt-1 border-t border-white/10 animate-fade-in">
                    {status === 'locked' && (
                      <p className="dt-body mt-3 leading-relaxed">
                        Bloqueado. Desbloqueie ao chegar ao {level.label}.
                      </p>
                    )}
                    {status !== 'locked' && (
                      <>
                        <p className="dt-label mt-3 mb-1">Objetivo</p>
                        <p className="dt-body leading-relaxed text-white/90">{level.objective}</p>

                        <p className="dt-label mt-3 mb-1">Situação real</p>
                        <p className="dt-body leading-relaxed text-white/90">
                          {level.realWorldScenario}
                        </p>

                        {level.modules.length > 0 && (
                          <>
                            <p className="dt-label mt-3 mb-2">Módulos</p>
                            <div className="flex flex-wrap gap-1.5">
                              {level.modules.map((m) => (
                                <span
                                  key={m.id}
                                  className="text-[11px] px-2.5 py-1 rounded-full text-white"
                                  style={{ background: 'rgba(255,255,255,0.06)' }}
                                >
                                  {m.title}
                                </span>
                              ))}
                            </div>
                          </>
                        )}

                        {level.grammar.length > 0 && (
                          <>
                            <p className="dt-label mt-3 mb-2">Gramática</p>
                            <div className="flex flex-wrap gap-1.5">
                              {level.grammar.map((gid) => (
                                <span
                                  key={gid}
                                  className="text-[11px] px-2.5 py-1 rounded-full text-[#00F2FE]"
                                  style={{ background: 'rgba(0,242,254,0.12)' }}
                                >
                                  {GRAMMAR_BY_ID[gid]?.title ?? gid}
                                </span>
                              ))}
                            </div>
                          </>
                        )}

                        <p className="dt-label mt-3 mb-2">
                          Competências ({comps.length})
                        </p>
                        <div className="space-y-2">
                          {comps.map((c) => {
                            const a = AVAIL_META[c.availability.state];
                            const lockedByLevel = c.availability.state === 'LOCKED_BY_LEVEL';
                            return (
                              <button
                                key={c.id}
                                type="button"
                                onClick={() => openCompetency(c.availability.canOpen, lockedByLevel)}
                                disabled={lockedByLevel}
                                className="w-full flex items-start gap-2.5 text-left min-h-11 disabled:opacity-60"
                              >
                                <span
                                  className="mt-0.5 w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0"
                                  style={{ background: a.bg, color: a.color }}
                                >
                                  {c.availability.state === 'MASTERED'
                                    ? '✓'
                                    : c.availability.state === 'LOCKED_BY_LEVEL'
                                      ? '🔒'
                                      : c.availability.state === 'LOCKED_BY_PREREQUISITE'
                                        ? '🔗'
                                        : c.availability.state === 'NEEDS_REVIEW'
                                          ? '!'
                                          : Math.round(c.mastery) || '→'}
                                </span>
                                <div className="min-w-0 flex-1">
                                  <p className="text-[13px] font-medium text-white leading-tight">
                                    {c.title}
                                  </p>
                                  <p className="dt-muted leading-tight mt-0.5">
                                    {c.description}
                                  </p>
                                  {c.availability.state === 'LOCKED_BY_PREREQUISITE' &&
                                    c.availability.unmetPrerequisiteTitle && (
                                      <p className="dt-muted mt-1">
                                        Complete primeiro: {c.availability.unmetPrerequisiteTitle}
                                      </p>
                                    )}
                                  {c.core.length > 0 && c.availability.unlocked && (
                                    <p className="dt-muted mt-1 italic text-[#CBD5E1]">
                                      {c.core[0].german}
                                    </p>
                                  )}
                                  <div
                                    className="mt-1.5 h-1.5 rounded-full overflow-hidden"
                                    style={{ background: 'rgba(255,255,255,0.08)' }}
                                  >
                                    <div
                                      className="h-full rounded-full transition-all duration-300"
                                      style={{
                                        width: `${Math.min(100, c.mastery)}%`,
                                        background:
                                          c.availability.state === 'MASTERED'
                                            ? '#22C55E'
                                            : c.availability.state === 'NEEDS_REVIEW'
                                              ? '#F59E0B'
                                              : c.availability.state === 'IN_PROGRESS' ||
                                                  c.availability.state === 'AVAILABLE'
                                                ? '#00F2FE'
                                                : '#64748B',
                                      }}
                                    />
                                  </div>
                                </div>
                                <span
                                  className="text-[10px] font-semibold shrink-0"
                                  style={{ color: a.color }}
                                >
                                  {a.label}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </GlassCard>
            );
          })}
        </div>
      </main>
      <BottomNav />
    </div>
  );
}
