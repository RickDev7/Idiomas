/* Cenário real Fase 3 via Orchestrator (sem UI).
   Rodar: npx tsx scripts/test-fase3-scenario.ts */
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
import type { UserLearningProfile } from '../src/services/learning/ConfidenceService';
import { ConversationOrchestrator } from '../src/services/teacher/ConversationOrchestrator';
import {
  getHelpHistory,
  getPreviousHelpLevel,
  startingSupportForPhrase,
} from '../src/services/learning/ScaffoldingEngine';
import { EventStore } from '../src/services/learning/EventStore';

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
  profession: 'Developer',
  frequentSituations: [],
  interests: [],
  onboardingComplete: true,
  firstLessonComplete: true,
  currentDay: 1,
  streak: 1,
  xp: 0,
  createdAt: new Date().toISOString(),
};

const phrases: Phrase[] = [{
  id: 'survival-arbeite',
  german: 'Ich arbeite heute.',
  portuguese: 'Eu trabalho hoje.',
  level: 'A1',
  category: 'work',
  audioHint: '',
}];

const learning: UserLearningProfile = {
  phrases: {},
  bottleneck: null,
  intensiveMode: false,
  lastUpdated: new Date().toISOString(),
};

async function run() {
  _store.clear();
  await EventStore.clear();

  console.log('CENÁRIO: Ich arbeiten heute → Micro → scaffold → sucesso → fade\n');

  const orch = ConversationOrchestrator.create({
    profile,
    learning,
    phrases,
    sessionId: 'fase3-sess1',
  });

  await orch.handle({ type: 'TEACHER_UTTERANCE', text: 'Was machst du heute?' });

  // Erro gramatical → micro
  let d = await orch.handleUserUtterance('Ich arbeiten heute.');
  assert(d.flow === 'startMicroPractice' || d.mode === 'MICRO_PRACTICE' || d.flow === 'intervenePedagogically',
    `erro abre intervenção/micro (flow=${d.flow})`);

  // Forçar segundo erro se ainda não micro (shouldStart precisa recorrência)
  if (d.flow !== 'startMicroPractice') {
    d = await orch.handleUserUtterance('Ich arbeiten heute.');
  }
  assert(d.flow === 'startMicroPractice', `micro iniciado (flow=${d.flow})`);
  assert(!!d.microPractice, 'microPractice na decisão');
  const supportStart = d.microPractice!.currentSupportLevel;
  assert(supportStart >= 1 && supportStart < 5, `ajuda mínima inicial=${supportStart}`);
  assert(
    !d.geminiNudge?.includes('Give full answer') &&
      (supportStart >= 5 || !d.geminiNudge?.includes(`"${d.microPractice!.targetItem}"`) || d.geminiNudge.includes('NÃO diga a frase completa')),
    'Gemini não recebe instrução de frase completa prematura',
  );

  // Tentativa errada → sobe
  d = await orch.handleUserUtterance('Ich gehen');
  assert(d.microPractice!.currentSupportLevel >= supportStart, 'erro sobe suporte');

  // Acerto com suporte → independent
  d = await orch.handleUserUtterance('Ich arbeite heute.');
  // Pode ir para independent ou finish
  if (d.microPractice && d.microPractice.phase === 'independent') {
    d = await orch.handleUserUtterance('Ich arbeite heute.');
  }
  assert(d.flow === 'resumeConversation' || d.microPractice?.result === 'SUCCESS' || d.reason.includes('micro'),
    'sucesso e retorno à conversa');

  const hist1 = getHelpHistory('survival-arbeite');
  assert(!!hist1, 'histórico após sessão 1');
  const prev = getPreviousHelpLevel('survival-arbeite');
  assert(prev < supportStart || prev <= hist1!.lastSupportLevel, `fade após sucesso previous=${prev}`);

  // Sessão 2 — suporte refletido
  console.log('\nSESSÃO 2 — fade persistido\n');
  const start2 = startingSupportForPhrase('survival-arbeite');
  assert(start2 === prev, `sessão 2 inicia em previousHelpLevel=${start2}`);

  const events = await EventStore.load();
  const types = new Set(events.map((e) => e.type));
  assert(types.has('MICRO_PRACTICE_STARTED') || types.has('SCAFFOLD_USED') || types.has('PHRASE_FAILED'),
    'eventos de scaffolding/micro gravados');

  console.log('\n✅ Cenário Fase 3 (orchestrator) OK');
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
