/* Navegação global — intenções vs Live.
   Rodar: npx tsx src/services/ui/__tests__/AppRoutes.test.ts */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  APP_ROUTES,
  BOTTOM_NAV_ITEMS,
  goAprender,
  sessionChromeTitle,
} from '@/services/ui/AppRoutes';

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

const __dir = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dir, '../../../..');
function readSrc(rel: string): string {
  return readFileSync(resolve(root, rel), 'utf8');
}

console.log('— rotas canônicas');
check('aprender', APP_ROUTES.aprender === '/aprender');
check('conversar', APP_ROUTES.conversar === '/conversar');
check('home', APP_ROUTES.home === '/');
check('revisar', APP_ROUTES.revisar === '/revisar');
check('progresso', APP_ROUTES.progresso === '/progresso');
check('chunks', APP_ROUTES.chunks === '/chunks');
check('sessao', APP_ROUTES.sessao === '/sessao');

console.log('— chrome da sessão Live (não rotular tudo Conversar)');
check('lesson → Treino', sessionChromeTitle('lesson') === 'Treino');
check('first → Treino', sessionChromeTitle('first') === 'Treino');
check('free → Conversar', sessionChromeTitle('free') === 'Conversar');
check('review → Revisar', sessionChromeTitle('review') === 'Revisar');
check('assessment → Avaliação', sessionChromeTitle('assessment') === 'Avaliação');
check('default → Treino', sessionChromeTitle(undefined) === 'Treino');

console.log('— BottomNav');
check('4 itens', BOTTOM_NAV_ITEMS.length === 4);
check('Início /', BOTTOM_NAV_ITEMS[0].to === '/');
check('Meu Curso /jornada', BOTTOM_NAV_ITEMS[1].to === '/jornada' && BOTTOM_NAV_ITEMS[1].key === 'course');
check('Conversar /conversar', BOTTOM_NAV_ITEMS[2].to === '/conversar');
check('Revisar /revisar', BOTTOM_NAV_ITEMS[3].to === '/revisar');
const bottomSrc = readSrc('src/components/layout/BottomNav.tsx');
check('BottomNav usa BOTTOM_NAV_ITEMS', bottomSrc.includes('BOTTOM_NAV_ITEMS'));

console.log('— Ir para Aprender → /aprender (não /conversar)');
let dest = '';
goAprender((to) => { dest = String(to); });
check('goAprender → /aprender', dest === '/aprender');

const chunksSrc = readSrc('src/pages/MyGermanPage.tsx');
check('Chunks usa goAprender', chunksSrc.includes('goAprender'));
check('Chunks empty NÃO navega /conversar', !chunksSrc.includes("navigate('/conversar')"));
check('Chunks empty NÃO navigate conversar', !/navigate\(`?\/conversar/.test(chunksSrc));

const reviewSrc = readSrc('src/pages/ReviewPage.tsx');
check('Review empty → Meu Curso (goJornada)', reviewSrc.includes('goJornada') && reviewSrc.includes('Ir para Meu Curso'));

const simSrc = readSrc('src/pages/SimulatorPage.tsx');
check('Simulador Ir para Aprender = goAprender', simSrc.includes('goAprender'));

console.log('— Gemini chrome');
const geminiSrc = readSrc('src/pages/GeminiConversation.tsx');
check('Gemini usa sessionChromeTitle', geminiSrc.includes('sessionChromeTitle'));
check('Gemini NÃO hardcode Conversar no title default', !geminiSrc.includes('>Conversar</span>'));
check('ConversationPage passa sessionType', readSrc('src/pages/ConversationPage.tsx').includes('sessionType={type}'));

console.log('— App routes existem');
const appSrc = readSrc('src/App.tsx');
check('rota /aprender', appSrc.includes('path="/aprender"'));
check('rota /conversar', appSrc.includes('path="/conversar"'));
check('rota /chunks', appSrc.includes('path="/chunks"'));
check('rota /curso/:level/:moduleId', appSrc.includes('path="/curso/:level/:moduleId"'));
check('wildcard → home não conversar', appSrc.includes('path="*"') && appSrc.includes('Navigate to="/"'));

console.log(`\n${passed} passaram, ${failed} falharam`);
if (failed > 0) process.exit(1);
