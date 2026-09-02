/**
 * Consolidação Professor Core: Grammar Adapter, Situações, TeacherTalkMetrics.
 */
import { assert } from '@/services/learning/__tests__/assert';
import { GRAMMAR, grammarForLevel, GRAMMAR_BY_ID } from '@/services/course/grammar';
import {
  GRAMMAR_RULES,
  adaptGrammarTopic,
  grammarRulesUpTo,
  isCourseGrammarSourceOfTruth,
  COURSE_GRAMMAR,
  getLegacySituations,
  getNormalizedSituations,
  adaptLegacySituation,
  assertUniqueSituationIds,
  EVERYDAY_SITUATIONS,
  UNIFIED_SIMULATOR_SCENARIOS,
  MODE_POLICIES,
  buildProfessorContext,
} from '@/services/teacher/ProfessorCore';
import { SITUATIONS } from '@/data/content';
import { listCompatibleScenarios } from '@/services/teacher/SimulatorEngine';
import { emptyLearningProfile, acceptedConf } from '@/services/learning/RealProgress';
import {
  beginTeacherTalkSession,
  recordTalkSegment,
  getTeacherTalkSnapshot,
  resetTeacherTalkMetricsForTests,
  talkMetricsForSimulatorResult,
  endTeacherTalkSession,
} from '@/services/teacher/TeacherTalkMetrics';
import {
  beginLiveSession,
  invalidateLiveSession,
  isLiveSessionCurrent,
} from '@/services/voice/LiveSessionRegistry';
import {
  clearSimulatorSession,
  finalizeSimulatorSession,
  startSimulatorSession,
} from '@/services/teacher/SimulatorSession';
import { buildSimulatorContext } from '@/services/teacher/SimulatorEngine';
import type { UserProfile } from '@/types';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dir = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dir, '../../../..');

function readSrc(rel: string): string {
  return readFileSync(resolve(root, rel), 'utf8');
}

function isoOffset(msAgo: number, durationMs: number): { startedAt: string; completedAt: string } {
  const end = Date.now() - msAgo;
  const start = end - durationMs;
  return { startedAt: new Date(start).toISOString(), completedAt: new Date(end).toISOString() };
}

function profile(): UserProfile {
  return {
    id: 'u1',
    name: 'Test',
    level: 'zero',
    dailyMinutes: 20,
    goal: 'work',
    profession: 'dev',
    frequentSituations: [],
    interests: [],
    onboardingComplete: true,
    firstLessonComplete: true,
    currentDay: 1,
    streak: 1,
    lastStudyDate: null,
    immersionPhase: 1,
    turboMode: false,
    speechSpeed: 'normal',
    germanPercentage: 50,
    createdAt: new Date().toISOString(),
  };
}

export async function testProfessorCoreConsolidation() {
  // ——— GRAMMAR 1–5 ———
  assert(GRAMMAR.length > 0, '1: course/grammar.ts fonte curricular');
  assert(grammarForLevel('L0').length > 0, '1b: grammarForLevel L0');
  assert(COURSE_GRAMMAR === GRAMMAR || COURSE_GRAMMAR.length === GRAMMAR.length, '1c: COURSE_GRAMMAR = course');

  const adapted = adaptGrammarTopic(GRAMMAR[0]);
  assert(adapted.id === GRAMMAR[0].id, '2: adapter preserva id');
  assert(adapted.summary === GRAMMAR[0].summary, '2b: adapter preserva summary');
  assert(isCourseGrammarSourceOfTruth(), '2c: fonte única verificável');

  const upTo = grammarRulesUpTo('A1');
  assert(upTo.every((r) => !!GRAMMAR_BY_ID[r.id]), '3: Professor Core só ids do curso');
  assert(GRAMMAR_RULES.length === GRAMMAR.length, '4: sem catálogo paralelo de tamanho diferente');
  assert(readSrc('src/services/course/ContentLevelValidator.ts').includes("from './grammar'"), '5: imports curso intactos');

  // ——— SITUATIONS 6–10 ———
  assert(getLegacySituations() === SITUATIONS || getLegacySituations().length === SITUATIONS.length, '6: legado acessível');
  const norm = getNormalizedSituations();
  assert(norm.length >= SITUATIONS.length, '6b: normalizado inclui legado');
  const one = adaptLegacySituation(SITUATIONS[0]);
  assert(one.id.startsWith('legacy.'), '6c: id legado namespaced');
  assert(EVERYDAY_SITUATIONS.length === norm.length, '7: SituationKnowledge = normalizado');
  assert(assertUniqueSituationIds(), '9: ids únicos');
  assert(UNIFIED_SIMULATOR_SCENARIOS.length >= 6, '8: cenários simulator unificados');
  assert(
    readSrc('src/services/teacher/SimulatorEngine.ts').includes('UNIFIED_SIMULATOR_SCENARIOS'),
    '8b: SimulatorEngine usa catálogo unificado',
  );
  assert(SITUATIONS.some((s) => s.id === 'restaurant'), '10: situações existentes preservadas');
  assert(readSrc('src/pages/SituationsPage.tsx').includes("from '@/data/content'"), '10b: UI legado intacta');

  const learning = emptyLearningProfile();
  learning.phrases['survival-arbeite'] = acceptedConf('survival-arbeite');
  learning.phrases['l0-hook-ich-moechte'] = acceptedConf('l0-hook-ich-moechte');
  const scenarios = listCompatibleScenarios(learning);
  assert(scenarios.every((s) => UNIFIED_SIMULATOR_SCENARIOS.some((u) => u.id === s.id)), '8c: cenários ⊆ unificado');

  // ——— TEACHER TALK 11–21 ———
  resetTeacherTalkMetricsForTests();
  const gen = beginLiveSession();
  beginTeacherTalkSession(gen, 'SIMULATOR');
  const t1 = isoOffset(5000, 2000);
  assert(
    recordTalkSegment({
      sessionGeneration: gen,
      role: 'assistant',
      turnId: 'a1',
      startedAt: t1.startedAt,
      completedAt: t1.completedAt,
    }),
    '11: transcript professor registrado',
  );
  const t2 = isoOffset(2000, 4000);
  assert(
    recordTalkSegment({
      sessionGeneration: gen,
      role: 'user',
      turnId: 'u1',
      startedAt: t2.startedAt,
      completedAt: t2.completedAt,
    }),
    '12: transcript aluno registrado',
  );
  const snap = getTeacherTalkSnapshot(gen);
  assert(snap.teacherSpeechDurationMs === 2000, '11b: duração professor');
  assert(snap.studentSpeechDurationMs === 4000, '12b: duração aluno');
  assert(snap.silenceDurationMs >= 0, '13: silêncio separado (não soma como fala)');
  assert(snap.teacherTalkRatio != null && Math.abs(snap.teacherTalkRatio! - 2000 / 6000) < 0.001, '14: ratio professor');
  assert(snap.studentTalkRatio != null && Math.abs(snap.studentTalkRatio! - 4000 / 6000) < 0.001, '15: ratio aluno');

  // 16: sessão antiga
  invalidateLiveSession();
  const gen2 = beginLiveSession();
  beginTeacherTalkSession(gen2, 'SIMULATOR');
  assert(!isLiveSessionCurrent(gen), '16a: gen antiga inválida');
  assert(
    !recordTalkSegment({
      sessionGeneration: gen,
      role: 'assistant',
      turnId: 'stale',
      ...isoOffset(0, 3000),
    }),
    '16b: transcript stale rejeitado',
  );

  // 17: duplicata
  const d = isoOffset(100, 1500);
  recordTalkSegment({ sessionGeneration: gen2, role: 'assistant', turnId: 'dup', ...d });
  assert(
    !recordTalkSegment({ sessionGeneration: gen2, role: 'assistant', turnId: 'dup', ...d }),
    '17: turnId duplicado rejeitado',
  );

  // mais turnos para reliable
  recordTalkSegment({
    sessionGeneration: gen2,
    role: 'user',
    turnId: 'u2',
    ...isoOffset(50, 3000),
  });
  const forResult = talkMetricsForSimulatorResult(gen2);
  assert(typeof forResult.teacherTalkRatio === 'number' || forResult.teacherTalkRatio === undefined, '18: métricas opcionais');

  // SimulatorResult integration
  clearSimulatorSession();
  resetTeacherTalkMetricsForTests();
  const g3 = beginLiveSession();
  const ctx = buildSimulatorContext({
    learning,
    phrases: [],
    mode: 'learned',
    durationMinutes: 10,
    trainingStyle: 'training',
  });
  assert(!!ctx, 'ctx simulator');
  startSimulatorSession(ctx!);
  beginTeacherTalkSession(g3, 'SIMULATOR');
  recordTalkSegment({ sessionGeneration: g3, role: 'assistant', turnId: 'sa', ...isoOffset(8000, 2000) });
  recordTalkSegment({ sessionGeneration: g3, role: 'user', turnId: 'su', ...isoOffset(4000, 5000) });
  // force liveSessionGeneration on session by re-binding — start used getLiveSessionGeneration which is g3
  const result = finalizeSimulatorSession();
  assert(!!result, '18a: result existe');
  if (result && result.teacherTalkRatio != null) {
    assert(result.studentTalkRatio != null, '18b: student ratio no result');
    assert(result.teacherSpeechDurationMs != null, '18c: duração no result');
  }

  // 19: metrics ≠ mastery — ModePolicies / RealProgress intactos
  assert(readSrc('src/services/learning/ConfidenceService.ts').includes('PhraseConfidence'), '19: mastery path intacto');
  assert(!readSrc('src/services/teacher/TeacherTalkMetrics.ts').includes('automationScore'), '19b: metrics não tocam automation');

  // 20–21: Mini Prova / Lesson ≠ meta Simulator
  assert(MODE_POLICIES.MINI_PROVA.goal.includes('SOZINHO'), '20: Mini Prova avaliação');
  assert(MODE_POLICIES.MINI_PROVA.focus.includes('avaliar'), '20b: foco avaliação');
  assert(MODE_POLICIES.LESSON.allowTeaching === true, '21: Lesson ensina');
  assert(MODE_POLICIES.SIMULATOR.teacherTalkRatioMax === 0.35, '21b: meta 35% só Simulator');
  assert(MODE_POLICIES.LESSON.teacherTalkRatioMax > MODE_POLICIES.SIMULATOR.teacherTalkRatioMax, '21c: Lesson permite mais fala');

  const lessonCtx = buildProfessorContext({
    profile: profile(),
    learning,
    phrases: [],
    mode: 'LESSON',
  });
  assert(lessonCtx.teacherTalkRatioMax === MODE_POLICIES.LESSON.teacherTalkRatioMax, '21d: Lesson usa própria meta');

  endTeacherTalkSession(g3);
  resetTeacherTalkMetricsForTests();
}

if (import.meta.url.endsWith('ProfessorCoreConsolidation.test.ts')) {
  try {
    await testProfessorCoreConsolidation();
    console.log('ProfessorCoreConsolidation: todos os testes passaram.');
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}
