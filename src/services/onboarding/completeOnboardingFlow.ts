/* Fecha o onboarding: perfil, memória, placement do curso. Não altera TeacherEngine. */
import type { UserProfile } from '@/types';
import type { DiagnosticResult } from '@/services/course/AdaptiveLevelAssessment';
import { completeOnboarding, createDefaultProfile } from '@/services/storage/initData';
import { MemoryService } from '@/services/learning/MemoryService';
import {
  defaultCourseProgress,
  placeAtLevel,
  saveCourseProgress,
} from '@/services/course/CourseProgressEngine';
import type { CourseLevelId, SkillId } from '@/services/course/types';
import {
  coarseLevelFromSelfReported,
  startingCourseLevel,
  isCourseLevelId,
} from '@/services/onboarding/GermanLevelOptions';
import type { OnboardingDraft } from '@/services/onboarding/OnboardingDraft';

function asCourse(v: string | undefined): CourseLevelId | undefined {
  return v && isCourseLevelId(v) ? v : undefined;
}

export function profileFromDraft(draft: OnboardingDraft, diagnostic?: DiagnosticResult | null): UserProfile {
  const self = draft.selfReportedLevel;
  const diag = diagnostic ?? draft.diagnosticResult;
  return createDefaultProfile({
    name: '',
    level: coarseLevelFromSelfReported(self),
    dailyMinutes: draft.dailyMinutes ?? 20,
    goal: draft.goal ?? 'daily',
    profession: draft.profession.trim(),
    onboardingComplete: true,
    selfReportedLevel: self ?? 'zero',
    diagnosticLevel: diag?.overall,
    speakingLevel: diag?.skills.speaking,
    listeningLevel: diag?.skills.listening,
    readingLevel: diag?.skills.reading,
    writingLevel: diag?.skills.writing,
    vocabularyLevel: diag?.skills.vocabulary,
    communicationLevel: diag?.skills.communication,
  });
}

export async function applyOnboardingPlacement(
  profile: UserProfile,
  diagnostic?: DiagnosticResult | null,
): Promise<void> {
  const start = startingCourseLevel(profile);
  let cp = defaultCourseProgress(profile.level);
  cp = placeAtLevel(cp, start);
  if (diagnostic) {
    cp.currentLevel = diagnostic.overall;
    (Object.keys(diagnostic.skills) as SkillId[]).forEach((k) => {
      cp.skillLevels[k] = diagnostic.skills[k];
    });
    cp.lastAssessment = { level: diagnostic.overall, at: diagnostic.date, passed: true };
  } else {
    const speak = asCourse(profile.speakingLevel);
    const listen = asCourse(profile.listeningLevel);
    if (speak) cp.skillLevels.speaking = speak;
    if (listen) cp.skillLevels.listening = listen;
  }
  await saveCourseProgress(cp);
}

export async function finishOnboarding(
  draft: OnboardingDraft,
  saveProfile: (p: UserProfile) => Promise<UserProfile | void>,
): Promise<UserProfile> {
  const profile = profileFromDraft(draft);
  await saveProfile(profile);
  await completeOnboarding(profile);
  await applyOnboardingPlacement(profile, draft.diagnosticResult);
  await MemoryService.loadProfile(profile);
  return profile;
}
