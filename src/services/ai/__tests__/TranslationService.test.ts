import {
  __resetTranslationStateForTests,
  cachedTranslation,
  lookupLocalTranslation,
  rememberTranslation,
  textHash,
  translateGermanToPortuguese,
} from '../TranslationService';
import { assert } from '../../learning/__tests__/assert';

export async function testTranslationService() {
  __resetTranslationStateForTests();

  const local = lookupLocalTranslation('Was brauchst du?');
  assert(local === 'O que você precisa?', `local was brauchst du → ${local}`);

  const long = lookupLocalTranslation('Was hast du gestern nach der Arbeit gemacht?');
  assert(
    !!long && /ontem|trabalho/i.test(long),
    `frase longa local: ${long}`,
  );

  const h1 = textHash('Was   brauchst\ndu?!');
  const h2 = textHash('was brauchst du');
  assert(h1 === h2, 'normalização + hash estáveis');

  rememberTranslation('Hallo Welt', 'Olá mundo');
  assert(cachedTranslation('Hallo Welt') === 'Olá mundo', 'cache hit');
  assert(cachedTranslation('  Hallo   Welt  ') === 'Olá mundo', 'cache após normalização');

  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = (async () => {
    calls += 1;
    return {
      ok: false,
      status: 429,
      headers: { get: (k: string) => (k.toLowerCase() === 'retry-after' ? '1' : null) },
      json: async () => ({ error: 'TRANSLATION_RATE_LIMIT', retryAfterMs: 50 }),
    } as unknown as Response;
  }) as typeof fetch;

  try {
    __resetTranslationStateForTests();
    const r1 = await translateGermanToPortuguese('Ein unikaler Satz ohne cache lokal 429a.');
    assert(r1.status === 'ERROR', '429 → ERROR (não loading eterno)');
    assert(r1.errorCode === 'TRANSLATION_RATE_LIMIT', `errorCode rate limit: ${r1.errorCode}`);
    assert(/indisponível/i.test(r1.error || ''), 'mensagem amigável');
    assert(calls >= 1 && calls <= 2, `retry controlado na 1ª request (calls=${calls})`);

    const afterFirst = calls;
    const r2 = await translateGermanToPortuguese('Ein unikaler Satz sem nova avalanche 429z.');
    assert(r2.status === 'ERROR', 'segunda frase também ERROR sob rate limit');
    assert(calls - afterFirst <= 1, `sem avalanche na 2ª (delta=${calls - afterFirst})`);

    __resetTranslationStateForTests();
    calls = 0;
    const p1 = translateGermanToPortuguese('Ein anderer unikaler Satz 429b.');
    const p2 = translateGermanToPortuguese('Ein anderer unikaler Satz 429b.');
    const [a, b] = await Promise.all([p1, p2]);
    assert(a.status === 'ERROR' && b.status === 'ERROR', 'concorrência dedupe → ERROR');
    assert(calls <= 2, `dedupe inFlight (calls=${calls})`);
  } finally {
    globalThis.fetch = originalFetch;
    __resetTranslationStateForTests();
  }

  const okLocal = await translateGermanToPortuguese('Was brauchst du?');
  assert(okLocal.status === 'READY' && okLocal.text === 'O que você precisa?', 'sucesso local sem API');
}
