/**
 * Auditoria B2 escolar: contagem exclusiva, exit, gate B2→C1.
 * Rodar: npx tsx src/services/course/__tests__/B2AuditFixes.test.ts
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
  B2_CURRICULUM,
  B2_EXIT_SCENARIOS,
  B2_LEGACY_PLACEMENT,
  assertB2CurriculumIntegrity,
  auditB2Targets,
  getB2Targets,
  getB2TargetsByCompetency,
  getB2TargetsByUnit,
  gradeB2ExitAssessment,
  isB2CurriculumComplete,
  isB2TargetId,
} from '@/services/course/B2Curriculum';
import { competenciesForLevel } from '@/services/course/competencies';
import {
  defaultCourseProgress,
  readyForNextLevel,
  saveCourseProgress,
  getStoredCourseProgress,
} from '@/services/course/CourseProgressEngine';
import { maybeGraduateB2ToC1 } from '@/services/course/L0ToA1Graduation';
import { assessmentFor, gradeAssessment, nextAssessmentTarget } from '@/services/course/LevelAssessment';
import { LEVEL_BY_ID } from '@/services/course/levels';
import { emptyLearningProfile } from '@/services/learning/RealProgress';
import { emptyConfidence, type UserLearningProfile } from '@/services/learning/ConfidenceService';
import type { UserProfile } from '@/types';
import { getB1Targets } from '@/services/course/B1Curriculum';
import { getC1Targets } from '@/services/course/C1Curriculum';

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
    id: 'u-b2-audit',
    name: 'Audit',
    level: 'basic',
    selfReportedLevel: 'intermediate',
    diagnosticLevel: 'B2',
    goal: 'work',
    dailyMinutes: 20,
    germanPercentage: 90,
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
  console.log('\n=== Auditoria B2 ===');
  const integrity = assertB2CurriculumIntegrity();
  check('integrity ok', integrity.ok);
  if (!integrity.ok) console.error(integrity.errors);

  const audit = auditB2Targets();
  check('56 targets', audit.total === 56 && getB2Targets().length === 56);
  check('24 reutilizados', audit.reused === 24);
  check('32 novos', audit.novo === 32);
  check('reused+novo = total', audit.reused + audit.novo === audit.total);
  check('sem duplicatas', audit.duplicateIds.length === 0);
  check('legacy map tem 24', Object.keys(B2_LEGACY_PLACEMENT).length === 24);
  check('sem reorganização de colocação', audit.reorganizedAmongReused === 0);
  check('todos IDs únicos', new Set(B2_CURRICULUM.map((t) => t.id)).size === B2_CURRICULUM.length);
  check('todos b2-', B2_CURRICULUM.every((t) => isB2TargetId(t.id)));

  console.log('\n=== Módulos / competências ===');
  check('8 unidades', LEVEL_BY_ID.B2.modules.flatMap((m) => m.units).length === 8);
  check('8 competências', competenciesForLevel('B2').length === 8);
  for (const u of ['b2.u1', 'b2.u2', 'b2.u3', 'b2.u4', 'b2.u5', 'b2.u6', 'b2.u7', 'b2.u8']) {
    check(`${u} tem 7`, getB2TargetsByUnit(u).length === 7);
  }
  check('narrative 7', getB2TargetsByCompetency('b2.narrative').length === 7);
  check('fluent 7', getB2TargetsByCompetency('b2.fluent').length === 7);

  console.log('\n=== Exit B2 ===');
  check('10 cenários de saída', B2_EXIT_SCENARIOS.length === 10);
  for (const sc of B2_EXIT_SCENARIOS) {
    for (const id of sc.evidenceTargetIds) {
      check(`exit evidence ${sc.id}/${id}`, isB2TargetId(id));
    }
  }
  check('exit vazio falha', !gradeB2ExitAssessment(emptyLearningProfile()).passed);

  let learning = markReady(emptyLearningProfile(), getB2Targets().map((t) => t.id));
  check('currículo completo', isB2CurriculumComplete(learning));
  const exitOk = gradeB2ExitAssessment(learning);
  check('exit 10/10 passa', exitOk.passed && exitOk.scenariosPassed === 10);

  const sevenIds = new Set(B2_EXIT_SCENARIOS.slice(0, 7).flatMap((s) => s.evidenceTargetIds));
  const failIds = new Set(B2_EXIT_SCENARIOS.slice(7).flatMap((s) => s.evidenceTargetIds));
  check('exit ≥7 passa', gradeB2ExitAssessment(markReady(emptyLearningProfile(), [...sevenIds])).passed);
  check(
    'exit <7 falha',
    !gradeB2ExitAssessment(
      markReady(
        emptyLearningProfile(),
        [...sevenIds].filter((id) => !failIds.has(id) && !B2_EXIT_SCENARIOS[6]!.evidenceTargetIds.includes(id)),
      ),
    ).passed,
  );

  console.log('\n=== Gate B2→C1 ===');
  _store.clear();
  await saveCourseProgress({ ...defaultCourseProgress('basic'), currentLevel: 'B2' });
  const p = getStoredCourseProgress()!;
  for (const comp of competenciesForLevel('B2')) {
    p.competencyMastery[comp.id] = Math.max(p.competencyMastery[comp.id] ?? 0, comp.masteryThreshold);
    p.competencyGates[comp.id] = 'strong';
  }
  for (const k of Object.keys(p.skillLevels) as (keyof typeof p.skillLevels)[]) {
    p.skillLevels[k] = 'B2';
  }
  await saveCourseProgress(p);
  check('readyForNextLevel', readyForNextLevel(getStoredCourseProgress()!));
  check('nextAssessmentTarget C1', nextAssessmentTarget(getStoredCourseProgress()!) === 'C1');
  check('assess.b2 cobre 8 comps', (assessmentFor('B2')?.competencies.length ?? 0) === 8);
  check('gradeAssessment(C1) com evidência B2', gradeAssessment('C1', 80, 20, 2).passed);

  const b1Before = getB1Targets().length;
  const c1Before = getC1Targets().length;
  const gradOk = await maybeGraduateB2ToC1(profileB2(), learning);
  check('gate passa → C1', gradOk.graduated === true && gradOk.progress?.currentLevel === 'C1');
  check('B1 intacto', getB1Targets().length === b1Before);
  check('C1 intacto', getC1Targets().length === c1Before);

  _store.clear();
  await saveCourseProgress({ ...defaultCourseProgress('basic'), currentLevel: 'B2' });
  const p2 = getStoredCourseProgress()!;
  for (const comp of competenciesForLevel('B2')) {
    p2.competencyMastery[comp.id] = Math.max(p2.competencyMastery[comp.id] ?? 0, comp.masteryThreshold);
    p2.competencyGates[comp.id] = 'strong';
  }
  for (const k of Object.keys(p2.skillLevels) as (keyof typeof p2.skillLevels)[]) {
    p2.skillLevels[k] = 'B2';
  }
  await saveCourseProgress(p2);
  const incomplete = markReady(emptyLearningProfile(), getB2Targets().slice(0, 10).map((t) => t.id));
  const gradIncomplete = await maybeGraduateB2ToC1(profileB2(), incomplete);
  check('gate bloqueia currículo incompleto', !gradIncomplete.graduated && gradIncomplete.reason.includes('incomplete'));

  let learningExitFail = markReady(emptyLearningProfile(), getB2Targets().map((t) => t.id));
  for (const sc of B2_EXIT_SCENARIOS.slice(6)) {
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
    currentLevel: 'B2',
    competencyMastery: Object.fromEntries(competenciesForLevel('B2').map((c) => [c.id, c.masteryThreshold])),
    skillLevels: {
      listening: 'B2',
      speaking: 'B2',
      reading: 'B2',
      writing: 'B2',
      pronunciation: 'B2',
      grammar: 'B2',
      vocabulary: 'B2',
      communication: 'B2',
    },
  });
  const gradExit = await maybeGraduateB2ToC1(profileB2(), learningExitFail);
  check('critério insuficiente permanece B2', !gradExit.graduated && getStoredCourseProgress()?.currentLevel === 'B2');
  check('motivo curriculum ou exit', /b2_curriculum_incomplete|b2_exit_incomplete|not_ready/.test(gradExit.reason));

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

  console.log(`\nB2 audit tests: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
