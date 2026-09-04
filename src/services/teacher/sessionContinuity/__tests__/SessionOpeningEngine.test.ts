/* SessionOpeningEngine — precedência first_intro vs currículo A1–C1.
   Rodar: npx tsx src/services/teacher/sessionContinuity/__tests__/SessionOpeningEngine.test.ts */
const _store = new Map<string, string>();
(globalThis as unknown as { localStorage: Storage; sessionStorage: Storage }).localStorage = {
  getItem: (k) => _store.get(k) ?? null,
  setItem: (k, v) => { _store.set(k, String(v)); },
  removeItem: (k) => { _store.delete(k); },
  clear: () => { _store.clear(); },
  key: () => null,
  length: 0,
} as Storage;
(globalThis as unknown as { sessionStorage: Storage }).sessionStorage =
  (globalThis as unknown as { localStorage: Storage }).localStorage;

import {
  getSessionOpening,
  isActiveCurriculumTargetId,
} from '@/services/teacher/sessionContinuity/SessionOpeningEngine';
import { prepareSession } from '@/services/teacher/sessionContinuity/SessionContinuityEngine';
import type { OpeningContext } from '@/services/teacher/sessionContinuity/types';
import { emptyLearningProfile } from '@/services/learning/RealProgress';
import type { UserProfile } from '@/types';

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, detail?: string) {
  if (cond) {
    passed += 1;
    console.log(`  ✓ ${name}`);
  } else {
    failed += 1;
    console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

function baseCtx(over: Partial<OpeningContext> = {}): OpeningContext {
  return {
    sessionCount: 0,
    lastSession: null,
    recentOpenings: [],
    hoursSinceLast: null,
    weakPhrases: [],
    knownPhrases: [],
    goal: 'work',
    profession: 'engenheiro',
    name: 'Luis',
    incomplete: null,
    zeroLanguageMode: false,
    ...over,
  };
}

function profileAt(diagnosticLevel: string): UserProfile {
  return {
    id: 'test',
    name: 'Luis',
    level: 'basic',
    diagnosticLevel,
    goal: 'work',
    profession: 'engenheiro',
    frequentSituations: [],
    interests: [],
    onboardingComplete: true,
    firstLessonComplete: true,
    currentDay: 1,
    streak: 1,
    lastStudyDate: null,
    immersionPhase: 2,
    turboMode: false,
    speechSpeed: 'normal',
    germanPercentage: 80,
    dailyMinutes: 20,
    createdAt: new Date().toISOString(),
  };
}

console.log('\n=== SessionOpeningEngine precedence ===\n');

check('isActive: a1', isActiveCurriculumTargetId('a1-family-mutter'));
check('isActive: a2', isActiveCurriculumTargetId('a2-routine-morgens'));
check('isActive: b1', isActiveCurriculumTargetId('b1-story-muenchen'));
check('isActive: b2', isActiveCurriculumTargetId('b2-narrative-erfahrung'));
check('isActive: c1', isActiveCurriculumTargetId('c1-nuance-perspektive'));
check('isActive: c2', isActiveCurriculumTargetId('c2-nuance-ambivalent'));
check('isActive: NOT l0', !isActiveCurriculumTargetId('l0-guten-morgen'));
check('isActive: NOT empty', !isActiveCurriculumTargetId(''));
check('isActive: NOT null', !isActiveCurriculumTargetId(null));

// CASE A — L0 sem currículo → first_intro
{
  const o = getSessionOpening(baseCtx({ zeroLanguageMode: true }));
  check('CASE A L0 zero: first_intro', o.strategy === 'first_intro');
  check('CASE A L0 zero: Guten Morgen', /Guten Morgen/i.test(o.german));
}
{
  const o = getSessionOpening(baseCtx({ zeroLanguageMode: false }));
  check('CASE A L0 genérico: first_intro', o.strategy === 'first_intro');
  check(
    'CASE A L0 genérico: Deutsch Coach',
    /Deutsch Coach|Wie heißt du/i.test(o.german),
  );
}

// CASE B — B2 sem startPhraseId → planned curricular, NÃO first_intro
{
  const de =
    'Letztes Jahr habe ich eine Erfahrung gemacht, die meine Sicht auf die Arbeit völlig verändert hat.';
  const o = getSessionOpening(
    baseCtx({
      plannedCurricularTarget: {
        id: 'b2-narrative-erfahrung',
        german: de,
        portuguese: 'No ano passado…',
        topic: 'b2.narrative',
      },
    }),
  );
  check('CASE B strategy planned_curricular', o.strategy === 'planned_curricular');
  check('CASE B NOT first_intro', o.strategy !== 'first_intro');
  check('CASE B german = target', o.german === de);
  check('CASE B NOT Deutsch Coach', !/Deutsch Coach/i.test(o.german));
}

// CASE C — B2 com selected (forced via prepareSession)
{
  _store.clear();
  const de =
    'Letztes Jahr habe ich eine Erfahrung gemacht, die meine Sicht auf die Arbeit völlig verändert hat.';
  const prepared = prepareSession(profileAt('B2'), emptyLearningProfile(), {
    forcedOpening: {
      german: de,
      portuguese: 'No ano passado…',
      topic: 'b2.narrative',
      reason: 'selected_target:b2-narrative-erfahrung',
    },
  });
  check('CASE C strategy selected_target', prepared.opening.strategy === 'selected_target');
  check('CASE C german = target', prepared.opening.german === de);
  check('CASE C kickoff has target', prepared.kickoff.includes(de));
  check('CASE C kickoff NOT Coach intro', !/Deutsch Coach/i.test(prepared.kickoff));
}

// CASE D — B1 sem startPhraseId
{
  const de = 'Als ich in München angekommen bin, habe ich zuerst eine Wohnung gesucht.';
  const o = getSessionOpening(
    baseCtx({
      plannedCurricularTarget: {
        id: 'b1-story-muenchen',
        german: de,
        portuguese: 'Quando cheguei…',
      },
    }),
  );
  check('CASE D B1 planned_curricular', o.strategy === 'planned_curricular');
  check('CASE D B1 german', o.german === de);
  check('CASE D B1 NOT first_intro', o.strategy !== 'first_intro');
}

// CASE E — A2 sem startPhraseId
{
  const de = 'Morgens stehe ich früh auf und trinke einen Kaffee.';
  const o = getSessionOpening(
    baseCtx({
      plannedCurricularTarget: {
        id: 'a2-routine-morgens',
        german: de,
        portuguese: 'De manhã…',
      },
    }),
  );
  check('CASE E A2 planned_curricular', o.strategy === 'planned_curricular');
  check('CASE E A2 german', o.german === de);
}

// CASE F — A1 sem startPhraseId
{
  const de = 'Meine Mutter heißt Anna.';
  const o = getSessionOpening(
    baseCtx({
      plannedCurricularTarget: {
        id: 'a1-family-mutter',
        german: de,
        portuguese: 'Minha mãe…',
      },
    }),
  );
  check('CASE F A1 planned_curricular', o.strategy === 'planned_curricular');
  check('CASE F A1 german', o.german === de);
}

// CASE G — C1 sem startPhraseId → planned_curricular, NÃO first_intro
{
  const de =
    'Aus meiner Sicht ist die Situation wesentlich komplexer, als es auf den ersten Blick erscheint.';
  const o = getSessionOpening(
    baseCtx({
      plannedCurricularTarget: {
        id: 'c1-nuance-perspektive',
        german: de,
        portuguese: 'Na minha perspectiva…',
      },
    }),
  );
  check('CASE G C1 planned_curricular', o.strategy === 'planned_curricular');
  check('CASE G C1 german', o.german === de);
  check('CASE G C1 NOT first_intro', o.strategy !== 'first_intro');
}

// CASE H — C2 planned_curricular
{
  const de =
    'Die Situation lässt sich keineswegs eindeutig beurteilen, da mehrere Faktoren miteinander in Wechselwirkung stehen.';
  const o = getSessionOpening(
    baseCtx({
      plannedCurricularTarget: {
        id: 'c2-nuance-ambivalent',
        german: de,
        portuguese: 'A situação…',
      },
    }),
  );
  check('CASE H C2 planned_curricular', o.strategy === 'planned_curricular');
  check('CASE H C2 german', o.german === de);
  check('CASE H C2 NOT first_intro', o.strategy !== 'first_intro');
}

// prepareSession: plannedCurricularTarget vence first_intro mesmo com sessionCount 0
{
  _store.clear();
  const de =
    'Dadurch, dass wir die Prioritäten geändert haben, ist der Druck deutlich gesunken.';
  const prepared = prepareSession(profileAt('B2'), emptyLearningProfile(), {
    plannedCurricularTarget: {
      id: 'b2-cause-dadurch',
      german: de,
      portuguese: 'Ao mudarmos…',
      reason: 'B2_CURRICULUM',
    },
  });
  check('prepareSession B2 strategy', prepared.opening.strategy === 'planned_curricular');
  check('prepareSession B2 german', prepared.opening.german === de);
  check('prepareSession B2 NOT first_intro', prepared.opening.strategy !== 'first_intro');
  check('prepareSession B2 kickoff target', prepared.kickoff.includes(de));
  check('prepareSession B2 kickoff NOT Coach', !/Deutsch Coach/i.test(prepared.kickoff));
  check('prepareSession B2 kind NOT FIRST_SESSION', prepared.opening.kind !== 'FIRST_SESSION');
}

// l0-* planejado NÃO ativa planned_curricular (first_intro preservado)
{
  const o = getSessionOpening(
    baseCtx({
      plannedCurricularTarget: {
        id: 'l0-guten-morgen',
        german: 'Guten Morgen.',
        portuguese: 'Bom dia.',
      },
    }),
  );
  check('l0 planned id ignored → first_intro', o.strategy === 'first_intro');
}

// Continuidade genérica perde para planned curricular
{
  const de = 'Ich vertrete die Auffassung, dass wir hier einen klaren Qualitätsstandard brauchen.';
  const o = getSessionOpening(
    baseCtx({
      sessionCount: 3,
      lastSession: {
        date: new Date().toISOString(),
        durationMinutes: 10,
        topic: 'daily',
        phrasesLearned: ['Hallo!'],
        phrasesReviewed: [],
        mistakes: [],
        unfinishedContent: ['Wie geht es dir?'],
        lastQuestion: 'Wie geht es dir?',
        lastTeacherMessage: 'Wie geht es dir?',
        lastUserResponse: 'gut',
        nextSuggestedStep: 'continuar saudação',
        lastOpening: 'Hallo!',
        sessionKind: 'RETURNING_SESSION',
      },
      hoursSinceLast: 1,
      plannedCurricularTarget: {
        id: 'b2-argue-auffassung',
        german: de,
        portuguese: 'Defendo…',
      },
    }),
  );
  check('continuidade: planned wins', o.strategy === 'planned_curricular' && o.german === de);
  check('continuidade: not Wie geht', !/Wie geht/i.test(o.german));
}

console.log(`\nSessionOpeningEngine: ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
