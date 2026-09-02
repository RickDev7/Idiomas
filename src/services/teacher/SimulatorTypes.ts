import type { ConversationPedagogicalContext } from '@/services/teacher/ConversationTopics';

export type SimulatorMode = 'learned' | 'weak' | 'free';
export type SimulatorTrainingStyle = 'training' | 'real_test';
export type SimulatorDurationMinutes = 10 | 20 | 30 | 60;

export type SimulatorScenario = {
  id: string;
  emoji: string;
  titlePt: string;
  titleDe: string;
  topic: string;
  settingDe: string;
  roleDe: string;
};

export type SimulatorContext = ConversationPedagogicalContext & {
  simulatorMode: SimulatorMode;
  trainingStyle: SimulatorTrainingStyle;
  durationMinutes: SimulatorDurationMinutes;
  surprise: boolean;
  scenario: SimulatorScenario;
  weakPhraseIds: string[];
  focusStructures: string[];
  endsAt: number;
};

export type SimulatorTurnKind =
  | 'repeated'
  | 'with_model'
  | 'with_hint'
  | 'partial_independent'
  | 'fully_independent';

export type SimulatorTurnRecord = {
  phraseId: string | null;
  german: string;
  correct: boolean;
  kind: SimulatorTurnKind;
  at: string;
};

export type SimulatorResult = {
  mode: SimulatorMode;
  trainingStyle: SimulatorTrainingStyle;
  durationMinutes: SimulatorDurationMinutes;
  scenario: SimulatorScenario;
  elapsedMinutes: number;
  speechOpportunities: number;
  responsesProduced: number;
  autonomousCount: number;
  helpCount: number;
  correctionCount: number;
  contentsUsed: string[];
  needsPractice: Array<{ phraseId: string; german: string }>;
  deferredToReview: Array<{ phraseId: string; german: string }>;
  completedAt: string;
  /** Métricas de turnos (só se TeacherTalkMetrics confiável). */
  teacherTalkRatio?: number;
  studentTalkRatio?: number;
  teacherTurns?: number;
  studentTurns?: number;
  teacherSpeechDurationMs?: number;
  studentSpeechDurationMs?: number;
  /** Sinal adaptativo — não altera mastery. */
  teacherTalkTooHigh?: boolean;
};
