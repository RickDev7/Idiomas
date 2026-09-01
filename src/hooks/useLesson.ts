import { useCallback, useEffect, useRef, useState } from 'react';
import type { UserProfile } from '@/types';
import { getVoiceService } from '@/services/voice/VoiceService';
import {
  type Interaction,
  type Lesson,
} from '@/services/teacher/LessonEngine';
import { similarityScore } from '@/utils/reviewUtils';
import { MemoryService } from '@/services/learning/MemoryService';
import { ChunkTrackerStore } from '@/services/learning/ChunkTrackerStore';
import { detectBottleneck } from '@/services/learning/BottleneckDetector';
import type { PlannedActivity } from '@/services/learning/NextBestActivityEngine';
import { buildAdaptiveLesson } from '@/services/teacher/AdaptiveLessonBuilder';
import { StorageService } from '@/services/storage/StorageService';
import { EventStore, type LearningEventType } from '@/services/learning/EventStore';
import { inferLearningState, type LearningState } from '@/services/learning/LearningStateEngine';
import { analyzeSpontaneousUse } from '@/services/learning/ProgressEngine';
import { helpLevelToNumber, UiPrefsService } from '@/services/ui/UiPrefsService';
import {
  buildScaffoldHint,
  escalateSupport,
  recordHelpAttempt,
  startingSupportForPhrase,
  type SupportLevel,
} from '@/services/learning/ScaffoldingEngine';
import { computeSessionRealUse, type SessionRealUseOutcome } from '@/services/learning/RealUseEngine';

export type Phase = 'idle' | 'speaking' | 'listening' | 'grading' | 'feedback';

export interface UseLessonResult {
  lesson: Lesson;
  index: number;
  interaction: Interaction | null;
  phase: Phase;
  feedback: string;
  showTranslation: boolean;
  helpLevel: number;
  start: () => Promise<void>;
  next: () => void;
  listen: () => Promise<void>;
  requestHelp: () => void;
  dontKnow: () => void;
  repeat: () => Promise<void>;
  slower: () => Promise<void>;
  toggleTranslation: () => void;
  finished: boolean;
  persistSession: () => void;
  summary: {
    spoken: number;
    reinforced: number;
    newLearned: number;
    spontaneous: number;
    state: LearningState;
    realUse?: SessionRealUseOutcome;
  };
}

const FALLBACK_LESSON: Lesson = {
  id: 'fallback',
  title: 'Treino',
  level: 'zero',
  interactions: [
    { id: 'g1', type: 'open', german: 'Lass uns anfangen.', portuguese: 'Vamos começar.', support: 1, praise: 'Sehr gut!' },
    { id: 'o1', type: 'open', german: 'Was machst du heute?', portuguese: 'O que você faz hoje?', expected: 'ich', hint: 'Ich...', support: 1, praise: 'Sehr gut!' },
    { id: 'd1', type: 'done', german: 'Sehr gut!', portuguese: 'Muito bem!', support: 0 },
  ],
};

export function useLesson(type: string, profile: UserProfile | null): UseLessonResult {
  const [lesson, setLesson] = useState<Lesson>(FALLBACK_LESSON);
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>('idle');
  const [feedback, setFeedback] = useState('');
  const [showTranslation, setShowTranslation] = useState(false);
  const [helpLevel, setHelpLevel] = useState<SupportLevel>(() => {
    const pref = helpLevelToNumber(UiPrefsService.get().helpLevel);
    return Math.min(5, Math.max(0, pref)) as SupportLevel;
  });
  const [finished, setFinished] = useState(false);
  const [summary, setSummary] = useState({
    spoken: 0, reinforced: 0, newLearned: 0, spontaneous: 0, state: 'LEARNING' as LearningState,
    realUse: undefined as SessionRealUseOutcome | undefined,
  });
  const helpUsedRef = useRef(false);
  const voice = useRef(getVoiceService());
  const started = useRef(false);
  const listenStart = useRef<number>(0);
  const activitiesRef = useRef<PlannedActivity[]>([]);
  const newPhraseIds = useRef<Set<string>>(new Set());
  const reinforcedRef = useRef<number>(0);
  const spokenRef = useRef<number>(0);
  const spontaneousRef = useRef<number>(0);
  const sessionStartRef = useRef<number>(Date.now());
  const openingRef = useRef<{ german: string; kind: string; topic: string } | null>(null);
  const lessonRef = useRef(lesson);
  const savedRef = useRef(false);
  lessonRef.current = lesson;

  const interaction = lesson.interactions[index] ?? null;

  const speak = useCallback(async (text: string, slow = false) => {
    if (!text) return;
    setPhase('speaking');
    const v = voice.current;
    if (slow) v.setSpeed('slow');
    try {
      await v.speak(text);
    } catch {
      /* ignore */
    } finally {
      if (slow) v.setSpeed(profile?.speechSpeed ?? 'normal');
      setPhase('idle');
    }
  }, [profile?.speechSpeed]);

  const buildLesson = useCallback(async () => {
    if (!profile) return FALLBACK_LESSON;
    if (type === 'assessment') {
      const { loadCourseProgress } = await import('@/services/course/CourseProgressEngine');
      const { nextAssessmentTarget, buildAssessmentLesson } = await import('@/services/course/LevelAssessment');
      const cp = await loadCourseProgress(profile.level);
      const target = nextAssessmentTarget(cp) ?? cp.currentLevel;
      const a = buildAssessmentLesson(target);
      return {
        id: a.id,
        title: a.title,
        level: profile.level,
        interactions: a.interactions,
      } as typeof FALLBACK_LESSON;
    }
    if (type === 'micro') {
      const { prepareSession } = await import('@/services/teacher/sessionContinuity');
      const prepared = prepareSession(profile, null);
      openingRef.current = { german: prepared.opening.german, kind: prepared.opening.kind, topic: prepared.opening.topic };
      return {
        id: 'micro',
        title: '2 minutos',
        level: profile.level,
        interactions: [
          { id: 'm1', type: 'open', german: prepared.opening.german, portuguese: prepared.opening.portuguese, expected: prepared.opening.expected, hint: prepared.opening.hint, support: 1, praise: 'Gut!' },
          { id: 'm2', type: 'open', german: 'Was machst du heute?', portuguese: 'O que você faz hoje?', expected: 'ich', hint: 'Ich...', support: 1, praise: 'Gut!' },
          { id: 'm3', type: 'done', german: 'Schnell! Bis später.', portuguese: 'Rápido! Até logo.', support: 0 },
        ],
      } as Lesson;
    }
    try {
      const learning = await MemoryService.loadProfile(profile);
      const allPhrases = await StorageService.getAllPhrases();
      // Camada de curso: filtra o pool pelo nível/competência atual quando disponível.
      const { loadCourseProgress } = await import('@/services/course/CourseProgressEngine');
      const { phrasesForCourse } = await import('@/services/teacher/TeacherEngine');
      const { isRecoveryActive } = await import('@/services/course/CoursePlateauEngine');
      const course = await loadCourseProgress(profile.level).catch(() => null);
      const pool = course ? phrasesForCourse(allPhrases, course) : allPhrases;
      const recovery = course && isRecoveryActive(course) ? course.recovery : null;
      const events = await EventStore.load();
      const snap = inferLearningState(events);
      const total = snap.recentTotal || 1;
      const recentCorrectRate = snap.recentCorrect / total;
      const recentRetention = 0.7;
      const { optimizeDay } = await import('@/services/optimizer/DailyOptimizer');
      const { prepareSession } = await import('@/services/teacher/sessionContinuity');
      const prepared = prepareSession(profile, learning);
      openingRef.current = { german: prepared.opening.german, kind: prepared.opening.kind, topic: prepared.opening.topic };
      const plan = optimizeDay(profile, learning, detectBottleneck(learning), snap.state, recentCorrectRate, recentRetention, pool, recovery);
      const activities = plan.activities;
      activitiesRef.current = activities;
      newPhraseIds.current = new Set(activities.flatMap((a) => a.kind === 'newContent' ? a.phraseIds : []));
      return buildAdaptiveLesson(profile, learning, activities, pool, detectBottleneck(learning), prepared.opening);
    } catch {
      return FALLBACK_LESSON;
    }
  }, [profile, type]);

  const start = useCallback(async () => {
    if (started.current) return;
    started.current = true;
    sessionStartRef.current = Date.now();
    await EventStore.record({ type: 'SESSION_STARTED' as LearningEventType });
    const built = await buildLesson();
    setLesson(built);
    const first = built.interactions[0];
    if (first) {
      setShowTranslation(first.type === 'teach' || first.type === 'greet');
      await speak(first.german);
    }
  }, [buildLesson, speak]);

  const advance = useCallback(() => {
    setFeedback('');
    helpUsedRef.current = false;
    if (interaction.phraseId) {
      setHelpLevel(startingSupportForPhrase(interaction.phraseId));
    } else {
      setHelpLevel(Math.min(5, Math.max(0, helpLevelToNumber(UiPrefsService.get().helpLevel))) as SupportLevel);
    }
    setShowTranslation(false);
    setIndex((i) => {
      const nextIdx = i + 1;
      if (nextIdx >= lesson.interactions.length) {
        setFinished(true);
        void finalize();
        return i;
      }
      const ni = lesson.interactions[nextIdx];
      setShowTranslation(ni.type === 'teach' || ni.type === 'greet');
      if (ni) {
        const pid = ni.phraseId;
        if (pid) {
          if (ni.type === 'teach' || ni.type === 'greet') {
            void MemoryService.recordEvent(pid, { type: 'heard', correct: true });
            void EventStore.record({ type: 'PHRASE_HEARD', phraseId: pid });
          } else if (ni.type === 'repeat') {
            void MemoryService.recordEvent(pid, { type: 'repeated', correct: true });
            void EventStore.record({ type: 'PHRASE_REPEATED', phraseId: pid });
          } else if (ni.type === 'listen') {
            void MemoryService.recordEvent(pid, { type: 'recognized', correct: true });
            void EventStore.record({ type: 'PHRASE_RECOGNIZED', phraseId: pid });
          }
        }
        if (ni.type !== 'done') speak(ni.german);
      }
      return nextIdx;
    });
  }, [lesson, speak]);

  const next = useCallback(() => {
    if (!interaction) return;
    if (interaction.type === 'done') {
      setFinished(true);
      void finalize();
      return;
    }
    advance();
  }, [interaction, advance]);

  const recordProduction = useCallback(async (
    _transcript: string,
    expected: string,
    responseMs: number,
    correct: boolean,
    meta?: { phraseId?: string; pedagogicalKind?: Interaction['pedagogicalKind']; helpLevel?: number },
  ) => {
    spokenRef.current += 1;
    const map = await MemoryService.loadConfidenceMap();
    const phraseId = meta?.phraseId
      || Object.entries(map).find(([, c]) => c.confidence > 0 && expected.split(/\s+/).some((w) => c.phraseId.includes(w)))?.[0]
      || expected.replace(/\s+/g, '-');
    const withHelp = helpUsedRef.current;
    const recordedHelp = withHelp ? Math.max(1, meta?.helpLevel ?? 1) : 0;
    const fast = responseMs < 5000;
    const confBefore = map[phraseId]?.confidence ?? 0;
    await MemoryService.recordEvent(phraseId, { type: 'produced', correct, responseMs, withHelp });
    if (correct && fast && !withHelp) await MemoryService.recordEvent(phraseId, { type: 'fast', correct: true, responseMs });
    if (correct && meta?.pedagogicalKind === 'transfer') {
      await MemoryService.recordEvent(phraseId, { type: 'transfer', correct: true });
      await EventStore.record({ type: 'PHRASE_TRANSFERRED', phraseId, responseTimeMs: responseMs });
    }
    if (correct && meta?.pedagogicalKind === 'recall') {
      await EventStore.record({ type: 'PHRASE_RECALLED', phraseId, responseTimeMs: responseMs });
    }
    const confAfter = (await MemoryService.getPhraseConfidence(phraseId)).confidence;
    await EventStore.record({
      type: correct
        ? (withHelp ? 'PHRASE_PRODUCED_WITH_HINT' : 'PHRASE_PRODUCED')
        : 'PHRASE_FAILED',
      phraseId,
      responseTimeMs: responseMs,
      helpLevel: recordedHelp,
      confidenceBefore: confBefore,
      confidenceAfter: confAfter,
    });
    helpUsedRef.current = false;
    if (correct && phraseId) {
      const faded = recordHelpAttempt(phraseId, recordedHelp as SupportLevel, true);
      setHelpLevel(faded.nextInSession);
    } else if (!correct && phraseId) {
      const up = recordHelpAttempt(phraseId, recordedHelp as SupportLevel, false);
      setHelpLevel(up.nextInSession);
    }
    if (correct) {
      reinforcedRef.current += 1;
      ChunkTrackerStore.recordCorrect({ phraseId });
      if (fast && !withHelp) await EventStore.record({ type: 'RAPID_RESPONSE_SUCCESS', phraseId, responseTimeMs: responseMs });
    } else {
      await EventStore.record({ type: 'RAPID_RESPONSE_FAILURE', phraseId, responseTimeMs: responseMs });
    }
  }, []);

  const listen = useCallback(async () => {
    if (!interaction) return;
    const needsSpeech = ['repeat', 'complete', 'guided', 'open', 'conversation'].includes(interaction.type);
    if (!needsSpeech) return;
    setFeedback('');
    setPhase('listening');
    listenStart.current = Date.now();
    voice.current.stopSpeaking();
    voice.current.setLanguage('de-DE');
    try {
      const transcript = await voice.current.listen();
      setPhase('grading');
      const responseMs = Date.now() - listenStart.current;
      if (!transcript.trim()) {
        setFeedback('Não ouvi. Toque o microfone e tente de novo.');
        setPhase('idle');
        return;
      }
      const expected = interaction.expected || interaction.blank?.answer || '';
      const score = expected ? similarityScore(transcript, expected) : 0.6;
      const correct = score >= 0.5;
      const allPhrases = await StorageService.getAllPhrases();
      const spontaneous = analyzeSpontaneousUse({
        teacherPrompt: [interaction.german, interaction.portuguese, interaction.hint].filter(Boolean).join(' '),
        userResponse: transcript,
        targetItems: interaction.phraseId
          ? [{ id: interaction.phraseId, german: expected || interaction.german, expected }]
          : expected
            ? [{ id: expected.replace(/\s+/g, '-'), german: expected, expected }]
            : [],
        knownPhrases: allPhrases.map((p) => ({ id: p.id, german: p.german })),
        pedagogicalKind: interaction.pedagogicalKind,
        conversationMode: interaction.type === 'conversation' ? 'FREE_CONVERSATION' : undefined,
      });
      if (spontaneous.isSpontaneous && spontaneous.phraseId) {
        spontaneousRef.current += 1;
        await MemoryService.recordEvent(spontaneous.phraseId, { type: 'spontaneous', correct: true });
        await EventStore.record({
          type: 'PHRASE_USED_SPONTANEOUSLY',
          phraseId: spontaneous.phraseId,
          context: transcript,
        });
      }
      if (correct) {
        setFeedback(interaction.praise || 'Sehr gut!');
        setPhase('feedback');
        void recordProduction(expected, expected, responseMs, true, {
          phraseId: interaction.phraseId,
          pedagogicalKind: interaction.pedagogicalKind,
          helpLevel: helpLevel,
        });
      } else {
        setFeedback(`Fast! Sag: ${expected || interaction.german}`);
        setPhase('feedback');
        void recordProduction(transcript, expected, responseMs, false, {
          phraseId: interaction.phraseId,
          pedagogicalKind: interaction.pedagogicalKind,
          helpLevel: helpLevel,
        });
      }
    } catch {
      setFeedback('Não consegui ouvir. Tente de novo.');
      setPhase('idle');
    }
  }, [interaction, recordProduction, helpLevel]);

  const requestHelp = useCallback(() => {
    if (!interaction) return;
    const expected = interaction.expected || interaction.blank?.answer || interaction.german;
    helpUsedRef.current = true;
    setHelpLevel((lvl) => {
      const nl = escalateSupport(lvl);
      const hint = buildScaffoldHint(expected, nl, { portuguese: interaction.portuguese });
      void EventStore.record({ type: 'HELP_REQUESTED', phraseId: interaction.phraseId, helpLevel: nl });
      if (interaction.phraseId) {
        void MemoryService.recordEvent(interaction.phraseId, { type: 'help', correct: false });
        recordHelpAttempt(interaction.phraseId, nl, false);
      }
      setFeedback(hint.displayText ? `💡 ${hint.displayText}` : '💡 Tente de novo.');
      return nl;
    });
  }, [interaction]);

  const dontKnow = useCallback(() => {
    if (!interaction) return;
    const expected = interaction.expected || interaction.blank?.answer || interaction.german;
    const phraseId = interaction.phraseId || expected.replace(/\s+/g, '-');
    setFeedback(`Vamos aprender. Sag: ${expected}`);
    setHelpLevel(5);
    setPhase('feedback');
    void MemoryService.recordEvent(phraseId, { type: 'help', correct: false });
    recordHelpAttempt(phraseId, 5, false);
    void EventStore.record({ type: 'PHRASE_FAILED', phraseId, helpLevel: 5 });
    void speak(expected);
  }, [interaction, speak]);

  const repeat = useCallback(async () => {
    if (!interaction) return;
    void EventStore.record({ type: 'REPEAT_REQUESTED' });
    await speak(interaction.german);
  }, [interaction, speak]);

  const slower = useCallback(async () => {
    if (!interaction) return;
    void EventStore.record({ type: 'REPEAT_REQUESTED' });
    await speak(interaction.german, true);
  }, [interaction, speak]);

  const toggleTranslation = useCallback(() => {
    void EventStore.record({ type: 'TRANSLATION_REQUESTED' });
    setShowTranslation((v) => !v);
  }, []);

  const finalize = useCallback(async () => {
    if (savedRef.current) return;
    savedRef.current = true;
    await EventStore.record({ type: 'SESSION_ENDED' as LearningEventType });
    const events = await EventStore.load();
    const snap = inferLearningState(events);
    const sessionEvents = events.filter((e) => new Date(e.timestamp).getTime() >= sessionStartRef.current);
    const successes = sessionEvents.filter((e) => e.type === 'PHRASE_PRODUCED' || e.type === 'RAPID_RESPONSE_SUCCESS').length;
    const failures = sessionEvents.filter((e) => e.type === 'PHRASE_FAILED' || e.type === 'RAPID_RESPONSE_FAILURE').length;
    const helps = sessionEvents.filter((e) => e.type === 'HELP_REQUESTED' || e.type === 'TRANSLATION_REQUESTED').length;
    const minutes = Math.max(1, Math.round((Date.now() - sessionStartRef.current) / 60000));
    try {
      const { PreferenceModel } = await import('@/services/optimizer/PreferenceModel');
      const { computeEfficiency } = await import('@/services/optimizer/LearningEfficiencyEngine');
      const gain = reinforcedRef.current + spontaneousRef.current * 2;
      const eff = computeEfficiency({
        gain,
        minutes,
        retention: successes / Math.max(1, successes + failures),
        helpUsed: helps,
        transfer: spontaneousRef.current,
        spontaneous: spontaneousRef.current,
        errors: failures,
      });
      await PreferenceModel.record({
        method: 'guided_conversation',
        contentType: 'conversation',
        gain,
        minutes,
        retention1d: eff.score,
        retention3d: null,
        retention7d: null,
        transfer: spontaneousRef.current,
        spontaneous: spontaneousRef.current,
        helpUsed: helps,
        timestamp: new Date().toISOString(),
      });
    } catch {
      /* ignore */
    }
    try {
      const { endSession } = await import('@/services/teacher/sessionContinuity');
      const currentLesson = lessonRef.current;
      const lastOpen = currentLesson.interactions.filter((i) => i.type !== 'done');
      const last = lastOpen[lastOpen.length - 1];
      const failed = sessionEvents.filter((e) => e.type === 'PHRASE_FAILED').map((e) => e.phraseId).filter(Boolean) as string[];
      endSession({
        topic: openingRef.current?.topic,
        durationMinutes: minutes,
        phrasesLearned: [...newPhraseIds.current],
        mistakes: failed.slice(0, 4),
        lastTeacherMessage: last?.german,
        lastQuestion: lastOpen.find((i) => i.type === 'open')?.german || last?.german,
        openingGerman: openingRef.current?.german,
        sessionKind: (openingRef.current?.kind as 'RETURNING_SESSION') || 'RETURNING_SESSION',
      });
    } catch {
      /* ignore */
    }
    setSummary({
      spoken: spokenRef.current,
      reinforced: reinforcedRef.current,
      newLearned: newPhraseIds.current.size,
      spontaneous: spontaneousRef.current,
      state: snap.state,
      realUse: computeSessionRealUse(sessionEvents, await MemoryService.loadConfidenceMap()),
    });
    // Camada de curso: alimenta a competência em foco com o desempenho da sessão.
    try {
      const profile = await StorageService.getProfile();
      if (profile) {
        const { applySessionToCourse } = await import('@/services/course/CourseProgressEngine');
        await applySessionToCourse(profile.level, {
          successes,
          failures,
          spontaneous: spontaneousRef.current,
        });
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (phase === 'feedback') {
      const t = setTimeout(() => {
        setPhase('idle');
        setFeedback('');
      }, 2500);
      return () => clearTimeout(t);
    }
  }, [phase]);

  const result: UseLessonResult = {
    lesson,
    index,
    interaction,
    phase,
    feedback,
    showTranslation,
    helpLevel,
    start,
    next,
    listen,
    requestHelp,
    dontKnow,
    repeat,
    slower,
    toggleTranslation,
    finished,
    persistSession: () => { void finalize(); },
    summary,
  };
  return result;
}
