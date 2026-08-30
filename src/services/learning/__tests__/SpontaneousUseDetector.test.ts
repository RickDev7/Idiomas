import {
  analyzeSpontaneousUse,
  buildSpontaneousOpportunity,
  getSpontaneousMemory,
  makeSpontaneousEventId,
  recordConfirmedSpontaneous,
  restoreSpontaneousMemory,
  structureSimilarity,
  teacherExplicitlyRequests,
} from '@/services/learning/SpontaneousUseDetector';
import { emptyConfidence, updateConfidence } from '@/services/learning/ConfidenceService';
import { computeAutomationScore } from '@/services/learning/RealUseEngine';
import { assert } from './assert';

const PAUSE = { id: 'pause-1', german: 'Ich brauche eine Pause.' };
const HILFE = { id: 'hilfe-1', german: 'Ich brauche Hilfe.' };
const ARBEITE = { id: 'work-1', german: 'Ich arbeite heute.' };

function ensureLocalStorage() {
  if (typeof globalThis.localStorage !== 'undefined') return;
  const store: Record<string, string> = {};
  (globalThis as unknown as { localStorage: Storage }).localStorage = {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = String(v); },
    removeItem: (k: string) => { delete store[k]; },
    clear: () => { Object.keys(store).forEach((key) => delete store[key]); },
    key: () => null,
    length: 0,
  };
}

export function testSpontaneousUseDetector() {
  ensureLocalStorage();
  localStorage.removeItem('deutsch-turbo:spontaneous:v1');

  // --- TESTE 1: Say: … → NÃO spontaneous ---
  const t1 = analyzeSpontaneousUse({
    teacherPrompt: 'Say: Ich brauche eine Pause.',
    userResponse: 'Ich brauche eine Pause.',
    targetItems: [PAUSE],
    knownPhrases: [PAUSE],
    debugLog: false,
  });
  assert(t1.classification === 'GUIDED' || t1.productionOrigin === 'GUIDED', 'T1 requested/guided');
  assert(!t1.confirmed, 'T1 não spontaneous');

  // --- TESTE 2: Repeat ---
  const t2 = analyzeSpontaneousUse({
    teacherPrompt: 'Repeat.',
    userResponse: 'Ich brauche eine Pause.',
    targetItems: [PAUSE],
    knownPhrases: [PAUSE],
    recentAttempts: [{ teacherSaid: 'Ich brauche eine Pause.', phraseId: 'pause-1' }],
    debugLog: false,
  });
  assert(!t2.confirmed, 'T2 Repeat ≠ spontaneous');

  // --- TESTE 3: positivo situacional ---
  const t3 = analyzeSpontaneousUse({
    teacherPrompt: 'Du arbeitest schon lange. Wie fühlst du dich?',
    userResponse: 'Ich brauche eine Pause.',
    targetItems: [ARBEITE],
    knownPhrases: [PAUSE, HILFE, ARBEITE],
    conversationMode: 'FREE_CONVERSATION',
    orchestratorAction: 'spontaneous',
    opportunity: buildSpontaneousOpportunity(PAUSE),
    debugLog: false,
  });
  assert(t3.confirmed, 'T3 spontaneous confirmado');
  assert(t3.phraseId === 'pause-1', 'T3 mapeia Pause');
  assert(t3.confidence >= 0.85, 'T3 confidence ≥ 0.85');

  // --- TESTE 4: variação ---
  const t4 = analyzeSpontaneousUse({
    teacherPrompt: 'Du bist müde. Wie geht es dir?',
    userResponse: 'Ich brauche kurz eine Pause.',
    targetItems: [],
    knownPhrases: [PAUSE],
    orchestratorAction: 'converse',
    debugLog: false,
  });
  assert(t4.confirmed || t4.classification === 'POSSIBLE_SPONTANEOUS', 'T4 variação');
  if (t4.confidence >= 0.85) assert(t4.confirmed, 'T4 variação confirmada se ≥0.85');

  // --- TESTE 5: resposta normal sem target ---
  const t5 = analyzeSpontaneousUse({
    teacherPrompt: "Wie geht's dir?",
    userResponse: 'Ich bin gut.',
    targetItems: [PAUSE],
    knownPhrases: [PAUSE],
    debugLog: false,
  });
  assert(!t5.confirmed, 'T5 Ich bin gut ≠ Pause spontaneous');

  // --- TESTE 6: Was brauchst du? = TRANSFER ---
  const t6 = analyzeSpontaneousUse({
    teacherPrompt: 'Was brauchst du?',
    userResponse: 'Ich brauche eine Pause.',
    targetItems: [PAUSE],
    knownPhrases: [PAUSE],
    debugLog: false,
  });
  assert(t6.classification === 'TRANSFER' || t6.productionOrigin === 'TRANSFER', 'T6 transfer');
  assert(!t6.confirmed, 'T6 não spontaneous');

  // --- TESTE 7: delayed (oportunidade + situação) ---
  const t7 = analyzeSpontaneousUse({
    teacherPrompt: 'Du arbeitest schon lange. Wie geht es dir?',
    userResponse: 'Ich brauche eine Pause.',
    targetItems: [],
    knownPhrases: [PAUSE],
    orchestratorAction: 'converse',
    conversationMode: 'FREE_CONVERSATION',
    debugLog: false,
  });
  assert(t7.confirmed, 'T7 delayed spontaneous');

  // --- TESTE 8: professor menciona Pause — cautela ---
  const t8 = analyzeSpontaneousUse({
    teacherPrompt: 'Pause ist wichtig. Was sagst du?',
    userResponse: 'Ich brauche eine Pause.',
    targetItems: [PAUSE],
    knownPhrases: [PAUSE],
    orchestratorAction: 'practice',
    debugLog: false,
  });
  assert(!t8.confirmed, 'T8 falso positivo evitado (menção Pause)');

  // --- TESTE 9: parcial ---
  const t9 = analyzeSpontaneousUse({
    teacherPrompt: 'Wie fühlst du dich?',
    userResponse: 'Ich brauche...',
    targetItems: [],
    knownPhrases: [PAUSE],
    debugLog: false,
  });
  assert(!t9.confirmed, 'T9 parcial ≠ spontaneous');
  assert(t9.verdict === 'partial' || t9.classification === 'UNKNOWN', 'T9 partial/unknown');

  // --- pending transfer ---
  const tTransfer = analyzeSpontaneousUse({
    teacherPrompt: 'Und morgen?',
    userResponse: 'Ich arbeite morgen.',
    targetItems: [ARBEITE],
    knownPhrases: [ARBEITE],
    pendingTransfer: true,
    debugLog: false,
  });
  assert(tTransfer.productionOrigin === 'TRANSFER', 'pendingTransfer → TRANSFER');
  assert(!tTransfer.confirmed, 'pendingTransfer ≠ spontaneous');

  // --- Heute arbeite ich ---
  const reorder = analyzeSpontaneousUse({
    teacherPrompt: 'Erzähl mir von deinem Tag.',
    userResponse: 'Heute arbeite ich.',
    targetItems: [],
    knownPhrases: [ARBEITE],
    orchestratorAction: 'converse',
    debugLog: false,
  });
  assert(reorder.confidence >= 0.55, 'reordenação reconhecida');

  // --- memória + idempotência ---
  const eid = makeSpontaneousEventId('s1', 'pause-1', 'Ich brauche eine Pause.');
  const m1 = recordConfirmedSpontaneous({ phraseId: 'pause-1', eventId: eid, sessionId: 's1' });
  assert(m1.spontaneousCount === 1, 'spontaneousCount=1');
  const m2 = recordConfirmedSpontaneous({ phraseId: 'pause-1', eventId: eid, sessionId: 's1' });
  assert(m2.spontaneousCount === 1, 'idempotente — não duplica');
  const restored = restoreSpontaneousMemory('pause-1');
  assert(!!restored && restored.spontaneousCount === 1, 'persistência sessão seguinte');
  assert(!!getSpontaneousMemory('pause-1')?.lastSpontaneousAt, 'lastSpontaneousAt');

  assert(teacherExplicitlyRequests('Diga: Ich brauche Hilfe.', 'Ich brauche Hilfe.'), 'explicit request');
  assert(structureSimilarity('Ich brauche eine Pause', 'Ich brauche eine Pause.') >= 0.9, 'similarity alta');
  assert(structureSimilarity('Pause bitte', 'Ich brauche eine Pause.') < 0.72, 'overlap frágil');

  // Automation score sobe com evento spontaneous (evidência; score completo = Fase 6)
  let c = emptyConfidence('pause-1');
  c = updateConfidence(c, { type: 'produced', correct: true });
  c = updateConfidence(c, { type: 'produced', correct: true });
  const before = computeAutomationScore(c);
  c = updateConfidence(c, { type: 'spontaneous', correct: true });
  assert(computeAutomationScore(c) > before, 'spontaneous aumenta evidência');
  assert(c.state === 'spontaneous' || c.state === 'automatic', 'estado avança');
}
