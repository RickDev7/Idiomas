/* CoursePage — "Sua jornada" detalhada: níveis 0→C2, competências, gates,
   habilidades, módulos e recovery quando há platô. */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BottomNav } from '@/components/layout/BottomNav';
import { SectionLabel, PageTitle, PageSubtitle } from '@/components/ui/PageHeader';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { PrimaryButton } from '@/components/ui/Button';
import { IconBack } from '@/components/ui/Icons';
import { useProfile } from '@/hooks/useProfile';
import {
  loadCourseProgress, buildRecommendation, competencyStatusForLevel,
  LEVEL_BY_ID, LEVEL_ORDER, GRAMMAR_BY_ID, isRecoveryActive,
  getCurrentLevel,
  type CourseProgress, type CourseLevelId, type SkillId,
  type AvailabilityState,
} from '@/services/course';

const AVAIL_META: Record<AvailabilityState, { label: string; color: string; bg: string }> = {
  LOCKED_BY_LEVEL: { label: 'Bloqueado', color: 'text-text-faint', bg: 'bg-surface-light' },
  LOCKED_BY_PREREQUISITE: { label: 'Complete primeiro', color: 'text-text-muted', bg: 'bg-surface-light' },
  AVAILABLE: { label: 'Disponível', color: 'text-primary', bg: 'bg-primary/15' },
  IN_PROGRESS: { label: 'Em progresso', color: 'text-accent', bg: 'bg-accent/15' },
  MASTERED: { label: 'Dominado', color: 'text-success', bg: 'bg-success/15' },
  NEEDS_REVIEW: { label: 'Reforçar', color: 'text-accent', bg: 'bg-accent/15' },
};

const LEVEL_STATUS_LABEL = {
  done: '✓ Concluído',
  current: 'ATUAL',
  locked: '🔒 Bloqueado',
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
    <div className="flex flex-col h-full bg-background max-w-md mx-auto">
      <header className="flex items-center justify-between px-5 pt-3 pb-1 safe-top shrink-0">
        <button onClick={() => navigate('/')} aria-label="Voltar" className="min-h-11 px-1">
          <IconBack size={20} />
        </button>
        <span className="text-eyebrow text-text-faint tracking-[0.18em] font-semibold">JORNADA</span>
        <span className="min-w-11" />
      </header>

      <main className="flex-1 overflow-y-auto scrollbar-hide px-5 pt-3 pb-28">
        <SectionLabel>Sua jornada</SectionLabel>
        <PageTitle className="mt-1.5">
          {rec.levelEmoji} Nível {rec.levelLabel}
        </PageTitle>
        <PageSubtitle>
          {rec.readyForAssessment
            ? 'Você está pronto para o próximo exame.'
            : `Próximo objetivo: ${rec.nextObjective}.`}
        </PageSubtitle>

        {recovering && cp.recovery && (
          <div className="mt-5 rounded-[var(--radius-xl)] border border-accent/30 bg-accent/10 p-4">
            <p className="text-eyebrow text-accent tracking-[0.14em] font-semibold uppercase">Mudança de estratégia</p>
            <p className="text-body font-semibold text-text mt-1.5">{cp.recovery.strategy}</p>
            <p className="text-caption text-text-muted mt-1 leading-relaxed">{cp.recovery.reason}</p>
          </div>
        )}

        {rec.focusSkill && (
          <p className="mt-4 text-secondary text-text-muted">
            Seu foco agora: <span className="font-semibold text-text">{SKILL_LABEL[rec.focusSkill]}</span>
          </p>
        )}

        <div className="mt-4 grid grid-cols-4 gap-2">
          {SKILL_SHOW.map((id) => (
            <div key={id} className="rounded-2xl bg-surface border border-border/40 p-2.5 text-center shadow-sm">
              <p className="text-[11px] text-text-faint leading-tight">{SKILL_LABEL[id]}</p>
              <p className="text-secondary font-bold text-text mt-1">{cp.skillLevels[id]}</p>
            </div>
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
              <div
                key={id}
                className={[
                  'rounded-[var(--radius-xl)] border shadow-sm overflow-hidden transition-all',
                  isCurrent ? 'border-primary/40 bg-surface' : 'border-border/40 bg-surface',
                ].join(' ')}
              >
                <button
                  onClick={() => setExpanded(isExpanded ? null : id)}
                  className="w-full flex items-center gap-3 p-4 text-left min-h-11"
                  aria-expanded={isExpanded}
                >
                  <span
                    className={[
                      'w-11 h-11 rounded-2xl flex items-center justify-center text-xl shrink-0',
                      status === 'done'
                        ? 'bg-success/15'
                        : status === 'current'
                          ? 'bg-primary text-white'
                          : 'bg-surface-light text-text-faint',
                    ].join(' ')}
                  >
                    {status === 'locked' ? '🔒' : level.emoji}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-body font-bold text-text leading-tight">
                        Nível {level.label}
                      </p>
                      {level.cefr && level.id !== 'L0' && (
                        <span className="text-caption text-text-faint px-1.5 py-0.5 rounded bg-surface-light">
                          {level.cefr}
                        </span>
                      )}
                    </div>
                    <p className="text-caption text-text-muted leading-tight mt-0.5 line-clamp-1">
                      {status === 'locked'
                        ? `Desbloqueie ao chegar ao ${level.label}.`
                        : level.objective}
                    </p>
                  </div>
                  <span
                    className={[
                      'text-caption font-semibold px-2 py-1 rounded-full shrink-0',
                      status === 'done'
                        ? 'bg-success/15 text-success'
                        : status === 'current'
                          ? 'bg-primary/15 text-primary'
                          : 'bg-surface-light text-text-faint',
                    ].join(' ')}
                  >
                    {LEVEL_STATUS_LABEL[status]}
                  </span>
                </button>

                {isExpanded && (
                  <div className="px-4 pb-4 pt-1 border-t border-border/30 animate-fade-in">
                    {status === 'locked' && (
                      <p className="text-secondary text-text-muted mt-3 leading-relaxed">
                        🔒 Bloqueado. Desbloqueie ao chegar ao {level.label}.
                      </p>
                    )}
                    {status !== 'locked' && (
                      <>
                        <p className="text-caption text-text-faint mt-3 mb-1">Objetivo</p>
                        <p className="text-secondary text-text leading-relaxed">{level.objective}</p>

                        <p className="text-caption text-text-faint mt-3 mb-1">Situação real</p>
                        <p className="text-secondary text-text leading-relaxed">
                          {level.realWorldScenario}
                        </p>

                        {level.modules.length > 0 && (
                          <>
                            <p className="text-caption text-text-faint mt-3 mb-2">Módulos</p>
                            <div className="flex flex-wrap gap-1.5">
                              {level.modules.map((m) => (
                                <span key={m.id} className="text-caption px-2.5 py-1 rounded-full bg-surface-light text-text">
                                  {m.title}
                                </span>
                              ))}
                            </div>
                          </>
                        )}

                        {level.grammar.length > 0 && (
                          <>
                            <p className="text-caption text-text-faint mt-3 mb-2">Gramática</p>
                            <div className="flex flex-wrap gap-1.5">
                              {level.grammar.map((gid) => (
                                <span key={gid} className="text-caption px-2.5 py-1 rounded-full bg-primary/10 text-primary">
                                  {GRAMMAR_BY_ID[gid]?.title ?? gid}
                                </span>
                              ))}
                            </div>
                          </>
                        )}

                        <p className="text-caption text-text-faint mt-3 mb-2">
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
                                  className={`mt-0.5 w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 ${a.bg} ${a.color}`}
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
                                  <p className="text-secondary font-medium text-text leading-tight">
                                    {c.title}
                                  </p>
                                  <p className="text-caption text-text-faint leading-tight mt-0.5">
                                    {c.description}
                                  </p>
                                  {c.availability.state === 'LOCKED_BY_PREREQUISITE' &&
                                    c.availability.unmetPrerequisiteTitle && (
                                      <p className="text-caption text-text-muted mt-1">
                                        🔗 Complete primeiro: {c.availability.unmetPrerequisiteTitle}
                                      </p>
                                    )}
                                  {c.core.length > 0 && c.availability.unlocked && (
                                    <p className="text-caption text-text-muted mt-1 italic">
                                      {c.core[0].german}
                                    </p>
                                  )}
                                  <div className="mt-1.5 h-1.5 rounded-full bg-surface-light overflow-hidden">
                                    <div
                                      className={`h-full rounded-full ${
                                        c.availability.state === 'MASTERED'
                                          ? 'bg-success'
                                          : c.availability.state === 'NEEDS_REVIEW'
                                            ? 'bg-accent'
                                            : c.availability.state === 'IN_PROGRESS' ||
                                                c.availability.state === 'AVAILABLE'
                                              ? 'bg-primary'
                                              : 'bg-text-faint'
                                      }`}
                                      style={{ width: `${Math.min(100, c.mastery)}%` }}
                                    />
                                  </div>
                                </div>
                                <span className={`text-caption font-semibold shrink-0 ${a.color}`}>
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
              </div>
            );
          })}
        </div>
      </main>
      <BottomNav />
    </div>
  );
}
