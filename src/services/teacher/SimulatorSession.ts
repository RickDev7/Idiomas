/**
 * Rastreamento da sessão de simulação — métricas reais, sem banco paralelo.
 */
import { zeroLanguageSeedPhrases } from '@/services/teacher/ZeroLanguageMode';
import type {
  SimulatorContext,
  SimulatorResult,
  SimulatorTurnKind,
  SimulatorTurnRecord,
} from '@/services/teacher/SimulatorTypes';

const SESSION_KEY = 'dt_simulator_session';

type ActiveSession = {
  startedAt: number;
  endsAt: number;
  context: SimulatorContext;
  opportunities: number;
  turns: SimulatorTurnRecord[];
  deferredIds: string[];
  contentsUsed: Set<string>;
  needsPractice: Map<string, string>;
};

let memorySession: ActiveSession | null = null;

function resolveGerman(phraseId: string | null, fallback: string): string {
  if (!phraseId) return fallback;
  const hit = zeroLanguageSeedPhrases().find((p) => p.id === phraseId);
  return hit?.german || fallback;
}

export function startSimulatorSession(ctx: SimulatorContext): void {
  memorySession = {
    startedAt: Date.now(),
    endsAt: ctx.endsAt,
    context: ctx,
    opportunities: 0,
    turns: [],
    deferredIds: [],
    contentsUsed: new Set(),
    needsPractice: new Map(),
  };
  if (typeof sessionStorage !== 'undefined') {
    try {
      sessionStorage.setItem(
        SESSION_KEY,
        JSON.stringify({
          startedAt: memorySession.startedAt,
          endsAt: memorySession.endsAt,
          context: ctx,
          opportunities: 0,
          turns: [],
          deferredIds: [],
          contentsUsed: [],
          needsPractice: [],
        }),
      );
    } catch {
      /* ignore */
    }
  }
}

export function getSimulatorSession(): ActiveSession | null {
  return memorySession;
}

export function isSimulatorActive(): boolean {
  return memorySession !== null;
}

export function isSimulatorTimeUp(now = Date.now()): boolean {
  if (!memorySession) return false;
  return now >= memorySession.endsAt;
}

export function getSimulatorElapsedLabel(now = Date.now()): string {
  if (!memorySession) return '00:00';
  const sec = Math.max(0, Math.floor((now - memorySession.startedAt) / 1000));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function recordSimulatorOpportunity(): void {
  if (!memorySession) return;
  memorySession.opportunities += 1;
}

export function recordSimulatorTurn(input: {
  phraseId: string | null;
  german: string;
  correct: boolean;
  withHint: boolean;
  withHelp: boolean;
  repeated: boolean;
}): void {
  if (!memorySession) return;

  let kind: SimulatorTurnKind = 'fully_independent';
  if (input.repeated) kind = 'repeated';
  else if (input.withHelp) kind = 'with_hint';
  else if (input.withHint) kind = 'with_model';
  else if (!input.correct) kind = 'partial_independent';
  else kind = 'fully_independent';

  const german = input.german.trim() || resolveGerman(input.phraseId, '');
  if (german) memorySession.contentsUsed.add(german);

  memorySession.turns.push({
    phraseId: input.phraseId,
    german,
    correct: input.correct,
    kind,
    at: new Date().toISOString(),
  });

  if (!input.correct && german) {
    memorySession.needsPractice.set(input.phraseId || german, german);
  }
}

export function recordSimulatorDeferred(phraseId: string): void {
  if (!memorySession) return;
  if (!memorySession.deferredIds.includes(phraseId)) {
    memorySession.deferredIds.push(phraseId);
  }
  const german = resolveGerman(phraseId, phraseId);
  memorySession.needsPractice.set(phraseId, german);
}

export function finalizeSimulatorSession(): SimulatorResult | null {
  if (!memorySession) return null;
  const ctx = memorySession.context;
  const elapsedMinutes = Math.max(1, Math.round((Date.now() - memorySession.startedAt) / 60_000));
  const autonomousCount = memorySession.turns.filter(
    (t) => t.correct && (t.kind === 'fully_independent' || t.kind === 'partial_independent'),
  ).length;
  const helpCount = memorySession.turns.filter(
    (t) => t.kind === 'with_hint' || t.kind === 'with_model',
  ).length;
  const correctionCount = memorySession.turns.filter((t) => !t.correct).length;

  const result: SimulatorResult = {
    mode: ctx.simulatorMode,
    trainingStyle: ctx.trainingStyle,
    durationMinutes: ctx.durationMinutes,
    scenario: ctx.scenario,
    elapsedMinutes,
    speechOpportunities: memorySession.opportunities,
    responsesProduced: memorySession.turns.length,
    autonomousCount,
    helpCount,
    correctionCount,
    contentsUsed: [...memorySession.contentsUsed],
    needsPractice: [...memorySession.needsPractice.entries()].map(([phraseId, german]) => ({
      phraseId,
      german,
    })),
    deferredToReview: memorySession.deferredIds.map((id) => ({
      phraseId: id,
      german: resolveGerman(id, id),
    })),
    completedAt: new Date().toISOString(),
  };

  memorySession = null;
  if (typeof sessionStorage !== 'undefined') {
    try {
      sessionStorage.removeItem(SESSION_KEY);
    } catch {
      /* ignore */
    }
  }
  return result;
}

export function clearSimulatorSession(): void {
  memorySession = null;
  if (typeof sessionStorage !== 'undefined') {
    try {
      sessionStorage.removeItem(SESSION_KEY);
    } catch {
      /* ignore */
    }
  }
}
