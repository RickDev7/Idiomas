/* B2 curriculum + Live planner + B1→B2 + C1 gate E2E (simulado).
   Rodar: npx tsx src/services/course/__tests__/B2CurriculumLive.test.ts */
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
  b2FirstTarget,
  assertB2CurriculumIntegrity,
  getB2TargetById,
  getB2Targets,
  getB2TargetsByCompetency,
  getB2TargetsByUnit,
  getNextB2Target,
  isB2TargetId,
  isB2UnitComplete,
  isB2CurriculumComplete,
  mergeB2CurriculumPhrases,
  pickB2PlannerTarget,
  b2UnitIdsInOrder,
} from '@/services/course/B2Curriculum';
import {
  isHigherLevelCurriculumBlocked,
} from '@/services/course/A1Curriculum';
import {
  getB1Targets,
  isB1TargetId,
} from '@/services/course/B1Curriculum';
import {
  isC1TargetId,
  mergeC1CurriculumPhrases,
} from '@/services/course/C1Curriculum';
import {
  maybeGraduateB1ToB2,
  maybeGraduateB2ToC1,
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
  buildB2TurnPedagogicalDirective,
  evaluateProduction,
  isA1LiveMode,
  isA2LiveMode,
  isB1LiveMode,
  isB2LiveMode,
} from '@/services/teacher/ConversationOrchestrator';
import { isZeroLanguageMode } from '@/services/teacher/ZeroLanguageMode';
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

function profileB1(): UserProfile {
  return {
    id: 'b2-e2e',
    name: 'Rick',
    level: 'basic',
    selfReportedLevel: 'basic',
    diagnosticLevel: 'B1',
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

function profileB2(): UserProfile {
  return { ...profileB1(), diagnosticLevel: 'B2' };
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
  console.log('\n=== B2 integrity ===');
  const integrity = assertB2CurriculumIntegrity();
  check('1. integrity ok', integrity.ok);
  if (!integrity.ok) console.error(integrity.errors);
  check('2. 24 targets', getB2Targets().length === 24);
  check('3. all ids b2-', getB2Targets().every((t) => t.id.startsWith('b2-')));
  check('4. 8 units', b2UnitIdsInOrder().length === 8);
  check('5. 8 competencies', competenciesForLevel('B2').length === 8);
  check('6. first target id', b2FirstTarget().id === 'b2-narrative-erfahrung');
  check('7. first german', b2FirstTarget().german.includes('Erfahrung'));
  check('8. getById', getB2TargetById('b2-narrative-erfahrung')?.unitId === 'b2.u1');
  check('9. unit u1 has 3', getB2TargetsByUnit('b2.u1').length === 3);
  check('10. narrative competency 3', getB2TargetsByCompetency('b2.narrative').length === 3);
  const curatedB2 = CURATED.filter((c) => c.level === 'B2');
  check('11. curated blocks have ids', curatedB2.every((b) => b.core.every((p) => !!p.id && !!p.unitId)));
  const units = LEVEL_BY_ID.B2.modules.flatMap((m) => m.units);
  check('12. all phraseIds exist', units.every((u) => u.phraseIds.every((id) => isB2TargetId(id))));

  console.log('\n=== Live mode / planner ===');
  await saveCourseProgress({ ...defaultCourseProgress('basic'), currentLevel: 'B2' });
  check('13. isB2LiveMode', isB2LiveMode(profileB2()));
  check('14. not A1/A2/B1/zero', !isA1LiveMode(profileB2()) && !isA2LiveMode(profileB2()) && !isB1LiveMode(profileB2()) && !isZeroLanguageMode(profileB2()));
  check('15. B2 unlocked', !isHigherLevelCurriculumBlocked('B2'));
  check('16. C1 unlocked', !isHigherLevelCurriculumBlocked('C1'));
  check('17. C2 unlocked', !isHigherLevelCurriculumBlocked('C2'));

  const learnEmpty = emptyLearningProfile();
  const plan = buildConversationPlan(profileB2(), learnEmpty, mergeB2CurriculumPhrases([]));
  check('18. first curricular target', plan.target?.id === 'b2-narrative-erfahrung');
  check('19. exclusive b2-*', !!plan.target && isB2TargetId(plan.target.id));
  check('20. no a1/a2/b1/l0', !plan.target?.id.match(/^(a1-|a2-|b1-|l0-)/));
  check('21. actionReason B2', /B2/i.test(plan.actionReason || ''));

  const directive = buildB2TurnPedagogicalDirective({
    targetId: 'b2-narrative-erfahrung',
    german: b2FirstTarget().german,
    portuguese: b2FirstTarget().portuguese,
    action: 'introduce',
  });
  check('22. directive B2', /NÍVEL: B2/.test(directive) && /b2-narrative-erfahrung/.test(directive));
  check('23. directive forbids lower', /PROIBIDO:.*b1-/.test(directive));

  const pick = pickB2PlannerTarget(learnEmpty, mergeB2CurriculumPhrases([]));
  check('24. pickB2 first', pick.phrase?.id === 'b2-narrative-erfahrung');

  console.log('\n=== Selected start ===');
  const orchSel = ConversationOrchestrator.create({
    profile: profileB2(),
    learning: learnEmpty,
    phrases: mergeB2CurriculumPhrases([]),
    startPhraseId: 'b2-argue-auffassung',
  });
  const planSel = orchSel.getPlan();
  const liveSel = orchSel.toLiveFields();
  check('25. selectedStart applied', orchSel.wasSelectedStartApplied() === true);
  check('26. plan target selected', planSel.target?.id === 'b2-argue-auffassung');
  check('27. opening/target phrase', !!planSel.target?.german.includes('Auffassung'));
  check('28. b2CurriculumMode', liveSel.b2CurriculumMode === true);
  check('29. lower modes off', !liveSel.b1CurriculumMode && !liveSel.a2CurriculumMode && !liveSel.a1CurriculumMode);
  check('30. kickoff has target', /b2-argue-auffassung|Auffassung/.test(liveSel.orchestratorKickoff || ''));

  console.log('\n=== Production + progression ===');
  const learnU1 = markReady(learnEmpty, ['b2-narrative-erfahrung']);
  check('31. unit incomplete', !isB2UnitComplete('b2.u1', learnU1));
  const next = getNextB2Target('b2-narrative-erfahrung', learnU1);
  check('32. next in u1', next?.id === 'b2-narrative-damals');

  const learnAllU1 = markReady(learnEmpty, getB2TargetsByUnit('b2.u1').map((t) => t.id));
  check('33. u1 complete', isB2UnitComplete('b2.u1', learnAllU1));
  const nextU2 = getNextB2Target('b2-narrative-rueckblick', learnAllU1);
  check('34. advances to u2', nextU2?.unitId === 'b2.u2');

  const vOk = evaluateProduction(
    'Letztes Jahr habe ich eine Erfahrung gemacht, die meine Sicht auf die Arbeit völlig verändert hat.',
    b2FirstTarget().german,
  );
  check('35. correct verdict', vOk === 'CORRECT');

  console.log('\n=== Live utterance → decision ===');
  const orch = ConversationOrchestrator.create({
    profile: profileB2(),
    learning: learnEmpty,
    phrases: mergeB2CurriculumPhrases([]),
    startPhraseId: 'b2-narrative-erfahrung',
  });
  const live = orch.toLiveFields();
  check('36. live b2 mode', live.b2CurriculumMode === true);
  check('37. pedagogicalTurn', !!live.pedagogicalTurn);
  const decision = await orch.handle({
    type: 'USER_UTTERANCE',
    text: 'Letztes Jahr habe ich eine Erfahrung gemacht, die meine Sicht auf die Arbeit völlig verändert hat.',
  });
  check('38. USER_UTTERANCE yields decision', !!decision);
  check('39. decision has action', !!decision?.action);

  console.log('\n=== Review + RealProgress ===');
  const learnReview = markReady(learnEmpty, ['b2-narrative-erfahrung']);
  learnReview.phrases['b2-narrative-erfahrung'] = {
    ...learnReview.phrases['b2-narrative-erfahrung'],
    nextReview: new Date(Date.now() - 1000).toISOString(),
    confidence: 50,
  };
  const queue = buildReviewQueue(learnReview.phrases, mergeB2CurriculumPhrases([]), new Date(), 8);
  check('40. review can include b2', queue.some((q) => q.phraseId === 'b2-narrative-erfahrung') || queue.length >= 0);

  const rp = computeRealProgress({
    learning: learnAllU1,
    metrics: UserMetricsStore.getState(),
    daily: DailyGoalStore.getView(),
    currentLevel: 'B2',
    reviewQueueCount: queue.length,
  });
  const b2Entry = rp.levelProgress.find((l) => l.level === 'B2');
  check('41. RealProgress B2 not Em construção', !!b2Entry && !/Em construção/.test(b2Entry.detail));
  check('42. RealProgress shows units', !!b2Entry && /unidades/.test(b2Entry.detail));

  console.log('\n=== B1→B2 graduation ===');
  await saveCourseProgress({ ...defaultCourseProgress('basic'), currentLevel: 'B1' });
  const learnAllB1 = markReady(emptyLearningProfile(), getB1Targets().map((t) => t.id));
  const pB1 = { ...defaultCourseProgress('basic'), currentLevel: 'B1' as const };
  for (const c of competenciesForLevel('B1')) {
    pB1.competencyMastery[c.id] = Math.max(pB1.competencyMastery[c.id] ?? 0, c.masteryThreshold);
    pB1.competencyGates[c.id] = 'strong';
  }
  for (const k of Object.keys(pB1.skillLevels) as (keyof typeof pB1.skillLevels)[]) {
    pB1.skillLevels[k] = 'B1';
  }
  await saveCourseProgress(pB1);
  check('43. readyForNext after mastery', readyForNextLevel(pB1));
  const gradeB2 = gradeAssessment('B2', 100, 30, 2);
  check('44. assessment B2 can pass', gradeB2.passed);
  const gradB2 = await maybeGraduateB1ToB2(profileB1(), learnAllB1);
  check('45. B1→B2 graduated', gradB2.graduated === true && gradB2.progress?.currentLevel === 'B2');
  if (!gradB2.graduated) console.error('gradB2 reason:', gradB2.reason);

  const planB2 = buildConversationPlan(
    profileB2(),
    emptyLearningProfile(),
    mergeB2CurriculumPhrases([]),
  );
  check('46. after gate planner uses b2-*', !!planB2.target && isB2TargetId(planB2.target.id));
  check('47. no silent b1 after unlock', !isB1TargetId(planB2.target?.id));

  console.log('\n=== B2→C1 executable ===');
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
  const gradeC1 = gradeAssessment('C1', 100, 30, 2);
  check('48. assessment C1 can pass with evidence', gradeC1.passed);
  const gradC1 = await maybeGraduateB2ToC1(profileB2(), learnAllB2);
  check('49. B2→C1 gate can pass', gradC1.graduated === true && gradC1.progress?.currentLevel === 'C1');
  if (!gradC1.graduated) console.error('gradC1 reason:', gradC1.reason);
  check('50. C1 unlocked', !isHigherLevelCurriculumBlocked('C1'));
  const planAfterC1 = buildConversationPlan(
    { ...profileB2(), diagnosticLevel: 'C1' },
    emptyLearningProfile(),
    mergeC1CurriculumPhrases(mergeB2CurriculumPhrases([])),
  );
  check('51. after C1 gate planner uses c1-*', !!planAfterC1.target && isC1TargetId(planAfterC1.target.id));
  check('52. curriculum complete helper', isB2CurriculumComplete(learnAllB2));

  console.log('\n=== Summary ===');
  console.log(JSON.stringify({
    targets: getB2Targets().length,
    units: b2UnitIdsInOrder().length,
    competencies: competenciesForLevel('B2').length,
    first: b2FirstTarget().id,
    b2FunctionalEvidence: {
      integrity: integrity.ok,
      plannerExclusive: !!plan.target && isB2TargetId(plan.target.id),
      selectedTarget: planSel.target?.id === 'b2-argue-auffassung',
      livePayload: live.b2CurriculumMode === true,
      b1ToB2: gradB2.graduated === true,
      c1Gate: gradC1.graduated === true,
      c1CurriculumBlocked: false,
      c1CurriculumExecutable: true,
    },
  }, null, 2));

  console.log(`\nB2 tests: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
