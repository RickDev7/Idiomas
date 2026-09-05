/**
 * ContinueCourse — estados de CONTINUAR CURSO.
 * Rodar: npx tsx src/services/course/__tests__/ContinueCourse.test.ts
 */
const _store = new Map<string, string>();
(globalThis as { localStorage: Storage }).localStorage = {
  getItem: (k) => _store.get(k) ?? null,
  setItem: (k, v) => {
    _store.set(k, v);
  },
  removeItem: (k) => {
    _store.delete(k);
  },
  clear: () => _store.clear(),
  key: () => null,
  length: 0,
} as Storage;
(globalThis as { sessionStorage: Storage }).sessionStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
  clear: () => {},
  key: () => null,
  length: 0,
} as Storage;

import type { PhraseConfidence } from '@/services/learning/ConfidenceService';
import { emptyLearningProfile } from '@/services/learning/RealProgress';
import { isZeroLanguageMode } from '@/services/teacher/ZeroLanguageMode';
import {
  getContinueCourseState,
  beginContinueCourseSession,
  getModules,
  defaultCourseProgress,
  buildModuleSessionContext,
  storeSelectedModuleContext,
  type CourseLevelId,
} from '@/services/course';

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

function seenConf(phraseId: string): PhraseConfidence {
  return {
    ...readyConf(phraseId),
    timesCorrect: 0,
    timesProduced: 1,
    confidence: 20,
    state: 'heard',
  };
}

function completeModule(level: CourseLevelId, moduleId: string, learning: ReturnType<typeof emptyLearningProfile>) {
  const mod = getModules(level).find((m) => m.id === moduleId)!;
  for (const id of mod.targetIds) learning.phrases[id] = readyConf(id);
  return learning;
}

console.log('\n— 1. Novo usuário / sem dados');
{
  const s0 = getContinueCourseState({ learning: null, userLevel: 'L0' });
  check('1. no learning → no_data', s0.status === 'no_data');

  const empty = emptyLearningProfile();
  const s = getContinueCourseState({ learning: empty, userLevel: 'L0' });
  check('1. new_user', s.status === 'new_user');
  check('1. Começar curso', s.ctaLabel === 'Começar curso');
  check('1. L0 módulo 1', s.level === 'L0' && s.moduleOrder === 1);
  check('1. available', s.available === true);
  check('1. sessionModule set', !!s.sessionModule);
}

console.log('\n— 2–8. Em andamento por nível');
for (const level of ['L0', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as CourseLevelId[]) {
  const learning = emptyLearningProfile();
  const first = getModules(level)[0]!;
  learning.phrases[first.targetIds[0]!] = seenConf(first.targetIds[0]!);
  const s = getContinueCourseState({ learning, userLevel: level });
  check(`${level} in_progress`, s.status === 'in_progress');
  check(`${level} Continuar curso`, s.ctaLabel === 'Continuar curso');
  check(`${level} module`, s.moduleId === first.id);
  check(`${level} activity label`, !!s.activityLabel || !!s.targetGerman);
}

console.log('\n— 9. Módulo concluído → próximo');
{
  let learning = emptyLearningProfile();
  learning = completeModule('B1', 'b1.u1', learning);
  const s = getContinueCourseState({ learning, userLevel: 'B1' });
  check('9. module_completed or in_progress next', s.status === 'module_completed' || s.moduleOrder === 2);
  check('9. points to u2', s.moduleId === 'b1.u2');
  check('9. CTA continuar', s.available === true);
}

console.log('\n— 10–11. Nível concluído');
{
  let learning = emptyLearningProfile();
  for (const m of getModules('A1')) learning = completeModule('A1', m.id, learning);
  const s = getContinueCourseState({ learning, userLevel: 'A1' });
  check('10. level_completed', s.status === 'level_completed');
  check('11. next A2 mentioned', !!s.subline && s.subline.includes('A2'));
  // A1 userLevel cannot unlock A2 via isContentUnlocked(A2, A1) → false
  check('11. gate respected (not auto-unlock)', s.available === false || s.nextAction === 'next_level');
}

console.log('\n— 12. C2 concluído');
{
  let learning = emptyLearningProfile();
  for (const m of getModules('C2')) learning = completeModule('C2', m.id, learning);
  const s = getContinueCourseState({ learning, userLevel: 'C2' });
  check('12. course_completed', s.status === 'course_completed');
  check('12. isCourseComplete', s.isCourseComplete === true);
  check('12. no C3', !s.subline?.includes('C3') && !s.headline.includes('C3'));
}

console.log('\n— 13–14. Target pendente / módulo');
{
  const learning = emptyLearningProfile();
  const m1 = getModules('B2')[0]!;
  learning.phrases[m1.targetIds[0]!] = seenConf(m1.targetIds[0]!);
  const s = getContinueCourseState({ learning, userLevel: 'B2' });
  check('13. targetId set', !!s.targetId && s.targetId.startsWith('b2-'));
  check('13. german from curriculum', !!s.targetGerman);
  check('14. progress not inventing 100', (s.moduleProgress ?? 0) < 100);
}

console.log('\n— 15–16. Inválido / sem dados');
{
  check('15. null learning', getContinueCourseState({ learning: null, userLevel: 'B1' }).status === 'no_data');
  check('16. null level', getContinueCourseState({ learning: emptyLearningProfile(), userLevel: null }).status === 'no_data');
}

console.log('\n— 17. Explicit target válido');
{
  const learning = emptyLearningProfile();
  const m1 = getModules('A2')[0]!;
  const tid = m1.targetIds[1]!;
  learning.phrases[m1.targetIds[0]!] = seenConf(m1.targetIds[0]!);
  const s = getContinueCourseState({
    learning,
    userLevel: 'A2',
    explicitTargetId: tid,
  });
  check('17. uses explicit pending', s.explicitTargetId === tid || s.targetId === tid);
}

console.log('\n— 18. Continuidade sessão → planner (não força phrase)');
{
  const learning = emptyLearningProfile();
  learning.phrases[getModules('L0')[0]!.targetIds[0]!] = seenConf(getModules('L0')[0]!.targetIds[0]!);
  const s = getContinueCourseState({ learning, userLevel: 'L0' });
  let navigated = '';
  const flags = { cleared: false, stored: false };
  beginContinueCourseSession(
    (to) => {
      navigated = to;
    },
    s,
    {
      storeModuleContext: (ctx) => {
        flags.stored = !!ctx.moduleId;
        storeSelectedModuleContext(ctx);
      },
      buildModuleContext: buildModuleSessionContext,
      clearSelectedLearningTarget: () => {
        flags.cleared = true;
      },
    },
  );
  check('18. navega /sessao?type=lesson', navigated === '/sessao?type=lesson');
  check('18. limpa selected target', flags.cleared);
  check('18. grava module context', flags.stored);
}

console.log('\n— 19. Review não substitui continuação');
{
  const learning = emptyLearningProfile();
  // Review-like phrase with nextReview due — still curricular continue
  const id = getModules('A1')[0]!.targetIds[0]!;
  learning.phrases[id] = {
    ...seenConf(id),
    nextReview: new Date(Date.now() - 1000).toISOString(),
    needsHelp: true,
  };
  const s = getContinueCourseState({ learning, userLevel: 'A1' });
  check('19. still in_progress curricular', s.status === 'in_progress' && s.nextAction === 'continue_module');
  check('19. not review route', s.ctaLabel === 'Continuar curso');
}

console.log('\n— 20. zeroLanguageMode preservado');
{
  check(
    '20. L0+zero still ZLM',
    isZeroLanguageMode({ level: 'zero', selfReportedLevel: undefined, diagnosticLevel: undefined }),
  );
  const s = getContinueCourseState({
    learning: emptyLearningProfile(),
    userLevel: 'L0',
    course: defaultCourseProgress('zero'),
  });
  check('20. new user L0 not A1', s.level === 'L0' && s.status === 'new_user');
}

console.log(`\nResultado: ${passed} passaram, ${failed} falharam`);
if (failed > 0) process.exit(1);
