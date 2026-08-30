/* Nível do card "Começar treino": getCurrentLevel + getLevelPresentation.
   Rodar: npx tsx scripts/test-level-presentation.ts */
import type { CourseLevelId, CourseProgress, SkillId } from '../src/services/course/types';
import { getCurrentLevel, getLevelPresentation } from '../src/services/course/LevelPresentation';
import type { UserProfile } from '../src/types';

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

function courseAt(level: CourseLevelId): CourseProgress {
  const skillLevels = {} as Record<SkillId, CourseLevelId>;
  for (const k of SKILLS) skillLevels[k] = level;
  return {
    currentLevel: level,
    skillLevels,
    competencyMastery: {},
    competencyGates: {},
    completedLevels: [],
    updatedAt: new Date().toISOString(),
  };
}

function profile(over: Partial<UserProfile> = {}): Pick<UserProfile, 'selfReportedLevel' | 'diagnosticLevel'> {
  return {
    selfReportedLevel: over.selfReportedLevel,
    diagnosticLevel: over.diagnosticLevel,
  };
}

console.log('— Apresentação de cada nível oficial');
const expected: Record<CourseLevelId, string> = {
  L0: 'Nível 0',
  A1: 'A1',
  A2: 'A2',
  B1: 'B1',
  B2: 'B2',
  C1: 'C1',
  C2: 'C2',
};
(Object.keys(expected) as CourseLevelId[]).forEach((id) => {
  const p = getLevelPresentation(id);
  check(`${id} → "${expected[id]}"`, p.label === expected[id]);
  check(`${id} descrição curta`, p.description === 'Seu nível atual');
  check(`${id} sem CEFR extra`, !p.label.includes('•') && !/elementar|intermediário/i.test(p.label));
});
check('L0 usa ícone sprout', getLevelPresentation('L0').icon === 'sprout');

console.log('— Fonte de verdade');
check('sem nada → Nível 0', getCurrentLevel(profile()) === 'L0');
check('diagnóstico A2', getCurrentLevel(profile({ diagnosticLevel: 'A2' })) === 'A2');
check('diagnóstico B1', getCurrentLevel(profile({ diagnosticLevel: 'B1' })) === 'B1');
check('diagnóstico C1', getCurrentLevel(profile({ diagnosticLevel: 'C1' })) === 'C1');
check('diagnóstico C2', getCurrentLevel(profile({ diagnosticLevel: 'C2' })) === 'C2');
check('selfReported basic (A2) sem diagnóstico', getCurrentLevel(profile({ selfReportedLevel: 'basic' })) === 'A2');
check('selfReported beginner → A1', getCurrentLevel(profile({ selfReportedLevel: 'beginner' })) === 'A1');
check('selfReported zero → L0', getCurrentLevel(profile({ selfReportedLevel: 'zero' })) === 'L0');

console.log('— Conflito autoavaliação vs diagnóstico');
check('Avançado + diagnóstico B1 → B1', getCurrentLevel(profile({
  selfReportedLevel: 'advanced',
  diagnosticLevel: 'B1',
})) === 'B1');
check('não mostra Avançado', getLevelPresentation(getCurrentLevel(profile({
  selfReportedLevel: 'advanced',
  diagnosticLevel: 'B1',
}))).label === 'B1');

console.log('— Evolução A1 → A2');
const after = getCurrentLevel(profile({ diagnosticLevel: 'A1' }), courseAt('A2'));
check('curso A2 vence diagnóstico A1', after === 'A2');
check('label A2', getLevelPresentation(after).label === 'A2');

console.log('— Overall do curso persistido');
check('curso B2 sem diagnóstico', getCurrentLevel(profile(), courseAt('B2')) === 'B2');
check('overall A1 no card', getLevelPresentation(getCurrentLevel(profile(), courseAt('A1'))).label === 'A1');

console.log('— TrainingHero recebe o label oficial');
const heroLabel = getLevelPresentation(getCurrentLevel(profile({ diagnosticLevel: 'A2' }))).label;
check('hero A2 não é Iniciante', heroLabel === 'A2' && heroLabel !== 'Iniciante');
const heroZero = getLevelPresentation(getCurrentLevel(profile())).label;
check('hero vazio é Nível 0', heroZero === 'Nível 0');

console.log(`\nResultado: ${passed} passaram, ${failed} falharam`);
if (failed > 0) process.exit(1);
