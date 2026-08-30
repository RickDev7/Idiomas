import { useNavigate } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { BottomNav } from '@/components/layout/BottomNav';
import { Card, ProgressBar } from '@/components/ui/Shared';
import { useProgress } from '@/hooks/useProfile';

export function WeeklyChallengePage() {
  const navigate = useNavigate();
  const { progress } = useProgress();
  const last = progress?.weeklyScores[progress.weeklyScores.length - 1];
  const prev = progress?.weeklyScores[progress.weeklyScores.length - 2];

  return (
    <>
      <Layout title="🏆 Desafio Semanal" showMenu>
        <div className="px-4 py-6 space-y-4 max-w-lg mx-auto">
          <p className="text-sm text-text-muted">
            Conversação de 5–10 minutos, sem tradução no início. O professor avalia compreensão, vocabulário, fluência e capacidade de manter a conversa.
          </p>
          <Card>
            <p className="text-sm text-text-muted">Última avaliação</p>
            <p className="text-3xl font-bold">{last?.score ?? '—'}</p>
            {last && <ProgressBar value={last.score} />}
            {prev && (
              <p className="text-sm mt-2">
                Semana anterior: {prev.score} ({last && last.score >= prev.score ? '↑ melhor' : '↓ treine mais fala'})
              </p>
            )}
          </Card>
          <button
            onClick={() => navigate('/conversar?type=free&duration=10')}
            className="w-full py-4 rounded-2xl bg-primary font-bold"
          >
            Começar desafio agora
          </button>
        </div>
      </Layout>
      <BottomNav />
    </>
  );
}
