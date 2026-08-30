import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { BottomNav } from '@/components/layout/BottomNav';
import { Card } from '@/components/ui/Shared';
import { getConfiguredAIService } from '@/services/ai/AIService';
import { getVoiceService } from '@/services/voice/VoiceService';
import { StorageService } from '@/services/storage/StorageService';
import { useProfile } from '@/hooks/useProfile';
import type { PersonalPhrase } from '@/types';
import { generateId, getNextReviewDate } from '@/utils/reviewUtils';

export function MyGermanPage() {
  const { profile } = useProfile();
  const navigate = useNavigate();
  const [input, setInput] = useState('');
  const [result, setResult] = useState<PersonalPhrase | null>(null);
  const [saved, setSaved] = useState<PersonalPhrase[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    StorageService.getPersonalPhrases().then(setSaved);
  }, []);

  const generate = async () => {
    if (!input.trim() || !profile) return;
    setBusy(true);
    const phrase = await getConfiguredAIService().createPersonalizedContent(input.trim(), profile);
    phrase.id = generateId();
    setResult(phrase);
    setBusy(false);
  };

  const save = async () => {
    if (!result) return;
    const toSave: PersonalPhrase = {
      ...result,
      reviewStage: 'learning',
      nextReview: getNextReviewDate('learning'),
    };
    await StorageService.savePersonalPhrase(toSave);
    await StorageService.saveReview({
      id: `rev-${toSave.id}`,
      itemId: toSave.id,
      itemType: 'personal',
      stage: 'learning',
      nextReview: getNextReviewDate('learning'),
      lastReviewed: null,
      intervalDays: 1,
      easeFactor: 2.5,
      consecutiveCorrect: 0,
    });
    setSaved((prev) => [toSave, ...prev]);
  };

  return (
    <>
      <Layout title="🧠 Meu Alemão" showMenu>
        <div className="px-4 py-6 space-y-4 max-w-lg mx-auto">
          <p className="text-sm text-text-muted">Descreva em português o que você precisa dizer. O professor transforma em uma frase útil.</p>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            rows={3}
            placeholder="Quero dizer ao meu chefe que posso trabalhar amanhã."
            className="w-full p-4 rounded-2xl bg-surface border border-surface-light focus:border-primary focus:outline-none"
          />
          <button
            onClick={generate}
            disabled={busy}
            className="w-full py-3 rounded-2xl bg-primary font-bold disabled:opacity-40"
          >
            {busy ? 'Gerando...' : 'Gerar frase'}
          </button>

          {result && (
            <Card>
              <p className="text-xl font-bold">{result.german}</p>
              <p className="text-sm text-text-muted mt-1">{result.portugueseInput}</p>
              <div className="grid grid-cols-4 gap-2 mt-4 text-center text-sm">
                <button onClick={() => getVoiceService().speak(result.german)}>🎧 Ouvir</button>
                <button onClick={() => getVoiceService().speak(result.german)}>🗣️ Repetir</button>
                <button onClick={() => navigate(`/conversar?type=free&topic=${encodeURIComponent(result.german)}`)}>💬 Praticar</button>
                <button onClick={save}>⭐ Salvar</button>
              </div>
            </Card>
          )}

          <h2 className="font-bold pt-2">Frases salvas</h2>
          {saved.length === 0 && <p className="text-sm text-text-muted">Nenhuma frase pessoal ainda.</p>}
          {saved.map((p) => (
            <Card key={p.id}>
              <p className="font-medium">{p.german}</p>
              <p className="text-sm text-text-muted">{p.portugueseInput}</p>
            </Card>
          ))}
        </div>
      </Layout>
      <BottomNav />
    </>
  );
}
