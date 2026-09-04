/**
 * Kickoff unit tests — npx tsx src/services/voice/__tests__/LiveSessionKickoff.test.ts
 */
import {
  buildSessionKickoffFromProfile,
  continuityLineConflictsWithOpening,
} from '../LiveSessionKickoff';

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean) {
  if (cond) {
    passed += 1;
    console.log(`  ✓ ${name}`);
  } else {
    failed += 1;
    console.error(`  ✗ ${name}`);
  }
}

console.log('— continuity filter');
check(
  'próximo passo Guten conflita com Ich arbeite',
  continuityLineConflictsWithOpening('Próximo passo: L0: primeira microaula — Guten Morgen.', 'Ich arbeite.'),
);
check(
  'última pergunta Guten conflita',
  continuityLineConflictsWithOpening('Última pergunta: Guten Morgen.', 'Ich wohne in...'),
);
check(
  'saudação como opening NÃO filtra a si mesma',
  !continuityLineConflictsWithOpening('Última pergunta: Guten Morgen.', 'Guten Morgen.'),
);

console.log('— kickoff selected target');
{
  const kick = buildSessionKickoffFromProfile({
    openingGerman: 'Ich arbeite.',
    zeroLanguageMode: true,
    level: 'zero',
    lastQuestion: 'Guten Morgen.',
    nextStep: 'L0: primeira microaula — Guten Morgen.',
    unfinishedGoal: 'Guten Abend.',
    targetPhrasePt: 'Eu trabalho.',
    orchestratorKickoff: 'ZERO LANGUAGE MODE — microaula\n3. Em alemão, claro: "Ich arbeite."',
  });
  check('Frase-alvo Ich arbeite', kick.includes('Frase-alvo: "Ich arbeite."'));
  check('sem Próximo passo Guten', !/Próximo passo:.*Guten/i.test(kick));
  check('sem Última pergunta Guten', !/Última pergunta:.*Guten/i.test(kick));
  check('orch kickoff presente', kick.includes('Ich arbeite.'));
  check('sem Guten Abend no kickoff', !/Guten Abend/i.test(kick));
}

console.log(`\n${passed} passaram, ${failed} falharam`);
if (failed > 0) process.exit(1);
