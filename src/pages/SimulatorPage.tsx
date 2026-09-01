import { useEffect, useState, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { BottomNav } from '@/components/layout/BottomNav';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { IconBack } from '@/components/ui/Icons';
import { useProfile } from '@/hooks/useProfile';
import { MemoryService } from '@/services/learning/MemoryService';
import { StorageService } from '@/services/storage/StorageService';
import {
  buildSimulatorContext,
  listCompatibleScenarios,
} from '@/services/teacher/SimulatorEngine';
import { storeSimulatorContext } from '@/services/teacher/SimulatorIntent';
import type {
  SimulatorDurationMinutes,
  SimulatorMode,
  SimulatorTrainingStyle,
} from '@/services/teacher/SimulatorTypes';

const GLASS: CSSProperties = {
  background: 'rgba(15, 23, 42, 0.65)',
  border: '1px solid rgba(255, 255, 255, 0.08)',
  backdropFilter: 'blur(16px)',
  WebkitBackdropFilter: 'blur(16px)',
};

const MODES: Array<{ id: SimulatorMode; emoji: string; title: string; subtitle: string }> = [
  { id: 'learned', emoji: '📚', title: 'Gelerntes üben', subtitle: 'Neue Inhalte wiederholen' },
  { id: 'weak', emoji: '🔄', title: 'Schwächen', subtitle: 'Was noch schwer fällt' },
  { id: 'free', emoji: '🗣️', title: 'Freies Sprechen', subtitle: 'Alles was du schon kannst' },
];

const DURATIONS: SimulatorDurationMinutes[] = [10, 20, 30, 60];

export function SimulatorPage() {
  const { profile, loading } = useProfile();
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [hasContent, setHasContent] = useState(false);
  const [mode, setMode] = useState<SimulatorMode>('learned');
  const [duration, setDuration] = useState<SimulatorDurationMinutes>(10);
  const [trainingStyle, setTrainingStyle] = useState<SimulatorTrainingStyle>('training');
  const [surprise, setSurprise] = useState(false);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    if (!profile) return;
    void (async () => {
      const learning = await MemoryService.loadProfile(profile);
      const scenarios = listCompatibleScenarios(learning);
      setHasContent(scenarios.length > 0);
      setReady(true);
    })();
  }, [profile]);

  if (loading || !profile || !ready) return <LoadingScreen />;

  const startSimulation = async () => {
    if (starting) return;
    setStarting(true);
    try {
      const learning = await MemoryService.loadProfile(profile);
      const phrases = await StorageService.getAllPhrases();
      const ctx = buildSimulatorContext({
        learning,
        phrases,
        mode,
        durationMinutes: duration,
        trainingStyle,
        surprise,
      });
      if (!ctx) {
        setStarting(false);
        return;
      }
      storeSimulatorContext(ctx);
      navigate('/sessao?type=simulator');
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
            SIMULATOR
          </h1>
          <p className="text-[12px] text-[#94A3B8] mt-0.5">Sprich so viel Deutsch wie möglich.</p>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto scrollbar-hide px-5 pt-4 pb-28 space-y-5">
        {!hasContent ? (
          <div className="rounded-[22px] p-5 text-center" style={GLASS}>
            <p className="text-[14px] text-[#94A3B8] leading-relaxed">
              Noch nicht genug Inhalte. Lerne zuerst einige L0-Lektionen.
            </p>
          </div>
        ) : (
          <>
            <section className="space-y-2.5">
              {MODES.map((m) => {
                const active = mode === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setMode(m.id)}
                    className="w-full rounded-[20px] px-4 py-4 text-left transition-transform active:scale-[0.98]"
                    style={{
                      ...GLASS,
                      border: active ? '1px solid rgba(0,242,254,0.45)' : GLASS.border,
                      boxShadow: active ? '0 0 20px rgba(0,242,254,0.15)' : undefined,
                    }}
                  >
                    <p className="text-[15px] font-bold text-white">
                      {m.emoji} {m.title}
                    </p>
                    <p className="text-[12px] text-[#94A3B8] mt-1">{m.subtitle}</p>
                  </button>
                );
              })}
            </section>

            <section>
              <p className="text-[11px] uppercase tracking-[0.16em] font-semibold text-[#64748b] mb-2">
                Dauer
              </p>
              <div className="flex gap-2">
                {DURATIONS.map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDuration(d)}
                    className="flex-1 py-3 rounded-[14px] text-[14px] font-bold"
                    style={{
                      ...GLASS,
                      color: duration === d ? '#00F2FE' : '#94A3B8',
                      border: duration === d ? '1px solid rgba(0,242,254,0.45)' : GLASS.border,
                    }}
                  >
                    {d} min
                  </button>
                ))}
              </div>
            </section>

            <section>
              <p className="text-[11px] uppercase tracking-[0.16em] font-semibold text-[#64748b] mb-2">
                Stil
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setTrainingStyle('training')}
                  className="flex-1 py-3 rounded-[14px] text-[13px] font-semibold"
                  style={{
                    ...GLASS,
                    color: trainingStyle === 'training' ? '#A855F7' : '#94A3B8',
                    border: trainingStyle === 'training' ? '1px solid rgba(168,85,247,0.45)' : GLASS.border,
                  }}
                >
                  🧠 Mit Hilfe
                </button>
                <button
                  type="button"
                  onClick={() => setTrainingStyle('real_test')}
                  className="flex-1 py-3 rounded-[14px] text-[13px] font-semibold"
                  style={{
                    ...GLASS,
                    color: trainingStyle === 'real_test' ? '#FF512F' : '#94A3B8',
                    border: trainingStyle === 'real_test' ? '1px solid rgba(255,81,47,0.45)' : GLASS.border,
                  }}
                >
                  🔥 Echter Test
                </button>
              </div>
            </section>

            <button
              type="button"
              onClick={() => setSurprise((v) => !v)}
              className="w-full rounded-[16px] px-4 py-3 text-left"
              style={{
                ...GLASS,
                border: surprise ? '1px dashed rgba(251,191,36,0.5)' : GLASS.border,
              }}
            >
              <p className="text-[14px] font-semibold text-white">
                🎲 Überraschung {surprise ? '· an' : ''}
              </p>
              <p className="text-[11px] text-[#64748b] mt-0.5">Das System wählt ein passendes Szenario</p>
            </button>

            <button
              type="button"
              disabled={starting}
              onClick={() => void startSimulation()}
              className="w-full py-4 rounded-[18px] text-[15px] font-bold text-[#070A12] disabled:opacity-60"
              style={{
                background: 'linear-gradient(135deg, #00F2FE 0%, #8B5CF6 55%, #FF512F 100%)',
                boxShadow: '0 0 24px rgba(0,242,254,0.35)',
              }}
            >
              {starting ? 'Vorbereiten…' : '🎙️ Simulation starten'}
            </button>
          </>
        )}
      </main>
      <BottomNav />
    </div>
  );
}
