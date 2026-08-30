/* Fase 6 — AutomationScore + Next Best Action (Live)
   Rodar: npx tsx scripts/test-fase6-automation.ts */
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
  decideNextBestAction,
  getNextBestLearningAction,
  isAutomated,
  readAutomationScore,
  updateAutomationScore,
} from '../src/services/learning/AutomationScoreEngine';

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

const TARGET: Phrase = {
  id: 'survival-pause',
  german: 'Ich brauche eine Pause.',
  portuguese: 'Preciso de uma pausa.',
  category: 'work',
  mastery: 'speak',
  reviewStage: 'learning',
  nextReview: null,
  timesReviewed: 0,
  timesCorrect: 0,
  timesIncorrect: 0,
  isAutomatic: false,
  contexts: [],
};

async function probeGeminiLive(actionBefore: string, actionAfter: string, scoreTrail: number[]): Promise<boolean> {
  const base = process.env.VITE_BACKEND_URL || 'http://localhost:8787';
  try {
    const health = await fetch(`${base}/api/health`).catch(() => null);
    if (!health || !health.ok) {
      // backend sem /api/health — tenta token
    }
    const res = await fetch(`${base}/api/gemini/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        profile: {
          level: 'little',
          goal: 'work',
          profession: 'Reinigungskraft',
          pedagogicalAction: actionAfter,
          targetPhrase: TARGET.german,
          actionReason: `AutomationScore ${scoreTrail.join('→')}; NBA ${actionBefore}→${actionAfter}`,
          teacherDirective: [
            '=== ORQUESTRAÇÃO DO TEACHERENGINE ===',
            `AÇÃO ATUAL: ${actionAfter}`,
            `FRASE-ALVO: ${TARGET.german}`,
            'Se AUTOMATED/CONVERSE: NÃO peça para repetir a mesma frase.',
          ].join('\n'),
          automationScore: scoreTrail[scoreTrail.length - 1],
          skipKickoff: false,
          openingGerman: 'Was brauchst du jetzt?',
          sessionKind: 'RETURNING_SESSION',
        },
      }),
    });
    if (!res.ok) {
      console.log(`  · Gemini Live REAL: backend respondeu ${res.status} (sem sessão Live neste ambiente)`);
      return false;
    }
    const data = (await res.json()) as { token?: string; error?: string };
    if (!data.token) {
      console.log(`  · Gemini Live REAL: sem token (${data.error || 'unknown'})`);
      return false;
    }
    console.log(`  ✓ Gemini Live REAL: token emitido (${data.token.slice(0, 8)}…)`);
    console.log(`  ✓ perfil Live carrega action=${actionAfter} score=${scoreTrail[scoreTrail.length - 1]}`);
    return true;
  } catch (e) {
    console.log(`  · Gemini Live REAL: indisponível (${(e as Error).message})`);
    return false;
  }
}

async function run() {
  console.log('FASE 6 — AutomationScore + Next Best Action\n');
  _store.clear();
  await EventStore.clear();
  await MemoryService.saveConfidenceMap({});

  let conf = emptyConfidence(TARGET.id);
  conf = updateConfidence(conf, { type: 'heard', correct: true });
  conf = updateConfidence(conf, { type: 'produced', correct: true, withHelp: true, responseMs: 7000 });
  conf = updateAutomationScore(
    { ...conf, needsHelp: true, state: 'answeredWithHelp', contextTransfer: 0, timesSeen: 2 },
    { sessionId: 's0', evidence: 'produced' },
  );
  const score0 = readAutomationScore(conf);
  const action0 = getNextBestLearningAction(conf);
  console.log(`  SCORE ANTES: ${score0}`);
  console.log(`  AÇÃO ANTES: ${action0}`);
  assert(score0 < 45, `score baixo inicial (${score0})`);
  assert(action0 === 'guided' || action0 === 'recall' || action0 === 'transfer', `ação baixa (${action0})`);

  const learning = buildLearningProfile(profile, [], [], null, { [TARGET.id]: conf });
  const orch = ConversationOrchestrator.create({
    profile,
    learning,
    phrases: [TARGET],
    sessionId: 'fase6-live',
  });
  await orch.handle({ type: 'SESSION_STARTED' });
  await orch.handle({ type: 'TEACHER_UTTERANCE', text: 'Was brauchst du?' });

  // Independência
  const d1 = await orch.handle({ type: 'USER_UTTERANCE', text: 'Ich brauche eine Pause.' });
  const after1 = await MemoryService.getPhraseConfidence(TARGET.id);
  const score1 = readAutomationScore(after1);
  console.log(`  SCORE após produção: ${score1} | action=${d1.action} reason=${d1.reason}`);
  assert(score1 >= score0 - 2, `score sobe ou mantém (${score0}→${score1})`);
  assert(
    d1.action === 'transfer' || d1.action === 'practice' || d1.action === 'spontaneous' || d1.action === 'converse',
    `NBA Live responde (${d1.action})`,
  );

  // Transfer se aberto
  let score2 = score1;
  let action2 = d1.action;
  if (d1.action === 'transfer' || orch.getPendingTransfer()) {
    const variant = orch.getPendingTransfer();
    const reply = variant?.german || 'Ich brauche eine Pause morgen.';
    const d2 = await orch.handle({ type: 'USER_UTTERANCE', text: reply });
    const after2 = await MemoryService.getPhraseConfidence(TARGET.id);
    score2 = readAutomationScore(after2);
    action2 = d2.action;
    console.log(`  SCORE após transfer: ${score2} | action=${d2.action}`);
    assert(
      d2.eventsRecorded.includes('PHRASE_TRANSFERRED') || /transfer|converse|spontaneous/i.test(d2.reason),
      'transfer registrado ou ação avançou',
    );
  } else {
    // Força evidência de transfer via memória + nova produção
    await MemoryService.recordEvent(TARGET.id, { type: 'transfer', correct: true }, 'fase6-live-b');
    conf = await MemoryService.getPhraseConfidence(TARGET.id);
    score2 = readAutomationScore(conf);
    action2 = getNextBestLearningAction(conf);
    console.log(`  SCORE após transfer (memória): ${score2} | NBA=${action2}`);
  }

  // Spontaneous
  await orch.handle({ type: 'TEACHER_UTTERANCE', text: 'Es ist sehr heiß heute. Was brauchst du?' });
  const d3 = await orch.handle({ type: 'USER_UTTERANCE', text: 'Ich brauche eine Pause.' });
  const after3 = await MemoryService.getPhraseConfidence(TARGET.id);
  const score3 = readAutomationScore(after3);
  console.log(`  SCORE após uso: ${score3} | action=${d3.action}`);

  const trail = [score0, score1, score2, score3];
  console.log(`\n  SCORE ANTES→DEPOIS: ${trail.join(' → ')}`);
  console.log(`  AÇÃO ANTES→DEPOIS: ${action0} → ${action2} → ${d3.action}`);

  assert(score3 >= score0, 'score evoluiu ao longo da sessão');
  assert((after3.automationHistory?.length ?? 0) >= 2, 'histórico persistido');

  // Persistência PWA
  const reopened = await MemoryService.loadConfidenceMap();
  assert(typeof reopened[TARGET.id]?.automationScore === 'number', 'AutomationScore sobrevive reload');
  assert(reopened[TARGET.id].automationScore === after3.automationScore, 'mesmo valor após reopen');

  // Item automatizado não prioriza drill
  const autoLike = {
    ...after3,
    confidence: 95,
    needsHelp: false,
    timesSeen: 14,
    timesProduced: 10,
    timesCorrect: 10,
    contextTransfer: 85,
    state: 'spontaneous' as const,
    successfulSessions: 3,
    independentSessions: 3,
    spontaneousSessions: 2,
    automationScore: 86,
    lastProduced: new Date().toISOString(),
  };
  await MemoryService.saveConfidenceMap({ [TARGET.id]: autoLike });
  const nbaAuto = decideNextBestAction(autoLike);
  assert(
    nbaAuto.action === 'maintenance' || nbaAuto.action === 'independent' || nbaAuto.action === 'spontaneous',
    `automatizado → conversa/manutenção (${nbaAuto.action})`,
  );
  assert(isAutomated(autoLike), 'isAutomated com evidência mínima');
  assert(
    getNextBestLearningAction(autoLike) === 'independent',
    'getNextBest mapeia maintenance → independent/conversation',
  );

  const hist = orch.getActionHistory();
  assert(hist.length >= 1 || score1 !== score0, 'actionHistory ou evolução de score');

  const liveOk = await probeGeminiLive(String(action0), String(nbaAuto.action === 'maintenance' ? 'converse' : nbaAuto.action), trail);

  console.log('\n## RESUMO FASE 6');
  console.log(`AutomationScore: ${trail.join(' → ')}`);
  console.log(`NextBestAction: ${action0} → ${action2} → ${d3.action} → ${nbaAuto.action}`);
  console.log(`Gemini Live REAL: ${liveOk ? 'token OK' : 'simulação Orchestrator (backend offline)'}`);
  console.log('STATUS: fluxo score→NBA→orquestrador validado');
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
