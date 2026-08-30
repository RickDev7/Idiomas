import { useState, useEffect, useCallback } from 'react';
import type { UserProfile, Progress } from '@/types';
import { StorageService } from '@/services/storage/StorageService';
import { initializeAppData, createDefaultProfile, createDefaultProgress } from '@/services/storage/initData';

export function useProfile() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const p = await StorageService.getProfile();
        setProfile(p || null);
      } catch (error) {
        console.error('Falha ao carregar perfil', error);
        setProfile(null);
      } finally {
        setLoading(false);
      }
      initializeAppData().catch((error) => {
        console.error('Falha ao inicializar conteúdo', error);
      });
    }
    load();
  }, []);

  const updateProfile = useCallback(async (updates: Partial<UserProfile>) => {
    const current = profile || createDefaultProfile();
    const updated = { ...current, ...updates };
    await StorageService.saveProfile(updated);
    setProfile(updated);
    return updated;
  }, [profile]);

  return { profile, loading, updateProfile, setProfile };
}

export function useProgress() {
  const [progress, setProgress] = useState<Progress | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const p = await StorageService.getProgress();
        setProgress(p || createDefaultProgress());
      } catch (error) {
        console.error('Falha ao carregar progresso', error);
        setProgress(createDefaultProgress());
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const updateProgress = useCallback(async (updates: Partial<Progress>) => {
    const current = progress || createDefaultProgress();
    const updated = { ...current, ...updates };
    await StorageService.saveProgress(updated);
    setProgress(updated);
    // Sincroniza a camada de curso: recalcula níveis por habilidade a partir do Progress.
    try {
      const profile = await StorageService.getProfile();
      if (profile) {
        const { loadCourseProgress, recomputeSkillLevels, recomputeOverall, saveCourseProgress } =
          await import('@/services/course/CourseProgressEngine');
        let cp = await loadCourseProgress(profile.level);
        cp = recomputeOverall(recomputeSkillLevels(cp, updated));
        await saveCourseProgress(cp);
      }
    } catch (e) {
      console.error('Falha ao sincronizar progresso do curso', e);
    }
    return updated;
  }, [progress]);

  return { progress, loading, updateProgress };
}
