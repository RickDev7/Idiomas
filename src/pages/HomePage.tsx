/**
 * Home — Deutsch Turbo Training Cockpit (Fase 1).
 * Composição única: header compacto → níveis → hero dominante → targets → progresso.
 * Dados reais: profile, RealProgress, Learning State, DailyGoal. Sem métricas fake.
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { useProfile } from '@/hooks/useProfile';
import { useUserMetrics } from '@/hooks/useUserMetrics';
import { getTodaySession } from '@/services/storage/initData';
import { DailyGoalSheet } from '@/components/home/DailyGoalSheet';
import {
  HomeCockpitHeader,
  HomeLevelRail,
  HomeTrainingHero,
  HomeStudyTargets,
  HomeProgressStrip,
  type StudyTarget,
} from '@/components/home/HomeSections';
import { BottomNav } from '@/components/layout/BottomNav';
import { DTPage, DTMain } from '@/components/dt';
import {
  getCurrentLevel,
  getStoredCourseProgress,
  type CourseProgress,
} from '@/services/course';
import { getIncompleteSession } from '@/services/teacher/sessionContinuity';
import { SoundService } from '@/services/ui/SoundService';
import { MemoryService } from '@/services/learning/MemoryService';
import { getRealProgress, type RealProgress } from '@/services/learning/RealProgress';
import { readAutomationScore } from '@/services/learning/AutomationScoreEngine';
import type { PhraseConfidence, UserLearningProfile } from '@/services/learning/ConfidenceService';
import {
  L0_CHUNK_GRAPH,
  l0ChunkBaseForPhraseId,
  zeroLanguageSeedPhrases,
} from '@/services/teacher/ZeroLanguageMode';
import { UNIFIED_SIMULATOR_SCENARIOS } from '@/services/teacher/ProfessorCore/SituationCatalog';
import { useChunkTracker } from '@/hooks/useChunkTracker';

const TOPIC_HINTS: Record<string, string[]> = {
  work: ['arbeit'],
  home: ['wohn', 'hause'],
  needs: ['brauch'],
  food: ['moecht', 'essen'],
  places: ['wohn'],
  identity: ['heiss', 'komm'],
  routine: ['muss'],
  requests: ['kannst', 'hilfe'],
  help: ['hilfe'],
};

const TARGET_META: Array<{ tint: string; icon: StudyTarget['icon'] }> = [
  { tint: '#F97316', icon: 'flame' },
  { tint: '#00F2FE', icon: 'drop' },
  { tint: '#8B5CF6', icon: 'bolt' },
];

function pctFromConf(c: PhraseConfidence | undefined): number | null {
  if (!c) return null;
  const auto = readAutomationScore(c);
  if (typeof auto === 'number' && auto > 0) return Math.round(auto);
  if (typeof c.confidence === 'number' && c.confidence > 0) return Math.round(c.confidence);
  return null;
}

function isStudied(c: PhraseConfidence | undefined): boolean {
  if (!c) return false;
  return (c.timesCorrect ?? 0) > 0 || (c.timesProduced ?? 0) > 0 || c.confidence > 0;
}

function countActiveDomains(learning: UserLearningProfile): number {
  let n = 0;
  for (const scenario of UNIFIED_SIMULATOR_SCENARIOS) {
    const hints = TOPIC_HINTS[scenario.topic] || [];
    const hit = Object.values(learning.phrases).some((c) => {
      if (!c || (c.timesSeen <= 0 && c.timesCorrect <= 0 && c.confidence <= 0)) return false;
      const id = c.phraseId.toLowerCase();
      return hints.some((h) => id.includes(h));
    });
    if (hit) n += 1;
  }
  return n;
}

function pickStudyTargets(
  learning: UserLearningProfile | null,
  activeBaseId: string | undefined,
  weakIds: string[],
): Array<{ id: string; german: string; portuguese: string; pct: number | null }> {
  const seeds = new Map(zeroLanguageSeedPhrases().map((p) => [p.id, p]));
  const baseIds = Object.keys(L0_CHUNK_GRAPH);
  const phrases = learning?.phrases ?? {};

  const row = (id: string) => {
    const seed = seeds.get(id);
    const conf = phrases[id];
    return {
      id,
      german: seed?.german || id,
      portuguese: seed?.portuguese || '',
      pct: pctFromConf(conf),
      studied: isStudied(conf),
      conf: conf?.confidence ?? 0,
      needsHelp: !!conf?.needsHelp,
    };
  };

  const picked: string[] = [];
  const push = (id: string | undefined) => {
    if (!id || !baseIds.includes(id) || picked.includes(id)) return;
    picked.push(id);
  };

  // Prioridade: chunk ativo → pontos fracos → estudados com menor confiança → currículo
  push(activeBaseId);
  for (const id of weakIds) {
    if (L0_CHUNK_GRAPH[id]) push(id);
    else {
      const base = l0ChunkBaseForPhraseId(id);
      if (base) push(base);
    }
  }

  const studiedLow = baseIds
    .map(row)
    .filter((r) => r.studied)
    .sort((a, b) => a.conf - b.conf || (a.needsHelp === b.needsHelp ? 0 : a.needsHelp ? -1 : 1));
  for (const r of studiedLow) push(r.id);

  for (const id of baseIds) push(id);

  return picked.slice(0, 3).map((id) => {
    const r = row(id);
    return { id: r.id, german: r.german, portuguese: r.portuguese, pct: r.pct };
  });
}

export function HomePage() {
  const { profile, loading } = useProfile();
  const navigate = useNavigate();
  const [course, setCourse] = useState<CourseProgress | null>(null);
  const [incomplete, setIncomplete] = useState(() => getIncompleteSession());
  const [progress, setProgress] = useState<RealProgress | null>(null);
  const [learning, setLearning] = useState<UserLearningProfile | null>(null);
  const metrics = useUserMetrics();
  const { activeChunk } = useChunkTracker();
  const { refreshFromLearning, setDailyGoal, dismissMorningPrompt } = metrics;
  const [goalSheetOpen, setGoalSheetOpen] = useState(false);
  const [goalSheetMode, setGoalSheetMode] = useState<'edit' | 'morning'>('edit');

  useEffect(() => {
    if (loading) return;
    if (!profile || !profile.onboardingComplete) {
      navigate('/onboarding', { replace: true });
    }
  }, [loading, profile, navigate]);

  useEffect(() => {
    const refresh = () => {
      setCourse(getStoredCourseProgress());
      setIncomplete(getIncompleteSession());
      void refreshFromLearning();
    };
    refresh();
    window.addEventListener('focus', refresh);
    return () => window.removeEventListener('focus', refresh);
  }, [profile?.diagnosticLevel, profile?.selfReportedLevel, profile?.currentDay, refreshFromLearning]);

  useEffect(() => {
    if (!profile) return;
    let cancelled = false;
    const level = getCurrentLevel(profile, getStoredCourseProgress());
    void MemoryService.loadProfile(profile)
      .then(async (lp) => {
        const p = await getRealProgress(lp, level);
        if (!cancelled) {
          setLearning(lp);
          setProgress(p);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLearning(null);
          setProgress(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [profile]);

  useEffect(() => {
    if (metrics.showMorningPrompt) {
      setGoalSheetMode('morning');
      setGoalSheetOpen(true);
    }
  }, [metrics.showMorningPrompt]);

  const studyTargets = useMemo(() => {
    const weakIds = (progress?.weakAreas ?? []).map((w) => w.phraseId);
    const rows = pickStudyTargets(learning, activeChunk?.baseId, weakIds);
    return rows.map((r, i): StudyTarget => {
      const meta = TARGET_META[i % TARGET_META.length];
      return {
        ...r,
        tint: meta.tint,
        icon: meta.icon,
        onClick: () => navigate(`/estrutura/${encodeURIComponent(r.id)}`),
      };
    });
  }, [learning, progress?.weakAreas, activeChunk?.baseId, navigate]);

  if (loading || !profile || !profile.onboardingComplete) {
    return <LoadingScreen />;
  }

  const currentLevel = getCurrentLevel(profile, course);
  const levelId = ['L0', 'A1', 'A2', 'B1', 'B2'].includes(currentLevel) ? currentLevel : 'L0';
  const name = profile.name?.trim();

  const openGoalEditor = () => {
    setGoalSheetMode('edit');
    setGoalSheetOpen(true);
  };

  const startTraining = async () => {
    await getTodaySession(profile);
    const type = profile.firstLessonComplete ? 'lesson' : 'first';
    SoundService.play('start');
    navigate(`/sessao?type=${type}`);
  };

  const situationsDone = learning ? countActiveDomains(learning) : null;
  const situationsTotal = UNIFIED_SIMULATOR_SCENARIOS.length;

  const progressStats = [
    {
      label: 'Chunks',
      value:
        progress != null
          ? `${progress.learnedChunks} / ${progress.learnedChunksTotal}`
          : '—',
    },
    {
      label: 'Estruturas',
      value:
        progress != null
          ? `${progress.variationsPracticed} / ${progress.variationsTotal}`
          : '—',
    },
    {
      label: 'Situações',
      value: situationsDone != null ? `${situationsDone} / ${situationsTotal}` : '—',
    },
    {
      label: 'Autonomia',
      value:
        progress?.autonomousSpeechPercent != null
          ? `${progress.autonomousSpeechPercent}%`
          : '—',
    },
  ];

  return (
    <DTPage className="home-cockpit">
      <HomeCockpitHeader
        name={name}
        streak={profile.streak || 0}
        onStreak={() => navigate('/progresso')}
        onBell={() => navigate('/configuracoes')}
      />

      <DTMain className="pt-3 !space-y-0 home-cockpit-main">
        <div className="home-cockpit-stack">
          <HomeLevelRail current={levelId} />

          <HomeTrainingHero
            title={incomplete ? 'Continuar treino' : 'Começar treino'}
            badge={metrics.heroBadgeLabel || `${metrics.dailyGoalMinutes} min`}
            onBadgeClick={openGoalEditor}
            actionLabel={incomplete ? 'Continuar treino' : 'Iniciar agora'}
            onStart={() => void startTraining()}
          />

          <HomeStudyTargets
            targets={studyTargets}
            onSeeAll={() => navigate('/chunks')}
          />

          <HomeProgressStrip
            mastery={progress?.masteryPercent ?? null}
            stats={progressStats}
          />
        </div>
      </DTMain>

      <BottomNav />
      <DailyGoalSheet
        open={goalSheetOpen}
        mode={goalSheetMode}
        currentGoal={metrics.dailyGoalMinutes}
        onSelect={(minutes) => {
          setDailyGoal(minutes);
          dismissMorningPrompt();
        }}
        onClose={() => {
          setGoalSheetOpen(false);
          if (goalSheetMode === 'morning') dismissMorningPrompt();
        }}
      />
    </DTPage>
  );
}
