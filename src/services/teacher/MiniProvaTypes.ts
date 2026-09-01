export type MiniProvaQuestionType =
  | 'comprehension'
  | 'production'
  | 'variation'
  | 'construction'
  | 'chunk'
  | 'dialogue'
  | 'autonomous';

export type MiniProvaAutonomyLevel =
  | 'correct_no_help'
  | 'correct_after_repeat'
  | 'correct_after_hint'
  | 'correct_after_partial'
  | 'incorrect'
  | 'no_response';

export type MiniProvaQuestion = {
  phraseId: string;
  german: string;
  type: MiniProvaQuestionType;
  promptDe: string;
  priority: number;
  weak: boolean;
  /** Palavras-chave da estrutura para avaliar transferência. */
  expectedKeywords?: string[];
};

export type MiniProvaAnswer = {
  phraseId: string;
  german: string;
  type: MiniProvaQuestionType;
  autonomy: MiniProvaAutonomyLevel;
  correct: boolean;
  userSaid: string;
  at: string;
};

export type MiniProvaResult = {
  totalQuestions: number;
  answered: number;
  correctCount: number;
  autonomyPercent: number;
  comprehensionPercent: number;
  speakingPercent: number;
  sentencePercent: number;
  variationPercent: number;
  contentsChecked: number;
  strengths: string[];
  needsPractice: string[];
  difficult: string[];
  answers: MiniProvaAnswer[];
  completedAt: string;
};

export type MiniProvaContext = {
  id: string;
  questions: MiniProvaQuestion[];
  startedAt: string;
};
