/* Ingestão de falas → fatos / objetivos (Fase 10). Sem dados sensíveis. */

import {
  addEpisode,
  addGoal,
  loadCoachMemory,
  saveCoachMemory,
  seedFromUserProfile,
  upsertFact,
} from '@/services/coach/CoachMemory';
import type { UserProfile } from '@/types';

export function ingestUserUtterance(text: string, user?: UserProfile, topic?: string): void {
  const t = text.trim();
  if (!t) return;
  let state = loadCoachMemory();
  if (user) state = seedFromUserProfile(state, user);

  const name = t.match(/\bich heisse\s+([A-ZÄÖÜ][a-zäöüß]+)/i) || t.match(/me chamo\s+([A-Za-zÀ-ÿ]+)/i);
  if (name?.[1]) state = upsertFact(state, 'name', name[1], 0.92, 'user');

  const job = t.match(/\bich arbeite\s+(?:als|in|bei)\s+(.{3,40})/i) || t.match(/trabalho\s+(?:como|de|em)\s+(.{3,40})/i);
  if (job?.[1]) state = upsertFact(state, 'profession', job[1].replace(/[.!?].*/, '').trim(), 0.85, 'user');

  if (/quero falar alem[aã]o no trabalho|ich will (?:deutsch )?bei der arbeit/i.test(t)) {
    state = addGoal(state, 'Quero falar alemão no trabalho.', 0.93);
  }

  if (t.length > 12 && t.length < 160) {
    state = addEpisode(state, topic || 'conversation', t.slice(0, 140));
  }

  saveCoachMemory(state);
}
