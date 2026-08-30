import { useNavigate } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { BottomNav } from '@/components/layout/BottomNav';
import { Card } from '@/components/ui/Shared';
import { SITUATIONS } from '@/data/content';

export function SituationsPage() {
  const navigate = useNavigate();

  return (
    <>
      <Layout title="🎭 Situações" showMenu>
        <div className="px-4 py-6 space-y-3 max-w-lg mx-auto">
          <p className="text-sm text-text-muted mb-2">Simule conversas reais. Toque e fale com o professor.</p>
          {SITUATIONS.map((s) => (
            <Card
              key={s.id}
              onClick={() => navigate(`/conversar?type=situation&situation=${s.id}`)}
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">{s.icon}</span>
                <div className="flex-1">
                  <p className="font-medium">{s.title}</p>
                  <p className="text-sm text-text-muted">{s.description}</p>
                </div>
                <span className="text-xs text-text-muted">{s.difficulty}</span>
              </div>
            </Card>
          ))}
        </div>
      </Layout>
      <BottomNav />
    </>
  );
}
