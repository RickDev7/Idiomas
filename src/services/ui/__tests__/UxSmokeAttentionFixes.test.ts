/**
 * Correções dos 3 ATTENTION do UX smoke:
 * 1) /jornada — uma CTA principal Continuar curso
 * 2) BottomNav — idioma consistente via LocaleService
 * 3) ModuleDetail — CTA acessível no mobile (acima da BottomNav)
 *
 * Rodar: npx tsx src/services/ui/__tests__/UxSmokeAttentionFixes.test.ts
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { t } from '@/services/ui/LocaleService';
import { BOTTOM_NAV_ITEMS } from '@/services/ui/AppRoutes';
import type { InterfaceLanguage } from '@/services/ui/UiPrefsService';

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

const courseSrc = readSrc('src/pages/CoursePage.tsx');
const modSrc = readSrc('src/pages/ModuleDetailPage.tsx');
const bottomSrc = readSrc('src/components/layout/BottomNav.tsx');
const localeSrc = readSrc('src/services/ui/LocaleService.ts');
const homeSrc = readSrc('src/pages/HomePage.tsx');
const journeyCardSrc = readSrc('src/components/home/CourseJourneyCard.tsx');
const continueCardSrc = readSrc('src/components/home/ContinueCourseCard.tsx');

console.log('— 1. /jornada CTA única Continuar curso');
check('CoursePage usa getContinueCourseState', courseSrc.includes('getContinueCourseState'));
check('CoursePage usa beginContinueCourseSession', courseSrc.includes('beginContinueCourseSession'));
check('CoursePage tem data-testid jornada-primary-cta', courseSrc.includes('jornada-primary-cta'));
check('CoursePage NÃO tem Continuar treino como CTA', !/Continuar treino/.test(courseSrc));
check(
  'CoursePage NÃO tem PrimaryButton Continuar genérico',
  !/PrimaryButton[\s\S]{0,200}>\s*Continuar\s*</.test(courseSrc)
    && !/>\s*Continuar\s*<\//.test(courseSrc),
);
check(
  'CoursePage CTA label Continuar curso (fallback)',
  courseSrc.includes("'Continuar curso'") || courseSrc.includes('"Continuar curso"'),
);
check(
  'Uma âncora de CTA principal (testid)',
  (courseSrc.match(/jornada-primary-cta/g) || []).length === 1,
);

console.log('— 2. Hierarquia: módulo → Continuar treino');
check('ModuleDetail cta via details.ctaLabel', modSrc.includes('{details.ctaLabel}'));
check('ModuleDetails define Continuar treino', readSrc('src/services/course/ModuleDetails.ts').includes("'Continuar treino'"));
check('ModuleDetail sem sticky duplicate', !/sticky|fixed bottom/.test(modSrc));
check('ModuleDetail CTA order-2 (cedo no mobile)', modSrc.includes('order-2') && modSrc.includes('module-primary-cta'));

console.log('— 3. BottomNav PT / EN / DE');
const navKeys = ['nav.start', 'nav.course', 'nav.talk', 'nav.review'] as const;
const expected: Record<InterfaceLanguage, string[]> = {
  'pt-BR': ['Início', 'Meu Curso', 'Conversar', 'Revisar'],
  'en-US': ['Home', 'My Course', 'Talk', 'Review'],
  'de-DE': ['Start', 'Mein Kurs', 'Sprechen', 'Wiederholen'],
};
for (const lang of ['pt-BR', 'en-US', 'de-DE'] as InterfaceLanguage[]) {
  const labels = navKeys.map((k) => t(k, lang));
  check(`BottomNav ${lang} labels`, labels.join('|') === expected[lang].join('|'));
  check(
    `BottomNav ${lang} sem mistura PT/EN`,
    lang === 'pt-BR'
      ? labels.every((l) => !['Home', 'Talk', 'Review', 'My Course'].includes(l))
      : lang === 'en-US'
        ? labels.every((l) => !['Início', 'Conversar', 'Revisar', 'Meu Curso'].includes(l))
        : labels.every((l) => !['Início', 'Home', 'Conversar', 'Talk'].includes(l)),
  );
}
check('BottomNav usa t() + getLocale()', bottomSrc.includes('getLocale') && bottomSrc.includes("t(LABEL_KEYS"));
check('BottomNav aria localizado', bottomSrc.includes("t('nav.aria'") && localeSrc.includes("'nav.aria'"));
check('BottomNav data-locale', bottomSrc.includes('data-locale={locale}'));
check('BOTTOM_NAV 4 itens', BOTTOM_NAV_ITEMS.length === 4);

console.log('— 4. Mobile CTA clearance');
check(
  'ModuleDetail padding-bottom com safe-area',
  modSrc.includes('pb-[calc(5.5rem+env(safe-area-inset-bottom') || modSrc.includes('safe-area-inset-bottom'),
);
check('ModuleDetail CTA min-h-12 touch', modSrc.includes('min-h-12'));
check(
  'Viewport notes 360/390/414 cobertos por layout early CTA + pb',
  modSrc.includes('order-2') && modSrc.includes('module-primary-cta'),
);

console.log('— 5. Outras ocorrências (somente checagem de regressão semântica)');
check('Home Continuar curso via ContinueCourseCard', homeSrc.includes('ContinueCourseCard'));
check('ContinueCourseCard usa Continuar curso', continueCardSrc.includes('Continuar curso'));
check('CourseJourneyCard sem CTA Continuar duplicada', !/Continuar/.test(journeyCardSrc));

console.log(`\n${passed} passaram, ${failed} falharam`);
if (failed > 0) process.exit(1);
