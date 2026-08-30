/* PrepareMode + PostEventLearning + RealWorldEvent (Fase 10). */

import {
  addEvent,
  loadCoachMemory,
  saveCoachMemory,
  updateEvent,
  type RealWorldEvent,
  type RealWorldEventType,
  type CoachMemoryState,
} from '@/services/coach/CoachMemory';

export interface PrepareOffer {
  event: RealWorldEvent;
  nudge: string;
  vocabHint: string;
}

export interface PostEventResult {
  eventId: string;
  learningNote: string;
  structure?: string;
  nudge: string;
}

const TYPE_PATTERNS: { type: RealWorldEventType; re: RegExp }[] = [
  { type: 'BOSS_TALK', re: /chefe|boss|vorgesetzte|chef\b/i },
  { type: 'WORK_MEETING', re: /reuni[aã]o|meeting|besprechung/i },
  { type: 'DOCTOR', re: /m[eé]dic|arzt|ärztin|hospital|krankenhaus/i },
  { type: 'SCHOOL', re: /escola|schule|lehrer|professor/i },
  { type: 'PHONE', re: /telefon|ligar|anruf|anrufen/i },
  { type: 'BANK', re: /banco|bank\b/i },
  { type: 'INTERVIEW', re: /entrevista|bewerbung|vorstellungsgespr/i },
  { type: 'NEIGHBOR', re: /vizinho|nachbar/i },
  { type: 'SERVICE', re: /atendimento|kunden|rezeption/i },
  { type: 'TRAVEL', re: /viagem|reise|flughafen|bahnhof|zug/i },
];

function detectType(text: string): RealWorldEventType {
  for (const p of TYPE_PATTERNS) {
    if (p.re.test(text)) return p.type;
  }
  return 'OTHER';
}

function addDays(isoDate: Date, days: number): string {
  const d = new Date(isoDate);
  d.setDate(d.getDate() + days);
  d.setHours(12, 0, 0, 0);
  return d.toISOString();
}

export function looksLikeFutureNeed(text: string): boolean {
  const t = text.toLowerCase();
  const future = /amanh[ãa]|morgen|tomorrow|na pr[oó]xima|n[aã]o semana que vem|n[aä]chste woche/.test(t);
  const need = /preciso|muss|have to|falar com|sprechen|vorbereiten|prepar/.test(t);
  return (future && (need || TYPE_PATTERNS.some((p) => p.re.test(t)))) || (need && TYPE_PATTERNS.some((p) => p.re.test(t)) && future);
}

export function looksLikePastReport(text: string): boolean {
  const t = text.toLowerCase();
  return /hoje aconteceu|aconteceu isso|foi dif[ií]cil|war schwierig|das gespr[aä]ch|wie ist|correu|correu bem|n[aã]o consegui|travei|faltou palavra/.test(t);
}

export function createUpcomingEvent(text: string, now = new Date()): RealWorldEvent {
  const type = detectType(text);
  const tomorrow = /amanh[ãa]|morgen|tomorrow/.test(text.toLowerCase());
  const date = tomorrow ? addDays(now, 1) : addDays(now, 1);
  const topicMap: Record<RealWorldEventType, string> = {
    BOSS_TALK: 'conversa com o chefe',
    WORK_MEETING: 'reunião de trabalho',
    DOCTOR: 'consulta médica',
    SCHOOL: 'escola',
    PHONE: 'telefonema',
    BANK: 'banco',
    INTERVIEW: 'entrevista',
    NEIGHBOR: 'vizinho',
    SERVICE: 'atendimento',
    TRAVEL: 'viagem',
    OTHER: 'situação real',
  };
  return {
    id: '',
    type,
    date,
    topic: topicMap[type],
    raw: text.slice(0, 200),
    status: 'upcoming',
    confidence: 0.88,
    createdAt: now.toISOString(),
  };
}

export function startPrepareMode(text: string, now = new Date()): PrepareOffer | null {
  if (!looksLikeFutureNeed(text)) return null;
  const draft = createUpcomingEvent(text, now);
  let state = loadCoachMemory();
  state = addEvent(state, {
    type: draft.type,
    date: draft.date,
    topic: draft.topic,
    raw: draft.raw,
    status: 'prepared',
    confidence: draft.confidence,
  });
  saveCoachMemory(state);
  const saved = state.events[state.events.length - 1];
  const vocab =
    draft.type === 'BOSS_TALK'
      ? 'Termin, Uhrzeit, Besprechung, Ich kann…, Es geht um…'
      : 'frases curtas da situação';
  return {
    event: saved,
    vocabHint: vocab,
    nudge: [
      '[INSTRUÇÃO INTERNA — não leia isto em voz alta]',
      'PREPARE MODE: o aluno tem um evento real em breve.',
      `Situação: ${saved.topic}.`,
      'Ofereça praticar AGORA, em alemão, com uma simulação curta (não uma aula).',
      'Comece com algo como: "Gut. Dann üben wir das. Ich bin dein Chef. Fang an."',
      `Vocabulário útil em contexto (não liste): ${vocab}.`,
      'Depois da simulação, volte à conversa normal.',
      'NÃO invente detalhes que o aluno não disse.',
    ].join('\n'),
  };
}

export function extractPostEventLearning(text: string): { note: string; structure?: string } {
  const t = text.toLowerCase();
  if (/hor[aá]rio|uhrzeit|termin|quando/.test(t)) {
    return { note: 'dificuldade em falar sobre horário/compromisso', structure: 'Um ... Uhr / Der Termin ist um ...' };
  }
  if (/reuni|besprechung|meeting/.test(t)) {
    return { note: 'dificuldade em relatar reunião', structure: 'Ich hatte eine Besprechung.' };
  }
  return { note: 'dificuldade relatada após evento real', structure: undefined };
}

export function applyPostEventLearning(text: string): PostEventResult | null {
  if (!looksLikePastReport(text)) return null;
  const state = loadCoachMemory();
  const recent = [...state.events]
    .filter((e) => e.status === 'prepared' || e.status === 'upcoming' || e.status === 'happened' || e.status === 'followed_up')
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  if (!recent) return null;
  const learned = extractPostEventLearning(text);
  const next = updateEvent(state, recent.id, {
    status: 'happened',
    learningNotes: learned.note,
  });
  saveCoachMemory(next);
  return {
    eventId: recent.id,
    learningNote: learned.note,
    structure: learned.structure,
    nudge: [
      '[INSTRUÇÃO INTERNA — não leia isto em voz alta]',
      'POST-EVENT LEARNING: o aluno relatou o que aconteceu.',
      `Aprendizado: ${learned.note}.`,
      learned.structure ? `Estrutura a ensinar em contexto: ${learned.structure}` : '',
      'Não corrija a história inteira. Ensine só o que trava a comunicação, depois volte à conversa.',
      'NÃO invente o que o aluno não disse.',
    ].filter(Boolean).join('\n'),
  };
}

export function dueFollowUpEvent(now = new Date(), state?: CoachMemoryState): RealWorldEvent | null {
  const mem = state ?? loadCoachMemory();
  const today = now.toISOString().slice(0, 10);
  return (
    mem.events.find((e) => {
      const d = e.date.slice(0, 10);
      const due = d <= today;
      return due && (e.status === 'prepared' || e.status === 'upcoming') && e.confidence >= 0.7;
    }) || null
  );
}

export function markFollowedUp(eventId: string): void {
  const state = loadCoachMemory();
  saveCoachMemory(updateEvent(state, eventId, { status: 'followed_up' }));
}

export function followUpNudge(event: RealWorldEvent): string {
  return [
    '[INSTRUÇÃO INTERNA — não leia isto em voz alta]',
    'Há um evento REAL armazenado. Pergunte o resultado, em alemão, só agora:',
    `"Wie ist das Gespräch gelaufen?"`,
    `Contexto (não leia): ${event.topic} (${event.date.slice(0, 10)}).`,
    'Se o aluno não quiser falar disso, mude de assunto. NÃO invente o que aconteceu.',
  ].join('\n');
}
