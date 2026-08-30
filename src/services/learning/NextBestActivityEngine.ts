import type { Phrase, UserProfile } from '@/types';
import type { UserLearningProfile, PhraseConfidence } from '@/services/learning/ConfidenceService';
import type { Bottleneck } from '@/services/learning/BottleneckDetector';
import {
  averageAutomationScore,
  getNextBestLearningAction,
  readAutomationScore,
  reviewPriority,
  type PedagogicalKind,
} from '@/services/learning/AutomationScoreEngine';
import { buildReviewQueue } from '@/services/learning/ReviewEngine';

export type ActivityKind =
  | 'warmup'
  | 'review'
  | 'newContent'
  | 'speaking'
  | 'listening'
  | 'rapidResponse'
  | 'conversation'
  | 'challenge';

export interface PlannedActivity {
  kind: ActivityKind;
  minutes: number;
  phraseIds: string[];
  reason: string;
  /** Ação pedagógica sugerida pelo AutomationScore. */
  learningAction?: PedagogicalKind;
}

const PRIORITY: ActivityKind[] = [
  'warmup',
  'review',
  'newContent',
  'speaking',
  'listening',
  'rapidResponse',
  'conversation',
  'challenge',
];

function sortByReviewNeed(profile: UserLearningProfile): PhraseConfidence[] {
  return Object.values(profile.phrases).sort((a, b) => reviewPriority(b) - reviewPriority(a));
}

function pickWeakPhrases(profile: UserLearningProfile, limit: number): string[] {
  return sortByReviewNeed(profile)
    .filter((c) => readAutomationScore(c) < 50 || c.confidence < 50)
    .slice(0, limit)
    .map((c) => c.phraseId);
}

function pickDueReviews(profile: UserLearningProfile, limit: number): string[] {
  const due = buildReviewQueue(profile.phrases, [], new Date(), limit).map((i) => i.phraseId);
  if (due.length) return due;
  return sortByReviewNeed(profile)
    .filter((c) => c.state !== 'automatic' && readAutomationScore(c) < 80)
    .slice(0, limit)
    .map((c) => c.phraseId);
}

function pickTransferCandidates(profile: UserLearningProfile, limit: number): string[] {
  return Object.values(profile.phrases)
    .filter((c) => {
      const s = readAutomationScore(c);
      return s >= 35 && s < 65;
    })
    .sort((a, b) => readAutomationScore(a) - readAutomationScore(b))
    .slice(0, limit)
    .map((c) => c.phraseId);
}

function pickConversationReady(profile: UserLearningProfile, limit: number): string[] {
  return Object.values(profile.phrases)
    .filter((c) => readAutomationScore(c) >= 65)
    .sort((a, b) => readAutomationScore(b) - readAutomationScore(a))
    .slice(0, limit)
    .map((c) => c.phraseId);
}

function pickNewPhrases(all: Phrase[], profile: UserLearningProfile, limit: number): string[] {
  const known = new Set(Object.keys(profile.phrases));
  const pool = all.filter((p) => !known.has(p.id));
  const goalCat = profile.recentSituations[0] || 'daily';
  const relevant = pool.filter(
    (p) => p.category === goalCat || p.category === 'survival' || p.category === 'greetings',
  );
  return (relevant.length ? relevant : pool).slice(0, limit).map((p) => p.id);
}

/**
 * Planeja a sessão com AutomationScore persistido:
 * baixo → mais review/guided; médio → transfer; alto → conversa.
 */
export function planSession(
  profile: UserProfile,
  learning: UserLearningProfile,
  allPhrases: Phrase[],
  bottleneck: Bottleneck | null,
): PlannedActivity[] {
  const total = profile.dailyMinutes;
  const avgAuto = averageAutomationScore(learning.phrases);
  const activities: PlannedActivity[] = [];

  // Pesos por automação média
  const w =
    avgAuto < 35
      ? { warmup: 0.12, review: 0.25, newContent: 0.2, speaking: 0.25, conversation: 0.12, rapid: 0.06 }
      : avgAuto < 65
        ? { warmup: 0.1, review: 0.18, newContent: 0.15, speaking: 0.22, conversation: 0.25, rapid: 0.1 }
        : { warmup: 0.06, review: 0.1, newContent: 0.1, speaking: 0.14, conversation: 0.5, rapid: 0.1 };

  const weak = pickWeakPhrases(learning, 3);
  if (weak.length > 0) {
    const action = getNextBestLearningAction(learning.phrases[weak[0]]);
    activities.push({
      kind: 'warmup',
      minutes: Math.max(1, Math.round(total * w.warmup)),
      phraseIds: weak,
      reason: `Reaquecer (automação ~${avgAuto}): frases com score baixo.`,
      learningAction: action,
    });
  }

  const due = pickDueReviews(learning, 3);
  if (due.length > 0) {
    activities.push({
      kind: 'review',
      minutes: Math.max(1, Math.round(total * w.review)),
      phraseIds: due,
      reason: 'Revisar o que ainda não automatizou.',
      learningAction: getNextBestLearningAction(learning.phrases[due[0]]),
    });
  }

  // Score médio → slot de transferência
  const transferIds = pickTransferCandidates(learning, 2);
  if (transferIds.length > 0 && avgAuto >= 35 && avgAuto < 70) {
    activities.push({
      kind: 'speaking',
      minutes: Math.max(1, Math.round(total * 0.12)),
      phraseIds: transferIds,
      reason: 'Transferência: mesma ideia em outro contexto.',
      learningAction: 'transfer',
    });
  }

  const freshLimit = avgAuto >= 70 ? 1 : 2;
  const fresh = pickNewPhrases(allPhrases, learning, freshLimit);
  if (fresh.length > 0 && avgAuto < 80) {
    activities.push({
      kind: 'newContent',
      minutes: Math.max(1, Math.round(total * w.newContent)),
      phraseIds: fresh,
      reason: 'Aprender frase nova (guided).',
      learningAction: 'introduce',
    });
  }

  if (bottleneck?.type === 'listening' || bottleneck?.type === 'speaking') {
    activities.push({
      kind: bottleneck.type,
      minutes: Math.round(total * w.speaking * 0.9),
      phraseIds: [...weak, ...due].slice(0, 3),
      reason: bottleneck.recommendation,
      learningAction: avgAuto < 35 ? 'guided' : 'recall',
    });
  } else if (!activities.some((a) => a.learningAction === 'transfer')) {
    activities.push({
      kind: 'speaking',
      minutes: Math.round(total * w.speaking),
      phraseIds: [...weak, ...fresh].slice(0, 3),
      reason: avgAuto < 35 ? 'Prática guiada / recall.' : 'Produção falada.',
      learningAction: avgAuto < 35 ? 'guided' : 'recall',
    });
  }

  if (bottleneck?.type === 'response_speed' || bottleneck?.type === 'confidence' || (avgAuto >= 40 && avgAuto < 70)) {
    activities.push({
      kind: 'rapidResponse',
      minutes: Math.round(total * w.rapid),
      phraseIds: weak.slice(0, 2),
      reason: bottleneck?.recommendation || 'Acelerar resposta (automation).',
      learningAction: 'automation',
    });
  }

  const convoIds = pickConversationReady(learning, 3);
  activities.push({
    kind: 'conversation',
    minutes: Math.round(total * w.conversation),
    phraseIds: (convoIds.length ? convoIds : [...weak, ...fresh]).slice(0, 3),
    reason:
      avgAuto >= 65
        ? 'Uso contextual / espontâneo — menos drill.'
        : 'Usar o que aprendeu em conversa.',
    learningAction: avgAuto >= 80 ? 'independent' : avgAuto >= 65 ? 'spontaneous' : 'recall',
  });

  const used = activities.reduce((s, a) => s + a.minutes, 0);
  if (activities.length > 0) activities[activities.length - 1].minutes += Math.max(0, total - used);

  return activities.filter((a) => PRIORITY.includes(a.kind));
}

export function nextBestActivity(activities: PlannedActivity[], done: Set<ActivityKind>): PlannedActivity | null {
  return activities.find((a) => !done.has(a.kind)) ?? null;
}

/** Próxima melhor ação de aprendizagem (proxy para o TeacherEngine). */
export function getNextBestLearningActionForProfile(
  learning: UserLearningProfile,
  phraseId?: string,
): PedagogicalKind {
  if (phraseId && learning.phrases[phraseId]) {
    return getNextBestLearningAction(learning.phrases[phraseId], {
      bottleneck: learning.bottleneck,
    });
  }
  const avg = averageAutomationScore(learning.phrases);
  if (avg < 35) return 'guided';
  if (avg < 65) return 'transfer';
  if (avg < 85) return 'spontaneous';
  return 'independent';
}
