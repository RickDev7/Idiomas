// Componentes de voz — tela de conversa mobile (referência visual PWA).
import { useEffect, useRef, type ReactNode } from 'react';
import {
  IconMic, IconRefresh, IconUser, IconKeyboard, IconSpeaker,
} from '@/components/ui/Icons';
import { DeutschTurboMascot } from '@/components/ui/Mascot';

function WaveBars({
  active,
  color = '#3b82f6',
  tall = false,
  mirror = false,
}: {
  active: boolean;
  color?: string;
  tall?: boolean;
  mirror?: boolean;
}) {
  const heights = tall ? [8, 16, 11, 22, 14, 20, 10, 18, 12] : [4, 8, 5, 10, 6];
  const list = mirror ? [...heights].reverse() : heights;
  return (
    <span className="inline-flex items-end gap-[3px] h-7" aria-hidden>
      {list.map((h, i) => (
        <span
          key={i}
          className={`w-[2.5px] rounded-full ${active ? 'animate-wave-bar' : ''}`}
          style={{
            height: active ? h : Math.max(3, h * 0.35),
            background: color,
            opacity: active ? 1 : 0.35,
            animationDelay: active ? `${i * 0.07}s` : undefined,
          }}
        />
      ))}
    </span>
  );
}

function IconSparkle({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 3l1.6 5.4L19 10l-5.4 1.6L12 17l-1.6-5.4L5 10l5.4-1.6L12 3Z" />
    </svg>
  );
}

/* ---------- Session title (header center) ---------- */
export function SessionProgress({ current, total }: { current: number; total: number }) {
  const safeTotal = Math.max(1, total);
  const filled = Math.min(safeTotal, Math.max(0, current));
  return (
    <p className="text-[13px] text-text-muted font-medium tracking-wide truncate px-1" aria-label={`Conversa ${filled} de ${safeTotal}`}>
      Conversa {Math.max(1, filled || 1)} de {safeTotal}
    </p>
  );
}

/* ---------- Thin conversation progress bar ---------- */
export function ConversationProgressBar({ current, total }: { current: number; total: number }) {
  const pct = Math.max(4, Math.min(100, (Math.max(0, current) / Math.max(1, total)) * 100));
  return (
    <div className="w-full h-[3px] rounded-full overflow-hidden" style={{ background: 'rgba(148,163,184,0.18)' }} aria-hidden>
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{
          width: `${pct}%`,
          background: 'linear-gradient(90deg, #3b82f6 0%, #7c3aed 100%)',
          boxShadow: '0 0 10px rgba(59,130,246,0.45)',
        }}
      />
    </div>
  );
}

/* ---------- Sequence dots between cards ---------- */
export function SequenceDots({ current, total = 4 }: { current: number; total?: number }) {
  const n = Math.max(2, Math.min(6, total));
  const idx = Math.max(0, Math.min(n - 1, current));
  return (
    <div className="flex items-center justify-center gap-2 py-2.5" aria-hidden>
      {Array.from({ length: n }).map((_, i) => (
        <span
          key={i}
          className="rounded-full transition-all duration-300"
          style={{
            width: i === idx ? 8 : 6,
            height: i === idx ? 8 : 6,
            background: i === idx ? '#a78bfa' : 'rgba(148,163,184,0.28)',
            boxShadow: i === idx ? '0 0 10px rgba(167,139,250,0.7)' : undefined,
          }}
        />
      ))}
    </div>
  );
}

/* ---------- TeacherCard ---------- */
export interface TeacherCardProps {
  orbState: 'idle' | 'listening' | 'processing' | 'speaking' | 'error';
  statusText: string;
  /** Título grande: Diga "Hallo". */
  promptTitle: string;
  /** Subtítulo PT curto. */
  promptSubtitle?: string;
  onRepeat: () => void;
}

export function TeacherCard({
  orbState, statusText, promptTitle, promptSubtitle, onRepeat,
}: TeacherCardProps) {
  const speaking = orbState === 'speaking';
  const listening = orbState === 'listening';
  const processing = orbState === 'processing';
  const readyLabel = speaking ? statusText
    : listening ? statusText
      : processing ? statusText
        : statusText || 'Pronto';

  return (
    <section
      className="rounded-[22px] p-4 animate-fade-in"
      style={{
        background: 'linear-gradient(165deg, rgba(22,34,56,0.98) 0%, rgba(12,22,40,0.96) 100%)',
        border: '1px solid rgba(148,163,184,0.16)',
        boxShadow: 'var(--shadow-md), inset 0 1px 0 rgba(255,255,255,0.04)',
      }}
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2.5 mb-3">
            <DeutschTurboMascot
              size="small"
              state={
                speaking ? 'speaking'
                  : listening ? 'listening'
                    : processing ? 'thinking'
                      : 'teacher'
              }
              className="shrink-0"
            />
            <div className="min-w-0">
              <p className="text-[13px] text-text font-bold leading-tight tracking-[0.04em]">DEUTSCH COACH</p>
              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                <span
                  className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold"
                  style={{ background: 'var(--chip-purple-bg)', color: 'var(--chip-purple-fg)' }}
                >
                  Professor
                </span>
                <span className="text-[11px] text-text-muted inline-flex items-center gap-1">
                  <span aria-hidden>{speaking ? '🔊' : '✨'}</span>
                  {readyLabel}
                </span>
              </div>
            </div>
          </div>

          <p
            className="text-[1.35rem] font-bold text-text leading-snug pr-1"
            style={{ overflowWrap: 'anywhere' }}
          >
            {promptTitle || (processing ? '…' : 'Aguardando o professor…')}
          </p>
          {promptSubtitle ? (
            <p className="mt-1.5 text-[13px] text-text-muted leading-snug" style={{ overflowWrap: 'anywhere' }}>
              {promptSubtitle}
            </p>
          ) : null}
        </div>

        <button
          type="button"
          onClick={onRepeat}
          aria-label="Ouvir frase"
          className="shrink-0 w-11 h-11 rounded-full flex items-center justify-center mt-1 active:scale-95 transition-transform"
          style={{
            background: 'linear-gradient(145deg, #3b82f6 0%, #2563eb 100%)',
            boxShadow: '0 6px 18px rgba(59,130,246,0.35)',
          }}
        >
          <span className="text-white"><IconSpeaker size={18} /></span>
        </button>
      </div>
    </section>
  );
}

/* ---------- StudentResponseCard ---------- */
export interface StudentResponseCardProps {
  text: string;
  status: 'processing' | 'received' | 'none';
  feedback?: string | null;
  feedbackTone?: 'success' | 'adjust' | 'neutral';
  onReplay?: () => void;
}

export function StudentResponseCard({ text, status, feedback, feedbackTone = 'success', onReplay }: StudentResponseCardProps) {
  if (!text) return null;
  const toneColor =
    feedbackTone === 'adjust' ? '#fbbf24'
      : feedbackTone === 'neutral' ? '#94a3b8'
        : '#34d399';
  return (
    <section
      className="rounded-[22px] p-4 animate-fade-in"
      style={{
        background: 'linear-gradient(135deg, rgba(59,130,246,0.10) 0%, rgba(15,26,46,0.92) 100%)',
        border: '1px solid rgba(148,163,184,0.14)',
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] inline-flex items-center gap-1.5 font-semibold tracking-[0.12em]" style={{ color: '#60a5fa' }}>
            <IconUser size={13} /> VOCÊ DISSE
          </p>
          <p
            className="mt-2 text-[1.25rem] text-text font-bold leading-snug"
            style={{ overflowWrap: 'anywhere' }}
          >
            {text}
          </p>
          {status === 'processing' && (
            <p className="text-[12px] mt-2.5 inline-flex items-center gap-1.5 text-primary">
              Entendi. Estou verificando…
              <WaveBars active color="#3b82f6" />
            </p>
          )}
          {status === 'received' && feedback && (
            <p className="text-[13px] mt-2.5 inline-flex items-start gap-1.5 font-medium leading-snug" style={{ color: toneColor }}>
              <IconSparkle size={14} /> <span>{feedback}</span>
            </p>
          )}
        </div>
        {onReplay && (
          <button
            type="button"
            onClick={onReplay}
            aria-label="Ouvir sua fala"
            className="shrink-0 w-11 h-11 rounded-full flex items-center justify-center active:scale-95"
            style={{
              background: 'linear-gradient(145deg, #3b82f6 0%, #2563eb 100%)',
              boxShadow: '0 6px 18px rgba(59,130,246,0.3)',
            }}
          >
            <span className="text-white"><IconSpeaker size={16} /></span>
          </button>
        )}
      </div>
    </section>
  );
}

/* ---------- ActionGrid (3 help cards) ---------- */
export interface ActionItem {
  icon: ReactNode;
  label: string;
  sub?: string;
  onClick: () => void;
  active?: boolean;
  color?: string;
}

export function ActionGrid({ items }: { items: ActionItem[] }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {items.map((a) => (
        <button
          key={a.label}
          type="button"
          onClick={a.onClick}
          className="flex flex-col items-center justify-center gap-1 py-2.5 px-1 rounded-[18px] transition-all min-h-[68px] active:scale-95 dt-glass"
          aria-label={a.label}
        >
          <span
            className="w-9 h-9 rounded-full flex items-center justify-center"
            style={{ background: `${a.color || '#3b82f6'}22`, color: a.color || '#3b82f6' }}
            aria-hidden
          >
            {a.icon}
          </span>
          <span className="text-[12px] font-semibold leading-tight text-center text-text">{a.label}</span>
          {a.sub && <span className="text-[10px] text-text-faint leading-tight text-center px-0.5 line-clamp-1">{a.sub}</span>}
        </button>
      ))}
    </div>
  );
}

/* ---------- VoiceArea ---------- */
export interface VoiceAreaProps {
  micActive: boolean;
  micLevel: number;
  statusLabel: string;
  statusHint?: string;
  onMic: () => void;
  disabled: boolean;
  noSignal: boolean;
  onPickMic: () => void;
  textMode: boolean;
  textValue: string;
  onTextChange: (v: string) => void;
  onTextSubmit: () => void;
  onToggleText: () => void;
}

export function VoiceArea({
  micActive, micLevel, statusLabel, statusHint, onMic, disabled, noSignal, onPickMic,
  textMode, textValue, onTextChange, onTextSubmit, onToggleText,
}: VoiceAreaProps) {
  const levelBoost = Math.min(1, Math.max(0, micLevel * 4));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!textMode) return;
    const id = window.setTimeout(() => {
      inputRef.current?.focus();
    }, 80);
    return () => window.clearTimeout(id);
  }, [textMode]);

  return (
    <div
      className="flex flex-col items-center pt-1 shrink-0 px-3"
      style={{ paddingBottom: 'calc(0.5rem + env(safe-area-inset-bottom, 0px) + var(--keyboard-inset, 0px))' }}
    >
      <div className="relative flex items-center justify-center gap-2 w-full">
        <WaveBars active={micActive} color="#a78bfa" tall mirror />
        <span className="relative w-[100px] h-[100px] flex items-center justify-center">
          <span
            className="absolute inset-[-6px] rounded-full"
            style={{
              border: '1px solid rgba(59,130,246,0.18)',
              transform: micActive ? `scale(${1.02 + levelBoost * 0.06})` : 'scale(1)',
              transition: 'transform 120ms ease-out',
            }}
          />
          <span
            className="absolute inset-[-14px] rounded-full"
            style={{ border: '1px solid rgba(124,58,237,0.12)' }}
          />
          <span
            className="absolute inset-0 rounded-full"
            style={{
              background: 'radial-gradient(circle, rgba(59,130,246,0.32) 0%, rgba(124,58,237,0.18) 45%, transparent 70%)',
              transform: micActive ? `scale(${1.06 + levelBoost * 0.1})` : 'scale(1)',
              transition: 'transform 120ms ease-out',
            }}
          />
          <button
            type="button"
            onClick={onMic}
            disabled={disabled}
            aria-label={micActive ? 'Parar microfone' : 'Falar'}
            className="relative w-[84px] h-[84px] rounded-full flex items-center justify-center transition-transform duration-200 active:scale-95 disabled:opacity-50"
            style={{
              background: 'linear-gradient(160deg, #60a5fa 0%, #3b82f6 42%, #7c3aed 100%)',
              boxShadow: micActive
                ? '0 0 0 5px rgba(59,130,246,0.18), 0 14px 36px rgba(124,58,237,0.5)'
                : '0 10px 32px rgba(59,130,246,0.4)',
            }}
          >
            {micActive && (
              <>
                <span className="absolute w-[108px] h-[108px] rounded-full bg-primary/15 animate-pulse-ring" />
                <span className="absolute w-[96px] h-[96px] rounded-full bg-purple/15 animate-pulse-ring" style={{ animationDelay: '0.45s' }} />
              </>
            )}
            <span className="relative text-white"><IconMic size={30} /></span>
          </button>
        </span>
        <WaveBars active={micActive} color="#60a5fa" tall />
      </div>

      <p className="text-[14px] text-text font-semibold mt-3 min-h-5 text-center px-2 inline-flex items-center gap-1.5">
        {micActive && <span className="w-1.5 h-1.5 rounded-full bg-success" aria-hidden />}
        {statusLabel}
      </p>
      {statusHint && <p className="text-[11px] text-text-faint mt-0.5 text-center px-2">{statusHint}</p>}

      {micActive && noSignal && (
        <button type="button" onClick={onPickMic} className="text-[12px] mt-1.5 min-h-10 text-warning">
          Sem sinal de áudio · Escolher microfone
        </button>
      )}

      {!textMode ? (
        <button
          type="button"
          onClick={onToggleText}
          className="mt-3 w-full flex items-center gap-3 px-3 py-2.5 rounded-[16px] dt-glass active:scale-[0.99] transition-transform"
          aria-label="Digitar resposta"
        >
          <span className="w-9 h-9 rounded-xl flex items-center justify-center bg-primary/15 text-primary shrink-0">
            <IconKeyboard size={16} />
          </span>
          <span className="flex-1 text-left min-w-0">
            <span className="block text-[13px] font-semibold text-text leading-tight">Digitar resposta</span>
            <span className="block text-[11px] text-text-faint leading-tight">Por texto</span>
          </span>
          <span className="text-text-faint text-lg leading-none" aria-hidden>›</span>
        </button>
      ) : (
        <form
          onSubmit={(e) => { e.preventDefault(); onTextSubmit(); }}
          className="mt-3 w-full flex gap-2 animate-fade-in"
        >
          <input
            ref={inputRef}
            value={textValue}
            onChange={(e) => onTextChange(e.target.value)}
            placeholder="Escreva em alemão…"
            className="flex-1 bg-surface-light text-text text-sm rounded-[16px] px-3 py-2.5 border border-border focus:outline-none focus:border-primary/50 min-h-11"
            aria-label="Digitar resposta"
            enterKeyHint="send"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
          />
          <button type="submit" className="px-4 py-2.5 rounded-[16px] bg-primary text-white text-sm font-semibold min-h-11 shrink-0">
            Enviar
          </button>
          <button type="button" onClick={onToggleText} className="px-3 py-2.5 rounded-[16px] text-text-muted text-sm min-h-11 shrink-0">
            ✕
          </button>
        </form>
      )}
    </div>
  );
}

/* ---------- Legacy exports still used elsewhere ---------- */
export function VoiceStatus({ phase, speaking }: { phase: string; speaking?: boolean }) {
  const icon = phase === 'listening' ? '🎤' : phase === 'grading' ? '🤔' : speaking ? '🔊' : '💬';
  return (
    <p className="text-secondary text-text-muted inline-flex items-center gap-2">
      <span aria-hidden>{icon}</span> {phase}
    </p>
  );
}

export interface TranslationPanelProps {
  german: string;
  portuguese?: string;
  visible: boolean;
  loading?: boolean;
  onToggle: () => void;
  mode: 'always' | 'ondemand' | 'immersion';
}

export function TranslationPanel({ german, portuguese, visible, loading, onToggle, mode }: TranslationPanelProps) {
  return (
    <div className="w-full">
      <p className="text-display font-semibold animate-fade-in w-full" style={{ whiteSpace: 'normal', overflowWrap: 'anywhere', lineHeight: 1.25 }}>
        {german}
      </p>
      {visible && portuguese && (
        <p className="mt-2 text-h2 text-text-muted font-medium">🇧🇷 {portuguese}</p>
      )}
      {visible && loading && !portuguese && (
        <p className="mt-2 text-h2 text-text-faint">Traduzindo…</p>
      )}
      <div className="mt-3">
        <button onClick={onToggle} className="inline-flex items-center gap-1.5 text-caption text-text-faint min-h-11 px-2">
          {mode === 'immersion' ? '🇧🇷' : '👁'} {visible ? 'Ocultar' : 'Mostrar'} significado
        </button>
      </div>
    </div>
  );
}

export interface AnswerSupportProps {
  hint?: string;
  expected?: string;
  helpLevel: number;
  onHear?: (text: string) => void;
}

export function AnswerSupportPanel({ hint, expected, helpLevel, onHear }: AnswerSupportProps) {
  if (helpLevel <= 0 && !hint) return null;
  const words = expected ? expected.replace(/\.$/, '').split(/\s+/).filter(Boolean) : [];
  const first = words[0] || '';
  const half = Math.max(1, Math.ceil(words.length / 2));
  const partial = words.slice(0, half).join(' ');
  const showFull = helpLevel >= 5;
  const showPartial = helpLevel === 4;
  const showFirst = helpLevel === 3;
  return (
    <div className="w-full mt-4 p-4 rounded-[var(--radius-lg)] bg-surface border border-border/60">
      <p className="text-eyebrow text-text-faint mb-2">💡 Você pode responder</p>
      {showFull && expected ? (
        <>
          <p className="text-h2 text-text font-medium">{expected}</p>
          {onHear && (
            <button onClick={() => onHear(expected)} className="mt-2 inline-flex items-center gap-1.5 text-secondary text-primary min-h-11">
              Ouvir
            </button>
          )}
        </>
      ) : showPartial && partial ? (
        <p className="text-h2 text-text-muted font-medium">{partial}…</p>
      ) : showFirst && first ? (
        <p className="text-h2 text-text-muted font-medium">{first}…</p>
      ) : (
        <p className="text-secondary text-text-muted">{hint || 'Pense na situação.'}</p>
      )}
    </div>
  );
}

export interface CorrectionPanelProps {
  userSaid?: string;
  correct?: string;
  portuguese?: string;
  onRetry?: () => void;
  onDismiss?: () => void;
}

export function CorrectionPanel({ userSaid, correct, portuguese, onRetry, onDismiss }: CorrectionPanelProps) {
  if (!correct) return null;
  return (
    <div className="w-full mt-4 p-4 rounded-[var(--radius-lg)] bg-accent/8 border border-accent/30">
      <div className="flex items-start justify-between gap-3">
        <p className="text-eyebrow text-accent">Quase!</p>
        {onDismiss && <button onClick={onDismiss} className="text-text-faint text-caption min-h-11 px-1">✕</button>}
      </div>
      {userSaid && <p className="text-secondary text-text-muted mt-2">Você disse: <span className="text-text">{userSaid}</span></p>}
      <p className="text-h2 text-text font-medium mt-2">{correct}</p>
      {portuguese && <p className="text-secondary text-text-faint mt-1">🇧🇷 {portuguese}</p>}
      {onRetry && (
        <button onClick={onRetry} className="mt-3 inline-flex items-center gap-2 px-5 py-2.5 rounded-[var(--radius-md)] bg-primary text-white text-secondary font-medium min-h-11">
          <IconMic size={18} /> Tentar novamente
        </button>
      )}
    </div>
  );
}

export interface HistoryItem {
  role: 'user' | 'assistant';
  text: string;
}

export function ConversationHistory({ items, max = 4 }: { items: HistoryItem[]; max?: number }) {
  if (items.length === 0) return null;
  const recent = items.slice(-max);
  return (
    <div className="w-full space-y-1.5 mb-3">
      {recent.map((m, i) => (
        <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
          <div className={`max-w-[85%] px-3 py-2 rounded-[var(--radius-md)] text-secondary ${
            m.role === 'user' ? 'bg-primary/15 text-text' : 'bg-surface-light/60 text-text-muted'
          }`}>
            {m.text}
          </div>
        </div>
      ))}
    </div>
  );
}

export function AudioControls({ onRepeat, onSlower, speed, onSpeed }: {
  onRepeat?: () => void;
  onSlower?: () => void;
  speed: number;
  onSpeed?: (s: number) => void;
}) {
  const speeds = [0.75, 1.0, 1.25];
  return (
    <div className="flex items-center justify-center gap-2 flex-wrap">
      {onRepeat && (
        <button onClick={onRepeat} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-[var(--radius-sm)] text-caption bg-surface/60 border border-border/50 min-h-11">
          <IconRefresh size={16} /> Repetir
        </button>
      )}
      {onSlower && (
        <button onClick={onSlower} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-[var(--radius-sm)] text-caption bg-surface/60 border border-border/50 min-h-11">
          🐢 Devagar
        </button>
      )}
      {speeds.map((s) => (
        <button key={s} onClick={() => onSpeed?.(s)} className={`px-3 py-2 rounded-[var(--radius-sm)] text-caption min-h-11 ${speed === s ? 'bg-primary text-white' : 'bg-surface/60 border border-border/50'}`}>
          {s}x
        </button>
      ))}
    </div>
  );
}

export interface FeedbackCardProps {
  type: 'success' | 'error' | null;
  title?: string;
  message?: string;
  tip?: string;
  userSaid?: string;
  correction?: string;
  onRetry?: () => void;
}

export function FeedbackCard({ type, title, message, tip, userSaid, correction, onRetry }: FeedbackCardProps) {
  if (!type) return null;
  if (type === 'success') {
    return (
      <section className="mt-3 rounded-[24px] dt-glass p-4" style={{ borderLeft: '4px solid #34d399' }}>
        <p className="text-h2 text-success font-bold">{title}</p>
        {message && <p className="text-secondary text-text-muted mt-1.5">{message}</p>}
        {tip && <p className="text-secondary text-text mt-2">{tip}</p>}
      </section>
    );
  }
  return (
    <section className="mt-3 rounded-[24px] bg-accent/8 border border-accent/30 p-4">
      <p className="text-h2 text-accent font-semibold">{title || 'Quase. Vamos ajustar uma coisa.'}</p>
      {userSaid && <p className="text-secondary text-text-muted mt-2">Você disse: <span className="text-text">{userSaid}</span></p>}
      {correction && <p className="text-secondary text-text mt-1">Tente: <span className="text-text font-medium">{correction}</span></p>}
      {message && <p className="text-secondary text-text-muted mt-1.5">{message}</p>}
      {onRetry && (
        <button type="button" onClick={onRetry} className="mt-3 inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-accent text-white text-secondary font-medium min-h-11">
          <IconMic size={18} /> Tentar novamente
        </button>
      )}
    </section>
  );
}
