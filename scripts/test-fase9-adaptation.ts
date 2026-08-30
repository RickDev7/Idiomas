/* Fase 9 — Personal Learning Adaptation
   Rodar: npx tsx scripts/test-fase9-adaptation.ts */
const _store = new Map<string, string>();
(globalThis as unknown as { localStorage: Storage }).localStorage = {
  getItem: (k: string) => _store.get(k) ?? null,
  setItem: (k: string, v: string) => { _store.set(k, v); },
  removeItem: (k: string) => { _store.delete(k); },
  clear: () => { _store.clear(); },
  key: () => null,
  length: 0,
} as Storage;

import { testPersonalLearningAdaptation } from '../src/services/learning/__tests__/PersonalLearningAdaptation.test';
import { testBottleneckDetector } from '../src/services/learning/__tests__/BottleneckDetector.test';

console.log('FASE 9 — Personal Learning Adaptation\n');
testBottleneckDetector();
console.log('  ✓ BottleneckDetector');
testPersonalLearningAdaptation();
console.log('  ✓ PersonalLearningAdaptation (A≠B, persistência, padrões)');

const BACKEND = process.env.GEMINI_BACKEND_URL || 'http://127.0.0.1:8787';
try {
  const res = await fetch(`${BACKEND}/api/gemini/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      profile: {
        level: 'little',
        goal: 'work',
        sessionKind: 'fase9',
        skipKickoff: true,
        teacherDirective: 'FOCO DO ALUNO: Falar sem ajuda.\nESTRATÉGIA: atividade=speaking',
      },
    }),
    signal: AbortSignal.timeout(20000),
  });
  if (res.ok) {
    const data = await res.json() as { token?: string };
    console.log(`  ✓ Gemini Live REAL: token (${(data.token || '').slice(0, 8)}…)`);
  } else {
    console.log(`  ⚠ Gemini token HTTP ${res.status}`);
  }
} catch (e) {
  console.log(`  ⚠ Gemini: ${String(e)}`);
}

console.log('\n✅ FASE 9 — testes OK');
