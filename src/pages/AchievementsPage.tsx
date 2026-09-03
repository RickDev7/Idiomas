/**
 * Conquistas — grade rica de badges (ACHIEVEMENTS_DATA + evidências reais).
 * Visual only — sem engine de gamificação.
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
  DTProgressBar,
  DTBadge,
  DTMetricCard,
} from '@/components/dt';
import { IconTrophy, IconFlame, IconLock, IconCheck } from '@/components/ui/Icons';
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
      detail: 'Desbloqueada',
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

const STATE_LABEL: Record<BadgeState, string> = {
  UNLOCKED: 'Desbloqueada',
  IN_PROGRESS: 'Em progresso',
  LOCKED: 'Bloqueada',
};

const STATE_COLOR: Record<BadgeState, string> = {
  UNLOCKED: '#00F2FE',
  IN_PROGRESS: '#A855F7',
  LOCKED: '#64748B',
};

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
    const unlockedIds = new Set(stored.filter((a) => !!a.unlockedAt).map((a) => a.id));
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

  const unlockedCount = badges.filter((b) => b.state === 'UNLOCKED').length;
  const inProgressCount = badges.filter((b) => b.state === 'IN_PROGRESS').length;
  const lockedCount = badges.filter((b) => b.state === 'LOCKED').length;

  if (loading || !profile) return <LoadingScreen />;

  return (
    <DTPage>
      <DTTopBar
        title="CONQUISTAS"
        subtitle="O que você já conquistou"
        onBack={() => navigate(-1)}
      />

      <DTMain>
        <div className="pt-3 space-y-5">
          <section className="relative overflow-hidden rounded-[24px] p-5 dt-hero-train">
            <span className="absolute -top-12 -right-8 w-36 h-36 rounded-full bg-white/20 blur-3xl pointer-events-none" />
            <div className="relative flex items-center gap-3">
              <span className="w-12 h-12 rounded-2xl bg-black/25 border border-white/20 flex items-center justify-center text-white">
                <IconTrophy size={22} />
              </span>
              <div className="min-w-0">
                <p className="text-[11px] uppercase tracking-[0.16em] font-bold text-white/75">Coleção</p>
                <p className="text-[24px] font-extrabold text-white font-[family-name:var(--font-display)] leading-tight">
                  {unlockedCount}/{badges.length}
                </p>
                <p className="text-[12px] text-white/85 mt-0.5">badges desbloqueadas</p>
              </div>
            </div>
          </section>

          <div className="grid grid-cols-3 gap-2">
            <DTMetricCard
              value={unlockedCount}
              label="Desbloqueadas"
              color="#00F2FE"
              icon={<IconCheck size={14} />}
            />
            <DTMetricCard
              value={inProgressCount}
              label="Em progresso"
              color="#A855F7"
              icon={<IconFlame size={14} />}
            />
            <DTMetricCard
              value={lockedCount}
              label="Bloqueadas"
              color="#64748B"
              icon={<IconLock size={14} />}
            />
          </div>

          <section>
            <DTSectionLabel className="mb-3">Badges</DTSectionLabel>
            <div className="grid grid-cols-2 gap-2.5">
              {badges.map((b) => {
                const unlocked = b.state === 'UNLOCKED';
                const progressState = b.state === 'IN_PROGRESS';
                const color = STATE_COLOR[b.state];
                return (
                  <DTGlassCard
                    key={b.id}
                    variant={unlocked ? 'cyan' : progressState ? 'violet' : 'default'}
                    className="p-4 transition-all duration-300"
                    style={{
                      opacity: unlocked || progressState ? 1 : 0.48,
                      boxShadow: unlocked
                        ? '0 0 22px rgba(0,242,254,0.35)'
                        : progressState
                          ? '0 0 14px rgba(139,92,246,0.28)'
                          : undefined,
                      border: unlocked
                        ? '1px solid rgba(0,242,254,0.4)'
                        : progressState
                          ? '1px solid rgba(139,92,246,0.4)'
                          : undefined,
                    }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span
                        className="w-11 h-11 rounded-2xl flex items-center justify-center text-[22px] leading-none"
                        style={{
                          background: `${color}18`,
                          boxShadow: unlocked || progressState ? `0 0 14px ${color}33` : undefined,
                        }}
                        aria-hidden
                      >
                        {b.icon}
                      </span>
                      {unlocked ? (
                        <DTBadge color="#00F2FE">✓</DTBadge>
                      ) : b.state === 'LOCKED' ? (
                        <span className="text-[#64748B]">
                          <IconLock size={14} />
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-3 text-[13px] font-bold text-white leading-snug">{b.title}</p>
                    <p className="mt-1 text-[11px] text-[#64748B] leading-snug line-clamp-2">{b.description}</p>
                    <p
                      className="mt-2.5 text-[10px] font-bold uppercase tracking-wide"
                      style={{ color }}
                    >
                      {STATE_LABEL[b.state]}
                      {b.detail && b.detail !== STATE_LABEL[b.state] ? ` · ${b.detail}` : ''}
                    </p>
                    {b.progressPct != null && b.state !== 'LOCKED' && (
                      <DTProgressBar
                        value={b.progressPct}
                        color={unlocked ? '#00F2FE' : '#8B5CF6'}
                        className="mt-2"
                      />
                    )}
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
