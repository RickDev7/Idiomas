import { useCallback, useEffect, useRef, useState } from 'react';
import { useStudySession } from '@/hooks/useStudySession';
import { createOrResumeAudioContext, MIC_CONSTRAINTS, MIC_PCM_RATE } from '@/services/voice/AudioPipeline';
import { stopAllAudio, stopGeminiPlayback } from '@/services/voice/AudioPlayback';
import { audioStreamPlayer } from '@/services/voice/AudioStreamPlayer';
import {
  beginLiveSession,
  invalidateLiveSession,
  isLiveSessionCurrent,
} from '@/services/voice/LiveSessionRegistry';
import {
  logTeacherAudio,
  logTeacherTranscript,
  resolveUiTeacherTurn,
  shouldEmitPedagogicalNudge,
} from '@/services/voice/TeacherTurnSync';
import { recordTalkSegment, beginTeacherTalkSession, setTeacherTalkMode } from '@/services/teacher/TeacherTalkMetrics';
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
import { readConversationTopicContext } from '@/services/teacher/ConversationTopicIntent';
import { readSimulatorContext } from '@/services/teacher/SimulatorIntent';
import { readMiniProvaContext } from '@/services/teacher/MiniProvaIntent';
import { startMiniProvaSession, readMiniProvaSnapshot } from '@/services/teacher/MiniProvaSession';
import {
  getSimulatorElapsedLabel,
  isSimulatorActive,
  isSimulatorTimeUp,
  recordSimulatorOpportunity,
  recordSimulatorTurn,
  startSimulatorSession,
} from '@/services/teacher/SimulatorSession';
import { readReviewSessionSnapshot } from '@/services/learning/ReviewSession';

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

function readFreeConversationIntent() {
  if (typeof window === 'undefined') return undefined;
  const q = new URLSearchParams(window.location.search);
  if (q.get('type') !== 'free') return undefined;
  return readConversationTopicContext();
}

function readSimulatorIntent() {
  if (typeof window === 'undefined') return undefined;
  const q = new URLSearchParams(window.location.search);
  if (q.get('type') !== 'simulator') return undefined;
  return readSimulatorContext();
}

function readMiniProvaIntent() {
  if (typeof window === 'undefined') return undefined;
  const q = new URLSearchParams(window.location.search);
  if (q.get('type') !== 'miniprova') return undefined;
  return readMiniProvaContext();
}

function isSimulatorSession(): boolean {
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).get('type') === 'simulator';
}

function isMiniProvaSession(): boolean {
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).get('type') === 'miniprova';
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
  /** Modo simulador ativo. */
  simulatorMode: boolean;
  /** Modo mini prova ativo. */
  miniProvaMode: boolean;
  /** Simulador ou mini prova — imersão em alemão, sem tradução. */
  immersionMode: boolean;
  /** Progresso da mini prova (questão atual / total). */
  miniProvaProgress: { current: number; total: number };
  /** Mini prova concluída — navegar para resultado. */
  miniProvaComplete: boolean;
  /** Tempo decorrido MM:SS (simulador). */
  simulatorElapsed: string;
  /** Label do cenário (simulador). */
  simulatorScenarioLabel: string | null;
  /** Tempo esgotado — encerrar simulação. */
  simulatorTimeUp: boolean;
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
  const [simulatorElapsed, setSimulatorElapsed] = useState('00:00');
  const [simulatorTimeUp, setSimulatorTimeUp] = useState(false);
  const [miniProvaProgress, setMiniProvaProgress] = useState({ current: 0, total: 0 });
  const [miniProvaComplete, setMiniProvaComplete] = useState(false);
  const simulatorTimeUpRef = useRef(false);
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
  const sessionGenRef = useRef(0);
  const naturalTeacherResponseExpectedRef = useRef(false);
  const teacherAudioLoggedForTurnRef = useRef('');
  const deferMicUntilTeacherRef = useRef(false);
  const micOpenTimeoutRef = useRef(0);
  const releaseDeferredMicRef = useRef(() => {});

  const syncUiFromTeacherUtterance = useCallback((
    teacherUtterance: string,
    turnId: string,
    final = false,
  ) => {
    const pedagogicalTarget = orchRef.current?.getPlan().target?.german ?? null;
    const displayed = resolveUiTeacherTurn({
      teacherUtterance,
      pedagogicalTarget,
      turnId,
      sessionGeneration: sessionGenRef.current,
      final,
    });
    if (displayed) setTargetPhrase(displayed);
  }, []);

  const applyDecision = useCallback(async (decision: Awaited<ReturnType<ConversationOrchestrator['handle']>>) => {
    // Não sobrescrever a decisão pedagógica do aluno com o eco da fala do professor
    if (decision.reason !== 'fala do professor registrada') {
      setPedagogicalAction(decision.action);
      setPedagogicalReason(decision.reason);
    }
    if (decision.reason === 'miniprova_done') {
      setMiniProvaComplete(true);
    }
    const mpSnap = orchRef.current?.getMiniProvaSnapshot();
    if (mpSnap) {
      setMiniProvaProgress({
        current: Math.min(mpSnap.currentIndex + (mpSnap.completed ? 0 : 1), mpSnap.total),
        total: mpSnap.total,
      });
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
      const emitNudge = shouldEmitPedagogicalNudge(decision, {
        liveVoiceActive: micActive || state === 'connected',
        naturalTeacherResponseExpected: naturalTeacherResponseExpectedRef.current,
        assistantSpeaking,
        teacherReceiving: teacherTurnStatus === 'RECEIVING',
        playerPlaying: audioStreamPlayer.getIsPlaying(),
      });
      if (emitNudge) {
        if (DEV) {
          console.debug(
            '[AUTOMATION]',
            `action=${decision.action}`,
            `reason=${decision.reason}`,
            `target=${decision.targetItem || ''}`,
          );
        }
        logTeacherAudio(
          {
            sessionGeneration: sessionGenRef.current,
            turnId: turnIdsRef.current.assistant || `nudge-${Date.now()}`,
            targetId: decision.targetItem,
            targetText: decision.targetItem,
          },
          'NUDGE',
          decision.geminiNudge,
        );
        naturalTeacherResponseExpectedRef.current = false;
        await svc.speak(decision.geminiNudge);
      } else if (DEV && decision.geminiNudge) {
        console.debug('[TEACHER_AUDIO] NUDGE skipped — Gemini Live já responde naturalmente', {
          reason: decision.reason,
          flow: decision.flow,
        });
      }
    }
  }, [assistantSpeaking, micActive, state, teacherTurnStatus]);

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
    if (isSimulatorActive()) {
      recordSimulatorOpportunity();
    }
    const decision = await orchRef.current.handleUserUtterance(trimmed);
    await applyDecision(decision);
    if (isSimulatorActive()) {
      const plan = orchRef.current.getPlan();
      const correct =
        !decision.correction &&
        decision.flow !== 'intervenePedagogically' &&
        !decision.eventsRecorded.includes('PHRASE_FAILED');
      recordSimulatorTurn({
        phraseId: plan.target?.id ?? null,
        german: trimmed,
        correct,
        withHint: decision.eventsRecorded.includes('PHRASE_PRODUCED_WITH_HINT'),
        withHelp:
          decision.eventsRecorded.includes('PHRASE_PRODUCED_WITH_HINT') ||
          /help|hint|ajuda/i.test(decision.reason),
        repeated: /repeat|repet/i.test(decision.reason),
      });
    }
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
      const reviewSessionSnapshot = readReviewSessionSnapshot();
      const miniProvaIntent = readMiniProvaIntent();
      const simulatorIntent = miniProvaIntent ? undefined : readSimulatorIntent();
      const conversationIntent = simulatorIntent || miniProvaIntent ? undefined : readFreeConversationIntent();
      if (simulatorIntent) {
        startSimulatorSession(simulatorIntent);
        simulatorTimeUpRef.current = false;
        setSimulatorTimeUp(false);
        beginTeacherTalkSession(sessionGenRef.current, 'SIMULATOR');
        setTeacherTalkMode(sessionGenRef.current, 'SIMULATOR');
      }
      const miniProvaSnapshot = miniProvaIntent
        ? (readMiniProvaSnapshot() || startMiniProvaSession(miniProvaIntent))
        : null;
      if (miniProvaSnapshot) {
        setMiniProvaProgress({
          current: Math.min(miniProvaSnapshot.currentIndex + 1, miniProvaSnapshot.total),
          total: miniProvaSnapshot.total,
        });
      }
      const orch = ConversationOrchestrator.create({
        profile,
        learning,
        phrases,
        reviewIntent,
        reviewSessionSnapshot,
        conversationIntent,
        simulatorIntent,
        miniProvaSnapshot,
        liveSessionGeneration: sessionGenRef.current,
      });
      orchRef.current = orch;
      userTurnsRef.current = 0;
      setUserTurns(0);
      const plan = orch.getPlan();
      const live = orch.toLiveFields();
      const pendingReview = orch.getPendingReview();
      setPedagogicalAction(plan.action);
      setPedagogicalReason(plan.actionReason || (reviewIntent ? 'review_session' : 'session_start'));
      // targetPhrase: sincronizado só após transcript do professor (syncUiFromTeacherUtterance)
      const stages = plan.training?.stages?.length ?? 0;
      const minutes = plan.training?.totalMinutes ?? profile.dailyMinutes ?? 20;
      const zeroMode = !!(live as { zeroLanguageMode?: boolean }).zeroLanguageMode;
      const simMode = !!simulatorIntent;
      const mpMode = !!miniProvaSnapshot;
      // L0: barra de progresso = orçamento de tempo (minutos), não “5 frases e fim”
      if (mpMode && miniProvaSnapshot) {
        setTargetTurns(miniProvaSnapshot.total);
      } else if (simMode && simulatorIntent) {
        setTargetTurns(Math.max(6, Math.round(simulatorIntent.durationMinutes * 1.2)));
      } else if (zeroMode) {
        const { zeroLanguageSessionUnits } = await import('@/services/teacher/ZeroLanguageMode');
        setTargetTurns(zeroLanguageSessionUnits(minutes));
      } else {
        setTargetTurns(Math.max(4, Math.min(8, stages || Math.round(minutes / 4) || 5)));
      }

      const { prepareSession } = await import('@/services/teacher/sessionContinuity');
      const prepared = prepareSession(profile, learning);
      let known = Object.values(learning.phrases).filter((c) => c.confidence >= 50).map((c) => c.phraseId).slice(0, 12);
      let weak = Object.values(learning.phrases).filter((c) => c.confidence > 0 && c.confidence < 40).map((c) => c.phraseId).slice(0, 6);
      const ctx = prepared.sessionContext;

      if (simMode && simulatorIntent) {
        const opening = plan.target?.german || prepared.opening.german;
        openingRef.current = {
          german: opening,
          kind: 'SIMULATOR',
          topic: plan.topic || prepared.opening.topic,
          returning: false,
        };
        setReturning(false);
        const sessionGen = sessionGenRef.current;
        if (DEV) {
          console.log('[SIMULATOR_INIT]', { session: sessionGen, intent: simulatorIntent.id });
          console.log('[SIMULATOR_INTENT]', {
            session: sessionGen,
            intent: simulatorIntent.id,
            claimed: orch.wasSimulatorKickoffClaimed(),
          });
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
          ...live,
          simulatorMode: true,
          miniProvaMode: false,
          zeroLanguageMode: false,
          liveSessionGeneration: sessionGen,
          openingGerman: opening,
          openingStrategy: 'simulator',
          sessionKind: 'SIMULATOR',
          sessionTopic: plan.topic,
          lastTopic: plan.topic,
          skipKickoff: !orch.wasSimulatorKickoffClaimed(),
        };
      }

      if (mpMode && miniProvaSnapshot) {
        const opening = plan.target?.german || '';
        openingRef.current = {
          german: opening,
          kind: 'MINI_PROVA',
          topic: 'Mini-Prüfung',
          returning: false,
        };
        setReturning(false);
        const sessionGen = sessionGenRef.current;
        if (DEV) {
          console.log('[SIMULATOR_INIT]', { session: sessionGen, mode: 'miniprova' });
        }
        return {
          level: profile.level,
          goal: profile.goal,
          profession: profile.profession,
          immersionLevel: profile.germanPercentage,
          intensiveMode: !!profile.turboMode,
          helpLevel: (await import('@/services/ui/UiPrefsService')).UiPrefsService.get().helpLevel,
          knownPhrases: known.length ? known : ctx.recentPhrases,
          weakPhrases: weak.length ? weak : ctx.weakPhrases,
          memorySummary: prepared.memorySummaryText,
          ...live,
          simulatorMode: false,
          miniProvaMode: true,
          zeroLanguageMode: false,
          liveSessionGeneration: sessionGen,
          openingGerman: opening,
          openingStrategy: 'miniprova',
          sessionKind: 'MINI_PROVA',
          sessionTopic: plan.topic,
          lastTopic: plan.topic,
        };
      }

      openingRef.current = {
        german: pendingReview?.prompt || prepared.opening.german,
        kind: reviewIntent ? 'REVIEW_SESSION' : prepared.opening.kind,
        topic: plan.topic || prepared.opening.topic,
        returning: prepared.returning,
      };
      setReturning(prepared.returning);
      // L0: aceitas NÃO vão para "FRACAS (reforce)" — senão Gemini volta para Wie geht's após erro novo
      if (zeroMode) {
        const { l0PhrasesForLiveProfile } = await import('@/services/teacher/ZeroLanguageMode');
        const buckets = l0PhrasesForLiveProfile(learning);
        known = buckets.knownPhrases;
        weak = buckets.weakPhrases;
      }
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

  releaseDeferredMicRef.current = () => {
    if (!deferMicUntilTeacherRef.current) return;
    deferMicUntilTeacherRef.current = false;
    if (micOpenTimeoutRef.current) {
      window.clearTimeout(micOpenTimeoutRef.current);
      micOpenTimeoutRef.current = 0;
    }
    const svc = serviceRef.current;
    if (!svc) return;
    try {
      console.log('[LIVE_DEBUG]', 'pcm:user:start');
      svc.beginSending();
      setMicActive(true);
    } catch {
      /* microfone ainda não adquirido */
    }
  };

  const wireHandlers = useCallback((): GeminiVoiceHandlers => ({
    onStateChange: (s) => setState(s),
    onMicState: (s) => setMicState(s),
    onTeacherAudio: () => {
      const turnId = turnIdsRef.current.assistant || `assistant-audio-${Date.now()}`;
      if (teacherAudioLoggedForTurnRef.current === turnId) return;
      teacherAudioLoggedForTurnRef.current = turnId;
      const plan = orchRef.current?.getPlan();
      logTeacherAudio(
        {
          sessionGeneration: sessionGenRef.current,
          turnId,
          targetId: plan?.target?.id ?? null,
          targetText: plan?.target?.german ?? null,
        },
        'GEMINI_LIVE',
      );
    },
    onTranscript: (role, text) => {
      const turn = accRef.current.applyChunk(role, text);
      const ids = turnIdsRef.current;
      const list = role === 'assistant' ? transcriptRef.current.assistant : transcriptRef.current.user;
      if (ids[role] !== turn.id) {
        if (role === 'assistant') {
          stopGeminiPlayback();
          setTargetPhrase(null);
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
        if (turn.text) {
          syncUiFromTeacherUtterance(turn.text, turn.id, false);
        }
        logTeacherTranscript(
          {
            sessionGeneration: sessionGenRef.current,
            turnId: turn.id,
            targetId: orchRef.current?.getPlan().target?.id ?? null,
            targetText: orchRef.current?.getPlan().target?.german ?? null,
          },
          turn.text,
        );
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
      if (
        done.text.trim() &&
        done.completedAt &&
        isLiveSessionCurrent(sessionGenRef.current)
      ) {
        recordTalkSegment({
          sessionGeneration: sessionGenRef.current,
          role: r === 'assistant' ? 'assistant' : 'user',
          turnId: done.id,
          startedAt: done.startedAt,
          completedAt: done.completedAt,
        });
      }
      if (r === 'assistant') {
        naturalTeacherResponseExpectedRef.current = false;
        teacherAudioLoggedForTurnRef.current = '';
        releaseDeferredMicRef.current();
        setAssistantText(done.text);
        setTeacherTurnStatus('COMPLETE');
        setAssistantSpeaking(false);
        const list = transcriptRef.current.assistant;
        if (list.length) list[list.length - 1] = done.text;
        else if (done.text) list.push(done.text);
        if (done.text.trim()) {
          const turnId = turnIdsRef.current.assistant || done.id;
          syncUiFromTeacherUtterance(done.text, turnId, true);
        }
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
        naturalTeacherResponseExpectedRef.current = true;
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
  }), [applyDecision, processUserTurnComplete, syncUiFromTeacherUtterance]);

  const resetSessionLocals = () => {
    endedRef.current = false;
    startedAtRef.current = Date.now();
    transcriptRef.current = { user: [], assistant: [] };
    accRef.current = new GeminiTurnAccumulator();
    lastProcessedUtteranceRef.current = null;
    turnIdsRef.current = { assistant: '', user: '' };
    userTurnMetaRef.current = null;
    orchQueueRef.current = Promise.resolve();
    naturalTeacherResponseExpectedRef.current = false;
    teacherAudioLoggedForTurnRef.current = '';
    deferMicUntilTeacherRef.current = false;
    if (micOpenTimeoutRef.current) {
      window.clearTimeout(micOpenTimeoutRef.current);
      micOpenTimeoutRef.current = 0;
    }
    setTargetPhrase(null);
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
    const refs = new Set<GeminiVoiceService>();
    if (activeVoiceService) refs.add(activeVoiceService);
    if (serviceRef.current) refs.add(serviceRef.current);
    for (const svc of refs) {
      try { svc.disconnect(); } catch { /* ignore */ }
    }
    activeVoiceService = null;
    serviceRef.current = null;
  };

  const releaseEarlyMic = (ctx: AudioContext | null, stream: MediaStream | null) => {
    stream?.getTracks().forEach((t) => t.stop());
    if (ctx && ctx.state !== 'closed') {
      try { void ctx.close(); } catch { /* ignore */ }
    }
  };

  const abandonStaleSession = (
    sessionGen: number,
    earlyCtx: AudioContext | null = null,
    earlyStream: MediaStream | null = null,
  ) => {
    if (isLiveSessionCurrent(sessionGen)) return false;
    releaseEarlyMic(earlyCtx, earlyStream);
    return true;
  };

  const start = useCallback(async () => {
    if (!profile) return;
    if (startingRef.current) return;
    startingRef.current = true;
    const sessionGen = beginLiveSession();
    sessionGenRef.current = sessionGen;
    audioStreamPlayer.setGeneration(sessionGen);
    stopAllAudio();
    resetSessionLocals();
    disposeActiveService();
    try {
      const liveProfile = await buildProfile();
      if (abandonStaleSession(sessionGen)) return;
      const svc = new GeminiVoiceService(liveProfile, wireHandlers(), undefined, sessionGen);
      if (abandonStaleSession(sessionGen)) {
        try { svc.disconnect(); } catch { /* ignore */ }
        return;
      }
      svc.setMicDeviceId(selectedDeviceId);
      serviceRef.current = svc;
      activeVoiceService = svc;
      await svc.preparePlaybackOnGesture();
      if (abandonStaleSession(sessionGen)) {
        try { svc.disconnect(); } catch { /* ignore */ }
        serviceRef.current = null;
        activeVoiceService = null;
        return;
      }
      await svc.connect();
      if (DEV) {
        console.log('[LIVE_CONNECT]', { session: sessionGen });
        console.log('[GEMINI_SESSION]', { session: sessionGen });
      }
      if (abandonStaleSession(sessionGen)) {
        try { svc.disconnect(); } catch { /* ignore */ }
        serviceRef.current = null;
        activeVoiceService = null;
        return;
      }
      void orchRef.current?.handle({ type: 'SESSION_STARTED' }).then((d) => {
        if (d) void applyDecision(d);
      });
      try {
        const devs = await navigator.mediaDevices.enumerateDevices();
        setAudioInputs(devs.filter((d) => d.kind === 'audioinput'));
      } catch { /* ignore */ }
    } catch {
      if (isLiveSessionCurrent(sessionGen)) {
        setError('Não consegui conectar ao professor.');
        setMicState('ERROR');
      }
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
    const sessionGen = beginLiveSession();
    sessionGenRef.current = sessionGen;
    audioStreamPlayer.setGeneration(sessionGen);
    stopAllAudio();
    resetSessionLocals();
    disposeActiveService();

    let earlyCtx: AudioContext | null = null;
    let earlyStream: MediaStream | null = null;
    try {
      setMicState('REQUESTING_PERMISSION');
      earlyCtx = await createOrResumeAudioContext(null, MIC_PCM_RATE);
      if (abandonStaleSession(sessionGen, earlyCtx, earlyStream)) return;
      const audioConstraint: MediaTrackConstraints = { ...MIC_CONSTRAINTS };
      if (selectedDeviceId) audioConstraint.deviceId = { exact: selectedDeviceId };
      earlyStream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraint });
      if (abandonStaleSession(sessionGen, earlyCtx, earlyStream)) return;
      const track = earlyStream.getAudioTracks()[0];
      if (!track || track.readyState !== 'live') throw new Error('microphone_inactive');
      if (DEV) {
        console.log('[VOICE INPUT] gesture OK — stream active =', earlyStream.active, 'readyState =', track.readyState);
      }
    } catch {
      if (isLiveSessionCurrent(sessionGen)) {
        setError('Preciso de acesso ao microfone. Permita na configuração do navegador.');
        setMicState('ERROR');
      }
      releaseEarlyMic(earlyCtx, earlyStream);
      startingRef.current = false;
      return;
    }

    try {
      const liveProfile = await buildProfile();
      if (abandonStaleSession(sessionGen, earlyCtx, earlyStream)) return;
      const svc = new GeminiVoiceService(liveProfile, wireHandlers(), undefined, sessionGen);
      if (abandonStaleSession(sessionGen, earlyCtx, earlyStream)) {
        try { svc.disconnect(); } catch { /* ignore */ }
        return;
      }
      svc.setMicDeviceId(selectedDeviceId);
      serviceRef.current = svc;
      activeVoiceService = svc;
      svc.attachAcquiredMic(earlyCtx, earlyStream);
      earlyCtx = null;
      earlyStream = null;
      await svc.preparePlaybackOnGesture();
      if (abandonStaleSession(sessionGen)) {
        try { svc.disconnect(); } catch { /* ignore */ }
        serviceRef.current = null;
        activeVoiceService = null;
        return;
      }
      await svc.connect();
      console.log('[LIVE_DEBUG]', 'startListening:connected', { session: sessionGen });
      console.log('[LIVE_DEBUG]', 'firstTeacherTurn:waiting', { session: sessionGen });
      if (abandonStaleSession(sessionGen)) {
        try { svc.disconnect(); } catch { /* ignore */ }
        serviceRef.current = null;
        activeVoiceService = null;
        return;
      }
      // Kickoff é enviado pelo backend no 'ready'. Não abrir o turno do aluno
      // até o primeiro turno do professor — senão o Gemini espera o usuário.
      deferMicUntilTeacherRef.current = true;
      if (micOpenTimeoutRef.current) window.clearTimeout(micOpenTimeoutRef.current);
      micOpenTimeoutRef.current = window.setTimeout(() => {
        console.log('[LIVE_DEBUG]', 'pcm:user:fallback_open', { session: sessionGen });
        releaseDeferredMicRef.current();
      }, 8000);
      void orchRef.current?.handle({ type: 'SESSION_STARTED' }).then((d) => {
        if (d) void applyDecision(d);
      });
      try {
        const devs = await navigator.mediaDevices.enumerateDevices();
        setAudioInputs(devs.filter((d) => d.kind === 'audioinput'));
      } catch { /* ignore */ }
    } catch {
      releaseEarlyMic(earlyCtx, earlyStream);
      deferMicUntilTeacherRef.current = false;
      if (micOpenTimeoutRef.current) {
        window.clearTimeout(micOpenTimeoutRef.current);
        micOpenTimeoutRef.current = 0;
      }
      try { serviceRef.current?.disconnect(); } catch { /* ignore */ }
      serviceRef.current = null;
      activeVoiceService = null;
      if (isLiveSessionCurrent(sessionGen)) {
        setError('Não consegui conectar ao professor.');
        setMicState('ERROR');
        setMicActive(false);
      }
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
      releaseDeferredMicRef.current();
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
    const gen = invalidateLiveSession();
    sessionGenRef.current = gen;
    audioStreamPlayer.setGeneration(gen);
    disposeActiveService();
    setMicActive(false);
    setMicState('IDLE');
    setState('idle');
  }, [persistEnd]);

  useEffect(() => {
    return () => {
      persistEnd('ABANDONED');
      const gen = invalidateLiveSession();
      sessionGenRef.current = gen;
      audioStreamPlayer.setGeneration(gen);
      disposeActiveService();
    };
  }, [persistEnd]);

  useStudySession(
    isSimulatorSession() ? 'simulator' : isMiniProvaSession() ? 'miniprova' : 'gemini-live',
    state === 'connected' && (micActive || assistantSpeaking),
  );

  useEffect(() => {
    if (!isSimulatorSession() || state !== 'connected') return;
    const tick = () => {
      setSimulatorElapsed(getSimulatorElapsedLabel());
      if (!simulatorTimeUpRef.current && isSimulatorTimeUp()) {
        simulatorTimeUpRef.current = true;
        setSimulatorTimeUp(true);
      }
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [state]);

  const simulatorScenarioLabel = isSimulatorSession()
    ? readSimulatorContext()?.scenario
      ? `${readSimulatorContext()!.scenario.emoji} ${readSimulatorContext()!.scenario.titleDe}`
      : 'Simulator'
    : null;

  const miniProvaMode = isMiniProvaSession();
  const immersionMode = isSimulatorSession() || miniProvaMode;

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
    simulatorMode: isSimulatorSession(),
    miniProvaMode,
    immersionMode,
    miniProvaProgress,
    miniProvaComplete,
    simulatorElapsed,
    simulatorScenarioLabel,
    simulatorTimeUp,
  };
}
