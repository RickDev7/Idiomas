import { useCallback, useEffect, useRef, useState } from 'react';
import { useStudySession } from '@/hooks/useStudySession';
import { createOrResumeAudioContext, MIC_CONSTRAINTS, MIC_PCM_RATE } from '@/services/voice/AudioPipeline';
import { stopAllAudio, stopGeminiPlayback } from '@/services/voice/AudioPlayback';
import { GeminiVoiceService, type GeminiVoiceHandlers, type MicCaptureState } from '@/services/voice/GeminiVoiceService';
import type { LiveSessionState } from '@/services/ai/GeminiLiveService';
import type { UserProfile } from '@/types';
import { MemoryService } from '@/services/learning/MemoryService';
import { StorageService } from '@/services/storage/StorageService';
import { GeminiTurnAccumulator } from '@/services/ai/GeminiResponseParser';
import type { TurnStatus } from '@/services/ai/GeminiResponseParser';
import { getIncompleteSession, getLastSession } from '@/services/teacher/sessionContinuity';
import {
  ConversationOrchestrator,
} from '@/services/teacher/ConversationOrchestrator';
import type { ReviewType } from '@/services/learning/ReviewEngine';

let activeVoiceService: GeminiVoiceService | null = null;

function readReviewIntent(): { phraseId?: string; reviewType?: ReviewType } | undefined {
  if (typeof window === 'undefined') return undefined;
  const q = new URLSearchParams(window.location.search);
  if (q.get('type') !== 'review') return undefined;
  const mode = q.get('mode') as ReviewType | null;
  return {
    phraseId: q.get('phrase') || undefined,
    reviewType: mode || undefined,
  };
}

const DEV = typeof import.meta !== 'undefined' && !!(import.meta as { env?: { DEV?: boolean } }).env?.DEV;

export interface UserCurrentTurn {
  id: string;
  text: string;
  startedAt: string;
  endedAt: string | null;
  confidence: number | null;
  complete: boolean;
}

export interface GeminiLiveUI {
  state: LiveSessionState;
  assistantText: string;
  userText: string;
  micActive: boolean;
  micLevel: number;
  micDevice: string | null;
  micState: MicCaptureState;
  audioInputs: MediaDeviceInfo[];
  selectedDeviceId: string | null;
  selectDevice: (id: string) => void;
  error: string | null;
  /** Conecta ao Gemini (sem mic). Preferir startListening no 1º toque. */
  start: () => Promise<void>;
  /** Fase 1A: 1º toque — mic no gesture + connect + PCM. */
  startListening: () => Promise<void>;
  toggleMic: () => Promise<void>;
  sendHelp: (text: string) => Promise<void>;
  /** Fallback texto: manda ao Gemini + Orchestrator como USER_UTTERANCE. */
  submitUserText: (text: string) => Promise<void>;
  interrupt: () => void;
  end: (status?: 'COMPLETED' | 'PAUSED' | 'ABANDONED') => void;
  returning: boolean;
  teacherTurnStatus: TurnStatus;
  userTurnStatus: TurnStatus;
  userCurrentTurn: UserCurrentTurn | null;
  pedagogicalAction: string | null;
  pedagogicalReason: string | null;
  targetPhrase: string | null;
  microPractice: import('@/services/teacher/MicroPracticeEngine').MicroPracticeSession | null;
  microFeedback: string | null;
  submitMicroAnswer: (text: string) => Promise<void>;
  skipMicroPractice: () => Promise<void>;
  /** Turnos do aluno concluídos nesta sessão (progresso real). */
  userTurns: number;
  /** Meta de turnos estimada a partir do plano de treino. */
  targetTurns: number;
  /** Professor emitindo áudio/transcrição. */
  assistantSpeaking: boolean;
}

export function useGeminiLive(profile: UserProfile | null): GeminiLiveUI {
  const [state, setState] = useState<LiveSessionState>('idle');
  const [assistantText, setAssistantText] = useState('');
  const [userText, setUserText] = useState('');
  const [micActive, setMicActive] = useState(false);
  const [micLevel, setMicLevel] = useState(0);
  const [micDevice, setMicDevice] = useState<string | null>(null);
  const [micState, setMicState] = useState<MicCaptureState>('IDLE');
  const [audioInputs, setAudioInputs] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(
    () => localStorage.getItem('dt_mic_id'),
  );
  const [error, setError] = useState<string | null>(null);
  const [returning, setReturning] = useState(() => !!(getLastSession() || getIncompleteSession()));
  const [teacherTurnStatus, setTeacherTurnStatus] = useState<TurnStatus>('IDLE');
  const [userTurnStatus, setUserTurnStatus] = useState<TurnStatus>('IDLE');
  const [userCurrentTurn, setUserCurrentTurn] = useState<UserCurrentTurn | null>(null);
  const [pedagogicalAction, setPedagogicalAction] = useState<string | null>(null);
  const [pedagogicalReason, setPedagogicalReason] = useState<string | null>(null);
  const [targetPhrase, setTargetPhrase] = useState<string | null>(null);
  const [microPractice, setMicroPractice] = useState<import('@/services/teacher/MicroPracticeEngine').MicroPracticeSession | null>(null);
  const [microFeedback, setMicroFeedback] = useState<string | null>(null);
  const [userTurns, setUserTurns] = useState(0);
  const [targetTurns, setTargetTurns] = useState(5);
  const [assistantSpeaking, setAssistantSpeaking] = useState(false);
  const accRef = useRef(new GeminiTurnAccumulator());
  const turnIdsRef = useRef({ assistant: '', user: '' });
  const serviceRef = useRef<GeminiVoiceService | null>(null);
  const transcriptRef = useRef<{ user: string[]; assistant: string[] }>({ user: [], assistant: [] });
  const startingRef = useRef(false);
  const endedRef = useRef(false);
  const openingRef = useRef<{ german: string; kind: string; topic: string; returning: boolean } | null>(null);
  const startedAtRef = useRef<number>(0);
  const orchRef = useRef<ConversationOrchestrator | null>(null);
  const userTurnsRef = useRef(0);
  const userTurnMetaRef = useRef<UserCurrentTurn | null>(null);
  const lastProcessedUtteranceRef = useRef<{ id: string; text: string; at: number } | null>(null);
  /** Serializa TEACHER_UTTERANCE → USER_UTTERANCE para o snapshot do turno existir antes da avaliação. */
  const orchQueueRef = useRef(Promise.resolve());

  const applyDecision = useCallback(async (decision: Awaited<ReturnType<ConversationOrchestrator['handle']>>) => {
    // Não sobrescrever a decisão pedagógica do aluno com o eco da fala do professor
    if (decision.reason !== 'fala do professor registrada') {
      setPedagogicalAction(decision.action);
      setPedagogicalReason(decision.reason);
      if (decision.targetItem) setTargetPhrase(decision.targetItem);
    }
    if (DEV && decision.reason !== 'fala do professor registrada') {
      console.log('[PEDAGOGICAL ACTION]', decision.action, decision.reason, decision.targetItem || '');
    }
    if (decision.flow === 'startMicroPractice') {
      setMicroPractice(decision.microPractice ?? null);
      setMicroFeedback(decision.microFeedback ?? null);
    } else if (decision.flow === 'resumeConversation') {
      setMicroPractice(null);
      setMicroFeedback(null);
    } else if (decision.microPractice) {
      setMicroPractice(decision.microPractice);
      setMicroFeedback(decision.microFeedback ?? null);
    }
    const svc = serviceRef.current;
    if (decision.geminiNudge && svc) {
      const isOpeningTurn =
        decision.reason === 'sessão iniciada com plano TeacherEngine' ||
        decision.reason?.startsWith('review_started:') ||
        decision.reason === 'follow_up_real_world_event';
      const shouldSend =
        !isOpeningTurn &&
        (decision.flow === 'intervenePedagogically' ||
          decision.flow === 'startMicroPractice' ||
          decision.flow === 'resumeConversation' ||
          (decision.flow === 'continueConversation' &&
            decision.geminiNudge.includes('INSTRUÇÃO INTERNA')));
      if (shouldSend) {
        if (DEV) {
          console.debug(
            '[AUTOMATION]',
            `action=${decision.action}`,
            `reason=${decision.reason}`,
            `target=${decision.targetItem || ''}`,
          );
        }
        await svc.speak(decision.geminiNudge);
      }
    }
  }, []);

  const processUserTurnComplete = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const turnId = userTurnMetaRef.current?.id || `user-${Date.now()}`;
    const now = Date.now();
    const last = lastProcessedUtteranceRef.current;
    if (last && last.id === turnId && last.text === trimmed) {
      if (DEV) console.debug('[USER TRANSCRIPT DEDUP]', turnId, trimmed);
      return;
    }
    if (last && last.text === trimmed && now - last.at < 2000) {
      if (DEV) console.debug('[USER TRANSCRIPT DEDUP text]', trimmed);
      return;
    }
    lastProcessedUtteranceRef.current = { id: turnId, text: trimmed, at: now };

    const meta: UserCurrentTurn = {
      id: turnId,
      text: trimmed,
      startedAt: userTurnMetaRef.current?.startedAt || new Date().toISOString(),
      endedAt: new Date().toISOString(),
      confidence: null,
      complete: true,
    };
    userTurnMetaRef.current = meta;
    setUserCurrentTurn(meta);
    if (DEV) {
      console.log('[USER TRANSCRIPT COMPLETE]', {
        utteranceId: turnId,
        text: trimmed,
        target: orchRef.current?.getPlan().target?.german,
        at: meta.endedAt,
      });
    }

    if (!orchRef.current) return;
    userTurnsRef.current += 1;
    setUserTurns(userTurnsRef.current);
    const decision = await orchRef.current.handleUserUtterance(trimmed);
    await applyDecision(decision);
    const wrap = orchRef.current.maybeZeroLanguageWrapUp();
    if (wrap) await applyDecision(wrap);
  }, [applyDecision]);

  const buildProfile = useCallback(async () => {
    if (!profile) return {};
    try {
      await MemoryService.ensureAutomationScores();
      const learning = await MemoryService.loadProfile(profile);
      const phrases = await StorageService.getAllPhrases();
      const reviewIntent = readReviewIntent();
      const orch = ConversationOrchestrator.create({ profile, learning, phrases, reviewIntent });
      orchRef.current = orch;
      userTurnsRef.current = 0;
      setUserTurns(0);
      const plan = orch.getPlan();
      const live = orch.toLiveFields();
      const pendingReview = orch.getPendingReview();
      setPedagogicalAction(plan.action);
      setPedagogicalReason(plan.actionReason || (reviewIntent ? 'review_session' : 'session_start'));
      setTargetPhrase(pendingReview?.german ?? plan.target?.german ?? null);
      const stages = plan.training?.stages?.length ?? 0;
      const minutes = plan.training?.totalMinutes ?? profile.dailyMinutes ?? 20;
      const zeroMode = !!(live as { zeroLanguageMode?: boolean }).zeroLanguageMode;
      // L0: barra de progresso = orçamento de tempo (minutos), não “5 frases e fim”
      if (zeroMode) {
        const { zeroLanguageSessionUnits } = await import('@/services/teacher/ZeroLanguageMode');
        setTargetTurns(zeroLanguageSessionUnits(minutes));
      } else {
        setTargetTurns(Math.max(4, Math.min(8, stages || Math.round(minutes / 4) || 5)));
      }

      const { prepareSession } = await import('@/services/teacher/sessionContinuity');
      const prepared = prepareSession(profile, learning);
      openingRef.current = {
        german: pendingReview?.prompt || prepared.opening.german,
        kind: reviewIntent ? 'REVIEW_SESSION' : prepared.opening.kind,
        topic: plan.topic || prepared.opening.topic,
        returning: prepared.returning,
      };
      setReturning(prepared.returning);
      let known = Object.values(learning.phrases).filter((c) => c.confidence >= 50).map((c) => c.phraseId).slice(0, 12);
      let weak = Object.values(learning.phrases).filter((c) => c.confidence > 0 && c.confidence < 40).map((c) => c.phraseId).slice(0, 6);
      // L0: aceitas NÃO vão para "FRACAS (reforce)" — senão Gemini volta para Wie geht's após erro novo
      if (zeroMode) {
        const { l0PhrasesForLiveProfile } = await import('@/services/teacher/ZeroLanguageMode');
        const buckets = l0PhrasesForLiveProfile(learning);
        known = buckets.knownPhrases;
        weak = buckets.weakPhrases;
      }
      const ctx = prepared.sessionContext;
      const openingGerman = zeroMode
        ? (plan.target?.german || prepared.opening.german)
        : (openingRef.current?.german || prepared.opening.german);
      if (zeroMode) {
        openingRef.current = {
          german: openingGerman,
          kind: reviewIntent ? 'REVIEW_SESSION' : prepared.opening.kind,
          topic: plan.topic || prepared.opening.topic,
          returning: prepared.returning,
        };
      }
      return {
        level: profile.level,
        goal: profile.goal,
        profession: profile.profession,
        immersionLevel: profile.germanPercentage,
        intensiveMode: !!profile.turboMode,
        helpLevel: (await import('@/services/ui/UiPrefsService')).UiPrefsService.get().helpLevel,
        immersionGuidance: (await import('@/services/teacher/TeacherEngine')).immersionGuidanceForTeacher(profile.germanPercentage ?? 80),
        intensiveGuidance: (await import('@/services/teacher/TeacherEngine')).intensiveGuidanceForTeacher(!!profile.turboMode),
        knownPhrases: known.length ? known : ctx.recentPhrases,
        weakPhrases: weak.length ? weak : ctx.weakPhrases,
        memorySummary: prepared.memorySummaryText,
        openingStrategy: reviewIntent ? 'review' : prepared.opening.strategy,
        sessionKind: openingRef.current?.kind || prepared.opening.kind,
        sessionKickoff: pendingReview
          ? [
              '[INSTRUÇÃO INTERNA — não leia isto em voz alta]',
              'Sessão de revisão em conversa. Não diga a palavra review.',
              `Comece falando: "${pendingReview.prompt}"`,
            ].join('\n')
          : (zeroMode ? (live.orchestratorKickoff || prepared.kickoff) : prepared.kickoff),
        lastTopic: ctx.recentTopic || plan.topic,
        lastQuestion: ctx.lastTeacherQuestion,
        lastUserAnswer: ctx.lastUserAnswer,
        unfinishedGoal: ctx.unfinishedGoal,
        nextStep: ctx.recommendedContinuation,
        recentMistakes: ctx.recentMistakes,
        ...live,
        zeroLanguageMode: zeroMode,
        openingGerman,
      };
    } catch {
      return { level: profile.level, goal: profile.goal, profession: profile.profession };
    }
  }, [profile]);

  const wireHandlers = useCallback((): GeminiVoiceHandlers => ({
    onStateChange: (s) => setState(s),
    onMicState: (s) => setMicState(s),
    onTranscript: (role, text) => {
      const turn = accRef.current.applyChunk(role, text);
      const ids = turnIdsRef.current;
      const list = role === 'assistant' ? transcriptRef.current.assistant : transcriptRef.current.user;
      if (ids[role] !== turn.id) {
        if (role === 'assistant') {
          stopGeminiPlayback();
        }
        ids[role] = turn.id;
        list.push(turn.text);
      } else if (list.length) {
        list[list.length - 1] = turn.text;
      } else {
        list.push(turn.text);
      }
      if (role === 'assistant') {
        setAssistantText(turn.text);
        setTeacherTurnStatus(turn.status);
        setAssistantSpeaking(turn.status === 'RECEIVING');
      } else if (turn.text) {
        setUserText(turn.text);
        setUserTurnStatus(turn.status);
        if (!userTurnMetaRef.current || userTurnMetaRef.current.complete) {
          userTurnMetaRef.current = {
            id: turn.id,
            text: turn.text,
            startedAt: turn.startedAt || new Date().toISOString(),
            endedAt: null,
            confidence: null,
            complete: false,
          };
          setUserCurrentTurn(userTurnMetaRef.current);
        } else {
          userTurnMetaRef.current = { ...userTurnMetaRef.current, text: turn.text };
          setUserCurrentTurn(userTurnMetaRef.current);
        }
      }
      void import('@/services/teacher/sessionContinuity').then(({ autosaveTurn }) => {
        autosaveTurn(role, turn.text);
      }).catch(() => {});
    },
    onTurnComplete: (role, text) => {
      const r = role || 'assistant';
      const current = r === 'assistant' ? accRef.current.assistant : accRef.current.user;
      if (text && current.status !== 'COMPLETE') accRef.current.applyChunk(r, text);
      const done = accRef.current.complete(r);
      if (r === 'assistant') {
        setAssistantText(done.text);
        setTeacherTurnStatus('COMPLETE');
        setAssistantSpeaking(false);
        const list = transcriptRef.current.assistant;
        if (list.length) list[list.length - 1] = done.text;
        else if (done.text) list.push(done.text);
        if (done.text.trim() && orchRef.current) {
          const text = done.text;
          orchQueueRef.current = orchQueueRef.current
            .then(async () => {
              if (!orchRef.current) return;
              const d = await orchRef.current.handle({ type: 'TEACHER_UTTERANCE', text });
              await applyDecision(d);
            })
            .catch(() => { /* não quebrar a fila */ });
        }
      } else {
        setUserText(done.text);
        setUserTurnStatus('COMPLETE');
        const list = transcriptRef.current.user;
        if (list.length) list[list.length - 1] = done.text;
        else if (done.text) list.push(done.text);
        const userTextDone = done.text;
        orchQueueRef.current = orchQueueRef.current
          .then(() => processUserTurnComplete(userTextDone))
          .catch(() => { /* não quebrar a fila */ });
      }
      void import('@/services/teacher/sessionContinuity').then(({ autosaveTurn }) => {
        if (done.text) autosaveTurn(r, done.text);
      }).catch(() => {});
    },
    onError: (m) => {
      setError(m);
      void orchRef.current?.handle({ type: 'ERROR', message: m });
    },
    onMicLevel: (lvl) => setMicLevel(lvl),
    onMicDevice: (label) => setMicDevice(label),
  }), [applyDecision, processUserTurnComplete]);

  const resetSessionLocals = () => {
    endedRef.current = false;
    startedAtRef.current = Date.now();
    transcriptRef.current = { user: [], assistant: [] };
    accRef.current = new GeminiTurnAccumulator();
    lastProcessedUtteranceRef.current = null;
    turnIdsRef.current = { assistant: '', user: '' };
    userTurnMetaRef.current = null;
    orchQueueRef.current = Promise.resolve();
    setAssistantText('');
    setUserText('');
    setTeacherTurnStatus('IDLE');
    setUserTurnStatus('IDLE');
    setUserCurrentTurn(null);
    setUserTurns(0);
    setAssistantSpeaking(false);
    setError(null);
    setMicLevel(0);
  };

  const disposeActiveService = () => {
    if (activeVoiceService) {
      try { activeVoiceService.disconnect(); } catch { /* ignore */ }
      activeVoiceService = null;
    }
    try { serviceRef.current?.disconnect(); } catch { /* ignore */ }
    serviceRef.current = null;
  };

  const start = useCallback(async () => {
    if (!profile) return;
    if (startingRef.current) return;
    startingRef.current = true;
    resetSessionLocals();
    disposeActiveService();
    try {
      const liveProfile = await buildProfile();
      const svc = new GeminiVoiceService(liveProfile, wireHandlers());
      svc.setMicDeviceId(selectedDeviceId);
      serviceRef.current = svc;
      activeVoiceService = svc;
      await svc.connect();
      void orchRef.current?.handle({ type: 'SESSION_STARTED' }).then((d) => {
        if (d) void applyDecision(d);
      });
      try {
        const devs = await navigator.mediaDevices.enumerateDevices();
        setAudioInputs(devs.filter((d) => d.kind === 'audioinput'));
      } catch { /* ignore */ }
    } catch {
      setError('Não consegui conectar ao professor.');
      setMicState('ERROR');
    } finally {
      startingRef.current = false;
    }
  }, [profile, buildProfile, selectedDeviceId, wireHandlers, applyDecision]);

  /**
   * Fase 1A — primeiro toque:
   * 1) getUserMedia + AudioContext.resume no user gesture
   * 2) buildProfile + WS
   * 3) beginSending PCM 16 kHz
   */
  const startListening = useCallback(async () => {
    if (!profile) return;
    if (startingRef.current) return;
    startingRef.current = true;
    stopAllAudio();
    resetSessionLocals();
    disposeActiveService();

    let earlyCtx: AudioContext | null = null;
    let earlyStream: MediaStream | null = null;
    try {
      setMicState('REQUESTING_PERMISSION');
      earlyCtx = await createOrResumeAudioContext(null, MIC_PCM_RATE);
      const audioConstraint: MediaTrackConstraints = { ...MIC_CONSTRAINTS };
      if (selectedDeviceId) audioConstraint.deviceId = { exact: selectedDeviceId };
      earlyStream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraint });
      const track = earlyStream.getAudioTracks()[0];
      if (!track || track.readyState !== 'live') throw new Error('microphone_inactive');
      if (DEV) {
        console.log('[VOICE INPUT] gesture OK — stream active =', earlyStream.active, 'readyState =', track.readyState);
      }
    } catch {
      startingRef.current = false;
      earlyStream?.getTracks().forEach((t) => t.stop());
      try { void earlyCtx?.close(); } catch { /* ignore */ }
      setError('Preciso de acesso ao microfone. Permita na configuração do navegador.');
      setMicState('ERROR');
      return;
    }

    try {
      const liveProfile = await buildProfile();
      const svc = new GeminiVoiceService(liveProfile, wireHandlers());
      svc.setMicDeviceId(selectedDeviceId);
      serviceRef.current = svc;
      activeVoiceService = svc;
      svc.attachAcquiredMic(earlyCtx, earlyStream);
      earlyCtx = null;
      earlyStream = null;
      await svc.preparePlaybackOnGesture();
      await svc.connect();
      svc.beginSending();
      setMicActive(true);
      void orchRef.current?.handle({ type: 'SESSION_STARTED' }).then((d) => {
        if (d) void applyDecision(d);
      });
      try {
        const devs = await navigator.mediaDevices.enumerateDevices();
        setAudioInputs(devs.filter((d) => d.kind === 'audioinput'));
      } catch { /* ignore */ }
    } catch {
      earlyStream?.getTracks().forEach((t) => t.stop());
      try { void earlyCtx?.close(); } catch { /* ignore */ }
      setError('Não consegui conectar ao professor.');
      setMicState('ERROR');
      setMicActive(false);
    } finally {
      startingRef.current = false;
    }
  }, [profile, selectedDeviceId, wireHandlers, buildProfile, applyDecision]);

  const toggleMic = useCallback(async () => {
    const svc = serviceRef.current;
    if (!svc) return;
    if (micActive) {
      svc.stopMic();
      setMicActive(false);
    } else {
      try {
        await svc.startMic();
        setMicActive(true);
      } catch {
        setError('Preciso de acesso ao microfone. Permita na configuração do navegador.');
        setMicState('ERROR');
      }
    }
  }, [micActive]);

  const selectDevice = useCallback((id: string) => {
    setSelectedDeviceId(id);
    localStorage.setItem('dt_mic_id', id);
    const svc = serviceRef.current;
    if (svc) {
      svc.setMicDeviceId(id);
      if (svc.isListening()) {
        svc.stopMic();
        void svc.startMic().then(() => setMicActive(true)).catch(() => {
          setError('Não consegui usar esse microfone.');
        });
      }
    }
  }, []);

  const sendHelp = useCallback(async (text: string) => {
    const decision = orchRef.current
      ? await orchRef.current.handle({ type: 'HELP_REQUESTED', text })
      : null;
    if (decision) await applyDecision(decision);
    else await serviceRef.current?.speak(text);
  }, [applyDecision]);

  const submitUserText = useCallback(async (text: string) => {
    const t = text.trim();
    if (!t) return;
    setUserText(t);
    setUserTurnStatus('COMPLETE');
    const list = transcriptRef.current.user;
    list.push(t);
    await serviceRef.current?.sendUserText(t);
    await processUserTurnComplete(t);
  }, [processUserTurnComplete]);

  const submitMicroAnswer = useCallback(async (text: string) => {
    if (!orchRef.current || !text.trim()) return;
    const decision = await orchRef.current.handle({ type: 'MICRO_ANSWER', text });
    await applyDecision(decision);
  }, [applyDecision]);

  const skipMicroPractice = useCallback(async () => {
    if (!orchRef.current) return;
    const decision = await orchRef.current.handle({ type: 'MICRO_SKIP' });
    await applyDecision(decision);
  }, [applyDecision]);

  const interrupt = useCallback(() => {
    stopAllAudio();
    serviceRef.current?.interrupt();
  }, []);

  useEffect(() => {
    if (teacherTurnStatus !== 'RECEIVING' || !assistantText) return;
    const t = setTimeout(() => {
      const done = accRef.current.complete('assistant');
      setAssistantText(done.text);
      setTeacherTurnStatus('COMPLETE');
      setAssistantSpeaking(false);
    }, 1600);
    return () => clearTimeout(t);
  }, [assistantText, teacherTurnStatus]);

  const persistEnd = useCallback((status: 'COMPLETED' | 'PAUSED' | 'ABANDONED' = 'COMPLETED') => {
    if (endedRef.current) return;
    const lastTeacher = transcriptRef.current.assistant.slice(-1)[0] || '';
    const lastUser = transcriptRef.current.user.slice(-1)[0] || '';
    const learned = transcriptRef.current.user.map((t) => t.trim()).filter((t) => t.length > 3).slice(-6);
    if (!openingRef.current && !lastTeacher && !lastUser) return;
    endedRef.current = true;
    if (status === 'PAUSED') {
      void orchRef.current?.handle({ type: 'PAUSE' });
    } else {
      void orchRef.current?.handle({ type: 'SESSION_ENDED', status });
    }
    const minutes = Math.max(1, Math.round((Date.now() - (startedAtRef.current || Date.now())) / 60000));
    void import('@/services/teacher/sessionContinuity').then(({ completeSession, pauseSession, isScriptedGreeting }) => {
      const teacherIsGreeting = lastTeacher ? isScriptedGreeting(lastTeacher) : false;
      const unfinished =
        status === 'COMPLETED'
          ? []
          : lastTeacher && !teacherIsGreeting
            ? [lastTeacher]
            : [];
      const orchCtx = orchRef.current?.getContext();
      const payload = {
        topic: orchCtx?.topic || openingRef.current?.topic,
        durationMinutes: minutes,
        lastTeacherMessage: lastTeacher,
        lastUserResponse: lastUser,
        lastQuestion: teacherIsGreeting ? '' : lastTeacher,
        openingGerman: openingRef.current?.german,
        sessionKind: (openingRef.current?.kind as 'RETURNING_SESSION') || 'RETURNING_SESSION',
        phrasesLearned: learned,
        unfinishedContent: unfinished,
        nextSuggestedStep: orchCtx?.targetItem
          ? `revisar: ${orchCtx.targetItem}`
          : learned[0]
            ? `revisar: ${learned[0]}`
            : lastTeacher && !teacherIsGreeting
              ? `continuar: ${lastTeacher}`
              : 'continuar o mesmo tema',
        status,
      };
      if (status === 'COMPLETED') completeSession(payload);
      else pauseSession({ ...payload, status });
    }).catch(() => {});
  }, []);

  const end = useCallback((status: 'COMPLETED' | 'PAUSED' | 'ABANDONED' = 'COMPLETED') => {
    persistEnd(status);
    if (activeVoiceService) { try { activeVoiceService.disconnect(); } catch { /* ignore */ } activeVoiceService = null; }
    serviceRef.current?.disconnect();
    setMicActive(false);
    setMicState('IDLE');
    setState('idle');
  }, [persistEnd]);

  useEffect(() => {
    return () => {
      persistEnd('ABANDONED');
      const svc = serviceRef.current;
      if (svc && activeVoiceService === svc) {
        try { svc.disconnect(); } catch { /* ignore */ }
        activeVoiceService = null;
      }
    };
  }, [persistEnd]);

  useStudySession(
    'gemini-live',
    state === 'connected' && (micActive || assistantSpeaking),
  );

  return {
    state,
    assistantText,
    userText,
    micActive,
    micLevel,
    micDevice,
    micState,
    audioInputs,
    selectedDeviceId,
    selectDevice,
    error,
    start,
    startListening,
    toggleMic,
    sendHelp,
    submitUserText,
    interrupt,
    end,
    returning,
    teacherTurnStatus,
    userTurnStatus,
    userCurrentTurn,
    pedagogicalAction,
    pedagogicalReason,
    targetPhrase,
    microPractice,
    microFeedback,
    submitMicroAnswer,
    skipMicroPractice,
    userTurns,
    targetTurns,
    assistantSpeaking,
  };
}
