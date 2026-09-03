/* Diagnóstico curto dentro do onboarding — 4 a 6 itens, ~2 min. */
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
    <div className="animate-fade-in">
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[12px] font-medium text-[#64748B]">
            {index + 1} de {total} · cerca de 2 min
          </p>
          <p className="text-[11px] font-bold text-[#00F2FE] tabular-nums">{pct}%</p>
        </div>
        <div
          className="h-1.5 rounded-full overflow-hidden"
          style={{ background: 'rgba(255,255,255,0.08)' }}
        >
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{
              width: `${Math.max(8, pct)}%`,
              background: 'linear-gradient(90deg, #8B5CF6, #00F2FE)',
              boxShadow: '0 0 8px rgba(0,242,254,0.45)',
            }}
          />
        </div>
      </div>

      <OnboardingQuestion title={item.german} subtitle={item.portuguese} />

      {item.hint && (
        <p className="text-sm text-[#00F2FE] mb-4 rounded-[14px] px-3 py-2" style={glassStyle}>
          Dica: {item.hint}
        </p>
      )}

      <button
        type="button"
        onClick={() => {
          void listen();
        }}
        disabled={listening}
        className="w-full min-h-14 rounded-full text-white font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-50"
        style={{
          background: 'linear-gradient(135deg, #8B5CF6, #00F2FE)',
          boxShadow: listening ? undefined : '0 0 24px rgba(139,92,246,0.35)',
        }}
      >
        <IconMic size={18} />{' '}
        {listening ? 'Ouvindo…' : item.type === 'listen' ? 'Ouvir e responder' : 'Falar'}
      </button>

      {feedback && <p className="text-sm text-[#EF4444] mt-2 text-center">{feedback}</p>}

      <div className="grid grid-cols-2 gap-2.5 mt-4">
        <button
          type="button"
          onClick={() => mark(true)}
          className="min-h-12 rounded-[16px] font-semibold"
          style={{
            background: 'rgba(34,197,94,0.15)',
            color: '#22C55E',
            border: '1px solid rgba(34,197,94,0.35)',
          }}
        >
          Consegui
        </button>
        <button
          type="button"
          onClick={() => mark(false)}
          className="min-h-12 rounded-[16px] font-semibold text-[#94A3B8]"
          style={glassStyle}
        >
          Ainda não
        </button>
      </div>
    </div>
  );
}
