import { useNavigate } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { BottomNav } from '@/components/layout/BottomNav';
import { Card } from '@/components/ui/Shared';
import { DAY_PROGRAMS } from '@/data/content';
import { useProfile } from '@/hooks/useProfile';

export function ProgramPage() {
  const { profile } = useProfile();
  const navigate = useNavigate();
  const day = profile?.currentDay ?? 1;

  return (
    <>
      <Layout title="📖 30 Dias" showMenu>
        <div className="px-4 py-6 space-y-3 max-w-lg mx-auto">
          <p className="text-sm text-text-muted">
            Objetivo: sobreviver e conversar — não “terminar A1”. Dias 31–90: independência.
          </p>
          {DAY_PROGRAMS.map((d) => (
            <Card
              key={d.day}
              onClick={() => navigate(`/conversar?type=lesson&duration=${profile?.dailyMinutes || 20}`)}
              className={d.day === day ? 'border-primary' : ''}
            >
              <div className="flex justify-between">
                <p className="font-bold">{d.title}</p>
                {d.day === day && <span className="text-xs text-primary">HOJE</span>}
              </div>
              <p className="text-xs text-text-muted mt-1">{d.phase}</p>
              <p className="text-sm mt-2">{d.phrases[0]}</p>
            </Card>
          ))}
        </div>
      </Layout>
      <BottomNav />
    </>
  );
}
