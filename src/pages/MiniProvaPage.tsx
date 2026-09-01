import { useEffect, useState, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { BottomNav } from '@/components/layout/BottomNav';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { IconBack } from '@/components/ui/Icons';
import { useProfile } from '@/hooks/useProfile';
import { MemoryService } from '@/services/learning/MemoryService';
import { StorageService } from '@/services/storage/StorageService';
import { buildMiniProvaContext } from '@/services/teacher/MiniProvaEngine';
import { storeMiniProvaContext } from '@/services/teacher/MiniProvaIntent';

const GLASS: CSSProperties = {
  background: 'rgba(15, 23, 42, 0.65)',
  border: '1px solid rgba(255, 255, 255, 0.08)',
  backdropFilter: 'blur(16px)',
  WebkitBackdropFilter: 'blur(16px)',
};

export function MiniProvaPage() {
  const { profile, loading } = useProfile();
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [questionCount, setQuestionCount] = useState(0);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    if (!profile) return;
    void (async () => {
      const learning = await MemoryService.loadProfile(profile);
      const phrases = await StorageService.getAllPhrases();
      const ctx = buildMiniProvaContext(learning, phrases);
      setQuestionCount(ctx?.questions.length ?? 0);
      setReady(true);
    })();
  }, [profile]);

  if (loading || !profile || !ready) return <LoadingScreen />;

  const startExam = async () => {
    if (starting) return;
    setStarting(true);
    try {
      const learning = await MemoryService.loadProfile(profile);
      const phrases = await StorageService.getAllPhrases();
      const ctx = buildMiniProvaContext(learning, phrases);
      if (!ctx) {
        setStarting(false);
        return;
      }
      storeMiniProvaContext(ctx);
      navigate('/sessao?type=miniprova');
    } finally {
      setStarting(false);
    }
  };

  return (
    <div className="flex flex-col h-full max-w-md mx-auto" style={{ background: '#070A12' }}>
      <header className="px-5 pt-4 safe-top shrink-0 flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate(-1)}
          aria-label="Zurück"
          className="w-10 h-10 rounded-full flex items-center justify-center text-white shrink-0"
          style={GLASS}
        >
          <IconBack size={18} />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="text-[17px] font-bold text-white leading-tight font-[family-name:var(--font-display)]">
            MINI-PRÜFUNG
          </h1>
          <p className="text-[12px] text-[#94A3B8] mt-0.5">Was kannst du schon auf Deutsch?</p>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto scrollbar-hide px-5 pt-4 pb-28 space-y-5">
        {questionCount < 3 ? (
          <div className="rounded-[22px] p-5 text-center" style={GLASS}>
            <p className="text-[14px] text-[#94A3B8] leading-relaxed">
              Noch nicht genug Inhalte für eine Mini-Prüfung. Lerne zuerst mehr Lektionen.
            </p>
          </div>
        ) : (
          <>
            <div className="rounded-[22px] p-5 space-y-3" style={GLASS}>
              <p className="text-[14px] text-white leading-relaxed">
                Echte Bewertung — nur Deutsch, keine Übersetzung.
              </p>
              <ul className="text-[12px] text-[#94A3B8] space-y-1.5 list-disc pl-4">
                <li>Verstehen und Sprechen</li>
                <li>Nur gelernte Inhalte</li>
                <li>Keine Hilfe während der Prüfung</li>
                <li>{questionCount} Fragen</li>
              </ul>
            </div>

            <button
              type="button"
              disabled={starting}
              onClick={() => void startExam()}
              className="w-full py-4 rounded-[18px] text-[15px] font-bold text-[#070A12] disabled:opacity-60"
              style={{
                background: 'linear-gradient(135deg, #A855F7 0%, #8B5CF6 55%, #00F2FE 100%)',
                boxShadow: '0 0 24px rgba(168,85,247,0.35)',
              }}
            >
              {starting ? 'Vorbereiten…' : '🎙️ Mini-Prüfung starten'}
            </button>
          </>
        )}
      </main>
      <BottomNav />
    </div>
  );
}
