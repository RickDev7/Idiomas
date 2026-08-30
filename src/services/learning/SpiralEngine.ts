import type { Phrase } from '@/types';
import type { PhraseConfidence, UserLearningProfile } from '@/services/learning/ConfidenceService';
import { stateIndex } from '@/services/learning/ConfidenceService';

export interface TransferVariant {
  german: string;
  portuguese: string;
  baseId: string;
  kind: 'time' | 'person' | 'negation' | 'question' | 'context';
}

const TIME_VARIANTS: { from: string; to: string; pt: string }[] = [
  { from: 'heute', to: 'morgen', pt: 'amanhã' },
  { from: 'heute', to: 'gestern', pt: 'ontem' },
  { from: 'morgen', to: 'heute', pt: 'hoje' },
  { from: 'ich', to: 'du', pt: 'você' },
];

export function buildTransferVariants(phrase: Phrase): TransferVariant[] {
  const variants: TransferVariant[] = [];
  const g = phrase.german;

  for (const v of TIME_VARIANTS) {
    if (g.toLowerCase().includes(v.from.toLowerCase())) {
      variants.push({
        german: g.replace(new RegExp(v.from, 'i'), v.to),
        portuguese: phrase.portuguese.replace(new RegExp(v.from, 'i'), v.pt),
        baseId: phrase.id,
        kind: v.from === 'ich' ? 'person' : 'time',
      });
    }
  }

  if (!g.includes('?') && g.split(/\s+/).length > 1) {
    const first = g.split(/\s+/)[0];
    variants.push({
      german: g.replace(first, first.endsWith('e') ? first.slice(0, -1) + 'st' : first + 'st') + '?',
      portuguese: phrase.portuguese + '?',
      baseId: phrase.id,
      kind: 'question',
    });
  }

  if (!g.toLowerCase().includes('nicht')) {
    variants.push({
      german: g.replace('.', ' nicht.'),
      portuguese: phrase.portuguese.replace('.', ' não.'),
      baseId: phrase.id,
      kind: 'negation',
    });
  }

  return variants.slice(0, 3);
}

export function pickSpiralItem(
  profile: UserLearningProfile,
  allPhrases: Phrase[],
): Phrase | null {
  const mastered = Object.values(profile.phrases).filter((c) => stateIndex(c.state) >= stateIndex('answeredAlone'));
  if (mastered.length === 0) return null;
  const pick = mastered[Math.floor(Math.random() * mastered.length)];
  return allPhrases.find((p) => p.id === pick.phraseId) ?? null;
}

export function shouldReduceSupport(confidence: PhraseConfidence): boolean {
  return stateIndex(confidence.state) >= stateIndex('answeredAlone') && confidence.confidence >= 70;
}

export function supportLevelFor(confidence: PhraseConfidence | undefined): 0 | 1 | 2 | 3 {
  if (!confidence) return 3;
  if (confidence.confidence >= 85) return 0;
  if (confidence.confidence >= 60) return 1;
  if (confidence.confidence >= 30) return 2;
  return 3;
}
