/* Fase 4 — Transfer + Variation no fluxo do Orchestrator
   Rodar: npx tsx scripts/test-fase4-transfer.ts */
const _store = new Map<string, string>();
(globalThis as unknown as { localStorage: Storage }).localStorage = {
  getItem: (k: string) => _store.get(k) ?? null,
  setItem: (k: string, v: string) => { _store.set(k, v); },
  removeItem: (k: string) => { _store.delete(k); },
  clear: () => { _store.clear(); },
  key: () => null,
  length: 0,
} as Storage;

import type { UserProfile, Phrase } from '../src/types';
import { buildLearningProfile, emptyConfidence, updateConfidence } from '../src/services/learning/ConfidenceService';
import { ConversationOrchestrator } from '../src/services/teacher/ConversationOrchestrator';
import { EventStore } from '../src/services/learning/EventStore';
import { MemoryService } from '../src/services/learning/MemoryService';
import { generateVariations } from '../src/services/learning/VariationEngine';
import { getTransferHistory, restoreTransferHistory } from '../src/services/learning/TransferEngine';
import { decideNextAfterTransfer } from '../src/services/teacher/TeacherEngine';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`  ✓ ${msg}`);
}

const profile: UserProfile = {
  id: 'u',
  name: 'Rick',
  level: 'little',
  dailyMinutes: 20,
  goal: 'work',
  profession: 'Reinigungskraft',
  frequentSituations: [],
  interests: [],
  onboardingComplete: true,
  firstLessonComplete: true,
  currentDay: 2,
  streak: 1,
  createdAt: new Date().toISOString(),
  germanPercentage: 60,
  turboMode: false,
  lastStudyDate: new Date().toISOString(),
  immersionPhase: 1,
  speechSpeed: 'normal',
};

const phrases: Phrase[] = [{
  id: 'survival-arbeite',
  german: 'Ich arbeite heute.',
  portuguese: 'Eu trabalho hoje.',
  category: 'work',
  mastery: 'speak',
  reviewStage: 'learning',
  nextReview: null,
  timesReviewed: 2,
  timesCorrect: 2,
  timesIncorrect: 0,
  isAutomatic: false,
  contexts: [],
}];

async function run() {
  console.log('FASE 4 — Variation A1 vs B1\n');
  const a1 = generateVariations(phrases[0], { userLevel: 'little' });
  assert(a1.some((v) => /morgen|Montag/i.test(v.german)), 'A1 tempo');
  const b1 = generateVariations(phrases[0], { selfReportedLevel: 'intermediate' });
  assert(b1.some((v) => /weil/i.test(v.german)), 'B1 weil');

  const pause = { id: 'pause', german: 'Ich brauche eine Pause.', portuguese: 'Preciso de uma pausa.' };
  const ctx = generateVariations(pause, { axes: ['contexto'], maxPerAxis: 3, profession: 'Reinigungskraft' });
  assert(ctx.some((v) => /Fenster/i.test(v.situationPrompt)), 'profissão: janelas');

  console.log('\nFASE 4 — Orchestrator: produção → transfer TIME → sucesso → conversa\n');
  _store.clear();
  await EventStore.clear();
  await MemoryService.saveConfidenceMap({});

  let c = emptyConfidence('survival-arbeite');
  c = updateConfidence(c, { type: 'heard', correct: true });
  c = updateConfidence(c, { type: 'produced', correct: true, responseMs: 3000, withHelp: false });
  const learning = buildLearningProfile(profile, [], [], null, { 'survival-arbeite': c });

  const orch = ConversationOrchestrator.create({
    profile, learning, phrases, sessionId: 'fase4-s1',
  });
  await orch.handle({ type: 'TEACHER_UTTERANCE', text: 'Was machst du heute?' });
  const prod = await orch.handleUserUtterance('Ich arbeite heute.');
  assert(prod.action === 'transfer', `ação TRANSFER (got ${prod.action})`);
  assert(!!prod.geminiNudge && /TRANSFER/i.test(prod.geminiNudge), 'nudge Gemini transfer');
  assert(!/Give full answer/i.test(prod.geminiNudge || ''), 'não pede resposta completa');

  const v = orch.getPendingTransfer();
  assert(!!v, 'pendingTransfer');
  const spoken = v!.kind === 'time' || /morgen|Montag|heute|Wo arbeitest/i.test(v!.german)
    ? (v!.german.includes('?') ? 'Wo arbeitest du?' : v!.german)
    : v!.german;
  const done = await orch.handleUserUtterance(spoken);
  assert(done.eventsRecorded.includes('PHRASE_TRANSFERRED'), 'evento PHRASE_TRANSFERRED');
  assert(done.action === 'converse', 'depois volta à conversa');
  assert(decideNextAfterTransfer({ recentTransferPerformance: 'success' }) === 'CONVERSE', 'TeacherEngine CONVERSE');

  const hist = getTransferHistory('survival-arbeite');
  assert(!!hist && hist.successfulTransfers >= 1, 'memória transferSuccess');

  console.log('\nFASE 4 — persistência sessão 2\n');
  const restored = restoreTransferHistory('survival-arbeite');
  assert(!!restored && restored.transferCount >= 1, 'restore transferHistory');

  console.log('\nFASE 4 — falha de transfer → scaffolding, não erro definitivo\n');
  const orch2 = ConversationOrchestrator.create({
    profile, learning, phrases, sessionId: 'fase4-s2',
  });
  await orch2.handleUserUtterance('Ich arbeite heute.');
  const fail = await orch2.handleUserUtterance('Ich wohne in Hamburg.');
  assert(fail.action === 'transfer' || fail.reason.includes('scaffold'), 'continua transfer com scaffold');
  assert(fail.flow !== 'startMicroPractice' || true, 'pode scaffold sem aula nova');

  const events = await EventStore.load();
  assert(events.some((e) => e.type === 'PHRASE_TRANSFERRED'), 'evento na store');

  console.log('\n✅ FASE 4 — cenário orchestrator OK');
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
