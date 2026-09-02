import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assert } from '@/services/learning/__tests__/assert';
import { emptyLearningProfile, acceptedConf } from '@/services/learning/RealProgress';
import type { UserProfile } from '@/types';
import { ConversationOrchestrator } from '@/services/teacher/ConversationOrchestrator';
import {
  buildSimulatorContext,
  buildSimulatorKickoff,
  pickSimulatorOpening,
} from '@/services/teacher/SimulatorEngine';
import {
  isSimulatorKickoffClaimed,
  resetSimulatorKickoffGuard,
  tryClaimSimulatorKickoff,
} from '@/services/teacher/SimulatorKickoffGuard';
import {
  isOpeningDecision,
  shouldEmitPedagogicalNudge,
} from '@/services/voice/TeacherTurnSync';
import {
  beginLiveSession,
  invalidateLiveSession,
  isLiveSessionCurrent,
} from '@/services/voice/LiveSessionRegistry';

const __dir = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dir, '../../../..');

function readSrc(rel: string): string {
  return readFileSync(resolve(root, rel), 'utf8');
}

function zeroProfile(): UserProfile {
  return {
    id: 'u1',
    name: 'Test',
    level: 'zero',
    dailyMinutes: 20,
    goal: 'work',
    profession: 'dev',
    frequentSituations: [],
    interests: [],
    onboardingComplete: true,
    firstLessonComplete: true,
    currentDay: 1,
    streak: 1,
    lastStudyDate: null,
    immersionPhase: 1,
    turboMode: false,
    speechSpeed: 'normal',
    germanPercentage: 50,
    createdAt: new Date().toISOString(),
  };
}

function learningWithContent() {
  const learning = emptyLearningProfile();
  learning.phrases['survival-arbeite'] = acceptedConf('survival-arbeite');
  learning.phrases['l0-bridge-wo-arbeitest'] = acceptedConf('l0-bridge-wo-arbeitest');
  learning.phrases['l0-hook-ich-moechte'] = acceptedConf('l0-hook-ich-moechte');
  return learning;
}

function makeSimulatorIntent() {
  const learning = learningWithContent();
  const ctx = buildSimulatorContext({
    learning,
    phrases: [],
    mode: 'learned',
    durationMinutes: 10,
    trainingStyle: 'training',
  });
  assert(!!ctx, 'contexto simulador');
  return ctx!;
}

function createSimulatorOrch(gen: number) {
  const intent = makeSimulatorIntent();
  return ConversationOrchestrator.create({
    profile: zeroProfile(),
    learning: learningWithContent(),
    phrases: [],
    simulatorIntent: intent,
    liveSessionGeneration: gen,
  });
}

export async function testSimulatorInit() {
  resetSimulatorKickoffGuard();

  // TESTE 1: intent uma vez → exatamente 1 kickoff
  const g1 = 101;
  const orch1 = createSimulatorOrch(g1);
  assert(orch1.wasSimulatorKickoffClaimed(), 'TESTE 1: kickoff reivindicado na 1ª aplicação');
  const live1 = orch1.toLiveFields();
  assert(!!live1.orchestratorKickoff, 'TESTE 1: orchestratorKickoff presente');
  assert(live1.orchestratorKickoff!.includes('SIMULATOR'), 'TESTE 1: kickoff é do simulador');

  // TESTE 2: mesmo intent duas vezes (mesma geração) → 1 kickoff
  resetSimulatorKickoffGuard();
  const intent = makeSimulatorIntent();
  const orchA = ConversationOrchestrator.create({
    profile: zeroProfile(),
    learning: learningWithContent(),
    phrases: [],
    simulatorIntent: intent,
    liveSessionGeneration: 202,
  });
  assert(orchA.wasSimulatorKickoffClaimed(), 'TESTE 2a: primeira criação com kickoff');
  const orchB = ConversationOrchestrator.create({
    profile: zeroProfile(),
    learning: learningWithContent(),
    phrases: [],
    simulatorIntent: intent,
    liveSessionGeneration: 202,
  });
  assert(!orchB.wasSimulatorKickoffClaimed(), 'TESTE 2b: segunda criação suprime kickoff');
  assert(!orchB.toLiveFields().orchestratorKickoff, 'TESTE 2c: sem orchestratorKickoff na 2ª');

  // TESTE 3: efeito de init duas vezes (guard) → 1 claim
  resetSimulatorKickoffGuard();
  assert(tryClaimSimulatorKickoff('intent-x', 303), 'TESTE 3a: 1º claim ok');
  assert(!tryClaimSimulatorKickoff('intent-x', 303), 'TESTE 3b: 2º claim bloqueado');
  assert(isSimulatorKickoffClaimed('intent-x', 303), 'TESTE 3c: marcado como tratado');

  // TESTE 4: conectar duas vezes rapidamente → só sessão current
  resetSimulatorKickoffGuard();
  const genA = beginLiveSession();
  assert(isLiveSessionCurrent(genA), 'TESTE 4a: sessão A current');
  invalidateLiveSession();
  const genB = beginLiveSession();
  assert(!isLiveSessionCurrent(genA), 'TESTE 4b: sessão A obsoleta');
  assert(isLiveSessionCurrent(genB), 'TESTE 4c: sessão B current');

  // TESTE 5: geração antiga não é current (áudio descartado no player)
  const stale = genA;
  assert(!isLiveSessionCurrent(stale), 'TESTE 5: geração antiga inválida');

  // TESTE 6: kickoff + natural response → sem nudge na abertura
  const openingDecision = {
    flow: 'continueConversation' as const,
    action: 'converse' as const,
    mode: 'FREE_CONVERSATION' as const,
    reason: 'sessão iniciada com plano TeacherEngine',
    targetItem: 'Hallo',
    geminiNudge: 'nudge hipotético',
    eventsRecorded: [],
  };
  assert(isOpeningDecision(openingDecision), 'TESTE 6a: SESSION_STARTED é opening');
  assert(
    !shouldEmitPedagogicalNudge(openingDecision, {
      liveVoiceActive: true,
      naturalTeacherResponseExpected: true,
      assistantSpeaking: false,
      teacherReceiving: false,
      playerPlaying: false,
    }),
    'TESTE 6b: nudge bloqueado na abertura',
  );

  // TESTE 7: kickoff + continueConversation na abertura → geminiNudge null no orchestrator
  resetSimulatorKickoffGuard();
  const orch7 = createSimulatorOrch(707);
  const d7 = await orch7.handle({ type: 'SESSION_STARTED' });
  assert(d7.geminiNudge === null, 'TESTE 7: SESSION_STARTED sem nudge extra');

  // TESTE 8: kickoff único no servidor — sem empilhar L0 + abertura da aula
  const server = readSrc('server/index.js');
  const useGemini = readSrc('src/hooks/useGeminiLive.ts');
  assert(server.includes('buildImmersionSessionKickoff'), 'TESTE 8a: kickoff imersão dedicado');
  assert(server.includes('if (profile.simulatorMode || profile.miniProvaMode)'), 'TESTE 8b: ramo simulador no kickoff');
  assert(server.includes('buildSimulatorSystemInstruction'), 'TESTE 8c: system instruction simulador');
  assert(useGemini.includes("sessionKind: 'SIMULATOR'"), 'TESTE 8d: perfil SIMULATOR no cliente');
  assert(useGemini.includes('zeroLanguageMode: false'), 'TESTE 8e: L0 desligado no simulador');
  const opening = pickSimulatorOpening(makeSimulatorIntent());
  const kickoff = buildSimulatorKickoff(makeSimulatorIntent(), opening);
  assert(!kickoff.includes('ZERO LANGUAGE'), 'TESTE 8f: kickoff sem ciclo L0');
  assert(!kickoff.includes('PT→DE'), 'TESTE 8g: kickoff sem PT→DE');

  // TESTE 9/10: suites existentes permanecem (verificação de presença)
  assert(readSrc('src/services/voice/__tests__/TeacherTurnSync.test.ts').includes('resolveUiTeacherTurn'), 'TESTE 9: suite TeacherTurnSync existe');
  assert(readSrc('src/services/voice/__tests__/LiveSessionOwnership.test.ts').includes('beginLiveSession'), 'TESTE 10: suite LiveSessionOwnership existe');
}

if (import.meta.url.endsWith('SimulatorInit.test.ts')) {
  try {
    await testSimulatorInit();
    console.log('SimulatorInit: todos os testes passaram.');
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}
