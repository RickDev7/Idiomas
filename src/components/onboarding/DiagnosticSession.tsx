/* Diagnóstico curto dentro do onboarding — 4 a 6 itens, ~2 min.
 * Composição full-screen: uma pergunta por vez. Lógica intacta. */
import { useMemo, useState } from 'react';
import { haptic } from '@/services/ui/UiPrefsService';
import { glassStyle } from '@/components/dt';
import { getVoiceService } from '@/services/voice/VoiceService';
import { similarityScore } from '@/utils/reviewUtils';
import {
  pickAdaptiveItems,
  gradeAdaptiveDiagnostic,
  type DiagnosticItemResult,
  type DiagnosticResult,
} from '@/services/onboarding/LevelDiagnostic';
import type { SelfReportedLevel } from '@/types';
import { OnboardingQuestion } from '@/components/onboarding/Onboarding';
import { IconMic } from '@/components/ui/Icons';
import { DT_ASSETS } from '@/assets/deutsch-turbo';

export function DiagnosticSession({
  selfReported,
  onDone,
}: {
  selfReported: SelfReportedLevel | null;
  onDone: (result: DiagnosticResult) => void;
}) {
  const items = useMemo(() => pickAdaptiveItems(selfReported), [selfReported]);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<DiagnosticItemResult[]>([]);
  const [feedback, setFeedback] = useState('');
  const [listening, setListening] = useState(false);
  const item = items[index];
  const total = items.length;

  const finish = (all: DiagnosticItemResult[]) => {
    onDone(gradeAdaptiveDiagnostic(all, selfReported));
  };

  const mark = (correct: boolean) => {
    haptic(8);
    const next = [...answers, { item, correct }];
    setAnswers(next);
    setFeedback('');
    if (index + 1 >= total) finish(next);
    else setIndex(index + 1);
  };

  const listen = async () => {
    setFeedback('');
    setListening(true);
    const voice = getVoiceService();
    try {
      voice.setLanguage('de-DE');
      if (item.type === 'listen') await voice.speak(item.german);
      const transcript = await voice.listen();
      const score = similarityScore(transcript, item.expected);
      mark(score >= 0.45);
    } catch {
      setFeedback('Não consegui ouvir. Use os botões abaixo.');
    } finally {
      setListening(false);
    }
  };

  if (!item) return null;

  const pct = Math.round(((index + 1) / total) * 100);

  return (
    <div className="animate-fade-in flex flex-col min-h-[70vh]">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2 px-0.5">
          <p className="text-[12px] font-medium text-[var(--text-faint)]">
            {index + 1} de {total}
          </p>
          <p className="text-[11px] font-bold text-[var(--voice-cyan)] tabular-nums">{pct}%</p>
        </div>
        <div
          className="h-1 rounded-full overflow-hidden"
          style={{ background: 'color-mix(in srgb, var(--text-primary) 10%, transparent)' }}
        >
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{
              width: `${Math.max(8, pct)}%`,
              background: 'linear-gradient(90deg, var(--learning-violet), var(--voice-cyan))',
            }}
          />
        </div>
      </div>

      <div className="flex justify-center mb-4">
        <img
          src={DT_ASSETS.mascot}
          alt=""
          className="w-16 h-16 object-contain opacity-90"
          draggable={false}
        />
      </div>

      <OnboardingQuestion title={item.german} subtitle={item.portuguese} />

      {item.hint && (
        <p
          className="text-sm text-[var(--voice-cyan)] mb-4 rounded-[16px] px-4 py-3 text-center"
          style={glassStyle}
        >
          Dica: {item.hint}
        </p>
      )}

      <div className="mt-auto space-y-3">
        <button
          type="button"
          onClick={() => {
            void listen();
          }}
          disabled={listening}
          className="w-full min-h-14 rounded-[22px] text-white font-bold inline-flex items-center justify-center gap-2 disabled:opacity-50 dt-cta-primary"
        >
          <IconMic size={18} />{' '}
          {listening ? 'Ouvindo…' : item.type === 'listen' ? 'Ouvir e responder' : 'Falar'}
        </button>

        {feedback && (
          <p className="text-sm text-[var(--danger)] text-center">{feedback}</p>
        )}

        <div className="grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={() => mark(true)}
            className="min-h-12 rounded-[18px] font-semibold"
            style={{
              background: 'color-mix(in srgb, var(--success) 15%, transparent)',
              color: 'var(--success)',
              border: '1px solid color-mix(in srgb, var(--success) 35%, transparent)',
            }}
          >
            Consegui
          </button>
          <button
            type="button"
            onClick={() => mark(false)}
            className="min-h-12 rounded-[18px] font-semibold text-[var(--text-secondary)]"
            style={glassStyle}
          >
            Ainda não
          </button>
        </div>
      </div>
    </div>
  );
}
