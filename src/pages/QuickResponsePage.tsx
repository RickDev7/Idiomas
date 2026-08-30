import { useCallback, useEffect, useState } from 'react';
import { Layout } from '@/components/layout/Layout';
import { BottomNav } from '@/components/layout/BottomNav';
import { MicButton } from '@/components/ui/Shared';
import { QUICK_RESPONSES } from '@/data/content';
import { getVoiceService } from '@/services/voice/VoiceService';
import { similarityScore } from '@/utils/reviewUtils';

export function QuickResponsePage() {
  const [index, setIndex] = useState(0);
  const [limit, setLimit] = useState(5);
  const [remaining, setRemaining] = useState(5);
  const [listening, setListening] = useState(false);
  const [feedback, setFeedback] = useState('');
  const item = QUICK_RESPONSES[index % QUICK_RESPONSES.length];

  useEffect(() => {
    setRemaining(limit);
    getVoiceService().speak(item.prompt);
    const t = setInterval(() => {
      setRemaining((r) => (r > 0 ? r - 1 : 0));
    }, 1000);
    return () => clearInterval(t);
  }, [index, limit, item.prompt]);

  const answer = useCallback(async () => {
    setListening(true);
    try {
      const text = await getVoiceService().listen();
      const ok = item.expectedAnswers.some((a) => similarityScore(text, a) >= 0.4);
      setFeedback(ok ? 'Schnell! Sehr gut.' : `Versuch: ${item.expectedAnswers[0]}`);
      if (ok && remaining > 0 && limit > 3) setLimit((l) => Math.max(3, l - 1));
    } catch {
      setFeedback('Não ouvi. Tente de novo.');
    } finally {
      setListening(false);
    }
  }, [item, remaining, limit]);

  return (
    <>
      <Layout title="⚡ Resposta rápida" showMenu>
        <div className="px-4 py-8 flex flex-col items-center max-w-lg mx-auto">
          <p className="text-sm text-text-muted mb-2">{limit} segundos · sem traduzir</p>
          <p className="text-6xl font-bold text-primary mb-6">{remaining}</p>
          <p className="text-2xl font-bold text-center mb-8">{item.prompt}</p>
          <MicButton
            isListening={listening}
            isSpeaking={false}
            isProcessing={false}
            onPress={answer}
          />
          {feedback && <p className="mt-6 text-center">{feedback}</p>}
          <button
            onClick={() => { setFeedback(''); setIndex((i) => i + 1); }}
            className="mt-8 text-sm text-text-muted"
          >
            Próxima pergunta
          </button>
        </div>
      </Layout>
      <BottomNav />
    </>
  );
}
