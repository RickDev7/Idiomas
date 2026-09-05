/**
 * ModuleDetails — página de detalhes do módulo.
 * Rodar: npx tsx src/services/course/__tests__/ModuleDetails.test.ts
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
import { buildConversationPlan } from '@/services/teacher/ConversationOrchestrator';
import { getModules } from '@/services/course/CurriculumModuleRegistry';
import {
  consumeSelectedModuleContext,
  readSelectedModuleContext,
} from '@/services/course/CurriculumModule';
import {
  getModuleDetailsState,
  beginModuleTrainingSession,
  parseCourseLevelParam,
  moduleDetailPath,
} from '@/services/course/ModuleDetails';
import { defaultCourseProgress, saveCourseProgress } from '@/services/course/CourseProgressEngine';
import type { CourseLevelId } from '@/services/course/types';
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

function markReady(learning: UserLearningProfile, ids: string[]): UserLearningProfile {
  const phrases = { ...learning.phrases };
  for (const id of ids) {
    phrases[id] = {
      ...emptyConfidence(id),
      timesCorrect: 5,
      timesProduced: 6,
      timesSeen: 6,
      confidence: 90,
      state: 'spontaneous',
      successiveSuccess: 3,
      spontaneousSessions: 3,
      automationScore: 85,
      lastProduced: new Date().toISOString(),
      lastSeen: new Date().toISOString(),
    };
  }
  return { ...learning, phrases };
}

function profileFor(level: CourseLevelId): UserProfile {
  return {
    id: 'md',
    name: 'T',
    level: level === 'L0' ? 'zero' : level === 'A1' ? 'little' : 'basic',
    diagnosticLevel: level,
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

async function ensureLevel(level: CourseLevelId) {
  const app = level === 'L0' ? 'zero' : level === 'A1' ? 'little' : 'basic';
  const p = defaultCourseProgress(app);
  p.currentLevel = level;
  await saveCourseProgress(p);
}

function mod(level: CourseLevelId, order: number) {
  const m = getModules(level).find((x) => x.order === order);
  if (!m) throw new Error(`no ${level} #${order}`);
  return m;
}

console.log('\n— parse / path');
check('parse b2', parseCourseLevelParam('b2') === 'B2');
check('parse L0', parseCourseLevelParam('l0') === 'L0');
check('path', moduleDetailPath('B2', 'b2.u3') === '/curso/b2/b2.u3');

console.log('\n— L0–C2 módulo 1');
for (const level of ['L0', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as CourseLevelId[]) {
  await ensureLevel(level);
  const m = mod(level, 1);
  const s = getModuleDetailsState({
    level,
    moduleId: m.id,
    learning: emptyLearningProfile(),
    userLevel: level,
  });
  check(`${level} ok`, s.ok && s.module?.id === m.id);
  check(`${level} activities`, s.activities.length === m.targetIds.length);
  check(`${level} next activity`, !!s.nextActivity && m.targetIds.includes(s.nextActivity.id));
  check(`${level} CTA continue`, s.ctaKind === 'continue_training');
  check(`${level} objetivos`, s.learningObjectives.length > 0);
}

console.log('\n— módulo atual / concluído / bloqueado');
{
  await ensureLevel('B2');
  const m1 = mod('B2', 1);
  const m2 = mod('B2', 2);
  const m3 = mod('B2', 3);
  const empty = emptyLearningProfile();
  const cur = getModuleDetailsState({
    level: 'B2',
    moduleId: m1.id,
    learning: empty,
    userLevel: 'B2',
  });
  check('atual ▶', cur.module?.status === 'current' && cur.statusGlyph === '▶');

  const locked = getModuleDetailsState({
    level: 'B2',
    moduleId: m3.id,
    learning: empty,
    userLevel: 'B2',
  });
  check('m3 bloqueado', locked.module?.locked === true && locked.ctaKind === 'locked');
  check('locked reason', !!locked.lockedReason);

  const doneLearn = markReady(empty, m1.targetIds);
  const done = getModuleDetailsState({
    level: 'B2',
    moduleId: m1.id,
    learning: doneLearn,
    userLevel: 'B2',
  });
  check('m1 concluído', done.module?.completed === true);
  check('próximo liberado', done.nextModuleUnlocked && done.nextModule?.id === m2.id);
  check('CTA próximo', done.ctaKind === 'continue_next_module');
}

console.log('\n— prev / next / sem target pendente');
{
  await ensureLevel('A1');
  const m2 = mod('A1', 2);
  const learn = markReady(emptyLearningProfile(), mod('A1', 1).targetIds);
  const s = getModuleDetailsState({
    level: 'A1',
    moduleId: m2.id,
    learning: learn,
    userLevel: 'A1',
  });
  check('prev = m1', s.prevModule?.order === 1);
  check('next = m3', s.nextModule?.order === 3);

  const allDone = markReady(learn, m2.targetIds);
  const completed = getModuleDetailsState({
    level: 'A1',
    moduleId: m2.id,
    learning: allDone,
    userLevel: 'A1',
  });
  check('sem pending → nextActivity null ou concluídas', completed.nextActivity == null || completed.module?.completed === true);
}

console.log('\n— C2 terminal');
{
  await ensureLevel('C2');
  const modules = getModules('C2');
  let learning = emptyLearningProfile();
  for (const m of modules) learning = markReady(learning, m.targetIds);
  const last = modules[modules.length - 1]!;
  const s = getModuleDetailsState({
    level: 'C2',
    moduleId: last.id,
    learning,
    userLevel: 'C2',
  });
  check('C2 journeyComplete', s.journeyComplete === true);
  check('C2 CTA ver curso', s.ctaKind === 'view_course');
  check('sem C3', !s.nextModule || s.nextModule.level === 'C2');
}

console.log('\n— L0 detalhes');
{
  await ensureLevel('L0');
  const m = mod('L0', 2);
  const s = getModuleDetailsState({
    level: 'L0',
    moduleId: m.id,
    learning: emptyLearningProfile(),
    userLevel: 'L0',
  });
  // m2 locked until m1 done
  check('L0 m2 bloqueado sem m1', s.module?.locked === true);
  const learn = markReady(emptyLearningProfile(), mod('L0', 1).targetIds);
  const s2 = getModuleDetailsState({
    level: 'L0',
    moduleId: m.id,
    learning: learn,
    userLevel: 'L0',
  });
  check('L0 m2 após m1', s2.ok && !s2.module?.locked);
  check('L0 título', !!s2.module?.title);
}

console.log('\n— runtime B2 m3 / C1 m5 / L0');
{
  await ensureLevel('B2');
  const m3 = mod('B2', 3);
  // unlock m3
  let learning = markReady(emptyLearningProfile(), [...mod('B2', 1).targetIds, ...mod('B2', 2).targetIds]);
  const s = getModuleDetailsState({
    level: 'B2',
    moduleId: m3.id,
    learning,
    userLevel: 'B2',
  });
  check('B2 m3 unlocked', !s.module?.locked);
  let nav = '';
  beginModuleTrainingSession((to) => {
    nav = to;
  }, s, {
    clearSelectedLearningTarget: () => {},
  });
  check('B2 navega lesson', nav === '/sessao?type=lesson');
  const ctx = readSelectedModuleContext();
  check('B2 moduleId b2.u3', ctx?.moduleId === 'b2.u3');
  const consumed = consumeSelectedModuleContext('B2');
  const plan = buildConversationPlan(profileFor('B2'), learning, [], 0, {
    moduleContext: consumed,
  });
  check('B2 plan ∈ u3', !!plan.target && m3.targetIds.includes(plan.target.id));
  check('B2 MODULE_CONTEXT', (plan.actionReason || '').includes('MODULE_CONTEXT'));
}

{
  await ensureLevel('C1');
  const m5 = mod('C1', 5);
  let learning = emptyLearningProfile();
  for (let o = 1; o < 5; o++) learning = markReady(learning, mod('C1', o).targetIds);
  const s = getModuleDetailsState({
    level: 'C1',
    moduleId: m5.id,
    learning,
    userLevel: 'C1',
  });
  beginModuleTrainingSession(() => {}, s, { clearSelectedLearningTarget: () => {} });
  const consumed = consumeSelectedModuleContext('C1');
  check('C1 moduleId', consumed?.moduleId === m5.id);
  const plan = buildConversationPlan(profileFor('C1'), learning, [], 0, {
    moduleContext: consumed,
  });
  check('C1 target ∈ m5', !!plan.target && m5.targetIds.includes(plan.target.id));
}

{
  await ensureLevel('L0');
  const m1 = mod('L0', 1);
  const s = getModuleDetailsState({
    level: 'L0',
    moduleId: m1.id,
    learning: emptyLearningProfile(),
    userLevel: 'L0',
  });
  beginModuleTrainingSession(() => {}, s, { clearSelectedLearningTarget: () => {} });
  const consumed = consumeSelectedModuleContext('L0');
  check('L0 module context', consumed?.moduleId === m1.id);
  const plan = buildConversationPlan(profileFor('L0'), emptyLearningProfile(), [], 0, {
    moduleContext: consumed,
  });
  check('L0 target ∈ m1', !!plan.target && m1.targetIds.includes(plan.target.id));
}

console.log('\n— inválido');
{
  const s = getModuleDetailsState({
    level: 'B1',
    moduleId: 'nope',
    learning: emptyLearningProfile(),
    userLevel: 'B1',
  });
  check('invalid ok=false', s.ok === false);
}

console.log(`\nResultado: ${passed} passaram, ${failed} falharam`);
process.exit(failed > 0 ? 1 : 0);
