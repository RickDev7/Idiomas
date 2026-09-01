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
import { EventStore } from '@/services/learning/EventStore';
import { isGeminiLiveEnabled } from '@/services/voice/VoiceService';
import { GeminiConversation } from '@/pages/GeminiConversation';
import { haptic } from '@/services/ui/UiPrefsService';
import { UiPrefsService, type TranslationMode } from '@/services/ui/UiPrefsService';
import { TranslationPanel, AnswerSupportPanel, CorrectionPanel } from '@/components/voice/VoicePanels';
import {
  loadCourseProgress, advanceToNextLevel, placeAtLevel, overallLevel,
  gradeAssessment, nextAssessmentTarget, LEVEL_BY_ID, levelIndex,
} from '@/services/course';
import type { CourseLevelId } from '@/services/course';

export function ConversationPage() {
  const { profile, updateProfile, loading } = useProfile();
  const { progress, updateProgress } = useProgress();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const type = searchParams.get('type') || 'lesson';

  const useGemini = isGeminiLiveEnabled() || type === 'review';
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
    navigate('/');
  };

  if (loading || !profile) return <LoadingScreen />;

  if (useGemini) {
    return <GeminiConversation profile={profile} onFinish={finish} />;
  }

  if (!isFree && !isAssessment && lesson.finished) {
    const s = lesson.summary;
    return <SessionSummary s={s} streak={profile.streak} onFinish={finish} />;
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
        subtitle="Toque em começar para iniciar a sessão com áudio."
        onStart={() => { haptic(); void lesson.start(); }}
        onBack={() => navigate('/')}
      />
    );
  }

  const i = lesson.interaction;
  if (!i) return <LoadingScreen />;

  const status =
    lesson.phase === 'listening'
      ? 'Ouvindo…'
      : lesson.phase === 'speaking'
        ? 'Professor falando…'
        : lesson.phase === 'grading'
          ? 'Pensando…'
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
                      : 'Fale comigo';

  const needsSpeech = ['repeat', 'complete', 'guided', 'open', 'conversation'].includes(i.type);
  const canAdvance = ['greet', 'teach', 'listen'].includes(i.type) || lesson.phase === 'feedback';

  const orbState =
    lesson.phase === 'listening' ? 'listening'
      : lesson.phase === 'grading' ? 'processing'
        : lesson.phase === 'speaking' ? 'speaking'
          : 'idle';

  return (
    <div className="flex flex-col h-full bg-background max-w-md mx-auto">
      <header className="flex items-center justify-between px-4 pt-5 pb-2 safe-top">
        <IconButton label="Sair" className="min-h-11" onClick={() => navigate('/')}>
          <IconBack size={20} />
        </IconButton>
        <ProgressDots current={lesson.index} total={lesson.lesson.interactions.length} />
        <button onClick={() => { lesson.persistSession(); void finish(); }} className="text-text-faint text-sm min-h-11 px-1">Encerrar</button>
      </header>

      <div className="flex-1 flex flex-col items-center justify-center px-8 text-center min-h-0">
        <div className="mb-6">
          <VoiceOrb state={orbState} size={160} />
        </div>
        <p className="text-eyebrow text-text-faint mb-4">Deutsch Coach</p>

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
              <button onClick={lesson.next} className="mt-3 px-7 py-3 rounded-[var(--radius-lg)] bg-primary text-white font-medium active:scale-[0.98] transition-transform">
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
    <div className="flex flex-col h-full bg-background max-w-md mx-auto">
      <header className="flex items-center px-4 pt-5 pb-2 safe-top">
        <IconButton label="Voltar" className="min-h-11" onClick={onBack}>
          <IconBack size={20} />
        </IconButton>
      </header>
      <div className="flex-1 flex flex-col items-center justify-center px-8 text-center min-h-0">
        <div className="mb-8">
          <VoiceOrb state="idle" size={180} />
        </div>
        <p className="text-eyebrow text-text-faint mb-3">Deutsch Coach</p>
        <h1 className="text-display font-bold leading-tight">{title}</h1>
        <p className="text-secondary text-text-muted mt-3 max-w-[280px]">{subtitle}</p>
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
    <div className="flex flex-col h-full bg-background max-w-md mx-auto">
      <header className="flex items-center justify-between px-4 pt-5 pb-2 safe-top">
        <IconButton label="Fechar" className="min-h-11" onClick={onClose}>
          <IconBack size={20} />
        </IconButton>
        <button onClick={onEncerrar} className="text-text-faint text-sm min-h-11 px-1">Encerrar</button>
      </header>
      <div className="flex-1 flex flex-col items-center justify-center px-8 text-center min-h-0">
        <div className="mb-7">
          <VoiceOrb state={free.isSpeaking ? 'speaking' : free.isListening ? 'listening' : free.isProcessing ? 'processing' : 'idle'} size={190} />
        </div>
        <p className="text-eyebrow text-text-faint mb-4">Deutsch Coach</p>
        <p className="text-display font-bold px-1" style={{ whiteSpace: 'normal', overflowWrap: 'anywhere', wordBreak: 'break-word', lineHeight: 1.25 }}>
          {lastAssistant?.german || lastAssistant?.content || '…'}
        </p>
        {lastAssistant?.portuguese && (
          <p className="mt-3 text-h2 text-text-muted" style={{ whiteSpace: 'normal', overflowWrap: 'anywhere' }}>{lastAssistant.portuguese}</p>
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
    <div className="flex flex-col h-full bg-background px-7 py-12 max-w-md mx-auto">
      <div className="mt-4 animate-scale-in">
        <div
          className={[
            'w-16 h-16 rounded-full flex items-center justify-center mb-5 border',
            state.passed
              ? 'bg-success/15 border-success/30'
              : 'bg-accent/15 border-accent/30',
          ].join(' ')}
        >
          {state.passed ? (
            <IconCheck size={32} className="text-success" />
          ) : (
            <IconSparkle size={30} className="text-accent" />
          )}
        </div>
        <h1 className="text-display leading-tight">
          {state.passed ? 'Você conseguiu!' : 'Quase lá!'}
        </h1>
        <p className="text-secondary text-text-muted mt-2">{state.reason}</p>
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
            <div className="mb-4 p-4 rounded-[var(--radius-lg)] bg-surface border border-border/60 animate-fade-in text-center">
              <p className="text-eyebrow text-text-faint mb-1">🎉 Novo nível</p>
              <p className="text-h2">{LEVEL_BY_ID[state.advancedTo].emoji} {LEVEL_BY_ID[state.advancedTo].label}</p>
            </div>
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

function SessionSummary({ s, streak, onFinish }: { s: UseLessonResult['summary']; streak: number; onFinish: () => void }) {
  const [rated, setRated] = useState(false);
  const rate = async (level: 'easy' | 'ok' | 'hard' | 'fail') => {
    haptic();
    setRated(true);
    try {
      await EventStore.record({ type: 'SESSION_ENDED', context: `feedback:${level}` });
    } catch {
      /* ignore */
    }
  };
  const ru = s.realUse;
  const highlight = ru?.headline
    || (s.spontaneous > 0
      ? `🔥 Você usou alemão sem ajuda (${s.spontaneous}).`
      : s.spoken > 0
        ? '🗣️ Você falou alemão hoje.'
        : null);

  return (
    <div className="flex flex-col h-full bg-background px-7 py-12 max-w-md mx-auto">
      <div className="mt-4 animate-scale-in">
        <div className="w-16 h-16 rounded-full bg-success/15 border border-success/30 flex items-center justify-center mb-5">
          <IconCheck size={32} className="text-success" />
        </div>
        <h1 className="text-display leading-tight">Hoje você usou alemão</h1>
        <p className="text-secondary text-text-muted mt-2">Treino concluído.</p>
      </div>

      <div className="mt-8 grid grid-cols-2 gap-3">
        <SummaryStat icon="🗣️" value={ru?.independentResponses ?? s.spoken} label="sem ajuda" />
        <SummaryStat icon="🔄" value={ru?.transferredItems ?? 0} label="variações" />
        <SummaryStat icon="⚡" value={ru?.spontaneousUses ?? s.spontaneous} label="espontâneo" />
        <SummaryStat icon="🔥" value={streak} label={streak === 1 ? 'dia seguido' : 'dias seguidos'} />
      </div>

      {highlight && (
        <div className="mt-6 p-4 rounded-[var(--radius-lg)] bg-surface border border-border/60 animate-fade-in">
          <p className="text-eyebrow text-text-faint inline-flex items-center gap-1.5 mb-1.5">
            <IconSparkle size={14} className="text-accent" /> Seu destaque
          </p>
          <p className="text-secondary text-accent">{highlight}</p>
        </div>
      )}

      {!rated ? (
        <div className="mt-7">
          <p className="text-secondary text-text-muted mb-3">Como foi?</p>
          <div className="grid grid-cols-4 gap-2">
            <button onClick={() => rate('easy')} className="py-3 rounded-[var(--radius-md)] bg-surface-light text-secondary hover:bg-surface-elevated transition-colors min-h-11">✅ Fácil</button>
            <button onClick={() => rate('ok')} className="py-3 rounded-[var(--radius-md)] bg-surface-light text-secondary hover:bg-surface-elevated transition-colors min-h-11">🙂 Consegui</button>
            <button onClick={() => rate('hard')} className="py-3 rounded-[var(--radius-md)] bg-surface-light text-secondary hover:bg-surface-elevated transition-colors min-h-11">😐 Difícil</button>
            <button onClick={() => rate('fail')} className="py-3 rounded-[var(--radius-md)] bg-surface-light text-secondary hover:bg-surface-elevated transition-colors min-h-11">❌ Não</button>
          </div>
        </div>
      ) : (
        <p className="mt-7 text-secondary text-text-faint animate-fade-soft">Obrigado! Isso ajuda seu professor a ajustar o treino.</p>
      )}

      <div className="mt-auto pt-8">
        <PrimaryButton full size="xl" onClick={onFinish}>
          <span className="inline-flex items-center gap-2"><IconCheck size={20} /> Pronto</span>
        </PrimaryButton>
      </div>
    </div>
  );
}

function SummaryStat({ icon, value, label }: { icon: string; value: number; label: string }) {
  return (
    <div className="p-4 rounded-[var(--radius-md)] bg-surface border border-border/60">
      <p className="text-xl" aria-hidden>{icon}</p>
      <p className="text-h2 mt-1.5">{value}</p>
      <p className="text-caption text-text-faint mt-0.5">{label}</p>
    </div>
  );
}
