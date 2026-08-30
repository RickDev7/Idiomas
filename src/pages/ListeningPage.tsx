import { useState } from 'react';
import { Layout } from '@/components/layout/Layout';
import { BottomNav } from '@/components/layout/BottomNav';
import { Card } from '@/components/ui/Shared';
import { LISTENING_EXERCISES } from '@/data/content';
import { getVoiceService } from '@/services/voice/VoiceService';
import type { SpeechSpeed } from '@/types';

export function ListeningPage() {
  const [level, setLevel] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const exercise = LISTENING_EXERCISES[level];

  const play = async () => {
    const voice = getVoiceService();
    voice.setSpeed(exercise.speed as SpeechSpeed);
    await voice.speak(exercise.audioText);
  };

  return (
    <>
      <Layout title="🎧 Listening Ladder" showMenu>
        <div className="px-4 py-6 space-y-4 max-w-lg mx-auto">
          <p className="text-sm text-text-muted">
            Nível {exercise.level}/6 — {exercise.title}
          </p>
          <div className="flex gap-1">
            {LISTENING_EXERCISES.map((e, i) => (
              <button
                key={e.id}
                onClick={() => { setLevel(i); setRevealed(false); }}
                className={`flex-1 h-2 rounded-full ${i === level ? 'bg-primary' : 'bg-surface-light'}`}
              />
            ))}
          </div>

          <Card className="text-center py-10">
            {exercise.hasBackgroundNoise && (
              <p className="text-xs text-accent mb-3">Ambiente com ruído simulado (nível 6)</p>
            )}
            {(exercise.showText || revealed) ? (
              <p className="text-lg">{exercise.audioText}</p>
            ) : (
              <p className="text-text-muted">Texto oculto — só escute.</p>
            )}
          </Card>

          <button onClick={play} className="w-full py-4 rounded-2xl bg-primary font-bold">
            🔊 Ouvir
          </button>
          {!exercise.showText && (
            <button onClick={() => setRevealed(true)} className="w-full py-3 rounded-2xl bg-surface-light">
              Mostrar texto
            </button>
          )}
          <p className="text-sm text-text-muted">{exercise.questions[0]?.question}</p>
        </div>
      </Layout>
      <BottomNav />
    </>
  );
}
