import type {
  MiniProvaAnswer,
  MiniProvaAutonomyLevel,
  MiniProvaContext,
  MiniProvaQuestion,
  MiniProvaResult,
} from '@/services/teacher/MiniProvaTypes';

export const MINI_PROVA_SESSION_KEY = 'dt_mini_prova_session';

export type MiniProvaSnapshot = {
  id: string;
  questions: MiniProvaQuestion[];
  currentIndex: number;
  total: number;
  answers: MiniProvaAnswer[];
  startedAt: string;
  completed: boolean;
};

export function createMiniProvaSnapshot(ctx: MiniProvaContext): MiniProvaSnapshot {
  return {
    id: ctx.id,
    questions: ctx.questions.map((q) => ({ ...q })),
    currentIndex: 0,
    total: ctx.questions.length,
    answers: [],
    startedAt: ctx.startedAt,
    completed: false,
  };
}

export function persistMiniProvaSnapshot(snap: MiniProvaSnapshot): void {
  if (typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.setItem(MINI_PROVA_SESSION_KEY, JSON.stringify(snap));
  } catch {
    /* ignore */
  }
}

export function readMiniProvaSnapshot(): MiniProvaSnapshot | null {
  if (typeof sessionStorage === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(MINI_PROVA_SESSION_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Partial<MiniProvaSnapshot>;
    if (!p.id || !Array.isArray(p.questions)) return null;
    return {
      id: p.id,
      questions: p.questions as MiniProvaQuestion[],
      currentIndex: typeof p.currentIndex === 'number' ? p.currentIndex : 0,
      total: typeof p.total === 'number' ? p.total : p.questions!.length,
      answers: Array.isArray(p.answers) ? (p.answers as MiniProvaAnswer[]) : [],
      startedAt: typeof p.startedAt === 'string' ? p.startedAt : new Date().toISOString(),
      completed: !!p.completed,
    };
  } catch {
    return null;
  }
}

export function clearMiniProvaSnapshot(): void {
  if (typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.removeItem(MINI_PROVA_SESSION_KEY);
  } catch {
    /* ignore */
  }
}

export function startMiniProvaSession(ctx: MiniProvaContext): MiniProvaSnapshot {
  const snap = createMiniProvaSnapshot(ctx);
  persistMiniProvaSnapshot(snap);
  return snap;
}

export function getCurrentMiniProvaQuestion(snap: MiniProvaSnapshot): MiniProvaQuestion | null {
  if (snap.completed) return null;
  return snap.questions[snap.currentIndex] ?? null;
}

export function recordMiniProvaAnswer(
  snap: MiniProvaSnapshot,
  answer: MiniProvaAnswer,
): MiniProvaSnapshot {
  const next = { ...snap, answers: [...snap.answers, answer] };
  const nextIndex = snap.currentIndex + 1;
  if (nextIndex >= snap.total) {
    next.completed = true;
    next.currentIndex = snap.total;
  } else {
    next.currentIndex = nextIndex;
  }
  persistMiniProvaSnapshot(next);
  return next;
}

function pct(correct: number, total: number): number {
  return total > 0 ? Math.round((correct / total) * 100) : 0;
}

export function finalizeMiniProvaResult(snap: MiniProvaSnapshot): MiniProvaResult {
  const answers = snap.answers;
  const answered = answers.length;
  const correctCount = answers.filter((a) => a.correct).length;
  const autonomous = answers.filter((a) => a.autonomy === 'correct_no_help').length;

  const byType = (t: MiniProvaQuestion['type']) =>
    answers.filter((a) => a.type === t);
  const typePct = (t: MiniProvaQuestion['type']) => {
    const list = byType(t);
    return pct(list.filter((a) => a.correct).length, list.length);
  };

  const strengths = answers
    .filter((a) => a.correct && a.autonomy === 'correct_no_help')
    .map((a) => a.german)
    .slice(0, 6);
  const needsPractice = answers
    .filter((a) => !a.correct || a.autonomy !== 'correct_no_help')
    .map((a) => a.german)
    .slice(0, 6);
  const difficult = answers.filter((a) => !a.correct).map((a) => a.german).slice(0, 4);

  return {
    totalQuestions: snap.total,
    answered,
    correctCount,
    autonomyPercent: pct(autonomous, answered),
    comprehensionPercent: typePct('comprehension'),
    speakingPercent: typePct('production'),
    sentencePercent: typePct('construction'),
    variationPercent: typePct('variation'),
    contentsChecked: new Set(answers.map((a) => a.phraseId)).size,
    strengths,
    needsPractice,
    difficult,
    answers,
    completedAt: new Date().toISOString(),
  };
}

export function autonomyFromFlags(input: {
  correct: boolean;
  usedHelp: boolean;
  attempt: number;
  userSaid: string;
}): MiniProvaAutonomyLevel {
  if (!input.userSaid.trim()) return 'no_response';
  if (!input.correct) return 'incorrect';
  if (input.usedHelp) return 'correct_after_hint';
  if (input.attempt > 1) return 'correct_after_repeat';
  return 'correct_no_help';
}
