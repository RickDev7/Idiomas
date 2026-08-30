/* Parser de transcrição Gemini Live: deltas vs snapshots, sem duplicar nem perder texto. */

export type TranscriptRole = 'user' | 'assistant';
export type TurnStatus = 'IDLE' | 'RECEIVING' | 'PROCESSING' | 'COMPLETE' | 'ERROR';

export interface SpeakerTurn {
  id: string;
  role: TranscriptRole;
  text: string;
  status: TurnStatus;
  startedAt: string;
  completedAt: string | null;
}

export interface ParsedLiveEvent {
  role?: TranscriptRole;
  delta?: string;
  text?: string;
  turnComplete?: boolean;
  interrupted?: boolean;
  hasAudio?: boolean;
  hasTextPart?: boolean;
  partsCount?: number;
}

const DEV = typeof import.meta !== 'undefined' && !!(import.meta as { env?: { DEV?: boolean } }).env?.DEV;

export function mergeTranscript(previous: string, incoming: string): string {
  const a = previous ?? '';
  const b = incoming ?? '';
  if (!b) return a;
  if (!a) return b;
  if (b === a) return a;
  if (b.startsWith(a)) return b;
  if (a.startsWith(b)) return a;
  if (a.endsWith(b)) return a;
  const max = Math.min(a.length, b.length);
  for (let n = max; n > 0; n--) {
    if (a.slice(-n) === b.slice(0, n)) return a + b.slice(n);
  }
  const aTrim = a.trimEnd();
  const bTrim = b.trimStart();
  if (bTrim.startsWith(aTrim)) return b;
  return a + b;
}

export function createTurnId(role: TranscriptRole): string {
  return `${role}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export function createEmptyTurn(role: TranscriptRole): SpeakerTurn {
  return {
    id: createTurnId(role),
    role,
    text: '',
    status: 'IDLE',
    startedAt: new Date().toISOString(),
    completedAt: null,
  };
}

export class GeminiTurnAccumulator {
  assistant: SpeakerTurn = createEmptyTurn('assistant');
  user: SpeakerTurn = createEmptyTurn('user');

  applyChunk(role: TranscriptRole, incoming: string): SpeakerTurn {
    if (!incoming) return role === 'assistant' ? this.assistant : this.user;
    if (role === 'assistant') {
      if (this.user.status === 'RECEIVING' && this.user.text) this.complete('user');
      if (this.assistant.status === 'COMPLETE' || this.assistant.status === 'IDLE') {
        this.assistant = createEmptyTurn('assistant');
      }
      this.assistant.text = mergeTranscript(this.assistant.text, incoming);
      this.assistant.status = 'RECEIVING';
      debug('GEMINI TEXT CHUNK', incoming.slice(0, 80));
      debug('GEMINI TEXT ACCUMULATED', this.assistant.text.slice(0, 200));
      return this.assistant;
    }
    if (this.user.status === 'COMPLETE' || this.user.status === 'IDLE') {
      this.user = createEmptyTurn('user');
    }
    this.user.text = mergeTranscript(this.user.text, incoming);
    this.user.status = 'RECEIVING';
    return this.user;
  }

  complete(role: TranscriptRole): SpeakerTurn {
    const turn = role === 'assistant' ? this.assistant : this.user;
    if (!turn.text && turn.status === 'IDLE') return turn;
    turn.status = 'COMPLETE';
    turn.completedAt = new Date().toISOString();
    if (role === 'assistant') debug('GEMINI TURN COMPLETE', turn.text.slice(0, 200));
    return turn;
  }

  interruptAssistant(): SpeakerTurn {
    if (this.assistant.text) this.complete('assistant');
    return this.assistant;
  }
}

export function summarizeLiveEvent(e: {
  setupComplete?: boolean;
  serverContent?: {
    turnComplete?: boolean;
    interrupted?: boolean;
    generationComplete?: boolean;
    modelTurn?: { parts?: Array<{ text?: string; inlineData?: unknown }> };
    inputTranscription?: { text?: string; finished?: boolean };
    outputTranscription?: { text?: string; finished?: boolean };
  };
}): Record<string, unknown> {
  const sc = e.serverContent;
  const parts = sc?.modelTurn?.parts ?? [];
  return {
    setupComplete: !!e.setupComplete,
    turnComplete: !!sc?.turnComplete,
    interrupted: !!sc?.interrupted,
    generationComplete: !!sc?.generationComplete,
    partsCount: parts.length,
    hasTextPart: parts.some((p) => typeof p.text === 'string' && p.text.length > 0),
    hasAudio: parts.some((p) => !!p.inlineData),
    inTxLen: (sc?.inputTranscription?.text || '').length,
    outTxLen: (sc?.outputTranscription?.text || '').length,
    inFinished: !!sc?.inputTranscription?.finished,
    outFinished: !!sc?.outputTranscription?.finished,
  };
}

function debug(label: string, value: unknown) {
  if (!DEV) return;
  try {
    console.log(`[${label}]`, value);
  } catch {
    /* ignore */
  }
}
