/**
 * MeuCursoPresentation — labels da UI Meu Curso.
 * Rodar: npx tsx src/services/course/__tests__/MeuCursoPresentation.test.ts
 */
import {
  LEVEL_ORDER,
  levelJourneyTitle,
  moduleStatusLabel,
  moduleStatusGlyph,
  autonomyLabel,
  overallJourneyPercent,
  nextLevelId,
  isTerminalCourseLevel,
  getModules,
  getCurrentModule,
  getNextModule,
  getModulesWithProgress,
  isModuleUnlocked,
  isModuleCompleted,
  defaultCourseProgress,
} from '@/services/course';
import type { PhraseConfidence } from '@/services/learning/ConfidenceService';
import { emptyLearningProfile } from '@/services/learning/RealProgress';

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

console.log('\n— Titles L0–C2');
for (const level of LEVEL_ORDER) {
  check(`${level} journey title`, levelJourneyTitle(level).length > 3);
}
check('L0 is Primeiros passos', levelJourneyTitle('L0') === 'Primeiros passos');
check('L0 not called A1', !levelJourneyTitle('L0').includes('A1'));

console.log('\n— Status labels');
check('completed', moduleStatusLabel('completed') === 'Concluído' && moduleStatusGlyph('completed') === '✅');
check('current', moduleStatusLabel('current') === 'Em andamento' && moduleStatusGlyph('current') === '▶');
check('locked', moduleStatusLabel('locked') === 'Bloqueado' && moduleStatusGlyph('locked') === '🔒');

console.log('\n— Autonomy (no invent)');
check('no evidence → null', autonomyLabel(80, false) == null);
check('zero → null', autonomyLabel(0, true) == null);
check('alta', autonomyLabel(75, true) === 'Alta');
check('media', autonomyLabel(50, true) === 'Média');
check('baixa', autonomyLabel(20, true) === 'Baixa');

console.log('\n— Overall journey percent');
check(
  'only unlocked',
  overallJourneyPercent([
    { level: 'L0', percent: 100, unlocked: true },
    { level: 'A1', percent: 50, unlocked: true },
    { level: 'B2', percent: null, unlocked: false },
  ]) === 75,
);
check('all locked → null', overallJourneyPercent([{ level: 'B2', percent: null, unlocked: false }]) == null);

console.log('\n— Next / terminal');
check('B1 → B2', nextLevelId('B1') === 'B2');
check('C2 next null', nextLevelId('C2') == null);
check('C2 terminal', isTerminalCourseLevel('C2') && !isTerminalCourseLevel('C1'));

console.log('\n— Module states via existing APIs');
{
  const empty = emptyLearningProfile();
  const cp = defaultCourseProgress('zero');
  cp.currentLevel = 'B1';
  const views = getModulesWithProgress('B1', empty, 'B1', cp);
  check('current module first', views[0]?.status === 'current');
  check('later locked', views[1]?.locked === true);
  check('unlocked first', isModuleUnlocked('B1', views[0]!.id, empty, 'B1'));

  let learning = emptyLearningProfile();
  for (const id of views[0]!.targetIds) learning.phrases[id] = readyConf(id);
  check('completed after ready', isModuleCompleted('B1', views[0]!.id, learning));
  const snap = getCurrentModule(learning, 'B1', cp, 'B1');
  check('getCurrentModule advances', snap.module?.order === 2);
  const next = getNextModule('B1', learning, 'B1', cp);
  check('getNextModule', !!next && next.order >= 2);
}

console.log('\n— Module counts');
check('L0 8', getModules('L0').length === 8);
check('C2 8', getModules('C2').length === 8);

console.log(`\nResultado: ${passed} passaram, ${failed} falharam`);
if (failed > 0) process.exit(1);
