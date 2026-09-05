/**
 * Auditoria C2 escolar: contagem exclusiva, exit, conclusão terminal (sem nível posterior).
 * Rodar: npx tsx src/services/course/__tests__/C2AuditFixes.test.ts
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
  C2_CURRICULUM,
  C2_EXIT_SCENARIOS,
  C2_LEGACY_PLACEMENT,
  assertC2CurriculumIntegrity,
  auditC2Targets,
  getC2Targets,
  getC2TargetsByCompetency,
  getC2TargetsByUnit,
  gradeC2ExitAssessment,
  isC2CurriculumComplete,
  isC2TargetId,
} from '@/services/course/C2Curriculum';
import { competenciesForLevel } from '@/services/course/competencies';
import {
  defaultCourseProgress,
  saveCourseProgress,
  getStoredCourseProgress,
} from '@/services/course/CourseProgressEngine';
import { maybeGraduateC2ToHigher } from '@/services/course/L0ToA1Graduation';
import { assessmentFor, nextAssessmentTarget } from '@/services/course/LevelAssessment';
import { LEVEL_BY_ID, nextLevel } from '@/services/course/levels';
import { grammarForLevel } from '@/services/course/grammar';
import { emptyLearningProfile } from '@/services/learning/RealProgress';
import { emptyConfidence, type UserLearningProfile } from '@/services/learning/ConfidenceService';
import type { UserProfile } from '@/types';
import { getC1Targets } from '@/services/course/C1Curriculum';
import { isTerminalCourseLevel } from '@/services/course/MeuCursoPresentation';

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

function profileC2(): UserProfile {
  return {
    id: 'u-c2-audit',
    name: 'Audit',
    level: 'basic',
    selfReportedLevel: 'advanced',
    diagnosticLevel: 'C2',
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

async function readyC2Progress() {
  const p = {
    ...defaultCourseProgress('basic'),
    currentLevel: 'C2' as const,
  };
  for (const comp of competenciesForLevel('C2')) {
    p.competencyMastery[comp.id] = Math.max(p.competencyMastery[comp.id] ?? 0, comp.masteryThreshold);
    p.competencyGates[comp.id] = 'strong';
  }
  for (const k of Object.keys(p.skillLevels) as (keyof typeof p.skillLevels)[]) {
    p.skillLevels[k] = 'C2';
  }
  await saveCourseProgress(p);
  return p;
}

async function main() {
  console.log('\n=== Auditoria C2 ===');
  const integrity = assertC2CurriculumIntegrity();
  check('integrity ok', integrity.ok);
  if (!integrity.ok) console.error(integrity.errors);

  const audit = auditC2Targets();
  check('56 targets', audit.total === 56 && getC2Targets().length === 56);
  check('24 reutilizados', audit.reused === 24);
  check('32 novos', audit.novo === 32);
  check('reused+novo = total', audit.reused + audit.novo === audit.total);
  check('sem duplicatas', audit.duplicateIds.length === 0);
  check('legacy map tem 24', Object.keys(C2_LEGACY_PLACEMENT).length === 24);
  check('sem reorganização de colocação', audit.reorganizedAmongReused === 0);
  check('todos IDs únicos', new Set(C2_CURRICULUM.map((t) => t.id)).size === C2_CURRICULUM.length);
  check('todos c2-', C2_CURRICULUM.every((t) => isC2TargetId(t.id)));

  console.log('\n=== Módulos / competências / gramática ===');
  check('8 unidades', LEVEL_BY_ID.C2.modules.flatMap((m) => m.units).length === 8);
  check('8 competências', competenciesForLevel('C2').length === 8);
  check('objetivo C2 escolar', /flexível|espontânea|precisa/.test(LEVEL_BY_ID.C2.objective));
  for (const u of ['c2.u1', 'c2.u2', 'c2.u3', 'c2.u4', 'c2.u5', 'c2.u6', 'c2.u7', 'c2.u8']) {
    check(`${u} tem 7`, getC2TargetsByUnit(u).length === 7);
  }
  check('nuance 7', getC2TargetsByCompetency('c2.nuance').length === 7);
  check('fluent 7', getC2TargetsByCompetency('c2.fluent').length === 7);
  check('gramática C2 ≥8', grammarForLevel('C2').length >= 8);
  check('C1 intacto 56', getC1Targets().length === 56);

  console.log('\n=== Exit C2 ===');
  check('10 cenários de saída', C2_EXIT_SCENARIOS.length === 10);
  for (const sc of C2_EXIT_SCENARIOS) {
    for (const id of sc.evidenceTargetIds) {
      check(`exit evidence ${sc.id}/${id}`, isC2TargetId(id));
    }
  }
  check('exit vazio falha', !gradeC2ExitAssessment(emptyLearningProfile()).passed);

  let learning = markReady(emptyLearningProfile(), getC2Targets().map((t) => t.id));
  check('currículo completo', isC2CurriculumComplete(learning));
  const exitOk = gradeC2ExitAssessment(learning);
  check('exit 10/10 passa', exitOk.passed && exitOk.scenariosPassed === 10);

  const sevenIds = new Set(C2_EXIT_SCENARIOS.slice(0, 7).flatMap((s) => s.evidenceTargetIds));
  check('exit ≥7 passa', gradeC2ExitAssessment(markReady(emptyLearningProfile(), [...sevenIds])).passed);
  check(
    'exit <7 falha',
    !gradeC2ExitAssessment(
      markReady(emptyLearningProfile(), C2_EXIT_SCENARIOS.slice(0, 6).flatMap((s) => s.evidenceTargetIds)),
    ).passed,
  );

  console.log('\n=== Conclusão terminal C2 ===');
  check('nextLevel(C2) null', nextLevel('C2') == null);
  check('isTerminalCourseLevel', isTerminalCourseLevel('C2'));
  check('assess.c2 cobre 8 comps', (assessmentFor('C2')?.competencies.length ?? 0) === 8);

  _store.clear();
  await readyC2Progress();
  const terminal = await maybeGraduateC2ToHigher(profileC2(), learning);
  check('terminal não gradua', terminal.graduated === false);
  check('reason terminal', terminal.reason === 'c2_terminal_no_higher_curriculum');
  check('permanece C2', terminal.progress?.currentLevel === 'C2');
  check('não inventa nextAssessment', nextAssessmentTarget(getStoredCourseProgress()!) == null);

  _store.clear();
  await readyC2Progress();
  const incomplete = markReady(emptyLearningProfile(), getC2Targets().slice(0, 10).map((t) => t.id));
  const gradIncomplete = await maybeGraduateC2ToHigher(profileC2(), incomplete);
  check('bloqueia currículo incompleto', !gradIncomplete.graduated && gradIncomplete.reason === 'incomplete');

  let learningExitFail = markReady(emptyLearningProfile(), getC2Targets().map((t) => t.id));
  for (const sc of C2_EXIT_SCENARIOS.slice(6)) {
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
  _store.clear();
  await readyC2Progress();
  const gradExit = await maybeGraduateC2ToHigher(profileC2(), learningExitFail);
  check('exit incompleto permanece C2', !gradExit.graduated && getStoredCourseProgress()?.currentLevel === 'C2');
  check('motivo curriculum ou exit', /incomplete|c2_exit_incomplete|not ready/.test(gradExit.reason));

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

  console.log(`\nC2 audit tests: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
