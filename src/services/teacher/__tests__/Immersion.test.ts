import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assert } from '@/services/learning/__tests__/assert';
import { emptyLearningProfile, acceptedConf } from '@/services/learning/RealProgress';
import {
  buildImmersionMiniProvaKickoff,
  buildImmersionSimulatorKickoff,
  GERMAN_PROGRESSIVE_HELP,
  GERMAN_SILENCE_POLICY,
} from '@/services/teacher/ImmersionPolicy';
import {
  buildMiniProvaContext,
  buildMiniProvaQuestions,
  evaluateMiniProvaResponse,
} from '@/services/teacher/MiniProvaEngine';
import {
  createMiniProvaSnapshot,
  finalizeMiniProvaResult,
  recordMiniProvaAnswer,
  autonomyFromFlags,
} from '@/services/teacher/MiniProvaSession';
import { buildWeakPhraseIds } from '@/services/teacher/SimulatorEngine';
import { resolveUiTeacherTurn } from '@/services/voice/TeacherTurnSync';

const __dir = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dir, '../../../..');

function readSrc(rel: string): string {
  return readFileSync(resolve(root, rel), 'utf8');
}

function learningWithContent() {
  const learning = emptyLearningProfile();
  learning.phrases['survival-arbeite'] = acceptedConf('survival-arbeite');
  learning.phrases['l0-bridge-wo-arbeitest'] = acceptedConf('l0-bridge-wo-arbeitest');
  learning.phrases['l0-hook-ich-moechte'] = acceptedConf('l0-hook-ich-moechte');
  learning.phrases['l0-var-ich-moechte-wasser'] = acceptedConf('l0-var-ich-moechte-wasser');
  learning.phrases['l0-bridge-was-moechtest'] = acceptedConf('l0-bridge-was-moechtest');
  learning.phrases['l0-bridge-ich-arbeite-in'] = { ...acceptedConf('l0-bridge-ich-arbeite-in'), confidence: 25, needsHelp: true };
  return learning;
}

export function testImmersion() {
  const geminiConv = readSrc('src/pages/GeminiConversation.tsx');
  const useGemini = readSrc('src/hooks/useGeminiLive.ts');

  assert(geminiConv.includes('live.immersionMode'), 'GeminiConversation detecta imersão');
  assert(geminiConv.includes('allowTextInput={!immersion}'), 'sem campo de texto em imersão');
  assert(!geminiConv.includes('translateGermanToPortuguese(german)') || geminiConv.includes('if (live.immersionMode)'), 'tradução desligada em imersão');
  assert(geminiConv.includes('MINI-PRÜFUNG'), 'header mini prova em alemão');
  assert(geminiConv.includes('SIMULATOR'), 'header simulador em alemão');
  assert(geminiConv.includes('promptSubtitle = immersion'), 'sem subtítulo PT em imersão');

  assert(useGemini.includes('immersionMode'), 'useGeminiLive expõe immersionMode');
  assert(useGemini.includes('miniProvaMode'), 'useGeminiLive expõe miniProvaMode');
  assert(useGemini.includes('simulatorMode: true'), 'perfil simulador explícito');
  assert(useGemini.includes('zeroLanguageMode: false'), 'L0 desligado em imersão');
  assert(useGemini.includes('titleDe'), 'label cenário em alemão');

  const simKick = buildImmersionSimulatorKickoff({
    settingDe: 'Im Café',
    roleDe: 'Gast',
    durationMinutes: 20,
    openingGerman: 'Guten Tag!',
    structures: ['Ich möchte Wasser.'],
    vocabulary: ['Wasser', 'Kaffee'],
    conversationHints: ['Was möchtest du trinken?', 'Was möchtest du essen?'],
  });
  assert(simKick.includes('NATÜRLICHES GESPRÄCH'), 'kickoff conversa natural');
  assert(simKick.includes('GESPRÄCHSFLUSS'), 'fluxo conversa não aula');
  assert(simKick.includes(GERMAN_SILENCE_POLICY.slice(0, 20)), 'política de silêncio');
  assert(!simKick.includes('Schwächen üben:'), 'não revelar pontos fracos');

  const mpKick = buildImmersionMiniProvaKickoff({
    questionGerman: 'Sag: Ich arbeite.',
    questionType: 'production',
    total: 10,
    index: 2,
  });
  assert(mpKick.includes('MINI-PRÜFUNG'), 'kickoff mini prova');
  assert(mpKick.includes('KEIN Unterricht'), 'não ensina durante prova');
  assert(mpKick.includes('5–8 Sekunden'), 'tempo de recuperação');
  assert(!mpKick.includes('Noch einmal'), 'sem retry na prova');

  assert(GERMAN_PROGRESSIVE_HELP.includes('Stufe 1'), 'ajuda progressiva definida');

  const learning = learningWithContent();
  const questions = buildMiniProvaQuestions(learning, [], 12);
  assert(questions.length >= 3, 'questões do learning state');
  assert(questions.every((q) => !q.promptDe.toLowerCase().includes('sag:')), 'sem instrução de aula');
  assert(questions.some((q) => q.promptDe.includes('Restaurant') || q.promptDe.includes('?')), 'transferência contextual');
  assert(questions.some((q) => q.weak), 'pontos fracos incluídos');

  const weakIds = buildWeakPhraseIds(learning);
  const weakInQuestions = questions.filter((q) => weakIds.includes(q.phraseId));
  assert(weakInQuestions.length >= 1, 'prioridade para pontos fracos');

  const ctx = buildMiniProvaContext(learning, []);
  assert(!!ctx, 'contexto mini prova');
  let snap = createMiniProvaSnapshot(ctx!);
  const q0 = snap.questions[0];
  const sampleAnswer = q0.expectedKeywords?.length
    ? `Ich ${q0.expectedKeywords[0]} etwas.`
    : q0.german;
  const autonomyOk = evaluateMiniProvaResponse(sampleAnswer, q0, { usedHelp: false, attempt: 1 });
  assert(autonomyOk === 'correct_no_help', 'autonomia sem ajuda');
  const autonomyHint = evaluateMiniProvaResponse(sampleAnswer, q0, { usedHelp: true, attempt: 1 });
  assert(autonomyHint === 'correct_after_hint', 'autonomia com ajuda separada');

  snap = recordMiniProvaAnswer(snap, {
    phraseId: q0.phraseId,
    german: q0.german,
    type: q0.type,
    autonomy: autonomyOk,
    correct: true,
    userSaid: q0.german,
    at: new Date().toISOString(),
  });
  assert(snap.answers.length === 1, 'resposta registrada');
  assert(snap.currentIndex === 1, 'avança para próxima questão');

  const flags = autonomyFromFlags({ correct: true, usedHelp: false, attempt: 1, userSaid: 'test' });
  assert(flags === 'correct_no_help', 'autonomyFromFlags autônomo');

  const partialSnap = { ...snap, answers: snap.answers, completed: true, currentIndex: snap.total };
  const result = finalizeMiniProvaResult(partialSnap);
  assert(result.totalQuestions === snap.total, 'resultado real — total');
  assert(typeof result.autonomyPercent === 'number', 'autonomia calculada');
  assert(result.contentsChecked >= 1, 'conteúdos verificados');

  const ui = resolveUiTeacherTurn({
    teacherUtterance: 'Guten Tag',
    pedagogicalTarget: 'Hallo',
    turnId: 't1',
    sessionGeneration: 1,
    final: true,
  });
  assert(ui === 'Guten Tag', 'TeacherTurnSync — transcript como fonte');

  const miniProvaPage = readSrc('src/pages/MiniProvaPage.tsx');
  assert(!miniProvaPage.includes('traduz'), 'mini prova setup sem tradução');
  assert(miniProvaPage.includes('MINI-PRÜFUNG'), 'mini prova UI em alemão');

  const simPage = readSrc('src/pages/SimulatorPage.tsx');
  assert(simPage.includes('SIMULATOR'), 'simulador setup em alemão');
  assert(simPage.includes('60'), 'duração 60 min disponível');
}

if (import.meta.url.endsWith('Immersion.test.ts')) {
  try {
    testImmersion();
    console.log('Immersion: todos os testes passaram.');
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}
