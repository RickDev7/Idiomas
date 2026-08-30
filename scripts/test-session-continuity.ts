/* Teste: 5 sessões consecutivas não repetem a mesma abertura mecânica.
   Rodar: npx tsx scripts/test-session-continuity.ts */
const _store = new Map<string, string>();
(globalThis as unknown as { localStorage: Storage }).localStorage = {
  getItem: (k: string) => _store.get(k) ?? null,
  setItem: (k: string, v: string) => { _store.set(k, v); },
  removeItem: (k: string) => { _store.delete(k); },
  clear: () => { _store.clear(); },
  key: () => null,
  length: 0,
} as Storage;

import type { UserProfile } from '../src/types';
import {
  getSessionOpening,
  prepareSession,
  endSession,
  completeSession,
  pauseSession,
  loadContinuityState,
  emptyContinuityState,
  saveContinuityState,
  getIncompleteSession,
  getLastSession,
  autosaveTurn,
  generateLocalSummary,
  buildSessionContext,
} from '../src/services/teacher/sessionContinuity';

const profile: UserProfile = {
  id: 'u',
  name: 'Rick',
  level: 'zero',
  dailyMinutes: 20,
  goal: 'daily',
  profession: '',
  frequentSituations: [],
  interests: [],
  onboardingComplete: true,
  firstLessonComplete: true,
  currentDay: 2,
  streak: 2,
  lastStudyDate: null,
  immersionPhase: 1,
  turboMode: false,
  speechSpeed: 'normal',
  germanPercentage: 40,
  createdAt: new Date().toISOString(),
};

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean) {
  if (cond) { passed++; console.log(`  ✓ ${name}`); }
  else { failed++; console.error(`  ✗ ${name}`); }
}

saveContinuityState(emptyContinuityState());

console.log('— 5 sessões consecutivas');
const openings: string[] = [];
const kinds: string[] = [];

for (let i = 0; i < 5; i++) {
  const prepared = prepareSession(profile, null);
  openings.push(prepared.opening.german);
  kinds.push(prepared.opening.kind);
  endSession({
    topic: i === 0 ? 'daily' : i < 3 ? 'daily' : 'work',
    phrasesLearned: i === 0 ? ['Ich heiße Rick.'] : i === 1 ? ['Ich wohne in Cuxhaven.'] : ['Ich arbeite heute.'],
    lastQuestion: prepared.opening.german,
    lastTeacherMessage: prepared.opening.german,
    lastUserResponse: i === 0 ? 'Ich heiße Rick.' : 'Ich arbeite heute.',
    openingGerman: prepared.opening.german,
    sessionKind: prepared.opening.kind,
    mistakes: [],
  });
}

console.log(openings.map((o, i) => `  S${i + 1} [${kinds[i]}]: ${o}`).join('\n'));

check('sessão 1 é FIRST_SESSION', kinds[0] === 'FIRST_SESSION');
check('sessão 1 apresenta Wie heißt du / Coach', /heißt du|Deutsch Coach/i.test(openings[0]));
check('sessão 2 não copia a sessão 1', openings[1] !== openings[0]);
check('sessão 3 não copia a sessão 2', openings[2] !== openings[1]);
check('sessão 3 não copia a sessão 1', openings[2] !== openings[0]);
check('sessão 4 não copia a sessão 3', openings[3] !== openings[2]);
check('nenhuma sessão 2–5 é só Hallo + Wie geht es dir', openings.slice(1).every((o) => {
  const t = o.toLowerCase().replace(/[!?]/g, '').trim();
  return t !== 'hallo' && t !== 'wie geht es dir' && t !== 'hallo wie geht es dir';
}));
check('sessão 2 usa memória (Erinnerst / wieder / wohnst)', /erinnerst|wieder|wohnst/i.test(openings[1]));
check('sessão 3 recupera (gestern / wohnst)', /gestern|wohnst/i.test(openings[2]));

console.log('— Loop Guten Morgen / Wie geht\'s (causa raiz)');
saveContinuityState(emptyContinuityState());
// Simula sessão em que o Gemini saudou e o unfinished gravou a saudação (bug antigo)
saveContinuityState({
  ...emptyContinuityState(),
  sessionCount: 1,
  lastSession: {
    date: new Date().toISOString(),
    durationMinutes: 3,
    topic: 'daily',
    phrasesLearned: ['Ich heiße Rick.', 'Ich wohne in Cuxhaven.'],
    phrasesReviewed: [],
    mistakes: [],
    unfinishedContent: ["Guten Morgen! Wie geht's?"],
    lastQuestion: "Guten Morgen! Wie geht's?",
    lastTeacherMessage: "Guten Morgen! Wie geht's?",
    lastUserResponse: 'Ich wohne in Cuxhaven.',
    nextSuggestedStep: "continuar: Guten Morgen! Wie geht's?",
    lastOpening: 'Hallo! Ich bin dein Deutsch Coach. Wie heißt du?',
    sessionKind: 'RETURNING_SESSION',
    unfinishedGoal: "Guten Morgen! Wie geht's?",
  },
  recentOpenings: [{ german: 'Hallo! Ich bin dein Deutsch Coach. Wie heißt du?', at: new Date().toISOString(), usageCount: 1 }],
});
const afterGreetingPoison = prepareSession(profile, null);
check('não reabre com Guten Morgen/Wie geht', !/guten morgen|wie geht/i.test(afterGreetingPoison.opening.german));
check('usa memória do aluno (wohnst / heiße / erinnerst / wieder)', /wohnst|heiß|erinnerst|wieder|gestern|machst/i.test(afterGreetingPoison.opening.german));
check('kind não é FIRST_SESSION', afterGreetingPoison.opening.kind !== 'FIRST_SESSION');

console.log('— Revisão pedagógica de frase fraca');
saveContinuityState(emptyContinuityState());
prepareSession(profile, null);
endSession({
  topic: 'survival',
  phrasesLearned: ['Ich brauche Hilfe.'],
  lastQuestion: 'Was brauchst du?',
  openingGerman: 'Hallo! Ich bin dein Deutsch Coach. Wie heißt du?',
  sessionKind: 'FIRST_SESSION',
});
// sessão 2 (welcome). sessão 3 pode usar weak
prepareSession(profile, null);
endSession({
  topic: 'survival',
  phrasesLearned: ['Ich brauche Hilfe.'],
  lastQuestion: 'Was brauchst du?',
  openingGerman: 'x',
  sessionKind: 'RETURNING_SESSION',
});
const weakOpen = getSessionOpening({
  sessionCount: 2,
  lastSession: loadContinuityState().lastSession,
  recentOpenings: loadContinuityState().recentOpenings.map((o) => o.german),
  hoursSinceLast: 20,
  weakPhrases: ['Ich brauche Hilfe.'],
  knownPhrases: ['Ich brauche Hilfe.'],
  goal: 'daily',
  profession: '',
});
check('frase fraca reaparece de forma natural', /Hilfe|erinnerst/i.test(weakOpen.german));
check('repetição marcada como pedagógica', weakOpen.pedagogicalRepeat === true);

console.log('— Erro Ich arbeiten → próxima abertura pede Ich arbeite');
const errOpen = getSessionOpening({
  sessionCount: 3,
  lastSession: {
    date: new Date().toISOString(),
    durationMinutes: 10,
    topic: 'work',
    phrasesLearned: ['Ich arbeite heute.'],
    phrasesReviewed: [],
    mistakes: ['Ich arbeiten'],
    unfinishedContent: [],
    lastQuestion: 'Was machst du?',
    lastTeacherMessage: 'Was machst du?',
    lastUserResponse: 'Ich arbeiten',
    nextSuggestedStep: 'conjugação',
    lastOpening: 'Was machst du heute?',
    sessionKind: 'RETURNING_SESSION',
  },
  recentOpenings: ['Was weißt du noch von gestern?'],
  hoursSinceLast: 12,
  weakPhrases: [],
  knownPhrases: ['Ich arbeite heute.'],
  goal: 'work',
  profession: 'Mechaniker',
});
check('erro de trabalhar gera Was machst du heute', /Was machst du heute/i.test(errOpen.german));

console.log('— Pausa de 7 dias');
const longOpen = getSessionOpening({
  sessionCount: 4,
  lastSession: {
    date: new Date(Date.now() - 8 * 24 * 3600_000).toISOString(),
    durationMinutes: 10,
    topic: 'daily',
    phrasesLearned: ['Ich brauche Hilfe.'],
    phrasesReviewed: [],
    mistakes: [],
    unfinishedContent: [],
    lastQuestion: 'Was machst du heute?',
    lastTeacherMessage: 'Was machst du heute?',
    lastUserResponse: 'Ich arbeite.',
    nextSuggestedStep: 'recuperar',
    lastOpening: 'Was machst du heute?',
    sessionKind: 'RETURNING_SESSION',
  },
  recentOpenings: ['Was machst du heute?', 'Lass uns anfangen.'],
  hoursSinceLast: 8 * 24,
  weakPhrases: [],
  knownPhrases: ['Ich brauche Hilfe.'],
  goal: 'daily',
  profession: '',
});
check('pausa longa não volta ao Hallo roteiro', !/^Hallo[.!]?$/i.test(longOpen.german) && !/wie geht es dir/i.test(longOpen.german));
check('pausa longa usa recall', longOpen.strategy === 'recall_old');

console.log('— Transferência Ich arbeite heute → contexto de trabalho');
const transferOpen = getSessionOpening({
  sessionCount: 4,
  lastSession: {
    date: new Date().toISOString(),
    durationMinutes: 12,
    topic: 'work',
    phrasesLearned: ['Ich arbeite heute.'],
    phrasesReviewed: [],
    mistakes: [],
    unfinishedContent: [],
    lastQuestion: 'Was machst du heute?',
    lastTeacherMessage: 'Was machst du heute?',
    lastUserResponse: 'Ich arbeite heute.',
    nextSuggestedStep: 'Ich arbeite morgen',
    lastOpening: 'Was machst du heute?',
    sessionKind: 'CONTINUATION_SESSION',
  },
  recentOpenings: ['Was machst du heute?', 'Was weißt du noch von gestern?'],
  hoursSinceLast: 2,
  weakPhrases: [],
  knownPhrases: ['Ich arbeite heute.'],
  goal: 'work',
  profession: 'Mechaniker',
});
check('não reabre com Hallo roteiro', !/wie geht es dir/i.test(transferOpen.german) && !/^Hallo[.!]?$/i.test(transferOpen.german));
check('continua no contexto de trabalho/rotina', /arbeit|heute|morgen|Tag|gemacht|weitermachen|bereit/i.test(transferOpen.german));

console.log('— Encerrar sem resumo não repete a intro');
saveContinuityState(emptyContinuityState());
const first = prepareSession(profile, null);
check('primeira é intro', first.opening.kind === 'FIRST_SESSION');
const again = prepareSession(profile, null);
check('segunda abertura sem endSession não é FIRST_SESSION', again.opening.kind !== 'FIRST_SESSION');
check('segunda abertura é diferente', again.opening.german !== first.opening.german);

console.log('— Persistência: encerrar não apaga memória');
saveContinuityState(emptyContinuityState());
prepareSession(profile, null);
const saved = completeSession({
  topic: 'presentation',
  phrasesLearned: ['Ich wohne in Cuxhaven.'],
  lastQuestion: 'Wo wohnst du?',
  lastTeacherMessage: 'Wo wohnst du?',
  lastUserResponse: '',
  unfinishedContent: ['Wo wohnst du?'],
  openingGerman: 'Wo wohnst du?',
  sessionKind: 'RETURNING_SESSION',
});
check('resumo tem frase aprendida', saved.phrasesLearned.includes('Ich wohne in Cuxhaven.'));
check('resumo tem última pergunta', saved.lastQuestion.includes('wohnst'));
const restored = getLastSession();
check('getLastSession recupera', restored?.phrasesLearned[0] === 'Ich wohne in Cuxhaven.');
const next = prepareSession(profile, null);
check('sessão seguinte não é FIRST_SESSION', next.opening.kind !== 'FIRST_SESSION');
check('abertura retoma morar / Erinnerst', /wohnst|erinnerst|Cuxhaven/i.test(next.opening.german));
check('contexto compacto tem unfinished', next.sessionContext.unfinishedGoal.includes('wohnst') || next.sessionContext.lastTeacherQuestion.includes('wohnst'));
check('contexto não está vazio', next.sessionContext.recentPhrases.length > 0);

console.log('— Sessão incompleta (fechar app)');
saveContinuityState(emptyContinuityState());
prepareSession(profile, null);
endSession({
  topic: 'presentation',
  phrasesLearned: ['Ich heiße Rick.'],
  lastQuestion: 'Wie heißt du?',
  lastTeacherMessage: 'Wie heißt du?',
  lastUserResponse: 'Ich heiße Rick.',
  unfinishedContent: [],
  sessionKind: 'FIRST_SESSION',
});
prepareSession(profile, null);
autosaveTurn('assistant', 'Wo wohnst du?');
autosaveTurn('user', 'uh');
pauseSession({ lastTeacherMessage: 'Wo wohnst du?', lastUserResponse: 'uh', unfinishedContent: ['Wo wohnst du?'], topic: 'presentation' });
const inc = getIncompleteSession();
check('sessão incompleta detectada', !!inc && inc.status !== 'COMPLETED');
check('autosave guardou pergunta', (inc?.lastTeacherMessage || '').includes('wohnst') || (inc?.unfinishedContent[0] || '').includes('wohnst'));
const cont = prepareSession(profile, null);
check('retomada não é intro Hallo roteiro', !/wie geht es dir/i.test(cont.opening.german));
check('retomada usa continuidade', /wohnst|erinnerst|weitermachen|heiße/i.test(cont.opening.german));

console.log('— Resumo local sem IA');
const local = generateLocalSummary({
  topic: 'work',
  phrasesLearned: ['Ich arbeite heute.'],
  mistakes: ['Ich arbeiten'],
  lastTeacherMessage: 'Was machst du?',
  lastUserResponse: 'Ich arbeiten',
  unfinishedContent: ['Was machst du?'],
}, null);
check('resumo local tem next step', local.nextSuggestedStep.length > 0);
check('resumo local tem erro', local.mistakes.includes('Ich arbeiten'));

console.log('— buildSessionContext compacto');
const ctx = buildSessionContext(
  profile,
  next.opening,
  saved,
  null,
  ['Ich wohne in Cuxhaven.'],
  [],
);
check('não manda histórico bruto', !('messages' in ctx));
check('tem lastTeacherQuestion', typeof ctx.lastTeacherQuestion === 'string');

console.log(`\nResultado: ${passed} passaram, ${failed} falharam`);
if (failed > 0) process.exit(1);

