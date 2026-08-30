import { useState } from 'react';
import type { MicroPracticeSession, MicroVisualState } from '@/services/teacher/MicroPracticeEngine';
import { microDurationLabel } from '@/services/teacher/MicroPracticeEngine';
import { supportLabel } from '@/services/learning/ScaffoldingEngine';
import { haptic } from '@/services/ui/UiPrefsService';

interface MicroPracticePanelProps {
  session: MicroPracticeSession;
  feedback: string | null;
  onSubmit: (text: string) => void;
  onSkip: () => void;
  /** Mic da conversa continua ativo — painel só orienta. */
  micActive?: boolean;
  onRequestHelp?: () => void;
}

const VISUAL_HINT: Partial<Record<MicroVisualState, string>> = {
  ENTERING: 'Um momento…',
  PRACTICING: 'Vamos corrigir isso rapidinho.',
  LISTENING: 'Estou ouvindo…',
  EVALUATING: 'Analisando…',
  SUCCESS: 'Muito melhor!',
  FAILED: 'Vamos revisar isso novamente mais tarde.',
  RETURNING: 'Voltando à conversa…',
};

/** Painel leve dentro da conversa — intervenção curta, sem página nova. */
export function MicroPracticePanel({
  session,
  feedback,
  onSubmit,
  onSkip,
  micActive,
  onRequestHelp,
}: MicroPracticePanelProps) {
  const [value, setValue] = useState('');
  const visual = session.visualState || 'PRACTICING';
  const done = session.phase === 'done' || session.status === 'completed'
    || visual === 'SUCCESS' || visual === 'FAILED' || visual === 'RETURNING';

  const level = session.currentSupportLevel ?? session.startingSupport ?? 0;
  const headline = VISUAL_HINT[visual]
    || (session.phase === 'independent'
      ? session.independentPrompt || 'Diga a frase sozinho.'
      : 'Vamos corrigir isso rapidinho.');

  /** Só mostra modelo completo no nível 5; senão dica progressiva. */
  const showFullModel = level >= 5 && (session.phase === 'guided' || session.phase === 'explain' || visual === 'ENTERING');
  const showScaffoldHint =
    !done &&
    level > 0 &&
    level < 5 &&
    (session.phase === 'guided' || session.phase === 'explain') &&
    !!session.scaffoldDisplay;
  const showIndependentQ = session.phase === 'independent' && !done;

  const submit = () => {
    const t = value.trim();
    if (!t) return;
    haptic(10);
    onSubmit(t);
    setValue('');
  };

  return (
    <div
      className="mt-3 rounded-[24px] border border-accent/35 p-4 animate-scale-in"
      style={{ background: 'linear-gradient(135deg, var(--micro-from) 0%, var(--micro-to) 100%)' }}
      role="region"
      aria-label="Correção rápida"
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <p className="text-eyebrow text-accent tracking-wide">
          Correção rápida · {microDurationLabel(session.durationSec)}
        </p>
        <span className="text-caption text-text-faint">
          {session.attempts}/{session.maxAttempts || 3}
          {level > 0 ? ` · ${supportLabel(level)}` : ''}
        </span>
      </div>

      <p className="text-secondary text-text leading-snug">{headline}</p>

      {showFullModel && (
        <p className="mt-3 text-h2 text-text font-medium leading-snug">{session.targetItem}</p>
      )}

      {showScaffoldHint && (
        <p className="mt-3 text-body text-text font-medium leading-snug">
          {session.scaffoldDisplay}
        </p>
      )}

      {showIndependentQ && (
        <p className="mt-3 text-body text-text font-medium leading-snug">{session.independentPrompt}</p>
      )}

      {session.phase === 'guided' && !done && level > 0 && level < 5 && session.guidedHint && !showScaffoldHint && (
        <p className="mt-1 text-caption text-text-muted">Dica: {session.guidedHint}</p>
      )}

      {feedback && !done && (
        <p className="mt-2 text-caption text-accent">{feedback}</p>
      )}

      {(visual === 'SUCCESS' || session.result === 'SUCCESS') && (
        <p className="mt-3 text-body text-success font-medium">Muito melhor!</p>
      )}

      {(visual === 'FAILED' || session.result === 'NEEDS_REVIEW' || session.result === 'FAILED') && done && (
        <p className="mt-3 text-body text-text-muted">Vamos revisar isso novamente mais tarde.</p>
      )}

      {visual === 'RETURNING' && (
        <p className="mt-3 text-caption text-text-faint">Voltando à conversa…</p>
      )}

      {!done && (
        <>
          <p className="mt-3 text-caption text-text-faint">
            {micActive ? 'Fale no microfone ou digite abaixo.' : 'Toque no microfone ou digite abaixo.'}
          </p>
          <div className="mt-3 flex gap-2">
            <input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
              placeholder={session.phase === 'independent' ? 'Sua resposta…' : 'Digite ou use o microfone…'}
              className="flex-1 min-h-11 px-3 rounded-[var(--radius-md)] bg-surface border border-border/60 text-secondary text-text"
              aria-label="Resposta da correção"
            />
            <button
              type="button"
              onClick={submit}
              className="min-h-11 px-4 rounded-[var(--radius-md)] bg-accent text-white text-secondary font-medium shrink-0"
            >
              Enviar
            </button>
          </div>
          <div className="mt-2 flex gap-2">
            {onRequestHelp && level < 5 && (
              <button
                type="button"
                onClick={() => { haptic(8); onRequestHelp(); }}
                className="text-caption text-accent min-h-10 px-2"
              >
                💡 Ajuda
              </button>
            )}
            <button
              type="button"
              onClick={onSkip}
              className="text-caption text-text-faint min-h-10 px-2"
            >
              Pular por agora
            </button>
          </div>
        </>
      )}
    </div>
  );
}
