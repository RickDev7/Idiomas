/**
 * Simulator — redesign visual Fase 2.
 * Preserva SimulatorEngine / ImmersionPolicy / sessão Live existente.
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BottomNav } from '@/components/layout/BottomNav';
import { GlassCard, glassStyle } from '@/components/ui/GlassCard';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { LiveAudioOrb } from '@/components/ui/VoiceOrb';
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
  SimulatorScenario,
  SimulatorTrainingStyle,
} from '@/services/teacher/SimulatorTypes';

const MODES: Array<{ id: SimulatorMode; title: string; subtitle: string; tint: string }> = [
  { id: 'learned', title: 'Gelerntes üben', subtitle: 'Neue Inhalte wiederholen', tint: '#00F2FE' },
  { id: 'weak', title: 'Schwächen', subtitle: 'Was noch schwer fällt', tint: '#F97316' },
  { id: 'free', title: 'Freies Sprechen', subtitle: 'Alles was du schon kannst', tint: '#8B5CF6' },
];

const DURATIONS: SimulatorDurationMinutes[] = [10, 20, 30, 60];

export function SimulatorPage() {
  const { profile, loading } = useProfile();
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [scenarios, setScenarios] = useState<SimulatorScenario[]>([]);
  const [mode, setMode] = useState<SimulatorMode>('learned');
  const [duration, setDuration] = useState<SimulatorDurationMinutes>(10);
  const [trainingStyle, setTrainingStyle] = useState<SimulatorTrainingStyle>('training');
  const [surprise, setSurprise] = useState(false);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    if (!profile) return;
    void (async () => {
      const learning = await MemoryService.loadProfile(profile);
      setScenarios(listCompatibleScenarios(learning));
      setReady(true);
    })();
  }, [profile]);

  const preview = useMemo(() => scenarios[0] || null, [scenarios]);

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
    <div className="flex flex-col h-full max-w-md mx-auto dt-page">
      <header className="px-5 pt-4 safe-top shrink-0 flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate(-1)}
          aria-label="Zurück"
          className="w-10 h-10 rounded-full flex items-center justify-center text-white shrink-0"
          style={glassStyle}
        >
          <IconBack size={18} />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="text-[18px] font-bold text-white font-[family-name:var(--font-display)]">
            SIMULATOR
          </h1>
          <p className="text-[12px] text-[#CBD5E1]">
            {preview ? preview.titleDe : 'Sprich so viel Deutsch wie möglich.'}
          </p>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto scrollbar-hide px-5 pt-4 pb-28 space-y-5">
        {scenarios.length === 0 ? (
          <GlassCard className="p-5 text-center">
            <p className="text-[14px] text-[#CBD5E1] leading-relaxed">
              Noch nicht genug Inhalte. Lerne zuerst einige L0-Lektionen.
            </p>
            <button
              type="button"
              onClick={() => navigate('/aprender')}
              className="mt-4 px-5 py-2.5 rounded-full text-[13px] font-bold text-white"
              style={{
                background: 'linear-gradient(135deg, #00F2FE, #8B5CF6)',
              }}
            >
              Ir para Aprender
            </button>
          </GlassCard>
        ) : (
          <>
            <GlassCard variant="cyan" className="p-5 relative overflow-hidden">
              <span
                className="absolute -right-10 -top-10 w-40 h-40 rounded-full pointer-events-none"
                style={{ background: 'radial-gradient(circle, rgba(0,242,254,0.25), transparent 70%)' }}
              />
              <p className="dt-label relative">Szenario</p>
              <p className="relative mt-2 text-[22px] font-bold text-white font-[family-name:var(--font-display)]">
                {preview?.emoji} {preview?.titleDe}
              </p>
              <p className="relative mt-2 text-[14px] text-[#CBD5E1] leading-snug">
                {preview?.settingDe}
                {preview?.roleDe ? ` ${preview.roleDe}` : ''}
              </p>
              <div className="relative mt-4 flex justify-center">
                <LiveAudioOrb state="idle" size={160} />
              </div>
              <p className="relative mt-2 text-center text-[12px] text-[#64748B]">
                Estados ao vivo: Zuhören · Du sprichst · Professor spricht · Thinking…
              </p>
              <p className="relative mt-1 text-center text-[11px] text-[#64748B]">
                Immersion: nur Deutsch — keine Übersetzung.
              </p>
            </GlassCard>

            <section className="space-y-2.5">
              {MODES.map((m) => {
                const active = mode === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setMode(m.id)}
                    className="w-full rounded-[20px] px-4 py-4 text-left transition-transform duration-200 active:scale-[0.98]"
                    style={{
                      ...glassStyle,
                      border: active ? `1px solid ${m.tint}88` : glassStyle.border,
                      boxShadow: active ? `0 0 18px ${m.tint}33` : undefined,
                    }}
                  >
                    <p className="text-[15px] font-bold text-white">{m.title}</p>
                    <p className="text-[12px] text-[#94A3B8] mt-1">{m.subtitle}</p>
                  </button>
                );
              })}
            </section>

            <section>
              <p className="dt-label mb-2">Dauer</p>
              <div className="flex gap-2">
                {DURATIONS.map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDuration(d)}
                    className="flex-1 py-3 rounded-[14px] text-[14px] font-bold transition-colors duration-200"
                    style={{
                      ...glassStyle,
                      color: duration === d ? '#00F2FE' : '#94A3B8',
                      border: duration === d ? '1px solid rgba(0,242,254,0.45)' : glassStyle.border,
                    }}
                  >
                    {d} min
                  </button>
                ))}
              </div>
            </section>

            <section>
              <p className="dt-label mb-2">Stil</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setTrainingStyle('training')}
                  className="flex-1 py-3 rounded-[14px] text-[13px] font-semibold"
                  style={{
                    ...glassStyle,
                    color: trainingStyle === 'training' ? '#A855F7' : '#94A3B8',
                    border: trainingStyle === 'training' ? '1px solid rgba(168,85,247,0.45)' : glassStyle.border,
                  }}
                >
                  Mit Hilfe
                </button>
                <button
                  type="button"
                  onClick={() => setTrainingStyle('real_test')}
                  className="flex-1 py-3 rounded-[14px] text-[13px] font-semibold"
                  style={{
                    ...glassStyle,
                    color: trainingStyle === 'real_test' ? '#F97316' : '#94A3B8',
                    border: trainingStyle === 'real_test' ? '1px solid rgba(249,115,22,0.45)' : glassStyle.border,
                  }}
                >
                  Echter Test
                </button>
              </div>
            </section>

            <button
              type="button"
              onClick={() => setSurprise((v) => !v)}
              className="w-full rounded-[16px] px-4 py-3 text-left"
              style={{
                ...glassStyle,
                border: surprise ? '1px dashed rgba(251,191,36,0.5)' : glassStyle.border,
              }}
            >
              <p className="text-[14px] font-semibold text-white">
                Überraschung {surprise ? '· an' : ''}
              </p>
              <p className="text-[11px] text-[#64748B] mt-0.5">Das System wählt ein passendes Szenario</p>
            </button>

            <button
              type="button"
              disabled={starting}
              onClick={() => void startSimulation()}
              className="w-full py-4 rounded-[20px] text-[15px] font-bold text-[#050816] disabled:opacity-60 active:scale-[0.98] transition-transform duration-200"
              style={{
                background: 'linear-gradient(135deg, #00F2FE 0%, #8B5CF6 55%, #F97316 100%)',
                boxShadow: '0 0 28px rgba(0,242,254,0.35)',
              }}
            >
              {starting ? 'Vorbereiten…' : 'Simulation starten'}
            </button>
          </>
        )}
      </main>
      <BottomNav />
    </div>
  );
}
