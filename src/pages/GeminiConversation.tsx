import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { UserProfile } from '@/types';
import { useGeminiLive } from '@/hooks/useGeminiLive';
import { IconButton } from '@/components/ui/Button';
import { IconBack, IconHangup, IconRefresh, IconLightbulb, IconTurtle, IconStop } from '@/components/ui/Icons';
import { toast } from '@/components/ui/Toast';
import { haptic } from '@/services/ui/UiPrefsService';
import { SoundService } from '@/services/ui/SoundService';
import { getVoiceService } from '@/services/voice/VoiceService';
import {
  TeacherCard, StudentResponseCard, ActionGrid, VoiceArea, SessionProgress,
  ConversationProgressBar, SequenceDots,
} from '@/components/voice/VoicePanels';
import { MicroPracticePanel } from '@/components/voice/MicroPracticePanel';
import {
  translateGermanToPortuguese,
  cachedTranslation,
  separateTeacherSpeech,
} from '@/services/ai/TranslationService';
import { useKeyboardInset } from '@/hooks/useKeyboardInset';

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

function buildPromptTitle(targetPhrase: string | null, germanFromSpeech: string): string {
  const raw = (targetPhrase || germanFromSpeech || '').trim();
  if (!raw) return '';
  const clean = raw.replace(/[.?!…]+$/u, '').trim();
  if (!clean) return '';
  const short = clean.length > 48 ? clean.slice(0, 48).trim() : clean;
  return `Diga "${short}".`;
}

function buildPromptSubtitle(
  embeddedPt: string,
  translatedPt: string,
  pedagogicalReason: string | null,
): string | undefined {
  const pt = (embeddedPt || translatedPt || '').trim();
  if (pt) {
    const first = pt.split(/[.!?]/)[0]?.trim() || pt;
    const clipped = first.length > 90 ? `${first.slice(0, 87).trim()}…` : first;
    if (/como se diz|diga|repita|significa/i.test(clipped)) {
      return clipped.endsWith('.') || clipped.endsWith('…') ? clipped : `${clipped}.`;
    }
    // Tradução curta → formato da referência: Como se diz 'Oi' em alemão.
    if (clipped.length <= 40) {
      return `Como se diz '${clipped}' em alemão.`;
    }
    return clipped.endsWith('.') || clipped.endsWith('…') ? clipped : `${clipped}.`;
  }
  const reason = (pedagogicalReason || '').trim();
  if (reason && reason.length < 80 && !/FRACAS|PROIBIDO|DEBUG|score/i.test(reason)) {
    return reason;
  }
  return undefined;
}

export function GeminiConversation({ profile, onFinish }: { profile: UserProfile; onFinish: () => void }) {
  const navigate = useNavigate();
  const live = useGeminiLive(profile);
  const [started, setStarted] = useState(false);
  const [showMicSettings, setShowMicSettings] = useState(false);
  const startLockRef = useRef(false);

  const [ptTranslation, setPtTranslation] = useState('');
  const translatedForRef = useRef('');

  const [textMode, setTextMode] = useState(false);
  const [textValue, setTextValue] = useState('');
  useKeyboardInset(textMode);

  const [responseStatus, setResponseStatus] = useState<'processing' | 'received' | 'none'>('none');
  const prevUserText = useRef('');
  const prevTargetRef = useRef<string | null>(null);

  useEffect(() => {
    if (live.error) toast(live.error, 'error');
  }, [live.error]);

  // Tradução só para subtítulo curto do card — sem painel BR / PISTA
  useEffect(() => {
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
    return () => { cancelled = true; };
  }, [live.assistantText, live.teacherTurnStatus]);

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

  // Nova frase-alvo → atualiza em lugar (sem empilhar cards)
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
          : live.micActive ? 'Ouvindo'
            : live.assistantSpeaking || live.teacherTurnStatus === 'RECEIVING' ? 'Falando'
              : responseStatus === 'processing' ? 'Verificando'
                : 'Pronto';

  const micStatus =
    live.micState === 'REQUESTING_PERMISSION' ? 'Pedindo microfone…'
      : live.micState === 'ERROR' ? 'Não conseguimos acessar o microfone'
        : live.micActive || live.micState === 'LISTENING' ? 'Estou ouvindo você'
          : live.assistantSpeaking ? 'Estou ouvindo você'
            : live.state === 'connecting' || live.state === 'reconnecting' ? 'Conectando…'
              : responseStatus === 'processing' ? 'Entendi. Estou verificando...'
                : started ? 'Toque para falar' : 'Toque para começar';

  const micHint =
    live.micState === 'ERROR' ? 'Verifique a permissão do microfone.'
      : undefined;

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

  const teacherSpeech = separateTeacherSpeech(live.assistantText);
  const shownGerman = teacherSpeech.german || (teacherSpeech.embeddedPortuguese ? '' : live.assistantText);

  const promptTitle = buildPromptTitle(live.targetPhrase, shownGerman);
  const promptSubtitle = buildPromptSubtitle(
    teacherSpeech.embeddedPortuguese,
    ptTranslation,
    live.pedagogicalReason,
  );

  /** Repetir = TTS local da última frase. Não dispara nova resposta Gemini. */
  const replayTeacher = () => {
    const text = (live.targetPhrase || shownGerman).trim();
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

  const progressCurrent = Math.min(
    live.targetTurns,
    Math.max(started ? 1 : 0, live.userTurns + (live.assistantText ? 1 : 0)),
  );

  const sequenceIndex = Math.max(0, Math.min(3, (live.userTurns || 0) % 4));

  const actions = [
    { icon: <IconRefresh size={18} />, label: 'Repetir', sub: 'Ouvir de novo', color: '#3b82f6', onClick: replayTeacher },
    { icon: <IconLightbulb size={18} />, label: 'Ajuda', sub: 'Preciso de ajuda', color: '#fbbf24', onClick: askHelp },
    { icon: <IconTurtle size={18} />, label: 'Devagar', sub: 'Falar mais devagar', color: '#10b981', onClick: askSlow },
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

  const showUserCard = !!live.userText && responseStatus !== 'none';

  return (
    <div className="flex flex-col h-full bg-background max-w-md mx-auto overflow-hidden">
      <header
        className="flex items-center justify-between gap-2 px-3 pb-2 shrink-0"
        style={{ paddingTop: 'calc(0.75rem + env(safe-area-inset-top, 0px))' }}
      >
        <IconButton label="Voltar" className="min-h-11 min-w-11" onClick={abandon}>
          <IconBack size={20} />
        </IconButton>
        <SessionProgress current={progressCurrent} total={live.targetTurns} />
        <button
          type="button"
          onClick={finish}
          className="inline-flex items-center gap-1.5 min-h-10 px-3 rounded-full text-[13px] font-semibold transition-colors"
          style={{ background: 'var(--hangup-bg)', color: 'var(--hangup-fg)', border: '1px solid var(--hangup-border)' }}
        >
          <IconHangup size={14} /> Encerrar
        </button>
      </header>

      <div className="px-4 pb-2 shrink-0">
        <ConversationProgressBar current={progressCurrent} total={live.targetTurns} />
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto scrollbar-hide px-4 flex flex-col">
        {live.assistantText || live.targetPhrase ? (
          <TeacherCard
            orbState={orbState}
            statusText={statusBadge}
            promptTitle={promptTitle || (live.assistantText ? 'Escute o professor.' : 'Aguardando o professor…')}
            promptSubtitle={promptSubtitle}
            onRepeat={replayTeacher}
          />
        ) : (
          <EmptyCoach
            statusText={statusBadge}
            started={started}
            returning={live.returning}
            connecting={live.state === 'connecting' || live.state === 'reconnecting'}
            onRepeat={replayTeacher}
          />
        )}

        <SequenceDots current={sequenceIndex} total={4} />

        {showUserCard && (
          <StudentResponseCard
            text={live.userText}
            status={responseStatus}
            feedback={feedback.text}
            feedbackTone={feedback.tone}
          />
        )}

        {import.meta.env.DEV && live.pedagogicalAction && (
          <p className="mt-2 text-[10px] text-text-faint font-mono px-1" aria-hidden>
            Action: {live.pedagogicalAction}
            {live.targetPhrase ? ` · Target: ${live.targetPhrase}` : ''}
          </p>
        )}

        {live.microPractice && (
          <div className="mt-2">
            <MicroPracticePanel
              session={live.microPractice}
              feedback={live.microFeedback}
              micActive={live.micActive}
              onSubmit={(t) => { void live.submitMicroAnswer(t); }}
              onSkip={() => { void live.skipMicroPractice(); }}
              onRequestHelp={() => { void live.sendHelp('Ajuda'); }}
            />
          </div>
        )}

        {live.error && (
          <div className="mt-3 rounded-[22px] dt-glass p-4 text-center animate-fade-in">
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
            className="mt-2 self-start inline-flex items-center gap-2 text-[12px] text-text-faint min-h-10 px-1"
          >
            <IconStop size={14} /> Interromper
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
        <div className="px-4 pb-3 animate-fade-in">
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
  statusText, started, returning, connecting, onRepeat,
}: {
  statusText: string;
  started: boolean;
  returning: boolean;
  connecting: boolean;
  onRepeat: () => void;
}) {
  const title = connecting
    ? 'Conectando com seu professor…'
    : started
      ? 'Aguardando o professor…'
      : returning
        ? 'Continuando sua prática.'
        : 'Toque no microfone para começar.';
  const sub = connecting
    ? undefined
    : started
      ? undefined
      : returning
        ? 'Toque no microfone para retomar.'
        : 'Seu professor de alemão está pronto.';

  return (
    <TeacherCard
      orbState={connecting ? 'processing' : 'idle'}
      statusText={statusText}
      promptTitle={title}
      promptSubtitle={sub}
      onRepeat={onRepeat}
    />
  );
}
