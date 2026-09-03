/**
 * Live reconnect + transcript — geração, áudio stale, acumulação, turn_complete.
 * Uso: npx tsx src/services/voice/__tests__/LiveReconnectTranscript.test.ts
 */

class FakeAudioContext {
  sampleRate = 48000;
  currentTime = 1;
  state = 'running';
  destination = {};
  createBuffer(_ch: number, length: number, _rate: number) {
    return { getChannelData: () => new Float32Array(length) };
  }
  createBufferSource() {
    return {
      buffer: null as unknown,
      playbackRate: { value: 1 },
      connect() {},
      start() {
        this.started = true;
      },
      stop() {
        this.stopped = true;
        const cb = this.onended;
        queueMicrotask(() => cb?.());
      },
      disconnect() {},
      onended: null as (() => void) | null,
      started: false,
      stopped: false,
    };
  }
  resume() {
    return Promise.resolve();
  }
  close() {
    this.state = 'closed';
    return Promise.resolve();
  }
}

(globalThis as unknown as { window: Record<string, unknown> }).window = {
  AudioContext: FakeAudioContext,
  webkitAudioContext: FakeAudioContext,
};

async function run() {
  const {
    beginLiveSession,
    getLiveSessionGeneration,
    invalidateLiveSession,
    isLiveSessionCurrent,
  } = await import('@/services/voice/LiveSessionRegistry');
  const { audioStreamPlayer } = await import('@/services/voice/AudioStreamPlayer');
  const { GeminiTurnAccumulator, mergeTranscript } = await import('@/services/ai/GeminiResponseParser');
  const { liveStatusLinePt } = await import('@/pages/GeminiConversation');

  let passed = 0;
  let failed = 0;
  const assert = (name: string, cond: boolean) => {
    if (cond) {
      passed++;
      console.log('  ✓', name);
    } else {
      failed++;
      console.log('  ✗', name);
    }
  };

  // 1. Reconnect incrementa/invalida generation
  {
    const g1 = beginLiveSession();
    assert('generation inicial é current', isLiveSessionCurrent(g1));
    const g2 = invalidateLiveSession();
    assert('invalidate incrementa generation', g2 === g1 + 1);
    assert('generation antiga não é current', !isLiveSessionCurrent(g1));
    assert('nova generation é current', isLiveSessionCurrent(g2));
    assert('getLiveSessionGeneration reflete invalidate', getLiveSessionGeneration() === g2);
  }

  // 2–3. Áudio da generation antiga é descartado; stopAll antes da nova
  {
    const genA = beginLiveSession();
    audioStreamPlayer.setGeneration(genA);
    const sample = new Float32Array(240);
    for (let i = 0; i < sample.length; i++) sample[i] = 0.1;
    audioStreamPlayer.enqueue(sample, genA);
    assert('áudio da generation atual entra na fila', audioStreamPlayer.getIsPlaying());

    audioStreamPlayer.stopAll();
    assert('stopAll limpa reprodução', !audioStreamPlayer.getIsPlaying());

    const genB = invalidateLiveSession();
    audioStreamPlayer.setGeneration(genB);
    audioStreamPlayer.enqueue(sample, genA);
    assert('áudio stale (gen A) descartado após gen B', !audioStreamPlayer.getIsPlaying());

    audioStreamPlayer.enqueue(sample, genB);
    assert('áudio da nova generation é aceito', audioStreamPlayer.getIsPlaying());
    audioStreamPlayer.stopAll();
  }

  // 4. Transcript NÃO é finalizado só por tempo — status permanece RECEIVING
  {
    const acc = new GeminiTurnAccumulator();
    acc.applyChunk('assistant', 'Richtig!');
    assert('após chunk status é RECEIVING', acc.assistant.status === 'RECEIVING');
    await new Promise((r) => setTimeout(r, 50));
    assert('sem turn_complete continua RECEIVING', acc.assistant.status === 'RECEIVING');
    assert('texto parcial preservado', acc.assistant.text.includes('Richtig'));
  }

  // 5. Vários chunks acumulados em uma única fala
  {
    const acc = new GeminiTurnAccumulator();
    acc.applyChunk('assistant', 'Richtig!');
    acc.applyChunk('assistant', 'Richtig! Ich arbeite.');
    acc.applyChunk('assistant', 'Richtig! Ich arbeite. Kannst du');
    acc.applyChunk('assistant', 'Richtig! Ich arbeite. Kannst du die Phrase vervollständigen?');
    assert(
      'acumulado completo (snapshots)',
      acc.assistant.text === 'Richtig! Ich arbeite. Kannst du die Phrase vervollständigen?',
    );

    const acc2 = new GeminiTurnAccumulator();
    acc2.applyChunk('assistant', 'Richtig!');
    acc2.applyChunk('assistant', ' Ich arbeite.');
    acc2.applyChunk('assistant', ' Kannst du die Phrase vervollständigen?');
    assert(
      'acumulado completo (deltas)',
      /Richtig/.test(acc2.assistant.text)
        && /Ich arbeite/.test(acc2.assistant.text)
        && /vervollständigen/.test(acc2.assistant.text),
    );
  }

  // 6. turn_complete finaliza o transcript completo
  {
    const acc = new GeminiTurnAccumulator();
    acc.applyChunk('assistant', 'Richtig! Ich arbeite. Kannst du die Phrase vervollständigen?');
    const done = acc.complete('assistant');
    assert('complete marca COMPLETE', done.status === 'COMPLETE');
    assert('complete preserva texto integral', done.text.includes('vervollständigen'));
    assert('completedAt preenchido', !!done.completedAt);
  }

  // 7. Mic não é liberado por timeout de transcript
  {
    const acc = new GeminiTurnAccumulator();
    acc.applyChunk('assistant', 'Hallo');
    let micReleased = false;
    if (acc.assistant.status === 'COMPLETE') micReleased = true;
    assert('RECEIVING não libera mic', !micReleased && acc.assistant.status === 'RECEIVING');
    acc.complete('assistant');
    if (acc.assistant.status === 'COMPLETE') micReleased = true;
    assert('COMPLETE (turn_complete) permite liberar mic', micReleased);
  }

  // 8. UI status
  {
    assert(
      'RECEIVING → Professor falando',
      liveStatusLinePt({
        liveState: 'connected',
        userSpeaking: false,
        assistantSpeaking: true,
        teacherTurnStatus: 'RECEIVING',
        awaitingProfessor: false,
        responseStatus: 'none',
        started: true,
      }) === 'Professor falando…',
    );
    assert(
      'aguardando primeiro professor',
      liveStatusLinePt({
        liveState: 'connected',
        userSpeaking: false,
        assistantSpeaking: false,
        teacherTurnStatus: 'IDLE',
        awaitingProfessor: true,
        responseStatus: 'none',
        started: true,
      }) === 'Aguardando o professor…',
    );
    assert(
      'COMPLETE → Sua vez',
      liveStatusLinePt({
        liveState: 'connected',
        userSpeaking: false,
        assistantSpeaking: false,
        teacherTurnStatus: 'COMPLETE',
        awaitingProfessor: false,
        responseStatus: 'none',
        started: true,
      }) === 'Sua vez',
    );
    assert(
      'user RECEIVING → Você está falando',
      liveStatusLinePt({
        liveState: 'connected',
        userSpeaking: true,
        assistantSpeaking: false,
        teacherTurnStatus: 'COMPLETE',
        awaitingProfessor: false,
        responseStatus: 'none',
        started: true,
      }) === 'Você está falando…',
    );
    assert(
      'reconnecting tem prioridade',
      liveStatusLinePt({
        liveState: 'reconnecting',
        userSpeaking: false,
        assistantSpeaking: false,
        teacherTurnStatus: 'RECEIVING',
        awaitingProfessor: false,
        responseStatus: 'none',
        started: true,
      }) === 'Reconectando…',
    );
  }

  // 9. mergeTranscript não trunca
  {
    const long = 'A'.repeat(500) + ' Ende.';
    const merged = mergeTranscript('', long);
    assert('merge preserva texto longo', merged === long && merged.length === long.length);
  }

  // 10. Nova sessão não reproduz áudio da anterior
  {
    const oldGen = beginLiveSession();
    audioStreamPlayer.setGeneration(oldGen);
    const pcm = new Float32Array(128);
    pcm.fill(0.2);
    audioStreamPlayer.enqueue(pcm, oldGen);
    assert('sessão antiga tocando', audioStreamPlayer.getIsPlaying());

    audioStreamPlayer.stopAll();
    const newGen = invalidateLiveSession();
    audioStreamPlayer.setGeneration(newGen);
    audioStreamPlayer.enqueue(pcm, oldGen);
    assert('chunk atrasado da sessão antiga descartado', !audioStreamPlayer.getIsPlaying());
  }

  // 11. Um único source ativo; stopAll invalida onended (não inicia overlap)
  {
    const gen = beginLiveSession();
    audioStreamPlayer.setGeneration(gen);
    const pcm = new Float32Array(240);
    pcm.fill(0.15);
    audioStreamPlayer.enqueue(pcm, gen);
    audioStreamPlayer.enqueue(pcm, gen);
    const mid = audioStreamPlayer.getDebugState();
    assert('um source ativo por generation', mid.sourceCount === 1);
    assert('fila guarda o restante', mid.queueLength === 1);

    audioStreamPlayer.stopAll();
    await new Promise((r) => setTimeout(r, 20));
    const afterStop = audioStreamPlayer.getDebugState();
    assert('stopAll zera sourceCount', afterStop.sourceCount === 0);
    assert('stopAll esvazia fila', afterStop.queueLength === 0);
    assert('onended após stopAll não reinicia playback', !afterStop.isPlaying);
  }

  // 12. Reconnect: generation nova não overlap com antiga
  {
    const genA = beginLiveSession();
    audioStreamPlayer.setGeneration(genA);
    const pcm = new Float32Array(240);
    pcm.fill(0.2);
    audioStreamPlayer.enqueue(pcm, genA);
    audioStreamPlayer.stopAll();
    const genB = invalidateLiveSession();
    audioStreamPlayer.setGeneration(genB);
    await new Promise((r) => setTimeout(r, 20));
    audioStreamPlayer.enqueue(pcm, genA);
    assert('pós-reconnect chunk A descartado', audioStreamPlayer.getDebugState().sourceCount === 0);
    audioStreamPlayer.enqueue(pcm, genB);
    assert('pós-reconnect só 1 source da gen B', audioStreamPlayer.getDebugState().sourceCount === 1);
    audioStreamPlayer.stopAll();
  }

  console.log(`\n${passed} passaram, ${failed} falharam.`);
  if (failed > 0) process.exit(1);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
