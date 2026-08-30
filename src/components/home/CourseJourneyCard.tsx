/* CourseJourneyCard — "Sua jornada" na Home: nível atual + próximo objetivo
   + jornada visual 0→C2. Usa o CourseEngine. */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { UserProfile } from '@/types';
import {
  loadCourseProgress,
  buildRecommendation,
  readyForPlacementSkip,
  overallLevel,
  placeAtLevel,
  saveCourseProgress,
  isRecoveryActive,
  getCurrentLevel,
  type CourseRecommendation,
  type CourseRecovery,
} from '@/services/course';
import { haptic } from '@/services/ui/HapticService';

export function CourseJourneyCard({ profile }: { profile: UserProfile }) {
  const navigate = useNavigate();
  const [rec, setRec] = useState<CourseRecommendation | null>(null);
  const [canSkip, setCanSkip] = useState(false);
  const [recovery, setRecovery] = useState<CourseRecovery | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const p = await loadCourseProgress(profile.level);
      if (!active) return;
      const userLevel = getCurrentLevel(profile, p);
      setRec(buildRecommendation(p, userLevel));
      setCanSkip(readyForPlacementSkip(p));
      setRecovery(isRecoveryActive(p) ? p.recovery ?? null : null);
    })().catch(() => {});
    return () => {
      active = false;
    };
  }, [profile.level, profile.currentDay, profile.diagnosticLevel, profile.selfReportedLevel]);

  if (!rec) return null;

  const startAssessment = () => {
    haptic();
    navigate('/sessao?type=assessment');
  };

  const doPlacementSkip = async () => {
    haptic();
    const p = await loadCourseProgress(profile.level);
    const target = overallLevel(p);
    const placed = placeAtLevel(p, target);
    await saveCourseProgress(placed);
    setRec(buildRecommendation(placed, getCurrentLevel(profile, placed)));
    setCanSkip(false);
  };

  return (
    <section className="px-5 mt-5">
      <button
        onClick={() => navigate('/jornada')}
        className="w-full text-left rounded-[28px] text-white shadow-lg overflow-hidden active:scale-[0.99] transition-transform"
        style={{
          background: 'linear-gradient(135deg, #3b82f6 0%, #6366f1 40%, #7c3aed 100%)',
          boxShadow: 'var(--shadow-glow-purple)',
        }}
      >
        <div className="px-5 pt-5 pb-4">
          <p className="text-[11px] uppercase tracking-[0.18em] font-semibold text-white/70">Sua jornada</p>
          <div className="mt-2 flex items-center gap-2">
            <span className="text-2xl leading-none">{rec.levelEmoji}</span>
            <div className="min-w-0">
              <h2 className="text-lg font-bold leading-tight">{rec.levelLabel}</h2>
              <p className="text-[13px] text-white/85 leading-tight mt-0.5">
                {rec.readyForAssessment ? 'Pronto para o próximo exame 🎉' : `Próximo objetivo: ${rec.nextObjective}`}
              </p>
            </div>
          </div>
        </div>

        {/* Jornada 0 → C2 */}
        <div className="px-5 pb-4">
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide">
            {rec.journey.filter((j) => ['L0', 'A1', 'A2', 'B1', 'B2'].includes(j.level)).map((j, i, arr) => (
              <div key={j.level} className="flex items-center gap-1.5 shrink-0">
                <div
                  className={[
                    'flex flex-col items-center justify-center rounded-2xl px-3 py-2 min-w-[58px]',
                    j.status === 'done'
                      ? 'bg-white/25 text-white'
                      : j.status === 'current'
                        ? 'bg-white text-[#5b8cff] ring-2 ring-white'
                        : 'bg-white/10 text-white/55',
                  ].join(' ')}
                >
                  <span className="text-base leading-none">{j.status === 'locked' ? '🔒' : j.emoji}</span>
                  <span className="text-[11px] font-semibold mt-1">{j.label}</span>
                </div>
                {i < arr.length - 1 && (
                  <span className={['text-xs', j.status === 'done' ? 'text-white/70' : 'text-white/30'].join(' ')}>›</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </button>

      {/* Ações de progressão (fora do card navegável) */}
      {(rec.readyForAssessment || canSkip || recovery) && (
        <div className="mt-3 flex flex-col gap-2">
          {recovery && (
            <p className="text-caption text-accent px-1">
              Estratégia ajustada: {recovery.strategy}
            </p>
          )}
          {rec.readyForAssessment && (
            <button
              onClick={startAssessment}
              className="w-full py-3 rounded-2xl bg-primary text-white font-semibold text-sm active:scale-[0.98] transition-transform"
            >
              Fazer exame do próximo nível
            </button>
          )}
          {canSkip && (
            <button
              onClick={doPlacementSkip}
              className="w-full py-2.5 rounded-2xl bg-surface border border-border/40 text-text font-medium text-sm active:scale-[0.98] transition-transform"
            >
              Pular para o nível compatível com seu desempenho
            </button>
          )}
        </div>
      )}
    </section>
  );
}
