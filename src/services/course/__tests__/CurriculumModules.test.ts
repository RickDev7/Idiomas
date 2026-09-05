/**
 * CurriculumModules — projeção L0–C2 sem duplicar targets.
 * Rodar: npx tsx src/services/course/__tests__/CurriculumModules.test.ts
 */
const _store = new Map<string, string>();
const _session = new Map<string, string>();
(globalThis as { localStorage: Storage }).localStorage = {
  getItem: (k: string) => _store.get(k) ?? null,
  setItem: (k: string, v: string) => {
    _store.set(k, v);
  },
  removeItem: (k: string) => {
    _store.delete(k);
  },
  clear: () => {
    _store.clear();
  },
  key: () => null,
  length: 0,
} as Storage;
(globalThis as { sessionStorage: Storage }).sessionStorage = {
  getItem: (k: string) => _session.get(k) ?? null,
  setItem: (k: string, v: string) => {
    _session.set(k, v);
  },
  removeItem: (k: string) => {
    _session.delete(k);
  },
  clear: () => {
    _session.clear();
  },
  key: () => null,
  length: 0,
} as Storage;

import { emptyLearningProfile } from '@/services/learning/RealProgress';
import type { UserLearningProfile, PhraseConfidence } from '@/services/learning/ConfidenceService';
import { isZeroLanguageMode } from '@/services/teacher/ZeroLanguageMode';
import {
  LEVEL_ORDER,
  assertCurriculumModulesIntegrity,
  getModules,
  getModule,
  getModulesWithProgress,
  getCurrentModule,
  getNextModule,
  isModuleUnlocked,
  isModuleCompleted,
  getModuleProgress,
  nextTargetInModule,
  buildModuleSessionContext,
  storeSelectedModuleContext,
  readSelectedModuleContext,
  clearSelectedModuleContext,
  formatModulePedagogicalContext,
  getLevelModulesProgressPercent,
  defaultCourseProgress,
} from '@/services/course';
import type { CourseLevelId } from '@/services/course';

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

function readyConf(phraseId: string): PhraseConfidence {
  return {
    phraseId,
    confidence: 80,
    recognition: 80,
    listening: 80,
    speaking: 80,
    production: 80,
    speed: 70,
    contextTransfer: 60,
    timesSeen: 4,
    timesCorrect: 3,
    timesProduced: 3,
    state: 'answeredAlone',
    lastSeen: new Date().toISOString(),
    lastProduced: new Date().toISOString(),
    avgResponseMs: 900,
    nextReview: new Date(Date.now() + 86400000).toISOString(),
    needsHelp: false,
  };
}

function acceptAllTargets(level: CourseLevelId, learning: UserLearningProfile): UserLearningProfile {
  const next = { ...learning, phrases: { ...learning.phrases } };
  for (const m of getModules(level)) {
    for (const id of m.targetIds) {
      next.phrases[id] = readyConf(id);
    }
  }
  return next;
}

console.log('\n— Integrity');
const integ = assertCurriculumModulesIntegrity();
check('integrity ok', integ.ok);
if (!integ.ok) console.error(integ.errors.slice(0, 12));

console.log('\n— Modules per level');
const expectedCounts: Record<CourseLevelId, number> = {
  L0: 8,
  A1: 7,
  A2: 6,
  B1: 7,
  B2: 8,
  C1: 8,
  C2: 8,
};
for (const level of LEVEL_ORDER) {
  const mods = getModules(level);
  check(`${level} count=${expectedCounts[level]}`, mods.length === expectedCounts[level]);
  check(`${level} ordered 1..n`, mods.every((m, i) => m.order === i + 1));
  check(`${level} ids unique`, new Set(mods.map((m) => m.id)).size === mods.length);
  check(`${level} titles`, mods.every((m) => m.title.trim().length > 0));
  check(`${level} targetIds`, mods.every((m) => m.targetIds.length > 0));
  check(`${level} competencies`, mods.every((m) => m.competencyIds.length > 0));
  check(`${level} getModule first`, getModule(level, mods[0]!.id)?.id === mods[0]!.id);
}

console.log('\n— No target duplication across all modules');
{
  const seen = new Set<string>();
  let dup = false;
  for (const level of LEVEL_ORDER) {
    for (const m of getModules(level)) {
      for (const t of m.targetIds) {
        if (seen.has(t)) dup = true;
        seen.add(t);
      }
    }
  }
  check('unique target refs', !dup);
}

console.log('\n— L0 special');
{
  const l0 = getModules('L0');
  check('L0 first = primeiros contatos/greet', l0[0]!.competencyIds.includes('l0.greet'));
  check('L0 8 módulos', l0.length === 8);
  check('L0 last = frases', l0[7]!.id === 'l0.u8');
  check('L0 targets are l0-/survival', l0.every((m) =>
    m.targetIds.every((id) => id.startsWith('l0-') || id === 'survival-arbeite'),
  ));
  check('L0 no a1 targets', !l0.some((m) => m.targetIds.some((id) => id.startsWith('a1-'))));
  check(
    'zeroLanguageMode still true for L0+zero',
    isZeroLanguageMode({
      level: 'zero',
      selfReportedLevel: undefined,
      diagnosticLevel: undefined,
    }),
  );
}

console.log('\n— Unlock / progress / current / next');
{
  const empty = emptyLearningProfile();
  const cp = defaultCourseProgress('zero');
  cp.currentLevel = 'B2';

  const lockedA1 = getModulesWithProgress('A1', empty, 'L0', cp);
  check('A1 locked when user L0', lockedA1.every((m) => m.locked));

  const b2 = getModulesWithProgress('B2', empty, 'B2', cp);
  check('B2 m1 unlocked', b2[0]!.available && !b2[0]!.locked);
  check('B2 m2 locked until m1 done', b2[1]!.locked);
  check('current = first incomplete', b2[0]!.status === 'current');
  check('progress 0', getModuleProgress('B2', b2[0]!.id, empty) === 0);

  let learning = emptyLearningProfile();
  for (const id of b2[0]!.targetIds) learning.phrases[id] = readyConf(id);
  check('m1 completed after ready', isModuleCompleted('B2', b2[0]!.id, learning));
  check('m2 unlocked after m1', isModuleUnlocked('B2', b2[1]!.id, learning, 'B2'));

  const after = getModulesWithProgress('B2', learning, 'B2', cp);
  check('current moves to m2', after[1]!.status === 'current');
  const snap = getCurrentModule(learning, 'B2', cp, 'B2');
  check('getCurrentModule = u2', snap.module?.id === 'b2.u2');
  check('nextTarget in current', !!snap.targetId && snap.targetId.startsWith('b2-'));
  const next = getNextModule('B2', learning, 'B2', cp);
  check('getNextModule after current', next?.id === 'b2.u3' || next?.order === 3);

  const pct = getLevelModulesProgressPercent('B2', learning, 'B2', cp);
  check('level pct > 0', pct != null && pct > 0 && pct < 100);
}

console.log('\n— Complete C2 journey end');
{
  let learning = emptyLearningProfile();
  learning = acceptAllTargets('C2', learning);
  const snap = getCurrentModule(learning, 'C2', defaultCourseProgress('basic'), 'C2');
  check('C2 all done → journeyComplete', snap.journeyComplete === true);
  check('no invented next level', getNextModule('C2', learning, 'C2') == null || getNextModule('C2', learning, 'C2')!.locked === false);
  // when all complete, next is null
  const views = getModulesWithProgress('C2', learning, 'C2');
  check('all C2 completed', views.every((m) => m.completed));
  check('getNextModule null when done', getNextModule('C2', learning, 'C2') == null);
}

console.log('\n— Module session context');
{
  const mod = getModule('A1', 'a1.u1')!;
  const ctx = buildModuleSessionContext(mod);
  storeSelectedModuleContext(ctx);
  const read = readSelectedModuleContext();
  check('store/read module context', read?.moduleId === 'a1.u1' && read.targetIds.length > 0);
  const line = formatModulePedagogicalContext(read);
  check('format has NÍVEL A1', !!line && line.includes('NÍVEL: A1') && line.includes('MÓDULO:'));
  clearSelectedModuleContext();
  check('clear context', readSelectedModuleContext() == null);
  check('nextTarget first incomplete', nextTargetInModule(mod, emptyLearningProfile()) === mod.targetIds[0]);
}

console.log('\n— A1–C2 prefixes');
for (const level of LEVEL_ORDER.filter((l) => l !== 'L0')) {
  const prefix = `${level.toLowerCase()}-`;
  check(
    `${level} targets prefix ${prefix}`,
    getModules(level).every((m) => m.targetIds.every((id) => id.startsWith(prefix))),
  );
}

console.log(`\nResultado: ${passed} passaram, ${failed} falharam`);
if (failed > 0) process.exit(1);
