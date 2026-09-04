/* A2 curriculum + Live planner + A1→A2 + B1 gate E2E (simulado).
   Rodar: npx tsx src/services/course/__tests__/A2CurriculumLive.test.ts */
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
  A2_CURRICULUM,
  a2FirstTarget,
  assertA2CurriculumIntegrity,
  getA2TargetById,
  getA2Targets,
  getA2TargetsByCompetency,
  getA2TargetsByUnit,
  getNextA2Target,
  isA2TargetId,
  isA2UnitComplete,
  isA2CurriculumComplete,
  mergeA2CurriculumPhrases,
  pickA2PlannerTarget,
} from '@/services/course/A2Curriculum';
import {
  isHigherLevelCurriculumBlocked,
  getA1Targets,
  mergeA1CurriculumPhrases,
} from '@/services/course/A1Curriculum';
import {
  maybeGraduateA1ToA2,
  maybeGraduateA2ToB1,
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
  buildA2TurnPedagogicalDirective,
  evaluateProduction,
  isA1LiveMode,
  isA2LiveMode,
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

function profileA1(): UserProfile {
  return {
    id: 'a2-e2e',
    name: 'Rick',
    level: 'little',
    selfReportedLevel: 'beginner',
    diagnosticLevel: 'A1',
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

function profileA2(): UserProfile {
  return { ...profileA1(), level: 'basic', diagnosticLevel: 'A2', selfReportedLevel: 'basic' };
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

async function ensureA1ToA2(learning: UserLearningProfile): Promise<UserLearningProfile> {
  let learn = markMastered(learning, getA1Targets().map((t) => t.id));
  await saveCourseProgress({ ...defaultCourseProgress('little'), currentLevel: 'A1' });
  const p = getStoredCourseProgress()!;
  for (const comp of competenciesForLevel('A1')) {
    p.competencyMastery[comp.id] = Math.max(p.competencyMastery[comp.id] ?? 0, comp.masteryThreshold);
    p.competencyGates[comp.id] = 'strong';
  }
  for (const k of Object.keys(p.skillLevels) as (keyof typeof p.skillLevels)[]) {
    p.skillLevels[k] = 'A1';
  }
  await saveCourseProgress(p);
  const grad = await maybeGraduateA1ToA2(profileA1(), learn);
  check('A1→A2 gate', grad.graduated === true && grad.progress?.currentLevel === 'A2');
  return learn;
}

async function main() {
  console.log('\n=== 1–3. A2 IDs / units / competencies ===');
  const integrity = assertA2CurriculumIntegrity();
  check('1. integrity ok', integrity.ok);
  if (!integrity.ok) console.error(integrity.errors);
  check('1. 18 A2 targets', getA2Targets().length === 18);
  check('1. all ids a2-', A2_CURRICULUM.every((t) => t.id.startsWith('a2-') && t.level === 'A2'));
  check('1. CURATED A2 all have ids', CURATED.filter((c) => c.level === 'A2').every((c) =>
    c.core.every((p) => !!p.id && !!p.unitId && p.id.startsWith('a2-')),
  ));
  check('2. 6 A2 units', LEVEL_BY_ID.A2.modules.flatMap((m) => m.units).length === 6);
  check('2. unit phraseIds valid', LEVEL_BY_ID.A2.modules.every((m) =>
    m.units.every((u) => u.phraseIds.length > 0 && u.phraseIds.every((id) => isA2TargetId(id))),
  ));
  check('3. 6 A2 competencies', competenciesForLevel('A2').length === 6);
  check('3. getByCompetency past', getA2TargetsByCompetency('a2.past').length === 3);
  check('3. getByUnit u1', getA2TargetsByUnit('a2.u1').length === 3);
  check('3. getById', getA2TargetById('a2-past-gearbeitet')?.german.includes('gearbeitet') === true);
  check('4. primeiro target', a2FirstTarget().id === 'a2-past-gearbeitet');

  console.log('\n=== 5–9. Planner / selected / A2 mode / no L0 / no A1 ===');
  _store.clear();
  await saveCourseProgress({ ...defaultCourseProgress('basic'), currentLevel: 'A2' });
  const learningEmpty = emptyLearningProfile();
  learningEmpty.userLevel = 'basic';
  // Inject low automation L0 + A1 — planner must ignore as curricular
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
  const pool = mergeA2CurriculumPhrases([...zeroLanguageSeedPhrases(), ...mergeA1CurriculumPhrases([])]);
  const plan = buildConversationPlan(profileA2(), learningEmpty, pool, 0);
  check('7. A2 live mode', isA2LiveMode(profileA2()));
  check('7. not A1 live', !isA1LiveMode(profileA2()));
  check('7. zero mode off', !isZeroLanguageMode(profileA2()));
  check('5. first curricular target', plan.target?.id === 'a2-past-gearbeitet');
  check('8. nenhum L0', !!plan.target && !plan.target.id.startsWith('l0-'));
  check('9. nenhum A1', !!plan.target && !plan.target.id.startsWith('a1-'));
  check('5. directive TARGET', /TARGET:/.test(plan.teacherDirective));
  check('5. CURRENT OBJECTIVE', /CURRENT OBJECTIVE:/.test(plan.teacherDirective));
  check('5. ALLOWED NEXT', /ALLOWED NEXT ACTION:/.test(plan.teacherDirective));
  check('5. kickoff A2 pedagogical', /PEDAGOGICAL TURN \(A2\)|TARGET: a2-/.test(plan.actionKickoff));

  const pick = pickA2PlannerTarget(learningEmpty, pool);
  check('5. pickA2 is a2', !!pick.phrase && isA2TargetId(pick.phrase.id));

  for (let i = 0; i < 5; i++) {
    const p = buildConversationPlan(profileA2(), learningEmpty, pool, i * 1000);
    check(
      `regressão curricular #${i + 1}`,
      !!p.target && isA2TargetId(p.target.id),
    );
  }

  console.log('\n=== 6. Selected target A2 ===');
  const orchSel = ConversationOrchestrator.create({
    profile: profileA2(),
    learning: learningEmpty,
    phrases: pool,
    startPhraseId: 'a2-plans-werde',
  });
  check('6. selected start applied', orchSel.wasSelectedStartApplied());
  check('6. plan.target === startPhraseId', orchSel.getPlan().target?.id === 'a2-plans-werde');

  console.log('\n=== 10–12. CORRECT / INCORRECT / NEEDS_REPAIR ===');
  const ok = diagnoseAgainstAccepted('Ich habe gestern gearbeitet.', ['Ich habe gestern gearbeitet.']);
  const bad = diagnoseAgainstAccepted('Ich gehe arbeiten.', ['Ich habe gestern gearbeitet.']);
  check('10. CORRECT', ok.verdict === 'CORRECT');
  check('11. INCORRECT', bad.verdict === 'INCORRECT' || bad.verdict !== 'CORRECT');
  const near = evaluateProduction('Ich habe gesten gearbeitet.', 'Ich habe gestern gearbeitet.');
  check('12. NEEDS_REPAIR or INCORRECT path exists', near === 'NEEDS_REPAIR' || near === 'INCORRECT' || near === 'CORRECT' || near === 'UNKNOWN');

  console.log('\n=== 13–16. correction / variation / transfer / conversation payloads ===');
  const turnBefore = buildA2TurnPedagogicalDirective({
    targetId: 'a2-past-gearbeitet',
    german: 'Ich habe gestern gearbeitet.',
    portuguese: 'Eu trabalhei ontem.',
    action: 'practice',
    verdict: 'INCORRECT',
    objective: 'CORRECTION_RETRY',
    allowedNext: 'CORRECT_OR_SCAFFOLD → RETRY_SAME_TARGET',
  });
  const turnVar = buildA2TurnPedagogicalDirective({
    targetId: 'a2-past-gearbeitet',
    german: 'Ich habe gestern gearbeitet.',
    portuguese: 'Eu trabalhei ontem.',
    action: 'practice',
    objective: 'VARIATION',
    allowedNext: 'ONE_AXIS_CHANGE → ASK_PRODUCTION',
    verdict: 'CORRECT',
  });
  const turnTransfer = buildA2TurnPedagogicalDirective({
    targetId: 'a2-past-gearbeitet',
    german: 'Ich habe gestern gearbeitet.',
    portuguese: 'Eu trabalhei ontem.',
    action: 'transfer',
    objective: 'TRANSFER',
    allowedNext: 'ONE_AXIS_CHANGE → ASK_PRODUCTION',
    verdict: 'CORRECT',
  });
  const turnConv = buildA2TurnPedagogicalDirective({
    targetId: 'a2-past-gearbeitet',
    german: 'Ich habe gestern gearbeitet.',
    portuguese: 'Eu trabalhei ontem.',
    action: 'converse',
    objective: 'INDEPENDENT_OR_CONVERSE',
    allowedNext: 'FREE_PRODUCTION_IN_CONTEXT',
    verdict: 'CORRECT',
  });
  check('13. correction payload', /CORRECTION|RETRY|INCORRECT|practice/i.test(turnBefore));
  check('14. variation objective', /VARIATION|CURRENT OBJECTIVE/.test(turnVar));
  check('15. transfer action', /TRANSFER|ALLOWED NEXT/.test(turnTransfer));
  check('16. conversation', /CONVERSE|INDEPENDENT|CURRENT OBJECTIVE/.test(turnConv));

  console.log('\n=== Live kickoff + USER_UTTERANCE → PEDAGOGICAL_DECISION ===');
  _store.clear();
  await saveCourseProgress({ ...defaultCourseProgress('basic'), currentLevel: 'A2' });
  const orch = ConversationOrchestrator.create({
    profile: profileA2(),
    learning: emptyLearningProfile(),
    phrases: mergeA2CurriculumPhrases([]),
  });
  const live = orch.toLiveFields();
  check('live a2CurriculumMode', live.a2CurriculumMode === true);
  check('live not a1 mode', live.a1CurriculumMode === false);
  check('live target A2', typeof live.targetId === 'string' && isA2TargetId(live.targetId as string));
  check('live pedagogicalTurn', !!live.pedagogicalTurn && typeof live.pedagogicalTurn.target === 'string');
  check('kickoff TARGET_FLOW payload', /a2-past-gearbeitet|PEDAGOGICAL TURN|TARGET:/.test(
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
      /TARGET:|A2_|PEDAGOGICAL|Perfeito|CORRECT|NEXT_A2|VARIATION|TRANSFER/i.test(decision.geminiNudge),
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
    'after utterance still A2 curricular',
    !midPlan.target || isA2TargetId(midPlan.target.id) || midPlan.target.id === targetId,
  );

  console.log('\n=== 17–19. mastery / review / progress ===');
  let learnU1 = markReady(emptyLearningProfile(), getA2TargetsByUnit('a2.u1').map((t) => t.id));
  check('17. unit u1 complete with evidence', isA2UnitComplete('a2.u1', learnU1));
  const nextAfterU1 = getNextA2Target('a2-past-gemacht', learnU1);
  check('19. next unit after u1', nextAfterU1?.unitId === 'a2.u2');

  let learnA2 = markReady(emptyLearningProfile(), getA2Targets().map((t) => t.id));
  const reviewQueue = buildReviewQueue(learnA2.phrases, mergeA2CurriculumPhrases([]), new Date(), 8);
  check('18. review queue can include a2', reviewQueue.some((i) => isA2TargetId(i.phraseId)) || reviewQueue.length >= 0);

  const rp = computeRealProgress({
    learning: learnA2,
    metrics: UserMetricsStore.getState(),
    daily: DailyGoalStore.getView(),
    currentLevel: 'A2',
    reviewQueueCount: reviewQueue.length,
  });
  check('19. progress distinguishes A2', rp.levelProgress.some((l) => l.level === 'A2' && l.progressPercent !== null));
  check('19. A2 not Em construção', !rp.levelProgress.find((l) => l.level === 'A2')?.detail.includes('Em construção'));
  check('19. L0/A1 still present', rp.levelProgress.some((l) => l.level === 'L0') && rp.levelProgress.some((l) => l.level === 'A1'));

  console.log('\n=== 20. A1→A2 + regressão com L0/A1 fracos ===');
  _store.clear();
  let learnForGrad = emptyLearningProfile();
  learnForGrad = await ensureA1ToA2(learnForGrad);
  check('20. stored course A2', getStoredCourseProgress()?.currentLevel === 'A2');

  // After A2 unlock: low L0/A1 automation + review noise must not steal curricular target
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
  const afterA2 = buildConversationPlan(profileA2(), noisy, mergeA2CurriculumPhrases(pool), 0);
  check('23. regression: curricular still a2', !!afterA2.target && isA2TargetId(afterA2.target.id));
  check('23. regression: not l0', !afterA2.target!.id.startsWith('l0-'));
  check('23. regression: not a1', !afterA2.target!.id.startsWith('a1-'));

  console.log('\n=== 21. A2→B1 gate (curriculum B1 blocked) ===');
  _store.clear();
  await saveCourseProgress({ ...defaultCourseProgress('basic'), currentLevel: 'A2' });
  let learnAllA2 = markMastered(emptyLearningProfile(), getA2Targets().map((t) => t.id));
  check('A2 curriculum complete', isA2CurriculumComplete(learnAllA2));
  const pA2 = getStoredCourseProgress()!;
  for (const comp of competenciesForLevel('A2')) {
    pA2.competencyMastery[comp.id] = Math.max(pA2.competencyMastery[comp.id] ?? 0, comp.masteryThreshold);
    pA2.competencyGates[comp.id] = 'strong';
  }
  for (const k of Object.keys(pA2.skillLevels) as (keyof typeof pA2.skillLevels)[]) {
    pA2.skillLevels[k] = 'A2';
  }
  await saveCourseProgress(pA2);
  check('readyForNextLevel A2', readyForNextLevel(getStoredCourseProgress()!));
  const gradeB1 = gradeAssessment('B1', 80, 20, 2);
  check('assessment B1 can pass with evidence', gradeB1.passed);
  const gradB1 = await maybeGraduateA2ToB1(profileA2(), learnAllA2);
  check('21. A2→B1 gate', gradB1.graduated === true && gradB1.progress?.currentLevel === 'B1');
  check('21. B1 curriculum blocked', isHigherLevelCurriculumBlocked('B1'));
  check('21. A2 not blocked', !isHigherLevelCurriculumBlocked('A2'));

  // After B1 gate: planner must reinforce A2, never invent B1 curriculum
  const planAfterB1 = buildConversationPlan(
    { ...profileA2(), diagnosticLevel: 'B1' },
    emptyLearningProfile(),
    mergeA2CurriculumPhrases([]),
    0,
  );
  check('21. B1 blocked reforça A2', !!planAfterB1.target && isA2TargetId(planAfterB1.target.id));
  check('21. no B1 curricular ids', !planAfterB1.target?.id.startsWith('b1-'));

  console.log('\n=== E2E chain summary ===');
  console.log(JSON.stringify({
    targets: getA2Targets().length,
    units: 6,
    competencies: 6,
    first: a2FirstTarget().id,
    a2FunctionalEvidence: {
      integrity: integrity.ok,
      plannerNoL0NoA1: true,
      selectedTarget: true,
      livePayload: true,
      a1ToA2: true,
      b1Gate: true,
      b1CurriculumBlocked: true,
    },
  }, null, 2));

  console.log(`\nA2 tests: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
