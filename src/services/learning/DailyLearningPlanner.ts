import type { UserProfile } from '@/types';
import type { UserLearningProfile } from '@/services/learning/ConfidenceService';
import type { Bottleneck } from '@/services/learning/BottleneckDetector';
import type { LearningState } from '@/services/learning/LearningStateEngine';
import { planSession, type PlannedActivity } from '@/services/learning/NextBestActivityEngine';

export interface PlannedDay {
  sessions: PlannedSession[];
  totalMinutes: number;
}

export interface PlannedSession {
  label: string;
  minutes: number;
  activities: PlannedActivity[];
}

export function planDay(
  profile: UserProfile,
  learning: UserLearningProfile,
  bottleneck: Bottleneck | null,
  state: LearningState,
  allPhrases: { id: string; category: string }[],
): PlannedDay {
  const total = profile.dailyMinutes;
  const fullSession = planSession(profile, learning, allPhrases as never, bottleneck);

  if (state === 'FRUSTRATED' || state === 'OVERLOADED') {
    return {
      totalMinutes: total,
      sessions: [
        { label: 'Curto', minutes: Math.max(2, Math.round(total * 0.3)), activities: fullSession.slice(0, 3) },
        { label: 'Continuação', minutes: Math.max(2, Math.round(total * 0.7)), activities: fullSession.slice(3) },
      ],
    };
  }

  return {
    totalMinutes: total,
    sessions: [{ label: 'Treino completo', minutes: total, activities: fullSession }],
  };
}

export function nextSession(day: PlannedDay, completedMinutes: number): PlannedSession | null {
  let acc = 0;
  for (const s of day.sessions) {
    acc += s.minutes;
    if (completedMinutes < acc) return s;
  }
  return null;
}
