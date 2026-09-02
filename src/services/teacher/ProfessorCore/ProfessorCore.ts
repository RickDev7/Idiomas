/**
 * Professor Core — fachada: conhecimento pedagógico + Learning State → contexto Gemini.
 *
 * Separação:
 * - Professor Core = como ensinar alemão / o que é correto
 * - Learning State = o que ESTE aluno sabe
 * - Pedagogical Engine (Orchestrator/NBA) = o que fazer agora
 * - Gemini Live = conversa
 */
import type { Phrase, UserProfile } from '@/types';
import type { UserLearningProfile } from '@/services/learning/ConfidenceService';
import { methodologyHintsForMode } from './MethodologyKnowledge';
import { getModePolicy, resolveSessionMode } from './ModePolicies';
import { decideProgression } from './ProgressionRules';
import {
  allowedStructures,
  availableVocabularyFromKnown,
  classifyLearningContent,
  inferCurriculumBand,
  relevantGrammar,
  suitableSituationsForLearner,
} from './ProfessorKnowledge';
import { listRealCommunicationEvidence } from './RealCommunication';
import type { ProfessorContext, ProfessorSessionMode } from './Types';

export interface BuildProfessorContextInput {
  profile: UserProfile;
  learning: UserLearningProfile;
  phrases: Phrase[];
  mode?: ProfessorSessionMode;
  simulator?: boolean;
  miniProva?: boolean;
  review?: boolean;
  conversation?: boolean;
  targetPhraseId?: string | null;
  recentErrors?: string[];
  helpLevelAllowed?: number;
  sessionGoals?: string[];
  dueReview?: boolean;
  persistentErrors?: number;
}

export function buildProfessorContext(input: BuildProfessorContextInput): ProfessorContext {
  const mode =
    input.mode ||
    resolveSessionMode({
      simulator: input.simulator,
      miniProva: input.miniProva,
      review: input.review,
      conversation: input.conversation,
    });
  const policy = getModePolicy(mode);
  const band = inferCurriculumBand(input.profile.level);
  const classified = classifyLearningContent(input.learning, input.phrases);
  const knownGermans = classified.known.map((c) => c.german);
  const targetConf = input.targetPhraseId
    ? input.learning.phrases[input.targetPhraseId]
    : classified.weak[0]
      ? input.learning.phrases[classified.weak[0].id]
      : classified.learning[0]
        ? input.learning.phrases[classified.learning[0].id]
        : undefined;

  const progression = decideProgression(targetConf, {
    dueReview: input.dueReview || mode === 'REVIEW',
    persistentErrors: input.persistentErrors,
    sessionGoal:
      mode === 'REVIEW' ? 'review' : mode === 'MINI_PROVA' ? 'test' : mode === 'LESSON' ? 'lesson' : 'converse',
  });

  const structures = allowedStructures(classified.known, classified.learning);
  const vocab = availableVocabularyFromKnown(knownGermans, band).slice(
    0,
    mode === 'SIMULATOR' || mode === 'MINI_PROVA' ? 16 : 20,
  );
  const situations = suitableSituationsForLearner(knownGermans);
  const grammar = relevantGrammar(knownGermans, band);
  const rc = listRealCommunicationEvidence(3);

  return {
    mode,
    band,
    levelLabel: String(input.profile.level || 'zero'),
    policy,
    knownChunks: classified.known,
    learningChunks: classified.learning,
    weakChunks: classified.weak,
    notYetStudiedCount: classified.notYetCount,
    availableVocabulary: vocab,
    allowedStructures: structures,
    suitableSituations: situations,
    grammarRelevant: grammar,
    progression: {
      action: progression.action,
      reason: progression.reason,
      targetId: progression.targetId,
      autonomy: progression.autonomy,
    },
    sessionGoals: input.sessionGoals?.length
      ? input.sessionGoals
      : [policy.goal],
    helpLevelAllowed: input.helpLevelAllowed ?? (policy.allowTeaching ? 5 : 2),
    recentErrors: (input.recentErrors || []).slice(0, 6),
    methodologyHints: methodologyHintsForMode(mode),
    contentMix: {
      knownRatio: policy.knownContentMinRatio,
      newRatio: policy.newContentMaxRatio,
    },
    teacherTalkRatioMax: policy.teacherTalkRatioMax,
    realCommunicationNotes: rc.map(
      (e) => `${e.reportedAt.slice(0, 10)}: ${e.observation.slice(0, 80)} (≠ mastery)`,
    ),
  };
}

/** Texto compacto para coachContext / system — sem inventar mastery. */
export function formatProfessorContextForGemini(ctx: ProfessorContext, maxChars = 1400): string {
  const lines = [
    '=== PROFESSOR CORE (interno — não ler em voz alta) ===',
    `Modo: ${ctx.mode} | Band: ${ctx.band} | Nível aluno: ${ctx.levelLabel}`,
    `Objetivo do modo: ${ctx.policy.goal}`,
    `TEACHER_TALK_RATIO máx: ${Math.round(ctx.teacherTalkRatioMax * 100)}% — priorize falas curtas do professor.`,
    `Mix conteúdo: ≥${Math.round(ctx.contentMix.knownRatio * 100)}% conhecido, ≤${Math.round(ctx.contentMix.newRatio * 100)}% novo.`,
    `Progressão agora: ${ctx.progression.action} (${ctx.progression.reason})`,
    `Autonomia alvo: ${ctx.progression.autonomy}`,
    ctx.policy.allowPortuguese
      ? 'Português: permitido para explicar (aula/revisão).'
      : 'Português: BLOQUEADO neste modo (imersão).',
    `Metodologia: ${ctx.methodologyHints.join(' · ')}`,
    `Chunks conhecidos: ${ctx.knownChunks.slice(0, 8).map((c) => c.german).join(' | ') || '—'}`,
    `Em aprendizagem: ${ctx.learningChunks.slice(0, 5).map((c) => c.german).join(' | ') || '—'}`,
    `Fracos (priorizar com cuidado): ${ctx.weakChunks.slice(0, 5).map((c) => c.german).join(' | ') || '—'}`,
    `NÃO estudados neste Learning State: ${ctx.notYetStudiedCount} (não tratar como conhecidos)`,
    `Estruturas permitidas: ${ctx.allowedStructures.slice(0, 10).join(' | ')}`,
    `Vocabulário disponível: ${ctx.availableVocabulary.slice(0, 12).join(', ')}`,
    ctx.suitableSituations.length
      ? `Situações adequadas: ${ctx.suitableSituations.map((s) => s.titleDe).join(' · ')}`
      : 'Situações: nenhuma compatível ainda — manter muito simples.',
    ctx.grammarRelevant.length
      ? `Gramática relevante (conhecimento do professor, ≠ mastery): ${ctx.grammarRelevant.map((g) => g.titleDe).join(', ')}`
      : '',
    ctx.recentErrors.length ? `Erros recentes: ${ctx.recentErrors.join(' | ')}` : '',
    `Ajuda máx: ${ctx.helpLevelAllowed}/5`,
    `Proibido: ${ctx.policy.forbidden.slice(0, 5).join('; ')}`,
    'NÃO invente mastery, progresso, histórico ou resultados de avaliação.',
    'Learning State é a fonte da verdade do aluno.',
    ctx.realCommunicationNotes.length
      ? `Evidência comunicação real (qualitativa): ${ctx.realCommunicationNotes.join(' · ')}`
      : '',
    '=== FIM PROFESSOR CORE ===',
  ].filter(Boolean);

  let text = lines.join('\n');
  if (text.length > maxChars) text = text.slice(0, maxChars - 20) + '\n…[truncado]';
  return text;
}

export { resolveSessionMode, getModePolicy };
