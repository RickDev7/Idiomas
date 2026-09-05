/**
 * Gemini Live — composição visual: Professor → Orb → Mic.
 * Lógica de áudio/sessão intacta (useGeminiLive). Sem input de texto.
 */
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { UserProfile } from '@/types';
import { useGeminiLive } from '@/hooks/useGeminiLive';
import {
  IconBack,
  IconRefresh,
  IconLightbulb,
  IconTurtle,
  IconStop,
} from '@/components/ui/Icons';
import { toast } from '@/components/ui/Toast';
import { haptic } from '@/services/ui/UiPrefsService';
import { SoundService } from '@/services/ui/SoundService';
import { getVoiceService } from '@/services/voice/VoiceService';
import { stopAllAudio } from '@/services/voice/AudioPlayback';
import {
  ConversationProgressBar,
} from '@/components/voice/VoicePanels';
import { MicroPracticePanel } from '@/components/voice/MicroPracticePanel';
import {
  translateGermanToPortuguese,
  cachedTranslation,
  separateTeacherSpeech,
} from '@/services/ai/TranslationService';
import { type OrbState } from '@/components/dt';
import { UiPrefsService, type TranslationMode } from '@/services/ui/UiPrefsService';
import { APP_ROUTES, sessionChromeTitle } from '@/services/ui/AppRoutes';
import {
  AppColumn,
  DiscreteActions,
  MicCTA,
  PremiumOrb,
  SpeechSurface,
  pickStageSpeech,
} from '@/components/premium';

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
  // Aguardando professor só enquanto conectado — erro não deve mascarar como espera.
  if (opts.awaitingProfessor && opts.liveState === 'connected') return 'Aguardando o professor…';
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

export function GeminiConversation({
  profile,
  onFinish,
  sessionType = 'lesson',
}: {
  profile: UserProfile;
  onFinish: () => void;
  /** Query `type` da sessão — define o título do chrome (Treino / Revisar / Conversar). */
  sessionType?: string;
}) {
  const navigate = useNavigate();
  const live = useGeminiLive(profile);
  const [started, setStarted] = useState(false);
  const [showMicSettings, setShowMicSettings] = useState(false);
  const [hintOpen, setHintOpen] = useState(false);
  const startLockRef = useRef(false);

  const [ptTranslation, setPtTranslation] = useState('');
  const translatedForRef = useRef('');
  const [translationMode, setTranslationMode] = useState<TranslationMode>(
    () => UiPrefsService.get().translationMode,
  );
  const [ptRevealed, setPtRevealed] = useState(
    () => UiPrefsService.get().translationMode === 'always',
  );

  useEffect(() => UiPrefsService.subscribe((p) => {
    setTranslationMode(p.translationMode);
    if (p.translationMode === 'always') setPtRevealed(true);
    if (p.translationMode === 'ondemand' || p.translationMode === 'immersion') setPtRevealed(false);
  }), []);

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
    if (!live.reviewComplete) return;
    SoundService.play('end');
    live.end('COMPLETED');
    onFinish();
  }, [live.reviewComplete, live, onFinish]);

  useEffect(() => {
    if (live.immersionMode || translationMode === 'immersion') {
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
  }, [live.assistantText, live.teacherTurnStatus, live.immersionMode, translationMode]);

  useEffect(() => {
    if (translationMode !== 'always') setPtRevealed(false);
  }, [live.assistantText, translationMode]);

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

  const secondaryPt = immersion || translationMode === 'immersion'
    ? ''
    : (teacherSpeech.embeddedPortuguese || ptTranslation || '').trim();
  const showSecondaryPt =
    !!secondaryPt && (translationMode === 'always' || ptRevealed);

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

  const [confirmAbandon, setConfirmAbandon] = useState(false);
  const allowLeaveRef = useRef(false);

  const sessionHasProgress =
    started
    || live.userTurns > 0
    || !!live.assistantText
    || live.micActive
    || live.assistantSpeaking
    || live.state === 'connected'
    || live.state === 'connecting'
    || live.state === 'reconnecting';

  const abandon = () => {
    allowLeaveRef.current = true;
    SoundService.play('end');
    live.end('ABANDONED');
    setConfirmAbandon(false);
    navigate(APP_ROUTES.home);
  };

  const requestAbandon = () => {
    if (sessionHasProgress) {
      setConfirmAbandon(true);
      return;
    }
    abandon();
  };

  const stayInSession = () => {
    setConfirmAbandon(false);
  };

  /** Browser Back: só confirma quando há progresso; não trava a sessão ociosa. */
  useEffect(() => {
    if (!sessionHasProgress || allowLeaveRef.current) return;
    const guard = { dtSessionGuard: true };
    window.history.pushState(guard, '');
    const onPopState = () => {
      if (allowLeaveRef.current) return;
      window.history.pushState(guard, '');
      setConfirmAbandon(true);
    };
    window.addEventListener('popstate', onPopState);
    return () => {
      window.removeEventListener('popstate', onPopState);
    };
  }, [sessionHasProgress]);

  const finish = () => {
    allowLeaveRef.current = true;
    SoundService.play('end');
    live.end('COMPLETED');
    onFinish();
  };

  const connecting = live.state === 'connecting' || live.state === 'reconnecting';
  const stage = pickStageSpeech({
    shownGerman,
    targetPhrase: live.targetPhrase,
  });
  const professorLine = stage.primary;
  const pedagogicalOverflow = stage.overflow;

  const emptyHint = connecting
    ? 'Conectando…'
    : awaitingProfessor
      ? 'Aguardando o professor…'
      : started
        ? 'Sua vez'
        : live.returning
          ? 'Pronto para continuar'
          : 'Toque no microfone para começar';

  const orbLabel =
    orbState === 'speaking'
      ? 'Professor'
      : orbState === 'listening'
        ? 'Ouvindo'
        : orbState === 'processing'
          ? 'Pensando'
          : undefined;

  const chromeTitle = (() => {
    const chrome = sessionChromeTitle(sessionType);
    return chrome === 'Treino' ? 'Deutsch Coach' : chrome;
  })();

  return (
    <AppColumn immersive className="talk-live session-stage session-compose">
      <header
        className="session-compose__header shrink-0 px-5"
        style={{ paddingTop: 'calc(0.45rem + env(safe-area-inset-top, 0px))' }}
      >
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Voltar"
            onClick={requestAbandon}
            className="w-9 h-9 rounded-full flex items-center justify-center text-[var(--text-secondary)]"
          >
            <IconBack size={18} />
          </button>
          <div className="min-w-0 flex-1 text-center px-1">
            {live.simulatorMode ? (
              <>
                <span className="text-[10px] uppercase tracking-[0.14em] font-semibold text-[var(--voice-cyan)]">
                  Simulador
                </span>
                <p className="text-[12px] text-[var(--text-primary)] font-semibold truncate">
                  {live.simulatorScenarioLabel}
                </p>
              </>
            ) : live.miniProvaMode ? (
              <>
                <span className="text-[10px] uppercase tracking-[0.14em] font-semibold text-[var(--learning-violet)]">
                  Mini Prova
                </span>
                <p className="text-[13px] text-[var(--text-primary)] font-bold tabular-nums">
                  {live.miniProvaProgress.current} / {live.miniProvaProgress.total}
                </p>
              </>
            ) : (
              <h1 className="text-[15px] font-bold text-[var(--text-primary)] font-[family-name:var(--font-display)] tracking-tight">
                {chromeTitle}
              </h1>
            )}
          </div>
          <button
            type="button"
            onClick={finish}
            className="min-h-9 px-1.5 text-[11px] font-semibold text-[var(--text-faint)]"
            aria-label="Encerrar"
          >
            Encerrar
          </button>
        </div>
        {!live.simulatorMode && !live.miniProvaMode ? (
          <div className="mt-2 flex justify-center">
            <ConversationProgressBar current={progressCurrent} total={live.targetTurns} />
          </div>
        ) : null}
      </header>

      {/* Palco central: orb + fala — preenche o meio sem empurrar o mic */}
      <div className="session-compose__stage px-5">
        <PremiumOrb state={orbState} label={orbLabel} />

        <div className="w-full max-w-[340px] mx-auto">
          <SpeechSurface
            german={professorLine || undefined}
            portuguese={professorLine && showSecondaryPt ? secondaryPt : undefined}
            onReplay={professorLine ? replayTeacher : undefined}
            emptyHint={emptyHint}
            roleLabel={orbState === 'speaking' && professorLine ? 'Professor' : undefined}
          />
          {professorLine && translationMode === 'ondemand' && secondaryPt && !ptRevealed ? (
            <button
              type="button"
              onClick={() => setPtRevealed(true)}
              className="mt-1.5 w-full text-center text-[11px] font-semibold text-[var(--text-faint)]"
            >
              Ver tradução
            </button>
          ) : null}
        </div>

        <button
          type="button"
          onClick={() => {
            setHintOpen((v) => !v);
            if (!hintOpen) askHelp();
          }}
          className="inline-flex items-center gap-1.5 min-h-8 px-3.5 rounded-full text-[11px] font-semibold text-[var(--text-secondary)]"
          style={{
            background: 'color-mix(in srgb, var(--surface) 80%, transparent)',
            border: '1px solid var(--border-subtle)',
          }}
          aria-expanded={hintOpen}
        >
          <IconLightbulb size={13} />
          Ver pista
          <span aria-hidden className="text-[9px] opacity-60">{hintOpen ? '▴' : '▾'}</span>
        </button>

        {hintOpen && (pedagogicalOverflow || live.microFeedback) ? (
          <p className="text-[11px] text-[var(--text-secondary)] text-center leading-snug px-3 line-clamp-3 max-w-[320px]">
            {live.microFeedback || pedagogicalOverflow}
          </p>
        ) : null}

        {/* Feedback curto do aluno — não ocupa o dock do mic */}
        {live.userText && responseStatus !== 'none' ? (
          <div className="w-full max-w-[320px] px-3 py-1.5 rounded-[14px] text-center dt-speech-surface--subtle">
            <p className="text-[9px] font-bold uppercase tracking-wider text-[var(--voice-cyan)]">Você</p>
            <p className="text-[13px] font-semibold text-[var(--text-primary)] leading-snug line-clamp-2">
              {live.userText}
            </p>
            {responseStatus === 'received' && feedback.text ? (
              <p
                className="mt-0.5 text-[11px] font-medium line-clamp-1"
                style={{
                  color:
                    feedback.tone === 'adjust'
                      ? 'var(--warning)'
                      : feedback.tone === 'neutral'
                        ? 'var(--text-secondary)'
                        : 'var(--success)',
                }}
              >
                {feedback.text}
              </p>
            ) : null}
          </div>
        ) : null}

        {live.microPractice ? (
          <div className="w-full max-w-[340px] max-h-[28vh] overflow-y-auto scrollbar-hide">
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
          <div className="w-full max-w-[320px] rounded-[16px] p-3 text-center" style={{ background: 'var(--surface)' }}>
            <p className="text-[12px] text-[var(--text-primary)] font-semibold">
              {live.error}
            </p>
            <button
              type="button"
              onClick={() => {
                void live.startListening();
              }}
              className="mt-2 px-4 py-2 rounded-full text-[12px] font-semibold text-white dt-cta-primary"
            >
              Tentar novamente
            </button>
          </div>
        ) : null}
      </div>

      {/* Dock fixo: controles + microfone — sempre visível */}
      <div
        className="session-compose__dock shrink-0 px-5"
        style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom, 0px))' }}
      >
        <DiscreteActions
          items={[
            { key: 'repeat', icon: <IconRefresh size={15} />, label: 'Repetir', onClick: replayTeacher },
            { key: 'hint', icon: <IconLightbulb size={15} />, label: 'Pista', onClick: askHelp },
            { key: 'slow', icon: <IconTurtle size={15} />, label: 'Mais devagar', onClick: askSlow },
          ]}
        />
        <div className="mt-3">
          <MicCTA
            active={live.micActive}
            disabled={connecting}
            label={micLabel}
            onClick={() => void handleMic()}
            size={96}
          />
          {live.assistantSpeaking && live.state === 'connected' && !live.micActive ? (
            <button
              type="button"
              onClick={() => {
                haptic(8);
                live.interrupt();
              }}
              className="mx-auto mt-1 flex items-center gap-1 text-[10px] text-[var(--text-faint)] min-h-8"
            >
              <IconStop size={11} /> Interromper
            </button>
          ) : null}
          {live.micState === 'ERROR' ? (
            <p className="mt-1 text-center text-[11px] text-[var(--danger)]">
              Verifique a permissão do microfone.
            </p>
          ) : null}
          {started && live.audioInputs.length > 1 ? (
            <button
              type="button"
              onClick={() => setShowMicSettings((s) => !s)}
              className="mt-1 mx-auto block text-[10px] font-semibold text-[var(--text-faint)]"
            >
              Microfone
            </button>
          ) : null}
          {showMicSettings && started && live.audioInputs.length > 0 ? (
            <select
              value={live.selectedDeviceId || ''}
              onChange={(e) => live.selectDevice(e.target.value)}
              className="mt-2 w-full max-w-xs mx-auto block text-[12px] rounded-[14px] px-3 py-2"
              style={{
                background: 'var(--surface)',
                color: 'var(--text-secondary)',
                border: '1px solid var(--border-subtle)',
              }}
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

      {confirmAbandon ? (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-4 pb-8 sm:pb-0"
          style={{ background: 'color-mix(in srgb, var(--bg) 72%, transparent)' }}
          role="presentation"
          onClick={stayInSession}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="abandon-title"
            aria-describedby="abandon-desc"
            className="w-full max-w-sm rounded-[24px] p-5 shadow-2xl"
            style={{
              background: 'var(--surface-elevated, var(--surface))',
              border: '1px solid var(--border-subtle)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="abandon-title" className="text-[17px] font-bold text-[var(--text-primary)]">
              Abandonar este treino?
            </h2>
            <p id="abandon-desc" className="mt-2 text-[13px] text-[var(--text-secondary)] leading-snug">
              Seu progresso desta sessão pode não ser concluído.
            </p>
            <div className="mt-5 flex flex-col gap-2">
              <button
                type="button"
                onClick={stayInSession}
                className="min-h-11 w-full rounded-[16px] text-[14px] font-bold text-white dt-cta-primary"
              >
                Continuar treino
              </button>
              <button
                type="button"
                onClick={abandon}
                className="min-h-11 w-full rounded-[16px] text-[14px] font-semibold text-[var(--danger)]"
                style={{
                  background: 'color-mix(in srgb, var(--danger) 12%, transparent)',
                  border: '1px solid color-mix(in srgb, var(--danger) 35%, transparent)',
                }}
              >
                Sair
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </AppColumn>
  );
}
