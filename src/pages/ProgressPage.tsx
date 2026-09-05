/**
 * Progresso — leitura de evolução (não dashboard empresarial).
 * Dados reais: nível, curso, competências, estruturas, autonomia, revisão.
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BottomNav } from '@/components/layout/BottomNav';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { PrimaryButton } from '@/components/ui/Button';
import { GlassCard } from '@/components/ui/GlassCard';
import { DT_ASSETS } from '@/assets/deutsch-turbo';
import {
  DTPage,
  DTMain,
  DTTopBar,
} from '@/components/dt';
import { useProfile } from '@/hooks/useProfile';
import { MemoryService } from '@/services/learning/MemoryService';
import {
  getCurrentLevel,
  getLevelPresentation,
  getStoredCourseProgress,
  getCurrentModule,
  getNextModule,
  getLevelModulesProgressPercent,
} from '@/services/course';
import { getRealProgress, type RealProgress } from '@/services/learning/RealProgress';
import { L0_CHUNK_GRAPH } from '@/services/teacher/ZeroLanguageMode';
import { readAutomationScore } from '@/services/learning/AutomationScoreEngine';
import type { UserLearningProfile } from '@/services/learning/ConfidenceService';
import { APP_ROUTES } from '@/services/ui/AppRoutes';

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
  const reviewCount = progress?.reviewQueueCount ?? 0;
  const autonomy = progress?.autonomousSpeechPercent ?? null;

  const snap = learning
    ? getCurrentModule(learning, currentLevel, course, currentLevel)
    : null;
  const next = learning
    ? getNextModule(currentLevel, learning, currentLevel, course)
    : null;
  const levelPct = learning
    ? getLevelModulesProgressPercent(currentLevel, learning, currentLevel, course)
    : null;
  const mod = snap?.module ?? null;
  const competencyLine = mod?.competencyIds?.length
    ? mod.competencyIds.join(' · ')
    : null;

  return (
    <DTPage>
      <DTTopBar
        title="Progresso"
        subtitle="Sua evolução"
        onBack={() => navigate(APP_ROUTES.home)}
      />

      <DTMain withNav className="pt-2 space-y-4">
        {/* Hero de evolução */}
        <section
          className="rounded-[28px] p-5 relative overflow-hidden"
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <img
            src={DT_ASSETS.learningJourney}
            alt=""
            className="absolute right-[-8%] top-[-10%] w-[160px] h-[160px] object-contain opacity-40 pointer-events-none"
            draggable={false}
          />
          <p className="text-[10px] uppercase tracking-[0.16em] font-bold text-[var(--learning-violet)]">
            Nível atual
          </p>
          <p className="mt-1 text-[36px] font-extrabold text-[var(--text-primary)] font-[family-name:var(--font-display)] leading-none">
            {currentLevel}
          </p>
          <p className="mt-2 text-[14px] text-[var(--text-secondary)]">{levelView.label}</p>
          {mastery != null ? (
            <p className="mt-3 text-[13px] font-semibold text-[var(--text-primary)] tabular-nums">
              Domínio do nível · {mastery}%
            </p>
          ) : null}
          {contentsDone != null && contentsTotal != null ? (
            <p className="mt-1 text-[12px] text-[var(--text-faint)] tabular-nums">
              {contentsDone} de {contentsTotal} itens estudados
            </p>
          ) : null}
        </section>

        {/* Curso / módulo */}
        <section>
          <p className="text-[10px] uppercase tracking-[0.14em] font-bold text-[var(--text-faint)] mb-2 px-1">
            Curso
          </p>
          <GlassCard className="p-4 space-y-2">
            {mod ? (
              <>
                <p className="text-[16px] font-bold text-[var(--text-primary)]">
                  Módulo {mod.order} — {mod.title}
                </p>
                {competencyLine ? (
                  <p className="text-[12px] text-[var(--text-secondary)]">
                    Competências: {competencyLine}
                  </p>
                ) : null}
                <p className="text-[13px] text-[var(--text-secondary)]">
                  Progresso do módulo: {mod.progress}% · Domínio: {mod.masteryLabel}
                </p>
                {levelPct != null ? (
                  <div className="pt-1">
                    <div className="flex justify-between text-[11px] text-[var(--text-faint)] mb-1">
                      <span>Nível {currentLevel}</span>
                      <span className="tabular-nums">{levelPct}%</span>
                    </div>
                    <div
                      className="h-2 rounded-full overflow-hidden"
                      style={{ background: 'color-mix(in srgb, var(--text-primary) 8%, transparent)' }}
                    >
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.min(100, levelPct)}%`,
                          background: 'linear-gradient(90deg, var(--voice-cyan), var(--learning-violet))',
                        }}
                      />
                    </div>
                  </div>
                ) : null}
                {next && !next.locked ? (
                  <p className="text-[12px] text-[var(--voice-cyan)]">
                    Próximo: Módulo {next.order} — {next.title}
                  </p>
                ) : snap?.journeyComplete ? (
                  <p className="text-[12px] text-[var(--success)]">
                    Jornada curricular disponível concluída.
                  </p>
                ) : null}
              </>
            ) : (
              <p className="text-[13px] text-[var(--text-faint)]">Sem módulo ativo neste nível.</p>
            )}
            <PrimaryButton
              full
              variant="accent"
              className="mt-2"
              onClick={() => navigate(APP_ROUTES.jornada)}
            >
              Abrir Meu Curso
            </PrimaryButton>
          </GlassCard>
        </section>

        {/* Cards de leitura — empilhados, não métricas de dashboard */}
        <section className="space-y-2">
          <p className="text-[10px] uppercase tracking-[0.14em] font-bold text-[var(--text-faint)] mb-2 px-1">
            O que você já domina
          </p>
          <GlassCard className="p-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-[13px] font-semibold text-[var(--text-primary)]">
                Targets / estruturas
              </p>
              <p className="text-[12px] text-[var(--text-secondary)] mt-0.5">
                Frases e chunks com evidência de uso
              </p>
            </div>
            <p className="text-[28px] font-extrabold text-[var(--voice-cyan)] tabular-nums">
              {structureCount != null ? structureCount : '—'}
            </p>
          </GlassCard>

          <GlassCard className="p-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-[13px] font-semibold text-[var(--text-primary)]">Autonomia</p>
              <p className="text-[12px] text-[var(--text-secondary)] mt-0.5">
                Fala espontânea nas sessões
              </p>
            </div>
            <p className="text-[28px] font-extrabold text-[var(--learning-violet)] tabular-nums">
              {autonomy != null ? `${autonomy}%` : '—'}
            </p>
          </GlassCard>

          <GlassCard className="p-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-[13px] font-semibold text-[var(--text-primary)]">Revisão pendente</p>
              <p className="text-[12px] text-[var(--text-secondary)] mt-0.5">
                Itens prontos para reforço
              </p>
            </div>
            <p className="text-[28px] font-extrabold text-[var(--active-coral,#FF5E62)] tabular-nums">
              {reviewCount}
            </p>
          </GlassCard>
        </section>

        {reviewCount > 0 ? (
          <PrimaryButton full onClick={() => navigate(APP_ROUTES.revisar)}>
            Revisar {reviewCount} {reviewCount === 1 ? 'item' : 'itens'}
          </PrimaryButton>
        ) : null}
      </DTMain>

      <BottomNav />
    </DTPage>
  );
}
