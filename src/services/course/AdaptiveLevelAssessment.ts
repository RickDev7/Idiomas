/* Diagnóstico adaptativo curto (~2 min). Procura o limite, não aplica a mesma prova a todos. */
import type { SelfReportedLevel } from '@/types';
import type { CourseLevelId, SkillId } from './types';
import { LEVEL_ORDER, levelIndex } from './levels';
import { courseLevelFromSelfReported } from '@/services/onboarding/GermanLevelOptions';
import type { Interaction, Lesson } from '@/services/teacher/LessonEngine';

export interface DiagnosticItem {
  id: string;
  level: CourseLevelId;
  skill: SkillId;
  type: 'open' | 'listen' | 'repeat';
  german: string;
  portuguese: string;
  expected: string;
  hint?: string;
}

export interface DiagnosticItemResult {
  item: DiagnosticItem;
  correct: boolean;
}

export interface DiagnosticResult {
  overall: CourseLevelId;
  estimatedLabel: string;
  confidence: number;
  skills: Record<SkillId, CourseLevelId>;
  nextFocus: string;
  nextFocusSkill: SkillId;
  date: string;
}

const BANK: DiagnosticItem[] = [
  { id: 'd.l0.name', level: 'L0', skill: 'speaking', type: 'open', german: 'Wie heißt du?', portuguese: 'Como você se chama?', expected: 'ich heiße', hint: 'Ich heiße...' },
  { id: 'd.l0.help', level: 'L0', skill: 'vocabulary', type: 'open', german: 'Was brauchst du?', portuguese: 'Do que você precisa?', expected: 'ich brauche', hint: 'Ich brauche...' },
  { id: 'd.a1.today', level: 'A1', skill: 'speaking', type: 'open', german: 'Was machst du heute?', portuguese: 'O que você faz hoje?', expected: 'ich', hint: 'Ich...' },
  { id: 'd.a1.live', level: 'A1', skill: 'communication', type: 'open', german: 'Wo wohnst du?', portuguese: 'Onde você mora?', expected: 'ich wohne', hint: 'Ich wohne...' },
  { id: 'd.a1.listen', level: 'A1', skill: 'listening', type: 'listen', german: 'Ich arbeite heute.', portuguese: 'Eu trabalho hoje.', expected: 'ich arbeite', hint: 'O que você ouviu?' },
  { id: 'd.a2.yesterday', level: 'A2', skill: 'grammar', type: 'open', german: 'Was hast du gestern gemacht?', portuguese: 'O que você fez ontem?', expected: 'ich habe', hint: 'Ich habe...' },
  { id: 'd.a2.plans', level: 'A2', skill: 'speaking', type: 'open', german: 'Was machst du morgen?', portuguese: 'O que você faz amanhã?', expected: 'ich', hint: 'Ich...' },
  { id: 'd.a2.listen', level: 'A2', skill: 'listening', type: 'listen', german: 'Gestern habe ich lange gearbeitet.', portuguese: 'Ontem eu trabalhei bastante.', expected: 'gestern', hint: 'O que você ouviu?' },
  { id: 'd.b1.work', level: 'B1', skill: 'speaking', type: 'open', german: 'Erzähl mir von deiner Arbeit oder deinem Alltag.', portuguese: 'Me conte do seu trabalho ou da sua rotina.', expected: 'ich', hint: 'Ich...' },
  { id: 'd.b1.opinion', level: 'B1', skill: 'communication', type: 'open', german: 'Was findest du gut an deinem Tag?', portuguese: 'O que você acha bom no seu dia?', expected: 'ich', hint: 'Ich finde...' },
  { id: 'd.b2.argue', level: 'B2', skill: 'speaking', type: 'open', german: 'Was denkst du über Homeoffice? Warum?', portuguese: 'O que você pensa sobre home office? Por quê?', expected: 'ich', hint: 'Ich denke...' },
  { id: 'd.b2.problem', level: 'B2', skill: 'communication', type: 'open', german: 'Wie würdest du ein Problem bei der Arbeit erklären?', portuguese: 'Como você explicaria um problema no trabalho?', expected: 'ich', hint: 'Ich würde...' },
  { id: 'd.c1.nuance', level: 'C1', skill: 'speaking', type: 'open', german: 'Welche Herausforderungen siehst du in deinem Beruf oder Studium?', portuguese: 'Que desafios você vê no seu trabalho ou estudo?', expected: 'ich', hint: 'Ich sehe...' },
  { id: 'd.c1.abstract', level: 'C1', skill: 'vocabulary', type: 'open', german: 'Was bedeutet für dich, eine Sprache wirklich zu beherrschen?', portuguese: 'O que significa para você realmente dominar um idioma?', expected: 'ich', hint: 'Für mich...' },
  { id: 'd.c2.style', level: 'C2', skill: 'communication', type: 'open', german: 'Wie würdest du deinen Kommunikationsstil auf Deutsch beschreiben?', portuguese: 'Como você descreveria seu estilo de comunicação em alemão?', expected: 'ich', hint: 'Ich würde sagen...' },
];

const SKILLS: SkillId[] = [
  'listening', 'speaking', 'reading', 'writing',
  'pronunciation', 'grammar', 'vocabulary', 'communication',
];

function clampLevel(i: number): CourseLevelId {
  return LEVEL_ORDER[Math.max(0, Math.min(LEVEL_ORDER.length - 1, i))];
}

export function diagnosticStartLevel(selfReported: SelfReportedLevel | null | undefined): CourseLevelId {
  if (!selfReported || selfReported === 'unknown' || selfReported === 'zero') return 'L0';
  return courseLevelFromSelfReported(selfReported);
}

/** Monta uma sequência curta que começa no lugar certo e sobe até achar o teto. */
export function pickAdaptiveItems(selfReported: SelfReportedLevel | null | undefined): DiagnosticItem[] {
  const start = diagnosticStartLevel(selfReported);
  const startIdx = levelIndex(start);
  // Avançado não começa com Wie heißt du.
  const minIdx = selfReported === 'advanced' || selfReported === 'very_advanced'
    ? Math.max(startIdx - 1, levelIndex('A2'))
    : selfReported === 'unknown'
      ? 0
      : Math.max(0, startIdx - 1);
  const maxIdx = selfReported === 'unknown' ? LEVEL_ORDER.length - 1 : Math.min(LEVEL_ORDER.length - 1, startIdx + 2);

  const picked: DiagnosticItem[] = [];
  for (let i = minIdx; i <= maxIdx; i++) {
    const lvl = LEVEL_ORDER[i];
    const pool = BANK.filter((b) => b.level === lvl);
    const take = i === startIdx ? 2 : 1;
    picked.push(...pool.slice(0, take));
    if (picked.length >= 6) break;
  }
  if (picked.length < 4) {
    for (const b of BANK) {
      if (!picked.some((p) => p.id === b.id)) picked.push(b);
      if (picked.length >= 5) break;
    }
  }
  return picked.slice(0, 6);
}

export function buildAdaptiveDiagnosticLesson(
  selfReported: SelfReportedLevel | null | undefined,
  appLevel: 'zero' | 'little' | 'basic',
): { lesson: Lesson; items: DiagnosticItem[] } {
  const items = pickAdaptiveItems(selfReported);
  const start = diagnosticStartLevel(selfReported);
  const high = levelIndex(start) >= levelIndex('B1');
  const interactions: Interaction[] = [
    {
      id: 'd.intro',
      type: 'teach',
      german: high
        ? 'Guten Tag. Wir machen ein kurzes Gespräch — etwa zwei Minuten.'
        : 'Hallo! Wir machen einen kurzen Test. Keine Prüfung — nur um zu sehen, wo wir starten.',
      portuguese: high
        ? 'Olá. Vamos conversar por cerca de dois minutos.'
        : 'Olá! Um teste rápido. Não é prova — só para saber por onde começar.',
      support: 1,
    },
  ];

  items.forEach((item, i) => {
    if (item.type === 'listen') {
      interactions.push({
        id: `${item.id}.hear`,
        type: 'listen',
        german: item.german,
        portuguese: 'Ouça com atenção.',
        support: 1,
      });
      interactions.push({
        id: item.id,
        type: 'open',
        german: 'Was hast du verstanden?',
        portuguese: item.portuguese,
        expected: item.expected,
        hint: item.hint,
        support: 1,
        praise: 'Gut!',
      });
    } else {
      interactions.push({
        id: item.id,
        type: item.type === 'repeat' ? 'repeat' : 'open',
        german: item.german,
        portuguese: i === 0 || !high ? item.portuguese : undefined,
        expected: item.expected,
        hint: item.hint,
        support: high ? 0 : 1,
        praise: 'Sehr gut!',
      });
    }
  });

  interactions.push({
    id: 'd.done',
    type: 'done',
    german: 'Danke! Das reicht fürs Erste.',
    portuguese: 'Obrigado! Isso já é o suficiente.',
    support: 0,
  });

  return {
    items,
    lesson: {
      id: 'diagnostic',
      title: 'Teste rápido de nível',
      level: appLevel,
      interactions,
    },
  };
}

const RESULTS_KEY = 'deutsch-turbo:diagnostic-run:v1';

export function storeDiagnosticPlan(items: DiagnosticItem[]): void {
  try {
    sessionStorage.setItem(RESULTS_KEY, JSON.stringify({ items, answers: [] as { id: string; correct: boolean }[] }));
  } catch { /* ignore */ }
}

export function recordDiagnosticAnswer(interactionId: string, correct: boolean): void {
  try {
    const raw = sessionStorage.getItem(RESULTS_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as { items: DiagnosticItem[]; answers: { id: string; correct: boolean }[] };
    const id = interactionId.replace(/\.hear$/, '');
    parsed.answers = parsed.answers.filter((a) => a.id !== id);
    parsed.answers.push({ id, correct });
    sessionStorage.setItem(RESULTS_KEY, JSON.stringify(parsed));
  } catch { /* ignore */ }
}

export function gradeStoredDiagnostic(selfReported?: SelfReportedLevel | null): DiagnosticResult {
  try {
    const raw = sessionStorage.getItem(RESULTS_KEY);
    if (!raw) return fallbackResult(selfReported);
    const parsed = JSON.parse(raw) as { items: DiagnosticItem[]; answers: { id: string; correct: boolean }[] };
    const results: DiagnosticItemResult[] = parsed.items.map((item) => ({
      item,
      correct: parsed.answers.find((a) => a.id === item.id)?.correct ?? false,
    }));
    return gradeAdaptiveDiagnostic(results, selfReported);
  } catch {
    return fallbackResult(selfReported);
  }
}

export function gradeAdaptiveDiagnostic(
  results: DiagnosticItemResult[],
  selfReported?: SelfReportedLevel | null,
): DiagnosticResult {
  if (results.length === 0) return fallbackResult(selfReported);

  const passed = results.filter((r) => r.correct);
  const failed = results.filter((r) => !r.correct);

  const highestPass = passed.reduce((m, r) => Math.max(m, levelIndex(r.item.level)), -1);
  const lowestFail = failed.reduce((m, r) => Math.min(m, levelIndex(r.item.level)), 99);

  let overallIdx = highestPass >= 0 ? highestPass : Math.max(0, diagnosticStartLevel(selfReported) === 'L0' ? 0 : levelIndex(diagnosticStartLevel(selfReported)) - 1);
  if (lowestFail <= overallIdx && failed.length) overallIdx = Math.max(0, lowestFail);
  // Se passou do nível inicial, sobe; se falhou no inicial, desce um.
  const startIdx = levelIndex(diagnosticStartLevel(selfReported));
  const passRate = passed.length / results.length;
  if (passRate >= 0.7) overallIdx = Math.max(overallIdx, startIdx);
  if (passRate < 0.35) overallIdx = Math.min(overallIdx, Math.max(0, startIdx - 1));

  const overall = clampLevel(overallIdx);

  const skills = {} as Record<SkillId, CourseLevelId>;
  for (const s of SKILLS) {
    const ofSkill = results.filter((r) => r.item.skill === s);
    if (ofSkill.length === 0) {
      skills[s] = overall;
      continue;
    }
    const ok = ofSkill.filter((r) => r.correct);
    if (ok.length === 0) {
      const floor = Math.min(...ofSkill.map((r) => levelIndex(r.item.level)));
      skills[s] = clampLevel(Math.max(0, floor - 1));
    } else {
      skills[s] = clampLevel(Math.max(...ok.map((r) => levelIndex(r.item.level))));
    }
  }
  // Não colapsar tudo no mais fraco: speaking pode ser mais baixo que listening.
  skills.pronunciation = skills.speaking;
  skills.reading = skills.reading || overall;
  skills.writing = skills.writing || skills.grammar;

  const speakIdx = levelIndex(skills.speaking);
  const listenIdx = levelIndex(skills.listening);
  const hasPlus = SKILLS.some((s) => levelIndex(skills[s]) > overallIdx);
  const estimatedLabel = overall === 'L0'
    ? (hasPlus ? 'pré-A1+' : 'pré-A1')
    : `${overall}${hasPlus ? '+' : ''}`;

  let nextFocusSkill: SkillId = 'speaking';
  let nextFocus = 'ganhar mais fluência ao falar';
  if (speakIdx < overallIdx) {
    nextFocusSkill = 'speaking';
    nextFocus = 'ganhar mais fluência ao falar';
  } else if (listenIdx < overallIdx) {
    nextFocusSkill = 'listening';
    nextFocus = 'entender melhor o que ouve';
  } else if (levelIndex(skills.grammar) < overallIdx) {
    nextFocusSkill = 'grammar';
    nextFocus = 'fixar estruturas que ainda travam';
  } else if (levelIndex(skills.vocabulary) < overallIdx) {
    nextFocusSkill = 'vocabulary';
    nextFocus = 'ampliar o vocabulário ativo';
  } else {
    nextFocus = 'continuar avançando com conversas reais';
  }

  const confidence = Math.round(40 + passRate * 50 + Math.min(10, results.length));

  return {
    overall,
    estimatedLabel,
    confidence: Math.min(95, confidence),
    skills,
    nextFocus,
    nextFocusSkill,
    date: new Date().toISOString(),
  };
}

function fallbackResult(selfReported?: SelfReportedLevel | null): DiagnosticResult {
  const overall = diagnosticStartLevel(selfReported);
  const skills = {} as Record<SkillId, CourseLevelId>;
  for (const s of SKILLS) skills[s] = overall;
  return {
    overall,
    estimatedLabel: overall === 'L0' ? 'pré-A1' : overall,
    confidence: 40,
    skills,
    nextFocus: 'começar exatamente daqui',
    nextFocusSkill: 'speaking',
    date: new Date().toISOString(),
  };
}

export function nextFocusLabel(skill: SkillId): string {
  if (skill === 'speaking') return 'ganhar mais fluência ao falar';
  if (skill === 'listening') return 'entender melhor o que ouve';
  if (skill === 'grammar') return 'fixar estruturas que ainda travam';
  if (skill === 'vocabulary') return 'ampliar o vocabulário ativo';
  return 'praticar comunicação real';
}
