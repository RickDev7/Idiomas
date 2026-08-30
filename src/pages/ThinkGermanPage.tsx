import { useState } from 'react';
import { Layout } from '@/components/layout/Layout';
import { BottomNav } from '@/components/layout/BottomNav';
import { Card, MicButton } from '@/components/ui/Shared';
import { getVoiceService } from '@/services/voice/VoiceService';
import { similarityScore } from '@/utils/reviewUtils';

const PROMPTS = [
  { emoji: '💧', prompt: 'Was ist das?', expect: 'Wasser' },
  { emoji: '💧', prompt: 'Was möchtest du?', expect: 'Ich möchte Wasser' },
  { emoji: '🍞', prompt: 'Was ist das?', expect: 'Brot' },
  { emoji: '☕', prompt: 'Was trinkst du?', expect: 'Kaffee' },
  { emoji: '🚗', prompt: 'Was ist das?', expect: 'Auto' },
  { emoji: '🏠', prompt: 'Wo bist du?', expect: 'zu Hause' },
];

export function ThinkGermanPage() {
  const [i, setI] = useState(0);
  const [listening, setListening] = useState(false);
  const [feedback, setFeedback] = useState('');
  const item = PROMPTS[i];

  const go = async () => {
    await getVoiceService().speak(item.prompt);
  };

  const listen = async () => {
    setListening(true);
    try {
      const text = await getVoiceService().listen();
      const ok = similarityScore(text, item.expect) >= 0.4;
      setFeedback(ok ? 'Genau!' : `Sag: ${item.expect}`);
      if (ok) setTimeout(() => { setI((n) => (n + 1) % PROMPTS.length); setFeedback(''); }, 900);
    } finally {
      setListening(false);
    }
  };

  return (
    <>
      <Layout title="🧠 Pensar em alemão" showMenu>
        <div className="px-4 py-8 max-w-lg mx-auto flex flex-col items-center">
          <p className="text-sm text-text-muted mb-6 text-center">Veja. Ouça. Responda em alemão — sem passar pelo português.</p>
          <Card className="w-full text-center py-12">
            <p className="text-7xl mb-4">{item.emoji}</p>
            <p className="text-xl font-bold">{item.prompt}</p>
          </Card>
          <div className="flex gap-4 mt-8">
            <button onClick={go} className="px-4 py-2 rounded-xl bg-surface-light">🔊 Ouvir</button>
          </div>
          <div className="mt-8">
            <MicButton isListening={listening} isSpeaking={false} isProcessing={false} onPress={listen} />
          </div>
          {feedback && <p className="mt-4">{feedback}</p>}
        </div>
      </Layout>
      <BottomNav />
    </>
  );
}
