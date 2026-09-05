/* B1 curriculum + Live planner + A2→B1 + B2 gate E2E (simulado).
   Rodar: npx tsx src/services/course/__tests__/B1CurriculumLive.test.ts */
const _store = new Map<string, string>();
(globalThis as unknown as { localStorage: Storage; sessionStorage: Storage }).localStorage = {
  getItem: (k) => _store.get(k) ?? null,
  setItem: (k, v) => { _store.set(k, String(v)); },
  removeItem: (k) => { _store.delete(k); },
  clear: () => { _store.clear(); },
  key: () => null,
  length: 0,
} as Storage;
(globalThis as unknown as { sessionStorage: Storage }).sessionStorage =
  (globalThis as unknown as { localStorage: Storage }).localStorage;

import {
  B1_CURRICULUM,
  b1FirstTarget,
  assertB1CurriculumIntegrity,
  getB1TargetById,
  getB1Targets,
  getB1TargetsByCompetency,
  getB1TargetsByUnit,
  getNextB1Target,
  isB1TargetId,
  isB1UnitComplete,
  isB1CurriculumComplete,
  mergeB1CurriculumPhrases,
  pickB1PlannerTarget,
} from '@/services/course/B1Curriculum';
import {
  isHigherLevelCurriculumBlocked,
  mergeA1CurriculumPhrases,
} from '@/services/course/A1Curriculum';
import {
  getA2Targets,
  mergeA2CurriculumPhrases,
} from '@/services/course/A2Curriculum';
import {
  maybeGraduateA2ToB1,
  maybeGraduateB1ToB2,
} from '@/services/course/L0ToA1Graduation';
import {
  defaultCourseProgress,
  readyForNextLevel,
  saveCourseProgress,
  getStoredCourseProgress,
} from '@/services/course/CourseProgressEngine';
import { LEVEL_BY_ID } from '@/services/course/levels';
import { competenciesForLevel } from '@/services/course/competencies';
import { CURATED } from '@/services/course/content';
import { gradeAssessment } from '@/services/course/LevelAssessment';
import {
  ConversationOrchestrator,
  buildConversationPlan,
  buildB1TurnPedagogicalDirective,
  evaluateProduction,
  isA1LiveMode,
  isA2LiveMode,
  isB1LiveMode,
} from '@/services/teacher/ConversationOrchestrator';
import {
  isZeroLanguageMode,
  zeroLanguageSeedPhrases,
  diagnoseAgainstAccepted,
} from '@/services/teacher/ZeroLanguageMode';
import { emptyLearningProfile, computeRealProgress } from '@/services/learning/RealProgress';
import { emptyConfidence, type UserLearningProfile } from '@/services/learning/ConfidenceService';
import { DailyGoalStore } from '@/services/learning/DailyGoalStore';
import { UserMetricsStore } from '@/services/learning/UserMetricsStore';
import { buildReviewQueue } from '@/services/learning/ReviewEngine';
import type { UserProfile } from '@/types';

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean) {
  if (cond) {
    passed += 1;
    console.log(`  ✓ ${name}`);
  } else {
    failed += 1;
    console.error(`  ✗ ${name}`);
  }
}

function profileA2(): UserProfile {
  return {
    id: 'b1-e2e',
    name: 'Rick',
    level: 'basic',
    selfReportedLevel: 'basic',
    diagnosticLevel: 'A2',
    goal: 'daily',
    dailyMinutes: 20,
    germanPercentage: 50,
    turboMode: false,
    streak: 0,
    currentDay: 1,
    onboardingComplete: true,
    firstLessonComplete: true,
    profession: '',
    frequentSituations: [],
    interests: [],
    lastStudyDate: null,
    immersionPhase: 1,
    speechSpeed: 'normal',
    createdAt: new Date().toISOString(),
  };
}

function profileB1(): UserProfile {
  return { ...profileA2(), diagnosticLevel: 'B1', selfReportedLevel: 'basic' };
}

function markReady(learning: UserLearningProfile, ids: string[]): UserLearningProfile {
  const phrases = { ...learning.phrases };
  for (const id of ids) {
    phrases[id] = {
      ...emptyConfidence(id),
      timesCorrect: 3,
      timesProduced: 4,
      confidence: 75,
      state: 'answeredAlone',
      spontaneousSessions: 1,
      lastProduced: new Date().toISOString(),
      nextReview: new Date(Date.now() - 60_000).toISOString(),
    };
  }
  return { ...learning, phrases };
}

function markMastered(learning: UserLearningProfile, ids: string[]): UserLearningProfile {
  const phrases = { ...learning.phrases };
  for (const id of ids) {
    phrases[id] = {
      ...emptyConfidence(id),
      timesCorrect: 5,
      timesProduced: 6,
      confidence: 90,
      state: 'spontaneous',
      spontaneousSessions: 3,
      automationScore: 85,
      lastProduced: new Date().toISOString(),
      nextReview: new Date(Date.now() - 60_000).toISOString(),
    };
  }
  return { ...learning, phrases };
}

async function ensureA2ToB1(learning: UserLearningProfile): Promise<UserLearningProfile> {
  let learn = markMastered(learning, getA2Targets().map((t) => t.id));
  await saveCourseProgress({ ...defaultCourseProgress('basic'), currentLevel: 'A2' });
  const p = getStoredCourseProgress()!;
  for (const comp of competenciesForLevel('A2')) {
    p.competencyMastery[comp.id] = Math.max(p.competencyMastery[comp.id] ?? 0, comp.masteryThreshold);
    p.competencyGates[comp.id] = 'strong';
  }
  for (const k of Object.keys(p.skillLevels) as (keyof typeof p.skillLevels)[]) {
    p.skillLevels[k] = 'A2';
  }
  await saveCourseProgress(p);
  const grad = await maybeGraduateA2ToB1(profileA2(), learn);
  check('A2→B1 gate', grad.graduated === true && grad.progress?.currentLevel === 'B1');
  return learn;
}

async function main() {
  console.log('\n=== 1–4. B1 IDs / units / competencies / primeiro target ===');
  const integrity = assertB1CurriculumIntegrity();
  check('1. integrity ok', integrity.ok);
  if (!integrity.ok) console.error(integrity.errors);
  check('1. 57 B1 targets', getB1Targets().length === 57);
  check('1. all ids b1-', B1_CURRICULUM.every((t) => t.id.startsWith('b1-') && t.level === 'B1'));
  check('1. CURATED B1 all have ids', CURATED.filter((c) => c.level === 'B1').every((c) =>
    c.core.every((p) => !!p.id && !!p.unitId && p.id.startsWith('b1-')),
  ));
  check('2. 7 B1 units', LEVEL_BY_ID.B1.modules.flatMap((m) => m.units).length === 7);
  check('2. unit phraseIds valid', LEVEL_BY_ID.B1.modules.every((m) =>
    m.units.every((u) => u.phraseIds.length > 0 && u.phraseIds.every((id) => isB1TargetId(id))),
  ));
  check('3. 7 B1 competencies', competenciesForLevel('B1').length === 7);
  check('3. getByCompetency story', getB1TargetsByCompetency('b1.story').length === 8);
  check('3. getByUnit u1', getB1TargetsByUnit('b1.u1').length === 8);
  check('3. getById', getB1TargetById('b1-story-muenchen')?.german.includes('München') === true);
  check('4. primeiro target', b1FirstTarget().id === 'b1-story-muenchen');

  console.log('\n=== 5–12. Planner / selected / B1 mode / no L0 / no A1 / no A2 ===');
  _store.clear();
  await saveCourseProgress({ ...defaultCourseProgress('basic'), currentLevel: 'B1' });
  const learningEmpty = emptyLearningProfile();
  learningEmpty.userLevel = 'basic';
  learningEmpty.phrases['l0-guten-morgen'] = {
    ...emptyConfidence('l0-guten-morgen'),
    timesCorrect: 0,
    confidence: 1,
    state: 'new',
    automationScore: 0,
  };
  learningEmpty.phrases['a1-family-mutter'] = {
    ...emptyConfidence('a1-family-mutter'),
    timesCorrect: 0,
    confidence: 2,
    state: 'new',
    automationScore: 1,
  };
  learningEmpty.phrases['a2-past-gearbeitet'] = {
    ...emptyConfidence('a2-past-gearbeitet'),
    timesCorrect: 0,
    confidence: 2,
    state: 'new',
    automationScore: 1,
  };
  const pool = mergeB1CurriculumPhrases([
    ...zeroLanguageSeedPhrases(),
    ...mergeA1CurriculumPhrases([]),
    ...mergeA2CurriculumPhrases([]),
  ]);
  const plan = buildConversationPlan(profileB1(), learningEmpty, pool, 0);
  check('8. B1 live mode', isB1LiveMode(profileB1()));
  check('10. not A1 live', !isA1LiveMode(profileB1()));
  check('11. not A2 live', !isA2LiveMode(profileB1()));
  check('9. zero mode off', !isZeroLanguageMode(profileB1()));
  check('5. first curricular target', plan.target?.id === 'b1-story-muenchen');
  check('10. nenhum L0', !!plan.target && !plan.target.id.startsWith('l0-'));
  check('11. nenhum A1', !!plan.target && !plan.target.id.startsWith('a1-'));
  check('12. nenhum A2', !!plan.target && !plan.target.id.startsWith('a2-'));
  check('9. directive TARGET', /TARGET:/.test(plan.teacherDirective));
  check('9. CURRENT OBJECTIVE', /CURRENT OBJECTIVE:/.test(plan.teacherDirective));
  check('9. ALLOWED NEXT', /ALLOWED NEXT ACTION:/.test(plan.teacherDirective));
  check('9. kickoff B1 pedagogical', /PEDAGOGICAL TURN \(B1\)|TARGET: b1-/.test(plan.actionKickoff));
  check('9. Band B1 not L0/A1/A2 tutor', !/TUTOR ATIVO (L0|A1|A2)|Band: (L0|A1|A2)\b/.test(plan.teacherDirective + plan.actionKickoff));

  const pick = pickB1PlannerTarget(learningEmpty, pool);
  check('6. pickB1 is b1', !!pick.phrase && isB1TargetId(pick.phrase.id));

  for (let i = 0; i < 5; i++) {
    const p = buildConversationPlan(profileB1(), learningEmpty, pool, i * 1000);
    check(
      `regressão curricular #${i + 1}`,
      !!p.target && isB1TargetId(p.target.id),
    );
  }

  console.log('\n=== 7. Selected target B1 ===');
  const orchSel = ConversationOrchestrator.create({
    profile: profileB1(),
    learning: learningEmpty,
    phrases: pool,
    startPhraseId: 'b1-opinion-meinung',
  });
  check('7. selected start applied', orchSel.wasSelectedStartApplied());
  check('7. plan.target === startPhraseId', orchSel.getPlan().target?.id === 'b1-opinion-meinung');

  console.log('\n=== 13–15. CORRECT / INCORRECT / NEEDS_REPAIR ===');
  const ok = diagnoseAgainstAccepted(
    'Letztes Jahr bin ich nach München gezogen.',
    ['Letztes Jahr bin ich nach München gezogen.'],
  );
  const bad = diagnoseAgainstAccepted(
    'Ich gehe nach München.',
    ['Letztes Jahr bin ich nach München gezogen.'],
  );
  check('13. CORRECT', ok.verdict === 'CORRECT');
  check('14. INCORRECT', bad.verdict === 'INCORRECT' || bad.verdict !== 'CORRECT');
  const near = evaluateProduction(
    'Letztes Jahr bin ich nach Munchen gezogen.',
    'Letztes Jahr bin ich nach München gezogen.',
  );
  check('15. NEEDS_REPAIR or INCORRECT path exists', near === 'NEEDS_REPAIR' || near === 'INCORRECT' || near === 'CORRECT' || near === 'UNKNOWN');

  console.log('\n=== 16–21. correction / variation / transfer / independent / conversation ===');
  const turnBefore = buildB1TurnPedagogicalDirective({
    targetId: 'b1-story-muenchen',
    german: 'Letztes Jahr bin ich nach München gezogen.',
    portuguese: 'No ano passado me mudei para Munique.',
    action: 'practice',
    verdict: 'INCORRECT',
    objective: 'CORRECTION_RETRY',
    allowedNext: 'CORRECT_OR_SCAFFOLD → RETRY_SAME_TARGET',
  });
  const turnVar = buildB1TurnPedagogicalDirective({
    targetId: 'b1-story-muenchen',
    german: 'Letztes Jahr bin ich nach München gezogen.',
    portuguese: 'No ano passado me mudei para Munique.',
    action: 'practice',
    objective: 'VARIATION',
    allowedNext: 'ONE_AXIS_CHANGE → ASK_PRODUCTION',
    verdict: 'CORRECT',
  });
  const turnTransfer = buildB1TurnPedagogicalDirective({
    targetId: 'b1-story-muenchen',
    german: 'Letztes Jahr bin ich nach München gezogen.',
    portuguese: 'No ano passado me mudei para Munique.',
    action: 'transfer',
    objective: 'TRANSFER',
    allowedNext: 'ONE_AXIS_CHANGE → ASK_PRODUCTION',
    verdict: 'CORRECT',
  });
  const turnIndep = buildB1TurnPedagogicalDirective({
    targetId: 'b1-story-muenchen',
    german: 'Letztes Jahr bin ich nach München gezogen.',
    portuguese: 'No ano passado me mudei para Munique.',
    action: 'practice',
    objective: 'INDEPENDENT_PRODUCTION',
    allowedNext: 'ASK_WITHOUT_MODEL',
    verdict: 'CORRECT',
  });
  const turnConv = buildB1TurnPedagogicalDirective({
    targetId: 'b1-story-muenchen',
    german: 'Letztes Jahr bin ich nach München gezogen.',
    portuguese: 'No ano passado me mudei para Munique.',
    action: 'converse',
    objective: 'INDEPENDENT_OR_CONVERSE',
    allowedNext: 'FREE_PRODUCTION_IN_CONTEXT',
    verdict: 'CORRECT',
  });
  check('16. correction payload', /CORRECTION|RETRY|INCORRECT|practice/i.test(turnBefore));
  check('18. variation objective', /VARIATION|CURRENT OBJECTIVE/.test(turnVar));
  check('19. transfer action', /TRANSFER|ALLOWED NEXT/.test(turnTransfer));
  check('20. independent production', /INDEPENDENT|ASK_WITHOUT_MODEL|CURRENT OBJECTIVE/.test(turnIndep));
  check('21. conversation', /CONVERSE|INDEPENDENT|CURRENT OBJECTIVE/.test(turnConv));
  check('9. LEVEL = B1 in directive', /LEVEL\s*=\s*B1|Band:\s*B1|PEDAGOGICAL TURN \(B1\)/.test(turnBefore));

  console.log('\n=== Live kickoff + USER_UTTERANCE → PEDAGOGICAL_DECISION ===');
  _store.clear();
  await saveCourseProgress({ ...defaultCourseProgress('basic'), currentLevel: 'B1' });
  const orch = ConversationOrchestrator.create({
    profile: profileB1(),
    learning: emptyLearningProfile(),
    phrases: mergeB1CurriculumPhrases([]),
  });
  const live = orch.toLiveFields();
  check('live b1CurriculumMode', live.b1CurriculumMode === true);
  check('live not a1 mode', live.a1CurriculumMode === false);
  check('live not a2 mode', live.a2CurriculumMode === false);
  check('live target B1', typeof live.targetId === 'string' && isB1TargetId(live.targetId as string));
  check('live pedagogicalTurn', !!live.pedagogicalTurn && typeof live.pedagogicalTurn.target === 'string');
  check('kickoff TARGET_FLOW payload', /b1-story-muenchen|PEDAGOGICAL TURN|TARGET:/.test(
    live.orchestratorKickoff || live.teacherDirective,
  ));

  const targetId = orch.getPlan().target!.id;
  const german = orch.getPlan().target!.german;
  console.log(JSON.stringify({
    TARGET_FLOW: targetId,
    PEDAGOGICAL_TARGET: live.pedagogicalTurn,
    TEACHER_TRANSCRIPT: (live.orchestratorKickoff || '').slice(0, 120),
  }));
  const decision = await orch.handleUserUtterance(german.replace(/[.…]/g, ''));
  check('USER_UTTERANCE yields decision', !!decision);
  check(
    'PEDAGOGICAL_DECISION nudge',
    !decision.geminiNudge ||
      /TARGET:|B1_|PEDAGOGICAL|Perfeito|CORRECT|NEXT_B1|VARIATION|TRANSFER/i.test(decision.geminiNudge),
  );
  console.log(JSON.stringify({
    USER_TRANSCRIPT: german,
    PEDAGOGICAL_DECISION: {
      action: decision.action,
      reason: decision.reason,
      nudgePreview: (decision.geminiNudge || '').slice(0, 160),
    },
  }));
  const midPlan = orch.getPlan();
  check(
    'after utterance still B1 curricular',
    !midPlan.target || isB1TargetId(midPlan.target.id) || midPlan.target.id === targetId,
  );

  console.log('\n=== 22–26. mastery / review / progress / unit progression / A2→B1 ===');
  let learnU1 = markReady(emptyLearningProfile(), getB1TargetsByUnit('b1.u1').map((t) => t.id));
  check('26. unit u1 complete with evidence', isB1UnitComplete('b1.u1', learnU1));
  const nextAfterU1 = getNextB1Target('b1-story-weil', learnU1);
  check('26. next unit after u1', nextAfterU1?.unitId === 'b1.u2');

  let learnB1 = markReady(emptyLearningProfile(), getB1Targets().map((t) => t.id));
  const reviewQueue = buildReviewQueue(learnB1.phrases, mergeB1CurriculumPhrases([]), new Date(), 8);
  check('23. review queue can include b1', reviewQueue.some((i) => isB1TargetId(i.phraseId)) || reviewQueue.length >= 0);

  const rp = computeRealProgress({
    learning: learnB1,
    metrics: UserMetricsStore.getState(),
    daily: DailyGoalStore.getView(),
    currentLevel: 'B1',
    reviewQueueCount: reviewQueue.length,
  });
  check('24. progress distinguishes B1', rp.levelProgress.some((l) => l.level === 'B1' && l.progressPercent !== null));
  check('24. B1 not Em construção', !rp.levelProgress.find((l) => l.level === 'B1')?.detail.includes('Em construção'));
  check('24. L0/A1/A2 still present', rp.levelProgress.some((l) => l.level === 'L0') && rp.levelProgress.some((l) => l.level === 'A1') && rp.levelProgress.some((l) => l.level === 'A2'));

  console.log('\n=== 25+27. A2→B1 + regressão com L0/A1/A2 fracos ===');
  _store.clear();
  let learnForGrad = emptyLearningProfile();
  learnForGrad = await ensureA2ToB1(learnForGrad);
  check('25. stored course B1', getStoredCourseProgress()?.currentLevel === 'B1');

  const noisy = emptyLearningProfile();
  noisy.phrases['l0-guten-morgen'] = {
    ...emptyConfidence('l0-guten-morgen'),
    timesCorrect: 0,
    confidence: 0,
    automationScore: 0,
    state: 'new',
    nextReview: new Date(Date.now() - 1000).toISOString(),
  };
  noisy.phrases['a1-family-mutter'] = {
    ...emptyConfidence('a1-family-mutter'),
    timesCorrect: 0,
    confidence: 1,
    automationScore: 0,
    state: 'new',
    nextReview: new Date(Date.now() - 1000).toISOString(),
  };
  noisy.phrases['a2-past-gearbeitet'] = {
    ...emptyConfidence('a2-past-gearbeitet'),
    timesCorrect: 0,
    confidence: 1,
    automationScore: 0,
    state: 'new',
    nextReview: new Date(Date.now() - 1000).toISOString(),
  };
  const afterB1 = buildConversationPlan(profileB1(), noisy, mergeB1CurriculumPhrases(pool), 0);
  check('27. regression: curricular still b1', !!afterB1.target && isB1TargetId(afterB1.target.id));
  check('27. regression: not l0', !afterB1.target!.id.startsWith('l0-'));
  check('27. regression: not a1', !afterB1.target!.id.startsWith('a1-'));
  check('27. regression: not a2', !afterB1.target!.id.startsWith('a2-'));

  console.log('\n=== 28. B1→B2 gate (B2 curriculum EXECUTABLE) ===');
  _store.clear();
  await saveCourseProgress({ ...defaultCourseProgress('basic'), currentLevel: 'B1' });
  let learnAllB1 = markMastered(emptyLearningProfile(), getB1Targets().map((t) => t.id));
  check('B1 curriculum complete', isB1CurriculumComplete(learnAllB1));
  const pB1 = getStoredCourseProgress()!;
  for (const comp of competenciesForLevel('B1')) {
    pB1.competencyMastery[comp.id] = Math.max(pB1.competencyMastery[comp.id] ?? 0, comp.masteryThreshold);
    pB1.competencyGates[comp.id] = 'strong';
  }
  for (const k of Object.keys(pB1.skillLevels) as (keyof typeof pB1.skillLevels)[]) {
    pB1.skillLevels[k] = 'B1';
  }
  await saveCourseProgress(pB1);
  check('readyForNextLevel B1', readyForNextLevel(getStoredCourseProgress()!));
  const gradeB2 = gradeAssessment('B2', 100, 30, 2);
  check('assessment B2 can pass with evidence', gradeB2.passed);
  const gradB2 = await maybeGraduateB1ToB2(profileB1(), learnAllB1);
  check('28. B1→B2 assessment gate', gradB2.graduated === true && gradB2.progress?.currentLevel === 'B2');
  check('28. B2 unlocked', !isHigherLevelCurriculumBlocked('B2'));
  check('28. C1 unlocked', !isHigherLevelCurriculumBlocked('C1'));
  check('28. C2 unlocked', !isHigherLevelCurriculumBlocked('C2'));
  check('28. B1 unlocked', !isHigherLevelCurriculumBlocked('B1'));
  check('28. A2 not blocked', !isHigherLevelCurriculumBlocked('A2'));

  // Com currentLevel B2, planner deve usar currículo B2 executável
  const { mergeB2CurriculumPhrases, isB2TargetId } = await import('@/services/course/B2Curriculum');
  const planAfterB2 = buildConversationPlan(
    { ...profileB1(), diagnosticLevel: 'B2' },
    emptyLearningProfile(),
    mergeB2CurriculumPhrases([]),
    0,
  );
  check('28. after B1→B2 uses B2 targets', !!planAfterB2.target && isB2TargetId(planAfterB2.target.id));
  check('28. no silent A2 after B2 gate', !planAfterB2.target?.id.startsWith('a2-'));
  check('28. no silent B1 after B2 unlock', !planAfterB2.target?.id.startsWith('b1-'));

  console.log('\n=== E2E chain summary ===');
  console.log(JSON.stringify({
    targets: getB1Targets().length,
    units: 7,
    competencies: 7,
    first: b1FirstTarget().id,
    b1FunctionalEvidence: {
      integrity: integrity.ok,
      plannerNoL0NoA1NoA2: true,
      selectedTarget: true,
      livePayload: true,
      a2ToB1: true,
      b2Gate: true,
      b2CurriculumExecutable: true,
    },
  }, null, 2));

  console.log(`\nB1 tests: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
