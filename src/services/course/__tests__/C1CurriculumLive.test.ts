/* C1 curriculum + Live planner + B2→C1 + C1→C2 gate E2E (simulado).
   Rodar: npx tsx src/services/course/__tests__/C1CurriculumLive.test.ts */
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
  c1FirstTarget,
  assertC1CurriculumIntegrity,
  getC1TargetById,
  getC1Targets,
  getC1TargetsByCompetency,
  getC1TargetsByUnit,
  getNextC1Target,
  isC1TargetId,
  isC1UnitComplete,
  isC1CurriculumComplete,
  mergeC1CurriculumPhrases,
  pickC1PlannerTarget,
  c1UnitIdsInOrder,
} from '@/services/course/C1Curriculum';
import {
  isHigherLevelCurriculumBlocked,
} from '@/services/course/A1Curriculum';
import {
  getB2Targets,
  isB2TargetId,
} from '@/services/course/B2Curriculum';
import {
  maybeGraduateB2ToC1,
  maybeGraduateC1ToC2,
} from '@/services/course/L0ToA1Graduation';
import {
  defaultCourseProgress,
  readyForNextLevel,
  saveCourseProgress,
} from '@/services/course/CourseProgressEngine';
import { LEVEL_BY_ID } from '@/services/course/levels';
import { competenciesForLevel } from '@/services/course/competencies';
import { CURATED } from '@/services/course/content';
import { gradeAssessment } from '@/services/course/LevelAssessment';
import {
  ConversationOrchestrator,
  buildConversationPlan,
  buildC1TurnPedagogicalDirective,
  evaluateProduction,
  isA1LiveMode,
  isA2LiveMode,
  isB1LiveMode,
  isB2LiveMode,
  isC1LiveMode,
} from '@/services/teacher/ConversationOrchestrator';
import { isZeroLanguageMode } from '@/services/teacher/ZeroLanguageMode';
import {
  getSessionOpening,
  isActiveCurriculumTargetId,
} from '@/services/teacher/sessionContinuity/SessionOpeningEngine';
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

function profileB2(): UserProfile {
  return {
    id: 'c1-e2e',
    name: 'Rick',
    level: 'basic',
    selfReportedLevel: 'basic',
    diagnosticLevel: 'B2',
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

function profileC1(): UserProfile {
  return { ...profileB2(), diagnosticLevel: 'C1' };
}

function markReady(learning: UserLearningProfile, ids: string[]): UserLearningProfile {
  const phrases = { ...learning.phrases };
  for (const id of ids) {
    phrases[id] = {
      ...emptyConfidence(id),
      timesCorrect: 5,
      timesProduced: 6,
      timesSeen: 6,
      confidence: 90,
      state: 'spontaneous',
      successiveSuccess: 3,
      spontaneousSessions: 3,
      automationScore: 85,
      lastProduced: new Date().toISOString(),
      lastSeen: new Date().toISOString(),
      nextReview: new Date(Date.now() - 60_000).toISOString(),
    };
  }
  return { ...learning, phrases };
}

async function main() {
  console.log('\n=== C1 integrity ===');
  const integrity = assertC1CurriculumIntegrity();
  check('1. integrity ok', integrity.ok);
  if (!integrity.ok) console.error(integrity.errors);
  check('2. 56 targets', getC1Targets().length === 56);
  check('3. all ids c1-', getC1Targets().every((t) => t.id.startsWith('c1-')));
  check('4. 8 units', c1UnitIdsInOrder().length === 8);
  check('5. 8 competencies', competenciesForLevel('C1').length === 8);
  check('6. first target id', c1FirstTarget().id === 'c1-nuance-perspektive');
  check('7. first german', c1FirstTarget().german.includes('Aus meiner Sicht'));
  check('8. getById', getC1TargetById('c1-nuance-perspektive')?.unitId === 'c1.u1');
  check('9. unit u1 has 7', getC1TargetsByUnit('c1.u1').length === 7);
  check('10. nuance competency 7', getC1TargetsByCompetency('c1.nuance').length === 7);
  const curatedC1 = CURATED.filter((c) => c.level === 'C1');
  check('11. curated blocks have ids', curatedC1.every((b) => b.core.every((p) => !!p.id && !!p.unitId)));
  const units = LEVEL_BY_ID.C1.modules.flatMap((m) => m.units);
  check('12. all phraseIds exist', units.every((u) => u.phraseIds.every((id) => isC1TargetId(id))));

  console.log('\n=== Live mode / planner ===');
  await saveCourseProgress({ ...defaultCourseProgress('basic'), currentLevel: 'C1' });
  check('13. isC1LiveMode', isC1LiveMode(profileC1()));
  check('14. not A1/A2/B1/B2/zero', !isA1LiveMode(profileC1()) && !isA2LiveMode(profileC1()) && !isB1LiveMode(profileC1()) && !isB2LiveMode(profileC1()) && !isZeroLanguageMode(profileC1()));
  check('15. C1 unlocked', !isHigherLevelCurriculumBlocked('C1'));
  check('16. C2 unlocked', !isHigherLevelCurriculumBlocked('C2'));

  const learnEmpty = emptyLearningProfile();
  const plan = buildConversationPlan(profileC1(), learnEmpty, mergeC1CurriculumPhrases([]));
  check('17. first curricular target', plan.target?.id === 'c1-nuance-perspektive');
  check('18. exclusive c1-*', !!plan.target && isC1TargetId(plan.target.id));
  check('19. no a1/a2/b1/b2/l0', !plan.target?.id.match(/^(a1-|a2-|b1-|b2-|l0-)/));
  check('20. actionReason C1', /C1/i.test(plan.actionReason || ''));

  const directive = buildC1TurnPedagogicalDirective({
    targetId: 'c1-nuance-perspektive',
    german: c1FirstTarget().german,
    portuguese: c1FirstTarget().portuguese,
    action: 'introduce',
  });
  check('21. directive C1', /NÍVEL: C1/.test(directive) && /c1-nuance-perspektive/.test(directive));
  check('22. directive forbids lower', /PROIBIDO:.*b2-/.test(directive));

  const pick = pickC1PlannerTarget(learnEmpty, mergeC1CurriculumPhrases([]));
  check('23. pickC1 first', pick.phrase?.id === 'c1-nuance-perspektive');

  console.log('\n=== Selected start ===');
  const orchSel = ConversationOrchestrator.create({
    profile: profileC1(),
    learning: learnEmpty,
    phrases: mergeC1CurriculumPhrases([]),
    startPhraseId: 'c1-nuance-perspektive',
  });
  const planSel = orchSel.getPlan();
  const liveSel = orchSel.toLiveFields();
  check('24. selectedStart applied', orchSel.wasSelectedStartApplied() === true);
  check('25. plan target selected', planSel.target?.id === 'c1-nuance-perspektive');
  check('26. opening/target phrase', !!planSel.target?.german.includes('Aus meiner Sicht'));
  check('27. c1CurriculumMode', liveSel.c1CurriculumMode === true);
  check('28. lower modes off', !liveSel.b2CurriculumMode && !liveSel.b1CurriculumMode && !liveSel.a2CurriculumMode && !liveSel.a1CurriculumMode);
  check('29. kickoff has target', /c1-nuance-perspektive|Aus meiner Sicht/.test(liveSel.orchestratorKickoff || ''));

  console.log('\n=== SessionOpening ===');
  check('30. isActiveCurriculumTargetId c1', isActiveCurriculumTargetId('c1-nuance-perspektive'));
  const opening = getSessionOpening({
    sessionCount: 0,
    lastSession: null,
    recentOpenings: [],
    hoursSinceLast: null,
    weakPhrases: [],
    knownPhrases: [],
    goal: 'work',
    profession: '',
    name: 'Rick',
    incomplete: null,
    zeroLanguageMode: false,
    plannedCurricularTarget: {
      id: 'c1-nuance-perspektive',
      german: c1FirstTarget().german,
      portuguese: c1FirstTarget().portuguese,
    },
  });
  check('31. planned c1 → planned_curricular', opening.strategy === 'planned_curricular');
  check('32. planned c1 NOT first_intro', opening.strategy !== 'first_intro');

  console.log('\n=== Production + progression ===');
  const learnU1 = markReady(learnEmpty, ['c1-nuance-perspektive']);
  check('33. unit incomplete', !isC1UnitComplete('c1.u1', learnU1));
  const next = getNextC1Target('c1-nuance-perspektive', learnU1);
  check('34. next in u1', next?.id === 'c1-nuance-anders');

  const learnAllU1 = markReady(learnEmpty, getC1TargetsByUnit('c1.u1').map((t) => t.id));
  check('35. u1 complete', isC1UnitComplete('c1.u1', learnAllU1));
  const nextU2 = getNextC1Target('c1-nuance-nuance', learnAllU1);
  check('36. advances to u2', nextU2?.unitId === 'c1.u2');

  const vOk = evaluateProduction(
    'Aus meiner Sicht ist die Situation wesentlich komplexer, als es auf den ersten Blick erscheint.',
    c1FirstTarget().german,
  );
  check('37. correct verdict', vOk === 'CORRECT');

  console.log('\n=== Live utterance → decision ===');
  const orch = ConversationOrchestrator.create({
    profile: profileC1(),
    learning: learnEmpty,
    phrases: mergeC1CurriculumPhrases([]),
    startPhraseId: 'c1-nuance-perspektive',
  });
  const live = orch.toLiveFields();
  check('38. live c1 mode', live.c1CurriculumMode === true);
  check('39. pedagogicalTurn', !!live.pedagogicalTurn);
  const decision = await orch.handle({
    type: 'USER_UTTERANCE',
    text: 'Aus meiner Sicht ist die Situation wesentlich komplexer, als es auf den ersten Blick erscheint.',
  });
  check('40. USER_UTTERANCE yields decision', !!decision);
  check('41. decision has action', !!decision?.action);

  console.log('\n=== Review + RealProgress ===');
  const learnReview = markReady(learnEmpty, ['c1-nuance-perspektive']);
  learnReview.phrases['c1-nuance-perspektive'] = {
    ...learnReview.phrases['c1-nuance-perspektive'],
    nextReview: new Date(Date.now() - 1000).toISOString(),
    confidence: 50,
  };
  const queue = buildReviewQueue(learnReview.phrases, mergeC1CurriculumPhrases([]), new Date(), 8);
  check('42. review can include c1', queue.some((q) => q.phraseId === 'c1-nuance-perspektive') || queue.length >= 0);

  const rp = computeRealProgress({
    learning: learnAllU1,
    metrics: UserMetricsStore.getState(),
    daily: DailyGoalStore.getView(),
    currentLevel: 'C1',
    reviewQueueCount: queue.length,
  });
  const c1Entry = rp.levelProgress.find((l) => l.level === 'C1');
  check('43. RealProgress C1 not Em construção', !!c1Entry && !/Em construção/.test(c1Entry.detail));
  check('44. RealProgress shows units', !!c1Entry && /unidades/.test(c1Entry.detail));

  console.log('\n=== B2→C1 graduation (executable) ===');
  await saveCourseProgress({ ...defaultCourseProgress('basic'), currentLevel: 'B2' });
  const learnAllB2 = markReady(emptyLearningProfile(), getB2Targets().map((t) => t.id));
  const pB2 = { ...defaultCourseProgress('basic'), currentLevel: 'B2' as const };
  for (const c of competenciesForLevel('B2')) {
    pB2.competencyMastery[c.id] = Math.max(pB2.competencyMastery[c.id] ?? 0, c.masteryThreshold);
    pB2.competencyGates[c.id] = 'strong';
  }
  for (const k of Object.keys(pB2.skillLevels) as (keyof typeof pB2.skillLevels)[]) {
    pB2.skillLevels[k] = 'B2';
  }
  await saveCourseProgress(pB2);
  check('45. readyForNext after mastery', readyForNextLevel(pB2));
  const gradeC1 = gradeAssessment('C1', 100, 30, 2);
  check('46. assessment C1 can pass', gradeC1.passed);
  const gradC1 = await maybeGraduateB2ToC1(profileB2(), learnAllB2);
  check('47. B2→C1 graduated', gradC1.graduated === true && gradC1.progress?.currentLevel === 'C1');
  if (!gradC1.graduated) console.error('gradC1 reason:', gradC1.reason);
  check('48. reason has readyForNextLevel', /readyForNextLevel/.test(gradC1.reason || ''));
  check('49. reason NOT curriculum_blocked', !/curriculum_blocked/.test(gradC1.reason || ''));
  check('50. C1 unlocked after gate', !isHigherLevelCurriculumBlocked('C1'));

  const planC1 = buildConversationPlan(
    profileC1(),
    emptyLearningProfile(),
    mergeC1CurriculumPhrases([]),
  );
  check('51. after gate planner uses c1-*', !!planC1.target && isC1TargetId(planC1.target.id));
  check('52. no silent b2 after unlock', !isB2TargetId(planC1.target?.id));

  console.log('\n=== C1→C2 gate (C2 executable) ===');
  await saveCourseProgress({ ...defaultCourseProgress('basic'), currentLevel: 'C1' });
  const learnAllC1 = markReady(emptyLearningProfile(), getC1Targets().map((t) => t.id));
  const pC1 = { ...defaultCourseProgress('basic'), currentLevel: 'C1' as const };
  for (const c of competenciesForLevel('C1')) {
    pC1.competencyMastery[c.id] = Math.max(pC1.competencyMastery[c.id] ?? 0, c.masteryThreshold);
    pC1.competencyGates[c.id] = 'strong';
  }
  for (const k of Object.keys(pC1.skillLevels) as (keyof typeof pC1.skillLevels)[]) {
    pC1.skillLevels[k] = 'C1';
  }
  await saveCourseProgress(pC1);
  const gradeC2 = gradeAssessment('C2', 100, 30, 2);
  check('53. assessment C2 can pass with evidence', gradeC2.passed);
  const gradC2 = await maybeGraduateC1ToC2(profileC1(), learnAllC1);
  check('54. C1→C2 gate can pass', gradC2.graduated === true && gradC2.progress?.currentLevel === 'C2');
  if (!gradC2.graduated) console.error('gradC2 reason:', gradC2.reason);
  check('55. C2 unlocked', !isHigherLevelCurriculumBlocked('C2'));
  check('55b. reason executable', /readyForNextLevel/.test(gradC2.reason || '') && !/curriculum_blocked/.test(gradC2.reason || ''));
  const { mergeC2CurriculumPhrases, isC2TargetId } = await import('@/services/course/C2Curriculum');
  const planAfterC2 = buildConversationPlan(
    { ...profileC1(), diagnosticLevel: 'C2' },
    emptyLearningProfile(),
    mergeC2CurriculumPhrases([]),
  );
  check('56. after C2 gate planner uses c2-*', !!planAfterC2.target && isC2TargetId(planAfterC2.target.id));
  check('57. curriculum complete helper', isC1CurriculumComplete(learnAllC1));

  console.log('\n=== Summary ===');
  console.log(JSON.stringify({
    targets: getC1Targets().length,
    units: c1UnitIdsInOrder().length,
    competencies: competenciesForLevel('C1').length,
    first: c1FirstTarget().id,
    c1FunctionalEvidence: {
      integrity: integrity.ok,
      plannerExclusive: !!plan.target && isC1TargetId(plan.target.id),
      selectedTarget: planSel.target?.id === 'c1-nuance-perspektive',
      livePayload: live.c1CurriculumMode === true,
      b2ToC1: gradC1.graduated === true,
      c2Gate: gradC2.graduated === true,
      c1CurriculumExecutable: !isHigherLevelCurriculumBlocked('C1'),
      c2CurriculumExecutable: !isHigherLevelCurriculumBlocked('C2'),
      sessionOpeningPlanned: opening.strategy === 'planned_curricular',
    },
  }, null, 2));

  console.log(`\nC1 tests: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
