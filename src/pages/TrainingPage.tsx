/**
 * Aprender — redesenho visual de TrainingPage.
 * Representa o fluxo pedagógico existente; não cria engine nova.
 */
import { useNavigate } from 'react-router-dom';
import { BottomNav } from '@/components/layout/BottomNav';
import { GlassCard, glassStyle } from '@/components/ui/GlassCard';
import { IconBack, IconMic } from '@/components/ui/Icons';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { useProfile } from '@/hooks/useProfile';
import { useChunkTracker } from '@/hooks/useChunkTracker';
import { SoundService } from '@/services/ui/SoundService';
import { getTodaySession } from '@/services/storage/initData';

const STAGES = [
  { id: 'modelo', label: 'MODELO', desc: 'Ouça e compreenda' },
  { id: 'sub', label: 'SUBSTITUIÇÃO', desc: 'Troque o slot' },
  { id: 'ajuda', label: 'PRODUÇÃO COM AJUDA', desc: 'Fale com suporte' },
  { id: 'indep', label: 'PRODUÇÃO INDEPENDENTE', desc: 'Fale sozinho' },
  { id: 'conv', label: 'CONVERSAÇÃO', desc: 'Use em contexto' },
] as const;

const DURATIONS = [10, 20, 30];

export function TrainingPage() {
  const navigate = useNavigate();
  const { profile, loading } = useProfile();
  const { activeChunk, displaySlots } = useChunkTracker();

  if (loading || !profile) return <LoadingScreen />;

  const startLesson = async (minutes?: number) => {
    await getTodaySession(profile);
    SoundService.play('start');
    const q = minutes ? `&duration=${minutes}` : '';
    const type = profile.firstLessonComplete ? 'lesson' : 'first';
    navigate(`/sessao?type=${type}${q}`);
  };

  const variations = displaySlots.filter((s) => s.kind === 'variation');
  const stepIndex = Math.min(STAGES.length - 1, Math.max(0, variations.length));

  return (
    <div className="flex flex-col h-full max-w-md mx-auto dt-page">
      <header className="px-5 pt-4 safe-top shrink-0 flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate(-1)}
          aria-label="Voltar"
          className="w-10 h-10 rounded-full flex items-center justify-center text-white"
          style={glassStyle}
        >
          <IconBack size={18} />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="dt-title">Aprender</h1>
          <p className="dt-muted">Aula personalizada</p>
        </div>
        <span
          className="shrink-0 px-3 py-1.5 rounded-full text-[11px] font-bold text-white"
          style={{
            background: 'rgba(139,92,246,0.25)',
            border: '1px solid rgba(168,85,247,0.45)',
          }}
        >
          {Math.min(variations.length + 1, 3)} / 3
        </span>
      </header>

      <main className="flex-1 overflow-y-auto scrollbar-hide px-5 pt-4 pb-28 space-y-5">
        <GlassCard variant="violet" className="p-6 text-center relative overflow-hidden">
          <span
            className="absolute -top-16 left-1/2 -translate-x-1/2 w-48 h-48 rounded-full pointer-events-none"
            style={{ background: 'radial-gradient(circle, rgba(139,92,246,0.35), transparent 70%)' }}
          />
          <p className="dt-label relative">Chunk atual</p>
          <p className="relative mt-3 text-[28px] font-bold text-white leading-tight font-[family-name:var(--font-display)]">
            {activeChunk.german || '—'}
          </p>
          <p className="relative mt-2 text-[14px] text-[#CBD5E1]">
            {activeChunk.portuguese || 'Ainda não disponível'}
          </p>
        </GlassCard>

        <section>
          <p className="dt-label mb-3">Fluxo pedagógico</p>
          <div className="space-y-2">
            {STAGES.map((stage, i) => {
              const active = i === stepIndex;
              const done = i < stepIndex;
              return (
                <div
                  key={stage.id}
                  className="flex items-center gap-3 px-3.5 py-3 rounded-[18px]"
                  style={{
                    ...glassStyle,
                    border: active
                      ? '1px solid rgba(0,242,254,0.45)'
                      : glassStyle.border,
                    boxShadow: active ? '0 0 18px rgba(0,242,254,0.2)' : undefined,
                    opacity: done || active ? 1 : 0.55,
                  }}
                >
                  <span
                    className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0"
                    style={{
                      background: active
                        ? 'linear-gradient(135deg, #00F2FE, #8B5CF6)'
                        : done
                          ? 'rgba(34,197,94,0.25)'
                          : 'rgba(255,255,255,0.06)',
                      color: '#fff',
                    }}
                  >
                    {done ? '✓' : i + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="text-[12px] font-bold text-white tracking-wide">{stage.label}</p>
                    <p className="text-[11px] text-[#64748B]">{stage.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {variations.length > 0 && (
          <section>
            <p className="dt-label mb-3">Suas variações de hoje</p>
            <div className="space-y-2">
              {variations.map((slot) =>
                slot.kind === 'variation' ? (
                  <GlassCard key={slot.data.phraseId} className="px-4 py-3">
                    <p className="text-[14px] font-semibold text-white">{slot.data.german}</p>
                    <p className="text-[11px] text-[#64748B]">{slot.data.portuguese}</p>
                  </GlassCard>
                ) : null,
              )}
            </div>
          </section>
        )}

        <section>
          <p className="dt-label mb-3">Duração da sessão</p>
          <div className="grid grid-cols-3 gap-2">
            {DURATIONS.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => { void startLesson(d); }}
                className="py-3 rounded-[18px] text-center active:scale-[0.97] transition-transform"
                style={glassStyle}
              >
                <span className="block text-[18px] font-bold text-white">{d}</span>
                <span className="text-[10px] text-[#64748B]">min</span>
              </button>
            ))}
          </div>
        </section>

        <button
          type="button"
          onClick={() => { void startLesson(); }}
          className="w-full flex flex-col items-center gap-3 py-4 active:scale-[0.98] transition-transform"
          aria-label="Fale você"
        >
          <span
            className="w-[88px] h-[88px] rounded-full flex items-center justify-center text-white"
            style={{
              background: 'linear-gradient(145deg, #A855F7, #8B5CF6)',
              boxShadow: '0 0 0 6px rgba(139,92,246,0.2), 0 0 40px rgba(139,92,246,0.55)',
            }}
          >
            <IconMic size={34} />
          </span>
          <span className="text-[14px] font-bold text-white">Fale você</span>
          <span className="text-[12px] text-[#64748B]">Inicia a sessão Gemini Live existente</span>
        </button>
      </main>
      <BottomNav />
    </div>
  );
}
