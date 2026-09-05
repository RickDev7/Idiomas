/**
 * Correções UX P0/P1 — navegação e CTAs.
 * Rodar: npx tsx src/services/ui/__tests__/UxNavigationFixes.test.ts
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  APP_ROUTES,
  BOTTOM_NAV_ITEMS,
  goJornada,
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

console.log('— P0 Progress → /jornada');
const progressSrc = readSrc('src/pages/ProgressPage.tsx');
check('Progress navega /jornada', progressSrc.includes("navigate('/jornada')"));
check('Progress NÃO navega /lernweg', !progressSrc.includes("/lernweg"));
check('Progress CTA Meu Curso ou Jornada', /Meu Curso|Jornada/.test(progressSrc));

console.log('— BottomNav Meu Curso');
check('BOTTOM_NAV tem 4 itens', BOTTOM_NAV_ITEMS.length === 4);
check('item Meu Curso → /jornada', BOTTOM_NAV_ITEMS.some((i) => i.to === APP_ROUTES.jornada && i.key === 'course'));
check('rota oficial jornada', APP_ROUTES.jornada === '/jornada');
const bottomSrc = readSrc('src/components/layout/BottomNav.tsx');
check('BottomNav usa key course', bottomSrc.includes('course:'));
check('Locale nav.course', readSrc('src/services/ui/LocaleService.ts').includes("'nav.course': 'Meu Curso'"));

console.log('— Home CTA única Continuar curso');
const homeSrc = readSrc('src/pages/HomePage.tsx');
check('Home usa ContinueCourseCard', homeSrc.includes('ContinueCourseCard'));
check('Home NÃO tem Continuar treino como CTA', !/Continuar treino/.test(homeSrc));
check('Home NÃO usa HomeTrainingHero', !homeSrc.includes('HomeTrainingHero'));
check('Home atalho Explorar Meu Curso → /jornada', homeSrc.includes("navigate('/jornada')") && homeSrc.includes('Explorar Meu Curso'));
check('home.continue = Continuar curso', readSrc('src/services/ui/LocaleService.ts').includes("'home.continue': 'Continuar curso'"));

console.log('— ModuleDetail CTA única');
const modSrc = readSrc('src/pages/ModuleDetailPage.tsx');
const primaryBtnCount = (modSrc.match(/<PrimaryButton/g) || []).length;
check('ModuleDetail tem PrimaryButton', primaryBtnCount >= 1);
check('ModuleDetail CTA após Próxima atividade (ordem)', (() => {
  const nextIdx = modSrc.indexOf('Próxima atividade');
  const ctaIdx = modSrc.indexOf('onClick={onContinue}');
  return nextIdx > 0 && ctaIdx > nextIdx;
})());
check('ModuleDetail CTA cedo no mobile (order-2)', modSrc.includes('order-2') && modSrc.includes('module-primary-cta'));
check('ModuleDetail sem sticky duplicate CTA', !/sticky|fixed bottom/.test(modSrc));
check('ModuleDetail pb com safe-area BottomNav', modSrc.includes('safe-area-inset-bottom'));

console.log('— Jornada CTA única Continuar curso');
const courseSrc = readSrc('src/pages/CoursePage.tsx');
check('Jornada usa Continuar curso / ContinueCourse', courseSrc.includes('getContinueCourseState') && courseSrc.includes('Continuar curso'));
check('Jornada NÃO tem Continuar treino', !courseSrc.includes('Continuar treino'));
check('Jornada NÃO tem Primary Continuar genérico', !/>\s*Continuar\s*</.test(courseSrc));

console.log('— Sessão: confirmação ao abandonar');
const geminiSrc = readSrc('src/pages/GeminiConversation.tsx');
check('Gemini tem requestAbandon', geminiSrc.includes('requestAbandon'));
check('Gemini dialog Abandonar este treino', geminiSrc.includes('Abandonar este treino?'));
check('Gemini Continuar treino no dialog', geminiSrc.includes('Continuar treino'));
check('Gemini Sair no dialog', geminiSrc.includes('Sair'));
check('Voltar usa requestAbandon', geminiSrc.includes('onClick={requestAbandon}'));
check('popstate guard não-agressivo', geminiSrc.includes('sessionHasProgress') && geminiSrc.includes('popstate'));

console.log('— Conclusão → ContinueCourse (não /aprender)');
const completeSrc = readSrc('src/pages/SessionCompletePage.tsx');
check('SessionComplete usa getContinueCourseState', completeSrc.includes('getContinueCourseState'));
check('SessionComplete usa beginContinueCourseSession', completeSrc.includes('beginContinueCourseSession'));
check('SessionComplete NÃO goAprender', !completeSrc.includes('goAprender'));
check('SessionComplete NÃO navigate /aprender', !completeSrc.includes("'/aprender'"));
check('SessionComplete C2 → jornada', completeSrc.includes('APP_ROUTES.jornada') || completeSrc.includes('/jornada'));

console.log('— Review empty → Meu Curso');
const reviewSrc = readSrc('src/pages/ReviewPage.tsx');
check('Review usa goJornada', reviewSrc.includes('goJornada'));
check('Review Ir para Meu Curso', reviewSrc.includes('Ir para Meu Curso'));

console.log('— Vocabulário / chrome');
check('lesson chrome = Treino', sessionChromeTitle('lesson') === 'Treino');
check('free chrome = Conversar', sessionChromeTitle('free') === 'Conversar');
check('goJornada → /jornada', (() => {
  let dest = '';
  goJornada((to) => {
    dest = String(to);
  });
  return dest === '/jornada';
})());

console.log('— Profile / Course');
check('Profile Meu Curso → /jornada', readSrc('src/pages/ProfilePage.tsx').includes("to: '/jornada'"));
check('lernweg ainda existe no App (compat)', readSrc('src/App.tsx').includes('path="/lernweg"'));
check('aprender ainda existe no App (compat)', readSrc('src/App.tsx').includes('path="/aprender"'));

console.log(`\n${passed} passaram, ${failed} falharam`);
if (failed > 0) process.exit(1);
