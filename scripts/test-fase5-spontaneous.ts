/* Fase 5 — Spontaneous Use
   Rodar: npx tsx scripts/test-fase5-spontaneous.ts */
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
import {
  analyzeSpontaneousUse,
  buildSpontaneousOpportunity,
  getSpontaneousMemory,
  restoreSpontaneousMemory,
} from '../src/services/learning/SpontaneousUseDetector';
import { decideSpontaneousOpportunity } from '../src/services/teacher/TeacherEngine';

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
  currentDay: 3,
  streak: 1,
  createdAt: new Date().toISOString(),
  germanPercentage: 60,
  turboMode: false,
  lastStudyDate: new Date().toISOString(),
  immersionPhase: 1,
  speechSpeed: 'normal',
};

const phrases: Phrase[] = [{
  id: 'survival-pause',
  german: 'Ich brauche eine Pause.',
  portuguese: 'Preciso de uma pausa.',
  category: 'work',
  mastery: 'speak',
  reviewStage: 'learning',
  nextReview: null,
  timesReviewed: 3,
  timesCorrect: 3,
  timesIncorrect: 0,
  isAutomatic: false,
  contexts: [],
}];

async function run() {
  console.log('FASE 5 — Detector (precisão)\n');
  assert(!analyzeSpontaneousUse({
    teacherPrompt: 'Bitte sag: Ich brauche eine Pause.',
    userResponse: 'Ich brauche eine Pause.',
    targetItems: [{ id: 'survival-pause', german: 'Ich brauche eine Pause.' }],
    knownPhrases: [{ id: 'survival-pause', german: 'Ich brauche eine Pause.' }],
    debugLog: false,
  }).confirmed, 'Say/sag → não spontaneous');

  assert(analyzeSpontaneousUse({
    teacherPrompt: 'Was brauchst du?',
    userResponse: 'Ich brauche eine Pause.',
    targetItems: [{ id: 'survival-pause', german: 'Ich brauche eine Pause.' }],
    knownPhrases: [{ id: 'survival-pause', german: 'Ich brauche eine Pause.' }],
    debugLog: false,
  }).productionOrigin === 'TRANSFER', 'Was brauchst du? → TRANSFER');

  const ok = analyzeSpontaneousUse({
    teacherPrompt: 'Du arbeitest schon lange. Wie fühlst du dich?',
    userResponse: 'Ich brauche eine Pause.',
    targetItems: [],
    knownPhrases: [{ id: 'survival-pause', german: 'Ich brauche eine Pause.' }],
    orchestratorAction: 'spontaneous',
    opportunity: buildSpontaneousOpportunity({ id: 'survival-pause', german: 'Ich brauche eine Pause.' }),
    debugLog: false,
  });
  assert(ok.confirmed, 'situação aberta → SPONTANEOUS');

  console.log('\nFASE 5 — TeacherEngine opportunity\n');
  assert(
    decideSpontaneousOpportunity({
      hasProduced: true,
      sessionOpportunities: 0,
      recentError: false,
      turnsSinceLastOpportunity: 5,
    }) === 'CREATE_SPONTANEOUS_OPPORTUNITY',
    'CREATE_SPONTANEOUS_OPPORTUNITY',
  );

  console.log('\nFASE 5 — Orchestrator Live path\n');
  _store.clear();
  await EventStore.clear();
  await MemoryService.saveConfidenceMap({});

  let c = emptyConfidence('survival-pause');
  c = updateConfidence(c, { type: 'produced', correct: true, responseMs: 3000, withHelp: false });
  c = updateConfidence(c, { type: 'transfer', correct: true });
  const learning = buildLearningProfile(profile, [], [], null, { 'survival-pause': c });

  const orch = ConversationOrchestrator.create({
    profile,
    learning,
    phrases,
    sessionId: 'fase5-s1',
  });

  // Situação aberta — sem pedir a frase
  await orch.handle({
    type: 'TEACHER_UTTERANCE',
    text: 'Du hast schon viele Fenster gereinigt. Wie fühlst du dich?',
  });
  // Forçar modo conversa / spontaneous no plano
  const plan = orch.getPlan();
  (orch as unknown as { plan: typeof plan; ctx: { mode: string; lastAction: string } }).plan = {
    ...plan,
    action: 'spontaneous',
  };
  (orch as unknown as { ctx: { mode: string; lastAction: string } }).ctx.mode = 'FREE_CONVERSATION';
  (orch as unknown as { ctx: { lastAction: string } }).ctx.lastAction = 'spontaneous';

  const spont = await orch.handleUserUtterance('Ich brauche eine Pause.');
  assert(
    spont.eventsRecorded.includes('PHRASE_USED_SPONTANEOUSLY'),
    `PHRASE_USED_SPONTANEOUSLY (reason=${spont.reason})`,
  );
  assert(spont.geminiNudge?.includes('Sehr gut') || spont.reason.includes('spontaneous'), 'feedback curto');

  const mem = getSpontaneousMemory('survival-pause');
  assert(!!mem && mem.spontaneousCount >= 1, 'spontaneousCount na memória');
  assert(!!restoreSpontaneousMemory('survival-pause')?.lastSpontaneousAt, 'lastSpontaneousAt');

  console.log('\nFASE 5 — falso positivo Live\n');
  const orch2 = ConversationOrchestrator.create({
    profile, learning, phrases, sessionId: 'fase5-fp',
  });
  await orch2.handle({ type: 'TEACHER_UTTERANCE', text: 'Sag: Ich brauche eine Pause.' });
  const fp = await orch2.handleUserUtterance('Ich brauche eine Pause.');
  assert(!fp.eventsRecorded.includes('PHRASE_USED_SPONTANEOUSLY'), 'falso positivo bloqueado');

  const events = await EventStore.load();
  assert(events.some((e) => e.type === 'PHRASE_USED_SPONTANEOUSLY'), 'evento na EventStore');

  console.log('\n✅ FASE 5 — cenário OK');
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
