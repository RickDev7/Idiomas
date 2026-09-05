import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useStudySession } from '@/hooks/useStudySession';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { MicButton, HelpButton } from '@/components/ui/Shared';
import { VoiceOrb } from '@/components/ui/VoiceOrb';
import { IconButton } from '@/components/ui/Button';
import { IconBack, IconPlay, IconCheck, IconSparkle } from '@/components/ui/Icons';
import { ProgressDots } from '@/components/ui/TopBar';
import { PrimaryButton } from '@/components/ui/Button';
import { useProfile, useProgress } from '@/hooks/useProfile';
import { useLesson, type UseLessonResult } from '@/hooks/useLesson';
import { useConversation } from '@/hooks/useConversation';
import type { ConversationContext } from '@/types';
import { createDefaultProfile } from '@/services/storage/initData';
import { calculateCommunicationScore, updateStreak } from '@/utils/reviewUtils';
import { GeminiConversation } from '@/pages/GeminiConversation';
import { haptic } from '@/services/ui/UiPrefsService';
import { UiPrefsService, type TranslationMode, type VoiceProvider } from '@/services/ui/UiPrefsService';
import { shouldUseGeminiLiveSession } from '@/services/voice/VoiceService';
import { storeSessionComplete } from '@/services/ui/SessionCompleteStore';
import { TranslationPanel, AnswerSupportPanel, CorrectionPanel } from '@/components/voice/VoicePanels';
import {
  loadCourseProgress, advanceToNextLevel, placeAtLevel, overallLevel,
  gradeAssessment, nextAssessmentTarget, LEVEL_BY_ID, levelIndex,
} from '@/services/course';
import type { CourseLevelId } from '@/services/course';
import { GlassCard } from '@/components/ui/GlassCard';

export function ConversationPage() {
  const { profile, updateProfile, loading } = useProfile();
  const { progress, updateProgress } = useProgress();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const type = searchParams.get('type') || 'lesson';

  const [voiceProvider, setVoiceProvider] = useState<VoiceProvider>(
    () => UiPrefsService.get().voiceProvider ?? 'gemini-live',
  );
  useEffect(
    () => UiPrefsService.subscribe((p) => setVoiceProvider(p.voiceProvider ?? 'gemini-live')),
    [],
  );

  const useGemini = shouldUseGeminiLiveSession(type, voiceProvider);
  const lesson = useLesson(type, profile);

  useStudySession(
    `sessao-${type}`,
    !!profile && !loading && !useGemini && lesson.phase !== 'idle',
  );

  const isFree = type === 'free';
  const isAssessment = type === 'assessment';

  // Modo de tradução persistente
  const [translationMode] = useState<TranslationMode>(() => UiPrefsService.get().translationMode);
  const [translationVisible, setTranslationVisible] = useState(translationMode === 'always');

  // Reset de visibilidade ao trocar de interação, conforme o modo (sem timeout, sem auto-hide)
  useEffect(() => {
    setTranslationVisible(translationMode === 'always');
  }, [lesson.index, translationMode]);

  const toggleTranslation = () => {
    haptic(8);
    lesson.toggleTranslation(); // mantém o registro analítico (TRANSLATION_REQUESTED)
    setTranslationVisible((v) => !v);
  };

  const context: ConversationContext = useMemo(
    () => ({
      type: 'free',
      userLevel: profile?.level || 'zero',
      immersionPhase: profile?.immersionPhase || 1,
      topic: searchParams.get('topic') || undefined,
      previousMessages: [],
      userProfile: profile || createDefaultProfile(),
      dueReviews: [],
      recentMistakes: [],
    }),
    [profile, searchParams],
  );

  const free = useConversation({ context, autoSpeak: true });

  useEffect(() => {
    if (loading || !profile) return;
    if (!profile.onboardingComplete) {
      navigate('/onboarding');
    }
  }, [loading, profile, navigate]);

  const finish = async () => {
    if (type === 'simulator') {
      const { finalizeSimulatorSession } = await import('@/services/teacher/SimulatorSession');
      const { storeSimulatorResult, clearSimulatorContext } = await import('@/services/teacher/SimulatorIntent');
      const result = finalizeSimulatorSession();
      if (result) storeSimulatorResult(result);
      clearSimulatorContext();
      navigate('/simulador/resultado');
      return;
    }
    if (type === 'miniprova') {
      const { readMiniProvaSnapshot, finalizeMiniProvaResult, clearMiniProvaSnapshot } = await import('@/services/teacher/MiniProvaSession');
      const { storeMiniProvaResult, clearMiniProvaContext } = await import('@/services/teacher/MiniProvaIntent');
      const snap = readMiniProvaSnapshot();
      if (snap) {
        const result = finalizeMiniProvaResult(snap);
        storeMiniProvaResult(result);
      }
      clearMiniProvaSnapshot();
      clearMiniProvaContext();
      navigate('/mini-prova/resultado');
      return;
    }
    if (profile) {
      const streak = updateStreak(profile.lastStudyDate, profile.streak);
      await updateProfile({ ...streak });
    }
    if (progress) {
      const communicationScore = calculateCommunicationScore({
        ...progress,
        conversation: Math.min(100, progress.conversation + 3),
        production: Math.min(100, progress.production + 2),
      });
      await updateProgress({
        totalStudyMinutes: progress.totalStudyMinutes + Math.max(1, Math.round((profile?.dailyMinutes || 20) / 2)),
        conversationsCompleted: progress.conversationsCompleted + 1,
        communicationScore,
      });
    }

    // Tela premium de conclusão (dados reais quando disponíveis)
    try {
      const { getLastSession } = await import('@/services/teacher/sessionContinuity');
      const last = getLastSession();
      const lessonSummary = !useGemini && !isFree && !isAssessment ? lesson.summary : null;
      let reviewTotal: number | null = null;
      let reviewMastered: number | null = null;
      let reviewImproved: string[] = [];
      let reviewNext: string | null = null;
      if (type === 'review') {
        const { readReviewSessionSnapshot, summarizeReviewSession } = await import(
          '@/services/learning/ReviewSession'
        );
        const snap = readReviewSessionSnapshot();
        if (snap) {
          const sum = summarizeReviewSession(snap);
          reviewTotal = sum.total;
          reviewMastered = sum.mastered;
          reviewImproved = snap.results
            .filter((r) => r.result === 'SUCCESS' && r.german)
            .map((r) => r.german as string)
            .slice(0, 8);
          if (sum.needsLater > 0) {
            reviewNext = `${sum.needsLater} itens adiados para revisão posterior`;
          }
        }
      }
      storeSessionComplete({
        name: profile?.name,
        headline: type === 'review' ? 'REVISION BEENDET' : 'TRAINING ABGESCHLOSSEN',
        minutes: last?.durationMinutes ?? null,
        structures: reviewTotal ?? lessonSummary?.newLearned ?? (last?.phrasesLearned?.length || null),
        variations: lessonSummary?.realUse?.transferredItems ?? null,
        autonomyPct:
          reviewTotal != null && reviewMastered != null && reviewTotal > 0
            ? Math.round((reviewMastered / reviewTotal) * 100)
            : lessonSummary?.realUse
              ? Math.round(
                  (lessonSummary.realUse.independentResponses /
                    Math.max(1, lessonSummary.spoken || lessonSummary.realUse.independentResponses || 1)) *
                    100,
                )
              : null,
        improved: reviewImproved.length > 0 ? reviewImproved : last?.phrasesLearned?.filter(Boolean).slice(0, 8) ?? [],
        nextStep: reviewNext ?? last?.nextSuggestedStep ?? null,
        streak: profile ? updateStreak(profile.lastStudyDate, profile.streak).streak : null,
        spoken: lessonSummary?.spoken ?? null,
      });
      navigate('/sessao/concluida');
      return;
    } catch {
      navigate('/');
    }
  };

  if (loading || !profile) return <LoadingScreen />;

  if (useGemini) {
    return <GeminiConversation profile={profile} onFinish={finish} sessionType={type} />;
  }

  if (!isFree && !isAssessment && lesson.finished) {
    return (
      <LessonCompleteBridge
        summary={lesson.summary}
        name={profile.name}
        streak={profile.streak}
        onReady={finish}
      />
    );
  }

  if (isAssessment && lesson.finished) {
    return (
      <AssessmentResult
        summary={lesson.summary}
        appLevel={profile.level}
        onFinish={finish}
      />
    );
  }

  if (isFree) {
    if (!free.sessionStarted) {
      return (
        <SessionStartGate
          title="Conversa livre"
          subtitle="Toque em começar quando estiver pronto para ouvir o professor."
          onStart={() => { haptic(); void free.start(); }}
          onBack={() => navigate('/')}
        />
      );
    }
    return <FreeConversation free={free} onClose={() => navigate('/')} onEncerrar={finish} />;
  }

  if (!lesson.sessionStarted) {
    return (
      <SessionStartGate
        title="Treino de hoje"
        subtitle={
          voiceProvider === 'free-browser'
            ? 'Permita o acesso ao microfone para praticar alemão falando. Toque em começar.'
            : voiceProvider === 'text'
              ? 'Modo texto: você digitará as respostas. Toque em começar.'
              : 'Toque em começar para iniciar a sessão com áudio.'
        }
        onStart={() => { haptic(); void lesson.start(); }}
        onBack={() => navigate('/')}
      />
    );
  }

  const i = lesson.interaction;
  if (!i) return <LoadingScreen />;

  const status =
    lesson.phase === 'listening'
      ? '🔴 Ouvindo...'
      : lesson.phase === 'speaking'
        ? '🔊 Professor...'
        : lesson.phase === 'grading'
          ? '⏳ Entendendo...'
          : i.type === 'teach'
            ? 'Ouça e repita'
            : i.type === 'repeat'
              ? 'Repita em voz alta'
              : i.type === 'complete'
                ? 'Complete a frase'
                : i.type === 'open' || i.type === 'guided'
                  ? 'Responda em alemão'
                  : i.type === 'conversation'
                    ? 'Junte tudo e fale'
                    : i.type === 'done'
                      ? 'Concluído'
                      : voiceProvider === 'free-browser'
                        ? '🎤 Sua vez'
                        : 'Fale comigo';

  const needsSpeech = ['repeat', 'complete', 'guided', 'open', 'conversation'].includes(i.type);
  const canAdvance = ['greet', 'teach', 'listen'].includes(i.type) || lesson.phase === 'feedback';

  const orbState =
    lesson.phase === 'listening' ? 'listening'
      : lesson.phase === 'grading' ? 'processing'
        : lesson.phase === 'speaking' ? 'speaking'
          : 'idle';

  return (
    <div className="flex flex-col h-full max-w-md mx-auto dt-page">
      <header className="flex items-center justify-between px-4 pt-5 pb-2 safe-top">
        <IconButton label="Sair" className="min-h-11" onClick={() => navigate('/')}>
          <IconBack size={20} />
        </IconButton>
        <ProgressDots current={lesson.index} total={lesson.lesson.interactions.length} />
        <button type="button" onClick={() => { lesson.persistSession(); void finish(); }} className="text-[#64748B] text-sm min-h-11 px-1 hover:text-white transition-colors">Encerrar</button>
      </header>

      <div className="flex-1 flex flex-col items-center justify-center px-8 text-center min-h-0">
        <div className="mb-6">
          <VoiceOrb state={orbState} size={160} />
        </div>
        <p className="dt-label mb-4">Deutsch Coach</p>

        <TranslationPanel
          german={i.german}
          portuguese={i.portuguese}
          visible={translationVisible}
          mode={translationMode}
          onToggle={toggleTranslation}
        />

        {i.blank && (
          <p className="mt-4 text-secondary text-text-muted">Complete com: <span className="text-accent font-medium">{i.blank.answer}</span></p>
        )}

        {/* Resposta guiada — visível enquanto o aluno precisa */}
        <AnswerSupportPanel
          hint={i.hint}
          expected={i.expected || i.blank?.answer}
          helpLevel={lesson.helpLevel}
          onHear={() => lesson.repeat()}
        />

        {/* Correção — persistente até o usuário fechar/avançar */}
        {lesson.feedback && (lesson.feedback.startsWith('Fast') || lesson.feedback.startsWith('Vamos') || lesson.feedback.startsWith('💡')) && (
          <CorrectionPanel
            correct={lesson.feedback.startsWith('Fast') ? (i.expected || i.german) : undefined}
            onRetry={lesson.listen}
            onDismiss={lesson.next}
          />
        )}
        {lesson.feedback && !lesson.feedback.startsWith('Fast') && !lesson.feedback.startsWith('Vamos') && !lesson.feedback.startsWith('💡') && (
          <p className="mt-4 text-secondary text-success animate-scale-in">{lesson.feedback}</p>
        )}
      </div>

      <div className="flex flex-wrap justify-center gap-1.5 px-4 py-1">
        <HelpButton icon="🔁" label="Repetir" onClick={lesson.repeat} />
        <HelpButton icon="🐢" label="Devagar" onClick={lesson.slower} />
        {needsSpeech && <HelpButton icon="💡" label="Ajuda" onClick={lesson.requestHelp} />}
        {needsSpeech && <HelpButton icon="❓" label="Não sei" onClick={lesson.dontKnow} />}
        <HelpButton icon="🇧🇷" label="Explicar" onClick={toggleTranslation} />
      </div>

      <div className="flex flex-col items-center pt-3 pb-10 safe-bottom">
        {needsSpeech ? (
          <>
            <MicButton
              isListening={lesson.phase === 'listening'}
              isSpeaking={lesson.phase === 'speaking'}
              isProcessing={lesson.phase === 'grading'}
              onPress={lesson.listen}
            />
            <p className="text-secondary text-text-muted mt-4 h-5">{status}</p>
            {lesson.phase === 'feedback' && (
              <button
                type="button"
                onClick={lesson.next}
                className="mt-3 px-7 py-3 rounded-[20px] dt-cta-primary text-[#050816] font-bold active:scale-[0.98] transition-transform"
              >
                Continuar
              </button>
            )}
          </>
        ) : (
          <PrimaryButton full size="xl" onClick={lesson.next} className="!w-[78%]">
            <span className="inline-flex items-center gap-2">
              {i.type === 'done' ? <IconCheck size={20} /> : <IconPlay size={18} />}
              {i.type === 'done' ? 'Concluir' : canAdvance ? 'Entendi' : 'Continuar'}
            </span>
          </PrimaryButton>
        )}
      </div>
    </div>
  );
}

function SessionStartGate({
  title,
  subtitle,
  onStart,
  onBack,
}: {
  title: string;
  subtitle: string;
  onStart: () => void;
  onBack: () => void;
}) {
  return (
    <div className="flex flex-col h-full max-w-md mx-auto dt-page">
      <header className="flex items-center px-4 pt-5 pb-2 safe-top">
        <IconButton label="Voltar" className="min-h-11" onClick={onBack}>
          <IconBack size={20} />
        </IconButton>
      </header>
      <div className="flex-1 flex flex-col items-center justify-center px-8 text-center min-h-0">
        <div className="mb-8">
          <VoiceOrb state="idle" size={180} />
        </div>
        <p className="dt-label mb-3">Deutsch Coach</p>
        <h1 className="text-[28px] font-bold leading-tight text-white font-[family-name:var(--font-display)]">{title}</h1>
        <p className="dt-body mt-3 max-w-[280px]">{subtitle}</p>
      </div>
      <div className="px-8 pb-10 safe-bottom">
        <PrimaryButton full size="xl" onClick={onStart}>
          <span className="inline-flex items-center gap-2">
            <IconPlay size={18} /> Começar
          </span>
        </PrimaryButton>
      </div>
    </div>
  );
}

function FreeConversation({
  free,
  onClose,
  onEncerrar,
}: {
  free: ReturnType<typeof useConversation>;
  onClose: () => void;
  onEncerrar: () => void;
}) {
  const lastAssistant = [...free.messages].reverse().find((m) => m.role === 'assistant');
  return (
    <div className="flex flex-col h-full max-w-md mx-auto dt-page">
      <header className="flex items-center justify-between px-4 pt-5 pb-2 safe-top">
        <IconButton label="Fechar" className="min-h-11" onClick={onClose}>
          <IconBack size={20} />
        </IconButton>
        <button type="button" onClick={onEncerrar} className="text-[#64748B] text-sm min-h-11 px-1 hover:text-white transition-colors">Encerrar</button>
      </header>
      <div className="flex-1 flex flex-col items-center justify-center px-8 text-center min-h-0">
        <div className="mb-7">
          <VoiceOrb state={free.isSpeaking ? 'speaking' : free.isListening ? 'listening' : free.isProcessing ? 'processing' : 'idle'} size={190} />
        </div>
        <p className="dt-label mb-4">Deutsch Coach</p>
        <p className="text-[24px] font-bold px-1 text-white font-[family-name:var(--font-display)]" style={{ whiteSpace: 'normal', overflowWrap: 'anywhere', wordBreak: 'break-word', lineHeight: 1.25 }}>
          {lastAssistant?.german || lastAssistant?.content || '…'}
        </p>
        {lastAssistant?.portuguese && (
          <p className="mt-3 text-[16px] text-[#CBD5E1]" style={{ whiteSpace: 'normal', overflowWrap: 'anywhere' }}>{lastAssistant.portuguese}</p>
        )}
      </div>
      <div className="flex flex-wrap justify-center gap-1.5 px-4 py-2">
        <HelpButton icon="🔁" label="Repetir" onClick={() => free.sendMessage('', { repeat: true })} />
        <HelpButton icon="🐢" label="Devagar" onClick={() => free.sendMessage('', { slower: true })} />
        <HelpButton icon="💡" label="Me ajude" onClick={() => free.sendMessage('', { help: true })} />
        <HelpButton icon="🇧🇷" label="Explicar" onClick={() => free.sendMessage('', { explain: true })} />
      </div>
      <div className="flex flex-col items-center pt-2 pb-10 safe-bottom">
        <MicButton
          isListening={free.isListening}
          isSpeaking={free.isSpeaking}
          isProcessing={free.isProcessing}
          onPress={async () => {
            haptic();
            if (free.isSpeaking) { free.stopSpeaking(); return; }
            const text = await free.startListening();
            if (text.trim()) free.sendMessage(text);
          }}
        />
        <p className="text-secondary text-text-muted mt-4 h-5">
          {free.isListening ? 'Estou ouvindo…' : free.isSpeaking ? 'Professor falando…' : 'Toque para falar'}
        </p>
      </div>
    </div>
  );
}

function AssessmentResult({
  summary,
  appLevel,
  onFinish,
}: {
  summary: UseLessonResult['summary'];
  appLevel: import('@/types').UserProfile['level'];
  onFinish: () => void;
}) {
  const [state, setState] = useState<{
    target: CourseLevelId;
    passed: boolean;
    score: number;
    reason: string;
    advancedTo?: CourseLevelId;
  } | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const cp = await loadCourseProgress(appLevel);
      const target = nextAssessmentTarget(cp) ?? cp.currentLevel;
      const g = gradeAssessment(target, summary.spoken, summary.spontaneous, summary.reinforced);
      if (!active) return;
      setState({ target, passed: g.passed, score: g.score, reason: g.reason });
    })();
    return () => {
      active = false;
    };
  }, [appLevel, summary]);

  const advance = async () => {
    if (!state) return;
    haptic();
    const { saveCourseProgress } = await import('@/services/course/CourseProgressEngine');
    const cp = await loadCourseProgress(appLevel);
    // Se o nível geral (skill) já está acima do alvo do assessment, faz placement skip.
    const overall = overallLevel(cp);
    let next: CourseLevelId;
    if (levelIndex(overall) > levelIndex(state.target)) {
      const placed = placeAtLevel(cp, overall);
      await saveCourseProgress(placed);
      next = overall;
    } else {
      const advanced = advanceToNextLevel(cp);
      await saveCourseProgress(advanced);
      next = advanced.currentLevel;
    }
    setState((s) => (s ? { ...s, advancedTo: next } : s));
  };

  if (!state) return <LoadingScreen />;

  return (
    <div className="flex flex-col h-full max-w-md mx-auto dt-page px-7 py-12">
      <div className="mt-4 animate-scale-in">
        <div
          className={[
            'w-16 h-16 rounded-full flex items-center justify-center mb-5 border',
            state.passed
              ? 'bg-[rgba(34,197,94,0.15)] border-[rgba(34,197,94,0.35)]'
              : 'bg-[rgba(249,115,22,0.15)] border-[rgba(249,115,22,0.35)]',
          ].join(' ')}
        >
          {state.passed ? (
            <IconCheck size={32} className="text-[#22C55E]" />
          ) : (
            <IconSparkle size={30} className="text-[#F97316]" />
          )}
        </div>
        <h1 className="text-[28px] font-bold leading-tight text-white font-[family-name:var(--font-display)]">
          {state.passed ? 'Você conseguiu!' : 'Quase lá!'}
        </h1>
        <p className="dt-body mt-2">{state.reason}</p>
      </div>

      <div className="mt-8 grid grid-cols-2 gap-3">
        <SummaryStat icon="🎯" value={state.score} label="pontuação" />
        <SummaryStat icon="🗣️" value={summary.spoken} label="vezes falou" />
        <SummaryStat icon="⭐" value={summary.spontaneous} label="espontâneo" />
        <SummaryStat icon="🧠" value={summary.reinforced} label="reforçadas" />
      </div>

      <div className="mt-auto pt-8">
        {state.passed && !state.advancedTo && (
          <PrimaryButton full size="xl" onClick={advance}>
            <span className="inline-flex items-center gap-2">
              <IconCheck size={20} /> Avançar para {LEVEL_BY_ID[state.target].label}
            </span>
          </PrimaryButton>
        )}
        {state.advancedTo && (
          <>
            <GlassCard className="mb-4 p-4 animate-fade-in text-center">
              <p className="dt-label mb-1">Novo nível</p>
              <p className="text-[18px] font-bold text-white">
                {LEVEL_BY_ID[state.advancedTo].emoji} {LEVEL_BY_ID[state.advancedTo].label}
              </p>
            </GlassCard>
            <PrimaryButton full size="xl" onClick={onFinish}>
              <span className="inline-flex items-center gap-2"><IconCheck size={20} /> Continuar</span>
            </PrimaryButton>
          </>
        )}
        {!state.passed && (
          <PrimaryButton full size="xl" onClick={onFinish}>
            <span className="inline-flex items-center gap-2">Reforçar e tentar de novo</span>
          </PrimaryButton>
        )}
      </div>
    </div>
  );
}

function LessonCompleteBridge({
  onReady,
}: {
  summary: UseLessonResult['summary'];
  name?: string;
  streak: number;
  onReady: () => void;
}) {
  const once = useMemo(() => ({ done: false }), []);
  useEffect(() => {
    if (once.done) return;
    once.done = true;
    onReady();
  }, [once, onReady]);

  return <LoadingScreen />;
}

function SummaryStat({ icon, value, label }: { icon: string; value: number; label: string }) {
  return (
    <GlassCard className="p-4">
      <p className="text-xl" aria-hidden>{icon}</p>
      <p className="text-[18px] font-bold text-white mt-1.5 tabular-nums">{value}</p>
      <p className="dt-muted mt-0.5">{label}</p>
    </GlassCard>
  );
}
