import { useEffect, useState } from 'react';
import { Layout } from '@/components/layout/Layout';
import { BottomNav } from '@/components/layout/BottomNav';
import { Card } from '@/components/ui/Shared';
import { getTodayMission } from '@/services/storage/initData';
import { StorageService } from '@/services/storage/StorageService';
import { getVoiceService } from '@/services/voice/VoiceService';
import { useProfile, useProgress } from '@/hooks/useProfile';
import { calculateCommunicationScore, formatDate, updateStreak } from '@/utils/reviewUtils';
import type { Mission } from '@/types';

export function MissionPage() {
  const [mission, setMission] = useState<Mission | null>(null);
  const { profile, updateProfile } = useProfile();
  const { progress, updateProgress } = useProgress();

  useEffect(() => {
    getTodayMission().then((m) => setMission(m || null));
  }, []);

  const mark = async (completed: boolean) => {
    if (!mission || !profile) return;
    const updated: Mission = {
      ...mission,
      attempted: true,
      completed,
      completedAt: completed ? new Date().toISOString() : undefined,
    };
    await StorageService.saveMission(updated);
    setMission(updated);

    const streak = updateStreak(profile.lastStudyDate, profile.streak);
    await updateProfile({ ...streak });

    if (completed && progress) {
      const missionsCompleted = progress.missionsCompleted + 1;
      const communicationScore = calculateCommunicationScore({
        ...progress,
        conversation: Math.min(100, progress.conversation + 2),
      });
      await updateProgress({ missionsCompleted, communicationScore });
    }
  };

  return (
    <>
      <Layout title="🎯 Missão do Dia" showMenu>
        <div className="px-4 py-8 max-w-lg mx-auto space-y-4">
          <p className="text-sm text-text-muted">{formatDate()}</p>
          {mission ? (
            <Card>
              <p className="text-lg font-bold mb-2">{mission.phrase}</p>
              <p className="text-primary text-xl">"{mission.german}"</p>
              <p className="text-sm text-text-muted mt-3">{mission.context}</p>
              <button
                onClick={() => getVoiceService().speak(mission.german)}
                className="mt-4 text-accent"
              >
                🔊 Ouvir
              </button>
            </Card>
          ) : (
            <p>Carregando missão...</p>
          )}

          <p className="font-medium text-center pt-4">Você conseguiu usar esta frase hoje?</p>
          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => mark(true)} className="py-4 rounded-2xl bg-success/20 text-success font-bold">
              ✅ SIM
            </button>
            <button onClick={() => mark(false)} className="py-4 rounded-2xl bg-error/20 text-error font-bold">
              ❌ NÃO
            </button>
          </div>
          {mission?.attempted && (
            <p className="text-center text-sm text-text-muted">
              {mission.completed ? 'Registrado. Isso vale como uso real.' : 'Sem problema. Tente de novo amanhã — ou agora, em voz alta.'}
            </p>
          )}
        </div>
      </Layout>
      <BottomNav />
    </>
  );
}
