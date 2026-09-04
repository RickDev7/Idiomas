/* A1 context L0 residual + mic transcript gate.
   Rodar: npx tsx src/services/course/__tests__/A1ContextAndMicGate.test.ts */
const _store = new Map<string, string>();
(globalThis as unknown as { localStorage: Storage }).localStorage = {
  getItem: (k) => _store.get(k) ?? null,
  setItem: (k, v) => { _store.set(k, String(v)); },
  removeItem: (k) => { _store.delete(k); },
  clear: () => { _store.clear(); },
  key: () => null,
  length: 0,
} as Storage;

import {
  buildProfessorContext,
  formatProfessorContextForGemini,
  resolveProfessorBand,
  inferCurriculumBand,
} from '@/services/teacher/ProfessorCore';
import { teachFromErrorNudge } from '@/services/teacher/ZeroLanguageMode';
import {
  ConversationOrchestrator,
  buildConversationPlan,
  isA1LiveMode,
} from '@/services/teacher/ConversationOrchestrator';
import { mergeA1CurriculumPhrases, a1FirstTarget, isA1TargetId } from '@/services/course/A1Curriculum';
import { defaultCourseProgress, saveCourseProgress } from '@/services/course/CourseProgressEngine';
import { emptyLearningProfile } from '@/services/learning/RealProgress';
import {
  assessUserTranscriptReliability,
  transcriptLikelyTeacherEcho,
} from '@/services/voice/UserTranscriptReliability';
import { zeroLanguageSeedPhrases } from '@/services/teacher/ZeroLanguageMode';
import type { UserProfile } from '@/types';

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

function profileA1(): UserProfile {
  return {
    id: 'a1-ctx',
    name: 'Rick',
    level: 'little',
    selfReportedLevel: 'beginner',
    diagnosticLevel: 'A1',
    goal: 'daily',
    dailyMinutes: 20,
    germanPercentage: 40,
    turboMode: false,
    streak: 0,
    currentDay: 1,
    onboardingComplete: true,
    firstLessonComplete: true,
    profession: '',
    frequentSituations: [],
    interests: [],
    lastStudyDate: null,
    immersionPhase: 1,
    speechSpeed: 'normal',
    createdAt: new Date().toISOString(),
  };
}

function profileL0(): UserProfile {
  return {
    ...profileA1(),
    level: 'zero',
    selfReportedLevel: 'zero',
    diagnosticLevel: 'L0',
  };
}

async function main() {
  console.log('\n=== Band / ProfessorCore ===');
  check('little → A1 band', inferCurriculumBand('little') === 'A1');
  check('zero → L0 band', inferCurriculumBand('zero') === 'L0');
  check('A1 string → A1', inferCurriculumBand('A1') === 'A1');

  _store.clear();
  await saveCourseProgress({ ...defaultCourseProgress('little'), currentLevel: 'A1', completedLevels: ['L0'] });
  check('resolveProfessorBand A1 profile', resolveProfessorBand(profileA1()) === 'A1');

  const learning = emptyLearningProfile();
  const phrases = mergeA1CurriculumPhrases([]);
  const ctxA1 = buildProfessorContext({
    profile: profileA1(),
    learning,
    phrases,
    curriculumBand: 'A1',
  });
  const formattedA1 = formatProfessorContextForGemini(ctxA1);
  check('A1 Band: A1', /Band: A1/.test(formattedA1));
  check('A1 sem Band: L0', !/Band: L0/.test(formattedA1));
  check('A1 sem TUTOR ATIVO L0 no professor', !/TUTOR ATIVO L0/.test(formattedA1));

  _store.clear();
  await saveCourseProgress(defaultCourseProgress('zero'));
  const ctxL0 = buildProfessorContext({
    profile: profileL0(),
    learning: emptyLearningProfile(),
    phrases: zeroLanguageSeedPhrases(),
    curriculumBand: 'L0',
  });
  const formattedL0 = formatProfessorContextForGemini(ctxL0);
  check('L0 Band: L0', /Band: L0/.test(formattedL0));

  console.log('\n=== teachFromErrorNudge labels ===');
  const nudgeL0 = teachFromErrorNudge({
    userSaid: 'x',
    correction: 'Das ist meine Mutter.',
    attempt: 1,
    tutorBand: 'L0',
  });
  const nudgeA1 = teachFromErrorNudge({
    userSaid: 'x',
    correction: 'Das ist meine Mutter.',
    attempt: 1,
    tutorBand: 'A1',
  });
  check('L0 nudge has TUTOR ATIVO L0', /TUTOR ATIVO L0/.test(nudgeL0));
  check('A1 nudge has TUTOR ATIVO A1', /TUTOR ATIVO A1/.test(nudgeA1));
  check('A1 nudge sem TUTOR ATIVO L0', !/TUTOR ATIVO L0/.test(nudgeA1));

  console.log('\n=== A1 session context via orchestrator ===');
  _store.clear();
  await saveCourseProgress({ ...defaultCourseProgress('little'), currentLevel: 'A1', completedLevels: ['L0'] });
  const orch = ConversationOrchestrator.create({
    profile: profileA1(),
    learning: emptyLearningProfile(),
    phrases: mergeA1CurriculumPhrases([]),
  });
  const live = orch.toLiveFields();
  const coach = live.coachContext || '';
  const directive = live.teacherDirective || '';
  check('isA1LiveMode', isA1LiveMode(profileA1()));
  check('live a1CurriculumMode', live.a1CurriculumMode === true);
  check('coach sem Band: L0', !/Band: L0/.test(coach));
  check('coach tem Band: A1', /Band: A1/.test(coach));
  check('coach/directive sem TUTOR ATIVO L0', !/TUTOR ATIVO L0/.test(coach + directive));
  check('target A1', isA1TargetId(live.targetId as string));

  // Incorrect → repair nudge must be A1 labeled
  const bad = await orch.handleUserUtterance('xxx falsch');
  check('INCORRECT/repair action practice', bad.action === 'practice');
  check('repair nudge A1 label', /TUTOR ATIVO A1/.test(bad.geminiNudge || ''));
  check('repair nudge not L0 label', !/TUTOR ATIVO L0/.test(bad.geminiNudge || ''));

  const good = await orch.handleUserUtterance(a1FirstTarget().german.replace(/[.…]/g, ''));
  check(
    'CORRECT advances or continues A1',
    /A1_CONTINUE|A1_ADVANCE|PEDAGOGICAL TURN \(A1\)|Perfeito/i.test(good.geminiNudge || good.reason),
  );
  check('after correct still not l0-*', !String(orch.getPlan().target?.id || '').startsWith('l0-'));

  // Force several corrects — never l0
  for (let i = 0; i < 3; i++) {
    const p = buildConversationPlan(profileA1(), emptyLearningProfile(), mergeA1CurriculumPhrases([]), i * 1000);
    check(`planner A1 no l0 #${i + 1}`, !!p.target && isA1TargetId(p.target.id));
  }

  console.log('\n=== Mic / transcript reliability ===');
  check('empty rejected', assessUserTranscriptReliability({ text: '' }).ok === false);
  check('empty reason', assessUserTranscriptReliability({ text: '   ' }).reason === 'empty');
  check('no letters', assessUserTranscriptReliability({ text: '...' }).reason === 'no_letters');
  check('too short', assessUserTranscriptReliability({ text: 'á' }).reason === 'too_short');
  check('reliable german', assessUserTranscriptReliability({ text: 'Das ist meine Mutter.' }).ok === true);
  check(
    'teacher echo rejected',
    assessUserTranscriptReliability({
      text: 'Das ist meine Mutter. Jetzt du',
      lastTeacherText: 'Das ist meine Mutter. Jetzt du! Wer ist das?',
    }).ok === false,
  );
  check(
    'echo helper',
    transcriptLikelyTeacherEcho(
      'Das ist meine Mutter jetzt du',
      'Das ist meine Mutter. Jetzt du! Wer ist das?',
    ) === true,
  );
  check(
    'distinct interruption ok',
    assessUserTranscriptReliability({
      text: 'Ich habe einen Bruder.',
      lastTeacherText: 'Das ist meine Mutter. Jetzt du!',
    }).ok === true,
  );

  console.log('\n=== L0 still L0 ===');
  _store.clear();
  await saveCourseProgress(defaultCourseProgress('zero'));
  const orchL0 = ConversationOrchestrator.create({
    profile: profileL0(),
    learning: emptyLearningProfile(),
    phrases: zeroLanguageSeedPhrases(),
  });
  const liveL0 = orchL0.toLiveFields();
  check('L0 zeroLanguageMode', liveL0.zeroLanguageMode === true);
  check('L0 coach Band L0', /Band: L0/.test(liveL0.coachContext || ''));

  const l0Bad = await orchL0.handleUserUtterance('blabla xxx');
  check('L0 repair still TUTOR ATIVO L0', /TUTOR ATIVO L0/.test(l0Bad.geminiNudge || '') || /ZERO LANGUAGE|correction|practice/i.test(l0Bad.reason));

  console.log(`\nA1 context/mic tests: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
