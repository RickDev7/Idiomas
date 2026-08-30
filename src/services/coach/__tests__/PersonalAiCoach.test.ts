import {
  emptyCoachMemory,
  saveCoachMemory,
  loadCoachMemory,
  upsertFact,
  addGoal,
  COACH_MEMORY_KEY,
} from '@/services/coach/CoachMemory';
import { selectRelevantCoachContext } from '@/services/coach/MemoryRelevanceEngine';
import {
  looksLikeFutureNeed,
  startPrepareMode,
  applyPostEventLearning,
  dueFollowUpEvent,
  markFollowedUp,
  followUpNudge,
} from '@/services/coach/RealWorldPractice';
import { decideInterruption, briefCorrectionNudge } from '@/services/coach/InvisibleTeaching';
import { scoreNaturalness } from '@/services/coach/Naturalness';
import { loadTeacherPersona, defaultPersona } from '@/services/coach/TeacherPersona';
import { ingestUserUtterance } from '@/services/coach/ingestUtterance';
import { ConversationOrchestrator } from '@/services/teacher/ConversationOrchestrator';
import type { UserProfile } from '@/types';
import type { UserLearningProfile } from '@/services/learning/ConfidenceService';
import { assert } from '@/services/learning/__tests__/assert';

function user(over: Partial<UserProfile> = {}): UserProfile {
  return {
    id: 'u',
    name: 'Rick',
    level: 'little',
    dailyMinutes: 20,
    goal: 'work',
    profession: 'Designer',
    frequentSituations: [],
    interests: [],
    onboardingComplete: true,
    firstLessonComplete: true,
    currentDay: 4,
    streak: 2,
    turboMode: false,
    ...over,
  } as UserProfile;
}

function learning(): UserLearningProfile {
  return {
    userLevel: 'little',
    communicationScore: 40,
    listeningScore: 50,
    speakingScore: 40,
    retentionScore: 50,
    pronunciationScore: 50,
    responseSpeedScore: 50,
    immersionLevel: 60,
    dailyGoal: 20,
    currentStreak: 1,
    totalStudyTime: 30,
    knownWords: [],
    knownPhrases: [],
    weakPhrases: [],
    strongPhrases: [],
    recurringMistakes: [],
    recentTopics: [],
    recentSituations: [],
    lastSession: null,
    learningVelocity: 1,
    phrases: {},
    bottleneck: null,
  };
}

function resetCoach() {
  try {
    localStorage.removeItem(COACH_MEMORY_KEY);
    localStorage.removeItem('deutsch-turbo:teacher-persona:v1');
  } catch { /* */ }
  saveCoachMemory(emptyCoachMemory());
}

export async function testPersonalAiCoach() {
  resetCoach();

  // Persona estável
  const p1 = loadTeacherPersona();
  const p2 = loadTeacherPersona();
  assert(p1.tone === p2.tone && p1.name === p2.name, 'persona estável');
  assert(defaultPersona().humor === 'light', 'humor moderado');

  // Fato incerto não vai ao Gemini
  let mem = upsertFact(emptyCoachMemory(), 'secretJob', 'CIA', 0.3, 'inferred');
  saveCoachMemory(mem);
  const relLow = selectRelevantCoachContext({ user: user(), topic: 'work' });
  assert(!/CIA/.test(relLow.text), 'não afirma fato incerto');

  // Reconciliação
  mem = loadCoachMemory();
  mem = upsertFact(mem, 'profession', 'Designer', 0.95, 'user');
  mem = upsertFact(mem, 'profession', 'Lehrer', 0.96, 'user');
  saveCoachMemory(mem);
  assert(loadCoachMemory().facts.find((f) => f.key === 'profession')?.value === 'Lehrer', 'reconcilia fato');

  resetCoach();
  ingestUserUtterance('Ich heisse Rick', user());
  assert(loadCoachMemory().facts.some((f) => f.key === 'name' && f.value === 'Rick'), 'extrai nome');

  // Prepare mode dia 1
  resetCoach();
  const day1 = new Date('2026-09-01T10:00:00Z');
  assert(looksLikeFutureNeed('Amanhã preciso falar com meu chefe.'), 'detecta necessidade futura');
  const prep = startPrepareMode('Amanhã preciso falar com meu chefe.', day1);
  assert(!!prep, 'PrepareMode oferecido');
  assert(prep!.event.type === 'BOSS_TALK', 'evento BOSS_TALK');
  assert(/PREPARE MODE/i.test(prep!.nudge), 'nudge prepare');
  assert(loadCoachMemory().events.length === 1, 'evento persistido');

  // Dia 2 follow-up (evento era amanhã = 2 de setembro)
  const day2 = new Date('2026-09-02T10:00:00Z');
  const due = dueFollowUpEvent(day2);
  assert(!!due, 'follow-up due no dia seguinte');
  assert(/Wie ist das Gespräch gelaufen/i.test(followUpNudge(due!)), 'pergunta armazenada');
  markFollowedUp(due!.id);

  // Pós-evento
  const post = applyPostEventLearning('Foi difícil falar sobre horário.');
  assert(!!post, 'PostEventLearning');
  assert(/horário/i.test(post!.learningNote), 'identifica vocabulário de horário');

  // Dia 3 — aprendizado disponível
  const rel3 = selectRelevantCoachContext({ user: user(), topic: 'work', now: new Date('2026-09-03T10:00:00Z') });
  assert(/horário|APRENDIZADO/i.test(rel3.text), 'dia 3 usa aprendizado');

  // Objetivo longo prazo (10 sessões)
  resetCoach();
  mem = addGoal(emptyCoachMemory(), 'Quero falar alemão no trabalho.', 0.95);
  saveCoachMemory(mem);
  for (let i = 0; i < 10; i++) {
    const r = selectRelevantCoachContext({ user: user(), topic: 'work', now: new Date(Date.now() + i * 86400000) });
    void r;
  }
  assert(loadCoachMemory().goals.some((g) => /trabalho/i.test(g.text)), 'objetivo sobrevive 10 sessões');

  // Invisible teaching
  const brief = decideInterruption({
    hasGrammarError: true,
    recurringError: false,
    shouldMicro: false,
    pendingReview: false,
    pendingTransfer: false,
    spontaneous: false,
    strategy: { conversationRatio: 0.7 } as never,
    naturalness: { interruptionsLast10: 3, briefCorrectionsLast10: 1, microStartsLast10: 0, topicRepeats: 0, turnsSinceLastIntervention: 1 },
  });
  assert(brief === 'CORRECT_BRIEFLY', `ensino invisível (${brief})`);
  assert(/nova tentativa|Agora você|Quase/i.test(briefCorrectionNudge('Ich war gestern am', 'Bahnhof')), 'nudge breve');

  const keep = decideInterruption({
    hasGrammarError: false,
    recurringError: false,
    shouldMicro: false,
    pendingReview: false,
    pendingTransfer: false,
    spontaneous: false,
    userChangedTopic: true,
    naturalness: { interruptionsLast10: 0, briefCorrectionsLast10: 0, microStartsLast10: 0, topicRepeats: 0, turnsSinceLastIntervention: 5 },
  });
  assert(keep === 'CONTINUE', 'conversa livre acompanha tema');

  const nat = scoreNaturalness({ interruptionsLast10: 5, briefCorrectionsLast10: 8, microStartsLast10: 3, topicRepeats: 4, turnsSinceLastIntervention: 0 });
  assert(nat.score < 70, 'naturalness baixa com excesso de interrupção');

  // Orchestrator: prepare + não inventa
  resetCoach();
  const orch = ConversationOrchestrator.create({ profile: user(), learning: learning(), phrases: [] });
  const d1 = await orch.handleUserUtterance('Amanhã preciso falar com meu chefe.');
  assert(d1.reason === 'prepare_mode', `orch prepare (${d1.reason})`);
  assert(!!d1.geminiNudge && /PREPARE MODE/i.test(d1.geminiNudge), 'nudge prepare no live');
  const live = orch.toLiveFields();
  assert(!live.coachContext || !/invent/i.test(live.coachContext) || /NÃO invente|nao invente|NÃO lembra/i.test(live.coachContext || ''), 'contexto não pede invenção');

  resetCoach();
}

export function testMemoryRelevanceEngine() {
  resetCoach();
  let s = upsertFact(emptyCoachMemory(), 'profession', 'Designer', 0.98, 'profile');
  s = addGoal(s, 'Quero falar alemão no trabalho.', 0.9);
  saveCoachMemory(s);
  const work = selectRelevantCoachContext({ user: user(), topic: 'work' });
  assert(/Designer|trabalho|FOCO|ESTRATÉGIA|PERSONA/i.test(work.text), 'contexto de trabalho relevante');
  assert(work.text.length < 1800, 'não envia histórico inteiro');
}
