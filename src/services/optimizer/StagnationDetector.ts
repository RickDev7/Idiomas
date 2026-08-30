import type { ProgressSummary } from '@/services/learning/ProgressEngine';
import { EventStore } from '@/services/learning/EventStore';

export interface StagnationReport {
  stagnant: boolean;
  area: string | null;
  weeksStagnant: number;
}

export function detectStagnation(history: ProgressSummary[]): StagnationReport {
  if (history.length < 2) return { stagnant: false, area: null, weeksStagnant: 0 };
  const recent = history.slice(-2);
  const commDelta = recent[1].communicationScore - recent[0].communicationScore;
  if (Math.abs(commDelta) >= 3) return { stagnant: false, area: null, weeksStagnant: 0 };
  const areas: { area: string; delta: number }[] = [
    { area: 'communicationScore', delta: commDelta },
    { area: 'independenceScore', delta: recent[1].independenceScore - recent[0].independenceScore },
    { area: 'comprehensionScore', delta: recent[1].comprehensionScore - recent[0].comprehensionScore },
    { area: 'responseSpeedScore', delta: recent[1].responseSpeedScore - recent[0].responseSpeedScore },
  ];
  const stagnantAreas = areas.filter((a) => Math.abs(a.delta) < 2);
  if (stagnantAreas.length === 0) return { stagnant: false, area: null, weeksStagnant: 0 };
  stagnantAreas.sort((a, b) => a.delta - b.delta);
  return { stagnant: true, area: stagnantAreas[0].area, weeksStagnant: 1 };
}

export async function recentActivity(): Promise<{ total: number; successes: number; failures: number }> {
  const week = 7 * 86_400_000;
  const events = await EventStore.recent(week);
  const successes = events.filter((e) => e.type === 'PHRASE_PRODUCED' || e.type === 'RAPID_RESPONSE_SUCCESS' || e.type === 'PHRASE_USED_SPONTANEOUSLY').length;
  const failures = events.filter((e) => e.type === 'PHRASE_FAILED' || e.type === 'RAPID_RESPONSE_FAILURE').length;
  return { total: events.length, successes, failures };
}
