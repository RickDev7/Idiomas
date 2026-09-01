import {
  beginLiveSession,
  getLiveSessionGeneration,
  invalidateLiveSession,
  isLiveSessionCurrent,
} from '@/services/voice/LiveSessionRegistry';

async function run() {
  let passed = 0;
  let failed = 0;
  const assert = (name: string, cond: boolean) => {
    if (cond) { passed++; console.log('  ✓', name); }
    else { failed++; console.log('  ✗', name); }
  };

  // TESTE 1 — beginLiveSession incrementa generation
  {
    const before = getLiveSessionGeneration();
    const gen = beginLiveSession();
    assert('beginLiveSession incrementa', gen === before + 1);
    assert('generation atual é a nova', getLiveSessionGeneration() === gen);
    assert('sessão recém-criada é current', isLiveSessionCurrent(gen));
  }

  // TESTE 2 — invalidate invalida generation anterior
  {
    const old = getLiveSessionGeneration();
    const next = invalidateLiveSession();
    assert('invalidate incrementa', next === old + 1);
    assert('generation antiga não é current', !isLiveSessionCurrent(old));
    assert('generation nova é current', isLiveSessionCurrent(next));
  }

  // TESTE 3 — simula StrictMode: async órfão abortado por invalidate
  {
    const gen = beginLiveSession();
    assert('async inicia com gen válido', isLiveSessionCurrent(gen));
    invalidateLiveSession();
    assert('async órfão detectado após invalidate', !isLiveSessionCurrent(gen));
  }

  // TESTE 4 — começar → parar → começar gera generations distintas
  {
    const g1 = beginLiveSession();
    const g2 = invalidateLiveSession();
    const g3 = beginLiveSession();
    assert('stop invalida g1', !isLiveSessionCurrent(g1));
    assert('novo start após stop é g3', isLiveSessionCurrent(g3));
    assert('generations são únicas', g1 !== g2 && g2 !== g3);
  }

  console.log(`\n${passed} passaram, ${failed} falharam.`);
  if (failed > 0) process.exit(1);
}

run().catch((e) => { console.error(e); process.exit(1); });
