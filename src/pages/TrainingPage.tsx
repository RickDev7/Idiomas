/**
 * Aprender — aula voice-first (Training Cockpit).
 * Visual only: frase real do ChunkTracker + mic que entra na sessão Live existente (/sessao).
 * Sem planner, sem duração, sem novo motor.
 */
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BottomNav } from '@/components/layout/BottomNav';
import { DTPage, DTAudioWaveform, type OrbState } from '@/components/dt';
import { IconBack, IconMic, IconLightbulb, IconChat } from '@/components/ui/Icons';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { useProfile } from '@/hooks/useProfile';
import { useChunkTracker } from '@/hooks/useChunkTracker';
import { SoundService } from '@/services/ui/SoundService';
import { getTodaySession } from '@/services/storage/initData';
import { getIncompleteSession } from '@/services/teacher/sessionContinuity';

/** Etapas da metodologia (rótulos de UI) — progresso vem do ChunkTracker real. */
const STAGE_COUNT = 5;

const STAGE_TIPS = [
  'Ouça o modelo e repita com calma.',
  'Troque só o slot — mantenha a estrutura.',
  'Fale com ajuda se precisar.',
  'Tente sozinho, sem olhar a dica.',
  'Use a frase em uma conversa curta.',
] as const;

type LessonUiState = 'ready' | 'starting';

function statusCopy(ui: LessonUiState, incomplete: boolean): { orb: OrbState; line: string; mic: string } {
  if (ui === 'starting') {
    return { orb: 'processing', line: 'Entrando na aula…', mic: 'Abrindo sessão' };
  }
  if (incomplete) {
    return { orb: 'idle', line: 'Pronto para continuar', mic: 'Toque para continuar' };
  }
  return { orb: 'idle', line: 'Pronto para treinar', mic: 'Toque para falar' };
}

export function TrainingPage() {
  const navigate = useNavigate();
  const { profile, loading } = useProfile();
  const { activeChunk, displaySlots } = useChunkTracker();
  const [uiState, setUiState] = useState<LessonUiState>('ready');
  const [showTip, setShowTip] = useState(false);
  const [showExample, setShowExample] = useState(false);
  const incomplete = useMemo(() => getIncompleteSession(), []);

  if (loading || !profile) return <LoadingScreen />;

  const variations = displaySlots.filter((s) => s.kind === 'variation');
  const stepIndex = Math.min(STAGE_COUNT - 1, Math.max(0, variations.length));
  const stepNumber = stepIndex + 1;
  const progressPct = (stepNumber / STAGE_COUNT) * 100;

  const german = (activeChunk.german || '').trim() || '—';
  const portuguese = (activeChunk.portuguese || '').trim();

  const exampleGerman = (() => {
    const first = variations.find((s) => s.kind === 'variation');
    if (first && first.kind === 'variation' && first.data.german) return first.data.german;
    return null;
  })();

  const { orb, line, mic } = statusCopy(uiState, !!incomplete);
  const tipText = STAGE_TIPS[stepIndex];

  const enterLesson = async () => {
    if (uiState === 'starting') return;
    setUiState('starting');
    try {
      await getTodaySession(profile);
      SoundService.play('start');
      const type = profile.firstLessonComplete ? 'lesson' : 'first';
      navigate(`/sessao?type=${type}`);
    } catch {
      setUiState('ready');
    }
  };

  return (
    <DTPage className="learn-cockpit">
      {/* Header compacto */}
      <header className="px-4 pt-3 safe-top shrink-0">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            aria-label="Voltar"
            className="w-9 h-9 rounded-full flex items-center justify-center text-white shrink-0"
            style={{ background: 'rgba(255,255,255,0.05)' }}
          >
            <IconBack size={18} />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="text-[16px] font-extrabold text-white uppercase tracking-wide font-[family-name:var(--font-display)]">
              Aprender
            </h1>
            <p className="text-[11px] text-[#94A3B8] mt-0.5">Aula personalizada</p>
          </div>
          <span className="text-[12px] font-bold text-[#C4B5FD] tabular-nums shrink-0">
            {stepNumber} / {STAGE_COUNT}
          </span>
        </div>

        {/* Linha fina de progresso */}
        <div className="mt-3 h-[3px] rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${progressPct}%`,
              background: 'linear-gradient(90deg, #8B5CF6, #00F2FE)',
              boxShadow: '0 0 10px rgba(0,242,254,0.45)',
            }}
          />
        </div>
      </header>

      <main className="flex-1 flex flex-col min-h-0 px-4 pb-28 pt-3 overflow-y-auto scrollbar-hide">
        {/* Frase protagonista */}
        <section className="learn-phrase-stage relative flex-1 flex flex-col items-center justify-center min-h-[240px]">
          <div className="learn-phrase-glow" aria-hidden />
          <div className="learn-phrase-arc" aria-hidden />

          <p className="relative z-[1] text-[10px] font-semibold uppercase tracking-[0.18em] text-[#64748B] mb-3">
            {incomplete ? 'Continuar de onde parou' : 'Repita em alemão'}
          </p>

          <h2 className="relative z-[1] learn-phrase-de text-center px-2">
            {german}
          </h2>

          {portuguese ? (
            <p className="relative z-[1] mt-3 text-[15px] text-[#94A3B8] text-center max-w-[300px] leading-snug">
              {portuguese}
            </p>
          ) : null}

          {/* Mini áudio sob a frase */}
          <div className="relative z-[1] mt-5 w-full max-w-[200px]">
            <DTAudioWaveform active={orb === 'speaking' || orb === 'listening' || uiState === 'ready'} bars={14} />
          </div>

          {(showTip || showExample) && (
            <div className="relative z-[1] mt-4 w-full max-w-[320px] px-4 py-3 rounded-[16px] text-center"
              style={{ background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.28)' }}
            >
              {showTip ? (
                <p className="text-[13px] text-[#E2E8F0] leading-snug">{tipText}</p>
              ) : null}
              {showExample ? (
                <p className="text-[14px] font-semibold text-white mt-0.5">
                  {exampleGerman || portuguese || '—'}
                </p>
              ) : null}
            </div>
          )}
        </section>

        {/* Controles cockpit + mic */}
        <section className="shrink-0 pt-2 pb-1">
          <p
            className="text-center text-[11px] font-bold uppercase tracking-[0.14em] mb-3"
            style={{
              color: orb === 'processing' ? '#94A3B8' : '#A78BFA',
              textShadow: orb === 'processing' ? undefined : '0 0 12px rgba(139,92,246,0.35)',
            }}
          >
            {line}
          </p>

          <div className="flex items-end justify-center gap-6">
            {/* Dica */}
            <button
              type="button"
              onClick={() => {
                setShowTip((v) => !v);
                setShowExample(false);
              }}
              className="learn-cockpit-ctrl flex flex-col items-center gap-1.5 active:scale-95 transition-transform"
              aria-pressed={showTip}
            >
              <span
                className="w-12 h-12 rounded-2xl flex items-center justify-center"
                style={{
                  background: showTip ? 'rgba(249,115,22,0.22)' : 'rgba(255,255,255,0.05)',
                  border: showTip ? '1px solid rgba(249,115,22,0.5)' : '1px solid rgba(255,255,255,0.08)',
                  color: showTip ? '#F97316' : '#94A3B8',
                }}
              >
                <IconLightbulb size={20} />
              </span>
              <span className="text-[10px] font-semibold text-[#64748B]">Dica</span>
            </button>

            {/* Microfone dominante */}
            <div className="flex flex-col items-center">
              <button
                type="button"
                onClick={() => void enterLesson()}
                disabled={uiState === 'starting'}
                aria-label={mic}
                className="learn-mic-btn relative active:scale-[0.96] transition-transform disabled:opacity-80"
              >
                <span className={`learn-mic-halo ${orb === 'processing' ? 'learn-mic-halo--busy' : 'learn-mic-halo--ready'}`} aria-hidden />
                <span className="learn-mic-core relative z-[1] w-[96px] h-[96px] rounded-full flex items-center justify-center">
                  {orb === 'processing' ? (
                    <span className="flex gap-1.5" aria-hidden>
                      <span className="w-2 h-2 rounded-full bg-white animate-dot-bounce" />
                      <span className="w-2 h-2 rounded-full bg-white animate-dot-bounce" style={{ animationDelay: '0.15s' }} />
                      <span className="w-2 h-2 rounded-full bg-white animate-dot-bounce" style={{ animationDelay: '0.3s' }} />
                    </span>
                  ) : (
                    <IconMic size={36} className="text-white" />
                  )}
                </span>
              </button>
              <p className="mt-2.5 text-[12px] font-bold text-white">{mic}</p>
            </div>

            {/* Exemplo */}
            <button
              type="button"
              onClick={() => {
                setShowExample((v) => !v);
                setShowTip(false);
              }}
              className="learn-cockpit-ctrl flex flex-col items-center gap-1.5 active:scale-95 transition-transform"
              aria-pressed={showExample}
            >
              <span
                className="w-12 h-12 rounded-2xl flex items-center justify-center"
                style={{
                  background: showExample ? 'rgba(0,242,254,0.18)' : 'rgba(255,255,255,0.05)',
                  border: showExample ? '1px solid rgba(0,242,254,0.45)' : '1px solid rgba(255,255,255,0.08)',
                  color: showExample ? '#00F2FE' : '#94A3B8',
                }}
              >
                <IconChat size={20} />
              </span>
              <span className="text-[10px] font-semibold text-[#64748B]">Exemplo</span>
            </button>
          </div>
        </section>
      </main>

      <BottomNav />
    </DTPage>
  );
}
