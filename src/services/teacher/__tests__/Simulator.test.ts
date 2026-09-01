import { assert } from '@/services/learning/__tests__/assert';
import { emptyConfidence } from '@/services/learning/ConfidenceService';
import { emptyLearningProfile, acceptedConf } from '@/services/learning/RealProgress';
import {
  buildSimulatorContext,
  buildWeakPhraseIds,
  buildSimulatorConversationHints,
  listCompatibleScenarios,
  pickSimulatorOpening,
  buildSimulatorKickoff,
} from '@/services/teacher/SimulatorEngine';
import {
  clearSimulatorSession,
  finalizeSimulatorSession,
  getSimulatorElapsedLabel,
  isSimulatorActive,
  isSimulatorTimeUp,
  recordSimulatorDeferred,
  recordSimulatorOpportunity,
  recordSimulatorTurn,
  startSimulatorSession,
} from '@/services/teacher/SimulatorSession';
import { L0_CHUNK_GRAPH } from '@/services/teacher/ZeroLanguageMode';

function learningWithWorkAndFood() {
  const learning = emptyLearningProfile();
  learning.phrases['survival-arbeite'] = acceptedConf('survival-arbeite');
  learning.phrases['l0-bridge-ich-arbeite-in'] = acceptedConf('l0-bridge-ich-arbeite-in');
  learning.phrases['l0-bridge-wo-arbeitest'] = acceptedConf('l0-bridge-wo-arbeitest');
  learning.phrases['l0-hook-ich-moechte'] = acceptedConf('l0-hook-ich-moechte');
  learning.phrases['l0-var-ich-moechte-wasser'] = acceptedConf('l0-var-ich-moechte-wasser');
  learning.phrases['l0-bridge-was-moechtest'] = acceptedConf('l0-bridge-was-moechtest');
  return learning;
}

export function testSimulator() {
  const learning = learningWithWorkAndFood();
  const scenarios = listCompatibleScenarios(learning);
  assert(scenarios.length >= 2, 'cenários compatíveis com trabalho+comida');
  assert(scenarios.some((s) => s.topic === 'work'), 'cenário trabalho disponível');
  assert(scenarios.some((s) => s.topic === 'food'), 'cenário comida disponível');

  const ctx = buildSimulatorContext({
    learning,
    phrases: [],
    mode: 'learned',
    durationMinutes: 10,
    trainingStyle: 'training',
  });
  assert(!!ctx, 'contexto criado com conteúdo real');
  assert(ctx!.knownStructures.length > 0, 'usa estruturas do learning state');
  assert(
    ctx!.knownStructures.every((s) => typeof s === 'string' && s.length > 0),
    'somente strings reais',
  );

  const opening = pickSimulatorOpening(ctx!);
  assert(opening.length > 0, 'abertura definida');
  const hints = buildSimulatorConversationHints(ctx!);
  assert(hints.length >= 1, 'dicas de conversa');
  const kickoff = buildSimulatorKickoff(ctx!, opening);
  assert(kickoff.includes('SIMULATOR'), 'kickoff modo simulador imersão');
  assert(kickoff.includes('GESPRÄCHSFLUSS') || kickoff.includes('NATÜRLICHES GESPRÄCH'), 'kickoff conversa');
  assert(kickoff.includes('Schleife'), 'anti-repetição no kickoff');
  assert(kickoff.includes(opening), 'abertura no kickoff');

  const weakCtx = buildSimulatorContext({
    learning,
    phrases: [],
    mode: 'weak',
    durationMinutes: 20,
    trainingStyle: 'training',
  });
  assert(!!weakCtx, 'modo weak com conteúdo');

  const learningEmpty = emptyLearningProfile();
  const noCtx = buildSimulatorContext({
    learning: learningEmpty,
    phrases: [],
    mode: 'learned',
    durationMinutes: 10,
    trainingStyle: 'training',
  });
  assert(noCtx === null, 'sem conteúdo → null honesto');

  // weak phrase ids
  const weakLearning = emptyLearningProfile();
  weakLearning.phrases['l0-hook-ich-muss'] = {
    ...emptyConfidence('l0-hook-ich-muss'),
    confidence: 20,
    timesProduced: 3,
    timesCorrect: 1,
    needsHelp: true,
    state: 'answeredWithHelp',
  };
  const weakIds = buildWeakPhraseIds(weakLearning);
  assert(weakIds.includes('l0-hook-ich-muss'), 'ponto fraco detectado');

  // session tracking
  clearSimulatorSession();
  assert(!isSimulatorActive(), 'sessão limpa');
  const sessionCtx = buildSimulatorContext({
    learning,
    phrases: [],
    mode: 'free',
    durationMinutes: 10,
    trainingStyle: 'real_test',
  })!;
  sessionCtx.endsAt = Date.now() + 60_000;
  startSimulatorSession(sessionCtx);
  assert(isSimulatorActive(), 'sessão iniciada');
  assert(getSimulatorElapsedLabel().includes(':'), 'elapsed label');

  recordSimulatorOpportunity();
  recordSimulatorTurn({
    phraseId: 'l0-var-ich-moechte-wasser',
    german: 'Ich möchte Wasser.',
    correct: true,
    withHint: false,
    withHelp: false,
    repeated: false,
  });
  recordSimulatorDeferred('l0-hook-ich-muss');
  const result = finalizeSimulatorSession();
  assert(!!result, 'resultado finalizado');
  assert(result!.responsesProduced === 1, '1 produção registrada');
  assert(result!.speechOpportunities === 1, '1 oportunidade');
  assert(result!.contentsUsed.length >= 1, 'conteúdo usado registrado');
  assert(result!.deferredToReview.length === 1, 'deferred para revisão');
  assert(!isSimulatorActive(), 'sessão encerrada após finalize');

  // time up
  const timed = buildSimulatorContext({
    learning,
    phrases: [],
    mode: 'learned',
    durationMinutes: 10,
    trainingStyle: 'training',
  })!;
  timed.endsAt = Date.now() - 1000;
  startSimulatorSession(timed);
  assert(isSimulatorTimeUp(), 'tempo esgotado detectado');
  finalizeSimulatorSession();

  // integração: estruturas só do currículo estudado
  const partial = emptyLearningProfile();
  partial.phrases['survival-arbeite'] = acceptedConf('survival-arbeite');
  const partialCtx = buildSimulatorContext({
    learning: partial,
    phrases: [],
    mode: 'learned',
    durationMinutes: 10,
    trainingStyle: 'training',
  });
  assert(!!partialCtx, 'parcial tem contexto');
  const bases = Object.keys(L0_CHUNK_GRAPH).length;
  assert(bases === 10, 'currículo L0 tem 10 bases');
  void bases;
}

if (import.meta.url.endsWith('Simulator.test.ts')) {
  try {
    testSimulator();
    console.log('Simulator: todos os testes passaram.');
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}
