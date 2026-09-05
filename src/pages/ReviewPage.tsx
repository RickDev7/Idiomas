/**
 * Revisão — flashcard (referência).
 * Fila real: getDueReviews → beginReviewSessionFromQueue.
 * Botões abrem a sessão de voz (ReviewEngine intacto).
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BottomNav } from '@/components/layout/BottomNav';
import { IconBack, IconCheck, IconClose, IconSpeaker } from '@/components/ui/Icons';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { DTPage, DTNeonButton } from '@/components/dt';
import {
  beginReviewSessionFromQueue,
  getDueReviews,
} from '@/services/learning/ReviewRepository';
import { type ReviewQueueItem } from '@/services/learning/ReviewEngine';
import { APP_ROUTES, goJornada, navigateBack } from '@/services/ui/AppRoutes';
import { DT_ASSETS } from '@/assets/deutsch-turbo';
import { getVoiceService } from '@/services/voice/VoiceService';
import { haptic } from '@/services/ui/HapticService';
import { StorageService } from '@/services/storage/StorageService';
import { humanPhraseLabel } from '@/components/premium';

export function ReviewPage() {
  const navigate = useNavigate();
  const [queue, setQueue] = useState<ReviewQueueItem[] | null>(null);
  const [resolvedGerman, setResolvedGerman] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    void getDueReviews(12)
      .then(async (q) => {
        if (cancelled) return;
        setQueue(q);
        // Resolve frases humanas — nunca mostrar IDs técnicos na UI
        const phrases = await StorageService.getAllPhrases().catch(() => []);
        const byId = new Map(phrases.map((p) => [p.id, p]));
        const map: Record<string, string> = {};
        for (const item of q) {
          const fromStore = byId.get(item.phraseId)?.german;
          map[item.phraseId] = humanPhraseLabel(
            item.german || fromStore,
            item.phraseId,
            'Frase para revisar',
          );
        }
        if (!cancelled) setResolvedGerman(map);
      })
      .catch(() => {
        if (!cancelled) setQueue([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (queue === null) return <LoadingScreen />;

  const startReview = () => {
    if (queue.length > 0) {
      beginReviewSessionFromQueue(queue);
    }
    navigate('/sessao?type=review');
  };

  const total = queue.length;
  const current = queue[0] ?? null;
  const sessionPct = total > 0 ? (1 / total) * 100 : 0;
  const displayGerman = current
    ? resolvedGerman[current.phraseId] ||
      humanPhraseLabel(current.german, current.phraseId, 'Frase para revisar')
    : '';

  const speakPreview = () => {
    const text = displayGerman.trim();
    if (!text || text === 'Frase para revisar') return;
    haptic(8);
    const voice = getVoiceService();
    void voice.speak(text, 'de-DE').catch(() => undefined);
  };

  return (
    <DTPage className="review-mission">
      <header className="px-5 pt-3 safe-top shrink-0">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigateBack(navigate, APP_ROUTES.home)}
            aria-label="Voltar"
            className="w-10 h-10 rounded-full flex items-center justify-center text-[var(--text-primary)] shrink-0"
          >
            <IconBack size={18} />
          </button>
          <div className="min-w-0 flex-1 text-center">
            <h1 className="text-[17px] font-extrabold text-[var(--text-primary)] font-[family-name:var(--font-display)]">
              Revisar
            </h1>
          </div>
          {total > 0 ? (
            <span className="text-[13px] font-bold text-[var(--voice-cyan)] tabular-nums shrink-0 min-w-[3.5rem] text-right">
              1 de {total}
            </span>
          ) : (
            <span className="min-w-[2.5rem]" />
          )}
        </div>
        {total > 0 ? (
          <div
            className="mt-3 h-1.5 rounded-full overflow-hidden"
            style={{ background: 'rgba(255,255,255,0.08)' }}
            role="progressbar"
            aria-valuenow={1}
            aria-valuemin={0}
            aria-valuemax={total}
            aria-label="Progresso da missão"
          >
            <div
              className="h-full rounded-full motion-safe:transition-all duration-500"
              style={{
                width: `${Math.max(10, sessionPct)}%`,
                background: 'linear-gradient(90deg, #00F2FE, #3A7BD5)',
                boxShadow: '0 0 12px rgba(0,242,254,0.45)',
              }}
            />
          </div>
        ) : null}
      </header>

      <main className="flex-1 flex flex-col min-h-0 px-5 pb-28 pt-6 overflow-y-auto scrollbar-hide">
        {total === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-2">
            <img
              src={DT_ASSETS.learningJourney}
              alt=""
              className="w-full max-w-[200px] object-contain opacity-90 mb-4"
              draggable={false}
            />
            <p className="text-[16px] font-semibold text-[var(--text-primary)]">
              Sem revisão pendente
            </p>
            <p className="mt-2 text-[14px] text-[var(--text-secondary)] max-w-[260px] leading-snug">
              Pratique uma sessão e volte depois — sua fila aparece aqui.
            </p>
            <div className="mt-6 w-full max-w-[240px]">
              <DTNeonButton onClick={() => goJornada(navigate)}>Ir para Meu Curso</DTNeonButton>
            </div>
          </div>
        ) : (
          <>
            <div className="dt-speech-surface flex-1 flex flex-col justify-center items-center text-center px-5 py-10 min-h-[280px]">
              <button
                type="button"
                onClick={speakPreview}
                aria-label="Ouvir frase"
                className="mb-5 w-11 h-11 rounded-full flex items-center justify-center text-[var(--voice-cyan)]"
                style={{ background: 'var(--voice-cyan-glow)' }}
              >
                <IconSpeaker size={18} />
              </button>
              <p className="text-[26px] sm:text-[28px] font-extrabold leading-snug text-[var(--text-primary)] font-[family-name:var(--font-display)]">
                {displayGerman}
              </p>
              {current!.portuguese ? (
                <p className="mt-4 text-[15px] font-medium" style={{ color: 'var(--voice-cyan)' }}>
                  {current!.portuguese}
                </p>
              ) : null}
            </div>

            <p className="mt-8 text-center text-[14px] font-semibold text-[var(--text-secondary)]">
              Lembra desta frase?
            </p>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={startReview}
                className="min-h-[64px] rounded-[20px] flex flex-col items-center justify-center gap-1.5 font-bold text-[14px] text-[var(--text-primary)] active:scale-[0.98] transition-transform"
                style={{
                  background: 'color-mix(in srgb, var(--surface) 90%, transparent)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <IconClose size={20} />
                Não lembrei
              </button>
              <button
                type="button"
                onClick={startReview}
                className="min-h-[64px] rounded-[20px] flex flex-col items-center justify-center gap-1.5 font-bold text-[14px] text-[#0B0F19] active:scale-[0.98] transition-transform"
                style={{
                  background: 'linear-gradient(135deg, #00F2FE, #3A7BD5)',
                  boxShadow: '0 0 28px rgba(0,242,254,0.4)',
                }}
              >
                <IconCheck size={20} />
                Lembrei
              </button>
            </div>
          </>
        )}
      </main>

      <BottomNav />
    </DTPage>
  );
}
