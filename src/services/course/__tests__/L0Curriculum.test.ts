/**
 * L0Curriculum — pré-A1 com 8 módulos.
 * Rodar: npx tsx src/services/course/__tests__/L0Curriculum.test.ts
 */
const _store = new Map<string, string>();
const _session = new Map<string, string>();
(globalThis as { localStorage: Storage }).localStorage = {
  getItem: (k) => _store.get(k) ?? null,
  setItem: (k, v) => {
    _store.set(k, String(v));
  },
  removeItem: (k) => {
    _store.delete(k);
  },
  clear: () => _store.clear(),
  key: () => null,
  length: 0,
} as Storage;
(globalThis as { sessionStorage: Storage }).sessionStorage = {
  getItem: (k) => _session.get(k) ?? null,
  setItem: (k, v) => {
    _session.set(k, String(v));
  },
  removeItem: (k) => {
    _session.delete(k);
  },
  clear: () => _session.clear(),
  key: () => null,
  length: 0,
} as Storage;

import { emptyLearningProfile } from '@/services/learning/RealProgress';
import { emptyConfidence, type UserLearningProfile } from '@/services/learning/ConfidenceService';
import type { UserProfile } from '@/types';
import {
  assertL0CurriculumIntegrity,
  getL0Targets,
  getL0TargetsByUnit,
  getL0TargetsByCompetency,
  L0_UNIT_IDS_IN_ORDER,
  L0_UNIT_TITLES,
  L0_NEW_TARGET_IDS,
  L0_EXIT_SCENARIOS,
  isL0CurriculumComplete,
  gradeL0ExitAssessment,
  mergeL0CurriculumPhrases,
} from '@/services/course/L0Curriculum';
import { getModules, getModule } from '@/services/course/CurriculumModuleRegistry';
import { competenciesForLevel } from '@/services/course/competencies';
import {
  defaultCourseProgress,
  saveCourseProgress,
  readyForNextLevel,
} from '@/services/course/CourseProgressEngine';
import {
  maybeGraduateL0ToA1,
  syncL0CompetencyMasteryFromLearning,
} from '@/services/course/L0ToA1Graduation';
import { gradeAssessment } from '@/services/course/LevelAssessment';
import {
  isZeroLanguageMode,
  isL0CoreCurriculumComplete,
  ZERO_LANGUAGE_BLOCKS,
  pickZeroLanguageTarget,
  zeroLanguageSeedPhrases,
  L0_MAX_CORRECTION_ATTEMPTS,
  L0_MIN_CORRECT_BEFORE_ADVANCE,
} from '@/services/teacher/ZeroLanguageMode';
import { buildConversationPlan } from '@/services/teacher/ConversationOrchestrator';
import { getContinueCourseState } from '@/services/course/ContinueCourse';
import {
  buildModuleSessionContext,
  storeSelectedModuleContext,
  consumeSelectedModuleContext,
} from '@/services/course/CurriculumModule';
import { getRealProgress } from '@/services/learning/RealProgress';
import { buildReviewQueue } from '@/services/learning/ReviewEngine';

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

function profileL0(): UserProfile {
  return {
    id: 'l0-test',
    name: 'L0',
    level: 'zero',
    selfReportedLevel: 'zero',
    diagnosticLevel: 'L0',
    goal: 'daily',
    dailyMinutes: 20,
    germanPercentage: 40,
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

function acceptAll(ids: string[], learning = emptyLearningProfile()): UserLearningProfile {
  const phrases = { ...learning.phrases };
  for (const id of ids) {
    phrases[id] = {
      ...emptyConfidence(id),
      timesCorrect: 3,
      timesProduced: 4,
      timesSeen: 4,
      confidence: 85,
      state: 'spontaneous',
      successiveSuccess: 2,
      spontaneousSessions: 2,
      automationScore: 70,
      lastProduced: new Date().toISOString(),
      lastSeen: new Date().toISOString(),
    };
  }
  return { ...learning, phrases };
}

console.log('\n— Integrity / 8 units');
const integrity = assertL0CurriculumIntegrity();
check('integrity ok', integrity.ok);
if (!integrity.ok) console.error(integrity.errors);
check('8 unit ids', L0_UNIT_IDS_IN_ORDER.length === 8);
check('u1 title', L0_UNIT_TITLES['l0.u1'] === 'Primeiros contatos');
check('u8 title', L0_UNIT_TITLES['l0.u8'] === 'Minhas primeiras frases');

console.log('\n— Competências / módulos');
const comps = competenciesForLevel('L0');
check('8 competências', comps.length === 8);
check('sem yesno/thanks/repeat', !comps.some((c) => ['l0.yesno', 'l0.thanks', 'l0.repeat'].includes(c.id)));
check('tem people/world/phrases', comps.some((c) => c.id === 'l0.people') && comps.some((c) => c.id === 'l0.world') && comps.some((c) => c.id === 'l0.phrases'));
const mods = getModules('L0');
check('getModules L0 = 8', mods.length === 8);
check('ordem u1→u8', mods.every((m, i) => m.id === L0_UNIT_IDS_IN_ORDER[i]));
check('cada módulo tem targets', mods.every((m) => m.targetIds.length > 0));
check('sem target duplicado', (() => {
  const s = new Set<string>();
  for (const m of mods) for (const id of m.targetIds) {
    if (s.has(id)) return false;
    s.add(id);
  }
  return true;
})());

console.log('\n— Targets');
const all = getL0Targets();
check('targets > 40', all.length >= 40);
check('novos documentados', L0_NEW_TARGET_IDS.length > 0);
check('u1 greetings', getL0TargetsByUnit('l0.u1').some((t) => t.id === 'l0-hallo'));
check('u2 introduce', getL0TargetsByUnit('l0.u2').some((t) => t.id === 'l0-ich-heisse'));
check('u5 help', getL0TargetsByCompetency('l0.help').some((t) => t.id === 'l0-verstehe-nicht'));
check('u8 survival-arbeite', getL0TargetsByUnit('l0.u8').some((t) => t.id === 'survival-arbeite'));
check('existing preserved hallo', all.some((t) => t.id === 'l0-hallo'));
check('existing preserved danke', all.some((t) => t.id === 'l0-danke'));

console.log('\n— Progressão linear');
check('u2 prereq u1', mods[1]!.prerequisiteModuleIds.includes('l0.u1'));
check('u8 prereq u7', mods[7]!.prerequisiteModuleIds.includes('l0.u7'));

console.log('\n— zeroLanguageMode / blocks / anti-loop');
check('ZLM true L0', isZeroLanguageMode(profileL0()));
check('8 blocks', ZERO_LANGUAGE_BLOCKS.length === 8);
check('retry max preserved', L0_MAX_CORRECTION_ATTEMPTS >= 1);
check('min correct preserved', L0_MIN_CORRECT_BEFORE_ADVANCE >= 1);
const pool = mergeL0CurriculumPhrases(zeroLanguageSeedPhrases());
const pick = pickZeroLanguageTarget(emptyLearningProfile(), pool);
check('planner pick L0', !!pick.phrase && (pick.phrase.id.startsWith('l0-') || pick.phrase.id === 'survival-arbeite'));

console.log('\n— Module integration / Continue Course / Module Context');
const cont = getContinueCourseState({
  learning: emptyLearningProfile(),
  userLevel: 'L0',
  course: defaultCourseProgress('zero'),
});
check('continue L0 módulo 1', cont.moduleId === 'l0.u1' || cont.sessionModule?.id === 'l0.u1');
const u3 = getModule('L0', 'l0.u3');
check('u3 module exists', !!u3);
const ctx = u3 ? buildModuleSessionContext(u3) : null;
if (ctx) storeSelectedModuleContext(ctx);
const consumed = consumeSelectedModuleContext('L0');
check('module context u3', consumed?.moduleId === 'l0.u3');
check('module context targets', (consumed?.targetIds.length ?? 0) > 0);
const plan = buildConversationPlan(profileL0(), emptyLearningProfile(), pool, 0, {
  moduleContext: consumed ?? undefined,
});
check('planner restricted to u3', !!plan.target && (consumed?.targetIds.includes(plan.target.id) ?? false));

console.log('\n— Gate L0 → A1 + exit assessment');
_store.clear();
let learning = acceptAll(all.map((t) => t.id));
check('curriculum complete', isL0CurriculumComplete(learning));
check('core blocks complete', isL0CoreCurriculumComplete(learning));
const exit = gradeL0ExitAssessment(learning);
check('exit scenarios ≥4', exit.scenariosPassed >= 4);
check('exit passed', exit.passed);
check('5 exit scenarios defined', L0_EXIT_SCENARIOS.length === 5);
let progress = syncL0CompetencyMasteryFromLearning(defaultCourseProgress('zero'), learning);
check('readyForNextLevel', readyForNextLevel(progress));
await saveCourseProgress(progress);
const stats = {
  spoken: Object.values(learning.phrases).reduce((s, c) => s + (c.timesCorrect ?? 0), 0),
  spontaneous: Object.values(learning.phrases).reduce((s, c) => s + (c.spontaneousSessions ?? 0), 0),
  reinforced: 2,
};
check('A1 assessment passable', gradeAssessment('A1', stats.spoken, stats.spontaneous, stats.reinforced).passed);
const grad = await maybeGraduateL0ToA1(profileL0(), learning);
check('graduated L0→A1', grad.graduated === true && grad.progress?.currentLevel === 'A1');

console.log('\n— Incomplete gate');
_store.clear();
const incomplete = acceptAll(getL0TargetsByUnit('l0.u1').map((t) => t.id));
const noGrad = await maybeGraduateL0ToA1(profileL0(), incomplete);
check('incomplete não gradua', noGrad.graduated === false);

console.log('\n— Review / RealProgress');
const rp = await getRealProgress(learning, 'L0');
check('RealProgress L0 entry', rp.levelProgress.some((l) => l.level === 'L0'));
const queue = buildReviewQueue(learning.phrases, pool, new Date(), 8);
check('review queue array', Array.isArray(queue));

console.log(`\nL0Curriculum: ${passed} passaram, ${failed} falharam`);
if (failed > 0) process.exit(1);
