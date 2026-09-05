/**
 * ModuleRuntimeContext — module context consumido de verdade pelo runtime.
 * Rodar: npx tsx src/services/course/__tests__/ModuleRuntimeContext.test.ts
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

import type { UserProfile } from '@/types';
import { emptyLearningProfile } from '@/services/learning/RealProgress';
import { emptyConfidence, type UserLearningProfile } from '@/services/learning/ConfidenceService';
import {
  ConversationOrchestrator,
  buildConversationPlan,
} from '@/services/teacher/ConversationOrchestrator';
import { isZeroLanguageMode } from '@/services/teacher/ZeroLanguageMode';
import {
  buildModuleSessionContext,
  storeSelectedModuleContext,
  readSelectedModuleContext,
  clearSelectedModuleContext,
  consumeSelectedModuleContext,
  validateModuleSessionContext,
  formatModulePedagogicalContext,
  type ModuleSessionContext,
} from '@/services/course/CurriculumModule';
import { getModules } from '@/services/course/CurriculumModuleRegistry';
import { getContinueCourseState, beginContinueCourseSession } from '@/services/course/ContinueCourse';
import { getNextB1Target } from '@/services/course/B1Curriculum';
import { getNextB2Target } from '@/services/course/B2Curriculum';
import { getNextC1Target } from '@/services/course/C1Curriculum';
import { getNextC2Target } from '@/services/course/C2Curriculum';
import { getNextA1Target } from '@/services/course/A1Curriculum';
import { getNextA2Target } from '@/services/course/A2Curriculum';
import { defaultCourseProgress, saveCourseProgress } from '@/services/course/CourseProgressEngine';
import type { CourseLevelId } from '@/services/course/types';

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

function baseProfile(level: CourseLevelId): UserProfile {
  const appLevel = level === 'L0' ? 'zero' : level === 'A1' ? 'little' : 'basic';
  return {
    id: 'mod-ctx-user',
    name: 'Test',
    level: appLevel,
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

function markDeferred(learning: UserLearningProfile, id: string): UserLearningProfile {
  return {
    ...learning,
    phrases: {
      ...learning.phrases,
      [id]: {
        ...emptyConfidence(id),
        timesCorrect: 0,
        timesProduced: 4,
        timesSeen: 4,
        confidence: 20,
        state: 'heard',
        needsHelp: true,
      },
    },
  };
}

function moduleAt(level: CourseLevelId, order: number) {
  const m = getModules(level).find((x) => x.order === order);
  if (!m) throw new Error(`missing module ${level} #${order}`);
  return m;
}

async function ensureCourseLevel(level: CourseLevelId) {
  const app = level === 'L0' ? 'zero' : level === 'A1' ? 'little' : 'basic';
  const p = defaultCourseProgress(app);
  p.currentLevel = level;
  await saveCourseProgress(p);
}

async function planWithModule(level: CourseLevelId, order: number, learning = emptyLearningProfile()) {
  await ensureCourseLevel(level);
  const mod = moduleAt(level, order);
  const ctx = buildModuleSessionContext(mod);
  const profile = baseProfile(level);
  const plan = buildConversationPlan(profile, learning, [], 0, { moduleContext: ctx });
  return { plan, ctx, mod, profile };
}

async function orchWithModule(level: CourseLevelId, order: number, extra?: {
  learning?: UserLearningProfile;
  startPhraseId?: string;
}) {
  await ensureCourseLevel(level);
  const mod = moduleAt(level, order);
  const ctx = buildModuleSessionContext(mod);
  const profile = baseProfile(level);
  const orch = ConversationOrchestrator.create({
    profile,
    learning: extra?.learning ?? emptyLearningProfile(),
    phrases: [],
    moduleContext: ctx,
    startPhraseId: extra?.startPhraseId,
  });
  return { orch, ctx, mod, profile };
}

console.log('\n— 1. Home Continue Course → session usa módulo');
{
  await ensureCourseLevel('L0');
  const learning = emptyLearningProfile();
  const state = getContinueCourseState({ learning, userLevel: 'L0' });
  check('1. new_user ou in_progress', state.status === 'new_user' || state.status === 'in_progress');
  check('1. sessionModule set', !!state.sessionModule);
  let stored = false;
  beginContinueCourseSession(
    () => {},
    state,
    {
      storeModuleContext: (ctx) => {
        stored = true;
        storeSelectedModuleContext(ctx);
      },
      buildModuleContext: buildModuleSessionContext,
      clearSelectedLearningTarget: () => {},
    },
  );
  check('1. context gravado', stored && !!readSelectedModuleContext());
  const consumed = consumeSelectedModuleContext('L0');
  check('1. consume válido', !!consumed && consumed.moduleId === state.sessionModule!.id);
  check('1. storage limpo após consume', readSelectedModuleContext() == null);
  const plan = buildConversationPlan(baseProfile('L0'), learning, [], 0, { moduleContext: consumed });
  check('1. plan target no módulo', !!plan.target && consumed!.targetIds.includes(plan.target.id));
  check('1. MODULE_CONTEXT no reason', (plan.actionReason || '').includes('MODULE_CONTEXT'));
}

console.log('\n— 2. CoursePage módulo específico (B2 m3)');
{
  const { plan, ctx, mod } = await planWithModule('B2', 3);
  check('2. moduleId b2.u3', ctx.moduleId === 'b2.u3');
  check('2. target no módulo', !!plan.target && mod.targetIds.includes(plan.target.id));
  check('2. first open', plan.target?.id === mod.targetIds[0]);
  check('2. não é u1', plan.target?.id !== moduleAt('B2', 1).targetIds[0]);
}

console.log('\n— 3–6 / 18. Isolamento por nível (módulo X ≠ Y)');
for (const level of ['L0', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as CourseLevelId[]) {
  const mods = getModules(level);
  if (mods.length < 2) {
    check(`${level} has ≥2 modules`, false);
    continue;
  }
  const x = mods[0]!;
  const y = mods[1]!;
  await ensureCourseLevel(level);
  const plan = buildConversationPlan(baseProfile(level), emptyLearningProfile(), [], 0, {
    moduleContext: buildModuleSessionContext(x),
  });
  check(`${level} target ∈ módulo X`, !!plan.target && x.targetIds.includes(plan.target.id));
  check(`${level} target ∉ módulo Y`, !!plan.target && !y.targetIds.includes(plan.target.id));
}

console.log('\n— 7. Target explícito vence module context');
{
  const mod = moduleAt('B2', 3);
  const other = moduleAt('B2', 1).targetIds[0]!;
  await ensureCourseLevel('B2');
  const orch = ConversationOrchestrator.create({
    profile: baseProfile('B2'),
    learning: emptyLearningProfile(),
    phrases: [],
    moduleContext: buildModuleSessionContext(mod),
    startPhraseId: other,
  });
  check('7. selectedStart aplicado', orch.wasSelectedStartApplied());
  check('7. plan = explícito', orch.getPlan().target?.id === other);
}

console.log('\n— 8. Sem module context → planner normal');
{
  await ensureCourseLevel('B2');
  const withMod = await planWithModule('B2', 3);
  const normal = buildConversationPlan(baseProfile('B2'), emptyLearningProfile(), [], 0);
  check('8. normal usa primeiro do nível', normal.target?.id === moduleAt('B2', 1).targetIds[0]);
  check('8. com módulo ≠ normal quando m3', withMod.plan.target?.id !== normal.target?.id);
  check('8. sem MODULE_CONTEXT', !(normal.actionReason || '').includes('MODULE_CONTEXT'));
}

console.log('\n— 9. Contexto inválido ignorado');
{
  const bad: ModuleSessionContext = {
    level: 'B2',
    moduleId: 'nope',
    unitId: 'nope',
    title: 'x',
    competencyIds: [],
    targetIds: ['b2-fake'],
  };
  check('9. validate null', validateModuleSessionContext(bad, 'B2') == null);
  await ensureCourseLevel('B2');
  const plan = buildConversationPlan(baseProfile('B2'), emptyLearningProfile(), [], 0, {
    moduleContext: bad,
  });
  check('9. cai no planner normal', plan.target?.id === moduleAt('B2', 1).targetIds[0]);
  check('9. sem MODULE_CONTEXT', !(plan.actionReason || '').includes('MODULE_CONTEXT'));
}

console.log('\n— 10. Módulo de outro nível');
{
  const a1mod = buildModuleSessionContext(moduleAt('A1', 1));
  check('10. B2 session rejeita A1 ctx', validateModuleSessionContext(a1mod, 'B2') == null);
  await ensureCourseLevel('B2');
  const plan = buildConversationPlan(baseProfile('B2'), emptyLearningProfile(), [], 0, {
    moduleContext: a1mod,
  });
  check('10. B2 planner normal', !!plan.target && plan.target.id.startsWith('b2-'));
}

console.log('\n— 11. Stale / cleanup');
{
  clearSelectedModuleContext();
  storeSelectedModuleContext(buildModuleSessionContext(moduleAt('A2', 2)));
  check('11. stored', !!readSelectedModuleContext());
  const c1 = consumeSelectedModuleContext('A2');
  check('11. consumido', !!c1 && c1.moduleId === moduleAt('A2', 2).id);
  check('11. limpo', readSelectedModuleContext() == null);
  const c2 = consumeSelectedModuleContext('A2');
  check('11. segundo consume null', c2 == null);
}

console.log('\n— 12. Deferred dentro do módulo (não foge)');
{
  const mod = moduleAt('B2', 3);
  const first = mod.targetIds[0]!;
  const second = mod.targetIds[1]!;
  let learning = markDeferred(emptyLearningProfile(), first);
  const next = getNextB2Target(null, learning, { restrictToTargetIds: mod.targetIds });
  check('12. pula deferred, fica no módulo', next?.id === second);
  check('12. não foi para u1', next?.id !== moduleAt('B2', 1).targetIds[0]);
}

console.log('\n— 13. Módulo concluído → reforço no mesmo módulo');
{
  const mod = moduleAt('B1', 3);
  const learning = markReady(emptyLearningProfile(), mod.targetIds);
  const next = getNextB1Target(null, learning, { restrictToTargetIds: mod.targetIds });
  check('13. ainda no módulo', !!next && mod.targetIds.includes(next.id));
  check('13. não u4', next?.id !== moduleAt('B1', 4)?.targetIds[0]);
}

console.log('\n— 14. Cleanup após consumo (orchestrator + storage)');
{
  const mod = moduleAt('C1', 5);
  storeSelectedModuleContext(buildModuleSessionContext(mod));
  const ctx = consumeSelectedModuleContext('C1');
  await ensureCourseLevel('C1');
  const orch = ConversationOrchestrator.create({
    profile: baseProfile('C1'),
    learning: emptyLearningProfile(),
    phrases: [],
    moduleContext: ctx,
  });
  check('14. orch target ∈ m5', !!orch.getPlan().target && mod.targetIds.includes(orch.getPlan().target!.id));
  check('14. storage vazio', readSelectedModuleContext() == null);
  check('14. directive tem módulo', (orch.getPlan().teacherDirective || '').includes('MÓDULO:'));
  check('14. live coach tem nível', (orch.toLiveFields().coachContext || '').includes('NÍVEL: C1'));
}

console.log('\n— 19–20. Planner explícito B1 m3 / B2 m3 / C1 m5 / C2 m2');
{
  for (const [level, order, getter] of [
    ['B1', 3, getNextB1Target],
    ['B2', 3, getNextB2Target],
    ['C1', 5, getNextC1Target],
    ['C2', 2, getNextC2Target],
  ] as const) {
    const mod = moduleAt(level, order);
    const t = getter(null, emptyLearningProfile(), { restrictToTargetIds: mod.targetIds });
    check(`${level} m${order} ∈ module`, !!t && mod.targetIds.includes(t.id));
  }
  const a1 = getNextA1Target(null, emptyLearningProfile(), {
    restrictToTargetIds: moduleAt('A1', 2).targetIds,
  });
  check('A1 m2 ∈ module', !!a1 && moduleAt('A1', 2).targetIds.includes(a1.id));
  const a2 = getNextA2Target(null, emptyLearningProfile(), {
    restrictToTargetIds: moduleAt('A2', 2).targetIds,
  });
  check('A2 m2 ∈ module', !!a2 && moduleAt('A2', 2).targetIds.includes(a2.id));
}

console.log('\n— L0 zeroLanguageMode preservado');
{
  await ensureCourseLevel('L0');
  const p = baseProfile('L0');
  check('L0 ZLM', isZeroLanguageMode(p));
  const { orch } = await orchWithModule('L0', 1);
  check('L0 live zero', orch.toLiveFields().zeroLanguageMode === true);
  check('L0 target no m1', !!orch.getPlan().target && moduleAt('L0', 1).targetIds.includes(orch.getPlan().target!.id));
}

console.log('\n— formatModulePedagogicalContext');
{
  const ctx = buildModuleSessionContext(moduleAt('B2', 3));
  const line = formatModulePedagogicalContext(ctx, 'b2-argue-auffassung');
  check('format tem NÍVEL', !!line && line.includes('NÍVEL: B2'));
  check('format tem UNIDADE', !!line && line.includes('UNIDADE: b2.u3'));
  check('format tem TARGET', !!line && line.includes('TARGET: b2-argue-auffassung'));
}

console.log(`\nResultado: ${passed} passaram, ${failed} falharam`);
process.exit(failed > 0 ? 1 : 0);
