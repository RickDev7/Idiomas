/* Invisible teaching + interrupção adaptativa (Fase 10). */

import type { TeachingStrategy } from '@/services/learning/PersonalLearningProfile';
import { scoreNaturalness, type NaturalnessInputs } from '@/services/coach/Naturalness';

export type InterruptionKind =
  | 'CONTINUE'
  | 'CORRECT_BRIEFLY'
  | 'TEACH'
  | 'MICRO_PRACTICE'
  | 'REVIEW'
  | 'TRANSFER'
  | 'SPONTANEOUS';

export function decideInterruption(opts: {
  hasGrammarError: boolean;
  recurringError: boolean;
  shouldMicro: boolean;
  pendingReview: boolean;
  pendingTransfer: boolean;
  spontaneous: boolean;
  userChangedTopic?: boolean;
  strategy?: TeachingStrategy | null;
  naturalness: NaturalnessInputs;
}): InterruptionKind {
  if (opts.pendingReview) return 'REVIEW';
  if (opts.pendingTransfer) return 'TRANSFER';
  if (opts.shouldMicro && opts.hasGrammarError) return 'MICRO_PRACTICE';
  if (opts.spontaneous) return 'SPONTANEOUS';
  if (opts.userChangedTopic && !opts.hasGrammarError) return 'CONTINUE';

  const nat = scoreNaturalness(opts.naturalness);
  const ratio = opts.strategy?.conversationRatio ?? 0.65;
  const costHigh = nat.score < 62 || opts.naturalness.turnsSinceLastIntervention < 2;

  if (opts.hasGrammarError) {
    if (opts.recurringError && !costHigh) return 'TEACH';
    if (ratio >= 0.55 || costHigh) return 'CORRECT_BRIEFLY';
    return 'TEACH';
  }

  return 'CONTINUE';
}

export function briefCorrectionNudge(userSaid: string, correction: string): string {
  return [
    '[INSTRUÇÃO INTERNA — não leia isto em voz alta]',
    'ENSINO A PARTIR DO ERRO: correção curta + nova tentativa.',
    `O aluno disse: "${userSaid}"`,
    `Forma útil: "${correction}"`,
    'Diga algo como: "Quase!" + forme correta + "Agora você."',
    'AGUARDE a nova tentativa. NÃO mude de assunto. NÃO abra aula longa.',
  ].join('\n');
}
