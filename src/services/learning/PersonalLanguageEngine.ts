import type { UserProfile } from '@/types';

export interface PersonalContext {
  profession: string;
  frequentSituations: string[];
  interests: string[];
  personalVocabulary: string[];
  priorityTopics: string[];
}

export function buildPersonalContext(profile: UserProfile): PersonalContext {
  const priorityTopics: string[] = [];
  if (profile.profession) priorityTopics.push('work');
  if (profile.goal === 'family') priorityTopics.push('family', 'home');
  if (profile.goal === 'travel') priorityTopics.push('travel', 'transport');
  if (profile.goal === 'daily') priorityTopics.push('daily', 'shopping');
  if (profile.goal === 'conversation') priorityTopics.push('social');
  if (profile.frequentSituations.length === 0) priorityTopics.push('survival', 'greetings');

  return {
    profession: profile.profession,
    frequentSituations: profile.frequentSituations,
    interests: profile.interests,
    personalVocabulary: profile.workContext?.workPhrases ?? [],
    priorityTopics: Array.from(new Set(priorityTopics)),
  };
}

export function relevanceScore(topic: string, context: PersonalContext): number {
  if (context.priorityTopics.includes(topic)) return 1;
  if (context.frequentSituations.includes(topic)) return 0.8;
  if (context.interests.includes(topic)) return 0.6;
  return 0.3;
}
