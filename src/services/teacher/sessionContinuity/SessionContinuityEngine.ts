/* Continuidade entre sessões: resumo, memória compacta, abertura, persistência. */
import type { UserProfile } from '@/types';
import type { UserLearningProfile } from '@/services/learning/ConfidenceService';
import type {
  ContinuityState, LastSessionSummary, LearningSession, SessionContext, SessionKind, SessionOpening, SessionStatus, StudentMemorySummary,
} from './types';
import {
  hoursSince, loadContinuityState, recordOpening, saveLastSession, ensureSessionStub,
  startOrResumeSession, getIncompleteSession, getLastSession, getRecentSessions,
  markSessionStatus, autosaveTurn,
} from './SessionStore';
import { getSessionOpening } from './SessionOpeningEngine';
import { computeSessionScaffoldStats } from '@/services/learning/ScaffoldingEngine';
import { isZeroLanguageMode } from '@/services/teacher/ZeroLanguageMode';

const DEV = typeof import.meta !== 'undefined' && !!(import.meta as { env?: { DEV?: boolean } }).env?.DEV;

export interface PreparedSession {
  opening: SessionOpening;
  memorySummary: StudentMemorySummary;
  memorySummaryText: string;
  sessionContext: SessionContext;
  kickoff: string;
  lastSession: LastSessionSummary | null;
  sessionCount: number;
  incomplete: LearningSession | null;
  returning: boolean;
}

function debug(label: string, value: unknown) {
  if (!DEV) return;
  try {
    console.log(`[SESSION RESTORE] ${label}=`, value);
  } catch {
    /* ignore */
  }
}

function memoryDebug(label: string, value: unknown) {
  if (!DEV) return;
  try {
    console.log(`[MEMORY DEBUG] ${label}=`, value);
  } catch {
    /* ignore */
  }
}

export function loadLearningContext(profile: UserProfile, learning: UserLearningProfile | null): {
  state: ContinuityState;
  last: LastSessionSummary | null;
  incomplete: LearningSession | null;
  knownPhrases: string[];
  weakPhrases: string[];
} {
  const state = loadContinuityState();
  const last = state.lastSession;
  const incomplete = getIncompleteSession();
  const knownPhrases = learning
    ? Object.values(learning.phrases).filter((c) => c.confidence >= 50).map((c) => c.phraseId).slice(0, 12)
    : (last?.phrasesLearned ?? []);
  const weakPhrases = learning
    ? Object.values(learning.phrases).filter((c) => c.confidence > 0 && c.confidence < 45).map((c) => c.phraseId).slice(0, 6)
    : (last?.phrasesReviewed ?? last?.weakItems ?? []).slice(0, 4);

  memoryDebug('profile loaded', !!profile);
  memoryDebug('session summary loaded', !!last);
  memoryDebug('last session loaded', !!last);
  memoryDebug('known phrases', knownPhrases.length);
  memoryDebug('weak phrases', weakPhrases.length);
  memoryDebug('last topic', last?.topic || incomplete?.topic || 'none');
  memoryDebug('unfinished content', incomplete?.unfinishedContent?.[0] || last?.unfinishedContent?.[0] || 'none');

  return { state, last, incomplete, knownPhrases, weakPhrases };
}

export function buildSessionContext(
  profile: UserProfile,
  opening: SessionOpening,
  last: LastSessionSummary | null,
  incomplete: LearningSession | null,
  knownPhrases: string[],
  weakPhrases: string[],
): SessionContext {
  const unfinished = incomplete?.unfinishedContent[0] || last?.unfinishedContent[0] || last?.unfinishedGoal || '';
  const lastQ = incomplete?.lastTeacherMessage || last?.lastQuestion || last?.lastTeacherMessage || '';
  const lastA = incomplete?.lastUserResponse || last?.lastUserResponse || '';
  return {
    studentLevel: profile.diagnosticLevel || profile.level,
    recentTopic: incomplete?.topic || last?.topic || opening.topic,
    recentPhrases: (incomplete?.learnedItems?.length ? incomplete.learnedItems : last?.phrasesLearned) ?? knownPhrases,
    weakPhrases,
    recentMistakes: incomplete?.mistakes.map((m) => m.userSaid) ?? last?.mistakes ?? [],
    unfinishedGoal: unfinished,
    lastInteraction: lastA || lastQ,
    lastTeacherQuestion: lastQ,
    lastUserAnswer: lastA,
    recommendedContinuation: last?.nextSuggestedStep || opening.reason,
    sessionKind: opening.kind,
  };
}

export function buildStudentMemorySummary(
  profile: UserProfile,
  learning: UserLearningProfile | null,
  state: ContinuityState,
): StudentMemorySummary {
  const last = state.lastSession;
  const hours = hoursSince(last?.date);
  const weak = learning
    ? Object.values(learning.phrases).filter((c) => c.confidence > 0 && c.confidence < 45).map((c) => c.phraseId).slice(0, 6)
    : (last?.phrasesReviewed ?? []).slice(0, 4);
  const studied = learning
    ? Object.values(learning.phrases).filter((c) => c.confidence >= 50).map((c) => c.phraseId).slice(0, 10)
    : (last?.phrasesLearned ?? []);
  return {
    facts: [
      profile.name ? `Nome: ${profile.name}` : '',
      profile.profession ? `Profissão: ${profile.profession}` : '',
      `Objetivo: ${profile.goal}`,
    ].filter(Boolean),
    studied,
    mistakes: last?.mistakes ?? [],
    recentTopics: [last?.topic, state.currentTopic].filter((x): x is string => !!x),
    weakPhrases: weak,
    currentGoal: profile.goal,
    lastOpening: last?.lastOpening ?? '',
    hoursSinceLast: hours,
  };
}

export function formatMemorySummary(sum: StudentMemorySummary): string {
  return [
    sum.facts.join(' · '),
    sum.studied.length ? `Estudado: ${sum.studied.slice(0, 8).join(' | ')}` : '',
    sum.weakPhrases.length ? `Fraco: ${sum.weakPhrases.slice(0, 4).join(' | ')}` : '',
    sum.mistakes.length ? `Erros: ${sum.mistakes.slice(0, 3).join(' | ')}` : '',
    sum.recentTopics.length ? `Temas: ${sum.recentTopics.join(', ')}` : '',
    sum.lastOpening ? `Última abertura: ${sum.lastOpening}` : '',
    sum.hoursSinceLast != null ? `Horas desde a última sessão: ${Math.round(sum.hoursSinceLast)}` : 'Primeira sessão',
  ].filter(Boolean).join('\n');
}

export function generateLocalSummary(input: EndSessionInput, session: LearningSession | null): LastSessionSummary {
  const state = loadContinuityState();
  const lastOpening = input.openingGerman || state.recentOpenings[state.recentOpenings.length - 1]?.german || '';
  const learned = input.phrasesLearned?.length
    ? input.phrasesLearned
    : (session?.learnedItems ?? []);
  const mistakes = input.mistakes?.length
    ? input.mistakes
    : (session?.mistakes.map((m) => m.userSaid) ?? []);
  const lastTeacher = input.lastTeacherMessage || session?.lastTeacherMessage || '';
  const lastUser = input.lastUserResponse || session?.lastUserResponse || '';
  const unfinished = input.unfinishedContent !== undefined
    ? input.unfinishedContent
    : (session?.unfinishedContent?.length ? session.unfinishedContent : []);
  const scaffoldStats = computeSessionScaffoldStats([...learned, ...(input.phrasesReviewed ?? [])]);

  return {
    sessionId: session?.id,
    date: new Date().toISOString(),
    durationMinutes: input.durationMinutes ?? 1,
    topic: input.topic || session?.topic || state.currentTopic || 'daily',
    phrasesLearned: learned.slice(0, 12),
    phrasesReviewed: input.phrasesReviewed ?? session?.reviewItems ?? [],
    mistakes: mistakes.slice(0, 8),
    unfinishedContent: unfinished.slice(0, 4),
    lastQuestion: input.lastQuestion || lastTeacher,
    lastTeacherMessage: lastTeacher,
    lastUserResponse: lastUser,
    nextSuggestedStep: input.nextSuggestedStep
      || (mistakes[0] ? `corrigir: ${mistakes[0]}` : unfinished[0] ? `continuar: ${unfinished[0]}` : 'continuar o mesmo tema'),
    lastOpening,
    sessionKind: input.sessionKind || 'RETURNING_SESSION',
    unfinishedGoal: unfinished[0],
    strongItems: learned.slice(0, 4),
    weakItems: mistakes.slice(0, 4),
    averageSupportLevel: scaffoldStats.averageSupportLevel,
    lowestSupportLevel: scaffoldStats.lowestSupportLevel,
    independentResponses: scaffoldStats.independentResponses,
  };
}

export type PrepareSessionOpts = {
  /**
   * Abertura forçada (ex.: clique em “Ich arbeite.” na Home).
   * Tem prioridade sobre SessionOpeningEngine — evita gravar Guten Morgen
   * e injetar “Próximo passo: primeira microaula — Guten Morgen” no kickoff.
   */
  forcedOpening?: {
    german: string;
    portuguese: string;
    topic?: string;
    reason?: string;
  };
  /**
   * Target do planner curricular (a1-/a2-/b1-/b2-) sem startPhraseId.
   * Passado ao SessionOpeningEngine para vencer first_intro L0.
   */
  plannedCurricularTarget?: {
    id: string;
    german: string;
    portuguese: string;
    topic?: string;
    reason?: string;
  };
};

export function prepareSession(
  profile: UserProfile,
  learning: UserLearningProfile | null,
  opts?: PrepareSessionOpts,
): PreparedSession {
  const ctx = loadLearningContext(profile, learning);
  const { state, last, incomplete, knownPhrases, weakPhrases } = ctx;
  const hours = hoursSince(incomplete?.startedAt || last?.date);

  const forced = opts?.forcedOpening;
  const opening = forced?.german
    ? ({
        kind: 'NEW_CONTENT_SESSION' as const,
        strategy: 'selected_target' as const,
        german: forced.german,
        portuguese: forced.portuguese || forced.german,
        expected: forced.german.toLowerCase().split(/\s+/).slice(0, 3).join(' '),
        hint: forced.german.split(/\s+/)[0] + '...',
        topic: forced.topic || 'selected',
        reason: forced.reason || `selected_target:${forced.german}`,
        pedagogicalRepeat: false,
      } satisfies SessionOpening)
    : getSessionOpening({
        sessionCount: state.sessionCount,
        lastSession: last,
        recentOpenings: state.recentOpenings.map((o) => o.german),
        hoursSinceLast: hours,
        weakPhrases,
        knownPhrases,
        goal: profile.goal,
        profession: profile.profession,
        name: profile.name,
        incomplete,
        zeroLanguageMode: isZeroLanguageMode(profile),
        plannedCurricularTarget: opts?.plannedCurricularTarget ?? null,
      });

  recordOpening(state, opening.german);
  ensureSessionStub(loadContinuityState(), {
    date: new Date().toISOString(),
    durationMinutes: 0,
    topic: opening.topic || 'daily',
    phrasesLearned: last?.phrasesLearned ?? [],
    phrasesReviewed: last?.phrasesReviewed ?? [],
    mistakes: last?.mistakes ?? [],
    unfinishedContent: last?.unfinishedContent ?? [],
    lastQuestion: opening.german,
    lastTeacherMessage: opening.german,
    lastUserResponse: last?.lastUserResponse ?? '',
    nextSuggestedStep: last?.nextSuggestedStep || opening.reason,
    lastOpening: opening.german,
    sessionKind: opening.kind,
  });

  startOrResumeSession({
    topic: opening.topic || last?.topic || 'daily',
    goal: profile.goal,
    level: profile.diagnosticLevel || profile.level,
  });

  const memorySummary = buildStudentMemorySummary(profile, learning, {
    ...state,
    lastSession: last,
  });
  const memorySummaryText = formatMemorySummary(memorySummary);
  const sessionContext = buildSessionContext(profile, opening, last, incomplete, knownPhrases, weakPhrases);

  const kickoff = isZeroLanguageMode(profile)
    ? [
        '[INSTRUÇÃO INTERNA — não leia isto em voz alta]',
        'ZERO LANGUAGE MODE ativo.',
        `Abertura pedagógica (frase curta): "${opening.german}" (= ${opening.portuguese}).`,
        opening.kind === 'FIRST_SESSION'
          ? 'Siga o ciclo: explicar em PT → modelo DE → Escute → Agora você → AGUARDE.'
          : 'Vamos continuar de onde paramos. NÃO reinicie com Hallo/Wie geht\'s por hábito.',
        sessionContext.unfinishedGoal ? `Objetivo incompleto: ${sessionContext.unfinishedGoal}` : '',
        sessionContext.weakPhrases.length ? `Frases fracas: ${sessionContext.weakPhrases.slice(0, 4).join(' | ')}` : '',
        sessionContext.recentMistakes.length ? `Erros recentes: ${sessionContext.recentMistakes.slice(0, 3).join(' | ')}` : '',
      ].filter(Boolean).join('\n')
    : [
        '[INSTRUÇÃO INTERNA — não leia isto em voz alta]',
        `Comece a sessão FALANDO agora, em alemão. Sua PRIMEIRA fala em áudio DEVE ser esta abertura (variação mínima ok, NÃO troque o sentido):`,
        `"${opening.german}"`,
        `Estratégia: ${opening.strategy}. Tipo: ${opening.kind}.`,
        sessionContext.lastTeacherQuestion ? `Última pergunta da sessão anterior: ${sessionContext.lastTeacherQuestion}` : '',
        sessionContext.lastUserAnswer ? `Última resposta do aluno: ${sessionContext.lastUserAnswer}` : '',
        sessionContext.unfinishedGoal ? `Objetivo incompleto: ${sessionContext.unfinishedGoal}` : '',
        sessionContext.recentPhrases.length ? `Já estudou: ${sessionContext.recentPhrases.slice(0, 6).join(' | ')}` : '',
        sessionContext.recentMistakes.length ? `Erros recentes: ${sessionContext.recentMistakes.slice(0, 3).join(' | ')}` : '',
        sessionContext.recommendedContinuation ? `Próximo passo: ${sessionContext.recommendedContinuation}` : '',
        opening.strategy === 'first_intro'
          ? 'Esta é a PRIMEIRA sessão. Depois da abertura, ensine Ich heiße e faça o aluno produzir.'
          : 'NÃO comece com "Hallo." nem "Wie geht es dir?" a menos que a abertura acima seja exatamente isso. Você LEMBRA da sessão anterior.',
        'Depois da abertura, continue a aula a partir dela. Faça o aluno falar.',
      ].filter(Boolean).join('\n');

  debug('session found', !!last || !!incomplete);
  debug('summary loaded', !!last);
  debug('profile loaded', true);
  debug('memory loaded', memorySummaryText.length > 0);
  debug('opening strategy', opening.strategy);
  debug('context sent to Gemini', {
    kind: opening.kind,
    topic: sessionContext.recentTopic,
    lastQ: sessionContext.lastTeacherQuestion,
    unfinished: sessionContext.unfinishedGoal,
  });

  return {
    opening,
    memorySummary,
    memorySummaryText,
    sessionContext,
    kickoff,
    lastSession: last,
    sessionCount: state.sessionCount,
    incomplete,
    returning: opening.kind !== 'FIRST_SESSION',
  };
}

export interface EndSessionInput {
  topic?: string;
  durationMinutes?: number;
  phrasesLearned?: string[];
  phrasesReviewed?: string[];
  mistakes?: string[];
  unfinishedContent?: string[];
  lastQuestion?: string;
  lastTeacherMessage?: string;
  lastUserResponse?: string;
  openingGerman?: string;
  sessionKind?: SessionKind;
  nextSuggestedStep?: string;
  status?: SessionStatus;
}

export function completeSession(input: EndSessionInput = {}): LastSessionSummary {
  const state = loadContinuityState();
  const session = state.currentSession;
  const summary = generateLocalSummary(input, session);
  saveLastSession(state, summary, { increment: true, clearCurrent: true });
  debug('LAST_SESSION saved', summary);
  return summary;
}

/** Compatível com o fluxo anterior: encerrar = COMPLETED, memória permanece. */
export function endSession(input: EndSessionInput = {}): LastSessionSummary {
  return completeSession({ ...input, status: 'COMPLETED' });
}

/** Fechar o app / voltar: memória fica, sessão pode ser retomada. */
export function pauseSession(input: EndSessionInput = {}): LastSessionSummary {
  markSessionStatus(input.status === 'ABANDONED' ? 'ABANDONED' : 'PAUSED');
  const state = loadContinuityState();
  const summary = generateLocalSummary(input, state.currentSession);
  saveLastSession(state, summary, { increment: false, clearCurrent: false });
  debug('SESSION paused', { status: input.status || 'PAUSED', topic: summary.topic });
  return summary;
}

export function saveLearningEvent(role: 'user' | 'assistant', text: string): void {
  autosaveTurn(role, text);
}

export function getLearningContextSnapshot() {
  return {
    lastSession: getLastSession(),
    incomplete: getIncompleteSession(),
    recent: getRecentSessions(),
  };
}

export { getIncompleteSession, getLastSession, getRecentSessions, autosaveTurn };
