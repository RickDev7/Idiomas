/**
 * Simulador — UI premium (DT).
 * Preserva SimulatorEngine / buildSimulatorContext / storeSimulatorContext.
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BottomNav } from '@/components/layout/BottomNav';
import {
  DTPage,
  DTMain,
  DTTopBar,
  DTSectionLabel,
  DTGlassCard,
  DTAudioOrb,
  DTNeonButton,
  DTBadge,
  glassStyle,
} from '@/components/dt';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { IconBolt, IconMic, IconSparkle, IconTarget } from '@/components/ui/Icons';
import { APP_ROUTES, goAprender, navigateBack } from '@/services/ui/AppRoutes';
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

const MODES: Array<{
  id: SimulatorMode;
  title: string;
  subtitle: string;
  tint: string;
  icon: typeof IconBolt;
}> = [
  {
    id: 'learned',
    title: 'Praticar o aprendido',
    subtitle: 'Repetir conteúdos recentes',
    tint: '#00F2FE',
    icon: IconBolt,
  },
  {
    id: 'weak',
    title: 'Pontos fracos',
    subtitle: 'O que ainda é difícil',
    tint: '#F97316',
    icon: IconTarget,
  },
  {
    id: 'free',
    title: 'Fala livre',
    subtitle: 'Tudo o que você já consegue',
    tint: '#8B5CF6',
    icon: IconMic,
  },
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
    <DTPage>
      <DTTopBar
        title="Simulador"
        subtitle={
          preview
            ? `${preview.emoji} ${preview.titleDe}`
            : 'Fale o máximo de alemão possível — sem pressão'
        }
        onBack={() => navigateBack(navigate, APP_ROUTES.home)}
        right={<DTBadge color="#00F2FE">Imersão</DTBadge>}
      />

      <DTMain className="pt-4 space-y-5">
        {scenarios.length === 0 ? (
          <DTGlassCard className="p-6 text-center">
            <p className="text-[14px] text-[#CBD5E1] leading-relaxed">
              Ainda não há conteúdo suficiente. Aprenda algumas lições L0 primeiro.
            </p>
            <div className="mt-5">
              <DTNeonButton onClick={() => goAprender(navigate)}>Ir para Aprender</DTNeonButton>
            </div>
          </DTGlassCard>
        ) : (
          <>
            <DTGlassCard variant="cyan" className="p-5 relative overflow-hidden">
              <span
                className="absolute -right-10 -top-10 w-44 h-44 rounded-full pointer-events-none"
                style={{ background: 'radial-gradient(circle, rgba(0,242,254,0.28), transparent 70%)' }}
              />
              <DTSectionLabel className="relative">Cenário</DTSectionLabel>
              <p className="relative mt-2 text-[24px] font-extrabold text-white leading-tight font-[family-name:var(--font-display)]">
                {preview?.emoji} {preview?.titleDe}
              </p>
              <p className="relative mt-2 text-[14px] text-[#CBD5E1] leading-snug">
                {preview?.settingDe}
                {preview?.roleDe ? ` · ${preview.roleDe}` : ''}
              </p>
              <div className="relative mt-5 flex justify-center">
                <DTAudioOrb state="idle" size={168} />
              </div>
              <p className="relative mt-3 text-center text-[12px] text-[#64748B]">
                Ouvindo · Você falando · Professor falando · Pensando…
              </p>
              <p className="relative mt-1 text-center text-[11px] text-[#64748B]">
                Só alemão durante a simulação — sem tradução.
              </p>
            </DTGlassCard>

            <section className="space-y-2.5">
              <DTSectionLabel>Modo</DTSectionLabel>
              {MODES.map((m) => {
                const active = mode === m.id;
                const Icon = m.icon;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setMode(m.id)}
                    className="w-full rounded-[20px] px-4 py-4 text-left flex items-start gap-3 transition-transform duration-200 active:scale-[0.98]"
                    style={{
                      ...glassStyle,
                      border: active ? `1px solid ${m.tint}88` : glassStyle.border,
                      boxShadow: active ? `0 0 18px ${m.tint}33` : undefined,
                    }}
                  >
                    <span
                      className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0"
                      style={{
                        background: `${m.tint}22`,
                        color: m.tint,
                        boxShadow: active ? `0 0 14px ${m.tint}44` : undefined,
                      }}
                    >
                      <Icon size={18} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[15px] font-bold text-white">{m.title}</span>
                      <span className="block text-[12px] text-[#94A3B8] mt-1">{m.subtitle}</span>
                    </span>
                  </button>
                );
              })}
            </section>

            <section>
              <DTSectionLabel className="mb-2">Duração</DTSectionLabel>
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
              <DTSectionLabel className="mb-2">Estilo</DTSectionLabel>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setTrainingStyle('training')}
                  className="flex-1 py-3 rounded-[14px] text-[13px] font-semibold"
                  style={{
                    ...glassStyle,
                    color: trainingStyle === 'training' ? '#A855F7' : '#94A3B8',
                    border:
                      trainingStyle === 'training'
                        ? '1px solid rgba(168,85,247,0.45)'
                        : glassStyle.border,
                  }}
                >
                  Com ajuda
                </button>
                <button
                  type="button"
                  onClick={() => setTrainingStyle('real_test')}
                  className="flex-1 py-3 rounded-[14px] text-[13px] font-semibold"
                  style={{
                    ...glassStyle,
                    color: trainingStyle === 'real_test' ? '#F97316' : '#94A3B8',
                    border:
                      trainingStyle === 'real_test'
                        ? '1px solid rgba(249,115,22,0.45)'
                        : glassStyle.border,
                  }}
                >
                  Teste real
                </button>
              </div>
            </section>

            <button
              type="button"
              onClick={() => setSurprise((v) => !v)}
              className="w-full rounded-[16px] px-4 py-3.5 text-left flex items-center gap-3"
              style={{
                ...glassStyle,
                border: surprise ? '1px dashed rgba(251,191,36,0.55)' : glassStyle.border,
              }}
            >
              <span
                className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                style={{
                  background: surprise ? 'rgba(251,191,36,0.18)' : 'rgba(255,255,255,0.06)',
                  color: surprise ? '#FBBF24' : '#94A3B8',
                }}
              >
                <IconSparkle size={16} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] font-semibold text-white">
                  Surpresa {surprise ? '· ligada' : ''}
                </span>
                <span className="block text-[11px] text-[#64748B] mt-0.5">
                  O sistema escolhe um cenário adequado
                </span>
              </span>
            </button>

            <DTNeonButton disabled={starting} onClick={() => void startSimulation()}>
              {starting ? 'Preparando…' : 'Começar simulação'}
            </DTNeonButton>
          </>
        )}
      </DTMain>
      <BottomNav />
    </DTPage>
  );
}
