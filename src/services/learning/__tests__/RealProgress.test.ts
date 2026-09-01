import { assert } from './assert';
import {
  acceptedConf,
  computeRealProgress,
  emptyLearningProfile,
  l0CurriculumTotals,
} from '@/services/learning/RealProgress';
import { L0_CHUNK_GRAPH, isL0ChunkMature } from '@/services/teacher/ZeroLanguageMode';
import { emptyConfidence } from '@/services/learning/ConfidenceService';
import { computeDailyGoalView } from '@/services/learning/DailyGoalStore';
import type { UserMetricsState } from '@/services/learning/UserMetricsStore';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

function defaultMetrics(overrides: Partial<UserMetricsState> = {}): UserMetricsState {
  const today = new Date().toISOString().slice(0, 10);
  return {
    date: today,
    learnedChunkIds: [],
    totalVariationsCreated: 0,
    speechPromptsTotal: 0,
    speechPromptsCorrectNoHint: 0,
    ...overrides,
  };
}

function defaultDaily() {
  return computeDailyGoalView({
    date: new Date().toISOString().slice(0, 10),
    dailyGoalMinutes: 30,
    secondsStudiedToday: 0,
    showMorningPrompt: false,
  });
}

export function testRealProgress() {
  const { baseCount, variationCount } = l0CurriculumTotals();
  assert(baseCount === 10, `L0 tem ${baseCount} chunks base`);
  assert(variationCount > 0, 'currículo L0 tem variações');

  const empty = computeRealProgress({
    learning: emptyLearningProfile(),
    metrics: defaultMetrics(),
    daily: defaultDaily(),
    currentLevel: 'L0',
    reviewQueueCount: 0,
  });
  assert(empty.learnedChunks === 0, 'zero dados → 0 chunks');
  assert(empty.variationsPracticed === 0, 'zero dados → 0 variações');
  assert(empty.masteryPercent === null, 'zero dados → domínio null');
  assert(empty.autonomousSpeechPercent === null, 'zero dados → autonomia null');
  assert(empty.masteryDetail === 'Em construção', 'estado honesto sem dados');

  const learning5 = emptyLearningProfile();
  const baseIds = Object.keys(L0_CHUNK_GRAPH).slice(0, 5);
  for (const id of baseIds) {
    learning5.phrases[id] = acceptedConf(id);
  }
  const p5 = computeRealProgress({
    learning: learning5,
    metrics: defaultMetrics(),
    daily: defaultDaily(),
    currentLevel: 'L0',
    reviewQueueCount: 3,
  });
  assert(p5.learnedChunks === 5, 'learnedChunks = 5');
  assert(p5.reviewQueueCount === 3, 'review queue repassada');
  assert(p5.masteryPercent !== null, 'com estudo → domínio calculado');

  const learningVars = emptyLearningProfile();
  let varCount = 0;
  for (const node of Object.values(L0_CHUNK_GRAPH)) {
    for (const varId of [...node.simpleVars, ...node.questions]) {
      if (varCount >= 8) break;
      learningVars.phrases[varId] = acceptedConf(varId);
      varCount++;
    }
    if (varCount >= 8) break;
  }
  const pVars = computeRealProgress({
    learning: learningVars,
    metrics: defaultMetrics(),
    daily: defaultDaily(),
    currentLevel: 'L0',
    reviewQueueCount: 0,
  });
  assert(pVars.variationsPracticed === 8, 'variationsPracticed = 8');

  const pAuto = computeRealProgress({
    learning: emptyLearningProfile(),
    metrics: defaultMetrics({ speechPromptsTotal: 100, speechPromptsCorrectNoHint: 60 }),
    daily: defaultDaily(),
    currentLevel: 'L0',
    reviewQueueCount: 0,
  });
  assert(pAuto.autonomousSpeechPercent === 60, 'autonomousSpeech = 60%');

  const learningWeak = emptyLearningProfile();
  const weak = emptyConfidence('l0-var-ich-moechte-wasser');
  learningWeak.phrases['l0-var-ich-moechte-wasser'] = {
    ...weak,
    confidence: 25,
    timesProduced: 2,
    timesCorrect: 1,
    needsHelp: true,
    lastProduced: new Date().toISOString(),
    state: 'answeredWithHelp',
  };
  const pWeak = computeRealProgress({
    learning: learningWeak,
    metrics: defaultMetrics(),
    daily: defaultDaily(),
    currentLevel: 'L0',
    reviewQueueCount: 5,
  });
  assert(pWeak.weakAreas.length >= 1, 'área fraca detectada');
  assert(pWeak.weakAreas[0].reason === 'precisa de ajuda', 'motivo real');

  const learningPartial = emptyLearningProfile();
  learningPartial.phrases['survival-arbeite'] = acceptedConf('survival-arbeite');
  learningPartial.phrases['l0-bridge-ich-arbeite-in'] = acceptedConf('l0-bridge-ich-arbeite-in');
  learningPartial.phrases['l0-bridge-ich-arbeite-heute'] = acceptedConf('l0-bridge-ich-arbeite-heute');
  const pPartial = computeRealProgress({
    learning: learningPartial,
    metrics: defaultMetrics(),
    daily: defaultDaily(),
    currentLevel: 'L0',
    reviewQueueCount: 0,
  });
  assert(pPartial.learnedChunks >= 1, 'chunk parcial contado');
  assert(
    !isL0ChunkMature(learningPartial, 'survival-arbeite') || pPartial.levelProgress[0].progressPercent! > 0,
    'progresso L0 reflete maturidade',
  );

  const pA1 = computeRealProgress({
    learning: emptyLearningProfile(),
    metrics: defaultMetrics(),
    daily: defaultDaily(),
    currentLevel: 'L0',
    reviewQueueCount: 0,
  });
  const a1Entry = pA1.levelProgress.find((l) => l.level === 'A1');
  assert(a1Entry?.availability === 'locked', 'A1 bloqueado em L0');

  const progressPageSrc = readFileSync(
    resolve(__dirname, '../../../pages/ProgressPage.tsx'),
    'utf8',
  );
  assert(!progressPageSrc.includes('value="12"'), 'ProgressPage não hardcoda 12');
  assert(!progressPageSrc.includes('value="48"'), 'ProgressPage não hardcoda 48');
  assert(!progressPageSrc.includes('value="68%"'), 'ProgressPage não hardcoda 68%');
  assert(!progressPageSrc.includes('const known = 12'), 'ProgressPage não declara known=12');
  assert(!progressPageSrc.includes('const variations = 48'), 'ProgressPage não declara variations=48');
  assert(
    progressPageSrc.includes('getRealProgress') || progressPageSrc.includes('computeRealProgress'),
    'ProgressPage usa agregador real',
  );
}

if (import.meta.url.endsWith('RealProgress.test.ts')) {
  try {
    testRealProgress();
    console.log('RealProgress: todos os testes passaram.');
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}
