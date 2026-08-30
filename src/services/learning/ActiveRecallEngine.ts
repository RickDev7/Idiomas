import type { Phrase } from '@/types';
import type { UserLearningProfile, PhraseConfidence } from '@/services/learning/ConfidenceService';
import { stateIndex } from '@/services/learning/ConfidenceService';

export interface ActiveRecallPrompt {
  prompt: string;
  portuguese: string;
  expected: string;
  phraseId: string;
  difficulty: 'easy' | 'medium' | 'hard';
}

export function buildActiveRecall(
  phrase: Phrase,
  confidence: PhraseConfidence | undefined,
): ActiveRecallPrompt {
  const idx = confidence ? stateIndex(confidence.state) : 0;
  let difficulty: ActiveRecallPrompt['difficulty'] = 'hard';
  if (idx >= stateIndex('answeredAlone')) difficulty = 'easy';
  else if (idx >= stateIndex('recognized')) difficulty = 'medium';

  const prompts: Record<ActiveRecallPrompt['difficulty'], string> = {
    easy: `Sag es auf Deutsch: ${phrase.portuguese}`,
    medium: `Wie sagt man "${phrase.portuguese}"?`,
    hard: `Erinnerst du dich? Sag: ${phrase.portuguese}`,
  };

  return {
    prompt: prompts[difficulty],
    portuguese: phrase.portuguese,
    expected: phrase.german.toLowerCase().split(/\s+/).slice(0, 3).join(' '),
    phraseId: phrase.id,
    difficulty,
  };
}

export function pickActiveRecallTarget(
  profile: UserLearningProfile,
  allPhrases: Phrase[],
): Phrase | null {
  const candidates = Object.values(profile.phrases)
    .filter((c) => stateIndex(c.state) >= stateIndex('repeated') && stateIndex(c.state) < stateIndex('answeredAlone'))
    .sort((a, b) => a.confidence - b.confidence)
    .slice(0, 5);
  if (candidates.length === 0) return null;
  const pick = candidates[Math.floor(Math.random() * candidates.length)];
  return allPhrases.find((p) => p.id === pick.phraseId) ?? null;
}
