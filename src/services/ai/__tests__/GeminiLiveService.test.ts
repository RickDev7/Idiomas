import { GeminiLiveService, type LiveProfile, type LiveSessionState } from '@/services/ai/GeminiLiveService';

function makeService(handlers: any, profile: LiveProfile = {}) {
  return new GeminiLiveService(profile, handlers, 'http://localhost:8787');
}

async function run() {
  let passed = 0;
  let failed = 0;
  const assert = (name: string, cond: boolean) => {
    if (cond) { passed++; console.log('  ✓', name); }
    else { failed++; console.log('  ✗', name); }
  };

  // 1. Estado inicial
  {
    const s = makeService({});
    assert('estado inicial é idle', s.getState() === 'idle');
    assert('não conectado inicialmente', !s.isConnected());
  }

  // 2. disconnect sem conectar volta a idle
  {
    const states: LiveSessionState[] = [];
    const s = makeService({ onStateChange: (st: LiveSessionState) => states.push(st) });
    s.disconnect();
    assert('disconnect em idle mantém idle', s.getState() === 'idle');
  }

  // 3. sendAudio sem conexão não lança
  {
    const s = makeService({});
    let threw = false;
    try { await s.sendAudio('aaa'); } catch { threw = true; }
    assert('sendAudio sem conexão não lança', !threw);
  }

  // 4. interrupt sem conexão não lança
  {
    const s = makeService({});
    let threw = false;
    try { s.interrupt(); } catch { threw = true; }
    assert('interrupt sem conexão não lança', !threw);
  }

  // 5. resume em idle não lança (deve tentar conectar — mas sem rede falha graciosamente)
  {
    const s = makeService({ onError: () => {} });
    let threw = false;
    try { s.resume(); } catch { threw = true; }
    assert('resume não lança sincronamente', !threw);
  }

  console.log(`\n${passed} passaram, ${failed} falharam.`);
  if (failed > 0) process.exit(1);
}

run().catch((e) => { console.error(e); process.exit(1); });
