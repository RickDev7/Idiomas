export type ListeningLevel = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

export interface ListeningConfig {
  level: ListeningLevel;
  speed: 'slow' | 'normal' | 'natural';
  showText: boolean;
  showTranslation: boolean;
  dialogue: boolean;
  noisy: boolean;
}

const LADDER: Record<ListeningLevel, ListeningConfig> = {
  1: { level: 1, speed: 'slow', showText: true, showTranslation: true, dialogue: false, noisy: false },
  2: { level: 2, speed: 'normal', showText: true, showTranslation: true, dialogue: false, noisy: false },
  3: { level: 3, speed: 'normal', showText: true, showTranslation: false, dialogue: false, noisy: false },
  4: { level: 4, speed: 'normal', showText: false, showTranslation: false, dialogue: false, noisy: false },
  5: { level: 5, speed: 'normal', showText: false, showTranslation: false, dialogue: true, noisy: false },
  6: { level: 6, speed: 'natural', showText: false, showTranslation: false, dialogue: true, noisy: false },
  7: { level: 7, speed: 'natural', showText: false, showTranslation: false, dialogue: true, noisy: false },
  8: { level: 8, speed: 'natural', showText: false, showTranslation: false, dialogue: true, noisy: false },
  9: { level: 9, speed: 'natural', showText: false, showTranslation: false, dialogue: true, noisy: true },
};

export function listeningConfigFor(level: ListeningLevel): ListeningConfig {
  return LADDER[level];
}

export function recommendLevel(listeningScore: number): ListeningLevel {
  if (listeningScore < 20) return 1;
  if (listeningScore < 35) return 2;
  if (listeningScore < 50) return 3;
  if (listeningScore < 62) return 4;
  if (listeningScore < 72) return 5;
  if (listeningScore < 80) return 6;
  if (listeningScore < 87) return 7;
  if (listeningScore < 93) return 8;
  return 9;
}

export function advanceLevel(current: ListeningLevel, success: boolean): ListeningLevel {
  if (success && current < 9) return (current + 1) as ListeningLevel;
  if (!success && current > 1) return (current - 1) as ListeningLevel;
  return current;
}
