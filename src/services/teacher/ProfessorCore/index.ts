/**
 * Professor Core — camada de conhecimento pedagógico.
 * Learning State permanece a fonte da verdade sobre o aluno.
 */
export type {
  AutonomyLevel,
  ClassifiedContent,
  ContentAvailability,
  CurriculumBand,
  EverydaySituation,
  GrammarRule,
  ModePolicy,
  ProfessorContext,
  ProfessorSessionMode,
  ProgressionAction,
  RealCommunicationEvidence,
} from './Types';

export {
  buildProfessorContext,
  formatProfessorContextForGemini,
  resolveProfessorBand,
  resolveSessionMode,
  getModePolicy,
} from './ProfessorCore';
export type { BuildProfessorContextInput } from './ProfessorCore';

export { GRAMMAR_RULES, grammarRulesUpTo, COURSE_GRAMMAR, adaptGrammarTopic, isCourseGrammarSourceOfTruth } from './GrammarKnowledge';
export {
  classifyPhraseAvailability,
  classifyLearningContent,
  inferCurriculumBand,
  grammarExistsIndependentlyOfLearning,
} from './ProfessorKnowledge';
export { CHUNK_CATALOG, chunkByPattern } from './ChunkKnowledge';
export { VOCABULARY, VOCAB_DOMAINS } from './VocabularyKnowledge';
export { EVERYDAY_SITUATIONS, filterSituationsByKnownPatterns, UNIFIED_SIMULATOR_SCENARIOS } from './SituationKnowledge';
export {
  getNormalizedSituations,
  getLegacySituations,
  adaptLegacySituation,
  assertUniqueSituationIds,
} from './SituationCatalog';
export { METHOD_PRINCIPLES, PEDAGOGICAL_SEQUENCE, methodologyHintsForMode } from './MethodologyKnowledge';
export { decideProgression } from './ProgressionRules';
export { autonomyFromConfidence, isMereRepetition } from './AutonomyLevels';
export { MODE_POLICIES } from './ModePolicies';
export {
  recordRealCommunicationEvidence,
  listRealCommunicationEvidence,
  clearRealCommunicationEvidenceForTests,
} from './RealCommunication';
