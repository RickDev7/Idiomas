/* Desbloqueio da jornada: contentLevel <= userLevel.
   Rodar: npx tsx scripts/test-course-unlock.ts */
const _store = new Map<string, string>();
(globalThis as { localStorage: Storage }).localStorage = {
  getItem: (k: string) => _store.get(k) ?? null,
  setItem: (k: string, v: string) => { _store.set(k, v); },
  removeItem: (k: string) => { _store.delete(k); },
  clear: () => { _store.clear(); },
  key: () => null,
  length: 0,
} as Storage;

import type { CourseLevelId, CourseProgress, SkillId } from '../src/services/course/types';
import {
  getLevelRank,
  isContentUnlocked,
  getContentAvailability,
  getLevelAvailability,
  unlockSummary,
  LEVEL_RANK,
  LEVEL_ORDER,
  competencyStatusForLevel,
  buildRecommendation,
  defaultCourseProgress,
  advanceToNextLevel,
  saveCourseProgress,
  loadCourseProgress,
  getCurrentLevel,
  placeAtLevel,
  overallLevel,
  recomputeSkillLevels,
} from '../src/services/course/index';
import type { Progress, UserProfile } from '../src/types';

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean) {
  if (cond) { passed++; console.log(`  ✓ ${name}`); }
  else { failed++; console.error(`  ✗ ${name}`); }
}

const SKILLS: SkillId[] = [
  'listening', 'speaking', 'reading', 'writing',
  'pronunciation', 'grammar', 'vocabulary', 'communication',
];

function courseAt(level: CourseLevelId, mastery: Record<string, number> = {}): CourseProgress {
  const skillLevels = {} as Record<SkillId, CourseLevelId>;
  for (const k of SKILLS) skillLevels[k] = level;
  return {
    currentLevel: level,
    skillLevels,
    competencyMastery: mastery,
    competencyGates: {},
    completedLevels: LEVEL_ORDER.filter((id) => getLevelRank(id) < getLevelRank(level)),
    updatedAt: new Date().toISOString(),
  };
}

function profile(over: Partial<UserProfile> = {}): Pick<UserProfile, 'selfReportedLevel' | 'diagnosticLevel'> {
  return { selfReportedLevel: over.selfReportedLevel, diagnosticLevel: over.diagnosticLevel };
}

const baseProgress: Progress = {
  id: 'p', communicationScore: 0, comprehension: 0, production: 0, retention: 0,
  vocabulary: 0, listening: 0, pronunciation: 0, conversation: 0, spontaneity: 0,
  totalStudyMinutes: 0, wordsLearned: 0, phrasesLearned: 0, phrasesAutomatic: 0,
  conversationsCompleted: 0, missionsCompleted: 0, weeklyScores: [], bottlenecks: [],
};

console.log('— getLevelRank / LEVEL_RANK');
check('L0 = 0', getLevelRank('L0') === 0 && LEVEL_RANK.L0 === 0);
check('A1 = 1', getLevelRank('A1') === 1);
check('A2 = 2', getLevelRank('A2') === 2);
check('B1 = 3', getLevelRank('B1') === 3);
check('B2 = 4', getLevelRank('B2') === 4);
check('C1 = 5', getLevelRank('C1') === 5);
check('C2 = 6', getLevelRank('C2') === 6);
check('ordem crescente', LEVEL_ORDER.every((id, i) => getLevelRank(id) === i));
check('não compara strings: "B1" < "A2" em rank', getLevelRank('B1') > getLevelRank('A2'));

console.log('— isContentUnlocked');
check('A2 desbloqueia L0', isContentUnlocked('L0', 'A2') === true);
check('A2 desbloqueia A1', isContentUnlocked('A1', 'A2') === true);
check('A2 desbloqueia A2', isContentUnlocked('A2', 'A2') === true);
check('A2 NÃO desbloqueia B1', isContentUnlocked('B1', 'A2') === false);
check('L0 só desbloqueia L0', isContentUnlocked('A1', 'L0') === false && isContentUnlocked('L0', 'L0') === true);
check('C2 desbloqueia tudo', LEVEL_ORDER.every((id) => isContentUnlocked(id, 'C2')));

console.log('— getLevelAvailability por nível do usuário');
function journeyOk(user: CourseLevelId, expectedUnlocked: CourseLevelId[]) {
  const { unlocked, locked } = unlockSummary(user);
  const avail = LEVEL_ORDER.map((id) => getLevelAvailability(id, user));
  const rec = buildRecommendation(courseAt(user), user);
  const okUnlock = expectedUnlocked.every((id) => unlocked.includes(id));
  const okLock = LEVEL_ORDER.filter((id) => !expectedUnlocked.includes(id)).every((id) => locked.includes(id));
  const current = expectedUnlocked[expectedUnlocked.length - 1];
  const journeyMatch = rec.journey.every((j) => {
    if (j.level === current) return j.status === 'current';
    if (expectedUnlocked.includes(j.level)) return j.status === 'done';
    return j.status === 'locked';
  });
  return okUnlock && okLock && journeyMatch && avail.filter((a) => a !== 'locked').length === expectedUnlocked.length;
}

check('Nível 0: só L0', journeyOk('L0', ['L0']));
check('A1: L0+A1', journeyOk('A1', ['L0', 'A1']));
check('A2: L0+A1+A2', journeyOk('A2', ['L0', 'A1', 'A2']));
check('B1: até B1', journeyOk('B1', ['L0', 'A1', 'A2', 'B1']));
check('B2: até B2', journeyOk('B2', ['L0', 'A1', 'A2', 'B1', 'B2']));
check('C1: até C1', journeyOk('C1', ['L0', 'A1', 'A2', 'B1', 'B2', 'C1']));
check('C2: tudo', journeyOk('C2', [...LEVEL_ORDER]));

console.log('— getContentAvailability');
const a2Avail = getContentAvailability({
  contentLevel: 'A1', userLevel: 'A2', mastery: 0, threshold: 70,
});
check('A1 mastery 0 com usuário A2 = AVAILABLE (não LOCKED)', a2Avail.state === 'AVAILABLE' && a2Avail.canOpen);
check('B1 com usuário A2 = LOCKED_BY_LEVEL', getContentAvailability({
  contentLevel: 'B1', userLevel: 'A2', mastery: 0, threshold: 60,
}).state === 'LOCKED_BY_LEVEL');
check('dominado continua clicável', getContentAvailability({
  contentLevel: 'A1', userLevel: 'A2', mastery: 92, threshold: 70,
}).state === 'MASTERED' && getContentAvailability({
  contentLevel: 'A1', userLevel: 'A2', mastery: 92, threshold: 70,
}).canOpen === true);

const gap = getContentAvailability({
  contentLevel: 'A1', userLevel: 'A2', mastery: 32, threshold: 65,
});
check('gap A1 mastery 32 = NEEDS_REVIEW, não LOCKED', gap.state === 'NEEDS_REVIEW' && gap.canOpen && gap.unlocked);

const prereqCurrent = getContentAvailability({
  contentLevel: 'A2',
  userLevel: 'A2',
  mastery: 0,
  threshold: 60,
  prerequisites: ['a1.routine'],
  competencyMastery: {},
});
check('aula A2 com pré-requisito A1 faltando = LOCKED_BY_PREREQUISITE', prereqCurrent.state === 'LOCKED_BY_PREREQUISITE');
check('pré-requisito tem título', (prereqCurrent.unmetPrerequisiteTitle ?? '').length > 0);

const prereqPast = getContentAvailability({
  contentLevel: 'A1',
  userLevel: 'A2',
  mastery: 0,
  threshold: 65,
  prerequisites: ['l0.basics'],
  competencyMastery: {},
});
check('competência de nível anterior NÃO trava por pré-requisito', prereqPast.state === 'AVAILABLE');

console.log('— Competências na jornada (A2)');
const cpA2 = courseAt('A2', { 'a1.family': 32, 'a1.help': 0, 'l0.greet': 90 });
const a1Comps = competencyStatusForLevel(cpA2, 'A1', 'A2');
const l0Comps = competencyStatusForLevel(cpA2, 'L0', 'A2');
const b1Comps = competencyStatusForLevel(cpA2, 'B1', 'A2');
check('A1 competências nunca LOCKED_BY_LEVEL em A2', a1Comps.every((c) => c.availability.state !== 'LOCKED_BY_LEVEL'));
check('A1 fraca = NEEDS_REVIEW', a1Comps.find((c) => c.id === 'a1.family')?.availability.state === 'NEEDS_REVIEW');
check('A1 zerada = AVAILABLE', a1Comps.find((c) => c.id === 'a1.help')?.availability.state === 'AVAILABLE');
check('L0 dominada = MASTERED', l0Comps.find((c) => c.id === 'l0.greet')?.availability.state === 'MASTERED');
check('B1 competências LOCKED_BY_LEVEL em A2', b1Comps.every((c) => c.availability.state === 'LOCKED_BY_LEVEL' && !c.availability.canOpen));
check('A2 competências desbloqueadas por nível', competencyStatusForLevel(cpA2, 'A2', 'A2').every((c) => c.availability.unlocked));

console.log('— Fonte de verdade (diagnóstico / autoavaliação)');
check('diagnóstico A2 desbloqueia até A2 mesmo com curso L0', (() => {
  const user = getCurrentLevel(profile({ diagnosticLevel: 'A2' }), defaultCourseProgress('zero'));
  return user === 'A2' && isContentUnlocked('A1', user) && !isContentUnlocked('B1', user);
})());
check('selfReported advanced (B2) + diagnóstico A2 → A2', getCurrentLevel(profile({
  selfReportedLevel: 'advanced',
  diagnosticLevel: 'A2',
})) === 'A2');
check('sem diagnóstico usa selfReported beginner → A1', getCurrentLevel(profile({ selfReportedLevel: 'beginner' })) === 'A1');
check('primeiro uso → L0', getCurrentLevel(profile()) === 'L0');

console.log('— Sem regressão: overall baixo não relocka');
let weak = courseAt('A2');
weak = recomputeSkillLevels(weak, {
  ...baseProgress,
  listening: 35, production: 80, pronunciation: 80, vocabulary: 60, comprehension: 60, conversation: 70,
});
check('overall pode cair para A1', overallLevel(weak) === 'A1');
check('jornada continua A2 (currentLevel)', buildRecommendation(weak, getCurrentLevel(profile({ diagnosticLevel: 'A2' }), weak)).journey[2].status === 'current');
check('A1 permanece desbloqueado', isContentUnlocked('A1', getCurrentLevel(profile({ diagnosticLevel: 'A2' }), weak)));

console.log('— Progressão A1 → A2');
let prog = placeAtLevel(defaultCourseProgress('zero'), 'A1');
const before = unlockSummary(prog.currentLevel);
check('em A1, A2 bloqueado', before.locked.includes('A2'));
prog = advanceToNextLevel(prog);
const after = unlockSummary(prog.currentLevel);
check('após avanço, A2 desbloqueado', after.unlocked.includes('A2') && prog.currentLevel === 'A2');
check('B1 continua bloqueado', after.locked.includes('B1'));

console.log('— Persistência');
_store.clear();
const persisted = courseAt('A2');
await saveCourseProgress(persisted);
const loaded = await loadCourseProgress('zero');
const loadedUser = getCurrentLevel(profile({ diagnosticLevel: 'A2' }), loaded);
check('após save/load currentLevel = A2', loaded.currentLevel === 'A2');
check('após save/load desbloqueio até A2', isContentUnlocked('A2', loadedUser) && !isContentUnlocked('B1', loadedUser));
check('não persiste lock incorreto de A1', competencyStatusForLevel(loaded, 'A1', loadedUser).every((c) => c.availability.state !== 'LOCKED_BY_LEVEL'));

console.log(`\nResultado: ${passed} passaram, ${failed} falharam`);
if (failed > 0) process.exit(1);
