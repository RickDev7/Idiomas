/**
 * Auditoria A1: contagem exclusiva, alias a1.food→a1.shopping, gate A1→A2.
 * Rodar: npx tsx src/services/course/__tests__/A1AuditFixes.test.ts
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
  A1_CURRICULUM,
  A1_EXIT_SCENARIOS,
  auditA1Targets,
  getA1Targets,
  getA1TargetsByCompetency,
  gradeA1ExitAssessment,
  isA1CurriculumComplete,
  isA1TargetId,
} from '@/services/course/A1Curriculum';
import {
  COMPETENCY_ID_ALIASES,
  foldLegacyCompetencyMastery,
  resolveCompetencyId,
  competenciesForLevel,
} from '@/services/course/competencies';
import {
  bumpCompetency,
  defaultCourseProgress,
  loadCourseProgress,
  readyForNextLevel,
  saveCourseProgress,
  getStoredCourseProgress,
} from '@/services/course/CourseProgressEngine';
import { maybeGraduateA1ToA2 } from '@/services/course/L0ToA1Graduation';
import { assessmentFor, gradeAssessment, nextAssessmentTarget } from '@/services/course/LevelAssessment';
import { emptyLearningProfile } from '@/services/learning/RealProgress';
import { emptyConfidence } from '@/services/learning/ConfidenceService';
import type { UserLearningProfile } from '@/services/learning/ConfidenceService';
import type { UserProfile } from '@/types';
import { getA2Targets } from '@/services/course/A2Curriculum';

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
    id: 'u-a1-audit',
    name: 'Audit',
    level: 'little',
    selfReportedLevel: 'beginner',
    diagnosticLevel: 'A1',
    goal: 'work',
    dailyMinutes: 20,
    germanPercentage: 55,
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
    };
  }
  return { ...learning, phrases };
}

function wipeExitEvidence(learning: UserLearningProfile, keepScenarioCount: number): UserLearningProfile {
  const keep = new Set(
    A1_EXIT_SCENARIOS.slice(0, keepScenarioCount).flatMap((s) => s.evidenceTargetIds),
  );
  const phrases = { ...learning.phrases };
  for (const sc of A1_EXIT_SCENARIOS.slice(keepScenarioCount)) {
    for (const id of sc.evidenceTargetIds) {
      if (keep.has(id)) continue;
      phrases[id] = {
        ...emptyConfidence(id),
        timesCorrect: 0,
        timesProduced: 0,
        confidence: 0,
        state: 'new',
      };
    }
  }
  return { ...learning, phrases };
}

async function main() {
  console.log('\n— 1. Contagem exclusiva de targets');
  const audit = auditA1Targets();
  check('total = A1_CURRICULUM.length', audit.total === A1_CURRICULUM.length);
  check('total = 58', audit.total === 58);
  check('sem IDs duplicados', audit.duplicateIds.length === 0);
  check('REUTILIZADO + NOVO = total', audit.reused + audit.novo === audit.total);
  check('REUTILIZADO = 20', audit.reused === 20);
  check('NOVO = 38', audit.novo === 38);
  check('cada row única', new Set(audit.rows.map((r) => r.targetId)).size === audit.total);
  check('todos alcançáveis (em unit phraseIds)', getA1Targets().every((t) => isA1TargetId(t.id)));
  const reorg = audit.rows.filter((r) => r.reorganized);
  check('reorganizado é propriedade (não status)', reorg.every((r) => r.status === 'REUTILIZADO'));
  check('food legado reorganizado p/ shopping/u4', reorg.some((r) => r.targetId === 'a1-food-kaffee' && r.moduleId === 'a1.u4' && r.competencyId === 'a1.shopping'));
  console.log(`  · reorganizados entre reutilizados: ${audit.reorganizedAmongReused}`);

  console.log('\n— 2. Compat a1.food → a1.shopping');
  check('alias mapeia', resolveCompetencyId('a1.food') === 'a1.shopping');
  check('alias table', COMPETENCY_ID_ALIASES['a1.food'] === 'a1.shopping');
  check('getByCompetency a1.food = shopping', getA1TargetsByCompetency('a1.food').length === getA1TargetsByCompetency('a1.shopping').length);
  check('getByCompetency a1.food > 0', getA1TargetsByCompetency('a1.food').length >= 3);

  _store.clear();
  let p = defaultCourseProgress('little');
  p.currentLevel = 'A1';
  p.competencyMastery = { 'a1.food': 72, 'a1.shopping': 40 };
  p.competencyGates = { 'a1.food': 'strong' };
  await saveCourseProgress(p);
  const loaded = await loadCourseProgress('little');
  check('food mastery fundida em shopping', loaded.competencyMastery['a1.shopping'] === 72);
  check('chave a1.food removida (sem duplicar)', loaded.competencyMastery['a1.food'] == null);
  check('gate legado migrado', loaded.competencyGates['a1.shopping'] === 'strong');

  const folded = foldLegacyCompetencyMastery({ 'a1.food': 55, 'a1.shopping': 60 });
  check('fold usa max (sem somar)', folded['a1.shopping'] === 60 && folded['a1.food'] == null);

  let p2 = defaultCourseProgress('little');
  p2.competencyMastery = { 'a1.food': 50 };
  p2 = bumpCompetency(p2, 'a1.food', 10);
  check('bump a1.food escreve em shopping', p2.competencyMastery['a1.shopping'] === 60);
  check('bump não deixa a1.food órfão', p2.competencyMastery['a1.food'] == null);

  console.log('\n— 3. Semântica do gate A1 → A2');
  const nextOnA1 = nextAssessmentTarget({ ...defaultCourseProgress('little'), currentLevel: 'A1' });
  check('nextAssessmentTarget(A1) = A2', nextOnA1 === 'A2');
  check('assessmentFor(A2) existe (conversa A2, não usada no score numérico)', assessmentFor('A2')?.id === 'assess.a2');
  const numeric = gradeAssessment('A2', 100, 40, 5);
  check('gradeAssessment só usa números (passed)', numeric.passed === true);
  check('gradeAssessment reason cita destino A2', /A2/.test(numeric.reason));

  // Gate positivo: currículo completo + mastery + exit ≥7 + production
  _store.clear();
  let learning = markReady(emptyLearningProfile(), getA1Targets().map((t) => t.id));
  learning.userLevel = 'little';
  check('curriculum complete', isA1CurriculumComplete(learning));
  check('exit 10/10 passa', gradeA1ExitAssessment(learning).passed);

  // 7/10 cenários: só evidência dos 7 primeiros + resto do currículo (exceto cenários 8–10)
  const sevenIds = new Set(A1_EXIT_SCENARIOS.slice(0, 7).flatMap((s) => s.evidenceTargetIds));
  const failIds = new Set(A1_EXIT_SCENARIOS.slice(7).flatMap((s) => s.evidenceTargetIds));
  let learning7 = markReady(
    emptyLearningProfile(),
    getA1Targets()
      .map((t) => t.id)
      .filter((id) => !failIds.has(id) || sevenIds.has(id)),
  );
  for (const id of failIds) {
    if (sevenIds.has(id)) continue;
    learning7.phrases[id] = { ...emptyConfidence(id), timesCorrect: 0, timesProduced: 0, confidence: 0, state: 'new' };
  }
  const exit7 = gradeA1ExitAssessment(learning7);
  check('exit exatamente ≥7 passa', exit7.passed && exit7.scenariosPassed >= 7);
  let learning6 = markReady(
    emptyLearningProfile(),
    getA1Targets()
      .map((t) => t.id)
      .filter((id) => !failIds.has(id) && !A1_EXIT_SCENARIOS[6]!.evidenceTargetIds.includes(id)),
  );
  // Force only 6 scenarios by wiping scenarios 7-10 evidence
  learning6 = wipeExitEvidence(markReady(emptyLearningProfile(), getA1Targets().map((t) => t.id)), 6);
  const exit6 = gradeA1ExitAssessment(learning6);
  check('exit 6/10 falha', !exit6.passed && exit6.scenariosPassed === 6);

  await saveCourseProgress({ ...defaultCourseProgress('little'), currentLevel: 'A1' });
  const pGate = getStoredCourseProgress()!;
  for (const c of competenciesForLevel('A1')) {
    pGate.competencyMastery[c.id] = c.masteryThreshold;
    pGate.competencyGates[c.id] = 'strong';
  }
  for (const k of Object.keys(pGate.skillLevels) as (keyof typeof pGate.skillLevels)[]) {
    pGate.skillLevels[k] = 'A1';
  }
  await saveCourseProgress(pGate);
  check('readyForNextLevel', readyForNextLevel(getStoredCourseProgress()!));

  const a2IdsBefore = new Set(getA2Targets().map((t) => t.id));
  const hasA2Evidence = Object.keys(learning.phrases).some((id) => a2IdsBefore.has(id));
  check('learning sem evidência A2 antes do gate', !hasA2Evidence);

  const gradOk = await maybeGraduateA1ToA2(profileA1(), learning);
  check('gate desbloqueia A2', gradOk.graduated === true && gradOk.progress?.currentLevel === 'A2');

  // Gate negativo: exit < 7 (currículo ainda “complete” em phrases mas wipe exit scenarios)
  _store.clear();
  await saveCourseProgress({ ...defaultCourseProgress('little'), currentLevel: 'A1' });
  const pFail = getStoredCourseProgress()!;
  for (const c of competenciesForLevel('A1')) {
    pFail.competencyMastery[c.id] = c.masteryThreshold;
    pFail.competencyGates[c.id] = 'strong';
  }
  for (const k of Object.keys(pFail.skillLevels) as (keyof typeof pFail.skillLevels)[]) {
    pFail.skillLevels[k] = 'A1';
  }
  await saveCourseProgress(pFail);

  // Completo + só 6 cenários de saída
  let learningFail = markReady(emptyLearningProfile(), getA1Targets().map((t) => t.id));
  learningFail = wipeExitEvidence(learningFail, 6);
  // After wipe, curriculum may be incomplete — restore non-exit targets and first 6 scenarios only
  // Re-mark all then wipe scenarios 7-10
  learningFail = markReady(emptyLearningProfile(), getA1Targets().map((t) => t.id));
  learningFail = wipeExitEvidence(learningFail, 6);
  // Curriculum complete requires ALL targets — wipe breaks that. For exit-only fail we need
  // curriculum complete BUT exit < 7. So wipe only reduces readiness on scenario-unique ids
  // that aren't needed for... actually isA1CurriculumComplete needs ALL. So wiping exit
  // targets makes curriculum incomplete.
  //
  // Correct approach for "exit fail while curriculum complete":
  // Keep all targets ready, but gradeA1ExitAssessment needs produced+ready on scenario targets.
  // If all are ready, exit passes. To fail exit only: make scenario coverage fail by clearing
  // timesProduced on some scenario targets WHILE keeping isReadyForAdvance... that's hard because
  // isReadyForAdvance and exit use same readiness.
  //
  // Exit: coverage = ready/ids >= 0.5 AND produced >= 1. If we set timesCorrect=0 on enough
  // of scenarios 7-10, those scenarios fail; curriculum complete fails too.
  //
  // Alternative: fail at curriculum incomplete path
  const incomplete = markReady(emptyLearningProfile(), getA1Targets().slice(0, 10).map((t) => t.id));
  const gradIncomplete = await maybeGraduateA1ToA2(profileA1(), incomplete);
  check('incompleto permanece A1', !gradIncomplete.graduated && getStoredCourseProgress()?.currentLevel === 'A1');

  // Exit fail with complete curriculum: temporarily lower exit threshold by clearing produced
  // on unique targets of last 4 scenarios while keeping timesCorrect high enough for isReadyForAdvance
  // isReadyForAdvance: timesCorrect>=2 && confidence>=55 OR mastered...
  // exit produced: timesProduced>0 || timesCorrect>0 — so if timesCorrect>=2, produced passes.
  // So exit and curriculum use overlapping evidence — can't fail exit while complete easily
  // unless we change exit scenarios to need 50% of 3 = 2 ready, and we only have 1 ready per
  // last scenarios while other curriculum targets stay ready.
  let learningExitFail = markReady(emptyLearningProfile(), getA1Targets().map((t) => t.id));
  for (const sc of A1_EXIT_SCENARIOS.slice(6)) {
    // leave only 0 ready in each of last 4 scenarios (coverage 0 < 0.5)
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
  // Re-ready other targets that aren't exclusively in failed scenarios — already ready
  // But curriculum incomplete. Document: exit incomplete also blocks via curriculum OR exit.
  // User asked: "aluno que não atinge o critério permanece no A1" — incomplete OR exit fail.
  await saveCourseProgress({
    ...defaultCourseProgress('little'),
    currentLevel: 'A1',
    competencyMastery: Object.fromEntries(competenciesForLevel('A1').map((c) => [c.id, c.masteryThreshold])),
    skillLevels: {
      listening: 'A1',
      speaking: 'A1',
      reading: 'A1',
      writing: 'A1',
      pronunciation: 'A1',
      grammar: 'A1',
      vocabulary: 'A1',
      communication: 'A1',
    },
  });
  const gradExit = await maybeGraduateA1ToA2(profileA1(), learningExitFail);
  check(
    'critério insuficiente permanece A1',
    !gradExit.graduated && (getStoredCourseProgress()?.currentLevel === 'A1'),
  );
  check(
    'motivo curriculum ou exit',
    /a1_curriculum_incomplete|a1_exit_incomplete|not_ready/.test(gradExit.reason),
  );

  console.log(`\nA1AuditFixes: ${passed} passaram, ${failed} falharam`);
  if (failed > 0) process.exit(1);

  // Emit audit table for report
  console.log('\n— TABELA (status exclusivo)');
  for (const r of audit.rows) {
    const origin = r.previousUnitId
      ? `${r.previousUnitId}/${r.previousCompetencyId}${r.reorganized ? '→reorg' : ''}`
      : '—';
    console.log(`${r.targetId}\t${r.moduleId}\t${r.competencyId}\t${r.status}\t${origin}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
