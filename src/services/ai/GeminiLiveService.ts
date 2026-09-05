import { resolveBackendUrl, httpBackendBase, wsBackendBase } from '@/utils/backendUrl';
import {
  isFatalLiveError,
  liveErrorUserMessage,
  normalizeLiveErrorCode,
} from '@/services/ai/liveFirstTeacherWatchdog';

export type LiveSessionState = 'idle' | 'connecting' | 'connected' | 'error' | 'reconnecting';

export interface LiveProfile {
  level?: string;
  goal?: string;
  profession?: string;
  immersionLevel?: number;
  intensiveMode?: boolean;
  helpLevel?: string;
  immersionGuidance?: string;
  intensiveGuidance?: string;
  knownPhrases?: string[];
  weakPhrases?: string[];
  memorySummary?: string;
  openingGerman?: string;
  openingStrategy?: string;
  sessionKind?: string;
  sessionKickoff?: string;
  lastTopic?: string;
  lastQuestion?: string;
  lastUserAnswer?: string;
  unfinishedGoal?: string;
  nextStep?: string;
  recentMistakes?: string[];
  skipKickoff?: boolean;
  /** Diretiva do ConversationOrchestrator (TeacherEngine → Live). */
  teacherDirective?: string;
  pedagogicalAction?: string;
  targetPhrase?: string;
  targetPhrasePt?: string;
  targetId?: string;
  scaffoldLevel?: number;
  sessionTopic?: string;
  trainingStage?: string;
  orchestratorKickoff?: string;
  /** Modos curriculares (diagnóstico / binding kickoff — backend pode ignorar). */
  a1CurriculumMode?: boolean;
  a2CurriculumMode?: boolean;
  b1CurriculumMode?: boolean;
  b2CurriculumMode?: boolean;
  c1CurriculumMode?: boolean;
  c2CurriculumMode?: boolean;
  scaffoldHint?: string;
  actionReason?: string;
  automationScore?: number;
  /** Memória relevante compacta (Fase 10) — nunca o histórico inteiro. */
  coachContext?: string;
  /** Sessão de simulador — kickoff e system instruction exclusivos de imersão. */
  simulatorMode?: boolean;
  /** Sessão de mini prova — kickoff e system instruction exclusivos de avaliação. */
  miniProvaMode?: boolean;
  /** Geração LiveSession (diagnóstico / idempotência). */
  liveSessionGeneration?: number;
}

interface LiveHandlers {
  onStateChange?: (state: LiveSessionState) => void;
  onAudio?: (base64Pcm: string, mimeType?: string) => void;
  onTranscript?: (role: 'user' | 'assistant', text: string, meta?: { delta?: string; complete?: boolean }) => void;
  onTurnComplete?: (role?: 'user' | 'assistant', text?: string) => void;
  onInterrupted?: (text?: string) => void;
  onError?: (message: string) => void;
  /**
   * Antes de abrir WS novo no reconnect: invalidar generation, limpar fila de áudio.
   * Deve rodar ANTES de ensureToken/openSocket.
   */
  onBeforeReconnect?: () => void;
}

const TOKEN_TTL_MS = 4 * 60 * 1000;
const READY_TIMEOUT_MS = 20_000;

function liveDebug(phase: string, extra?: Record<string, unknown>): void {
  // Telemetria temporária — precisa aparecer em produção.
  console.log('[LIVE_DEBUG]', phase, extra ?? {});
}

export class GeminiLiveService {
  private ws: WebSocket | null = null;
  private token: string | null = null;
  private tokenIssuedAt = 0;
  private state: LiveSessionState = 'idle';
  private profile: LiveProfile;
  private handlers: LiveHandlers;
  private backendUrl: string;
  private reconnectAttempts = 0;
  private closedByUser = false;
  private readyWaiters: Array<{ resolve: () => void; reject: (err: Error) => void }> = [];
  /** True após o 1º turno do professor (transcript/áudio/complete). */
  private heardTeacherTurn = false;
  private userPcmStarted = false;
  /** Erro fatal (quota / timeout / session_failed) — sem reconnect agressivo. */
  private fatalStop = false;

  constructor(profile: LiveProfile, handlers: LiveHandlers, backendUrl?: string) {
    this.profile = profile;
    this.handlers = handlers;
    this.backendUrl = resolveBackendUrl(backendUrl);
  }

  getState(): LiveSessionState {
    return this.state;
  }

  isConnected(): boolean {
    return this.state === 'connected' && this.ws?.readyState === WebSocket.OPEN;
  }

  private setState(s: LiveSessionState) {
    this.state = s;
    this.handlers.onStateChange?.(s);
  }

  private settleReady(err?: Error): void {
    const waiters = this.readyWaiters.splice(0);
    for (const w of waiters) {
      if (err) w.reject(err);
      else w.resolve();
    }
  }

  private waitUntilReady(timeoutMs = READY_TIMEOUT_MS): Promise<void> {
    if (this.isConnected()) return Promise.resolve();
    return new Promise((resolve, reject) => {
      let settled = false;
      const timer = globalThis.setTimeout(() => {
        if (settled) return;
        settled = true;
        reject(new Error('live_ready_timeout'));
      }, timeoutMs);
      this.readyWaiters.push({
        resolve: () => {
          if (settled) return;
          settled = true;
          globalThis.clearTimeout(timer);
          resolve();
        },
        reject: (err: Error) => {
          if (settled) return;
          settled = true;
          globalThis.clearTimeout(timer);
          reject(err);
        },
      });
    });
  }

  async connect(): Promise<void> {
    this.closedByUser = false;
    this.fatalStop = false;
    liveDebug('connect:start', { skipKickoff: !!this.profile.skipKickoff, heardTeacher: this.heardTeacherTurn });
    if (this.isConnected()) return;
    if (this.state === 'connecting' || this.state === 'reconnecting') {
      await this.waitUntilReady();
      return;
    }
    this.setState('connecting');
    try {
      await this.ensureToken();
      this.openSocket();
      await this.waitUntilReady();
      liveDebug('websocket:ready', { heardTeacher: this.heardTeacherTurn });
      liveDebug('firstTeacherTurn:waiting');
    } catch (err) {
      this.setState('error');
      this.settleReady(err instanceof Error ? err : new Error('live_connect_failed'));
      liveDebug('connect:error', { message: err instanceof Error ? err.message : String(err) });
      this.handlers.onError?.('Não consegui conectar ao professor.');
      throw err;
    }
  }

  private async ensureToken(): Promise<void> {
    const now = Date.now();
    if (this.token && now - this.tokenIssuedAt < TOKEN_TTL_MS) return;
    liveDebug('token:profile', {
      openingGerman: this.profile.openingGerman ?? null,
      targetId: this.profile.targetId ?? null,
      b1CurriculumMode: this.profile.b1CurriculumMode ?? null,
      b2CurriculumMode: this.profile.b2CurriculumMode ?? null,
      c1CurriculumMode: this.profile.c1CurriculumMode ?? null,
      c2CurriculumMode: this.profile.c2CurriculumMode ?? null,
      a2CurriculumMode: this.profile.a2CurriculumMode ?? null,
      a1CurriculumMode: this.profile.a1CurriculumMode ?? null,
      hasOrchKickoff: !!this.profile.orchestratorKickoff,
      hasSessionKickoff: !!this.profile.sessionKickoff,
    });
    const res = await fetch(`${httpBackendBase(this.backendUrl)}/api/gemini/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profile: this.profile }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || 'token_failed');
    }
    const data = (await res.json()) as { token: string };
    this.token = data.token;
    this.tokenIssuedAt = Date.now();
  }

  private openSocket() {
    // Fecha qualquer WS anterior antes de abrir um novo (evita sockets órfãos)
    if (this.ws) {
      try { this.ws.onclose = null; this.ws.onerror = null; this.ws.onmessage = null; this.ws.close(); } catch {}
      this.ws = null;
    }
    const wsUrl = `${wsBackendBase(this.backendUrl)}/api/gemini/live?token=${this.token}`;
    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      this.reconnectAttempts = 0;
      liveDebug('websocket:open');
    };

    this.ws.onmessage = (ev) => {
      let msg: any;
      try { msg = JSON.parse(ev.data as string); } catch { return; }
      // Diagnóstico temporário — não altera roteamento
      const hasAudio = typeof msg?.data === 'string' && msg.data.length > 0 && msg.type === 'audio';
      const hasText = typeof msg?.text === 'string' && msg.text.length > 0;
      liveDebug('server:event', {
        type: msg?.type || 'unknown',
        hasAudio,
        hasText,
        byteLength: typeof ev.data === 'string' ? ev.data.length : 0,
        role: msg?.role || null,
      });
      liveDebug('LIVE_TRACE:SERVER_MESSAGE', {
        messageType: msg?.type || 'unknown',
        hasAudio,
        hasText,
        byteLength: typeof ev.data === 'string' ? ev.data.length : 0,
        role: msg?.role || null,
        openingGerman: this.profile.openingGerman ?? null,
        targetId: this.profile.targetId ?? null,
        skipKickoff: !!this.profile.skipKickoff,
        heardTeacher: this.heardTeacherTurn,
      });
      switch (msg.type) {
        case 'ready':
          this.setState('connected');
          this.settleReady();
          // Kickoff é disparado pelo backend neste momento (único caminho autoritativo).
          // Nota: este log NÃO prova envio ao Gemini — só prova que o browser recebeu `ready`.
          liveDebug('websocket:ready');
          if (!this.profile.skipKickoff) {
            liveDebug('kickoff:scheduled', {
              note: 'backend_next_tick_after_setupComplete',
              skipKickoff: false,
              targetId: this.profile.targetId ?? null,
              openingGerman: this.profile.openingGerman ?? null,
              currentLevel: this.profile.level ?? null,
              sessionGeneration: this.profile.liveSessionGeneration ?? null,
            });
          }
          liveDebug('kickoff:sent', {
            note: 'backend_on_ready_assumed',
            skipKickoff: !!this.profile.skipKickoff,
            targetId: this.profile.targetId ?? null,
            currentLevel: this.profile.level ?? null,
            sessionGeneration: this.profile.liveSessionGeneration ?? null,
          });
          liveDebug('LIVE_TRACE:WS_READY', {
            openingGerman: this.profile.openingGerman ?? null,
            targetId: this.profile.targetId ?? null,
            skipKickoff: !!this.profile.skipKickoff,
          });
          break;
        case 'audio':
          if (!this.heardTeacherTurn) {
            this.heardTeacherTurn = true;
            liveDebug('firstTeacherTurn:received', {
              via: 'audio',
              targetId: this.profile.targetId ?? null,
              currentLevel: this.profile.level ?? null,
              sessionGeneration: this.profile.liveSessionGeneration ?? null,
            });
            liveDebug('teacher:audio');
          }
          this.handlers.onAudio?.(msg.data, msg.mimeType);
          break;
        case 'transcript':
          liveDebug('server:event:transcript', { role: msg.role, len: (msg.text || '').length });
          if (msg.role === 'assistant') {
            if (!this.heardTeacherTurn) {
              this.heardTeacherTurn = true;
              liveDebug('firstTeacherTurn:received', {
                via: 'transcript',
                targetId: this.profile.targetId ?? null,
                currentLevel: this.profile.level ?? null,
                sessionGeneration: this.profile.liveSessionGeneration ?? null,
              });
            }
            liveDebug('teacher:transcript', { len: (msg.text || '').length });
          }
          this.handlers.onTranscript?.(msg.role, msg.text || '', { delta: msg.delta, complete: false });
          break;
        case 'turn_complete':
          liveDebug('server:event:turn_complete', { role: msg.role || 'assistant' });
          if ((msg.role || 'assistant') === 'assistant') {
            if (!this.heardTeacherTurn) {
              this.heardTeacherTurn = true;
              liveDebug('firstTeacherTurn:received', {
                via: 'turn_complete',
                targetId: this.profile.targetId ?? null,
                currentLevel: this.profile.level ?? null,
                sessionGeneration: this.profile.liveSessionGeneration ?? null,
              });
            }
            liveDebug('teacher:turn_complete');
          }
          if (msg.text && msg.role) {
            this.handlers.onTranscript?.(msg.role, msg.text, { complete: true });
          }
          this.handlers.onTurnComplete?.(msg.role || 'assistant', msg.text);
          break;
        case 'interrupted':
          liveDebug('server:event:interrupted');
          this.handlers.onInterrupted?.(msg.text);
          break;
        case 'error': {
          const code = normalizeLiveErrorCode(msg.message);
          liveDebug('server:event:error', { message: msg.message, code });
          liveDebug('session:error', {
            code,
            targetId: this.profile.targetId ?? null,
            currentLevel: this.profile.level ?? null,
            sessionGeneration: this.profile.liveSessionGeneration ?? null,
          });
          this.token = null;
          if (isFatalLiveError(code)) {
            this.fatalStop = true;
            this.setState('error');
            this.handlers.onError?.(liveErrorUserMessage(code));
            this.settleReady(new Error(code));
            try { this.ws?.close(); } catch { /* ignore */ }
            break;
          }
          // Erros transitórios: reconectar sem loop de quota.
          this.setState('reconnecting');
          this.settleReady(new Error('live_error'));
          this.scheduleReconnect();
          break;
        }
        default:
          liveDebug('server:event:discarded', {
            type: String(msg?.type || 'unknown'),
            reason: 'unhandled_message_type',
            keys: msg && typeof msg === 'object' ? Object.keys(msg).slice(0, 12) : [],
          });
          break;
      }
    };

    this.ws.onerror = () => {
      // Erro de socket: onclose vai tratar a reconexão.
    };

    this.ws.onclose = () => {
      if (this.closedByUser || this.fatalStop) {
        if (!this.fatalStop) this.setState('idle');
        this.settleReady(new Error('live_closed'));
        return;
      }
      this.setState('reconnecting');
      this.settleReady(new Error('live_socket_closed'));
      this.scheduleReconnect();
    };
  }

  private reconnecting = false;

  private scheduleReconnect(): void {
    if (this.closedByUser || this.fatalStop) return;
    if (this.reconnecting) return;
    this.reconnecting = true;
    void this.doReconnect();
  }

  private async doReconnect(): Promise<void> {
    try {
      if (this.reconnectAttempts >= 5) {
        this.setState('error');
        this.handlers.onError?.('Não consegui reconectar. Verifique sua internet.');
        return;
      }
      this.reconnectAttempts += 1;
      const delay = Math.min(8000, 1000 * 2 ** this.reconnectAttempts);
      await new Promise((r) => setTimeout(r, delay));
      if (this.closedByUser || this.fatalStop) return;

      liveDebug('reconnect:start', { attempt: this.reconnectAttempts });
      // Invalidar generation + limpar fila de áudio ANTES do novo WS/token.
      // Impede áudio da sessão A de misturar com kickoff/áudio da sessão B.
      try {
        this.handlers.onBeforeReconnect?.();
      } catch {
        /* ignore */
      }
      liveDebug('reconnect:invalidate');

      // Fecha WS antigo explicitamente (openSocket também faz, mas garante ordem).
      if (this.ws) {
        try {
          this.ws.onclose = null;
          this.ws.onerror = null;
          this.ws.onmessage = null;
          this.ws.close();
        } catch {
          /* ignore */
        }
        this.ws = null;
      }

      // Só pular kickoff se o professor JÁ falou. Caso contrário o reconnect
      // fica sem primeiro turno e a UI trava em "Aguardando o professor".
      const skipKickoff = this.heardTeacherTurn;
      this.profile = { ...this.profile, skipKickoff };
      liveDebug('reconnect:token', { skipKickoff, heardTeacher: this.heardTeacherTurn, attempt: this.reconnectAttempts });
      this.token = null;
      await this.ensureToken();
      this.openSocket();
      await this.waitUntilReady();
      liveDebug('reconnect:ready', { skipKickoff });
      if (!skipKickoff) liveDebug('firstTeacherTurn:waiting');
    } catch (err) {
      liveDebug('reconnect:fail', { message: err instanceof Error ? err.message : String(err) });
      this.reconnecting = false;
      this.scheduleReconnect();
      return;
    } finally {
      this.reconnecting = false;
    }
  }

  async sendAudio(base64Pcm: string): Promise<void> {
    if (!this.isConnected()) return;
    if (!this.userPcmStarted) {
      this.userPcmStarted = true;
      liveDebug('pcm:user:start', { heardTeacher: this.heardTeacherTurn });
    }
    this.ws?.send(JSON.stringify({ type: 'audio', data: base64Pcm }));
  }

  async sendText(text: string): Promise<void> {
    if (!this.isConnected()) return;
    this.ws?.send(JSON.stringify({ type: 'text', text }));
  }

  interrupt(): void {
    if (!this.isConnected()) return;
    this.ws?.send(JSON.stringify({ type: 'interrupt' }));
  }

  resume(): void {
    if (this.state === 'error' || this.state === 'idle') {
      void this.connect();
    }
  }

  disconnect(): void {
    this.closedByUser = true;
    this.settleReady(new Error('live_closed'));
    try { this.ws?.close(); } catch {}
    this.ws = null;
    this.setState('idle');
  }
}
