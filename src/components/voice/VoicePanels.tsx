// Componentes de voz reutilizáveis para a experiência de conversa.
// RICA + ORGANIZADA: frase, tradução persistente, resposta guiada, correção, histórico.
import { useEffect, useRef, type ReactNode } from 'react';
import type { TranslationStatus } from '@/services/ai/TranslationService';
import {
  IconEar, IconMic, IconRefresh, IconUser, IconHelp, IconKeyboard, IconSpeaker,
} from '@/components/ui/Icons';
import { DeutschTurboMascot } from '@/components/ui/Mascot';

/* ---------- VoiceStatus ---------- */
export function VoiceStatus({ phase, speaking }: { phase: string; speaking?: boolean }) {
  const icon = phase === 'listening' ? '🎤' : phase === 'grading' ? '🤔' : speaking ? '🔊' : '💬';
  return (
    <p className="text-secondary text-text-muted inline-flex items-center gap-2">
      <span aria-hidden>{icon}</span> {phase}
    </p>
  );
}

/* ---------- TranslationPanel ---------- */
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
      {/* Frase alemã — destaque principal, sempre completa */}
      <p className="text-display font-semibold animate-fade-in w-full" style={{ whiteSpace: 'normal', overflowWrap: 'anywhere', wordBreak: 'break-word', lineHeight: 1.25 }} aria-label="Frase em alemão">
        {german}
      </p>

      {visible && portuguese && (
        <p className="mt-2 text-h2 text-text-muted font-medium animate-fade-soft" style={{ whiteSpace: 'normal', overflowWrap: 'anywhere' }} aria-label="Tradução">
          🇧🇷 {portuguese}
        </p>
      )}
      {visible && loading && !portuguese && (
        <p className="mt-2 text-h2 text-text-faint animate-fade-soft">Traduzindo…</p>
      )}

      {/* Controle de tradução */}
      <div className="mt-3">
        {mode === 'immersion' ? (
          <button
            onClick={onToggle}
            className="inline-flex items-center gap-1.5 text-caption text-text-faint hover:text-text-muted transition-colors min-h-11 px-2"
          >
            🇧🇷 {visible ? 'Ocultar significado' : 'Mostrar significado'}
          </button>
        ) : (
          <button
            onClick={onToggle}
            className="inline-flex items-center gap-1.5 text-caption text-text-faint hover:text-text-muted transition-colors min-h-11 px-2"
          >
            👁 {visible ? 'Ocultar tradução' : 'Mostrar tradução'}
          </button>
        )}
      </div>
    </div>
  );
}

/* ---------- AnswerSupportPanel ---------- */
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
  // 0=sem · 1=contexto(hint) · 2=pista · 3=1ª palavra · 4=parcial · 5=completa
  const showFull = helpLevel >= 5;
  const showPartial = helpLevel === 4;
  const showFirst = helpLevel === 3;
  const showHintOnly = helpLevel === 2 || helpLevel === 1;
  return (
    <div className="w-full mt-4 p-4 rounded-[var(--radius-lg)] bg-surface border border-border/60 animate-fade-in">
      <p className="text-eyebrow text-text-faint inline-flex items-center gap-1.5 mb-2">💡 Você pode responder</p>
      {showFull && expected ? (
        <>
          <p className="text-h2 text-text font-medium">{expected}</p>
          {onHear && (
            <button onClick={() => onHear(expected)} className="mt-2 inline-flex items-center gap-1.5 text-secondary text-primary min-h-11">
              <IconEar size={16} /> Ouvir
            </button>
          )}
        </>
      ) : showPartial && partial ? (
        <p className="text-h2 text-text-muted font-medium">{partial}…</p>
      ) : showFirst && first ? (
        <p className="text-h2 text-text-muted font-medium">{first}…</p>
      ) : showHintOnly ? (
        <p className="text-secondary text-text-muted">
          {helpLevel === 2 && first ? `Comece com ${first}...` : (hint || 'Pense na situação. O que você diria?')}
        </p>
      ) : hint ? (
        <p className="text-secondary text-text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

/* ---------- CorrectionPanel ---------- */
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
    <div className="w-full mt-4 p-4 rounded-[var(--radius-lg)] bg-accent/8 border border-accent/30 animate-scale-in">
      <div className="flex items-start justify-between gap-3">
        <p className="text-eyebrow text-accent">Quase! 😊</p>
        {onDismiss && (
          <button onClick={onDismiss} className="text-text-faint text-caption min-h-11 px-1">✕</button>
        )}
      </div>
      {userSaid && <p className="text-secondary text-text-muted mt-2">Você disse: <span className="text-text">{userSaid}</span></p>}
      <p className="text-h2 text-text font-medium mt-2">{correct}</p>
      {portuguese && <p className="text-secondary text-text-faint mt-1">🇧🇷 {portuguese}</p>}
      {onRetry && (
        <button onClick={onRetry} className="mt-3 inline-flex items-center gap-2 px-5 py-2.5 rounded-[var(--radius-md)] bg-primary text-white text-secondary font-medium active:scale-95 transition-transform min-h-11">
          <IconMic size={18} /> Tentar novamente
        </button>
      )}
    </div>
  );
}

/* ---------- ConversationHistory ---------- */
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
            m.role === 'user'
              ? 'bg-primary/15 text-text rounded-br-sm'
              : 'bg-surface-light/60 text-text-muted rounded-bl-sm'
          }`}>
            {m.text}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ---------- AudioControls ---------- */
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
        <CtrlButton onClick={onRepeat} icon={<IconRefresh size={16} />} label="Repetir" />
      )}
      {onSlower && (
        <CtrlButton onClick={onSlower} icon={<span className="text-sm">🐢</span>} label="Devagar" />
      )}
      {speeds.map((s) => (
        <CtrlButton key={s} onClick={() => onSpeed?.(s)} label={`${s}x`} active={speed === s} />
      ))}
    </div>
  );
}

function CtrlButton({ onClick, icon, label, active }: { onClick: () => void; icon?: ReactNode; label: string; active?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-[var(--radius-sm)] text-caption transition-colors min-h-11 ${
        active ? 'bg-primary text-white' : 'bg-surface/60 border border-border/50 text-text-muted hover:text-text'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

/* ============================================================
   Componentes da tela de conversa (referência visual Tela 5)
   Hierarquia: Professor → Tradução → Você → Feedback → Controles → Mic
   ============================================================ */

function WaveBars({ active, color = '#3b82f6', tall = false }: { active: boolean; color?: string; tall?: boolean }) {
  const heights = tall ? [10, 18, 12, 22, 14, 20, 11] : [4, 8, 5, 10, 6];
  return (
    <span className="inline-flex items-end gap-[3px] h-5" aria-hidden>
      {heights.map((h, i) => (
        <span
          key={i}
          className={`w-[3px] rounded-full ${active ? 'animate-wave-bar' : ''}`}
          style={{
            height: active ? h : Math.max(3, h * 0.35),
            background: color,
            opacity: active ? 1 : 0.35,
            animationDelay: active ? `${i * 0.08}s` : undefined,
          }}
        />
      ))}
    </span>
  );
}

/* ---------- SessionProgress ---------- */
export function SessionProgress({ current, total }: { current: number; total: number }) {
  const safeTotal = Math.max(1, total);
  const filled = Math.min(safeTotal, Math.max(0, current));
  return (
    <div className="flex flex-col items-center gap-1.5 min-w-0">
      <div className="flex gap-1.5 items-center" aria-label={`Conversa ${filled} de ${safeTotal}`}>
        {Array.from({ length: safeTotal }).map((_, i) => (
          <span
            key={i}
            className="h-1.5 rounded-full transition-all duration-300"
            style={{
              width: i < filled ? 22 : 18,
              background: i < filled
                ? 'linear-gradient(90deg, #3b82f6 0%, #7c3aed 100%)'
                : 'rgba(148,163,184,0.22)',
              boxShadow: i < filled ? '0 0 10px rgba(59,130,246,0.35)' : undefined,
            }}
          />
        ))}
      </div>
      <p className="text-caption text-text-faint">
        Conversa {Math.max(1, filled || 1)} de {safeTotal}
      </p>
    </div>
  );
}

/* ---------- TeacherCard ---------- */
export interface TeacherCardProps {
  orbState: 'idle' | 'listening' | 'processing' | 'speaking' | 'error';
  statusIcon?: string;
  statusText: string;
  german: string;
  portuguese: string;
  translating?: boolean;
  translationStatus: TranslationStatus;
  translationError?: string;
  slowTranslation?: boolean;
  translationVisible: boolean;
  translationMode: 'always' | 'ondemand' | 'immersion';
  onToggleTranslation: () => void;
  onRepeat: () => void;
  onHelp?: () => void;
  onRetryTranslation?: () => void;
  explanation?: string;
  scaffoldHint?: string;
}

export function TeacherCard({
  orbState, statusText, german, portuguese,
  translationStatus, translationError, slowTranslation,
  translationVisible, translationMode, onToggleTranslation, onRepeat, onHelp, onRetryTranslation, explanation, scaffoldHint,
}: TeacherCardProps) {
  const speaking = orbState === 'speaking';
  const listening = orbState === 'listening';
  const processing = orbState === 'processing';

  return (
    <section
      className="rounded-[28px] p-5 animate-fade-in min-h-0"
      style={{
        background: 'linear-gradient(165deg, var(--teacher-from) 0%, var(--teacher-to) 100%)',
        border: '1px solid var(--border)',
        boxShadow: 'var(--shadow-md), inset 0 1px 0 var(--glass-inset)',
      }}
    >
      <div className="flex items-center gap-3 mb-4">
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
        <div className="min-w-0 flex-1">
          <p className="text-body text-text font-bold leading-tight tracking-wide">DEUTSCH COACH</p>
          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-caption font-semibold" style={{ background: 'var(--chip-purple-bg)', color: 'var(--chip-purple-fg)' }}>
              Professor
            </span>
            <span className="text-caption text-text-muted inline-flex items-center gap-1.5">
              <span aria-hidden>
                {speaking ? '🔊' : listening ? '✨' : processing ? '⏳' : '✓'}
              </span>
              {statusText}
              {(speaking || listening) && <WaveBars active color={speaking ? '#a78bfa' : '#3b82f6'} />}
            </span>
          </div>
        </div>
        {onHelp && (
          <button
            type="button"
            onClick={onHelp}
            aria-label="Ajuda"
            className="shrink-0 w-10 h-10 min-h-11 min-w-11 rounded-full dt-glass flex items-center justify-center text-text-muted hover:text-text transition-colors"
          >
            <IconHelp size={18} />
          </button>
        )}
      </div>

      <p className="text-eyebrow tracking-[0.16em] mb-2 font-semibold" style={{ color: '#7c9cff' }}>ALEMÃO</p>
      <p
        className="font-[family-name:var(--font-display)] text-[1.55rem] sm:text-[1.75rem] font-bold text-text"
        style={{ whiteSpace: 'normal', overflowWrap: 'anywhere', wordBreak: 'break-word', lineHeight: 1.3 }}
        aria-label="Frase em alemão"
      >
        {german || (processing ? '…' : '')}
      </p>

      <div className="mt-5">
        <p className="text-eyebrow tracking-[0.16em] mb-2 font-semibold" style={{ color: '#34d399' }}>PORTUGUÊS</p>
        {translationVisible ? (
          <div className="flex flex-col gap-3">
            <div className="min-w-0 w-full">
              {translationStatus === 'LOADING' && (
                <p className="text-h2 text-text-muted font-medium leading-snug">
                  {slowTranslation ? 'Traduzindo…' : 'Traduzindo...'}
                </p>
              )}
              {translationStatus === 'READY' && (
                <p
                  className="text-h2 font-semibold leading-snug text-success"
                  style={{ whiteSpace: 'normal', overflowWrap: 'anywhere', wordBreak: 'break-word' }}
                  aria-label="Tradução"
                >
                  {portuguese}
                </p>
              )}
              {translationStatus === 'ERROR' && (
                <div>
                  <p className="text-h2 text-text-muted font-medium leading-snug">
                    {translationError || 'Tradução indisponível no momento.'}
                  </p>
                  {onRetryTranslation && (
                    <button
                      type="button"
                      onClick={onRetryTranslation}
                      className="mt-2 inline-flex items-center gap-1.5 text-caption font-semibold text-success min-h-11"
                    >
                      <IconRefresh size={14} /> Tentar novamente
                    </button>
                  )}
                </div>
              )}
              {translationStatus === 'HIDDEN' && (
                <p className="text-h2 text-text-faint font-medium">—</p>
              )}
            </div>
            <button
              type="button"
              onClick={onToggleTranslation}
              className="self-start inline-flex items-center gap-1.5 text-caption font-semibold px-3 py-2 rounded-full border-2 border-success/55 text-success hover:bg-success/10 transition-colors min-h-11"
            >
              👁 Ocultar tradução
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={onToggleTranslation}
            className="inline-flex items-center gap-1.5 text-caption font-semibold px-3 py-2 rounded-full border-2 border-success/55 text-success hover:bg-success/10 transition-colors min-h-11"
          >
            {translationMode === 'immersion' ? '🇧🇷' : '👁'} Mostrar tradução
          </button>
        )}
      </div>

      <button
        type="button"
        onClick={onRepeat}
        className="mt-4 inline-flex items-center gap-2 text-caption font-semibold text-primary min-h-11 px-1"
      >
        <IconRefresh size={14} /> Tentar novamente
      </button>

      {scaffoldHint && (
        <div className="mt-3 p-3.5 rounded-[18px] bg-accent/10 border border-accent/25 animate-fade-in">
          <p className="text-eyebrow inline-flex items-center gap-1.5 mb-1 font-semibold text-accent">💡 Pista</p>
          <p className="text-secondary text-text leading-snug">{scaffoldHint}</p>
        </div>
      )}

      {explanation && (
        <div className="mt-3 p-3.5 rounded-[18px] bg-primary/10" style={{ borderLeft: '3px solid #3b82f6' }}>
          <p className="text-eyebrow inline-flex items-center gap-1.5 mb-1.5 font-semibold text-primary">💡 Explicação</p>
          <p className="text-secondary text-text leading-snug">{explanation}</p>
        </div>
      )}
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
      className="mt-3 rounded-[24px] p-4 animate-fade-in"
      style={{
        background: 'linear-gradient(135deg, var(--user-said-from) 0%, var(--user-said-to) 100%)',
        border: '1px solid var(--border)',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <p className="text-eyebrow inline-flex items-center gap-1.5 font-semibold tracking-[0.14em]" style={{ color: '#60a5fa' }}>
          <IconUser size={14} /> VOCÊ DISSE
        </p>
        {onReplay && (
          <button type="button" onClick={onReplay} aria-label="Ouvir sua fala" className="min-h-11 min-w-11 flex items-center justify-center text-primary">
            <IconSpeaker size={18} />
          </button>
        )}
      </div>
      <p
        className="text-body text-text font-semibold leading-snug"
        style={{ whiteSpace: 'normal', overflowWrap: 'anywhere', wordBreak: 'break-word' }}
      >
        {text}
      </p>
      {status === 'processing' && (
        <p className="text-caption mt-2.5 inline-flex items-center gap-1.5 animate-fade-soft text-primary">
          Entendi. Só um momento…
          <WaveBars active color="#3b82f6" />
        </p>
      )}
      {status === 'received' && feedback && (
        <p className="text-caption mt-2.5 inline-flex items-center gap-1.5 font-medium" style={{ color: toneColor }}>
          <IconSparkle size={14} /> {feedback}
        </p>
      )}
    </section>
  );
}

function IconSparkle({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 3l1.6 5.4L19 10l-5.4 1.6L12 17l-1.6-5.4L5 10l5.4-1.6L12 3Z" />
    </svg>
  );
}

/* ---------- FeedbackCard ---------- */
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
      <section className="mt-3 rounded-[24px] dt-glass p-4 animate-scale-in" style={{ borderLeft: '4px solid #34d399' }}>
        <p className="text-h2 text-success font-bold inline-flex items-center gap-2">
          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-success text-white text-xs">✓</span>
          {title}
        </p>
        {message && <p className="text-secondary text-text-muted mt-1.5 leading-snug">{message}</p>}
        {tip && (
          <div className="mt-3 p-3 rounded-[16px] bg-accent/10">
            <p className="text-eyebrow inline-flex items-center gap-1.5 mb-1 font-semibold text-accent">⭐ Dica</p>
            <p className="text-secondary text-text leading-snug">{tip}</p>
          </div>
        )}
      </section>
    );
  }
  return (
    <section className="mt-3 rounded-[24px] bg-accent/8 border border-accent/30 p-4 animate-scale-in">
      <p className="text-h2 text-accent font-semibold">{title || 'Quase. Vamos ajustar uma coisa.'}</p>
      {userSaid && <p className="text-secondary text-text-muted mt-2">Você disse: <span className="text-text">{userSaid}</span></p>}
      {correction && <p className="text-secondary text-text mt-1">Tente: <span className="text-text font-medium">{correction}</span></p>}
      {message && <p className="text-secondary text-text-muted mt-1.5">{message}</p>}
      {onRetry && (
        <button type="button" onClick={onRetry} className="mt-3 inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-accent text-white text-secondary font-medium active:scale-95 transition-transform min-h-11">
          <IconMic size={18} /> Tentar novamente
        </button>
      )}
    </section>
  );
}

/* ---------- ActionGrid ---------- */
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
    <div className="grid grid-cols-4 gap-2.5">
      {items.map((a) => (
        <button
          key={a.label}
          type="button"
          onClick={a.onClick}
          className={`flex flex-col items-center justify-center gap-1.5 py-3 px-1 rounded-[20px] transition-all min-h-[72px] active:scale-95 ${
            a.active ? 'border border-success/40' : 'dt-glass hover:border-primary/30'
          }`}
          style={a.active ? { background: 'rgba(16,185,129,0.12)' } : undefined}
          aria-label={a.label}
        >
          <span
            className="w-11 h-11 rounded-2xl flex items-center justify-center"
            style={{ background: `${a.color || '#3b82f6'}22`, color: a.color || '#3b82f6' }}
            aria-hidden
          >
            {a.icon}
          </span>
          <span className="text-caption font-semibold leading-tight text-center text-text">{a.label}</span>
          {a.sub && <span className="text-[10px] text-text-faint leading-tight text-center px-0.5 line-clamp-2">{a.sub}</span>}
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
      inputRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }, 80);
    return () => window.clearTimeout(id);
  }, [textMode]);

  return (
    <div
      className="flex flex-col items-center pt-2 pb-3 safe-bottom shrink-0 px-4"
      style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom, 0px) + var(--keyboard-inset, 0px))' }}
    >
      <div className="flex items-end justify-center gap-2 w-full">
        <button
          type="button"
          onClick={onToggleText}
          className="flex flex-col items-center text-center px-2 py-3 rounded-[22px] dt-glass hover:border-primary/30 transition-colors min-h-[72px] w-[96px] shrink-0"
          aria-label="Digitar resposta"
        >
          <span className="w-10 h-10 rounded-xl flex items-center justify-center mb-1 bg-primary/15 text-primary">
            <IconKeyboard size={18} />
          </span>
          <span className="text-caption font-bold text-text leading-tight">Digitar</span>
          <span className="text-[10px] text-text-faint leading-tight mt-0.5">por texto</span>
        </button>

        <div className="relative flex items-center gap-1.5 shrink-0">
          <WaveBars active={micActive} color="#7c3aed" tall />
          <span className="relative w-[104px] h-[104px] flex items-center justify-center">
            <span
              className="absolute inset-0 rounded-full"
              style={{
                background: 'radial-gradient(circle, rgba(59,130,246,0.35) 0%, rgba(124,58,237,0.2) 45%, transparent 70%)',
                transform: micActive ? `scale(${1.05 + levelBoost * 0.12})` : 'scale(1)',
                transition: 'transform 120ms ease-out',
              }}
            />
            <button
              type="button"
              onClick={onMic}
              disabled={disabled}
              aria-label={micActive ? 'Parar microfone' : 'Falar'}
              className="relative w-[88px] h-[88px] rounded-full flex items-center justify-center transition-transform duration-200 active:scale-95 disabled:opacity-50"
              style={{
                background: 'linear-gradient(145deg, #60a5fa 0%, #3b82f6 45%, #7c3aed 100%)',
                boxShadow: micActive
                  ? '0 0 0 6px rgba(59,130,246,0.2), 0 12px 36px rgba(124,58,237,0.45)'
                  : 'var(--shadow-glow)',
              }}
            >
              {micActive && (
                <>
                  <span className="absolute w-[112px] h-[112px] rounded-full bg-primary/20 animate-pulse-ring" />
                  <span className="absolute w-[100px] h-[100px] rounded-full bg-purple/20 animate-pulse-ring" style={{ animationDelay: '0.45s' }} />
                </>
              )}
              <span className="relative text-white"><IconMic size={32} /></span>
            </button>
          </span>
          <WaveBars active={micActive} color="#3b82f6" tall />
        </div>

        <span className="w-[96px] shrink-0" aria-hidden />
      </div>

      <p className="text-body text-text font-semibold mt-3 min-h-6 text-center px-2">{statusLabel}</p>
      {statusHint && <p className="text-caption text-text-faint mt-0.5 text-center px-2">{statusHint}</p>}

      {micActive && noSignal && (
        <button type="button" onClick={onPickMic} className="text-caption mt-2 min-h-11 text-warning">
          Sem sinal de áudio · Escolher microfone
        </button>
      )}

      {textMode && (
        <form
          onSubmit={(e) => { e.preventDefault(); onTextSubmit(); }}
          className="mt-3 w-full flex gap-2 animate-fade-in"
        >
          <input
            ref={inputRef}
            value={textValue}
            onChange={(e) => onTextChange(e.target.value)}
            placeholder="Escreva em alemão…"
            className="flex-1 bg-surface-light text-text text-secondary rounded-[18px] px-4 py-3 border border-border focus:outline-none focus:border-primary/50 min-h-12"
            aria-label="Digitar resposta"
            enterKeyHint="send"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
          />
          <button type="submit" className="px-5 py-3 rounded-[18px] bg-primary text-white text-secondary font-semibold min-h-12 shrink-0">
            Enviar
          </button>
        </form>
      )}
    </div>
  );
}
