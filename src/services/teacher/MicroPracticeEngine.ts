/* MicroPracticeEngine — Fase 2+3
   CONVERSA → MICROTREINO curto (scaffolding mínimo) → VOLTA À CONVERSA
   Subatividade da sessão Live (não é LearningSession nova). */
import type { UserProfile } from '@/types';
import type { PhraseConfidence } from '@/services/learning/ConfidenceService';
import {
  buildScaffoldHint,
  clampLevel,
  escalateSupport,
  recordHelpAttempt,
  scaffoldingDirective,
  startingSupportForPhrase,
  type SupportLevel,
} from '@/services/learning/ScaffoldingEngine';

export type MicroDurationSec = 30 | 60 | 120 | 300;

/** Passos internos do ciclo (não mostrar jargão na UI). */
export type MicroPhase = 'explain' | 'guided' | 'independent' | 'done';

/** Estados visuais para o painel inline. */
export type MicroVisualState =
  | 'ENTERING'
  | 'PRACTICING'
  | 'LISTENING'
  | 'EVALUATING'
  | 'SUCCESS'
  | 'FAILED'
  | 'RETURNING';

export type MicroStatus = 'active' | 'completed';
export type MicroResult = 'SUCCESS' | 'FAILED' | 'NEEDS_REVIEW' | null;

export interface MicroGrammarInput {
  pattern: string;
  userSaid: string;
  correction: string;
  phraseId: string;
}

/** Snapshot da conversa antes de entrar no microtreino. */
export interface ConversationContextSnapshot {
  lastTeacherUtterance: string;
  lastUserUtterance: string;
  topic: string;
  goal: string;
  targetItem: string | null;
  mode: string;
}

export interface MicroPracticeSession {
  id: string;
  /** Alias pedagógico — mesma sessão Live. */
  originSessionId: string;
  originConversationId: string;
  originConversationTurnId: string;
  targetItemId: string;
  targetItem: string;
  targetPortuguese: string;
  goal: string;
  /** Por que o microtreino existe (ex.: grammar_error:ich_arbeiten). */
  reason: string;
  durationSec: MicroDurationSec;
  startingSupport: SupportLevel;
  /** Nível de ajuda atual (sobe/desce nesta intervenção). */
  currentSupportLevel: SupportLevel;
  /** Texto de ajuda mostrado (contexto / pista / parcial / completa). */
  scaffoldDisplay: string;
  helpRequested: boolean;
  phase: MicroPhase;
  currentStep: MicroPhase;
  attempts: number;
  maxAttempts: number;
  status: MicroStatus;
  result: MicroResult;
  visualState: MicroVisualState;
  snapshot: ConversationContextSnapshot;
  userSaid: string;
  phraseId: string;
  returnPrompt: string;
  /** Pergunta curta na fase independente (ex.: Was machst du heute?). */
  independentPrompt: string;
  pattern: string;
  startedAt: number;
  expiresAt: number;
  guidedAttempts: number;
  independentOk: boolean;
  helpUsed: boolean;
  independentSuccess: boolean;
  explainText: string;
  guidedHint: string;
  sessionId?: string;
}

export interface MicroAdvanceResult {
  session: MicroPracticeSession;
  feedback: string;
  correct: boolean;
  finished: boolean;
  supportDecision?: string;
}

const DEFAULT_MAX_ATTEMPTS = 3;

/** TeacherEngine (leve): escolhe duração do microtreino. */
export function pickMicroDuration(opts: {
  intensiveMode: boolean;
  confidence: number;
  recurring: boolean;
  level: UserProfile['level'];
}): MicroDurationSec {
  if (opts.recurring && opts.confidence < 30) return 300;
  if (opts.recurring || opts.confidence < 40) return 120;
  if (opts.intensiveMode || opts.confidence < 55) return 60;
  if (opts.level === 'zero') return 60;
  return 30;
}

/**
 * Só inicia MicroPractice quando a dificuldade é relevante —
 * não a cada erro isolado.
 */
export function shouldStartMicroPractice(opts: {
  grammar: MicroGrammarInput;
  recentMistakes: string[];
  confidence?: number;
  timesCorrect?: number;
  turnsSinceLastMicro: number;
}): boolean {
  if (opts.turnsSinceLastMicro < 2) return false;

  const sameBefore = opts.recentMistakes.filter((m) => m.includes(opts.grammar.pattern)).length;
  const recurring = sameBefore >= 1;
  const lowConfidence = (opts.confidence ?? 100) < 50;
  const neverCorrect = (opts.timesCorrect ?? 0) === 0;

  return recurring || lowConfidence || neverCorrect;
}

export function buildReturnPrompt(correction: string, lastTeacher: string): string {
  const lower = correction.toLowerCase();
  if (/\bmorgen\b/.test(lower)) return 'Also, was machst du morgen?';
  if (/\bheute\b/.test(lower)) return 'Also, was machst du heute?';
  if (/\bgestern\b/.test(lower)) return 'Also, was hast du gestern gemacht?';
  if (lastTeacher && lastTeacher.length > 4 && !/hallo|guten/i.test(lastTeacher)) {
    return `Also — ${lastTeacher.replace(/\?*$/, '?')}`;
  }
  return 'Also, noch einmal. Was sagst du?';
}

export function buildIndependentPrompt(correction: string): string {
  const lower = correction.toLowerCase();
  if (/\bmorgen\b/.test(lower)) return 'Was machst du morgen?';
  if (/\bheute\b/.test(lower)) return 'Was machst du heute?';
  if (/brauche|pause/i.test(lower)) return 'Was brauchst du?';
  return 'Sag es noch einmal — allein.';
}

function applySupport(session: MicroPracticeSession, level: SupportLevel): MicroPracticeSession {
  const hint = buildScaffoldHint(session.targetItem, level, {
    portuguese: session.targetPortuguese,
  });
  return {
    ...session,
    currentSupportLevel: level,
    scaffoldDisplay: hint.displayText,
    guidedHint: hint.displayText || session.guidedHint,
    helpUsed: level > 0 || session.helpUsed || session.helpRequested,
  };
}

export function createMicroPractice(opts: {
  grammar: MicroGrammarInput;
  originConversationId: string;
  lastTeacherUtterance: string;
  confidence?: PhraseConfidence;
  intensiveMode: boolean;
  recurring: boolean;
  level: UserProfile['level'];
  portuguese?: string;
  snapshot?: Partial<ConversationContextSnapshot>;
  originConversationTurnId?: string;
  /** Nível já escalado nesta sessão Live (erro recente). */
  currentSessionSupport?: SupportLevel;
}): MicroPracticeSession {
  const conf = opts.confidence?.confidence ?? 40;
  const durationSec = pickMicroDuration({
    intensiveMode: opts.intensiveMode,
    confidence: conf,
    recurring: opts.recurring,
    level: opts.level,
  });
  const fromHistory = startingSupportForPhrase(opts.grammar.phraseId, {
    confidence: conf,
    isNew: !opts.confidence,
  });
  const startingSupport = clampLevel(
    Math.max(fromHistory, opts.currentSessionSupport ?? 0),
  );
  const now = Date.now();
  const hint = buildScaffoldHint(opts.grammar.correction, startingSupport, {
    portuguese: opts.portuguese,
  });
  const snapshot: ConversationContextSnapshot = {
    lastTeacherUtterance: opts.snapshot?.lastTeacherUtterance ?? opts.lastTeacherUtterance ?? '',
    lastUserUtterance: opts.snapshot?.lastUserUtterance ?? opts.grammar.userSaid,
    topic: opts.snapshot?.topic ?? '',
    goal: opts.snapshot?.goal ?? 'practice',
    targetItem: opts.snapshot?.targetItem ?? opts.grammar.correction,
    mode: opts.snapshot?.mode ?? 'FREE_CONVERSATION',
  };

  return {
    id: `micro-${now}`,
    originSessionId: opts.originConversationId,
    originConversationId: opts.originConversationId,
    originConversationTurnId: opts.originConversationTurnId || `turn-${now}`,
    targetItemId: opts.grammar.phraseId,
    targetItem: opts.grammar.correction,
    targetPortuguese: opts.portuguese || 'Forma correta',
    goal: 'independent_production',
    reason: `grammar_error:${opts.grammar.pattern}`,
    durationSec,
    startingSupport,
    currentSupportLevel: startingSupport,
    scaffoldDisplay: hint.displayText,
    helpRequested: false,
    phase: 'explain',
    currentStep: 'explain',
    attempts: 0,
    maxAttempts: DEFAULT_MAX_ATTEMPTS,
    status: 'active',
    result: null,
    visualState: 'ENTERING',
    snapshot,
    userSaid: opts.grammar.userSaid,
    phraseId: opts.grammar.phraseId,
    returnPrompt: buildReturnPrompt(opts.grammar.correction, opts.lastTeacherUtterance),
    independentPrompt: buildIndependentPrompt(opts.grammar.correction),
    pattern: opts.grammar.pattern,
    startedAt: now,
    expiresAt: now + durationSec * 1000,
    guidedAttempts: 0,
    independentOk: false,
    helpUsed: startingSupport > 0,
    independentSuccess: false,
    explainText: 'Quase. Vamos corrigir isso rapidinho.',
    guidedHint: hint.displayText || hint.label,
    sessionId: opts.originConversationId,
  };
}

export function isMicroExpired(session: MicroPracticeSession, now = Date.now()): boolean {
  return now >= session.expiresAt;
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^\wäöüß\s]/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Aceita produção correta sem exigir string idêntica
 * (transfer completo fica para fase posterior).
 */
export function scoreAgainstTarget(utterance: string, target: string): boolean {
  const u = normalize(utterance);
  const t = normalize(target);
  if (!u || !t) return false;
  if (u === t) return true;
  const tw = t.split(' ').filter(Boolean);
  const hits = tw.filter((w) => u.includes(w)).length;
  return hits / tw.length >= 0.7;
}

function withStep(session: MicroPracticeSession, step: MicroPhase, visual: MicroVisualState): MicroPracticeSession {
  return {
    ...session,
    phase: step,
    currentStep: step,
    visualState: visual,
  };
}

function finish(
  session: MicroPracticeSession,
  result: Exclude<MicroResult, null>,
  feedback: string,
  correct: boolean,
): MicroAdvanceResult {
  const success = result === 'SUCCESS';
  const levelUsed = session.currentSupportLevel;
  const recorded = recordHelpAttempt(session.phraseId, levelUsed, correct, {
    helpRequested: session.helpRequested,
    sessionId: session.sessionId || session.originSessionId,
  });
  return {
    session: {
      ...session,
      phase: 'done',
      currentStep: 'done',
      status: 'completed',
      result,
      visualState: success ? 'SUCCESS' : result === 'NEEDS_REVIEW' ? 'FAILED' : 'FAILED',
      independentOk: success,
      independentSuccess: success,
      currentSupportLevel: recorded.nextInSession,
      scaffoldDisplay: buildScaffoldHint(session.targetItem, recorded.nextInSession).displayText,
    },
    feedback,
    correct,
    finished: true,
    supportDecision: recorded.decision,
  };
}

/** Usuário pediu 💡 Ajuda no microtreino — sobe um nível. */
export function requestMicroHelp(session: MicroPracticeSession): MicroPracticeSession {
  const next = escalateSupport(session.currentSupportLevel);
  return {
    ...applySupport(session, next),
    helpRequested: true,
    helpUsed: true,
  };
}

/** Avança o ciclo: explain → guided (ajuda mínima) → independent → done */
export function advanceMicroPractice(
  session: MicroPracticeSession,
  utterance?: string,
): MicroAdvanceResult {
  if (session.phase === 'done' || session.status === 'completed') {
    return {
      session,
      feedback: session.result === 'SUCCESS' ? 'Muito melhor!' : 'Vamos revisar isso novamente mais tarde.',
      correct: !!session.independentOk,
      finished: true,
    };
  }

  if (session.phase === 'explain') {
    const level = session.currentSupportLevel;
    const display = session.scaffoldDisplay;
    let feedback: string;
    if (level <= 0) {
      feedback = session.independentPrompt;
    } else if (level === 5) {
      feedback = `Fast. Sag: ${session.targetItem}`;
    } else {
      feedback = display
        ? `Fast. ${display}`
        : `Fast. Versuch noch einmal.`;
    }
    // Nível 0 → direto produção independente; senão guided com ajuda mínima
    const nextPhase: MicroPhase = level <= 0 ? 'independent' : 'guided';
    return {
      session: withStep(
        { ...session, visualState: 'PRACTICING' },
        nextPhase,
        'PRACTICING',
      ),
      feedback,
      correct: true,
      finished: false,
    };
  }

  if (session.phase === 'guided') {
    if (!utterance) {
      return {
        session: { ...session, visualState: 'LISTENING' },
        feedback: session.scaffoldDisplay || session.independentPrompt,
        correct: false,
        finished: false,
      };
    }
    const evaluating: MicroPracticeSession = {
      ...session,
      visualState: 'EVALUATING',
      attempts: session.attempts + 1,
      guidedAttempts: session.guidedAttempts + 1,
    };
    const ok = scoreAgainstTarget(utterance, session.targetItem);

    if (ok) {
      // Acerto com ajuda → próxima tentativa com menos suporte
      const faded = recordHelpAttempt(session.phraseId, session.currentSupportLevel, true, {
        helpRequested: session.helpRequested,
        sessionId: session.sessionId || session.originSessionId,
      });
      const nextLevel = faded.nextInSession;
      const nextSession = applySupport(
        { ...evaluating, helpUsed: session.currentSupportLevel > 0 },
        nextLevel,
      );
      return {
        session: withStep(nextSession, 'independent', 'PRACTICING'),
        feedback: `Gut! ${session.independentPrompt}`,
        correct: true,
        finished: false,
        supportDecision: faded.decision,
      };
    }

    if (evaluating.attempts >= evaluating.maxAttempts) {
      return finish(
        evaluating,
        'NEEDS_REVIEW',
        'Vamos revisar isso novamente mais tarde.',
        false,
      );
    }

    // Erro → sobe ajuda (mínimo necessário), não salta para 5
    const raised = escalateSupport(session.currentSupportLevel);
    const withMore = applySupport(evaluating, raised);
    return {
      session: { ...withMore, visualState: 'PRACTICING' },
      feedback: raised >= 5
        ? `Fast! Sag: ${session.targetItem}`
        : `Fast. ${withMore.scaffoldDisplay || 'Noch einmal.'}`,
      correct: false,
      finished: false,
      supportDecision: 'increaseSupport',
    };
  }

  if (session.phase === 'independent') {
    if (!utterance) {
      return {
        session: { ...session, visualState: 'LISTENING' },
        feedback: session.independentPrompt,
        correct: false,
        finished: false,
      };
    }
    const evaluating: MicroPracticeSession = {
      ...session,
      visualState: 'EVALUATING',
      attempts: session.attempts + 1,
    };
    const ok = scoreAgainstTarget(utterance, session.targetItem);

    if (ok) {
      return finish(evaluating, 'SUCCESS', 'Muito melhor! Voltando à conversa…', true);
    }

    if (evaluating.attempts >= evaluating.maxAttempts || isMicroExpired(evaluating)) {
      return finish(
        evaluating,
        'NEEDS_REVIEW',
        'Vamos revisar isso novamente mais tarde.',
        false,
      );
    }

    // Falha na produção independente → volta a guided com um pouco mais de ajuda
    const raised = escalateSupport(Math.max(1, session.currentSupportLevel) as SupportLevel);
    const withMore = applySupport(
      { ...evaluating, helpUsed: true, guidedAttempts: evaluating.guidedAttempts + 1 },
      raised,
    );
    return {
      session: withStep(withMore, 'guided', 'PRACTICING'),
      feedback: `Noch einmal. ${withMore.scaffoldDisplay || withMore.guidedHint}`,
      correct: false,
      finished: false,
      supportDecision: 'increaseSupport',
    };
  }

  return finish(session, session.independentOk ? 'SUCCESS' : 'FAILED', 'Microtreino concluído.', !!session.independentOk);
}

/** Marca RETURNING antes do Orchestrator retomar a conversa. */
export function markMicroReturning(session: MicroPracticeSession): MicroPracticeSession {
  return { ...session, visualState: 'RETURNING' };
}

export function microDurationLabel(sec: MicroDurationSec): string {
  if (sec === 30) return '30 s';
  if (sec === 60) return '1 min';
  if (sec === 120) return '2 min';
  return '5 min';
}

/** Nudge curto — Gemini verbaliza só o nível pedagógico atual. */
export function buildMicroStartNudge(session: MicroPracticeSession): string {
  const level = session.currentSupportLevel;
  return [
    '[INSTRUÇÃO INTERNA — não leia isto em voz alta]',
    'O app abriu um microtreino curto. Diga APENAS, bem curto:',
    `"Fast. Let's fix one small thing."`,
    scaffoldingDirective(level, session.targetItem),
    level >= 5
      ? `Pode modelar uma vez: "${session.targetItem}" e depois "Sprich es nach."`
      : level >= 1
        ? `Verbalize só a ajuda deste nível: "${session.scaffoldDisplay || session.guidedHint}". NÃO diga a frase completa.`
        : `Faça a pergunta: "${session.independentPrompt}". Sem pista.`,
    'NÃO explique gramática. NÃO continue a conversa. FIQUE em silêncio até o app retomar.',
  ].join('\n');
}

/** Nudge ao voltar à conversa — nova oportunidade, não repetir a frase-modelo. */
export function buildMicroResumeNudge(session: MicroPracticeSession): string {
  const prompt = session.returnPrompt || 'Also, weiter.';
  if (session.result === 'SUCCESS' || session.independentOk) {
    return [
      '[INSTRUÇÃO INTERNA — não leia isto em voz alta]',
      'O microtreino terminou com sucesso. VOLTE à conversa naturalmente.',
      `Sua próxima fala em áudio deve ser (nova oportunidade de produção — NÃO repita a frase-modelo completa):`,
      `"${prompt}"`,
      'Não diga "fim do exercício". Pareça conversa.',
    ].join('\n');
  }
  return [
    '[INSTRUÇÃO INTERNA — não leia isto em voz alta]',
    'O microtreino terminou. O aluno ainda precisa revisar depois. VOLTE à conversa com leveza.',
    `Sua próxima fala em áudio deve ser:`,
    `"${prompt}"`,
    'Não critique. Continue o tema.',
  ].join('\n');
}
