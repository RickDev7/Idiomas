/**
 * Auditoria B1 escolar: contagem exclusiva, exit, gate B1→B2.
 * Rodar: npx tsx src/services/course/__tests__/B1AuditFixes.test.ts
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
  B1_CURRICULUM,
  B1_EXIT_SCENARIOS,
  B1_LEGACY_PLACEMENT,
  assertB1CurriculumIntegrity,
  auditB1Targets,
  getB1Targets,
  getB1TargetsByCompetency,
  getB1TargetsByUnit,
  gradeB1ExitAssessment,
  isB1CurriculumComplete,
  isB1TargetId,
} from '@/services/course/B1Curriculum';
import { competenciesForLevel } from '@/services/course/competencies';
import {
  defaultCourseProgress,
  readyForNextLevel,
  saveCourseProgress,
  getStoredCourseProgress,
} from '@/services/course/CourseProgressEngine';
import { maybeGraduateB1ToB2 } from '@/services/course/L0ToA1Graduation';
import { assessmentFor, gradeAssessment, nextAssessmentTarget } from '@/services/course/LevelAssessment';
import { LEVEL_BY_ID } from '@/services/course/levels';
import { emptyLearningProfile } from '@/services/learning/RealProgress';
import { emptyConfidence, type UserLearningProfile } from '@/services/learning/ConfidenceService';
import type { UserProfile } from '@/types';
import { getA2Targets } from '@/services/course/A2Curriculum';
import { getB2Targets } from '@/services/course/B2Curriculum';

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
    id: 'u-b1-audit',
    name: 'Audit',
    level: 'basic',
    selfReportedLevel: 'intermediate',
    diagnosticLevel: 'B1',
    goal: 'work',
    dailyMinutes: 20,
    germanPercentage: 85,
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
  console.log('\n=== Auditoria B1 ===');
  const integrity = assertB1CurriculumIntegrity();
  check('integrity ok', integrity.ok);
  if (!integrity.ok) console.error(integrity.errors);

  const audit = auditB1Targets();
  check('57 targets', audit.total === 57 && getB1Targets().length === 57);
  check('21 reutilizados', audit.reused === 21);
  check('36 novos', audit.novo === 36);
  check('reused+novo = total', audit.reused + audit.novo === audit.total);
  check('sem duplicatas', audit.duplicateIds.length === 0);
  check('legacy map tem 21', Object.keys(B1_LEGACY_PLACEMENT).length === 21);
  check('sem reorganização de colocação', audit.reorganizedAmongReused === 0);
  check('todos IDs únicos', new Set(B1_CURRICULUM.map((t) => t.id)).size === B1_CURRICULUM.length);
  check('todos b1-', B1_CURRICULUM.every((t) => isB1TargetId(t.id)));

  console.log('\n=== Módulos / competências ===');
  const units = LEVEL_BY_ID.B1.modules.flatMap((m) => m.units);
  check('7 unidades', units.length === 7);
  check('7 competências', competenciesForLevel('B1').length === 7);
  check('u1 story 8', getB1TargetsByUnit('b1.u1').length === 8 && getB1TargetsByCompetency('b1.story').length === 8);
  check('u2 opinion 9', getB1TargetsByUnit('b1.u2').length === 9);
  check('u3 work 8', getB1TargetsByUnit('b1.u3').length === 8);
  check('u4 news 8', getB1TargetsByUnit('b1.u4').length === 8);
  check('u5 problem 8', getB1TargetsByUnit('b1.u5').length === 8);
  check('u6 present 8', getB1TargetsByUnit('b1.u6').length === 8);
  check('u7 daily 8', getB1TargetsByUnit('b1.u7').length === 8);

  console.log('\n=== Exit B1 ===');
  check('10 cenários de saída', B1_EXIT_SCENARIOS.length === 10);
  for (const sc of B1_EXIT_SCENARIOS) {
    for (const id of sc.evidenceTargetIds) {
      check(`exit evidence ${sc.id}/${id}`, isB1TargetId(id));
    }
  }
  check('exit vazio falha', !gradeB1ExitAssessment(emptyLearningProfile()).passed);

  let learning = markReady(emptyLearningProfile(), getB1Targets().map((t) => t.id));
  check('currículo completo', isB1CurriculumComplete(learning));
  const exitOk = gradeB1ExitAssessment(learning);
  check('exit 10/10 passa', exitOk.passed && exitOk.scenariosPassed === 10);

  const sevenIds = new Set(B1_EXIT_SCENARIOS.slice(0, 7).flatMap((s) => s.evidenceTargetIds));
  const failIds = new Set(B1_EXIT_SCENARIOS.slice(7).flatMap((s) => s.evidenceTargetIds));
  const exit7 = gradeB1ExitAssessment(markReady(emptyLearningProfile(), [...sevenIds]));
  check('exit ≥7 passa', exit7.passed && exit7.scenariosPassed >= 7);

  const exit6 = gradeB1ExitAssessment(
    markReady(
      emptyLearningProfile(),
      [...sevenIds].filter((id) => !failIds.has(id) && !B1_EXIT_SCENARIOS[6]!.evidenceTargetIds.includes(id)),
    ),
  );
  check('exit <7 falha', !exit6.passed);

  console.log('\n=== Gate B1→B2 ===');
  _store.clear();
  await saveCourseProgress({ ...defaultCourseProgress('basic'), currentLevel: 'B1' });
  const p = getStoredCourseProgress()!;
  for (const comp of competenciesForLevel('B1')) {
    p.competencyMastery[comp.id] = Math.max(p.competencyMastery[comp.id] ?? 0, comp.masteryThreshold);
    p.competencyGates[comp.id] = 'strong';
  }
  for (const k of Object.keys(p.skillLevels) as (keyof typeof p.skillLevels)[]) {
    p.skillLevels[k] = 'B1';
  }
  await saveCourseProgress(p);
  check('readyForNextLevel', readyForNextLevel(getStoredCourseProgress()!));
  check('nextAssessmentTarget B2', nextAssessmentTarget(getStoredCourseProgress()!) === 'B2');
  check('assess.b1 cobre 7 comps', (assessmentFor('B1')?.competencies.length ?? 0) === 7);
  check('gradeAssessment(B2) com evidência B1', gradeAssessment('B2', 80, 20, 2).passed);

  const a2Before = getA2Targets().length;
  const b2Before = getB2Targets().length;
  const gradOk = await maybeGraduateB1ToB2(profileB1(), learning);
  check('gate passa → B2', gradOk.graduated === true && gradOk.progress?.currentLevel === 'B2');
  check('A2 intacto', getA2Targets().length === a2Before);
  check('B2 intacto', getB2Targets().length === b2Before);

  _store.clear();
  await saveCourseProgress({ ...defaultCourseProgress('basic'), currentLevel: 'B1' });
  const p2 = getStoredCourseProgress()!;
  for (const comp of competenciesForLevel('B1')) {
    p2.competencyMastery[comp.id] = Math.max(p2.competencyMastery[comp.id] ?? 0, comp.masteryThreshold);
    p2.competencyGates[comp.id] = 'strong';
  }
  for (const k of Object.keys(p2.skillLevels) as (keyof typeof p2.skillLevels)[]) {
    p2.skillLevels[k] = 'B1';
  }
  await saveCourseProgress(p2);
  const incomplete = markReady(emptyLearningProfile(), getB1Targets().slice(0, 10).map((t) => t.id));
  const gradIncomplete = await maybeGraduateB1ToB2(profileB1(), incomplete);
  check('gate bloqueia currículo incompleto', !gradIncomplete.graduated && gradIncomplete.reason.includes('incomplete'));

  let learningExitFail = markReady(emptyLearningProfile(), getB1Targets().map((t) => t.id));
  for (const sc of B1_EXIT_SCENARIOS.slice(6)) {
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
    currentLevel: 'B1',
    competencyMastery: Object.fromEntries(competenciesForLevel('B1').map((c) => [c.id, c.masteryThreshold])),
    skillLevels: {
      listening: 'B1',
      speaking: 'B1',
      reading: 'B1',
      writing: 'B1',
      pronunciation: 'B1',
      grammar: 'B1',
      vocabulary: 'B1',
      communication: 'B1',
    },
  });
  const gradExit = await maybeGraduateB1ToB2(profileB1(), learningExitFail);
  check(
    'critério insuficiente permanece B1',
    !gradExit.graduated && getStoredCourseProgress()?.currentLevel === 'B1',
  );
  check(
    'motivo curriculum ou exit',
    /b1_curriculum_incomplete|b1_exit_incomplete|not_ready/.test(gradExit.reason),
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

  console.log(`\nB1 audit tests: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
