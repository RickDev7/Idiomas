/**
 * Conquistas — camada visual sobre ACHIEVEMENTS_DATA + evidências reais.
 * Não cria engine de gamificação.
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BottomNav } from '@/components/layout/BottomNav';
import { GlassCard, glassStyle } from '@/components/ui/GlassCard';
import { IconBack } from '@/components/ui/Icons';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { useProfile, useProgress } from '@/hooks/useProfile';
import { useUserMetrics } from '@/hooks/useUserMetrics';
import { StorageService } from '@/services/storage/StorageService';
import { ACHIEVEMENTS_DATA } from '@/data/content';
import type { Achievement } from '@/types';

type BadgeState = 'UNLOCKED' | 'LOCKED' | 'IN_PROGRESS';

type BadgeView = {
  id: string;
  title: string;
  description: string;
  icon: string;
  state: BadgeState;
  progressPct: number | null;
  detail: string | null;
};

type Evidence = {
  streak: number;
  currentDay: number;
  learnedChunks: number;
  conversations: number;
  missions: number;
  phrasesLearned: number;
  firstLesson: boolean;
  unlockedIds: Set<string>;
};

function evaluate(def: (typeof ACHIEVEMENTS_DATA)[number], ev: Evidence): BadgeView {
  if (ev.unlockedIds.has(def.id)) {
    return {
      id: def.id,
      title: def.title,
      description: def.description,
      icon: def.icon,
      state: 'UNLOCKED',
      progressPct: 100,
      detail: 'Freigeschaltet',
    };
  }

  let current = 0;
  let target = 1;
  let canTrack = false;

  switch (def.id) {
    case 'first-word':
    case 'first-phrase':
      canTrack = true;
      current = ev.phrasesLearned > 0 || ev.learnedChunks > 0 ? 1 : 0;
      target = 1;
      break;
    case 'streak-3':
      canTrack = true;
      current = ev.streak;
      target = 3;
      break;
    case 'streak-7':
      canTrack = true;
      current = ev.streak;
      target = 7;
      break;
    case 'first-conversation':
      canTrack = true;
      current = ev.conversations;
      target = 1;
      break;
    case 'mission-complete':
      canTrack = true;
      current = ev.missions;
      target = 1;
      break;
    case 'day-7':
      canTrack = true;
      current = ev.currentDay;
      target = 7;
      break;
    case 'day-30':
      canTrack = true;
      current = ev.currentDay;
      target = 30;
      break;
    default:
      canTrack = false;
  }

  if (!canTrack) {
    return {
      id: def.id,
      title: def.title,
      description: def.description,
      icon: def.icon,
      state: 'LOCKED',
      progressPct: null,
      detail: null,
    };
  }

  if (current >= target) {
    return {
      id: def.id,
      title: def.title,
      description: def.description,
      icon: def.icon,
      state: 'UNLOCKED',
      progressPct: 100,
      detail: `${current}/${target}`,
    };
  }

  if (current > 0) {
    return {
      id: def.id,
      title: def.title,
      description: def.description,
      icon: def.icon,
      state: 'IN_PROGRESS',
      progressPct: Math.round((current / target) * 100),
      detail: `${current}/${target}`,
    };
  }

  return {
    id: def.id,
    title: def.title,
    description: def.description,
    icon: def.icon,
    state: 'LOCKED',
    progressPct: 0,
    detail: `0/${target}`,
  };
}

export function AchievementsPage() {
  const navigate = useNavigate();
  const { profile, loading } = useProfile();
  const { progress } = useProgress();
  const metrics = useUserMetrics();
  const [stored, setStored] = useState<Achievement[]>([]);

  useEffect(() => {
    void StorageService.getAchievements().then(setStored).catch(() => setStored([]));
  }, []);

  const badges = useMemo(() => {
    if (!profile) return [];
    const unlockedIds = new Set(
      stored.filter((a) => !!a.unlockedAt).map((a) => a.id),
    );
    const ev: Evidence = {
      streak: profile.streak || 0,
      currentDay: profile.currentDay || 1,
      learnedChunks: metrics.learnedChunksCount || 0,
      conversations: progress?.conversationsCompleted ?? 0,
      missions: progress?.missionsCompleted ?? 0,
      phrasesLearned: progress?.phrasesLearned ?? 0,
      firstLesson: !!profile.firstLessonComplete,
      unlockedIds,
    };
    return ACHIEVEMENTS_DATA.map((d) => evaluate(d, ev));
  }, [profile, progress, metrics.learnedChunksCount, stored]);

  if (loading || !profile) return <LoadingScreen />;

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
            DEINE ERFOLGE
          </h1>
          <p className="text-[12px] text-[#CBD5E1]">Was du bereits erreicht hast.</p>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto scrollbar-hide px-5 pt-4 pb-28">
        <div className="grid grid-cols-2 gap-2.5">
          {badges.map((b) => {
            const unlocked = b.state === 'UNLOCKED';
            const progress = b.state === 'IN_PROGRESS';
            const opacity = unlocked || progress ? 1 : 0.45;
            const glow = unlocked
              ? '0 0 22px rgba(0,242,254,0.45)'
              : progress
                ? '0 0 14px rgba(139,92,246,0.3)'
                : undefined;
            return (
              <GlassCard
                key={b.id}
                className="p-4 transition-all duration-300"
                style={{
                  opacity,
                  boxShadow: glow,
                  border: unlocked
                    ? '1px solid rgba(0,242,254,0.4)'
                    : progress
                      ? '1px solid rgba(139,92,246,0.4)'
                      : undefined,
                }}
              >
                <span className="text-[28px] leading-none" aria-hidden>
                  {b.icon}
                </span>
                <p className="mt-2 text-[13px] font-bold text-white leading-snug">{b.title}</p>
                <p className="mt-1 text-[11px] text-[#64748B] leading-snug">{b.description}</p>
                <p
                  className="mt-2 text-[10px] font-bold uppercase tracking-wide"
                  style={{
                    color: unlocked ? '#00F2FE' : progress ? '#A855F7' : '#64748B',
                  }}
                >
                  {b.state === 'UNLOCKED'
                    ? 'Freigeschaltet'
                    : b.state === 'IN_PROGRESS'
                      ? 'In Arbeit'
                      : 'Gesperrt'}
                  {b.detail ? ` · ${b.detail}` : ''}
                </p>
                {b.progressPct != null && b.state !== 'LOCKED' && (
                  <div
                    className="mt-2 h-[4px] rounded-full overflow-hidden"
                    style={{ background: 'rgba(255,255,255,0.08)' }}
                  >
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{
                        width: `${Math.min(100, Math.max(4, b.progressPct))}%`,
                        background: unlocked
                          ? 'linear-gradient(90deg, #00F2FE, #22C55E)'
                          : 'linear-gradient(90deg, #8B5CF6, #EC4899)',
                      }}
                    />
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
