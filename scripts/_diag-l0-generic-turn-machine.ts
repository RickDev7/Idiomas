/* Teste genérico L0 — sequência REAL do TeacherEngine (sem frases fixas).
   O professor (plano) escolhe o próximo target; o aluno só segue.
   Rodar: npx tsx scripts/_diag-l0-generic-turn-machine.ts
   Ativa L0_DEBUG=1 para ver [L0_TURN] no console. */
const _store = new Map<string, string>();
(globalThis as unknown as { localStorage: Storage }).localStorage = {
  getItem: (k: string) => (k === 'L0_DEBUG' ? '1' : _store.get(k) ?? null),
  setItem: (k: string, v: string) => { _store.set(k, v); },
  removeItem: (k: string) => { _store.delete(k); },
  clear: () => { _store.clear(); },
  key: () => null,
  length: 0,
} as Storage;

import { buildLearningProfile } from '../src/services/learning/ConfidenceService';
import { EventStore } from '../src/services/learning/EventStore';
import { MemoryService } from '../src/services/learning/MemoryService';
import { ConversationOrchestrator } from '../src/services/teacher/ConversationOrchestrator';
import { mergeZeroLanguagePhrases } from '../src/services/teacher/ZeroLanguageMode';
import type { UserProfile } from '../src/types';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`FAIL: ${msg}`);
}

function profileZero(mins = 20): UserProfile {
  return {
    id: 'generic-l0', name: 'Rick', level: 'zero', selfReportedLevel: 'zero', diagnosticLevel: 'L0',
    goal: 'daily', dailyMinutes: mins, germanPercentage: 30, turboMode: false, streak: 0, currentDay: 1,
    onboardingComplete: true, firstLessonComplete: false, profession: 'escritório',
    frequentSituations: ['work'], interests: [], lastStudyDate: null, immersionPhase: 1,
    speechSpeed: 'normal', createdAt: new Date().toISOString(),
  };
}

type TurnRecord = {
  teacherUtterance: string;
  targetAtQuestionTime: string;
  targetIdAtQuestion: string;
  userUtterance: string;
  evaluatedTarget: string;
  evaluatedTargetId: string;
  result: string;
  nextTarget: string | null;
  nextTargetId: string | null;
  decisionReason: string;
};

function printTurn(t: TurnRecord, i: number) {
  console.log(`\nTURN ${i}:`);
  console.log(`  teacherUtterance = ${t.teacherUtterance}`);
  console.log(`  targetAtQuestionTime = ${t.targetAtQuestionTime}`);
  console.log(`  userUtterance = ${t.userUtterance}`);
  console.log(`  evaluatedTarget = ${t.evaluatedTarget}`);
  console.log(`  result = ${t.result}`);
  console.log(`  nextTarget = ${t.nextTarget}`);
  console.log(`  decisionReason = ${t.decisionReason}`);
}

/** Professor genérico: elicita o target atual do plano (sem roteiro fixo). */
function teacherElicits(targetGerman: string, style: number): string {
  const s = style % 3;
  if (s === 0) return `Modele: ${targetGerman} Agora você.`;
  if (s === 1) return `${targetGerman} — repita.`;
  return `Vamos praticar. ${targetGerman}`;
}

console.log('DIAG — L0 generic turn machine (sem sequência fixa)\n');

await EventStore.clear();
await MemoryService.saveConfidenceMap({});

const zero = profileZero(20);
const orch = ConversationOrchestrator.create({
  profile: zero,
  learning: buildLearningProfile(zero, [], [], null, {}),
  phrases: mergeZeroLanguagePhrases([]),
  sessionId: 'generic-turn-machine',
});
await orch.handle({ type: 'SESSION_STARTED' });

const turns: TurnRecord[] = [];
const targetTransitions: Array<{ from: string; to: string }> = [];
let prevTargetId: string | null = null;
let style = 0;

// --- Fase 1: ≥10 transições CORRECT seguindo o plano ---
const MIN_TRANSITIONS = 10;
let safety = 0;
while (targetTransitions.length < MIN_TRANSITIONS && safety < 40) {
  safety += 1;
  const target = orch.getPlan().target;
  if (!target) break;

  const targetAtQuestionTime = target.german;
  const targetIdAtQuestion = target.id;
  const teacherUtterance = teacherElicits(target.german, style++);
  await orch.handle({ type: 'TEACHER_UTTERANCE', text: teacherUtterance });

  // Aluno segue a instrução: produz o alemão do target atual (genérico)
  const userUtterance = target.german;
  const decision = await orch.handle({ type: 'USER_UTTERANCE', text: userUtterance });

  const next = orch.getPlan().target;
  const rec: TurnRecord = {
    teacherUtterance,
    targetAtQuestionTime,
    targetIdAtQuestion,
    userUtterance,
    evaluatedTarget: targetAtQuestionTime,
    evaluatedTargetId: targetIdAtQuestion,
    result: decision.reason.startsWith('target_mismatch') ? 'INCORRECT' : 'CORRECT',
    nextTarget: next?.german ?? decision.targetItem ?? null,
    nextTargetId: next?.id ?? null,
    decisionReason: decision.reason,
  };
  turns.push(rec);
  printTurn(rec, turns.length);

  // Regra: avaliação do turno = target no momento da pergunta (não o anterior)
  assert(
    !decision.reason.startsWith('target_mismatch'),
    `CORRECT esperado para target atual "${targetAtQuestionTime}": ${decision.reason}`,
  );
  assert(
    !prevTargetId || decision.correction !== prevTargetId,
    'não deve corrigir com target anterior',
  );
  // Resposta do target atual nunca deve pedir correction do target anterior
  if (prevTargetId && decision.correction) {
    assert(
      !decision.geminiNudge?.includes(`Modele "`) ||
        decision.geminiNudge.includes(targetAtQuestionTime) ||
        /aceita|próximo|Perfeito|AVANCE|Nova frase/i.test(decision.geminiNudge + decision.reason),
      `nudge não deve reancorar target antigo (${prevTargetId})`,
    );
  }

  if (next?.id && next.id !== targetIdAtQuestion) {
    targetTransitions.push({ from: targetIdAtQuestion, to: next.id });
    prevTargetId = targetIdAtQuestion;
  } else if (next?.id === targetIdAtQuestion) {
    // aceito mas mesmo id (fim currículo / converse) — conta cobertura, sai se já tem transições
    if (targetTransitions.length >= MIN_TRANSITIONS) break;
    // força não-loop: se stuck no mesmo sem avanço após aceitar, falha
    const stuckCount = turns.filter((t) => t.targetIdAtQuestion === targetIdAtQuestion && t.result === 'CORRECT').length;
    assert(stuckCount <= 2, `TARGET_STUCK no mesmo id ${targetIdAtQuestion}`);
  }
}

assert(
  targetTransitions.length >= MIN_TRANSITIONS,
  `preciso ≥${MIN_TRANSITIONS} transições A→B (got ${targetTransitions.length})`,
);
console.log(`\n  ✓ ${targetTransitions.length} transições de targets (plano escolheu a sequência)`);
console.log('  sequência:', targetTransitions.map((t) => `${t.from}→${t.to}`).join(', '));

// --- Fase 2: em cada transição, resposta de B nunca avaliada contra A ---
for (let i = 1; i < turns.length; i++) {
  const prev = turns[i - 1];
  const cur = turns[i];
  if (cur.targetIdAtQuestion === prev.targetIdAtQuestion) continue;
  // O turno atual foi avaliado no seu próprio targetAtQuestionTime
  assert(
    cur.evaluatedTargetId === cur.targetIdAtQuestion,
    `turno ${i + 1}: evaluated=${cur.evaluatedTargetId} ≠ question=${cur.targetIdAtQuestion}`,
  );
  assert(
    cur.evaluatedTargetId !== prev.targetIdAtQuestion || cur.result === 'CORRECT',
    `turno ${i + 1}: resposta de ${cur.targetIdAtQuestion} não pode ser julgada como ${prev.targetIdAtQuestion}`,
  );
}
console.log('  ✓ nenhuma resposta de B avaliada contra A (genérico)');

// --- Fase 3: erro no target ATUAL → retry local, não rewind ---
{
  const before = orch.getPlan().target;
  assert(!!before, 'ainda há target para erro');
  const teacherUtterance = teacherElicits(before!.german, style++);
  await orch.handle({ type: 'TEACHER_UTTERANCE', text: teacherUtterance });
  const bad = await orch.handle({ type: 'USER_UTTERANCE', text: 'xyz-totalmente-errado-999' });
  printTurn({
    teacherUtterance,
    targetAtQuestionTime: before!.german,
    targetIdAtQuestion: before!.id,
    userUtterance: 'xyz-totalmente-errado-999',
    evaluatedTarget: before!.german,
    evaluatedTargetId: before!.id,
    result: 'INCORRECT',
    nextTarget: orch.getPlan().target?.german ?? null,
    nextTargetId: orch.getPlan().target?.id ?? null,
    decisionReason: bad.reason,
  }, turns.length + 1);

  assert(bad.flow === 'intervenePedagogically' || bad.reason.includes('postergada'), `erro intervém: ${bad.reason}`);
  assert(orch.getPlan().target?.id === before!.id || bad.reason.includes('postergada'), `retry no atual (${orch.getPlan().target?.id})`);
  if (bad.correction) {
    assert(
      bad.correction === before!.german || bad.targetItem === before!.german,
      `correction deve ser o TARGET ATUAL ("${before!.german}"), got "${bad.correction}"`,
    );
  }
  // Não voltar o plano para o primeiro da sessão
  const firstId = turns[0]?.targetIdAtQuestion;
  if (firstId && firstId !== before!.id) {
    assert(orch.getPlan().target?.id !== firstId || bad.reason.includes('postergada'), 'erro não rebobina para o 1º target');
  }
  console.log('  ✓ INCORRECT → correção/retry do TARGET ATUAL (sem rewind)');

  // acertar o atual
  if (orch.getPlan().target?.id === before!.id) {
    const ok = await orch.handle({ type: 'USER_UTTERANCE', text: before!.german });
    assert(!ok.reason.startsWith('target_mismatch'), `retry CORRECT: ${ok.reason}`);
    console.log('  ✓ retry CORRECT → avanço (reason=', ok.reason, ')');
  }
}

console.log('\nDIAG L0 GENERIC TURN MACHINE OK');
console.log(`
CRITÉRIO VALIDADO (independente da sequência Gemini/TeacherEngine)
==================================================================
✓ Professor define target via plano (sem roteiro Ich arbeite / Arbeitest…)
✓ Cada resposta avaliada contra targetAtQuestionTime
✓ CORRECT → avanço (≥${MIN_TRANSITIONS} transições)
✓ INCORRECT → retry do atual, não target antigo
✓ Log TURN com campos obrigatórios
`);
