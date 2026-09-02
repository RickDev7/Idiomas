/**
 * Perfil — Fase 4.
 * Dados reais de profile / RealProgress / UserMetrics.
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BottomNav } from '@/components/layout/BottomNav';
import { GlassCard, glassStyle } from '@/components/ui/GlassCard';
import { ProgressRing } from '@/components/ui/ProgressRing';
import { IconBack } from '@/components/ui/Icons';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { useProfile, useProgress } from '@/hooks/useProfile';
import { useUserMetrics } from '@/hooks/useUserMetrics';
import { MemoryService } from '@/services/learning/MemoryService';
import {
  getCurrentLevel,
  getLevelPresentation,
  getStoredCourseProgress,
} from '@/services/course';
import { getRealProgress, type RealProgress } from '@/services/learning/RealProgress';
import { DeutschTurboMascot } from '@/components/ui/Mascot';

export function ProfilePage() {
  const navigate = useNavigate();
  const { profile, loading } = useProfile();
  const { progress } = useProgress();
  const metrics = useUserMetrics();
  const [real, setReal] = useState<RealProgress | null>(null);

  const course = getStoredCourseProgress();
  const level = profile ? getCurrentLevel(profile, course) : 'L0';
  const levelView = getLevelPresentation(level);

  useEffect(() => {
    if (!profile) return;
    void MemoryService.loadProfile(profile)
      .then((lp) => getRealProgress(lp, level))
      .then(setReal)
      .catch(() => setReal(null));
  }, [profile, level]);

  if (loading || !profile) return <LoadingScreen />;

  const name = profile.name?.trim() || 'Learner';
  const mastery = real?.masteryPercent ?? null;
  const strengths = real?.recentAdvances?.slice(0, 4) ?? [];

  const shortcuts = [
    { label: 'Mein Lernweg', to: '/lernweg' },
    { label: 'Meine Chunks', to: '/chunks' },
    { label: 'Meine Erfolge', to: '/conquistas' },
    { label: 'Einstellungen', to: '/configuracoes' },
  ];

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
          <h1 className="text-[18px] font-bold text-white font-[family-name:var(--font-display)] tracking-wide">
            PERFIL
          </h1>
          <p className="text-[12px] text-[#CBD5E1]">Dein Lernkonto</p>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto scrollbar-hide px-5 pt-4 pb-28 space-y-5">
        <GlassCard className="p-5 flex items-center gap-4">
          <DeutschTurboMascot size="medium" state="idle" ringColor="#8B5CF6" alt="" />
          <div className="min-w-0">
            <p className="text-[22px] font-bold text-white truncate font-[family-name:var(--font-display)]">
              {name}
            </p>
            <p className="text-[13px] text-[#CBD5E1] mt-0.5">
              {level} · {levelView.label}
            </p>
          </div>
        </GlassCard>

        <section>
          <p className="dt-label mb-2">Deine Daten</p>
          <div className="grid grid-cols-2 gap-2.5">
            <Stat label="Lernzeit" value={real ? `${real.studyMinutesTotal} min` : '—'} />
            <Stat
              label="Sätze gesprochen"
              value={
                progress?.phrasesLearned != null
                  ? String(progress.phrasesLearned)
                  : '—'
              }
            />
            <Stat
              label="Chunks"
              value={
                metrics.learnedChunksCount != null
                  ? String(metrics.learnedChunksCount)
                  : '—'
              }
            />
            <Stat
              label="Streak"
              value={profile.streak != null ? String(profile.streak) : '—'}
            />
          </div>
        </section>

        <GlassCard variant="violet" className="p-5 flex flex-col items-center relative overflow-hidden">
          <span
            className="absolute -top-16 w-48 h-48 rounded-full pointer-events-none"
            style={{ background: 'radial-gradient(circle, rgba(139,92,246,0.35), transparent 70%)' }}
          />
          <p className="dt-label relative mb-2">Dein Niveau</p>
          <ProgressRing
            value={mastery ?? 0}
            size={110}
            stroke={9}
            color="#8B5CF6"
            label={mastery != null ? `${mastery}%` : '—'}
          />
          <p className="relative mt-2 text-[16px] font-bold text-white">
            {level} · {levelView.label}
          </p>
        </GlassCard>

        <section>
          <p className="dt-label mb-2">Deine Stärken</p>
          {strengths.length === 0 ? (
            <GlassCard className="p-4">
              <p className="text-[13px] text-[#64748B]">Noch nicht genug Daten.</p>
            </GlassCard>
          ) : (
            <GlassCard className="p-4 space-y-2">
              {strengths.map((s) => (
                <p key={s.phraseId} className="text-[14px] text-white flex gap-2">
                  <span className="text-[#22C55E]">✓</span>
                  <span className="truncate">{s.german}</span>
                </p>
              ))}
            </GlassCard>
          )}
        </section>

        <section>
          <p className="dt-label mb-2">Shortcuts</p>
          <div className="space-y-2">
            {shortcuts.map((s) => (
              <button
                key={s.to}
                type="button"
                onClick={() => navigate(s.to)}
                className="w-full rounded-[18px] px-4 py-3.5 text-left text-[14px] font-semibold text-white active:scale-[0.98] transition-transform duration-200"
                style={glassStyle}
              >
                {s.label}
              </button>
            ))}
          </div>
        </section>
      </main>
      <BottomNav />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <GlassCard className="p-4">
      <p className="text-[10px] uppercase tracking-wide text-[#64748B]">{label}</p>
      <p className="text-[18px] font-bold text-white mt-1 tabular-nums">{value}</p>
    </GlassCard>
  );
}
