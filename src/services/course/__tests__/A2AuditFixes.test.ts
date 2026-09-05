/**
 * Auditoria A2 escolar: contagem exclusiva, exit, gate A2→B1.
 * Rodar: npx tsx src/services/course/__tests__/A2AuditFixes.test.ts
 */
const _store = new Map<string, string>();
(globalThis as unknown as { localStorage: Storage }).localStorage = {
  getItem: (k) => _store.get(k) ?? null,
  setItem: (k, v) => {
    _store.set(k, String(v));
  },
  removeItem: (k) => {
    _store.delete(k);
  },
  clear: () => {
    _store.clear();
  },
  key: () => null,
  length: 0,
} as Storage;

import {
  A2_CURRICULUM,
  A2_EXIT_SCENARIOS,
  A2_LEGACY_PLACEMENT,
  assertA2CurriculumIntegrity,
  auditA2Targets,
  getA2Targets,
  getA2TargetsByCompetency,
  getA2TargetsByUnit,
  gradeA2ExitAssessment,
  isA2CurriculumComplete,
  isA2TargetId,
} from '@/services/course/A2Curriculum';
import { competenciesForLevel } from '@/services/course/competencies';
import {
  defaultCourseProgress,
  readyForNextLevel,
  saveCourseProgress,
  getStoredCourseProgress,
} from '@/services/course/CourseProgressEngine';
import { maybeGraduateA2ToB1 } from '@/services/course/L0ToA1Graduation';
import { assessmentFor, gradeAssessment, nextAssessmentTarget } from '@/services/course/LevelAssessment';
import { LEVEL_BY_ID } from '@/services/course/levels';
import { emptyLearningProfile } from '@/services/learning/RealProgress';
import { emptyConfidence, type UserLearningProfile } from '@/services/learning/ConfidenceService';
import type { UserProfile } from '@/types';
import { getA1Targets } from '@/services/course/A1Curriculum';
import { getB1Targets } from '@/services/course/B1Curriculum';

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
    id: 'u-a2-audit',
    name: 'Audit',
    level: 'basic',
    selfReportedLevel: 'basic',
    diagnosticLevel: 'A2',
    goal: 'work',
    dailyMinutes: 20,
    germanPercentage: 70,
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

function markReady(learning: UserLearningProfile, ids: string[]): UserLearningProfile {
  const phrases = { ...learning.phrases };
  for (const id of ids) {
    phrases[id] = {
      ...emptyConfidence(id),
      timesCorrect: 4,
      timesProduced: 5,
      confidence: 80,
      state: 'spontaneous',
      spontaneousSessions: 3,
      automationScore: 70,
      lastProduced: new Date().toISOString(),
      nextReview: new Date(Date.now() - 60_000).toISOString(),
    };
  }
  return { ...learning, phrases };
}

async function main() {
  console.log('\n=== Auditoria A2 ===');
  const integrity = assertA2CurriculumIntegrity();
  check('integrity ok', integrity.ok);
  if (!integrity.ok) console.error(integrity.errors);

  const audit = auditA2Targets();
  check('57 targets', audit.total === 57 && getA2Targets().length === 57);
  check('18 reutilizados', audit.reused === 18);
  check('39 novos', audit.novo === 39);
  check('reused+novo = total', audit.reused + audit.novo === audit.total);
  check('sem duplicatas', audit.duplicateIds.length === 0);
  check('legacy map tem 18', Object.keys(A2_LEGACY_PLACEMENT).length === 18);
  check('reorganizados entre reutilizados > 0', audit.reorganizedAmongReused >= 7);

  const ids = new Set(A2_CURRICULUM.map((t) => t.id));
  check('todos IDs únicos no currículo', ids.size === A2_CURRICULUM.length);
  check('todos a2-', A2_CURRICULUM.every((t) => isA2TargetId(t.id)));

  console.log('\n=== Módulos / competências ===');
  const units = LEVEL_BY_ID.A2.modules.flatMap((m) => m.units);
  check('6 unidades', units.length === 6);
  check('6 competências', competenciesForLevel('A2').length === 6);
  check('u1 past 9', getA2TargetsByUnit('a2.u1').length === 9 && getA2TargetsByCompetency('a2.past').length === 9);
  check('u2 housing 9', getA2TargetsByUnit('a2.u2').length === 9 && getA2TargetsByCompetency('a2.plans').length === 9);
  check('u3 health 9', getA2TargetsByUnit('a2.u3').length === 9);
  check('u4 work 9', getA2TargetsByUnit('a2.u4').length === 9 && getA2TargetsByCompetency('a2.phone').length === 9);
  check('u5 travel 9', getA2TargetsByUnit('a2.u5').length === 9);
  check('u6 social 12', getA2TargetsByUnit('a2.u6').length === 12 && getA2TargetsByCompetency('a2.opinion').length === 12);

  const plansMoved = audit.rows.filter((r) =>
    ['a2-plans-werde', 'a2-plans-plane', 'a2-plans-reisen'].includes(r.targetId),
  );
  check('planos reorganizados → u6/opinion', plansMoved.every((r) =>
    r.status === 'REUTILIZADO' && r.reorganized && r.moduleId === 'a2.u6' && r.competencyId === 'a2.opinion',
  ));
  const wohnung = audit.rows.find((r) => r.targetId === 'a2-problem-wohnung');
  check('wohnung reorganizado → u2/plans', !!(
    wohnung?.reorganized && wohnung.moduleId === 'a2.u2' && wohnung.competencyId === 'a2.plans'
  ));
  const phone = audit.rows.filter((r) => r.targetId.startsWith('a2-phone-'));
  check('phone reorganizado → u4', phone.every((r) =>
    r.reorganized && r.moduleId === 'a2.u4' && r.competencyId === 'a2.phone',
  ));

  console.log('\n=== Exit A2 ===');
  check('10 cenários de saída', A2_EXIT_SCENARIOS.length === 10);
  for (const sc of A2_EXIT_SCENARIOS) {
    for (const id of sc.evidenceTargetIds) {
      check(`exit evidence ${sc.id}/${id}`, isA2TargetId(id));
    }
  }
  const empty = emptyLearningProfile();
  check('exit vazio falha', !gradeA2ExitAssessment(empty).passed);

  let learning = markReady(emptyLearningProfile(), getA2Targets().map((t) => t.id));
  check('currículo completo', isA2CurriculumComplete(learning));
  const exitOk = gradeA2ExitAssessment(learning);
  check('exit 10/10 passa', exitOk.passed && exitOk.scenariosPassed === 10);

  const sevenIds = new Set(A2_EXIT_SCENARIOS.slice(0, 7).flatMap((s) => s.evidenceTargetIds));
  const failIds = new Set(A2_EXIT_SCENARIOS.slice(7).flatMap((s) => s.evidenceTargetIds));
  let learning7 = emptyLearningProfile();
  learning7 = markReady(learning7, [...sevenIds]);
  const exit7 = gradeA2ExitAssessment(learning7);
  check('exit ≥7 passa', exit7.passed && exit7.scenariosPassed >= 7);

  let learning6 = emptyLearningProfile();
  learning6 = markReady(
    learning6,
    [...sevenIds].filter((id) => !failIds.has(id) && !A2_EXIT_SCENARIOS[6]!.evidenceTargetIds.includes(id)),
  );
  const exit6 = gradeA2ExitAssessment(learning6);
  check('exit <7 falha', !exit6.passed);

  console.log('\n=== Gate A2→B1 ===');
  _store.clear();
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
  check('readyForNextLevel', readyForNextLevel(getStoredCourseProgress()!));
  check('nextAssessmentTarget B1', nextAssessmentTarget(getStoredCourseProgress()!) === 'B1');
  check('assess.a2 cobre 6 comps', (assessmentFor('A2')?.competencies.length ?? 0) === 6);
  check('gradeAssessment(B1) com evidência A2', gradeAssessment('B1', 80, 20, 2).passed);

  const a1Before = getA1Targets().length;
  const b1Before = getB1Targets().length;
  const gradOk = await maybeGraduateA2ToB1(profileA2(), learning);
  check('gate passa → B1', gradOk.graduated === true && gradOk.progress?.currentLevel === 'B1');
  check('A1 intacto', getA1Targets().length === a1Before);
  check('B1 intacto', getB1Targets().length === b1Before);

  _store.clear();
  await saveCourseProgress({ ...defaultCourseProgress('basic'), currentLevel: 'A2' });
  const p2 = getStoredCourseProgress()!;
  for (const comp of competenciesForLevel('A2')) {
    p2.competencyMastery[comp.id] = Math.max(p2.competencyMastery[comp.id] ?? 0, comp.masteryThreshold);
    p2.competencyGates[comp.id] = 'strong';
  }
  for (const k of Object.keys(p2.skillLevels) as (keyof typeof p2.skillLevels)[]) {
    p2.skillLevels[k] = 'A2';
  }
  await saveCourseProgress(p2);
  const incomplete = markReady(emptyLearningProfile(), getA2Targets().slice(0, 10).map((t) => t.id));
  const gradIncomplete = await maybeGraduateA2ToB1(profileA2(), incomplete);
  check('gate bloqueia currículo incompleto', !gradIncomplete.graduated && gradIncomplete.reason.includes('incomplete'));

  let learningExitFail = markReady(emptyLearningProfile(), getA2Targets().map((t) => t.id));
  for (const sc of A2_EXIT_SCENARIOS.slice(6)) {
    for (const id of sc.evidenceTargetIds) {
      learningExitFail.phrases[id] = {
        ...emptyConfidence(id),
        timesCorrect: 0,
        timesProduced: 0,
        confidence: 0,
        state: 'new',
      };
    }
  }
  await saveCourseProgress({
    ...defaultCourseProgress('basic'),
    currentLevel: 'A2',
    competencyMastery: Object.fromEntries(competenciesForLevel('A2').map((c) => [c.id, c.masteryThreshold])),
    skillLevels: {
      listening: 'A2',
      speaking: 'A2',
      reading: 'A2',
      writing: 'A2',
      pronunciation: 'A2',
      grammar: 'A2',
      vocabulary: 'A2',
      communication: 'A2',
    },
  });
  const gradExit = await maybeGraduateA2ToB1(profileA2(), learningExitFail);
  check(
    'critério insuficiente permanece A2',
    !gradExit.graduated && getStoredCourseProgress()?.currentLevel === 'A2',
  );
  check(
    'motivo curriculum ou exit',
    /a2_curriculum_incomplete|a2_exit_incomplete|not_ready/.test(gradExit.reason),
  );

  console.log('\n=== Resumo audit ===');
  console.log(JSON.stringify({
    total: audit.total,
    reused: audit.reused,
    novo: audit.novo,
    reorganizedAmongReused: audit.reorganizedAmongReused,
  }, null, 2));

  console.log('\n— TABELA (status exclusivo)');
  for (const r of audit.rows) {
    const origin = r.reorganized
      ? `reorg ${r.previousUnitId}/${r.previousCompetencyId}→${r.moduleId}/${r.competencyId}`
      : r.status === 'REUTILIZADO'
        ? 'mesmo lugar'
        : '—';
    console.log(`${r.targetId}\t${r.moduleId}\t${r.competencyId}\t${r.status}\t${origin}`);
  }

  console.log(`\nA2 audit tests: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
