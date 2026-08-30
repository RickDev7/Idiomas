import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { UserProfile } from '@/types';
import { useGeminiLive } from '@/hooks/useGeminiLive';
import { IconButton } from '@/components/ui/Button';
import { IconBack, IconHangup, IconRefresh, IconLightbulb, IconTurtle, IconStop } from '@/components/ui/Icons';
import { toast } from '@/components/ui/Toast';
import { haptic, UiPrefsService, type TranslationMode } from '@/services/ui/UiPrefsService';
import { SoundService } from '@/services/ui/SoundService';
import { getVoiceService } from '@/services/voice/VoiceService';
import {
  TeacherCard, StudentResponseCard, ActionGrid, VoiceArea, SessionProgress,
} from '@/components/voice/VoicePanels';
import { MicroPracticePanel } from '@/components/voice/MicroPracticePanel';
import {
  translateGermanToPortuguese,
  cachedTranslation,
  separateTeacherSpeech,
  SLOW_HINT_MS,
  type TranslationStatus,
} from '@/services/ai/TranslationService';
import { DeutschTurboMascot } from '@/components/ui/Mascot';
import { useKeyboardInset } from '@/hooks/useKeyboardInset';

/** Feedback amigável a partir do estado pedagógico real — nunca inventa sucesso falso. */
function deriveFeedback(opts: {
  microFeedback: string | null;
  pedagogicalAction: string | null;
  responseStatus: 'processing' | 'received' | 'none';
  microActive: boolean;
}): { text: string | null; tone: 'success' | 'adjust' | 'neutral' } {
  if (opts.responseStatus !== 'received') return { text: null, tone: 'neutral' };
  if (opts.microFeedback?.trim()) {
    const t = opts.microFeedback.trim();
    const adjust = /quase|ajustar|corrig|erro|tente|review|falh/i.test(t);
    return { text: t, tone: adjust ? 'adjust' : 'success' };
  }
  if (opts.microActive) return { text: null, tone: 'neutral' };
  const action = opts.pedagogicalAction || '';
  if (action === 'practice' || action === 'recall') {
    return { text: 'Quase. Vamos ajustar uma coisa.', tone: 'adjust' };
  }
  if (action === 'transfer' || action === 'spontaneous') {
    return { text: 'Boa! Agora use em outro contexto.', tone: 'success' };
  }
  if (action === 'converse' || action === 'introduce') {
    return { text: 'Muito bem! Frase correta!', tone: 'success' };
  }
  return { text: 'Resposta recebida.', tone: 'neutral' };
}

export function GeminiConversation({ profile, onFinish }: { profile: UserProfile; onFinish: () => void }) {
  const navigate = useNavigate();
  const live = useGeminiLive(profile);
  const [started, setStarted] = useState(false);
  const [showMicSettings, setShowMicSettings] = useState(false);
  const startLockRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const [translationMode] = useState<TranslationMode>(() => UiPrefsService.get().translationMode);
  const [translationVisible, setTranslationVisible] = useState(translationMode === 'always');
  const [ptTranslation, setPtTranslation] = useState('');
  const [translationStatus, setTranslationStatus] = useState<TranslationStatus>('HIDDEN');
  const [translationError, setTranslationError] = useState('');
  const [slowTranslation, setSlowTranslation] = useState(false);
  const [retryTick, setRetryTick] = useState(0);
  const [explanation, setExplanation] = useState('');
  const translatedForRef = useRef('');

  const [textMode, setTextMode] = useState(false);
  const [textValue, setTextValue] = useState('');
  useKeyboardInset(textMode);

  const [responseStatus, setResponseStatus] = useState<'processing' | 'received' | 'none'>('none');
  const prevUserText = useRef('');

  useEffect(() => {
    if (live.error) toast(live.error, 'error');
  }, [live.error]);

  useEffect(() => {
    if (!translationVisible) {
      setTranslationStatus('HIDDEN');
      return;
    }
    const speech = separateTeacherSpeech(live.assistantText);
    const german = (speech.german || live.assistantText).trim();
    if (!german || live.teacherTurnStatus !== 'COMPLETE') {
      if (live.teacherTurnStatus === 'RECEIVING') {
        setPtTranslation('');
        setTranslationStatus('HIDDEN');
        setSlowTranslation(false);
        translatedForRef.current = '';
        setExplanation('');
      }
      return;
    }
    if (translatedForRef.current === german && ptTranslation) {
      setTranslationStatus('READY');
      return;
    }
    const cached = cachedTranslation(german);
    if (cached) {
      setPtTranslation(cached);
      setTranslationStatus('READY');
      translatedForRef.current = german;
      return;
    }
    let cancelled = false;
    setTranslationStatus('LOADING');
    setTranslationError('');
    setSlowTranslation(false);
    const slowTimer = setTimeout(() => { if (!cancelled) setSlowTranslation(true); }, SLOW_HINT_MS);
    void translateGermanToPortuguese(german).then((r) => {
      if (cancelled) return;
      if (r.status === 'READY') {
        setPtTranslation(r.text);
        setTranslationStatus('READY');
        translatedForRef.current = german;
      } else {
        setPtTranslation('');
        setTranslationStatus('ERROR');
        setTranslationError(r.error || 'Tradução indisponível no momento.');
      }
      setSlowTranslation(false);
    });
    return () => {
      cancelled = true;
      clearTimeout(slowTimer);
    };
  }, [live.assistantText, live.teacherTurnStatus, translationVisible, retryTick]);

  useEffect(() => {
    if (live.teacherTurnStatus === 'RECEIVING') setExplanation('');
  }, [live.teacherTurnStatus]);

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
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [live.assistantText, live.userText, live.microPractice, ptTranslation]);

  const orbState: 'idle' | 'listening' | 'processing' | 'speaking' | 'error' =
    live.state === 'error' ? 'error'
      : live.state === 'connecting' || live.state === 'reconnecting' ? 'processing'
        : live.micActive ? 'listening'
          : live.assistantSpeaking || live.teacherTurnStatus === 'RECEIVING' ? 'speaking'
            : live.state === 'connected' && responseStatus === 'processing' ? 'processing'
              : 'idle';

  const statusBadge =
    live.state === 'connecting' ? 'Conectando…'
      : live.state === 'reconnecting' ? 'Reconectando…'
        : live.state === 'error' ? 'Sem conexão'
          : live.micActive ? 'Estou ouvindo...'
            : live.assistantSpeaking || live.teacherTurnStatus === 'RECEIVING' ? 'Falando...'
              : responseStatus === 'processing' ? 'Pensando...'
                : 'Pronto';

  const micStatus =
    live.micState === 'REQUESTING_PERMISSION' ? 'Pedindo microfone…'
      : live.micState === 'ERROR' ? 'Não conseguimos acessar o microfone'
        : live.micActive || live.micState === 'LISTENING' ? 'Estou ouvindo você'
          : live.state === 'connecting' || live.state === 'reconnecting' ? 'Conectando…'
            : responseStatus === 'processing' ? 'Entendi. Só um momento...'
              : started ? 'Toque para falar' : 'Toque para começar';

  const micHint =
    live.micState === 'ERROR' ? 'Verifique a permissão do microfone.'
      : live.micActive ? undefined
        : started ? undefined
          : live.returning ? 'Continuando de onde você parou.' : 'Fale com seu professor de IA.';

  const handleMic = async () => {
    if (startLockRef.current) return;
    haptic();
    setTextMode(false);
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

  const toggleTranslation = () => { haptic(8); setTranslationVisible((v) => !v); };

  const teacherSpeech = separateTeacherSpeech(live.assistantText);
  const shownGerman = teacherSpeech.german || (teacherSpeech.embeddedPortuguese ? '' : live.assistantText);

  /** Repetir = TTS local da última frase. Não dispara nova resposta Gemini. */
  const replayTeacher = () => {
    const text = shownGerman.trim();
    if (!text) return;
    haptic(8);
    const voice = getVoiceService();
    voice.setSpeed(profile.speechSpeed || 'normal');
    void voice.speak(text, 'de-DE').catch(() => {
      void live.sendHelp('Wiederhole bitte langsam.');
    });
  };

  const askHelp = () => {
    haptic(8);
    void live.sendHelp('Não entendi. Pode me ajudar a responder?');
  };

  const askSlow = () => {
    haptic(8);
    void live.sendHelp('Bitte langsam sprechen.');
  };

  const handleTextSubmit = async () => {
    const t = textValue.trim();
    if (!t) return;
    haptic();
    setTextMode(false);
    setTextValue('');
    if (live.microPractice) {
      await live.submitMicroAnswer(t);
      return;
    }
    if (!started) {
      startLockRef.current = true;
      setStarted(true);
      try {
        await live.start();
        SoundService.play('start');
        await live.submitUserText(t);
      } finally {
        startLockRef.current = false;
      }
      return;
    }
    await live.submitUserText(t);
  };

  const feedback = deriveFeedback({
    microFeedback: live.microFeedback,
    pedagogicalAction: live.pedagogicalAction,
    responseStatus,
    microActive: !!live.microPractice,
  });

  const scaffoldHint =
    live.microPractice?.scaffoldDisplay
    || (live.pedagogicalAction === 'practice' && live.targetPhrase
      ? `Tente usar: ${live.targetPhrase}`
      : undefined);

  const progressCurrent = Math.min(
    live.targetTurns,
    Math.max(started ? 1 : 0, live.userTurns + (live.assistantText ? 1 : 0)),
  );

  const actions = [
    { icon: <IconRefresh size={20} />, label: 'Repetir', sub: 'Ouvir de novo', color: '#3b82f6', onClick: replayTeacher },
    { icon: <IconLightbulb size={20} />, label: 'Ajuda', sub: 'Preciso de ajuda', color: '#fbbf24', onClick: askHelp },
    { icon: <IconTurtle size={20} />, label: 'Devagar', sub: 'Falar mais devagar', color: '#10b981', onClick: askSlow },
    {
      icon: <span className="text-sm font-bold">BR</span>,
      label: 'Tradução',
      sub: translationVisible ? 'Sempre visível' : 'Mostrar',
      color: '#10b981',
      onClick: toggleTranslation,
      active: translationVisible,
    },
  ];

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

  return (
    <div className="flex flex-col h-full bg-background max-w-md mx-auto">
      <header className="flex items-center justify-between gap-2 px-3 pt-3 pb-2 safe-top shrink-0">
        <IconButton label="Voltar" className="min-h-11 min-w-11" onClick={abandon}>
          <IconBack size={20} />
        </IconButton>
        <SessionProgress current={progressCurrent} total={live.targetTurns} />
        <button
          type="button"
          onClick={finish}
          className="inline-flex items-center gap-1.5 min-h-11 px-3 rounded-full text-sm font-semibold transition-colors"
          style={{ background: 'var(--hangup-bg)', color: 'var(--hangup-fg)', border: '1px solid var(--hangup-border)' }}
        >
          <IconHangup size={16} /> Encerrar
        </button>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto scrollbar-hide px-4 pt-1 pb-2 min-h-0">
        {live.assistantText ? (
          <TeacherCard
            orbState={orbState}
            statusText={statusBadge}
            german={shownGerman}
            portuguese={ptTranslation}
            translationStatus={
              !translationVisible
                ? 'HIDDEN'
                : live.teacherTurnStatus === 'COMPLETE'
                  ? (translationStatus === 'HIDDEN' ? 'LOADING' : translationStatus)
                  : 'HIDDEN'
            }
            translationError={translationError}
            slowTranslation={slowTranslation}
            translationVisible={translationVisible}
            translationMode={translationMode}
            onToggleTranslation={toggleTranslation}
            onRepeat={replayTeacher}
            onHelp={askHelp}
            onRetryTranslation={() => setRetryTick((n) => n + 1)}
            explanation={explanation}
            scaffoldHint={!live.microPractice ? scaffoldHint : undefined}
          />
        ) : (
          <EmptyCoach
            statusText={statusBadge}
            started={started}
            returning={live.returning}
            connecting={live.state === 'connecting' || live.state === 'reconnecting'}
          />
        )}

        <StudentResponseCard
          text={live.userText}
          status={responseStatus}
          feedback={feedback.text}
          feedbackTone={feedback.tone}
        />

        {import.meta.env.DEV && live.pedagogicalAction && (
          <p className="mt-2 text-caption text-text-faint font-mono px-1" aria-hidden>
            Action: {live.pedagogicalAction}
            {live.targetPhrase ? ` · Target: ${live.targetPhrase}` : ''}
          </p>
        )}

        {live.microPractice && (
          <MicroPracticePanel
            session={live.microPractice}
            feedback={live.microFeedback}
            micActive={live.micActive}
            onSubmit={(t) => { void live.submitMicroAnswer(t); }}
            onSkip={() => { void live.skipMicroPractice(); }}
            onRequestHelp={() => { void live.sendHelp('Ajuda'); }}
          />
        )}

        {live.error && (
          <div className="mt-4 rounded-[22px] dt-glass p-4 text-center animate-fade-in">
            <p className="text-body text-text font-semibold">Não foi possível continuar a conversa.</p>
            <p className="text-caption text-text-muted mt-1">{live.error}</p>
            <button
              type="button"
              onClick={() => { void live.start(); }}
              className="mt-3 px-5 py-2.5 rounded-full bg-primary text-white text-secondary font-semibold min-h-11"
            >
              Tentar novamente
            </button>
          </div>
        )}

        {live.assistantSpeaking && live.state === 'connected' && !live.micActive && (
          <button
            type="button"
            onClick={() => { haptic(8); live.interrupt(); }}
            className="mt-3 inline-flex items-center gap-2 text-caption text-text-faint min-h-11 px-3"
          >
            <IconStop size={15} /> Interromper
          </button>
        )}
      </div>

      <div className="px-4 pt-1 pb-1 shrink-0">
        <ActionGrid items={actions} />
      </div>

      <VoiceArea
        micActive={live.micActive}
        micLevel={live.micLevel}
        statusLabel={micStatus}
        statusHint={micHint}
        onMic={handleMic}
        disabled={live.state === 'connecting' || live.state === 'reconnecting'}
        noSignal={live.micLevel < 0.015}
        onPickMic={() => setShowMicSettings((s) => !s)}
        textMode={textMode}
        textValue={textValue}
        onTextChange={setTextValue}
        onTextSubmit={handleTextSubmit}
        onToggleText={() => setTextMode((v) => !v)}
      />

      {showMicSettings && started && live.audioInputs.length > 0 && (
        <div className="px-4 pb-4 animate-fade-in">
          <select
            value={live.selectedDeviceId || ''}
            onChange={(e) => live.selectDevice(e.target.value)}
            className="w-full bg-surface-light text-text-muted text-secondary rounded-[18px] px-3 py-2.5 border border-border"
            aria-label="Escolher microfone"
          >
            <option value="">Padrão do sistema</option>
            {live.audioInputs.map((d) => (
              <option key={d.deviceId} value={d.deviceId}>{d.label || 'dispositivo sem nome'}</option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}

function EmptyCoach({
  statusText, started, returning, connecting,
}: {
  statusText: string;
  started: boolean;
  returning: boolean;
  connecting: boolean;
}) {
  return (
    <section
      className="rounded-[28px] p-5 animate-fade-in"
      style={{
        background: 'linear-gradient(165deg, var(--teacher-from) 0%, var(--teacher-to) 100%)',
        border: '1px solid var(--border)',
        boxShadow: 'var(--shadow-md)',
      }}
    >
      <div className="flex items-center gap-3 mb-4">
        <DeutschTurboMascot size="small" state={connecting ? 'thinking' : 'teacher'} />
        <div>
          <p className="text-body text-text font-bold tracking-wide">DEUTSCH COACH</p>
          <div className="flex items-center gap-1.5 mt-1.5">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-caption font-semibold" style={{ background: 'var(--chip-purple-bg)', color: 'var(--chip-purple-fg)' }}>
              Professor
            </span>
            <span className="text-caption text-text-muted">✨ {statusText}</span>
          </div>
        </div>
      </div>
      <p className="text-h2 text-text leading-snug">
        {connecting
          ? 'Conectando com seu professor…'
          : started
            ? 'Aguardando o professor…'
            : returning
              ? 'Continuando sua prática. Toque no microfone para retomar.'
              : 'Toque no microfone para começar a conversa com seu professor.'}
      </p>
    </section>
  );
}
