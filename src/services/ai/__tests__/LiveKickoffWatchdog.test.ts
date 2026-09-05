/**
 * Live kickoff schedule + first-teacher watchdog.
 * Uso: npx tsx src/services/ai/__tests__/LiveKickoffWatchdog.test.ts
 */
import {
  FIRST_TEACHER_TURN_TIMEOUT_MS,
  FirstTeacherTurnWatchdog,
  isFatalLiveError,
  liveErrorUserMessage,
  normalizeLiveErrorCode,
  scheduleExclusiveKickoff,
  scheduleOnNextTick,
} from '@/services/ai/liveFirstTeacherWatchdog';

function assert(name: string, cond: boolean) {
  if (!cond) throw new Error(`FAIL: ${name}`);
  console.log('  ✓', name);
}

async function flushMicrotasks() {
  await Promise.resolve();
  await Promise.resolve();
}

async function run() {
  console.log('\n=== LiveKickoffWatchdog ===\n');

  // A) setupComplete agenda kickoff (próximo tick)
  {
    let ran = 0;
    scheduleOnNextTick(() => {
      ran += 1;
    });
    assert('A: ainda não rodou no mesmo tick', ran === 0);
    await flushMicrotasks();
    assert('A: rodou no próximo tick', ran === 1);
  }

  // B) kickoff enviado uma vez
  {
    const state = { kickoffSent: false };
    let sends = 0;
    const a = scheduleExclusiveKickoff(state, () => {
      sends += 1;
    });
    const b = scheduleExclusiveKickoff(state, () => {
      sends += 1;
    });
    assert('B: primeiro schedule', a === 'scheduled');
    assert('B: segundo schedule ainda scheduled (trava no tick)', b === 'scheduled');
    await flushMicrotasks();
    assert('B: exatamente 1 envio', sends === 1);
    assert('B: kickoffSent true', state.kickoffSent === true);
    const c = scheduleExclusiveKickoff(state, () => {
      sends += 1;
    });
    assert('C-skip: já enviado → skipped', c === 'skipped');
    await flushMicrotasks();
    assert('B: continua 1 envio', sends === 1);
  }

  // C/D) skipKickoff preserva (não reenvia / respeito a flags de continuidade)
  {
    const state = { kickoffSent: false, skipKickoff: true };
    let sends = 0;
    const r = scheduleExclusiveKickoff(state, () => {
      sends += 1;
    });
    assert('D: skipKickoff → skipped', r === 'skipped');
    await flushMicrotasks();
    assert('D: nenhum envio', sends === 0);
  }

  // E) resposta cancela watchdog
  {
    let timedOut = false;
    const w = new FirstTeacherTurnWatchdog(30, () => {
      timedOut = true;
    });
    w.start({
      sessionGeneration: 1,
      sessionId: 's1',
      targetId: 'l0-guten-morgen',
      currentLevel: 'zero',
    });
    assert('E: armado', w.isArmed());
    const got = w.markReceived();
    assert('E: markReceived true', got === true);
    await new Promise((r) => setTimeout(r, 50));
    assert('E: timeout não dispara após received', timedOut === false);
    assert('E: não armado', w.isArmed() === false);
  }

  // F) ausência de resposta dispara watchdog
  {
    let timedOut = false;
    const w = new FirstTeacherTurnWatchdog(40, () => {
      timedOut = true;
    });
    w.start({
      sessionGeneration: 2,
      sessionId: 's2',
      targetId: null,
      currentLevel: 'zero',
    });
    await new Promise((r) => setTimeout(r, 70));
    const sawTimeout = timedOut;
    assert('F: timeout dispara', sawTimeout);
  }

  // G) quota 1011
  {
    assert(
      'G: normalize quota',
      normalizeLiveErrorCode('exceeded your current quota') === 'LIVE_QUOTA_EXCEEDED',
    );
    assert('G: fatal quota', isFatalLiveError('LIVE_QUOTA_EXCEEDED'));
    assert(
      'G: mensagem quota',
      /cota|Gemini Live/i.test(liveErrorUserMessage('LIVE_QUOTA_EXCEEDED')),
    );
  }

  // H) WebSocket close
  {
    assert('H: live_closed fatal? → true (não ficar em pensando)', isFatalLiveError('live_closed'));
    assert(
      'H: mensagem close',
      /conexão|voz|instantes/i.test(liveErrorUserMessage('live_closed')),
    );
  }

  // I) timeout constante razoável (não 1–2s; não eterno)
  {
    assert('I: timeout >= 10s', FIRST_TEACHER_TURN_TIMEOUT_MS >= 10_000);
    assert('I: timeout <= 15s', FIRST_TEACHER_TURN_TIMEOUT_MS <= 15_000);
  }

  // J) sessão normal: clear sem timeout
  {
    let timedOut = false;
    const w = new FirstTeacherTurnWatchdog(30, () => {
      timedOut = true;
    });
    w.start({
      sessionGeneration: 3,
      sessionId: 's3',
      targetId: 'a1-x',
      currentLevel: 'a1',
    });
    w.clear();
    await new Promise((r) => setTimeout(r, 50));
    assert('J: clear impede timeout', timedOut === false);
  }

  // Target / orchestrator flags — scheduleExclusiveKickoff não altera payload
  {
    const payload = {
      targetId: 'l0-guten-morgen',
      orchestratorKickoff: 'ORCH_KICK',
      preparedKickoff: 'PREPARED_SHOULD_NOT_WIN',
    };
    const state = { kickoffSent: false };
    const box: { sent: typeof payload | null } = { sent: null };
    scheduleExclusiveKickoff(state, () => {
      box.sent = { ...payload };
    });
    await flushMicrotasks();
    assert('C: target explícito preservado', box.sent?.targetId === 'l0-guten-morgen');
    assert('D: orchestratorKickoff preservado', box.sent?.orchestratorKickoff === 'ORCH_KICK');
  }

  console.log('\nTodos os asserts LiveKickoffWatchdog passaram.\n');
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
