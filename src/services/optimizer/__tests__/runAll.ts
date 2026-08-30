import { runTest } from '../../learning/__tests__/assert';
import { testPreferenceModel } from './PreferenceModel.test';
import { testLearningEfficiencyEngine } from './LearningEfficiencyEngine.test';
import { testReviewOptimizer } from './ReviewOptimizer.test';
import { testNoveltyOptimizer } from './NoveltyOptimizer.test';
import { testDifficultyOptimizer } from './DifficultyOptimizer.test';
import { testOptimalChallengeEngine } from './OptimalChallengeEngine.test';
import { testStagnationDetector } from './StagnationDetector.test';

console.log('DEUTSCH TURBO V4 — Testes do Personal Learning Optimizer\n');

await runTest('PreferenceModel', testPreferenceModel);
runTest('LearningEfficiencyEngine', testLearningEfficiencyEngine);
runTest('ReviewOptimizer', testReviewOptimizer);
runTest('NoveltyOptimizer', testNoveltyOptimizer);
runTest('DifficultyOptimizer', testDifficultyOptimizer);
runTest('OptimalChallengeEngine', testOptimalChallengeEngine);
await runTest('StagnationDetector', testStagnationDetector);

console.log('\nFim dos testes V4.');
