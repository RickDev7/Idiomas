import type { ReviewStage } from '@/types';
import { REVIEW_INTERVALS } from '@/types';

export function getNextReviewDate(stage: ReviewStage, fromDate = new Date()): string {
  const days = REVIEW_INTERVALS[stage];
  const date = new Date(fromDate);
  date.setDate(date.getDate() + days);
  return date.toISOString().split('T')[0];
}

export function advanceReviewStage(current: ReviewStage, correct: boolean): ReviewStage {
  const stages: ReviewStage[] = ['new', 'learning', 'hard', 'almost', 'mastered', 'automatic'];
  const idx = stages.indexOf(current);

  if (!correct) {
    if (idx <= 1) return 'learning';
    return stages[Math.max(0, idx - 2)];
  }

  if (idx >= stages.length - 1) return 'automatic';
  return stages[idx + 1];
}

export function calculateCommunicationScore(metrics: {
  comprehension: number;
  production: number;
  retention: number;
  pronunciation: number;
  vocabulary: number;
  spontaneity: number;
  conversation: number;
}): number {
  const weights = {
    comprehension: 0.15,
    production: 0.2,
    retention: 0.15,
    pronunciation: 0.1,
    vocabulary: 0.1,
    spontaneity: 0.15,
    conversation: 0.15,
  };

  let score = 0;
  for (const [key, weight] of Object.entries(weights)) {
    score += metrics[key as keyof typeof metrics] * weight;
  }
  return Math.round(Math.min(100, Math.max(0, score)));
}

export function detectBottleneck(metrics: {
  comprehension: number;
  production: number;
  listening: number;
  pronunciation: number;
  retention: number;
}): { type: string; description: string; recommendation: string } | null {
  if (metrics.comprehension > 70 && metrics.production < 50) {
    return {
      type: 'production',
      description: 'Você entende bem, mas tem dificuldade para responder rapidamente.',
      recommendation: 'Aumentar exercícios de resposta rápida e produção oral.',
    };
  }
  if (metrics.production > 60 && metrics.listening < 50) {
    return {
      type: 'listening',
      description: 'Você fala bem, mas tem dificuldade para entender alemão falado.',
      recommendation: 'Aumentar treinos de escuta com Listening Ladder.',
    };
  }
  if (metrics.retention < 40) {
    return {
      type: 'retention',
      description: 'Você aprende, mas esquece rapidamente.',
      recommendation: 'Mais revisões espaçadas e repetição ativa na conversa.',
    };
  }
  if (metrics.pronunciation < 40) {
    return {
      type: 'pronunciation',
      description: 'Sua pronúncia precisa de mais prática.',
      recommendation: 'Repetir frases com áudio e gravar sua voz.',
    };
  }
  return null;
}

export function getImmersionPhase(day: number): 1 | 2 | 3 | 4 {
  if (day <= 7) return 1;
  if (day <= 14) return 2;
  if (day <= 21) return 3;
  return 4;
}

export function shouldShowPortuguese(phase: 1 | 2 | 3 | 4, context: 'hint' | 'explain' | 'correction'): boolean {
  if (context === 'explain') return true;
  if (phase === 4) return false;
  if (phase === 3) return context === 'hint';
  return true;
}

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function formatDate(date = new Date()): string {
  return date.toISOString().split('T')[0];
}

export function updateStreak(lastDate: string | null, currentStreak: number): { streak: number; lastStudyDate: string } {
  const today = formatDate();
  if (lastDate === today) return { streak: currentStreak, lastStudyDate: today };

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = formatDate(yesterday);

  if (lastDate === yesterdayStr) {
    return { streak: currentStreak + 1, lastStudyDate: today };
  }
  return { streak: 1, lastStudyDate: today };
}

export function similarityScore(a: string, b: string): number {
  const normalize = (s: string) =>
    s
      .toLowerCase()
      .replace(/[.,!?;:'"]/g, '')
      .trim();
  const na = normalize(a);
  const nb = normalize(b);
  if (na === nb) return 1;
  const wordsA = na.split(/\s+/);
  const wordsB = nb.split(/\s+/);
  const matches = wordsA.filter((w) => wordsB.includes(w)).length;
  return matches / Math.max(wordsA.length, wordsB.length);
}
