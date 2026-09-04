/* Turn ownership + pedagogical gate (mic ambient / TV).
   Rodar: npx tsx src/services/voice/__tests__/UserTurnOwnership.test.ts */
import {
  assessPedagogicalUserTurn,
  createUserTurnOwnershipState,
  looksLikeUnrelatedAmbient,
  markInterrupted,
  markSession,
  markTeacherAudioStart,
  markTeacherPlaybackIdle,
  markTeacherTurnComplete,
  markUserTurnAccepted,
  type UserTurnOwnershipState,
} from '@/services/voice/UserTurnOwnership';
import { transcriptLikelyTeacherEcho } from '@/services/voice/UserTranscriptReliability';

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

function waitingState(overrides: Partial<UserTurnOwnershipState> = {}): UserTurnOwnershipState {
  let s = createUserTurnOwnershipState(3, 'sess-a');
  s = markSession(s, { sessionGeneration: 3, sessionId: 'sess-a', hasActiveTarget: true });
  s = markTeacherAudioStart(s);
  s = markTeacherTurnComplete(s, { playerPlaying: false });
  return { ...s, ...overrides };
}

console.log('\n=== Turn ownership / pedagogical gate ===');

// 1. professor falando → nenhum USER_UTTERANCE
{
  let s = createUserTurnOwnershipState(1, 's1');
  s = markSession(s, { sessionGeneration: 1, sessionId: 's1', hasActiveTarget: true });
  s = markTeacherAudioStart(s);
  const g = assessPedagogicalUserTurn({
    text: 'Das ist meine Mutter.',
    state: s,
    lastTeacherText: 'Das ist meine Mutter. Agora você.',
    targetGerman: 'Das ist meine Mutter.',
    sessionGeneration: 1,
    sessionId: 's1',
  });
  check('1 professor falando → skipped', g.ok === false && g.reason === 'teacher_speaking');
}

// 2. eco do professor → skipped (monólogo completo ≠ só o alvo)
{
  const s = waitingState();
  const teacher =
    'Olá! Vamos continuar. Repete comigo com calma e depois tente sozinho, combinado?';
  const g = assessPedagogicalUserTurn({
    text: teacher,
    state: s,
    lastTeacherText: teacher,
    targetGerman: 'Das ist meine Mutter.',
    sessionGeneration: 3,
    sessionId: 'sess-a',
  });
  check('2 eco professor → teacher_echo', g.ok === false && g.reason === 'teacher_echo');
  check('2b echo helper', transcriptLikelyTeacherEcho(teacher, teacher));
}

// 3. ruído curto → skipped
{
  const s = waitingState();
  const g = assessPedagogicalUserTurn({
    text: 'á',
    state: s,
    lastTeacherText: 'Das ist meine Mutter.',
    targetGerman: 'Das ist meine Mutter.',
    sessionGeneration: 3,
    sessionId: 'sess-a',
  });
  check('3 ruído curto → unreliable', g.ok === false && g.reason === 'unreliable_transcript');
}

// 4. espanhol TV sem ownership → skipped
{
  let s = createUserTurnOwnershipState(2, 's2');
  s = markSession(s, { sessionGeneration: 2, sessionId: 's2', hasActiveTarget: true });
  s = markTeacherAudioStart(s); // TEACHER owns
  const g = assessPedagogicalUserTurn({
    text: '¿Quién es Bulbasaur? Voy a llamar a la policía ahora mismo.',
    state: s,
    lastTeacherText: 'Das ist meine Mutter.',
    targetGerman: 'Das ist meine Mutter.',
    sessionGeneration: 2,
    sessionId: 's2',
  });
  check('4 ES TV sem user ownership → teacher_speaking', g.ok === false && g.reason === 'teacher_speaking');
}

// 5. português terceiro sem ownership → skipped
{
  let s = createUserTurnOwnershipState(2, 's2');
  s = markSession(s, { sessionGeneration: 2, sessionId: 's2', hasActiveTarget: true });
  // idle teacher owner, not waiting
  const g = assessPedagogicalUserTurn({
    text: 'parece que vai chover amanhã na cidade',
    state: s,
    lastTeacherText: 'Das ist meine Mutter.',
    targetGerman: 'Das ist meine Mutter.',
    sessionGeneration: 2,
    sessionId: 's2',
  });
  check('5 PT terceiro sem ownership → skipped', g.ok === false);
}

// 4b/5b long ambient WITH ownership → unrelated_ambient
{
  const s = waitingState();
  const tv =
    'Pero no pasa nada, eso es un robo y un fraude y abusaste sexualmente de mí. Yo abusé de ti.';
  check('ambient detector long TV', looksLikeUnrelatedAmbient({
    text: tv,
    lastTeacherText: 'Das ist meine Mutter. Agora você.',
    targetGerman: 'Das ist meine Mutter.',
  }));
  const g = assessPedagogicalUserTurn({
    text: tv,
    state: s,
    lastTeacherText: 'Das ist meine Mutter. Agora você.',
    targetGerman: 'Das ist meine Mutter.',
    sessionGeneration: 3,
    sessionId: 'sess-a',
  });
  check('4c ES TV com ownership → unrelated_ambient', g.ok === false && g.reason === 'unrelated_ambient');
}

// 6. resposta real A1 → USER_UTTERANCE (mesmo se o professor modelou a frase)
{
  const s = waitingState();
  const g = assessPedagogicalUserTurn({
    text: 'Das ist meine Mutter.',
    state: s,
    lastTeacherText: 'Das ist meine Mutter. Agora é a sua vez. Das ist...',
    targetGerman: 'Das ist meine Mutter.',
    sessionGeneration: 3,
    sessionId: 'sess-a',
  });
  check('6 resposta A1 real → accepted', g.ok === true);
}

// 7. resposta curta A1 → aceita
{
  const s = waitingState();
  const g = assessPedagogicalUserTurn({
    text: 'Mutter',
    state: s,
    lastTeacherText: 'Quem é esta? Diz: Das ist...',
    targetGerman: 'Das ist meine Mutter.',
    sessionGeneration: 3,
    sessionId: 'sess-a',
  });
  check('7 curta A1 → accepted', g.ok === true);
}

// 8. número A1 → aceita
{
  const s = waitingState({
    ...waitingState(),
  });
  const g = assessPedagogicalUserTurn({
    text: 'drei',
    state: s,
    lastTeacherText: 'Wie spät ist es? Es ist ... Uhr.',
    targetGerman: 'Es ist drei Uhr.',
    sessionGeneration: 3,
    sessionId: 'sess-a',
  });
  check('8 número A1 → accepted', g.ok === true);
}

// 9. nome próprio A1 → aceita
{
  const s = waitingState();
  const g = assessPedagogicalUserTurn({
    text: 'Anna',
    state: s,
    lastTeacherText: 'Wie heißt du?',
    targetGerman: 'Ich heiße Anna.',
    sessionGeneration: 3,
    sessionId: 'sess-a',
  });
  check('9 nome próprio → accepted', g.ok === true);
}

// 10. português permitido → aceita
{
  const s = waitingState();
  const g = assessPedagogicalUserTurn({
    text: 'não sei',
    state: s,
    lastTeacherText: 'Das ist meine Mutter. Tente você.',
    targetGerman: 'Das ist meine Mutter.',
    sessionGeneration: 3,
    sessionId: 'sess-a',
  });
  check('10 PT permitido → accepted', g.ok === true);
}

// 11. interrupção legítima → aceita
{
  let s = createUserTurnOwnershipState(4, 's4');
  s = markSession(s, { sessionGeneration: 4, sessionId: 's4', hasActiveTarget: true });
  s = markTeacherAudioStart(s);
  s = markInterrupted(s);
  const g = assessPedagogicalUserTurn({
    text: 'Das ist meine Mutter.',
    state: s,
    lastTeacherText: 'Guten Tag, heute lernen wir viele neue Sachen über die Familie und...',
    targetGerman: 'Das ist meine Mutter.',
    sessionGeneration: 4,
    sessionId: 's4',
    interrupted: true,
  });
  check('11 interrupção legítima → accepted', g.ok === true);
}

// 12. stale generation → skipped
{
  const s = waitingState();
  const g = assessPedagogicalUserTurn({
    text: 'Das ist meine Mutter.',
    state: s,
    lastTeacherText: 'Bitte wiederholen.',
    targetGerman: 'Das ist meine Mutter.',
    sessionGeneration: 99,
    sessionId: 'sess-a',
  });
  check('12 stale generation → skipped', g.ok === false && g.reason === 'stale_generation');
}

// 13. outro sessionId → skipped
{
  const s = waitingState();
  const g = assessPedagogicalUserTurn({
    text: 'Das ist meine Mutter.',
    state: s,
    lastTeacherText: 'Bitte wiederholen.',
    targetGerman: 'Das ist meine Mutter.',
    sessionGeneration: 3,
    sessionId: 'sess-OTHER',
  });
  check('13 outro sessionId → skipped', g.ok === false && g.reason === 'wrong_session');
}

// playback still active keeps teacher ownership
{
  let s = createUserTurnOwnershipState(5, 's5');
  s = markSession(s, { sessionGeneration: 5, sessionId: 's5', hasActiveTarget: true });
  s = markTeacherAudioStart(s);
  s = markTeacherTurnComplete(s, { playerPlaying: true });
  check('playback ativo → ainda TEACHER', s.owner === 'TEACHER' && s.phase === 'TEACHER_SPEAKING');
  s = markTeacherPlaybackIdle(s);
  check('playback idle → USER waiting', s.owner === 'USER' && s.phase === 'WAITING_FOR_USER_RESPONSE');
}

// after accept → teacher owns again (blocks ambient during processing)
{
  let s = waitingState();
  s = markUserTurnAccepted(s);
  const g = assessPedagogicalUserTurn({
    text: '¿Qué haces ahora en la televisión?',
    state: s,
    lastTeacherText: 'Sehr gut!',
    targetGerman: 'Das ist meine Mutter.',
    sessionGeneration: 3,
    sessionId: 'sess-a',
  });
  check('após accept ambient → teacher_speaking', g.ok === false && g.reason === 'teacher_speaking');
}

// empty
{
  const s = waitingState();
  const g = assessPedagogicalUserTurn({
    text: '   ',
    state: s,
    sessionGeneration: 3,
    sessionId: 'sess-a',
  });
  check('empty → empty_transcript', g.ok === false && g.reason === 'empty_transcript');
}

console.log(`\nUserTurnOwnership tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
