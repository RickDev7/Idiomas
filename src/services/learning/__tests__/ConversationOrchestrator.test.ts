import { buildLearningProfile, emptyConfidence, updateConfidence } from '@/services/learning/ConfidenceService';
import { EventStore } from '@/services/learning/EventStore';
import { MemoryService } from '@/services/learning/MemoryService';
import {
  ConversationOrchestrator,
  buildConversationPlan,
  detectPossibleGrammarError,
  evaluateProduction,
  loadPersistedOrchestratorState,
  looksLikeCorrectProduction,
  pickPrimaryTarget,
  reevaluatePlan,
} from '@/services/teacher/ConversationOrchestrator';
import type { Phrase, UserProfile } from '@/types';
import { assert } from './assert';

/** Polyfill mínimo para EventStore / MemoryService no Node. */
function ensureLocalStorage() {
  if (typeof globalThis.localStorage !== 'undefined') return;
  const store: Record<string, string> = {};
  (globalThis as unknown as { localStorage: Storage }).localStorage = {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = String(v); },
    removeItem: (k: string) => { delete store[k]; },
    clear: () => { Object.keys(store).forEach((k) => delete store[k]); },
    key: () => null,
    length: 0,
  };
}

function fakeProfile(): UserProfile {
  return {
    id: 'u1',
    name: 'Test',
    level: 'little',
    goal: 'daily',
    dailyMinutes: 20,
    germanPercentage: 60,
    turboMode: false,
    streak: 1,
    currentDay: 2,
    onboardingComplete: true,
    firstLessonComplete: true,
    profession: '',
    frequentSituations: ['daily'],
    interests: [],
    lastStudyDate: new Date().toISOString(),
    immersionPhase: 1,
    speechSpeed: 'normal',
    createdAt: new Date().toISOString(),
  };
}

function fakePhrase(id: string, german: string, pt: string): Phrase {
  return {
    id,
    german,
    portuguese: pt,
    category: 'survival',
    mastery: 'recognize',
    reviewStage: 'learning',
    nextReview: null,
    timesReviewed: 0,
    timesCorrect: 0,
    timesIncorrect: 0,
    isAutomatic: false,
    contexts: [],
  };
}

export async function testConversationOrchestrator() {
  ensureLocalStorage();
  await EventStore.clear();
  await MemoryService.saveConfidenceMap({});

  const profile = fakeProfile();
  const phrases = [
    fakePhrase('p-pause', 'Ich brauche eine Pause.', 'Preciso de uma pausa.'),
    fakePhrase('p-work', 'Ich arbeite heute.', 'Eu trabalho hoje.'),
    fakePhrase('survival-arbeite', 'Ich arbeite heute.', 'Eu trabalho hoje.'),
  ];

  // --- Plano inicial / TeacherEngine ---
  const emptyLearning = buildLearningProfile(profile, [], [], null, {});
  const first = buildConversationPlan(profile, emptyLearning, phrases);
  assert(first.action === 'introduce', 'sem memória → INTRODUCE');
  assert(!!first.target, 'escolhe frase-alvo');
  assert(first.teacherDirective.includes('ORQUESTRAÇÃO'), 'gera diretiva');
  assert(first.training.totalMinutes === 20, 'usa planTodaysTraining');

  let c = emptyConfidence('p-work');
  c = updateConfidence(c, { type: 'heard', correct: true });
  c = updateConfidence(c, { type: 'repeated', correct: true });
  c = updateConfidence(c, { type: 'produced', correct: true, responseMs: 4000, withHelp: false });
  const learning = buildLearningProfile(profile, [], [], null, { 'p-work': c });
  const picked = pickPrimaryTarget(learning, phrases);
  assert(
    picked.action === 'transfer' || picked.action === 'practice' || picked.action === 'recall',
    'nextBest via RealUse',
  );

  const plan = buildConversationPlan(profile, learning, phrases);
  const mid = reevaluatePlan(plan, profile, learning, phrases, 60_000, 1);
  assert(mid.topic === plan.topic, 'sticky topic');

  // --- Detecção crítica ---
  const err = detectPossibleGrammarError('Ich arbeiten heute.');
  assert(!!err, 'detecta Ich arbeiten');
  assert(err!.correction === 'Ich arbeite heute.', 'correção correta');
  assert(err!.pattern === 'ich_arbeiten', 'pattern ich_arbeiten');

  const ok = detectPossibleGrammarError('Ich arbeite heute.');
  assert(ok === null, 'frase correta NÃO gera erro');
  assert(looksLikeCorrectProduction('Ich arbeite heute.', 'Ich arbeite heute.'), 'reconhece produção correta vs target');
  assert(!looksLikeCorrectProduction('Ich arbeite heute.', 'Wo arbeitest du?'), 'não marca CORRECT com target diferente');
  assert(!looksLikeCorrectProduction('Ich arbeite heute.'), 'sem target → não CORRECT');
  assert(evaluateProduction('Ich arbeiten heute.', 'Ich arbeite heute.') === 'NEEDS_REPAIR', 'arbeiten → NEEDS_REPAIR');
  assert(evaluateProduction('Ich wohne in Cuxhaven.') === 'UNKNOWN', 'texto livre → UNKNOWN');

  // --- Orchestrator runtime: erro → PRACTICE + evento ---
  const orch = ConversationOrchestrator.create({ profile, learning, phrases, sessionId: 'test-1' });
  const started = await orch.handle({ type: 'SESSION_STARTED' });
  assert(started.eventsRecorded.includes('SESSION_STARTED'), 'SESSION_STARTED registrado');

  const bad = await orch.handle({ type: 'USER_UTTERANCE', text: 'Ich arbeiten heute.' });
  assert(
    bad.flow === 'intervenePedagogically' || bad.flow === 'startMicroPractice',
    'intervenção pedagógica ou microtreino',
  );
  assert(bad.action === 'practice', 'ação PRACTICE');
  assert(
    bad.mode === 'PEDAGOGICAL_INTERVENTION' || bad.mode === 'MICRO_PRACTICE',
    'modo intervenção ou micro',
  );
  assert(!!bad.geminiNudge || !!bad.microPractice, 'nudge ou micro');
  assert(bad.eventsRecorded.includes('PHRASE_FAILED'), 'PHRASE_FAILED salvo');
  assert(bad.eventsRecorded.includes('USER_UTTERANCE'), 'USER_UTTERANCE salvo');
  assert(bad.correction === 'Ich arbeite heute.', 'correção no decision');

  const persisted = loadPersistedOrchestratorState();
  assert(!!persisted, 'estado de sessão persistido');
  assert(persisted!.lastAction === 'practice' || persisted!.targetItem === 'Ich arbeite heute.', 'prática registrada');
  assert(persisted!.targetItem === 'Ich arbeite heute.', 'targetItem persistido');

  if (bad.flow === 'startMicroPractice') {
    await orch.handle({ type: 'MICRO_SKIP' });
  }

  const eventsAfterBad = await EventStore.load();
  assert(
    eventsAfterBad.some((e) => e.type === 'PHRASE_FAILED' && e.context?.includes('arbeiten')),
    'evento PHRASE_FAILED na memória de eventos',
  );

  // --- Frase livre (Cuxhaven) não descartada ---
  const orchCux = ConversationOrchestrator.create({
    profile, learning: emptyLearning, phrases, sessionId: 'test-cux',
  });
  const free = await orchCux.handleUserUtterance('Ich wohne in Cuxhaven.');
  assert(free.eventsRecorded.includes('USER_UTTERANCE'), 'Cuxhaven → USER_UTTERANCE');
  assert(free.eventsRecorded.includes('UNCLASSIFIED_USER_UTTERANCE'), 'Cuxhaven → UNCLASSIFIED');
  assert(free.flow === 'continueConversation', 'Cuxhaven → CONTINUE');
  const unc = MemoryService.loadUnclassifiedUtterances();
  assert(unc.some((u) => /Cuxhaven/i.test(u.text)), 'Cuxhaven na memória não classificada');

  // --- Frase correta: produção independente pode abrir TRANSFER (não é intervenção de erro) ---
  const orch2 = ConversationOrchestrator.create({ profile, learning, phrases, sessionId: 'test-2' });
  await orch2.handle({ type: 'SESSION_STARTED' });
  const good = await orch2.handle({ type: 'USER_UTTERANCE', text: 'Ich arbeite heute.' });
  assert(good.flow === 'continueConversation', 'frase correta → continueConversation');
  assert(good.action !== 'practice' || good.mode !== 'PEDAGOGICAL_INTERVENTION', 'sem intervenção de erro');
  if (good.action === 'transfer') {
    assert(!!good.geminiNudge && /TRANSFER|Und /i.test(good.geminiNudge), 'nudge de transferência');
    const t2 = await orch2.handle({ type: 'USER_UTTERANCE', text: 'Ich arbeite morgen.' });
    assert(
      t2.eventsRecorded.includes('PHRASE_TRANSFERRED') || t2.reason.includes('transfer'),
      'produção da variante → PHRASE_TRANSFERRED',
    );
  }

  // --- Após erro, produção correta (pode abrir micro se relevante) ---
  const orch3 = ConversationOrchestrator.create({ profile, learning, phrases, sessionId: 'test-3' });
  const err3 = await orch3.handle({ type: 'USER_UTTERANCE', text: 'Ich arbeiten heute.' });
  assert(
    err3.flow === 'startMicroPractice' || err3.flow === 'intervenePedagogically',
    'erro dispara prática',
  );
  if (err3.flow === 'startMicroPractice') {
    await orch3.handle({ type: 'MICRO_ANSWER', text: 'Ich arbeite heute.' });
    const done3 = await orch3.handle({ type: 'MICRO_ANSWER', text: 'Ich arbeite heute.' });
    assert(done3.flow === 'resumeConversation', 'micro → resume');
  } else {
    const fixed = await orch3.handle({ type: 'USER_UTTERANCE', text: 'Ich arbeite heute.' });
    assert(fixed.flow === 'continueConversation', 'após correção → continuar');
  }

  await orch3.handle({ type: 'TEACHER_UTTERANCE', text: 'Was machst du heute?' });
  assert(orch3.getContext().lastTeacherUtterance.includes('Was machst'), 'TEACHER_UTTERANCE no contexto');

  // --- Orchestrator: Ich arbeiten morgen → MicroPractice → correção → resume ---
  const orchMicro = ConversationOrchestrator.create({
    profile,
    learning: emptyLearning,
    phrases,
    sessionId: 'test-micro',
  });
  await orchMicro.handle({ type: 'TEACHER_UTTERANCE', text: 'Was machst du morgen?' });
  const microStart = await orchMicro.handle({ type: 'USER_UTTERANCE', text: 'Ich arbeiten morgen.' });
  assert(microStart.flow === 'startMicroPractice', 'Ich arbeiten morgen → MicroPractice');
  assert(!!microStart.microPractice, 'sessão micro anexada');
  assert(microStart.microPractice!.targetItem === 'Ich arbeite morgen.', 'target micro = correção');
  assert(microStart.microPractice!.returnPrompt.includes('morgen'), 'volta com pergunta morgen');
  assert(microStart.eventsRecorded.includes('MICRO_PRACTICE_STARTED'), 'MICRO_PRACTICE_STARTED');
  assert(microStart.microPractice!.snapshot.lastUserUtterance.includes('arbeiten'), 'snapshot user');
  assert(microStart.microPractice!.reason.includes('grammar_error'), 'reason no session');

  const guided = await orchMicro.handle({ type: 'MICRO_ANSWER', text: 'Ich arbeite morgen.' });
  assert(guided.eventsRecorded.includes('MICRO_PRACTICE_ATTEMPT') || guided.flow === 'resumeConversation', 'attempt ou resume');
  assert(guided.microPractice?.phase === 'independent' || guided.flow === 'resumeConversation', 'avança ciclo');
  if (guided.flow !== 'resumeConversation') {
    const done = await orchMicro.handle({ type: 'MICRO_ANSWER', text: 'Ich arbeite morgen.' });
    assert(done.flow === 'resumeConversation', 'após independent → resume');
    assert(
      !!done.geminiNudge && (
        done.geminiNudge.includes('Also')
        || done.geminiNudge.includes('morgen')
        || /TRANSFER|Und /i.test(done.geminiNudge)
      ),
      'nudge de retorno ou transfer',
    );
    assert(done.eventsRecorded.includes('MICRO_PRACTICE_COMPLETED'), 'MICRO_PRACTICE_COMPLETED');
    assert(done.eventsRecorded.includes('MICRO_PRACTICE_SUCCESS'), 'MICRO_PRACTICE_SUCCESS');
    assert(orchMicro.getMicroPractice() === null, 'micro limpo após resume');
    assert(
      orchMicro.getContext().mode === 'FREE_CONVERSATION' || orchMicro.getContext().mode === 'GUIDED_CONVERSATION',
      'modo conversa restaurado',
    );
  }

  await orchMicro.handle({ type: 'SESSION_ENDED', status: 'COMPLETED' });
  const all = await EventStore.load();
  assert(all.some((e) => e.type === 'SESSION_ENDED'), 'SESSION_ENDED na memória');
}
