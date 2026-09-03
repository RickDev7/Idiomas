/**
 * Gemini Live — composição visual: Professor → Orb → Mic.
 * Lógica de áudio/sessão intacta (useGeminiLive). Sem input de texto.
 */
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { UserProfile } from '@/types';
import { useGeminiLive } from '@/hooks/useGeminiLive';
import { IconButton } from '@/components/ui/Button';
import {
  IconBack,
  IconHangup,
  IconRefresh,
  IconLightbulb,
  IconTurtle,
  IconStop,
  IconMic,
} from '@/components/ui/Icons';
import { toast } from '@/components/ui/Toast';
import { haptic } from '@/services/ui/UiPrefsService';
import { SoundService } from '@/services/ui/SoundService';
import { getVoiceService } from '@/services/voice/VoiceService';
import { stopAllAudio } from '@/services/voice/AudioPlayback';
import {
  SessionProgress,
  ConversationProgressBar,
} from '@/components/voice/VoicePanels';
import { MicroPracticePanel } from '@/components/voice/MicroPracticePanel';
import {
  translateGermanToPortuguese,
  cachedTranslation,
  separateTeacherSpeech,
} from '@/services/ai/TranslationService';
import { DTAudioOrb, type OrbState } from '@/components/dt';

/** Feedback em alemão para modos de imersão (Simulador / Mini Prova). */
function deriveImmersionFeedback(opts: {
  microFeedback: string | null;
  pedagogicalAction: string | null;
  responseStatus: 'processing' | 'received' | 'none';
  microActive: boolean;
}): { text: string | null; tone: 'success' | 'adjust' | 'neutral' } {
  if (opts.responseStatus !== 'received') return { text: null, tone: 'neutral' };
  if (opts.microFeedback?.trim()) {
    const t = opts.microFeedback.trim();
    const adjust = /fast|noch|wieder|korrig|fehl|hilfe/i.test(t);
    return adjust
      ? { text: 'Fast. Noch einmal.', tone: 'adjust' }
      : { text: 'Sehr gut!', tone: 'success' };
  }
  if (opts.microActive) return { text: null, tone: 'neutral' };
  const action = opts.pedagogicalAction || '';
  if (action === 'practice' || action === 'recall') {
    return { text: 'Fast. Noch einmal.', tone: 'adjust' };
  }
  if (action === 'transfer' || action === 'spontaneous' || action === 'converse' || action === 'introduce') {
    return { text: 'Sehr gut!', tone: 'success' };
  }
  return { text: null, tone: 'neutral' };
}

/** Feedback amigável a partir do estado pedagógico real — UI não inventa acerto/erro. */
function deriveFeedback(opts: {
  microFeedback: string | null;
  pedagogicalAction: string | null;
  responseStatus: 'processing' | 'received' | 'none';
  microActive: boolean;
}): { text: string | null; tone: 'success' | 'adjust' | 'neutral' } {
  if (opts.responseStatus !== 'received') return { text: null, tone: 'neutral' };
  if (opts.microFeedback?.trim()) {
    const t = opts.microFeedback.trim();
    const adjust = /quase|ajustar|corrig|erro|tente|review|falh|pronúncia|pronuncia/i.test(t);
    if (adjust) {
      if (/pronúncia|pronuncia/i.test(t)) {
        return { text: 'Quase. Vamos ajustar a pronúncia.', tone: 'adjust' };
      }
      return { text: 'Quase. Vamos tentar novamente.', tone: 'adjust' };
    }
    return { text: 'Perfeito! Muito bem!', tone: 'success' };
  }
  if (opts.microActive) return { text: null, tone: 'neutral' };
  const action = opts.pedagogicalAction || '';
  if (action === 'practice' || action === 'recall') {
    return { text: 'Quase. Vamos tentar novamente.', tone: 'adjust' };
  }
  if (action === 'transfer' || action === 'spontaneous' || action === 'converse' || action === 'introduce') {
    return { text: 'Perfeito! Muito bem!', tone: 'success' };
  }
  return { text: null, tone: 'neutral' };
}

function statusLinePt(opts: {
  liveState: string;
  userSpeaking: boolean;
  assistantSpeaking: boolean;
  teacherTurnStatus: string;
  awaitingProfessor: boolean;
  responseStatus: 'processing' | 'received' | 'none';
  started: boolean;
}): string {
  if (opts.liveState === 'connecting') return 'Conectando…';
  if (opts.liveState === 'reconnecting') return 'Reconectando…';
  if (opts.liveState === 'error') return 'Sem conexão';
  // Professor falando tem prioridade sobre "Sua vez" / aguardando.
  if (opts.assistantSpeaking || opts.teacherTurnStatus === 'RECEIVING') return 'Professor falando…';
  if (opts.awaitingProfessor) return 'Aguardando o professor…';
  // micActive/LISTENING ≠ fala real — só transcript RECEIVING do aluno
  if (opts.userSpeaking) return 'Você está falando…';
  if (opts.responseStatus === 'processing') return 'Pensando…';
  // "Sua vez" somente após professor ter terminado (COMPLETE) ou sessão pronta sem fala.
  if (opts.started && opts.teacherTurnStatus === 'COMPLETE') return 'Sua vez';
  if (opts.started) return 'Sua vez';
  return 'Toque para falar';
}

/** Exposto para testes de UI de turno. */
export { statusLinePt as liveStatusLinePt };

export function GeminiConversation({ profile, onFinish }: { profile: UserProfile; onFinish: () => void }) {
  const navigate = useNavigate();
  const live = useGeminiLive(profile);
  const [started, setStarted] = useState(false);
  const [showMicSettings, setShowMicSettings] = useState(false);
  const startLockRef = useRef(false);

  const [ptTranslation, setPtTranslation] = useState('');
  const translatedForRef = useRef('');

  const [responseStatus, setResponseStatus] = useState<'processing' | 'received' | 'none'>('none');
  const prevUserText = useRef('');
  const prevTargetRef = useRef<string | null>(null);

  useEffect(() => {
    if (live.error) toast(live.error, 'error');
  }, [live.error]);

  useEffect(() => {
    if (!live.simulatorMode || !live.simulatorTimeUp) return;
    SoundService.play('end');
    live.end('COMPLETED');
    onFinish();
  }, [live.simulatorMode, live.simulatorTimeUp, live, onFinish]);

  useEffect(() => {
    if (!live.miniProvaMode || !live.miniProvaComplete) return;
    SoundService.play('end');
    live.end('COMPLETED');
    onFinish();
  }, [live.miniProvaMode, live.miniProvaComplete, live, onFinish]);

  useEffect(() => {
    if (live.immersionMode) {
      setPtTranslation('');
      translatedForRef.current = '';
      return;
    }
    const speech = separateTeacherSpeech(live.assistantText);
    const german = (speech.german || live.assistantText).trim();
    if (!german || live.teacherTurnStatus !== 'COMPLETE') {
      if (live.teacherTurnStatus === 'RECEIVING') {
        setPtTranslation('');
        translatedForRef.current = '';
      }
      return;
    }
    if (translatedForRef.current === german) return;
    const cached = cachedTranslation(german);
    if (cached) {
      setPtTranslation(cached);
      translatedForRef.current = german;
      return;
    }
    let cancelled = false;
    void translateGermanToPortuguese(german).then((r) => {
      if (cancelled) return;
      if (r.status === 'READY') {
        setPtTranslation(r.text);
        translatedForRef.current = german;
      }
    });
    return () => {
      cancelled = true;
    };
  }, [live.assistantText, live.teacherTurnStatus, live.immersionMode]);

  const immersion = live.immersionMode;

  useEffect(() => {
    if (live.userText && live.userText !== prevUserText.current) {
      prevUserText.current = live.userText;
      setResponseStatus('processing');
    }
  }, [live.userText]);

  useEffect(() => {
    if (live.assistantText && responseStatus === 'processing' && live.teacherTurnStatus === 'COMPLETE') {
      setResponseStatus('received');
    }
  }, [live.assistantText, responseStatus, live.teacherTurnStatus]);

  useEffect(() => {
    const t = live.targetPhrase;
    if (t && t !== prevTargetRef.current) {
      if (prevTargetRef.current !== null) {
        setResponseStatus('none');
        prevUserText.current = '';
      }
      prevTargetRef.current = t;
    }
  }, [live.targetPhrase]);

  // Evidência real de fala do aluno (transcript), não mic aberto / listening.
  const userSpeaking = live.userTurnStatus === 'RECEIVING';
  const teacherSpeaking =
    live.assistantSpeaking || live.teacherTurnStatus === 'RECEIVING';
  // Sessão iniciada, professor ainda não produziu o 1º turno.
  const awaitingProfessor =
    started &&
    !teacherSpeaking &&
    !userSpeaking &&
    live.teacherTurnStatus === 'IDLE' &&
    !live.assistantText.trim() &&
    responseStatus !== 'processing';

  const orbState: OrbState =
    live.state === 'error'
      ? 'error'
      : live.state === 'connecting' || live.state === 'reconnecting'
        ? 'processing'
        : teacherSpeaking
          ? 'speaking'
          : userSpeaking
            ? 'listening'
            : awaitingProfessor
              ? 'processing'
              : live.state === 'connected' && responseStatus === 'processing'
                ? 'processing'
                : 'idle';

  const statusBadge = statusLinePt({
    liveState: live.state,
    userSpeaking,
    assistantSpeaking: live.assistantSpeaking,
    teacherTurnStatus: live.teacherTurnStatus,
    awaitingProfessor,
    responseStatus,
    started,
  });

  const micLabel =
    live.micState === 'REQUESTING_PERMISSION'
      ? 'Pedindo microfone…'
      : live.micState === 'ERROR'
        ? 'Microfone indisponível'
        : live.state === 'connecting' || live.state === 'reconnecting'
          ? 'Conectando…'
          : teacherSpeaking
            ? 'Professor falando…'
            : awaitingProfessor
              ? 'Aguardando o professor…'
              : userSpeaking
                ? 'Você está falando…'
                : responseStatus === 'processing'
                  ? 'Pensando…'
                  : started
                    ? 'Sua vez'
                    : 'Toque para falar';

  const handleMic = async () => {
    if (startLockRef.current) return;
    haptic();
    if (!started) {
      startLockRef.current = true;
      setStarted(true);
      try {
        await live.startListening();
        SoundService.play('start');
      } finally {
        startLockRef.current = false;
      }
      return;
    }
    await live.toggleMic();
  };

  const teacherSpeech = separateTeacherSpeech(live.assistantText);
  // Só mostra fala do professor quando o turno está completo / recebendo — sem target prematuro
  const shownGerman = (() => {
    if (live.teacherTurnStatus === 'RECEIVING' || live.teacherTurnStatus === 'COMPLETE') {
      return (teacherSpeech.german || (teacherSpeech.embeddedPortuguese ? '' : live.assistantText)).trim();
    }
    return '';
  })();

  const secondaryPt = immersion
    ? ''
    : (teacherSpeech.embeddedPortuguese || ptTranslation || '').trim();

  const replayTeacher = () => {
    const text = (shownGerman || live.targetPhrase || '').trim();
    if (!text) return;
    haptic(8);
    stopAllAudio();
    const voice = getVoiceService();
    voice.setSpeed(profile.speechSpeed || 'normal');
    void voice.speak(text, 'de-DE').catch(() => {
      void live.sendHelp('Wiederhole bitte langsam.');
    });
  };

  const askHelp = () => {
    haptic(8);
    void live.sendHelp(
      immersion
        ? 'Ich habe es nicht verstanden. Bitte noch einmal auf Deutsch.'
        : 'Não entendi. Pode me ajudar a responder?',
    );
  };

  const askSlow = () => {
    haptic(8);
    void live.sendHelp('Bitte langsam sprechen.');
  };

  const feedback = immersion
    ? deriveImmersionFeedback({
        microFeedback: live.microFeedback,
        pedagogicalAction: live.pedagogicalAction,
        responseStatus,
        microActive: !!live.microPractice,
      })
    : deriveFeedback({
        microFeedback: live.microFeedback,
        pedagogicalAction: live.pedagogicalAction,
        responseStatus,
        microActive: !!live.microPractice,
      });

  const progressCurrent = Math.min(
    live.targetTurns,
    Math.max(started ? 1 : 0, live.userTurns + (live.assistantText ? 1 : 0)),
  );

  const abandon = () => {
    SoundService.play('end');
    live.end('ABANDONED');
    navigate('/');
  };

  const finish = () => {
    SoundService.play('end');
    live.end('COMPLETED');
    onFinish();
  };

  const connecting = live.state === 'connecting' || live.state === 'reconnecting';
  const professorLine =
    shownGerman ||
    (connecting
      ? ''
      : started
        ? ''
        : '');

  const emptyHint = connecting
    ? 'Conectando com seu professor…'
    : awaitingProfessor
      ? 'Aguardando o professor…'
      : started
        ? 'Sua vez'
        : live.returning
          ? 'Continuando sua prática.'
          : 'Seu professor de IA está pronto.';

  return (
    <div className="flex flex-col h-full max-w-md mx-auto overflow-hidden dt-page talk-live">
      <header
        className="flex items-center justify-between gap-2 px-3 pb-2 shrink-0"
        style={{ paddingTop: 'calc(0.75rem + env(safe-area-inset-top, 0px))' }}
      >
        <IconButton label="Voltar" className="min-h-11 min-w-11 text-white/80" onClick={abandon}>
          <IconBack size={20} />
        </IconButton>
        {live.simulatorMode ? (
          <div className="flex flex-col items-center min-w-0 flex-1 px-1">
            <span className="text-[10px] uppercase tracking-[0.14em] font-semibold text-[#00F2FE]">
              SIMULADOR
            </span>
            <span className="text-[12px] text-white font-semibold truncate max-w-full">
              {live.simulatorScenarioLabel}
            </span>
            <span className="text-[11px] text-[#64748b] tabular-nums">{live.simulatorElapsed}</span>
          </div>
        ) : live.miniProvaMode ? (
          <div className="flex flex-col items-center min-w-0 flex-1 px-1">
            <span className="text-[10px] uppercase tracking-[0.14em] font-semibold text-[#A855F7]">
              MINI PROVA
            </span>
            <span className="text-[12px] text-white font-semibold tabular-nums">
              {live.miniProvaProgress.current} / {live.miniProvaProgress.total}
            </span>
          </div>
        ) : (
          <div className="flex flex-col items-center min-w-0 flex-1">
            <span className="text-[11px] font-bold uppercase tracking-wide text-white">Conversar</span>
            <SessionProgress current={progressCurrent} total={live.targetTurns} />
          </div>
        )}
        <button
          type="button"
          onClick={finish}
          className="inline-flex items-center gap-1.5 min-h-10 px-3 rounded-full text-[13px] font-semibold text-white"
          style={{
            background: 'linear-gradient(135deg, rgba(239,68,68,0.35), rgba(185,28,28,0.55))',
            border: '1px solid rgba(248,113,113,0.35)',
          }}
        >
          <IconHangup size={14} /> Encerrar
        </button>
      </header>

      {!live.simulatorMode && !live.miniProvaMode ? (
        <div className="px-4 pb-1 shrink-0">
          <ConversationProgressBar current={progressCurrent} total={live.targetTurns} />
        </div>
      ) : null}

      <div className="flex-1 min-h-0 overflow-y-auto scrollbar-hide px-4 flex flex-col">
        {/* Badge professor + status */}
        <div className="flex items-center justify-center gap-2 pt-1 pb-2 flex-wrap">
          <span
            className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-[0.1em] text-[#C4B5FD]"
            style={{
              background: 'rgba(139,92,246,0.15)',
              border: '1px solid rgba(139,92,246,0.35)',
            }}
          >
            Professor de IA
          </span>
          <span
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold"
            style={{
              color: orbState === 'listening' || orbState === 'speaking' ? '#67E8F9' : '#A78BFA',
              background:
                orbState === 'listening' || orbState === 'speaking'
                  ? 'rgba(0,242,254,0.12)'
                  : 'rgba(139,92,246,0.12)',
              border:
                orbState === 'listening' || orbState === 'speaking'
                  ? '1px solid rgba(0,242,254,0.3)'
                  : '1px solid rgba(139,92,246,0.28)',
            }}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                orbState === 'listening' || orbState === 'speaking' ? 'animate-pulse bg-[#00F2FE]' : 'bg-[#A78BFA]'
              }`}
              aria-hidden
            />
            {statusBadge}
          </span>
        </div>

        {/* Fala do professor — protagonista (transcript real) */}
        <div className="text-center px-2 min-h-[72px] flex flex-col items-center justify-center">
          {professorLine ? (
            <>
              <p className="talk-live-de text-white font-[family-name:var(--font-display)]">
                {professorLine}
              </p>
              {secondaryPt ? (
                <p className="mt-2 text-[13px] text-[#94A3B8] max-w-[320px] leading-snug line-clamp-2">
                  {secondaryPt}
                </p>
              ) : null}
            </>
          ) : (
            <p className="text-[15px] text-[#94A3B8]">{emptyHint}</p>
          )}
        </div>

        {/* Orb central */}
        <div className="flex-1 flex flex-col items-center justify-center min-h-[200px] py-3 relative">
          <span className="talk-orb-halo" aria-hidden />
          <DTAudioOrb state={orbState} size={220} />
        </div>

        {/* Resposta do usuário — linha compacta, não card dashboard */}
        {live.userText && responseStatus !== 'none' ? (
          <div className="mb-2 px-3 py-2.5 rounded-[16px] text-center" style={{ background: 'rgba(255,255,255,0.04)' }}>
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#60A5FA]">Você</p>
            <p className="mt-1 text-[15px] font-semibold text-white leading-snug" style={{ overflowWrap: 'anywhere' }}>
              {live.userText}
            </p>
            {responseStatus === 'processing' ? (
              <p className="mt-1 text-[11px] text-[#94A3B8]">Pensando…</p>
            ) : null}
            {responseStatus === 'received' && feedback.text ? (
              <p
                className="mt-1 text-[12px] font-medium"
                style={{
                  color:
                    feedback.tone === 'adjust'
                      ? '#FBBF24'
                      : feedback.tone === 'neutral'
                        ? '#94A3B8'
                        : '#34D399',
                }}
              >
                {feedback.text}
              </p>
            ) : null}
          </div>
        ) : null}

        {live.microPractice ? (
          <div className="mb-2">
            <MicroPracticePanel
              session={live.microPractice}
              feedback={live.microFeedback}
              micActive={live.micActive}
              onSubmit={(t) => {
                void live.submitMicroAnswer(t);
              }}
              onSkip={() => {
                void live.skipMicroPractice();
              }}
              onRequestHelp={() => {
                void live.sendHelp('Ajuda');
              }}
            />
          </div>
        ) : null}

        {live.error ? (
          <div className="mb-2 rounded-[20px] p-4 text-center" style={{ background: 'rgba(255,255,255,0.04)' }}>
            <p className="text-[14px] text-white font-semibold">Não foi possível continuar a conversa.</p>
            <p className="text-[12px] text-[#94A3B8] mt-1">{live.error}</p>
            <button
              type="button"
              onClick={() => {
                void live.start();
              }}
              className="mt-3 px-5 py-2.5 rounded-full text-[13px] font-semibold text-white"
              style={{ background: 'linear-gradient(135deg, #8B5CF6, #00F2FE)' }}
            >
              Tentar novamente
            </button>
          </div>
        ) : null}

        {live.assistantSpeaking && live.state === 'connected' && !live.micActive ? (
          <button
            type="button"
            onClick={() => {
              haptic(8);
              live.interrupt();
            }}
            className="mb-1 self-center inline-flex items-center gap-2 text-[12px] text-[#64748B] min-h-10"
          >
            <IconStop size={14} /> Interromper
          </button>
        ) : null}
      </div>

      {/* Controles cockpit discretos */}
      <div className="px-4 pt-1 flex items-center justify-center gap-5 shrink-0">
        {[
          { icon: <IconRefresh size={18} />, label: 'Repetir', onClick: replayTeacher },
          { icon: <IconLightbulb size={18} />, label: 'Ajuda', onClick: askHelp },
          { icon: <IconTurtle size={18} />, label: 'Mais devagar', onClick: askSlow },
        ].map((a) => (
          <button
            key={a.label}
            type="button"
            onClick={a.onClick}
            className="flex flex-col items-center gap-1 active:scale-95 transition-transform"
            aria-label={a.label}
          >
            <span
              className="w-11 h-11 rounded-2xl flex items-center justify-center text-[#CBD5E1]"
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.08)',
              }}
            >
              {a.icon}
            </span>
            <span className="text-[10px] font-semibold text-[#64748B]">{a.label}</span>
          </button>
        ))}
      </div>

      {/* Microfone dominante — voice-first, sem digitar */}
      <div
        className="flex flex-col items-center pt-2 shrink-0 px-3"
        style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom, 0px))' }}
      >
        <button
          type="button"
          onClick={() => void handleMic()}
          disabled={connecting}
          aria-label={micLabel}
          className="talk-mic-btn relative active:scale-[0.96] transition-transform disabled:opacity-70"
        >
          <span
            className={`talk-mic-halo ${live.micActive ? 'talk-mic-halo--hot' : ''}`}
            aria-hidden
          />
          <span
            className={`talk-mic-core relative z-[1] w-[88px] h-[88px] rounded-full flex items-center justify-center ${
              live.micActive ? 'talk-mic-core--hot' : ''
            }`}
          >
            <IconMic size={34} className="text-white" />
          </span>
        </button>
        <p className="mt-2 text-[12px] font-bold text-white">{micLabel}</p>
        {live.micState === 'ERROR' ? (
          <p className="mt-1 text-[11px] text-[#F87171]">Verifique a permissão do microfone.</p>
        ) : null}
        {started && live.audioInputs.length > 1 ? (
          <button
            type="button"
            onClick={() => setShowMicSettings((s) => !s)}
            className="mt-2 text-[10px] font-semibold text-[#64748B]"
          >
            Microfone
          </button>
        ) : null}
        {showMicSettings && started && live.audioInputs.length > 0 ? (
          <select
            value={live.selectedDeviceId || ''}
            onChange={(e) => live.selectDevice(e.target.value)}
            className="mt-2 w-full max-w-xs bg-[#0f172a] text-[#94A3B8] text-[12px] rounded-[14px] px-3 py-2 border border-white/10"
            aria-label="Escolher microfone"
          >
            <option value="">Padrão do sistema</option>
            {live.audioInputs.map((d) => (
              <option key={d.deviceId} value={d.deviceId}>
                {d.label || 'dispositivo sem nome'}
              </option>
            ))}
          </select>
        ) : null}
      </div>
    </div>
  );
}
