/**
 * Agregador de leitura — painel Progresso.
 * Reutiliza estado pedagógico existente (sem banco paralelo).
 */
import type { CourseLevelId } from '@/services/course/types';
import { getLevelAvailability, type LevelAvailability } from '@/services/course/CourseUnlockService';
import {
  emptyConfidence,
  isMastered,
  stateIndex,
  type PhraseConfidence,
  type UserLearningProfile,
} from '@/services/learning/ConfidenceService';
import { DailyGoalStore, type DailyGoalView } from '@/services/learning/DailyGoalStore';
import { deriveLearningCounts, UserMetricsStore, type UserMetricsState } from '@/services/learning/UserMetricsStore';
import { getReviewQueue } from '@/services/learning/ReviewEngine';
import { ChunkTrackerStore } from '@/services/learning/ChunkTrackerStore';
import {
  L0_CHUNK_GRAPH,
  isL0ChunkMature,
  isZeroLanguagePhraseAccepted,
  zeroLanguageSeedPhrases,
  l0ChunkBaseForPhraseId,
} from '@/services/teacher/ZeroLanguageMode';

const MAP_LEVELS: CourseLevelId[] = ['L0', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

export type LevelProgressEntry = {
  level: CourseLevelId;
  availability: LevelAvailability;
  progressPercent: number | null;
  detail: string;
};

export type ProgressAdvance = {
  phraseId: string;
  german: string;
  practicedAt: string;
};

export type WeakArea = {
  phraseId: string;
  german: string;
  reason: string;
};

export type ActivityDay = {
  date: string;
  label: string;
  chunksGained: number;
  productions: number;
  reviews: number;
};

export type RealProgress = {
  currentLevel: CourseLevelId;
  masteryPercent: number | null;
  masteryDetail: string;
  learnedChunks: number;
  learnedChunksTotal: number;
  variationsPracticed: number;
  variationsTotal: number;
  autonomousSpeechPercent: number | null;
  autonomousSpeechDetail: string;
  levelProgress: LevelProgressEntry[];
  recentAdvances: ProgressAdvance[];
  weakAreas: WeakArea[];
  reviewQueueCount: number;
  newChunksThisWeek: number | null;
  activityDays: ActivityDay[];
  studyMinutesToday: number;
  studyMinutesTotal: number;
  dailyGoalMinutes: number;
  streak: number;
  variationsToday: number;
};

export type RealProgressInput = {
  learning: UserLearningProfile;
  metrics: UserMetricsState;
  daily: DailyGoalView;
  currentLevel: CourseLevelId;
  reviewQueueCount: number;
  variationsToday?: number;
};

const phraseGerman = new Map(zeroLanguageSeedPhrases().map((p) => [p.id, p.german]));

export function l0CurriculumTotals(): { baseCount: number; variationCount: number } {
  let variationCount = 0;
  for (const node of Object.values(L0_CHUNK_GRAPH)) {
    variationCount += node.simpleVars.length + node.questions.length;
  }
  return { baseCount: Object.keys(L0_CHUNK_GRAPH).length, variationCount };
}

export function allL0CurriculumPhraseIds(): string[] {
  const ids = new Set<string>();
  for (const [baseId, node] of Object.entries(L0_CHUNK_GRAPH)) {
    ids.add(baseId);
    for (const id of node.simpleVars) ids.add(id);
    for (const id of node.questions) ids.add(id);
  }
  return [...ids];
}

function isStudied(conf: PhraseConfidence | undefined): boolean {
  if (!conf) return false;
  return (conf.timesCorrect ?? 0) > 0 || (conf.timesProduced ?? 0) > 0 || conf.confidence > 0;
}

function resolveGerman(phraseId: string): string {
  return phraseGerman.get(phraseId) ?? phraseId;
}

function computeMastery(learning: UserLearningProfile): {
  percent: number | null;
  detail: string;
  dominatedCount: number;
  studiedCount: number;
} {
  const curriculumIds = allL0CurriculumPhraseIds();
  const studied = curriculumIds
    .map((id) => learning.phrases[id])
    .filter((c): c is PhraseConfidence => isStudied(c));

  if (studied.length === 0) {
    return { percent: null, detail: 'Em construção', dominatedCount: 0, studiedCount: 0 };
  }

  const dominated = studied.filter(
    (c) => isZeroLanguagePhraseAccepted(c) || isMastered(c) || c.confidence >= 75,
  );
  const avg = Math.round(studied.reduce((s, c) => s + c.confidence, 0) / studied.length);

  const maturedBases = Object.keys(L0_CHUNK_GRAPH).filter((id) =>
    isL0ChunkMature(learning, id),
  ).length;

  return {
    percent: avg,
    detail: `${dominated.length} de ${studied.length} itens estudados dominados · ${maturedBases} chunks maduros`,
    dominatedCount: dominated.length,
    studiedCount: studied.length,
  };
}

function computeAutonomousSpeech(
  learning: UserLearningProfile,
  metrics: UserMetricsState,
): { percent: number | null; detail: string } {
  if (metrics.speechPromptsTotal > 0) {
    const pct = Math.round(
      (metrics.speechPromptsCorrectNoHint / metrics.speechPromptsTotal) * 100,
    );
    return {
      percent: pct,
      detail: `${metrics.speechPromptsCorrectNoHint} de ${metrics.speechPromptsTotal} produções sem ajuda`,
    };
  }

  const produced = Object.values(learning.phrases).filter((c) => c.timesProduced > 0);
  if (produced.length === 0) {
    return { percent: null, detail: 'Dados insuficientes' };
  }

  const autonomous = produced.filter(
    (c) =>
      c.timesCorrect > 0 &&
      !c.needsHelp &&
      stateIndex(c.state) >= stateIndex('answeredAlone'),
  );
  const pct = Math.round((autonomous.length / produced.length) * 100);
  return {
    percent: pct,
    detail: `${autonomous.length} de ${produced.length} produções independentes`,
  };
}

function buildLevelProgress(learning: UserLearningProfile, currentLevel: CourseLevelId): LevelProgressEntry[] {
  const { baseCount, variationCount } = l0CurriculumTotals();
  const matured = Object.keys(L0_CHUNK_GRAPH).filter((id) => isL0ChunkMature(learning, id)).length;
  const { learnedChunkIds, totalVariationsCreated } = deriveLearningCounts(learning);

  return MAP_LEVELS.map((level) => {
    const availability = getLevelAvailability(level, currentLevel);

    if (level === 'L0') {
      const pct = baseCount > 0 ? Math.round((matured / baseCount) * 100) : null;
      return {
        level,
        availability,
        progressPercent: pct,
        detail: `${matured}/${baseCount} chunks maduros · ${learnedChunkIds.length} aprendidos · ${totalVariationsCreated}/${variationCount} variações`,
      };
    }

    if (availability === 'locked') {
      return { level, availability, progressPercent: null, detail: 'Bloqueado' };
    }

    if (availability === 'completed') {
      return { level, availability, progressPercent: 100, detail: 'Concluído' };
    }

    return { level, availability, progressPercent: null, detail: 'Em construção' };
  });
}

function buildRecentAdvances(learning: UserLearningProfile, limit = 4): ProgressAdvance[] {
  const items = Object.values(learning.phrases)
    .filter((c) => isZeroLanguagePhraseAccepted(c) && c.lastProduced)
    .sort((a, b) => Date.parse(b.lastProduced!) - Date.parse(a.lastProduced!))
    .slice(0, limit);

  return items.map((c) => ({
    phraseId: c.phraseId,
    german: resolveGerman(c.phraseId),
    practicedAt: c.lastProduced!,
  }));
}

function buildWeakAreas(learning: UserLearningProfile, limit = 5): WeakArea[] {
  const candidates = Object.values(learning.phrases)
    .filter((c) => {
      if (!isStudied(c)) return false;
      const inL0 =
        L0_CHUNK_GRAPH[c.phraseId] ||
        l0ChunkBaseForPhraseId(c.phraseId) !== null;
      if (!inL0) return false;
      return (
        c.needsHelp ||
        c.confidence < 40 ||
        (c.nextReview && Date.parse(c.nextReview) <= Date.now())
      );
    })
    .sort((a, b) => a.confidence - b.confidence)
    .slice(0, limit);

  return candidates.map((c) => ({
    phraseId: c.phraseId,
    german: resolveGerman(c.phraseId),
    reason: c.needsHelp
      ? 'precisa de ajuda'
      : c.confidence < 40
        ? 'baixa confiança'
        : 'revisão pendente',
  }));
}

function formatDayLabel(isoDate: string): string {
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
  if (isoDate === today) return 'Hoje';
  if (isoDate === yesterday) return 'Ontem';
  const [y, m, d] = isoDate.split('-');
  return `${d}/${m}/${y}`;
}

function buildActivityDays(learning: UserLearningProfile, maxDays = 3): ActivityDay[] {
  const byDay = new Map<string, ActivityDay>();

  for (const c of Object.values(learning.phrases)) {
    if (c.lastProduced) {
      const day = c.lastProduced.slice(0, 10);
      const entry = byDay.get(day) ?? {
        date: day,
        label: formatDayLabel(day),
        chunksGained: 0,
        productions: 0,
        reviews: 0,
      };
      entry.productions += 1;
      if (isZeroLanguagePhraseAccepted(c)) entry.chunksGained += 1;
      byDay.set(day, entry);
    }
    if (c.lastReviewed) {
      const day = c.lastReviewed.slice(0, 10);
      const entry = byDay.get(day) ?? {
        date: day,
        label: formatDayLabel(day),
        chunksGained: 0,
        productions: 0,
        reviews: 0,
      };
      entry.reviews += 1;
      byDay.set(day, entry);
    }
  }

  return [...byDay.values()]
    .filter((d) => d.chunksGained > 0 || d.productions > 0 || d.reviews > 0)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, maxDays);
}

function countNewChunksThisWeek(learning: UserLearningProfile): number | null {
  const weekAgo = Date.now() - 7 * 86_400_000;
  const bases = Object.keys(L0_CHUNK_GRAPH).filter((id) => {
    const c = learning.phrases[id];
    return (
      isZeroLanguagePhraseAccepted(c) &&
      c?.lastProduced &&
      Date.parse(c.lastProduced) >= weekAgo
    );
  });
  return bases.length > 0 ? bases.length : null;
}

/** Cálculo síncrono — usado em testes e após carregar learning. */
export function computeRealProgress(input: RealProgressInput): RealProgress {
  const { learning, metrics, daily, currentLevel, reviewQueueCount } = input;
  const { baseCount, variationCount } = l0CurriculumTotals();
  const { learnedChunkIds, totalVariationsCreated } = deriveLearningCounts(learning);
  const mastery = computeMastery(learning);
  const autonomy = computeAutonomousSpeech(learning, metrics);
  const variationsToday =
    input.variationsToday ??
    ChunkTrackerStore.getState().variations.filter((v) => v.status === 'validated').length;

  return {
    currentLevel,
    masteryPercent: mastery.percent,
    masteryDetail: mastery.detail,
    learnedChunks: learnedChunkIds.length,
    learnedChunksTotal: baseCount,
    variationsPracticed: totalVariationsCreated,
    variationsTotal: variationCount,
    autonomousSpeechPercent: autonomy.percent,
    autonomousSpeechDetail: autonomy.detail,
    levelProgress: buildLevelProgress(learning, currentLevel),
    recentAdvances: buildRecentAdvances(learning),
    weakAreas: buildWeakAreas(learning),
    reviewQueueCount,
    newChunksThisWeek: countNewChunksThisWeek(learning),
    activityDays: buildActivityDays(learning),
    studyMinutesToday: daily.minutesStudiedToday,
    studyMinutesTotal: learning.totalStudyTime,
    dailyGoalMinutes: daily.dailyGoalMinutes,
    streak: learning.currentStreak,
    variationsToday,
  };
}

/** Carrega fila de revisão + estado local e devolve painel completo. */
export async function getRealProgress(
  learning: UserLearningProfile,
  currentLevel: CourseLevelId,
  reviewLimit = 12,
): Promise<RealProgress> {
  let reviewQueueCount = 0;
  try {
    const queue = await getReviewQueue(reviewLimit);
    reviewQueueCount = queue.length;
  } catch {
    reviewQueueCount = 0;
  }

  return computeRealProgress({
    learning,
    metrics: UserMetricsStore.getState(),
    daily: DailyGoalStore.getView(),
    currentLevel,
    reviewQueueCount,
  });
}

/** Utilitário de teste — perfil vazio. */
export function emptyLearningProfile(): UserLearningProfile {
  return {
    userLevel: 'zero',
    communicationScore: 0,
    listeningScore: 0,
    speakingScore: 0,
    retentionScore: 0,
    pronunciationScore: 0,
    responseSpeedScore: 0,
    immersionLevel: 0,
    dailyGoal: 20,
    currentStreak: 0,
    totalStudyTime: 0,
    knownWords: [],
    knownPhrases: [],
    weakPhrases: [],
    strongPhrases: [],
    recurringMistakes: [],
    recentTopics: [],
    recentSituations: [],
    lastSession: null,
    learningVelocity: 0,
    phrases: {},
    bottleneck: null,
  };
}

export function acceptedConf(phraseId: string): PhraseConfidence {
  const c = emptyConfidence(phraseId);
  return {
    ...c,
    timesCorrect: 1,
    timesProduced: 1,
    confidence: 55,
    lastProduced: new Date().toISOString(),
    state: 'answeredAlone',
  };
}
