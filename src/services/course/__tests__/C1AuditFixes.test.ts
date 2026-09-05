/**
 * Auditoria C1 escolar: contagem exclusiva, exit, gate C1→C2.
 * Rodar: npx tsx src/services/course/__tests__/C1AuditFixes.test.ts
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
  C1_CURRICULUM,
  C1_EXIT_SCENARIOS,
  C1_LEGACY_PLACEMENT,
  assertC1CurriculumIntegrity,
  auditC1Targets,
  getC1Targets,
  getC1TargetsByCompetency,
  getC1TargetsByUnit,
  gradeC1ExitAssessment,
  isC1CurriculumComplete,
  isC1TargetId,
} from '@/services/course/C1Curriculum';
import { competenciesForLevel } from '@/services/course/competencies';
import {
  defaultCourseProgress,
  readyForNextLevel,
  saveCourseProgress,
  getStoredCourseProgress,
} from '@/services/course/CourseProgressEngine';
import { maybeGraduateC1ToC2 } from '@/services/course/L0ToA1Graduation';
import { assessmentFor, gradeAssessment, nextAssessmentTarget } from '@/services/course/LevelAssessment';
import { LEVEL_BY_ID } from '@/services/course/levels';
import { emptyLearningProfile } from '@/services/learning/RealProgress';
import { emptyConfidence, type UserLearningProfile } from '@/services/learning/ConfidenceService';
import type { UserProfile } from '@/types';
import { getB2Targets } from '@/services/course/B2Curriculum';
import { getC2Targets } from '@/services/course/C2Curriculum';

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
    id: 'u-c1-audit',
    name: 'Audit',
    level: 'basic',
    selfReportedLevel: 'advanced',
    diagnosticLevel: 'C1',
    goal: 'work',
    dailyMinutes: 20,
    germanPercentage: 100,
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
  console.log('\n=== Auditoria C1 ===');
  const integrity = assertC1CurriculumIntegrity();
  check('integrity ok', integrity.ok);
  if (!integrity.ok) console.error(integrity.errors);

  const audit = auditC1Targets();
  check('56 targets', audit.total === 56 && getC1Targets().length === 56);
  check('24 reutilizados', audit.reused === 24);
  check('32 novos', audit.novo === 32);
  check('reused+novo = total', audit.reused + audit.novo === audit.total);
  check('sem duplicatas', audit.duplicateIds.length === 0);
  check('legacy map tem 24', Object.keys(C1_LEGACY_PLACEMENT).length === 24);
  check('sem reorganização de colocação', audit.reorganizedAmongReused === 0);
  check('todos IDs únicos', new Set(C1_CURRICULUM.map((t) => t.id)).size === C1_CURRICULUM.length);
  check('todos c1-', C1_CURRICULUM.every((t) => isC1TargetId(t.id)));

  console.log('\n=== Módulos / competências ===');
  check('8 unidades', LEVEL_BY_ID.C1.modules.flatMap((m) => m.units).length === 8);
  check('8 competências', competenciesForLevel('C1').length === 8);
  for (const u of ['c1.u1', 'c1.u2', 'c1.u3', 'c1.u4', 'c1.u5', 'c1.u6', 'c1.u7', 'c1.u8']) {
    check(`${u} tem 7`, getC1TargetsByUnit(u).length === 7);
  }
  check('nuance 7', getC1TargetsByCompetency('c1.nuance').length === 7);
  check('spontaneous 7', getC1TargetsByCompetency('c1.spontaneous').length === 7);

  console.log('\n=== Exit C1 ===');
  check('10 cenários de saída', C1_EXIT_SCENARIOS.length === 10);
  for (const sc of C1_EXIT_SCENARIOS) {
    for (const id of sc.evidenceTargetIds) {
      check(`exit evidence ${sc.id}/${id}`, isC1TargetId(id));
    }
  }
  check('exit vazio falha', !gradeC1ExitAssessment(emptyLearningProfile()).passed);

  let learning = markReady(emptyLearningProfile(), getC1Targets().map((t) => t.id));
  check('currículo completo', isC1CurriculumComplete(learning));
  const exitOk = gradeC1ExitAssessment(learning);
  check('exit 10/10 passa', exitOk.passed && exitOk.scenariosPassed === 10);

  const sevenIds = new Set(C1_EXIT_SCENARIOS.slice(0, 7).flatMap((s) => s.evidenceTargetIds));
  const failIds = new Set(C1_EXIT_SCENARIOS.slice(7).flatMap((s) => s.evidenceTargetIds));
  check('exit ≥7 passa', gradeC1ExitAssessment(markReady(emptyLearningProfile(), [...sevenIds])).passed);
  check(
    'exit <7 falha',
    !gradeC1ExitAssessment(
      markReady(
        emptyLearningProfile(),
        [...sevenIds].filter((id) => !failIds.has(id) && !C1_EXIT_SCENARIOS[6]!.evidenceTargetIds.includes(id)),
      ),
    ).passed,
  );

  console.log('\n=== Gate C1→C2 ===');
  _store.clear();
  await saveCourseProgress({ ...defaultCourseProgress('basic'), currentLevel: 'C1' });
  const p = getStoredCourseProgress()!;
  for (const comp of competenciesForLevel('C1')) {
    p.competencyMastery[comp.id] = Math.max(p.competencyMastery[comp.id] ?? 0, comp.masteryThreshold);
    p.competencyGates[comp.id] = 'strong';
  }
  for (const k of Object.keys(p.skillLevels) as (keyof typeof p.skillLevels)[]) {
    p.skillLevels[k] = 'C1';
  }
  await saveCourseProgress(p);
  check('readyForNextLevel', readyForNextLevel(getStoredCourseProgress()!));
  check('nextAssessmentTarget C2', nextAssessmentTarget(getStoredCourseProgress()!) === 'C2');
  check('assess.c1 cobre 8 comps', (assessmentFor('C1')?.competencies.length ?? 0) === 8);
  check('gradeAssessment(C2) com evidência C1', gradeAssessment('C2', 80, 20, 2).passed);

  const b2Before = getB2Targets().length;
  const c2Before = getC2Targets().length;
  const gradOk = await maybeGraduateC1ToC2(profileC1(), learning);
  check('gate passa → C2', gradOk.graduated === true && gradOk.progress?.currentLevel === 'C2');
  check('B2 intacto', getB2Targets().length === b2Before);
  check('C2 intacto', getC2Targets().length === c2Before);

  _store.clear();
  await saveCourseProgress({ ...defaultCourseProgress('basic'), currentLevel: 'C1' });
  const p2 = getStoredCourseProgress()!;
  for (const comp of competenciesForLevel('C1')) {
    p2.competencyMastery[comp.id] = Math.max(p2.competencyMastery[comp.id] ?? 0, comp.masteryThreshold);
    p2.competencyGates[comp.id] = 'strong';
  }
  for (const k of Object.keys(p2.skillLevels) as (keyof typeof p2.skillLevels)[]) {
    p2.skillLevels[k] = 'C1';
  }
  await saveCourseProgress(p2);
  const incomplete = markReady(emptyLearningProfile(), getC1Targets().slice(0, 10).map((t) => t.id));
  const gradIncomplete = await maybeGraduateC1ToC2(profileC1(), incomplete);
  check('gate bloqueia currículo incompleto', !gradIncomplete.graduated && gradIncomplete.reason.includes('incomplete'));

  let learningExitFail = markReady(emptyLearningProfile(), getC1Targets().map((t) => t.id));
  for (const sc of C1_EXIT_SCENARIOS.slice(6)) {
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
    currentLevel: 'C1',
    competencyMastery: Object.fromEntries(competenciesForLevel('C1').map((c) => [c.id, c.masteryThreshold])),
    skillLevels: {
      listening: 'C1',
      speaking: 'C1',
      reading: 'C1',
      writing: 'C1',
      pronunciation: 'C1',
      grammar: 'C1',
      vocabulary: 'C1',
      communication: 'C1',
    },
  });
  const gradExit = await maybeGraduateC1ToC2(profileC1(), learningExitFail);
  check('critério insuficiente permanece C1', !gradExit.graduated && getStoredCourseProgress()?.currentLevel === 'C1');
  check('motivo curriculum ou exit', /c1_curriculum_incomplete|c1_exit_incomplete|not_ready/.test(gradExit.reason));

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

  console.log(`\nC1 audit tests: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
