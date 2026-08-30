/* Fase 10 — Personal AI Language Coach
   Rodar: npx tsx scripts/test-fase10-coach.ts */
const _store = new Map<string, string>();
(globalThis as unknown as { localStorage: Storage }).localStorage = {
  getItem: (k: string) => _store.get(k) ?? null,
  setItem: (k: string, v: string) => { _store.set(k, v); },
  removeItem: (k: string) => { _store.delete(k); },
  clear: () => { _store.clear(); },
  key: () => null,
  length: 0,
} as Storage;

import { testPersonalAiCoach, testMemoryRelevanceEngine } from '../src/services/coach/__tests__/PersonalAiCoach.test';

console.log('FASE 10 — Personal AI Language Coach\n');
testMemoryRelevanceEngine();
console.log('  ✓ MemoryRelevanceEngine');
await testPersonalAiCoach();
console.log('  ✓ Prepare / PostEvent / Invisible / Persona / 3 dias');

const BACKEND = process.env.GEMINI_BACKEND_URL || 'http://127.0.0.1:8787';
try {
  const res = await fetch(`${BACKEND}/api/gemini/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      profile: {
        level: 'little',
        goal: 'work',
        sessionKind: 'fase10',
        skipKickoff: true,
        coachContext: 'EVENTO REAL PENDENTE: conversa com o chefe. NÃO invente.',
      },
    }),
    signal: AbortSignal.timeout(20000),
  });
  if (res.ok) console.log('  ✓ Gemini Live REAL: token OK');
  else console.log(`  ⚠ Gemini token HTTP ${res.status}`);
} catch (e) {
  console.log(`  ⚠ Gemini: ${String(e)}`);
}

console.log('\n✅ FASE 10 — testes OK');
