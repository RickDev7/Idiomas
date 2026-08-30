/* MemoryRelevanceEngine — o que é útil AGORA. Não envia o histórico inteiro. */

import {
  loadCoachMemory,
  markRecalled,
  saveCoachMemory,
  type CoachMemoryState,
} from '@/services/coach/CoachMemory';
import { dueFollowUpEvent } from '@/services/coach/RealWorldPractice';
import { loadPersonalLearningProfile, geminiAdaptationSnippet } from '@/services/learning/PersonalLearningProfile';
import { personaInstruction } from '@/services/coach/TeacherPersona';
import { buildPersonalContext, relevanceScore } from '@/services/learning/PersonalLanguageEngine';
import type { UserProfile } from '@/types';

const RECALL_COOLDOWN_MS = 48 * 3_600_000;

function recentlyUsed(state: CoachMemoryState, id: string, now: number): boolean {
  const hit = state.recentlyRecalled.filter((r) => r.id === id).pop();
  if (!hit) return false;
  return now - Date.parse(hit.at) < RECALL_COOLDOWN_MS;
}

export interface RelevantCoachContext {
  text: string;
  followUpEventId?: string;
  followUpOpening?: string;
  usedIds: string[];
}

export function selectRelevantCoachContext(opts: {
  user: UserProfile;
  topic?: string;
  now?: Date;
}): RelevantCoachContext {
  const now = opts.now ?? new Date();
  const nowMs = now.getTime();
  let state = loadCoachMemory();
  const topic = (opts.topic || opts.user.goal || 'daily').toLowerCase();
  const personal = buildPersonalContext(opts.user);
  const topicScore = relevanceScore(topic === 'work' ? 'work' : topic, personal);

  const lines: string[] = [];
  const usedIds: string[] = [];

  const follow = dueFollowUpEvent(now, state);
  if (follow && follow.confidence >= 0.7) {
    lines.push(`EVENTO REAL PENDENTE (${follow.date.slice(0, 10)}): ${follow.topic}. Só pergunte se ajudar.`);
    usedIds.push(follow.id);
  }

  const facts = state.facts
    .filter((f) => f.confidence >= 0.75 && !recentlyUsed(state, f.id, nowMs))
    .filter((f) => {
      if (topicScore >= 0.8 && /profession|work|job/.test(f.key)) return true;
      if (f.key === 'name') return false; // não repetir nome toda sessão
      return f.confidence >= 0.9 && usedIds.length < 3;
    })
    .slice(0, 3);

  for (const f of facts) {
    lines.push(`FATO (${f.confidence.toFixed(2)}): ${f.key}=${f.value}`);
    usedIds.push(f.id);
  }

  const goals = state.goals.filter((g) => g.confidence >= 0.7).slice(-2);
  for (const g of goals) {
    if (topicScore < 0.6 && !/trabalho|work|chef/i.test(g.text)) continue;
    lines.push(`OBJETIVO: ${g.text}`);
    usedIds.push(g.id);
  }

  const ep = [...state.episodes].reverse().find((e) => nowMs - Date.parse(e.at) < 7 * 86_400_000);
  if (ep && ep.confidence >= 0.6 && !/voce trabalha/i.test(ep.summary)) {
    lines.push(`ONTEM/RECENTE: ${ep.summary}`);
    usedIds.push(ep.id);
  }

  const plp = loadPersonalLearningProfile();
  const adapt = geminiAdaptationSnippet(plp);
  if (adapt) lines.push(adapt);

  const learned = state.events.find((e) => e.learningNotes && e.status === 'happened');
  if (learned?.learningNotes) {
    lines.push(`APRENDIZADO PÓS-EVENTO: ${learned.learningNotes}`);
    usedIds.push(learned.id);
  }

  if (usedIds.length) {
    state = markRecalled(state, usedIds);
    saveCoachMemory(state);
  }

  const text = [
    personaInstruction(),
    'MEMÓRIA RELEVANTE (use só o que ajudar; NÃO invente; NÃO recicle o mesmo fato toda hora):',
    lines.length ? lines.join('\n') : 'Nenhum fato extra nesta sessão.',
    'Se não estiver listado, você NÃO lembra. Diga que não tem certeza em vez de inventar.',
  ].join('\n');

  return {
    text: text.slice(0, 1600),
    followUpEventId: follow?.id,
    followUpOpening: follow ? 'Wie ist das Gespräch gelaufen?' : undefined,
    usedIds,
  };
}
