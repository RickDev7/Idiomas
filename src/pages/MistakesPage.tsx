import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { BottomNav } from '@/components/layout/BottomNav';
import { Card } from '@/components/ui/Shared';
import { StorageService } from '@/services/storage/StorageService';
import { getVoiceService } from '@/services/voice/VoiceService';
import type { Mistake } from '@/types';

export function MistakesPage() {
  const [mistakes, setMistakes] = useState<Mistake[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    StorageService.getAllMistakes().then(setMistakes);
  }, []);

  const frequent = [...mistakes].sort((a, b) => b.count - a.count);
  const recent = [...mistakes].sort((a, b) => b.lastOccurrence.localeCompare(a.lastOccurrence));
  const open = mistakes.filter((m) => !m.mastered);
  const fixed = mistakes.filter((m) => m.mastered);

  const Section = ({ title, items }: { title: string; items: Mistake[] }) => (
    <div>
      <h2 className="font-bold mb-2">{title}</h2>
      {items.length === 0 && <p className="text-sm text-text-muted mb-4">Nenhum ainda.</p>}
      <div className="space-y-2 mb-6">
        {items.slice(0, 8).map((m) => (
          <Card key={m.id}>
            <p className="text-sm text-text-muted">Você: {m.userSaid}</p>
            <p className="font-medium text-primary">{m.correct}</p>
            <p className="text-xs text-text-muted mt-1">{m.explanation} · {m.count}x</p>
            <button className="text-xs text-accent mt-2" onClick={() => getVoiceService().speak(m.correct)}>
              🔊 Ouvir correção
            </button>
          </Card>
        ))}
      </div>
    </div>
  );

  return (
    <>
      <Layout title="❌ Meus Erros" showMenu>
        <div className="px-4 py-6 max-w-lg mx-auto">
          <button
            onClick={() => navigate('/conversar?type=review')}
            className="w-full py-3 rounded-2xl bg-primary font-bold mb-6"
          >
            Treinar meus erros
          </button>
          <Section title="Frequentes" items={frequent} />
          <Section title="Recentes" items={recent} />
          <Section title="Ainda não dominados" items={open} />
          <Section title="Corrigidos" items={fixed} />
        </div>
      </Layout>
      <BottomNav />
    </>
  );
}
