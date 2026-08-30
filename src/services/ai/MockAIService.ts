import type {
  AIResponse,
  ConversationContext,
  ConversationMessage,
  HelpLevel,
  Level,
  Mistake,
  PersonalPhrase,
  Phrase,
  Progress,
  UserProfile,
  Word,
} from '@/types';
import { similarityScore } from '@/utils/reviewUtils';

export interface AIServiceInterface {
  startConversation(context: ConversationContext): Promise<AIResponse>;
  continueConversation(context: ConversationContext, userMessage: string): Promise<AIResponse>;
  correctAnswer(expected: string, actual: string, level: Level): Promise<AIResponse>;
  analyzeSpeech(transcript: string, expected: string): Promise<{ score: number; feedback: string }>;
  generateLesson(day: number, profile: UserProfile): Promise<AIResponse>;
  generateExercise(mistakes: Mistake[]): Promise<AIResponse>;
  generateSituation(situationId: string, profile: UserProfile): Promise<AIResponse>;
  generateReview(items: (Word | Phrase)[], profile: UserProfile): Promise<AIResponse>;
  explainGrammar(topic: string, level: Level): Promise<AIResponse>;
  translate(text: string, from: string, to: string): Promise<string>;
  analyzeProgress(progress: Progress): Promise<{ summary: string; recommendations: string[] }>;
  createPersonalizedContent(situation: string, profile: UserProfile): Promise<PersonalPhrase>;
}

type LessonStep = { german: string; portuguese: string; expect: string | null; teach?: string };

const FIRST_LESSON_FLOW: LessonStep[] = [
  { german: 'Hallo!', portuguese: 'Olá!', expect: null },
  { german: 'Wie heißt du?', portuguese: 'Como você se chama?', expect: null, teach: 'Ich heiße...' },
  { german: 'Sag: Ich heiße [dein Name].', portuguese: 'Diga: Me chamo [seu nome].', expect: 'ich heiße' },
  { german: 'Sehr gut! Wie geht es dir?', portuguese: 'Muito bem! Como você está?', expect: null, teach: 'Mir geht es gut.' },
  { german: 'Versuch: Mir geht es gut.', portuguese: 'Tente: Estou bem.', expect: 'mir geht es gut' },
  { german: 'Ausgezeichnet! Woher kommst du?', portuguese: 'Excelente! De onde você vem?', expect: null, teach: 'Ich komme aus...' },
  { german: 'Sag: Ich komme aus Brasilien.', portuguese: 'Diga: Eu sou do Brasil.', expect: 'ich komme aus' },
  { german: 'Perfekt! Du kannst dich jetzt vorstellen. Probier noch einmal alles zusammen!', portuguese: 'Perfeito! Agora você consegue se apresentar. Tente tudo junto!', expect: null },
];

const GREETINGS: Record<Level, string[]> = {
  zero: [
    'Guten Morgen! Wie geht es dir heute?',
    'Hallo! Was machst du heute?',
    'Hi! Wie ist das Wetter bei dir?',
  ],
  little: [
    'Guten Tag! Was hast du heute vor?',
    'Hallo! Erzähl mir von deinem Tag.',
    'Wie war dein Morgen?',
  ],
  basic: [
    'Guten Tag! Was würdest du gerne heute machen?',
    'Hallo! Wie läuft dein Tag bisher?',
    'Schön dich zu sehen! Was gibt es Neues?',
  ],
};

const CORRECTIONS: Record<string, { wrong: string; correct: string; hint: string }> = {
  'ich bin gut': {
    wrong: 'Ich bin gut',
    correct: 'Mir geht es gut',
    hint: 'Em alemão dizemos "Mir geht es gut" para "Estou bem".',
  },
  'ich bin fine': {
    wrong: 'Ich bin fine',
    correct: 'Mir geht es gut',
    hint: 'Use "Mir geht es gut" em vez de "fine".',
  },
  'ich habe gut': {
    wrong: 'Ich habe gut',
    correct: 'Mir geht es gut',
    hint: 'A forma correta é "Mir geht es gut".',
  },
};

const HELP_RESPONSES: Record<HelpLevel, (phrase: string) => AIResponse> = {
  1: (phrase) => ({
    german: 'Versuch es noch einmal. Denk an die ersten Wörter...',
    portuguese: 'Tente novamente. Pense nas primeiras palavras...',
    hint: `Comece com "Ich..." — ${phrase}`,
    shouldSpeak: true,
    helpLevel: 1,
  }),
  2: (phrase) => ({
    german: phrase.split(' ').slice(0, 2).join(' ') + '...',
    portuguese: 'Aqui está o começo da frase.',
    hint: phrase.split(' ').slice(0, 2).join(' '),
    shouldSpeak: true,
    helpLevel: 2,
  }),
  3: (phrase) => ({
    german: phrase,
    portuguese: 'Esta é a frase completa. Wiederhole bitte.',
    hint: phrase,
    shouldSpeak: true,
    helpLevel: 3,
  }),
  4: (phrase) => ({
    german: phrase,
    portuguese: 'Ouça e repita.',
    shouldSpeak: true,
    helpLevel: 4,
  }),
  5: (phrase) => ({
    german: `${phrase}. Bitte wiederhole.`,
    portuguese: 'Repita depois de mim.',
    shouldSpeak: true,
    helpLevel: 5,
  }),
};

export class MockAIService implements AIServiceInterface {
  private lessonStep = 0;
  private helpLevel: HelpLevel = 1;
  private lastExpected = '';

  async startConversation(context: ConversationContext): Promise<AIResponse> {
    this.lessonStep = 0;
    this.helpLevel = 1;

    if (context.type === 'situation' && context.situationId) {
      return this.generateSituation(context.situationId, context.userProfile);
    }

    try {
      const { prepareSession } = await import('@/services/teacher/sessionContinuity');
      const prepared = prepareSession(context.userProfile, null);
      this.lastExpected = prepared.opening.expected || '';
      return {
        german: prepared.opening.german,
        portuguese: prepared.opening.portuguese,
        hint: prepared.opening.hint,
        shouldSpeak: true,
        emotion: 'encouraging',
      };
    } catch {
      /* fallback abaixo */
    }

    if (context.type === 'first') {
      const step = FIRST_LESSON_FLOW[0];
      return {
        german: step.german,
        portuguese: step.portuguese,
        shouldSpeak: true,
        emotion: 'encouraging',
      };
    }

    const greeting = GREETINGS[context.userLevel];
    const idx = Math.floor(Math.random() * greeting.length);
    return {
      german: greeting[idx],
      portuguese: context.immersionPhase === 1 ? 'Responda em alemão!' : undefined,
      shouldSpeak: true,
      emotion: 'encouraging',
    };
  }

  async continueConversation(context: ConversationContext, userMessage: string): Promise<AIResponse> {
    if (context.helpRequested) {
      return HELP_RESPONSES[this.helpLevel](this.lastExpected || 'Mir geht es gut.');
    }

    if (context.repeatRequested) {
      const lastAssistant = [...context.previousMessages].reverse().find((m) => m.role === 'assistant');
      return {
        german: lastAssistant?.german || lastAssistant?.content || 'Noch einmal?',
        shouldSpeak: true,
      };
    }

    if (context.slowerRequested) {
      const lastAssistant = [...context.previousMessages].reverse().find((m) => m.role === 'assistant');
      return {
        german: lastAssistant?.german || lastAssistant?.content || '',
        portuguese: '🐢 Mais devagar...',
        shouldSpeak: true,
      };
    }

    if (context.explainRequested) {
      const lastAssistant = [...context.previousMessages].reverse().find((m) => m.role === 'assistant');
      return {
        german: lastAssistant?.german || '',
        portuguese: lastAssistant?.portuguese || 'Tradução não disponível.',
        shouldSpeak: false,
      };
    }

    if (context.type === 'first') {
      return this.handleFirstLesson(userMessage, context);
    }

    if (!userMessage.trim()) {
      this.helpLevel = Math.min(5, this.helpLevel + 1) as HelpLevel;
      return HELP_RESPONSES[this.helpLevel](this.lastExpected || 'Mir geht es gut.');
    }

    const normalized = userMessage.toLowerCase().trim();
    for (const [, correction] of Object.entries(CORRECTIONS)) {
      if (normalized.includes(correction.wrong.toLowerCase())) {
        return {
          german: `Fast! Du kannst auch sagen: '${correction.correct}'. Sag es noch einmal.`,
          portuguese: correction.hint,
          correction: correction.correct,
          shouldSpeak: true,
          emotion: 'encouraging',
        };
      }
    }

    const score = this.lastExpected ? similarityScore(userMessage, this.lastExpected) : 0.5;
    if (this.lastExpected && score > 0.6) {
      this.helpLevel = 1;
      const followUps = GREETINGS[context.userLevel];
      const next = followUps[Math.floor(Math.random() * followUps.length)];
      this.lastExpected = '';
      return {
        german: `Sehr gut! ${next}`,
        portuguese: context.immersionPhase <= 2 ? 'Muito bem!' : undefined,
        shouldSpeak: true,
        emotion: 'encouraging',
      };
    }

    if (this.lastExpected && score <= 0.6) {
      return {
        german: `Fast! Versuch: "${this.lastExpected}"`,
        portuguese: 'Quase! Tente novamente.',
        correction: this.lastExpected,
        shouldSpeak: true,
      };
    }

    const responses = [
      { german: 'Interessant! Erzähl mir mehr.', portuguese: 'Interessante! Conte-me mais.' },
      { german: 'Das klingt gut! Und was machst du morgen?', portuguese: 'Parece bom! E amanhã?' },
      { german: 'Verstehe. Was ist dein Lieblingsessen?', portuguese: 'Entendo. Qual sua comida favorita?' },
      { german: 'Gut! Hast du heute schon Deutsch gelernt?', portuguese: 'Bom! Já estudou alemão hoje?' },
    ];
    const resp = responses[Math.floor(Math.random() * responses.length)];
    return { ...resp, shouldSpeak: true };
  }

  private handleFirstLesson(userMessage: string, _context: ConversationContext): AIResponse {
    this.lessonStep++;

    if (this.lessonStep <= FIRST_LESSON_FLOW.length) {
      const prevStep = FIRST_LESSON_FLOW[this.lessonStep - 1];

      if (prevStep.expect) {
        const score = similarityScore(userMessage, prevStep.expect);
        if (score < 0.4) {
          this.lastExpected = prevStep.teach || prevStep.expect;
          return {
            german: `Fast! ${prevStep.teach ? `Sag: ${prevStep.teach}` : 'Versuch es noch einmal.'}`,
            portuguese: prevStep.portuguese,
            shouldSpeak: true,
            hint: prevStep.teach,
          };
        }
      }

      if (this.lessonStep < FIRST_LESSON_FLOW.length) {
        const step = FIRST_LESSON_FLOW[this.lessonStep];
        this.lastExpected = step.expect || step.teach || '';
        return {
          german: step.teach ? `${step.german}` : step.german,
          portuguese: step.portuguese,
          shouldSpeak: true,
          hint: step.teach,
          emotion: 'encouraging',
        };
      }

      return {
        german: 'Herzlichen Glückwunsch! Du hast deine erste Lektion geschafft! 🎉',
        portuguese: 'Parabéns! Você completou sua primeira aula!',
        shouldSpeak: true,
        emotion: 'encouraging',
      };
    }

    return {
      german: 'Sehr gut! Erzähl mir etwas über dich.',
      portuguese: 'Muito bem! Conte algo sobre você.',
      shouldSpeak: true,
    };
  }

  async correctAnswer(expected: string, actual: string, _level: Level): Promise<AIResponse> {
    const score = similarityScore(actual, expected);
    if (score >= 0.8) {
      return { german: 'Perfekt!', portuguese: 'Perfeito!', shouldSpeak: true, emotion: 'encouraging' };
    }
    if (score >= 0.5) {
      return {
        german: `Fast! Die richtige Antwort ist: "${expected}"`,
        portuguese: 'Quase! Tente novamente.',
        correction: expected,
        shouldSpeak: true,
      };
    }
    return {
      german: `Versuch: "${expected}"`,
      portuguese: 'Ouça e repita.',
      correction: expected,
      shouldSpeak: true,
      helpLevel: 3,
    };
  }

  async analyzeSpeech(transcript: string, expected: string): Promise<{ score: number; feedback: string }> {
    const score = similarityScore(transcript, expected);
    if (score >= 0.8) return { score: score * 100, feedback: 'Ausgezeichnet!' };
    if (score >= 0.5) return { score: score * 100, feedback: 'Fast richtig! Noch einmal.' };
    return { score: score * 100, feedback: 'Hör mir zu und wiederhole.' };
  }

  async generateLesson(day: number, _profile: UserProfile): Promise<AIResponse> {
    const topics: Record<number, string> = {
      1: 'Stell dich vor: Hallo, Ich heiße..., Mir geht es gut.',
      2: 'Zahlen und Einkaufen: Wie viel kostet das?',
      3: 'Im Restaurant: Ich möchte..., Die Rechnung bitte.',
      4: 'Bei der Arbeit: Was soll ich machen?',
      5: 'Transport: Wo ist der Bahnhof?',
    };
    const topic = topics[day] || topics[1];
    return {
      german: `Lektion Tag ${day}: ${topic.split(':')[1]?.trim() || topic}`,
      portuguese: topic,
      shouldSpeak: true,
    };
  }

  async generateExercise(mistakes: Mistake[]): Promise<AIResponse> {
    if (mistakes.length === 0) {
      return { german: 'Du machst keine Fehler! Weiter so!', shouldSpeak: true };
    }
    const mistake = mistakes[0];
    return {
      german: `Übung: Sag richtig: "${mistake.correct}"`,
      portuguese: mistake.explanation,
      shouldSpeak: true,
    };
  }

  async generateSituation(situationId: string, _profile: UserProfile): Promise<AIResponse> {
    const openings: Record<string, { german: string; portuguese: string }> = {
      supermarket: {
        german: 'Guten Tag! Kann ich Ihnen helfen?',
        portuguese: 'Bom dia! Posso ajudá-lo? (Você está no supermercado)',
      },
      restaurant: {
        german: 'Guten Abend! Haben Sie reserviert?',
        portuguese: 'Boa noite! Você tem reserva? (Você está no restaurante)',
      },
      doctor: {
        german: 'Guten Tag. Was fehlt Ihnen?',
        portuguese: 'Bom dia. O que você está sentindo? (Consultório médico)',
      },
      work: {
        german: 'Guten Morgen! Bist du bereit für die Besprechung?',
        portuguese: 'Bom dia! Pronto para a reunião? (No trabalho)',
      },
      transport: {
        german: 'Entschuldigung, wo fährt dieser Bus hin?',
        portuguese: 'Com licença, para onde vai este ônibus?',
      },
      bank: {
        german: 'Guten Tag. Wie kann ich Ihnen helfen?',
        portuguese: 'Bom dia. Como posso ajudá-lo? (No banco)',
      },
      phone: {
        german: 'Hallo, hier ist Anna. Spreche ich mit...?',
        portuguese: 'Olá, aqui é Anna. Estou falando com...?',
      },
      hotel: {
        german: 'Willkommen! Haben Sie eine Reservierung?',
        portuguese: 'Bem-vindo! Tem reserva?',
      },
    };
    const opening = openings[situationId] || openings.supermarket;
    return { german: opening.german, portuguese: opening.portuguese, shouldSpeak: true };
  }

  async generateReview(items: (Word | Phrase)[], profile: UserProfile): Promise<AIResponse> {
    if (items.length === 0) {
      return { german: 'Keine Wiederholungen heute. Gut gemacht!', portuguese: 'Nenhuma revisão hoje!', shouldSpeak: true };
    }
    const item = items[0];
    const german = item.german;
    const contextPrompts = [
      `Du arbeitest seit drei Stunden. Was brauchst du? (Antwort: "${german}")`,
      `Jemand fragt dich das. Antworte: "${german}"`,
      `Wiederhole: "${german}"`,
    ];
    return {
      german: contextPrompts[Math.floor(Math.random() * contextPrompts.length)],
      portuguese: profile.immersionPhase <= 2 ? `"${german}"` : undefined,
      reviewItem: german,
      shouldSpeak: true,
    };
  }

  async explainGrammar(topic: string, level: Level): Promise<AIResponse> {
    const explanations: Record<string, string> = {
      articles: 'Em alemão: der (masc), die (fem), das (neut). Ex: der Mann, die Frau, das Kind.',
      word_order: 'Verbo na 2ª posição: "Ich gehe heute ins Kino."',
      mir_geht: '"Mir geht es gut" = Estou bem. Literalmente: "A mim vai bem."',
    };
    return {
      german: topic,
      portuguese: explanations[topic] || `Explicação de ${topic} para nível ${level}.`,
      shouldSpeak: false,
    };
  }

  async translate(text: string, from: string, to: string): Promise<string> {
    const dict: Record<string, string> = {
      'quero dizer ao meu chefe que posso trabalhar amanhã': 'Ich kann morgen arbeiten.',
      'preciso de ajuda': 'Ich brauche Hilfe.',
      'onde fica o banheiro': 'Wo ist die Toilette?',
      'quanto custa': 'Wie viel kostet das?',
      'não entendo': 'Ich verstehe nicht.',
      'pode repetir': 'Können Sie das wiederholen?',
      'estou com fome': 'Ich habe Hunger.',
      'estou cansado': 'Ich bin müde.',
      'preciso de uma pausa': 'Ich brauche eine Pause.',
    };
    const key = text.toLowerCase().trim();
    if (dict[key]) return dict[key];
    if (from === 'pt' && to === 'de') return `Ich... (${text})`;
    return text;
  }

  async analyzeProgress(progress: Progress): Promise<{ summary: string; recommendations: string[] }> {
    return {
      summary: `Communication Score: ${progress.communicationScore}/100. Vocabulário: ${progress.wordsLearned} palavras, ${progress.phrasesLearned} frases.`,
      recommendations: [
        progress.production < 50 ? 'Pratique mais conversação por voz.' : 'Continue conversando!',
        progress.listening < 50 ? 'Faça exercícios de Listening Ladder.' : 'Sua escuta está boa!',
        progress.retention < 50 ? 'Revise frases difíceis com mais frequência.' : 'Retenção excelente!',
      ],
    };
  }

  async createPersonalizedContent(situation: string, _profile: UserProfile): Promise<PersonalPhrase> {
    const german = await this.translate(situation, 'pt', 'de');
    return {
      id: `${Date.now()}`,
      portugueseInput: situation,
      german,
      createdAt: new Date().toISOString(),
      mastery: 'recognize',
      reviewStage: 'new',
      nextReview: null,
      practiced: 0,
    };
  }
}

let aiServiceInstance: AIServiceInterface | null = null;

export function getAIService(): AIServiceInterface {
  if (!aiServiceInstance) {
    aiServiceInstance = new MockAIService();
  }
  return aiServiceInstance;
}

export function createConversationMessage(
  role: 'user' | 'assistant' | 'system',
  content: string,
  extras?: Partial<ConversationMessage>,
): ConversationMessage {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    role,
    content,
    timestamp: new Date().toISOString(),
    ...extras,
  };
}
