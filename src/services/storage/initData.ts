import { StorageService } from '@/services/storage/StorageService';
import {
  WORDS,
  PHRASES,
  MISSIONS,
  SITUATIONS,
  ACHIEVEMENTS_DATA,
} from '@/data/content';
import type { Progress, UserProfile } from '@/types';
import { formatDate } from '@/utils/reviewUtils';

export async function initializeAppData(): Promise<void> {
  const words = await StorageService.getAllWords();
  if (words.length === 0) await StorageService.saveWords(WORDS);

  const phrases = await StorageService.getAllPhrases();
  if (phrases.length === 0) await StorageService.savePhrases(PHRASES);

  const missions = await StorageService.getAllMissions();
  if (missions.length === 0) {
    for (const m of MISSIONS) await StorageService.saveMission(m);
  }

  const situations = await StorageService.getAllSituations();
  if (situations.length === 0) await StorageService.saveSituations(SITUATIONS);

  const achievements = await StorageService.getAchievements();
  if (achievements.length === 0) {
    for (const a of ACHIEVEMENTS_DATA) await StorageService.saveAchievement(a);
  }
}

export function createDefaultProfile(partial?: Partial<UserProfile>): UserProfile {
  return {
    id: 'main',
    name: '',
    level: 'zero',
    dailyMinutes: 20,
    goal: 'daily',
    profession: '',
    frequentSituations: [],
    interests: [],
    onboardingComplete: false,
    firstLessonComplete: false,
    currentDay: 1,
    streak: 0,
    lastStudyDate: null,
    immersionPhase: 1,
    turboMode: false,
    speechSpeed: 'normal',
    germanPercentage: 80,
    createdAt: new Date().toISOString(),
    ...partial,
  };
}

export function createDefaultProgress(): Progress {
  return {
    id: 'main',
    communicationScore: 0,
    comprehension: 10,
    production: 5,
    retention: 10,
    vocabulary: 0,
    listening: 5,
    pronunciation: 5,
    conversation: 0,
    spontaneity: 5,
    totalStudyMinutes: 0,
    wordsLearned: 0,
    phrasesLearned: 0,
    phrasesAutomatic: 0,
    conversationsCompleted: 0,
    missionsCompleted: 0,
    weeklyScores: [],
    bottlenecks: [],
  };
}

export async function completeOnboarding(profile: UserProfile): Promise<void> {
  profile.onboardingComplete = true;
  await StorageService.saveProfile(profile);

  const progress = createDefaultProgress();
  await StorageService.saveProgress(progress);
}

export async function getTodayMission() {
  const profile = await StorageService.getProfile();
  const day = profile?.currentDay || 1;
  const missions = await StorageService.getAllMissions();
  return missions.find((m) => m.day === day);
}

export async function getTodaySession(profile: UserProfile) {
  const today = formatDate();
  let session = await StorageService.getDailySession(today);

  if (!session) {
    const minutes = profile.dailyMinutes;
    session = {
      id: today,
      date: today,
      dayNumber: profile.currentDay,
      plannedMinutes: minutes,
      actualMinutes: 0,
      activities: [
        { type: 'review', plannedMinutes: Math.round(minutes * 0.2), actualMinutes: 0, completed: false },
        { type: 'listening', plannedMinutes: Math.round(minutes * 0.15), actualMinutes: 0, completed: false },
        { type: 'speaking', plannedMinutes: Math.round(minutes * 0.35), actualMinutes: 0, completed: false },
        { type: 'conversation', plannedMinutes: Math.round(minutes * 0.2), actualMinutes: 0, completed: false },
        { type: 'mission', plannedMinutes: Math.round(minutes * 0.1), actualMinutes: 0, completed: false },
      ],
      missionCompleted: false,
      completed: false,
    };
    await StorageService.saveDailySession(session);
  }

  return session;
}
