/**
 * Tipos do Professor Core — conhecimento pedagógico do professor.
 * NÃO confundir com Learning State (o que o aluno sabe).
 */

export type ProfessorSessionMode =
  | 'LESSON'
  | 'REVIEW'
  | 'SIMULATOR'
  | 'MINI_PROVA'
  | 'CONVERSATION';

export type ContentAvailability = 'KNOWN' | 'LEARNING' | 'WEAK' | 'NOT_YET_STUDIED';

export type AutonomyLevel =
  | 'RECOGNITION'
  | 'RECALL'
  | 'GUIDED_PRODUCTION'
  | 'INDEPENDENT_PRODUCTION'
  | 'SPONTANEOUS_PRODUCTION'
  | 'REAL_COMMUNICATION';

export type ProgressionAction =
  | 'INTRODUCE'
  | 'PRACTICE'
  | 'VARY'
  | 'TEST'
  | 'REVIEW'
  | 'DEFER'
  | 'ADVANCE';

export type CurriculumBand = 'L0' | 'A1' | 'A1+' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';

export interface GrammarRule {
  id: string;
  band: CurriculumBand;
  titleDe: string;
  titlePt: string;
  summary: string;
  examples: string[];
  relatedChunkPatterns: string[];
}

export interface ChunkKnowledge {
  id: string;
  pattern: string;
  meaningPt: string;
  communicativeFunction: string;
  band: CurriculumBand;
  substitutions: string[];
  situations: string[];
  relatedStructures: string[];
  commonErrors: string[];
}

export interface VocabEntry {
  lemma: string;
  domain: string;
  band: CurriculumBand;
  glossPt: string;
}

export interface EverydaySituation {
  id: string;
  domain: string;
  titleDe: string;
  titlePt: string;
  settingDe: string;
  promptsDe: string[];
  requiredPatterns: string[];
  band: CurriculumBand;
}

export interface MethodPrinciple {
  id: string;
  name: string;
  description: string;
}

export interface ModePolicy {
  mode: ProfessorSessionMode;
  goal: string;
  allowPortuguese: boolean;
  allowTeaching: boolean;
  allowCorrectionLoop: boolean;
  teacherTalkRatioMax: number;
  knownContentMinRatio: number;
  newContentMaxRatio: number;
  supportOrder: string[];
  forbidden: string[];
  focus: string;
}

export interface ClassifiedContent {
  id: string;
  german: string;
  availability: ContentAvailability;
  autonomy: AutonomyLevel;
  confidence: number;
}

export interface RealCommunicationEvidence {
  id: string;
  reportedAt: string;
  observation: string;
  context?: string;
  relatedPhraseId?: string;
  relatedStructure?: string;
  evidenceConfidence: 'low' | 'medium' | 'high';
  /** Nunca implica mastery automático. */
  doesNotImplyMastery: true;
}

export interface ProfessorContext {
  mode: ProfessorSessionMode;
  band: CurriculumBand;
  levelLabel: string;
  policy: ModePolicy;
  knownChunks: ClassifiedContent[];
  learningChunks: ClassifiedContent[];
  weakChunks: ClassifiedContent[];
  notYetStudiedCount: number;
  availableVocabulary: string[];
  allowedStructures: string[];
  suitableSituations: EverydaySituation[];
  grammarRelevant: GrammarRule[];
  progression: {
    action: ProgressionAction;
    reason: string;
    targetId: string | null;
    autonomy: AutonomyLevel;
  };
  sessionGoals: string[];
  helpLevelAllowed: number;
  recentErrors: string[];
  methodologyHints: string[];
  contentMix: { knownRatio: number; newRatio: number };
  teacherTalkRatioMax: number;
  realCommunicationNotes: string[];
}
