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
  scaffoldLevel?: number;
  sessionTopic?: string;
  trainingStage?: string;
  orchestratorKickoff?: string;
  scaffoldHint?: string;
  actionReason?: string;
  automationScore?: number;
  /** Memória relevante compacta (Fase 10) — nunca o histórico inteiro. */
  coachContext?: string;
}

interface LiveHandlers {
  onStateChange?: (state: LiveSessionState) => void;
  onAudio?: (base64Pcm: string, mimeType?: string) => void;
  onTranscript?: (role: 'user' | 'assistant', text: string, meta?: { delta?: string; complete?: boolean }) => void;
  onTurnComplete?: (role?: 'user' | 'assistant', text?: string) => void;
  onInterrupted?: (text?: string) => void;
  onError?: (message: string) => void;
}

const TOKEN_TTL_MS = 4 * 60 * 1000;

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

  constructor(profile: LiveProfile, handlers: LiveHandlers, backendUrl?: string) {
    this.profile = profile;
    this.handlers = handlers;
    this.backendUrl = backendUrl || (import.meta.env.VITE_BACKEND_URL as string) || 'http://localhost:8787';
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

  async connect(): Promise<void> {
    this.closedByUser = false;
    if (this.state === 'connecting' || this.state === 'connected') return;
    this.setState('connecting');
    try {
      await this.ensureToken();
      this.openSocket();
    } catch (err) {
      this.setState('error');
      this.handlers.onError?.('Não consegui conectar ao professor.');
    }
  }

  private async ensureToken(): Promise<void> {
    const now = Date.now();
    if (this.token && now - this.tokenIssuedAt < TOKEN_TTL_MS) return;
    const res = await fetch(`${this.backendUrl}/api/gemini/token`, {
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
    const wsUrl = this.backendUrl.replace(/^http/, 'ws') + `/api/gemini/live?token=${this.token}`;
    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      this.reconnectAttempts = 0;
    };

    this.ws.onmessage = (ev) => {
      let msg: any;
      try { msg = JSON.parse(ev.data as string); } catch { return; }
      switch (msg.type) {
        case 'ready':
          this.setState('connected');
          break;
        case 'audio':
          this.handlers.onAudio?.(msg.data, msg.mimeType);
          break;
        case 'transcript':
          this.handlers.onTranscript?.(msg.role, msg.text || '', { delta: msg.delta, complete: false });
          break;
        case 'turn_complete':
          if (msg.text && msg.role) {
            this.handlers.onTranscript?.(msg.role, msg.text, { complete: true });
          }
          this.handlers.onTurnComplete?.(msg.role || 'assistant', msg.text);
          break;
        case 'interrupted':
          this.handlers.onInterrupted?.(msg.text);
          break;
        case 'error':
          // Qualquer erro do servidor invalida o token atual — força token novo na reconexão
          this.token = null;
          this.setState('reconnecting');
          this.scheduleReconnect();
          break;
      }
    };

    this.ws.onerror = () => {
      // Erro de socket: onclose vai tratar a reconexão.
    };

    this.ws.onclose = () => {
      if (this.closedByUser) {
        this.setState('idle');
        return;
      }
      this.setState('reconnecting');
      this.scheduleReconnect();
    };
  }

  private reconnecting = false;

  private scheduleReconnect(): void {
    if (this.closedByUser) return;
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
      if (this.closedByUser) return;
      this.profile = { ...this.profile, skipKickoff: true };
      this.token = null;
      await this.ensureToken();
      this.openSocket();
    } catch {
      // tenta de novo
    } finally {
      this.reconnecting = false;
    }
  }

  async sendAudio(base64Pcm: string): Promise<void> {
    if (!this.isConnected()) return;
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
    try { this.ws?.close(); } catch {}
    this.ws = null;
    this.setState('idle');
  }
}
