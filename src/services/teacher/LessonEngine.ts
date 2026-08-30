import type { Level, UserProfile } from '@/types';

export type InteractionType =
  | 'greet'
  | 'teach'
  | 'listen'
  | 'repeat'
  | 'complete'
  | 'guided'
  | 'open'
  | 'review'
  | 'conversation'
  | 'done';

export type SupportLevel = 0 | 1 | 2 | 3;

export interface Interaction {
  id: string;
  type: InteractionType;
  german: string;
  portuguese?: string;
  expected?: string;
  hint?: string;
  blank?: { partial: string; answer: string };
  support: SupportLevel;
  praise?: string;
  /** ID estável da frase no learning-profile */
  phraseId?: string;
  /** Papel pedagógico desta interação no ciclo de uso real */
  pedagogicalKind?: 'introduce' | 'guided' | 'recall' | 'independent' | 'transfer' | 'spontaneous' | 'automation';
}

export interface Lesson {
  id: string;
  title: string;
  level: Level;
  interactions: Interaction[];
}

const firstLesson: Lesson = {
  id: 'first',
  title: 'Primeira conversa',
  level: 'zero',
  interactions: [
    { id: 'g1', type: 'greet', german: 'Hallo! Ich bin dein Deutsch Coach. Wie heißt du?', portuguese: 'Olá! Eu sou seu professor de alemão. Como você se chama?', expected: 'ich heiße', hint: 'Ich heiße...', support: 3, praise: 'Sehr gut!' },
    { id: 't1', type: 'teach', german: 'Ich heiße...', portuguese: 'Eu me chamo...', support: 3 },
    { id: 'r1', type: 'repeat', german: 'Ich heiße...', support: 2, expected: 'ich heiße' },
    { id: 'o1', type: 'open', german: 'Wie heißt du?', portuguese: 'Como você se chama?', expected: 'ich heiße', hint: 'Comece com: Ich heiße...', support: 1, praise: 'Sehr gut!' },
    { id: 't2', type: 'teach', german: 'Mir geht es gut.', portuguese: 'Estou bem.', support: 3 },
    { id: 'r2', type: 'repeat', german: 'Mir geht es gut.', support: 2, expected: 'mir geht es gut' },
    { id: 'o2', type: 'open', german: 'Wie geht es dir?', portuguese: 'Como você está?', expected: 'mir geht es gut', hint: 'Comece com: Mir...', support: 1, praise: 'Ausgezeichnet!' },
    { id: 't3', type: 'teach', german: 'Ich komme aus Brasilien.', portuguese: 'Eu sou do Brasil.', support: 3 },
    { id: 'c3', type: 'complete', german: 'Ich ___ aus Brasilien.', portuguese: 'Complete: eu sou do Brasil.', blank: { partial: 'Ich', answer: 'komme' }, support: 2 },
    { id: 'o3', type: 'open', german: 'Woher kommst du?', portuguese: 'De onde você vem?', expected: 'ich komme', hint: 'Comece com: Ich komme aus...', support: 1, praise: 'Perfekt!' },
    { id: 'cv1', type: 'conversation', german: 'Jetzt stellen wir uns vor! Sag alles zusammen.', portuguese: 'Agora vamos nos apresentar! Diga tudo junto.', expected: 'ich heiße', hint: 'Ich heiße... Mir geht es gut. Ich komme aus...', support: 1, praise: 'Herzlichen Glückwunsch!' },
    { id: 'd1', type: 'done', german: 'Du hast deine erste Konversation auf Deutsch!', portuguese: 'Você fez sua primeira conversa em alemão!', support: 0 },
  ],
};

const survivalLesson: Lesson = {
  id: 'survival',
  title: 'Sobrevivência',
  level: 'zero',
  interactions: [
    { id: 'g1', type: 'greet', german: 'Guten Morgen!', portuguese: 'Bom dia!', support: 3, praise: 'Sehr gut!' },
    { id: 't1', type: 'teach', german: 'Ich brauche Hilfe.', portuguese: 'Preciso de ajuda.', support: 3 },
    { id: 'r1', type: 'repeat', german: 'Ich brauche Hilfe.', support: 2, expected: 'ich brauche hilfe' },
    { id: 'o1', type: 'open', german: 'Was brauchst du?', portuguese: 'Do que você precisa?', expected: 'ich brauche', hint: 'Comece com: Ich brauche...', support: 1, praise: 'Sehr gut!' },
    { id: 't2', type: 'teach', german: 'Ich verstehe nicht.', portuguese: 'Não entendo.', support: 3 },
    { id: 'r2', type: 'repeat', german: 'Ich verstehe nicht.', support: 2, expected: 'ich verstehe nicht' },
    { id: 'o2', type: 'open', german: 'Verstehst du?', portuguese: 'Você entende?', expected: 'ich verstehe nicht', hint: 'Comece com: Ich verstehe...', support: 1, praise: 'Gut!' },
    { id: 't3', type: 'teach', german: 'Wie viel kostet das?', portuguese: 'Quanto custa isso?', support: 3 },
    { id: 'r3', type: 'repeat', german: 'Wie viel kostet das?', support: 2, expected: 'wie viel kostet' },
    { id: 'o3', type: 'open', german: 'Du willst kaufen. Was fragst du?', portuguese: 'Você quer comprar. O que pergunta?', expected: 'wie viel kostet', hint: 'Wie viel...', support: 1, praise: 'Perfekt!' },
    { id: 'd1', type: 'done', german: 'Du kannst jetzt überleben!', portuguese: 'Você já consegue se virar!', support: 0 },
  ],
};

const LESSONS: Record<string, Lesson> = {
  first: firstLesson,
  lesson: survivalLesson,
  review: survivalLesson,
  micro: {
    id: 'micro',
    title: '2 minutos',
    level: 'zero',
    interactions: [
      { id: 'm1', type: 'open', german: 'Lass uns anfangen.', portuguese: 'Vamos começar.', expected: 'ich', hint: 'Comece com: Ich...', support: 1, praise: 'Gut!' },
      { id: 'm2', type: 'open', german: 'Was machst du heute?', expected: 'ich', hint: 'Ich...', support: 1, praise: 'Sehr gut!' },
      { id: 'm3', type: 'done', german: 'Schnell! Bis später.', portuguese: 'Rápido! Até logo.', support: 0 },
    ],
  },
};

export function getLesson(type: string, profile: UserProfile): Lesson {
  if (type === 'first') return firstLesson;
  if (type === 'micro') return LESSONS.micro;
  if (type === 'review') return survivalLesson;
  if (profile.level === 'zero') return survivalLesson;
  return survivalLesson;
}

export function interactionNeedsSpeech(i: Interaction): boolean {
  return ['repeat', 'complete', 'guided', 'open', 'conversation'].includes(i.type);
}

export function interactionShowsTranslation(i: Interaction): boolean {
  return i.type === 'teach' || i.type === 'greet';
}
