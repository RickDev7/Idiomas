/* Diagnóstico curto dentro do onboarding — 4 a 6 itens, ~2 min. */
import { useMemo, useState } from 'react';
import { haptic } from '@/services/ui/UiPrefsService';
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

  return (
    <div className="animate-fade-in">
      <p className="text-[12px] font-medium text-text-faint mb-2">
        {index + 1} de {total} · cerca de 2 min
      </p>
      <OnboardingQuestion
        title={item.german}
        subtitle={item.portuguese}
      />
      {item.hint && (
        <p className="text-sm text-primary mb-4">Dica: {item.hint}</p>
      )}
      <button
        type="button"
        onClick={() => { void listen(); }}
        disabled={listening}
        className="w-full min-h-14 rounded-full bg-primary text-white font-semibold shadow-md shadow-primary/25 inline-flex items-center justify-center gap-2 disabled:opacity-50"
      >
        <IconMic size={18} /> {listening ? 'Ouvindo…' : item.type === 'listen' ? 'Ouvir e responder' : 'Falar'}
      </button>
      {feedback && <p className="text-sm text-error mt-2 text-center">{feedback}</p>}
      <div className="grid grid-cols-2 gap-2.5 mt-4">
        <button
          type="button"
          onClick={() => mark(true)}
          className="min-h-12 rounded-[16px] bg-success/15 text-success font-semibold border border-success/30"
        >
          Consegui
        </button>
        <button
          type="button"
          onClick={() => mark(false)}
          className="min-h-12 rounded-[16px] bg-surface text-text-muted font-semibold border border-border"
        >
          Ainda não
        </button>
      </div>
    </div>
  );
}
