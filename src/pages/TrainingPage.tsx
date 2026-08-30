import { useNavigate } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { BottomNav } from '@/components/layout/BottomNav';
import { Card } from '@/components/ui/Shared';
import { useProfile } from '@/hooks/useProfile';

const DURATIONS = [2, 10, 20, 30, 60, 90];

export function TrainingPage() {
  const navigate = useNavigate();
  const { profile, updateProfile } = useProfile();

  const modes = [
    { icon: '⚡', label: '2 Minutos', desc: 'Microtreino rápido', type: 'micro', duration: 2 },
    { icon: '🚀', label: 'Turbo', desc: 'Máxima intensidade', type: 'turbo', turbo: true },
    { icon: '⚡', label: 'Resposta Rápida', desc: 'Responda em 3 segundos', path: '/resposta-rapida' },
    { icon: '🎧', label: 'Listening Ladder', desc: 'Treino de escuta', path: '/listening' },
    { icon: '🧠', label: 'Pensar em Alemão', desc: 'Sem tradução mental', path: '/pensar-alemao' },
    { icon: '📖', label: 'Programa 30 Dias', desc: `Dia ${profile?.currentDay || 1}`, path: '/programa' },
  ];

  return (
    <>
      <Layout title="🎯 Treino">
        <div className="px-4 py-6 space-y-6 max-w-lg mx-auto">
          <div>
            <h2 className="text-lg font-bold mb-3">Duração</h2>
            <div className="grid grid-cols-3 gap-2">
              {DURATIONS.map((d) => (
                <Card
                  key={d}
                  onClick={() => navigate(`/conversar?type=lesson&duration=${d}`)}
                  className="text-center py-3"
                >
                  <span className="font-bold text-lg">{d}</span>
                  <span className="text-text-muted text-xs block">min</span>
                </Card>
              ))}
            </div>
          </div>

          <div>
            <h2 className="text-lg font-bold mb-3">Modos</h2>
            <div className="space-y-2">
              {modes.map((m) => (
                <Card
                  key={m.label}
                  onClick={async () => {
                    if (m.turbo) {
                      await updateProfile({ turboMode: !profile?.turboMode });
                      navigate('/conversar?type=turbo');
                    } else if (m.path) {
                      navigate(m.path);
                    } else {
                      navigate(`/conversar?type=${m.type}${m.duration ? `&duration=${m.duration}` : ''}`);
                    }
                  }}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{m.icon}</span>
                    <div>
                      <p className="font-medium">{m.label}</p>
                      <p className="text-sm text-text-muted">{m.desc}</p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </Layout>
      <BottomNav />
    </>
  );
}
