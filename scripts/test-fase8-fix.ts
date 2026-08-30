/* Correção Fase 8 — tradução 429 + Review UI / prioridade FAILED.
   Rodar: npx tsx scripts/test-fase8-fix.ts */
const _store = new Map<string, string>();
(globalThis as unknown as { localStorage: Storage }).localStorage = {
  getItem: (k: string) => _store.get(k) ?? null,
  setItem: (k: string, v: string) => { _store.set(k, v); },
  removeItem: (k: string) => { _store.delete(k); },
  clear: () => { _store.clear(); },
  key: () => null,
  length: 0,
} as Storage;

import { emptyConfidence, updateConfidence } from '../src/services/learning/ConfidenceService';
import { persistAutomationScore } from '../src/services/learning/AutomationScoreEngine';
import {
  applyReviewResult,
  buildReviewQueue,
  buildReviewQueueItem,
  reviewPriorityScore,
} from '../src/services/learning/ReviewEngine';
import { getDueReviews, getDueReviewCount } from '../src/services/learning/ReviewRepository';
import { testTranslationService } from '../src/services/ai/__tests__/TranslationService.test';
import { MemoryService } from '../src/services/learning/MemoryService';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`  ✓ ${msg}`);
}

async function testFailedPriority() {
  console.log('\n[Review] FAILED priority');
  let c = emptyConfidence('pause-fail-prio');
  c = updateConfidence(c, { type: 'heard', correct: true });
  c = updateConfidence(c, { type: 'repeated', correct: true });
  c = updateConfidence(c, { type: 'produced', correct: true, withHelp: false, responseMs: 6000 });
  c = {
    ...c,
    confidence: 55,
    timesCorrect: 3,
    timesProduced: 4,
    needsHelp: true,
    contextTransfer: 20,
    avgResponseMs: 7000,
    state: 'answeredAlone',
    lastSeen: new Date(Date.now() - 3 * 86_400_000).toISOString(),
    lastProduced: new Date(Date.now() - 3 * 86_400_000).toISOString(),
    nextReview: new Date(Date.now() - 86_400_000).toISOString(),
  };
  c = persistAutomationScore(c);
  const before = buildReviewQueueItem(c)!;
  assert(before.priority > 50, `prioridade antes falha = ${before.priority}`);

  const failed = applyReviewResult(c, 'FAILED', {
    reviewType: 'RECALL_REVIEW',
    sessionId: 'f8-fail',
  });
  const after = buildReviewQueueItem(failed);
  assert(after !== null, 'item FAILED permanece due');
  assert(after!.priority >= before.priority, `prioridade ${before.priority} → ${after!.priority} (não despenca)`);
  assert(after!.priority > 20, `não cai para ~6 (got ${after!.priority})`);

  const success = applyReviewResult(failed, 'SUCCESS', {
    reviewType: 'RECALL_REVIEW',
    sessionId: 'f8-ok',
  });
  const afterOk = buildReviewQueueItem(success);
  assert(afterOk === null, 'SUCCESS recente sai da fila imediata');
}

async function testReviewRepositoryParity() {
  console.log('\n[Review] Repository = mesma fonte Home/ReviewPage');
  const map: Record<string, ReturnType<typeof emptyConfidence>> = {};
  for (const id of ['a-due', 'b-due']) {
    let c = emptyConfidence(id);
    c = {
      ...c,
      confidence: 50,
      timesCorrect: 3,
      timesProduced: 4,
      needsHelp: true,
      state: 'answeredAlone',
      lastSeen: new Date(Date.now() - 5 * 86_400_000).toISOString(),
      lastProduced: new Date(Date.now() - 5 * 86_400_000).toISOString(),
      nextReview: new Date(Date.now() - 86_400_000).toISOString(),
      automationScore: 30,
    };
    map[id] = persistAutomationScore(c);
  }
  const q = buildReviewQueue(map, [], new Date(), 12);
  assert(q.length === 2, `fila com 2 due (got ${q.length})`);

  // ReviewRepository usa MemoryService — stub via saveConfidenceMap se existir
  const load = MemoryService.loadConfidenceMap;
  (MemoryService as { loadConfidenceMap: typeof load }).loadConfidenceMap = async () => map;
  try {
    const due = await getDueReviews(12);
    const count = await getDueReviewCount(12);
    assert(due.length === count, 'getDueReviews.length === getDueReviewCount');
    assert(count === 2, `Home count = Review count = 2 (got ${count})`);
  } finally {
    MemoryService.loadConfidenceMap = load;
  }

  const emptyQ = buildReviewQueue({}, [], new Date(), 12);
  assert(emptyQ.length === 0, 'fila vazia → 0 (empty state)');
}

async function main() {
  console.log('FASE 8 CORREÇÃO — testes\n');
  console.log('[Tradução]');
  await testTranslationService();
  console.log('  ✓ TranslationService (local + 429 + cache + dedupe)');

  await testFailedPriority();
  await testReviewRepositoryParity();

  // smoke: reviewPriorityScore export
  const stub = persistAutomationScore({
    ...emptyConfidence('x'),
    confidence: 40,
    timesCorrect: 2,
    timesProduced: 3,
    needsHelp: true,
    state: 'answeredAlone',
    lastSeen: new Date(Date.now() - 86_400_000).toISOString(),
    automationScore: 25,
    nextReview: new Date(Date.now() - 1000).toISOString(),
  });
  const scored = reviewPriorityScore(stub);
  assert(scored.due, 'item frágil é due');

  console.log('\n✅ FASE 8 CORREÇÃO — testes unitários OK');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
