import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type {
  Achievement,
  Conversation,
  DailySession,
  Mistake,
  Mission,
  PersonalPhrase,
  Phrase,
  Progress,
  Review,
  Situation,
  UserProfile,
  Word,
} from '@/types';

interface DeutschTurboDB extends DBSchema {
  profile: { key: string; value: UserProfile };
  words: { key: string; value: Word; indexes: { 'by-category': string; 'by-day': number } };
  phrases: { key: string; value: Phrase; indexes: { 'by-category': string; 'by-day': number } };
  personalPhrases: { key: string; value: PersonalPhrase };
  reviews: { key: string; value: Review; indexes: { 'by-nextReview': string } };
  mistakes: { key: string; value: Mistake };
  conversations: { key: string; value: Conversation };
  missions: { key: string; value: Mission; indexes: { 'by-day': number } };
  situations: { key: string; value: Situation };
  progress: { key: string; value: Progress };
  dailySessions: { key: string; value: DailySession };
  achievements: { key: string; value: Achievement };
}

const DB_NAME = 'deutsch-turbo';
const DB_VERSION = 1;

let dbInstance: IDBPDatabase<DeutschTurboDB> | null = null;

export async function getDB(): Promise<IDBPDatabase<DeutschTurboDB>> {
  if (dbInstance) return dbInstance;

  dbInstance = await openDB<DeutschTurboDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      db.createObjectStore('profile', { keyPath: 'id' });
      const words = db.createObjectStore('words', { keyPath: 'id' });
      words.createIndex('by-category', 'category');
      words.createIndex('by-day', 'day');
      const phrases = db.createObjectStore('phrases', { keyPath: 'id' });
      phrases.createIndex('by-category', 'category');
      phrases.createIndex('by-day', 'day');
      db.createObjectStore('personalPhrases', { keyPath: 'id' });
      const reviews = db.createObjectStore('reviews', { keyPath: 'id' });
      reviews.createIndex('by-nextReview', 'nextReview');
      db.createObjectStore('mistakes', { keyPath: 'id' });
      db.createObjectStore('conversations', { keyPath: 'id' });
      const missions = db.createObjectStore('missions', { keyPath: 'id' });
      missions.createIndex('by-day', 'day');
      db.createObjectStore('situations', { keyPath: 'id' });
      db.createObjectStore('progress', { keyPath: 'id' });
      db.createObjectStore('dailySessions', { keyPath: 'id' });
      db.createObjectStore('achievements', { keyPath: 'id' });
    },
  });

  return dbInstance;
}

export class StorageService {
  static async getProfile(): Promise<UserProfile | undefined> {
    const db = await getDB();
    return db.get('profile', 'main');
  }

  static async saveProfile(profile: UserProfile): Promise<void> {
    const db = await getDB();
    await db.put('profile', profile);
  }

  static async getProgress(): Promise<Progress | undefined> {
    const db = await getDB();
    return db.get('progress', 'main');
  }

  static async saveProgress(progress: Progress): Promise<void> {
    const db = await getDB();
    await db.put('progress', progress);
  }

  static async getAllWords(): Promise<Word[]> {
    const db = await getDB();
    return db.getAll('words');
  }

  static async saveWord(word: Word): Promise<void> {
    const db = await getDB();
    await db.put('words', word);
  }

  static async saveWords(words: Word[]): Promise<void> {
    const db = await getDB();
    const tx = db.transaction('words', 'readwrite');
    await Promise.all([...words.map((w) => tx.store.put(w)), tx.done]);
  }

  static async getAllPhrases(): Promise<Phrase[]> {
    const db = await getDB();
    return db.getAll('phrases');
  }

  static async savePhrase(phrase: Phrase): Promise<void> {
    const db = await getDB();
    await db.put('phrases', phrase);
  }

  static async savePhrases(phrases: Phrase[]): Promise<void> {
    const db = await getDB();
    const tx = db.transaction('phrases', 'readwrite');
    await Promise.all([...phrases.map((p) => tx.store.put(p)), tx.done]);
  }

  static async getDueReviews(): Promise<Review[]> {
    try {
      const { getDueReviews } = await import('@/services/learning/ReviewRepository');
      const { toLegacyReview } = await import('@/services/learning/ReviewEngine');
      const queue = await getDueReviews(12);
      return queue.map(toLegacyReview);
    } catch {
      return [];
    }
  }

  static async saveReview(review: Review): Promise<void> {
    const db = await getDB();
    await db.put('reviews', review);
  }

  static async getAllMistakes(): Promise<Mistake[]> {
    const db = await getDB();
    return db.getAll('mistakes');
  }

  static async saveMistake(mistake: Mistake): Promise<void> {
    const db = await getDB();
    await db.put('mistakes', mistake);
  }

  static async getAllMissions(): Promise<Mission[]> {
    const db = await getDB();
    return db.getAll('missions');
  }

  static async saveMission(mission: Mission): Promise<void> {
    const db = await getDB();
    await db.put('missions', mission);
  }

  static async getAllSituations(): Promise<Situation[]> {
    const db = await getDB();
    return db.getAll('situations');
  }

  static async saveSituation(situation: Situation): Promise<void> {
    const db = await getDB();
    await db.put('situations', situation);
  }

  static async saveSituations(situations: Situation[]): Promise<void> {
    const db = await getDB();
    const tx = db.transaction('situations', 'readwrite');
    await Promise.all([...situations.map((s) => tx.store.put(s)), tx.done]);
  }

  static async getConversation(id: string): Promise<Conversation | undefined> {
    const db = await getDB();
    return db.get('conversations', id);
  }

  static async saveConversation(conversation: Conversation): Promise<void> {
    const db = await getDB();
    await db.put('conversations', conversation);
  }

  static async getAllConversations(): Promise<Conversation[]> {
    const db = await getDB();
    return db.getAll('conversations');
  }

  static async getPersonalPhrases(): Promise<PersonalPhrase[]> {
    const db = await getDB();
    return db.getAll('personalPhrases');
  }

  static async savePersonalPhrase(phrase: PersonalPhrase): Promise<void> {
    const db = await getDB();
    await db.put('personalPhrases', phrase);
  }

  static async getDailySession(date: string): Promise<DailySession | undefined> {
    const db = await getDB();
    const all = await db.getAll('dailySessions');
    return all.find((s) => s.date === date);
  }

  static async saveDailySession(session: DailySession): Promise<void> {
    const db = await getDB();
    await db.put('dailySessions', session);
  }

  static async getAchievements(): Promise<Achievement[]> {
    const db = await getDB();
    return db.getAll('achievements');
  }

  static async saveAchievement(achievement: Achievement): Promise<void> {
    const db = await getDB();
    await db.put('achievements', achievement);
  }

  static async isInitialized(): Promise<boolean> {
    const profile = await this.getProfile();
    return !!profile;
  }
}
