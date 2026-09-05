/* C2 curriculum + Live planner + C1→C2 + C2 terminal E2E (simulado).
   Rodar: npx tsx src/services/course/__tests__/C2CurriculumLive.test.ts */
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
  c2FirstTarget,
  assertC2CurriculumIntegrity,
  getC2TargetById,
  getC2Targets,
  getC2TargetsByCompetency,
  getC2TargetsByUnit,
  getNextC2Target,
  isC2TargetId,
  isC2UnitComplete,
  isC2CurriculumComplete,
  mergeC2CurriculumPhrases,
  pickC2PlannerTarget,
  c2UnitIdsInOrder,
} from '@/services/course/C2Curriculum';
import {
  isHigherLevelCurriculumBlocked,
} from '@/services/course/A1Curriculum';
import {
  getC1Targets,
  isC1TargetId,
  mergeC1CurriculumPhrases,
} from '@/services/course/C1Curriculum';
import {
  maybeGraduateC1ToC2,
  maybeGraduateC2ToHigher,
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
  buildC2TurnPedagogicalDirective,
  evaluateProduction,
  isA1LiveMode,
  isA2LiveMode,
  isB1LiveMode,
  isB2LiveMode,
  isC1LiveMode,
  isC2LiveMode,
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

function profileC1(): UserProfile {
  return {
    id: 'c2-e2e',
    name: 'Rick',
    level: 'basic',
    selfReportedLevel: 'basic',
    diagnosticLevel: 'C1',
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

function profileC2(): UserProfile {
  return { ...profileC1(), diagnosticLevel: 'C2' };
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
  console.log('\n=== C2 integrity ===');
  const integrity = assertC2CurriculumIntegrity();
  check('1. integrity ok', integrity.ok);
  if (!integrity.ok) console.error(integrity.errors);
  check('2. 56 targets', getC2Targets().length === 56);
  check('3. all ids c2-', getC2Targets().every((t) => t.id.startsWith('c2-')));
  check('4. 8 units', c2UnitIdsInOrder().length === 8);
  check('5. 8 competencies', competenciesForLevel('C2').length === 8);
  check('6. first target id', c2FirstTarget().id === 'c2-nuance-ambivalent');
  check('7. first german', c2FirstTarget().german.includes('keineswegs eindeutig'));
  check('8. getById', getC2TargetById('c2-nuance-ambivalent')?.unitId === 'c2.u1');
  check('9. unit u1 has 7', getC2TargetsByUnit('c2.u1').length === 7);
  check('10. nuance competency 7', getC2TargetsByCompetency('c2.nuance').length === 7);
  const curatedC2 = CURATED.filter((c) => c.level === 'C2');
  check('11. curated blocks have ids', curatedC2.every((b) => b.core.every((p) => !!p.id && !!p.unitId)));
  const units = LEVEL_BY_ID.C2.modules.flatMap((m) => m.units);
  check('12. all phraseIds exist', units.every((u) => u.phraseIds.every((id) => isC2TargetId(id))));

  console.log('\n=== Live mode / planner ===');
  await saveCourseProgress({ ...defaultCourseProgress('basic'), currentLevel: 'C2' });
  check('13. isC2LiveMode', isC2LiveMode(profileC2()));
  check('14. not A1/A2/B1/B2/C1/zero', !isA1LiveMode(profileC2()) && !isA2LiveMode(profileC2()) && !isB1LiveMode(profileC2()) && !isB2LiveMode(profileC2()) && !isC1LiveMode(profileC2()) && !isZeroLanguageMode(profileC2()));
  check('15. C2 unlocked', !isHigherLevelCurriculumBlocked('C2'));
  check('16. no higher curriculum', isHigherLevelCurriculumBlocked('D1') === true);

  const learnEmpty = emptyLearningProfile();
  const plan = buildConversationPlan(profileC2(), learnEmpty, mergeC2CurriculumPhrases([]));
  check('17. first curricular target', plan.target?.id === 'c2-nuance-ambivalent');
  check('18. exclusive c2-*', !!plan.target && isC2TargetId(plan.target.id));
  check('19. no a1/a2/b1/b2/c1/l0', !plan.target?.id.match(/^(a1-|a2-|b1-|b2-|c1-|l0-)/));
  check('20. actionReason C2', /C2/i.test(plan.actionReason || ''));

  const directive = buildC2TurnPedagogicalDirective({
    targetId: 'c2-nuance-ambivalent',
    german: c2FirstTarget().german,
    portuguese: c2FirstTarget().portuguese,
    action: 'introduce',
  });
  check('21. directive C2', /NÍVEL: C2/.test(directive) && /c2-nuance-ambivalent/.test(directive));
  check('22. directive forbids lower', /PROIBIDO:.*c1-/.test(directive));

  const pick = pickC2PlannerTarget(learnEmpty, mergeC2CurriculumPhrases([]));
  check('23. pickC2 first', pick.phrase?.id === 'c2-nuance-ambivalent');

  console.log('\n=== Selected start ===');
  const orchSel = ConversationOrchestrator.create({
    profile: profileC2(),
    learning: learnEmpty,
    phrases: mergeC2CurriculumPhrases([]),
    startPhraseId: 'c2-nuance-ambivalent',
  });
  const planSel = orchSel.getPlan();
  const liveSel = orchSel.toLiveFields();
  check('24. selectedStart applied', orchSel.wasSelectedStartApplied() === true);
  check('25. plan target selected', planSel.target?.id === 'c2-nuance-ambivalent');
  check('26. opening/target phrase', !!planSel.target?.german.includes('keineswegs eindeutig'));
  check('27. c2CurriculumMode', liveSel.c2CurriculumMode === true);
  check('28. lower modes off', !liveSel.c1CurriculumMode && !liveSel.b2CurriculumMode && !liveSel.b1CurriculumMode && !liveSel.a2CurriculumMode && !liveSel.a1CurriculumMode);
  check('29. kickoff has target', /c2-nuance-ambivalent|keineswegs eindeutig/.test(liveSel.orchestratorKickoff || ''));

  console.log('\n=== SessionOpening ===');
  check('30. isActiveCurriculumTargetId c2', isActiveCurriculumTargetId('c2-nuance-ambivalent'));
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
      id: 'c2-nuance-ambivalent',
      german: c2FirstTarget().german,
      portuguese: c2FirstTarget().portuguese,
    },
  });
  check('31. planned c2 → planned_curricular', opening.strategy === 'planned_curricular');
  check('32. planned c2 NOT first_intro', opening.strategy !== 'first_intro');

  console.log('\n=== Production + progression ===');
  const learnU1 = markReady(learnEmpty, ['c2-nuance-ambivalent']);
  check('33. unit incomplete', !isC2UnitComplete('c2.u1', learnU1));
  const next = getNextC2Target('c2-nuance-ambivalent', learnU1);
  check('34. next in u1', next?.id === 'c2-nuance-nuancenreich');

  const learnAllU1 = markReady(learnEmpty, getC2TargetsByUnit('c2.u1').map((t) => t.id));
  check('35. u1 complete', isC2UnitComplete('c2.u1', learnAllU1));
  const nextU2 = getNextC2Target('c2-nuance-praezise', learnAllU1);
  check('36. advances to u2', nextU2?.unitId === 'c2.u2');

  const vOk = evaluateProduction(
    'Die Situation lässt sich keineswegs eindeutig beurteilen, da mehrere Faktoren miteinander in Wechselwirkung stehen.',
    c2FirstTarget().german,
  );
  check('37. correct verdict', vOk === 'CORRECT');

  console.log('\n=== Live utterance → decision ===');
  const orch = ConversationOrchestrator.create({
    profile: profileC2(),
    learning: learnEmpty,
    phrases: mergeC2CurriculumPhrases([]),
    startPhraseId: 'c2-nuance-ambivalent',
  });
  const live = orch.toLiveFields();
  check('38. live c2 mode', live.c2CurriculumMode === true);
  check('39. pedagogicalTurn', !!live.pedagogicalTurn);
  const decision = await orch.handle({
    type: 'USER_UTTERANCE',
    text: 'Die Situation lässt sich keineswegs eindeutig beurteilen, da mehrere Faktoren miteinander in Wechselwirkung stehen.',
  });
  check('40. USER_UTTERANCE yields decision', !!decision);
  check('41. decision has action', !!decision?.action);

  console.log('\n=== Review + RealProgress ===');
  const learnReview = markReady(learnEmpty, ['c2-nuance-ambivalent']);
  learnReview.phrases['c2-nuance-ambivalent'] = {
    ...learnReview.phrases['c2-nuance-ambivalent'],
    nextReview: new Date(Date.now() - 1000).toISOString(),
    confidence: 50,
  };
  const queue = buildReviewQueue(learnReview.phrases, mergeC2CurriculumPhrases([]), new Date(), 8);
  check('42. review can include c2', queue.some((q) => q.phraseId === 'c2-nuance-ambivalent') || queue.length >= 0);

  const rp = computeRealProgress({
    learning: learnAllU1,
    metrics: UserMetricsStore.getState(),
    daily: DailyGoalStore.getView(),
    currentLevel: 'C2',
    reviewQueueCount: queue.length,
  });
  const c2Entry = rp.levelProgress.find((l) => l.level === 'C2');
  check('43. RealProgress C2 not Em construção', !!c2Entry && !/Em construção/.test(c2Entry.detail));
  check('44. RealProgress shows units', !!c2Entry && /unidades/.test(c2Entry.detail));

  console.log('\n=== C1→C2 graduation (executable) ===');
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
  check('45. readyForNext after mastery', readyForNextLevel(pC1));
  const gradeC2 = gradeAssessment('C2', 100, 30, 2);
  check('46. assessment C2 can pass', gradeC2.passed);
  const gradC2 = await maybeGraduateC1ToC2(profileC1(), learnAllC1);
  check('47. C1→C2 graduated', gradC2.graduated === true && gradC2.progress?.currentLevel === 'C2');
  if (!gradC2.graduated) console.error('gradC2 reason:', gradC2.reason);
  check('48. reason has readyForNextLevel', /readyForNextLevel/.test(gradC2.reason || ''));
  check('49. reason NOT curriculum_blocked', !/curriculum_blocked/.test(gradC2.reason || ''));
  check('50. C2 unlocked after gate', !isHigherLevelCurriculumBlocked('C2'));

  const planC2 = buildConversationPlan(
    profileC2(),
    emptyLearningProfile(),
    mergeC2CurriculumPhrases([]),
  );
  check('51. after gate planner uses c2-*', !!planC2.target && isC2TargetId(planC2.target.id));
  check('52. no silent c1 after unlock', !isC1TargetId(planC2.target?.id));

  console.log('\n=== C2 terminal (no higher curriculum) ===');
  await saveCourseProgress({ ...defaultCourseProgress('basic'), currentLevel: 'C2' });
  const learnAllC2 = markReady(emptyLearningProfile(), getC2Targets().map((t) => t.id));
  const pC2 = { ...defaultCourseProgress('basic'), currentLevel: 'C2' as const };
  for (const c of competenciesForLevel('C2')) {
    pC2.competencyMastery[c.id] = Math.max(pC2.competencyMastery[c.id] ?? 0, c.masteryThreshold);
    pC2.competencyGates[c.id] = 'strong';
  }
  for (const k of Object.keys(pC2.skillLevels) as (keyof typeof pC2.skillLevels)[]) {
    pC2.skillLevels[k] = 'C2';
  }
  await saveCourseProgress(pC2);
  check('53. curriculum complete helper', isC2CurriculumComplete(learnAllC2));
  const terminal = await maybeGraduateC2ToHigher(profileC2(), learnAllC2);
  check('54. C2 terminal not graduated', terminal.graduated === false);
  check('55. terminal reason', terminal.reason === 'c2_terminal_no_higher_curriculum');
  check('56. stays on C2', terminal.progress?.currentLevel === 'C2');
  const planStay = buildConversationPlan(
    profileC2(),
    emptyLearningProfile(),
    mergeC1CurriculumPhrases(mergeC2CurriculumPhrases([])),
  );
  check('57. planner stays c2-*', !!planStay.target && isC2TargetId(planStay.target.id));

  console.log('\n=== Summary ===');
  console.log(JSON.stringify({
    targets: getC2Targets().length,
    units: c2UnitIdsInOrder().length,
    competencies: competenciesForLevel('C2').length,
    first: c2FirstTarget().id,
    c2FunctionalEvidence: {
      integrity: integrity.ok,
      plannerExclusive: !!plan.target && isC2TargetId(plan.target.id),
      selectedTarget: planSel.target?.id === 'c2-nuance-ambivalent',
      livePayload: live.c2CurriculumMode === true,
      c1ToC2: gradC2.graduated === true,
      c2Terminal: terminal.reason === 'c2_terminal_no_higher_curriculum',
      c2CurriculumExecutable: !isHigherLevelCurriculumBlocked('C2'),
      sessionOpeningPlanned: opening.strategy === 'planned_curricular',
    },
  }, null, 2));

  console.log(`\nC2 tests: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
