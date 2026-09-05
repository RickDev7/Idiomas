/**
 * Perfil — layout premium compacto.
 * Dados reais: profile / RealProgress / UserMetrics.
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BottomNav } from '@/components/layout/BottomNav';
import {
  DTPage,
  DTMain,
  DTTopBar,
  DTSectionLabel,
  DTGlassCard,
  DTProgressRing,
  DTMetricCard,
  DTBadge,
} from '@/components/dt';
import {
  IconClock,
  IconChat,
  IconCube,
  IconFlame,
  IconTrophy,
  IconGear,
  IconPuzzle,
  IconChart,
} from '@/components/ui/Icons';
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

  const name = profile.name?.trim() || 'Aluno';
  const mastery = real?.masteryPercent ?? null;
  const strengths = real?.recentAdvances?.slice(0, 4) ?? [];

  const shortcuts = [
    { label: 'Meu Curso', to: '/jornada', icon: <IconChart size={16} />, tint: '#8B5CF6' },
    { label: 'Meus chunks', to: '/chunks', icon: <IconPuzzle size={16} />, tint: '#00F2FE' },
    { label: 'Conquistas', to: '/conquistas', icon: <IconTrophy size={16} />, tint: '#F97316' },
    { label: 'Configurações', to: '/configuracoes', icon: <IconGear size={16} />, tint: '#EC4899' },
  ];

  return (
    <DTPage>
      <DTTopBar
        title="PERFIL"
        subtitle="Sua conta de aprendizado"
        onBack={() => navigate(-1)}
      />

      <DTMain>
        <div className="pt-3 space-y-4">
          <DTGlassCard variant="violet" className="p-4 flex items-center gap-3.5 relative overflow-hidden">
            <span
              className="absolute -top-14 -right-10 w-40 h-40 rounded-full pointer-events-none"
              style={{ background: 'radial-gradient(circle, rgba(139,92,246,0.4), transparent 70%)' }}
            />
            <DeutschTurboMascot size="medium" state="idle" ringColor="#8B5CF6" alt="" />
            <div className="min-w-0 relative flex-1">
              <p className="text-[20px] font-bold text-white truncate font-[family-name:var(--font-display)]">
                {name}
              </p>
              <p className="text-[12px] text-[#CBD5E1] mt-0.5">
                {level} · {levelView.label}
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <DTBadge color="#A855F7">{level}</DTBadge>
                {profile.streak != null && profile.streak > 0 ? (
                  <DTBadge color="#F97316">{profile.streak} dias</DTBadge>
                ) : null}
              </div>
            </div>
            <DTProgressRing
              value={mastery ?? 0}
              size={72}
              stroke={7}
              color="#8B5CF6"
              label={mastery != null ? `${mastery}%` : '—'}
            />
          </DTGlassCard>

          <section>
            <DTSectionLabel className="mb-2">Estatísticas</DTSectionLabel>
            <div className="grid grid-cols-2 gap-2">
              <DTMetricCard
                value={real ? `${real.studyMinutesTotal}` : '—'}
                label="Minutos de estudo"
                color="#8B5CF6"
                icon={<IconClock size={14} />}
              />
              <DTMetricCard
                value={progress?.phrasesLearned != null ? String(progress.phrasesLearned) : '—'}
                label="Frases faladas"
                color="#00F2FE"
                icon={<IconChat size={14} />}
              />
              <DTMetricCard
                value={
                  metrics.learnedChunksCount != null ? String(metrics.learnedChunksCount) : '—'
                }
                label="Chunks"
                color="#EC4899"
                icon={<IconCube size={14} />}
              />
              <DTMetricCard
                value={profile.streak != null ? String(profile.streak) : '—'}
                label="Sequência"
                color="#F97316"
                icon={<IconFlame size={14} />}
              />
            </div>
          </section>

          <section>
            <DTSectionLabel className="mb-2">Pontos fortes</DTSectionLabel>
            {strengths.length === 0 ? (
              <DTGlassCard className="p-4">
                <p className="text-[13px] text-[#64748B]">Ainda sem dados suficientes.</p>
              </DTGlassCard>
            ) : (
              <DTGlassCard className="p-3.5 space-y-2">
                {strengths.map((s) => (
                  <div key={s.phraseId} className="flex items-center gap-2.5">
                    <span
                      className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0 text-[#22C55E]"
                      style={{ background: 'rgba(34,197,94,0.15)' }}
                    >
                      ✓
                    </span>
                    <p className="text-[14px] text-white truncate font-medium">{s.german}</p>
                  </div>
                ))}
              </DTGlassCard>
            )}
          </section>

          <section>
            <DTSectionLabel className="mb-2">Atalhos</DTSectionLabel>
            <div className="grid grid-cols-2 gap-2">
              {shortcuts.map((s) => (
                <DTGlassCard
                  key={s.to}
                  className="p-3.5 flex items-center gap-2.5"
                  onClick={() => navigate(s.to)}
                >
                  <span
                    className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: `${s.tint}22`, color: s.tint }}
                  >
                    {s.icon}
                  </span>
                  <span className="text-[13px] font-semibold text-white">{s.label}</span>
                </DTGlassCard>
              ))}
            </div>
          </section>
        </div>
      </DTMain>
      <BottomNav />
    </DTPage>
  );
}
