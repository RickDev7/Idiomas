/* Transcrição + tradução da conversa.
   Rodar: npx tsx scripts/test-gemini-transcript.ts */
import {
  mergeTranscript,
  GeminiTurnAccumulator,
} from '../src/services/ai/GeminiResponseParser';
import {
  rememberTranslation,
  cachedTranslation,
  lookupLocalTranslation,
  separateTeacherSpeech,
} from '../src/services/ai/TranslationService';

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean) {
  if (cond) { passed++; console.log(`  ✓ ${name}`); }
  else { failed++; console.error(`  ✗ ${name}`); }
}

console.log('— mergeTranscript: deltas');
check('Wie + geht + es dir?', mergeTranscript(mergeTranscript('Wie ', 'geht '), 'es dir?') === 'Wie geht es dir?');
check('não perde prefixo', mergeTranscript('Wie geht ', 'es dir?').includes('Wie geht'));

console.log('— mergeTranscript: snapshots');
check('Wie → Wie geht → frase', mergeTranscript(mergeTranscript('Wie', 'Wie geht'), 'Wie geht es dir?') === 'Wie geht es dir?');
check('não duplica snapshot', mergeTranscript('Wie geht es dir?', 'Wie geht es dir?') === 'Wie geht es dir?');

console.log('— mergeTranscript: último fragmento não substitui');
check('não fica só es dir?', mergeTranscript(mergeTranscript('Wie geht ', 'es dir?'), 'es dir?') === 'Wie geht es dir?');

console.log('— accumulator turn');
const acc = new GeminiTurnAccumulator();
acc.applyChunk('assistant', 'Hallo!');
check('Hallo curto', acc.assistant.text === 'Hallo!');
acc.complete('assistant');
acc.applyChunk('assistant', 'Wie ');
acc.applyChunk('assistant', 'geht ');
acc.applyChunk('assistant', 'es dir?');
check('turno novo após complete', acc.assistant.text === 'Wie geht es dir?');
acc.complete('assistant');
check('status COMPLETE', acc.assistant.status === 'COMPLETE');
check('frase longa', (() => {
  const a = new GeminiTurnAccumulator();
  a.applyChunk('assistant', 'Was hast du gestern nach der Arbeit gemacht?');
  return a.assistant.text === 'Was hast du gestern nach der Arbeit gemacht?';
})());

console.log('— usuário STT');
const u = new GeminiTurnAccumulator();
u.applyChunk('user', 'Ja');
u.applyChunk('user', 'Ja danke');
check('snapshot do aluno sem Ja Ja', u.user.text === 'Ja danke');

const u2 = new GeminiTurnAccumulator();
u2.applyChunk('user', 'Ja ');
u2.applyChunk('user', 'danke');
check('delta do aluno', u2.user.text.replace(/\s+/g, ' ').trim() === 'Ja danke');

console.log('— cache de tradução');
rememberTranslation('Wie geht es dir?', 'Como você está?');
check('cache hit', cachedTranslation('Wie geht es dir?') === 'Como você está?');
check('cache ignora caixa', cachedTranslation('wie geht es dir?') === 'Como você está?');

console.log('— tradução local (Guten Morgen)');
check('Guten Morgen! 👋 → Bom dia!', lookupLocalTranslation('Guten Morgen! 👋') === 'Bom dia!');
check('Wie geht es dir? → Como você está?', lookupLocalTranslation('Wie geht es dir?') === 'Como você está?');
check('cachedTranslation usa local', cachedTranslation('Guten Morgen!') === 'Bom dia!');

console.log('— tradução completa de várias frases');
const multi = lookupLocalTranslation('Hallo! Alles klar? Wie heißt du?');
check('não fica só Olá!', multi !== 'Olá!');
check('frase completa DE→PT', multi === 'Olá! Tudo bem? Como você se chama?');
check('inclui Olá', /olá/i.test(multi || ''));
check('inclui Tudo bem', /tudo bem/i.test(multi || ''));
check('inclui Como você se chama', /chama/i.test(multi || ''));
rememberTranslation('Hallo! Alles klar? Wie heißt du?', 'Olá!');
check('cache incompleto não vence a tradução completa', (cachedTranslation('Hallo! Alles klar? Wie heißt du?') || '').includes('chama'));

console.log('— alemão e português separados');
const mixed = "Kein Problem! Ich habe gefragt: 'Arbeitest du heute?' Das heißt: Você trabalha hoje? Ja oder nein?";
const split = separateTeacherSpeech(mixed);
check('ALEMÃO sem Você', !/você/i.test(split.german));
check('ALEMÃO sem Das heißt', !/das heißt/i.test(split.german));
check('ALEMÃO guarda Arbeitest', /arbeitest du heute/i.test(split.german));
check('ALEMÃO guarda Kein Problem', /kein problem/i.test(split.german));
check('PT extraído', /você trabalha hoje/i.test(split.embeddedPortuguese));
const mixedPt = lookupLocalTranslation(mixed);
check('tradução não falha no misto', !!mixedPt);
check('tradução tem Sem problema', /sem problema/i.test(mixedPt || ''));
check('tradução tem Você trabalha hoje', /você trabalha hoje/i.test(mixedPt || ''));
check('tradução tem Sim ou não', /sim ou não/i.test(mixedPt || ''));

console.log('— frases da aula sem API');
const drill = lookupLocalTranslation('Hallo! Sag mal: "Mir geht es gut." Jetzt du!');
check('Hallo Sag mal Mir geht es gut', /olá/i.test(drill || '') && /estou bem/i.test(drill || '') && /agora você/i.test(drill || ''));
check('Guten Morgen Wie geht es dir', lookupLocalTranslation('Guten Morgen! Wie geht es dir?') === 'Bom dia! Como você está?');

console.log(`\nResultado: ${passed} passaram, ${failed} falharam`);
if (failed > 0) process.exit(1);
