/* Testes de lógica do curso (0 → A1 → A2, gates, skip, adaptação).
   Rodar: npx tsx scripts/test-course.ts */
import assert from 'node:assert';

// Stub de localStorage para o Node (o CourseProgressEngine persiste nele).
const _store = new Map<string, string>();
const localStorageStub = {
  getItem: (k: string) => _store.get(k) ?? null,
  setItem: (k: string, v: string) => { _store.set(k, v); },
  removeItem: (k: string) => { _store.delete(k); },
  clear: () => { _store.clear(); },
};
(globalThis as any).localStorage = localStorageStub;

import {
  defaultCourseProgress,
  recomputeSkillLevels,
  recomputeOverall,
  overallLevel,
  readyForNextLevel,
  advanceToNextLevel,
  placeAtLevel,
  readyForPlacementSkip,
  bumpCompetency,
  focusSkill,
  nextCompetency,
  nextObjectiveLabel,
  buildRecommendation,
  courseLevelFromAppLevel,
  phrasesForLevel,
  phrasesForCompetency,
  validatePhrase,
  grammarAllowedInLevel,
  buildAssessmentLesson,
  gradeAssessment,
  competenciesForLevel,
  LEVEL_BY_ID,
  LEVEL_ORDER,
  levelIndex,
  COMPETENCIES,
  CURATED,
  detectCoursePlateau,
  recordMasterySnapshot,
  startRecovery,
  updateRecoveryAfterSession,
  applyRecoveryToActivities,
  isRecoveryActive,
} from '../src/services/course/index';
import type { CourseProgress } from '../src/services/course/types';
import type { Progress, UserProfile } from '../src/types';

const baseProgress: Progress = {
  id: 'p', communicationScore: 0, comprehension: 0, production: 0, retention: 0,
  vocabulary: 0, listening: 0, pronunciation: 0, conversation: 0, spontaneity: 0,
  totalStudyMinutes: 0, wordsLearned: 0, phrasesLearned: 0, phrasesAutomatic: 0,
  conversationsCompleted: 0, missionsCompleted: 0, weeklyScores: [], bottlenecks: [],
};

function withScores(over: Partial<Progress>): Progress {
  return { ...baseProgress, ...over };
}

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean) {
  if (cond) { passed++; console.log(`  ✓ ${name}`); }
  else { failed++; console.error(`  ✗ ${name}`); }
}

console.log('— Nível inicial a partir do app level');
check('zero → L0', courseLevelFromAppLevel('zero') === 'L0');
check('little → A1', courseLevelFromAppLevel('little') === 'A1');
check('basic → A2', courseLevelFromAppLevel('basic') === 'A2');

console.log('— Progressão 0 → A1 → A2');
let p = defaultCourseProgress('zero');
check('começa no L0', p.currentLevel === 'L0');
check('L0 não está pronto antes de dominar competências', readyForNextLevel(p) === false);

// domina todas as competências de L0 + sobe skills para A1
for (const c of competenciesForLevel('L0')) {
  p = bumpCompetency(p, c.id, c.masteryThreshold);
}
p = recomputeSkillLevels(p, withScores({ listening: 35, production: 35, pronunciation: 35, vocabulary: 35, comprehension: 35, conversation: 35 }));
check('overall (skill) = A1', overallLevel(p) === 'A1');
check('currentLevel ainda L0 (avanço é por assessment)', p.currentLevel === 'L0');
check('pronto para próximo nível após dominar L0', readyForNextLevel(p) === true);
p = advanceToNextLevel(p);
check('avançou para A1', p.currentLevel === 'A1');

// domina A1 + skills A2
for (const c of competenciesForLevel('A1')) {
  p = bumpCompetency(p, c.id, c.masteryThreshold);
}
p = recomputeSkillLevels(p, withScores({ listening: 55, production: 55, pronunciation: 55, vocabulary: 55, comprehension: 55, conversation: 55 }));
check('overall (skill) = A2 após dominar A1', overallLevel(p) === 'A2');
check('pronto para A2', readyForNextLevel(p) === true);

console.log('— Avanço explícito (assessment aprovado)');
p = advanceToNextLevel(p);
check('avançou para A2', p.currentLevel === 'A2');
check('L0 e A1 marcados como concluídos', p.completedLevels.includes('L0') && p.completedLevels.includes('A1'));

console.log('— Skip inteligente: aluno que já sabe A1 (placement)');
let skip = defaultCourseProgress('zero');
skip = recomputeSkillLevels(skip, withScores({ listening: 55, production: 55, pronunciation: 55, vocabulary: 55, comprehension: 55, conversation: 55 }));
check('overall pula para A2 quando skills já estão altas', overallLevel(skip) === 'A2');
check('pronto para placement skip', readyForPlacementSkip(skip) === true);
skip = placeAtLevel(skip, 'A2');
check('placement posiciona em A2', skip.currentLevel === 'A2');
check('L0 e A1 concluídos após placement', skip.completedLevels.includes('L0') && skip.completedLevels.includes('A1'));

console.log('— Adaptação: forte em speaking, fraco em listening');
let adapt = defaultCourseProgress('basic'); // A2
adapt = recomputeSkillLevels(adapt, withScores({ listening: 35, production: 80, pronunciation: 80, vocabulary: 60, comprehension: 60, conversation: 70 }));
check('overall cai para A1 por causa do listening fraco', overallLevel(adapt) === 'A1');
check('foco = listening', focusSkill(adapt) === 'listening');
check('não está pronto para B1 (listening fraco)', readyForNextLevel(adapt) === false);

console.log('— Recomendação / jornada');
const rec = buildRecommendation(p);
check('jornada tem 7 níveis', rec.journey.length === 7);
check('L0 e A1 done, A2 current', rec.journey[0].status === 'done' && rec.journey[1].status === 'done' && rec.journey[2].status === 'current');
check('B1+ locked', rec.journey[3].status === 'locked');
check('próximo objetivo não vazio', rec.nextObjective.length > 0);

console.log('— ContentLevelValidator');
check('frase curta ok em L0', validatePhrase('Hallo!', 'L0').ok === true);
check('frase longa não ok em A1', validatePhrase('Ich möchte heute Abend mit meinen Freunden ins Kino gehen.', 'A1').ok === false);
check('gramática A2 não permitida em A1', grammarAllowedInLevel('g.a2.perfekt', 'A1') === false);
check('gramática A1 permitida em A2', grammarAllowedInLevel('g.a1.articles', 'A2') === true);

console.log('— LevelAssessment');
const lesson = buildAssessmentLesson('A2');
check('lição de avaliação tem interações', lesson.interactions.length >= 3);
check('primeira interação é teach (introdução)', lesson.interactions[0].type === 'teach');
const g = gradeAssessment('A2', 8, 5, 2);
check('aprova com boa produção', g.passed === true);
const g2 = gradeAssessment('A2', 2, 0, 8);
check('reprova com baixa produção', g2.passed === false);

console.log('— Filtragem de conteúdo por nível');
const fakePhrases = [
  { id: '1', german: 'Hallo', portuguese: 'Olá', category: 'greetings', mastery: 'recognize', reviewStage: 'new', nextReview: null, timesReviewed: 0, timesCorrect: 0, timesIncorrect: 0, isAutomatic: false, contexts: [] },
  { id: '2', german: 'Brot', portuguese: 'Pão', category: 'food', mastery: 'recognize', reviewStage: 'new', nextReview: null, timesReviewed: 0, timesCorrect: 0, timesIncorrect: 0, isAutomatic: false, contexts: [] },
  { id: '3', german: 'Rechnung', portuguese: 'Conta', category: 'phone', mastery: 'recognize', reviewStage: 'new', nextReview: null, timesReviewed: 0, timesCorrect: 0, timesIncorrect: 0, isAutomatic: false, contexts: [] },
] as any;
const l0 = phrasesForLevel(fakePhrases, 'L0');
check('L0 pega greetings (Hallo)', l0.some((p) => p.german === 'Hallo') === true);
check('L0 não pega phone', l0.some((p) => p.category === 'phone') === false);
const comp = phrasesForCompetency(fakePhrases, 'a2.phone');
check('competência a2.phone pega phone', comp.some((p) => p.category === 'phone') === true);

console.log('— Ordem dos níveis');
check('LEVEL_ORDER = L0,A1,A2,B1,B2,C1,C2', LEVEL_ORDER.join(',') === 'L0,A1,A2,B1,B2,C1,C2');
check('levelIndex A2 = 2', levelIndex('A2') === 2);

console.log('— Aplicar sessão às competências');
let sess = defaultCourseProgress('zero');
// simula: dominar L0 via sessões (successos > falhas)
for (let i = 0; i < 8; i++) {
  sess = (await (await import('../src/services/course/CourseProgressEngine')).applySessionToCourse('zero', { successes: 5, failures: 1, spontaneous: 1 }))!;
}
const firstL0 = competenciesForLevel('L0')[0];
check('após várias sessões boas, a primeira competência de L0 domina', (sess.competencyMastery[firstL0.id] ?? 0) >= firstL0.masteryThreshold);
check('competência em foco tem gate >= learning', (sess.competencyGates[competenciesForLevel('L0')[0].id] ?? 'locked') !== 'locked');

console.log('— Conteúdo B1–C2');
for (const lvl of ['B1', 'B2', 'C1', 'C2'] as const) {
  const comps = competenciesForLevel(lvl);
  check(`${lvl} tem competências`, comps.length >= 4);
  const missing = comps.filter((c) => !CURATED.find((x) => x.competencyId === c.id));
  check(`${lvl} tem núcleo curado para cada competência`, missing.length === 0);
  check(`${lvl} tem módulos`, LEVEL_BY_ID[lvl].modules.length >= 2);
}
check('todas as competências do mapa têm núcleo', COMPETENCIES.every((c) => CURATED.some((x) => x.competencyId === c.id)));

console.log('— Platô e recovery');
let plat = defaultCourseProgress('zero');
for (let i = 0; i < 4; i++) {
  plat = recordMasterySnapshot(plat, 'l0.greet', 20 + i);
}
const report = detectCoursePlateau(plat);
check('detecta platô quando mastery quase não sobe', report.stagnant === true);
const recov = startRecovery(plat, report);
plat.recovery = recov;
check('recovery tem estratégia', recov.strategy.length > 0);
check('recovery está ativo', isRecoveryActive(plat) === true);

const acts = applyRecoveryToActivities(
  [
    { kind: 'newContent', minutes: 6, phraseIds: ['a', 'b'], reason: 'novo' },
    { kind: 'review', minutes: 4, phraseIds: ['c'], reason: 'revisar' },
    { kind: 'conversation', minutes: 10, phraseIds: ['d'], reason: 'conversa' },
  ],
  { ...recov, focus: 'review' },
  20,
);
check('recovery reduz conteúdo novo', (acts.find((a) => a.kind === 'newContent')?.phraseIds.length ?? 0) <= 1);
check('recovery aumenta revisão', (acts.find((a) => a.kind === 'review')?.minutes ?? 0) > 4);

plat = updateRecoveryAfterSession(plat, 12);
check('salto forte encerra recovery', plat.recovery == null);

console.log(`\nResultado: ${passed} passaram, ${failed} falharam`);
if (failed > 0) process.exit(1);
