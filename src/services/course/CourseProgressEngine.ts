/* CourseProgressEngine — persistência, nível por habilidade, gates e progressão.
   Persiste em localStorage (não toca no schema do IndexedDB existente). */
import type {
  CourseLevelId, CourseProgress, SkillId, MasteryGate,
} from './types';
import { LEVEL_ORDER, levelIndex, nextLevel, LEVEL_BY_ID } from './levels';
import { COMPETENCY_BY_ID, competenciesForLevel, foldLegacyCompetencyMastery, resolveCompetencyId, COMPETENCY_ID_ALIASES } from './competencies';
import type { Progress, UserProfile } from '@/types';

const STORAGE_KEY = 'deutsch-turbo:course-progress:v1';

const SKILL_KEYS: SkillId[] = [
  'listening', 'speaking', 'reading', 'writing',
  'pronunciation', 'grammar', 'vocabulary', 'communication',
];

/** Mapeia o Level simples do app (zero|little|basic) → CourseLevelId inicial. */
export function courseLevelFromAppLevel(app: UserProfile['level']): CourseLevelId {
  if (app === 'zero') return 'L0';
  if (app === 'little') return 'A1';
  return 'A2';
}

export function defaultCourseProgress(app: UserProfile['level']): CourseProgress {
  const start = courseLevelFromAppLevel(app);
  const skillLevels = {} as Record<SkillId, CourseLevelId>;
  for (const k of SKILL_KEYS) skillLevels[k] = start;
  return {
    currentLevel: start,
    skillLevels,
    competencyMastery: {},
    competencyGates: {},
    completedLevels: [],
    updatedAt: new Date().toISOString(),
  };
}

function normalizeProgress(p: CourseProgress): CourseProgress {
  for (const k of SKILL_KEYS) if (!p.skillLevels[k]) p.skillLevels[k] = p.currentLevel;
  p.competencyMastery = foldLegacyCompetencyMastery(p.competencyMastery ?? {});
  if (p.competencyGates) {
    const gates = { ...p.competencyGates };
    for (const [legacy, canonical] of Object.entries(COMPETENCY_ID_ALIASES)) {
      if (gates[legacy] != null && gates[canonical] == null) {
        gates[canonical] = gates[legacy];
      }
      delete gates[legacy];
    }
    p.competencyGates = gates;
  }
  return p;
}

export async function loadCourseProgress(app: UserProfile['level']): Promise<CourseProgress> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultCourseProgress(app);
    const parsed = JSON.parse(raw) as CourseProgress;
    return normalizeProgress(parsed);
  } catch {
    return defaultCourseProgress(app);
  }
}

export async function saveCourseProgress(p: CourseProgress): Promise<void> {
  normalizeProgress(p);
  p.updatedAt = new Date().toISOString();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
}

/** Lê o progresso persistido. Null se ainda não houver jornada salva (não sintetiza default). */
export function getStoredCourseProgress(): CourseProgress | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CourseProgress;
    if (!parsed.currentLevel || !parsed.skillLevels) return null;
    return normalizeProgress(parsed);
  } catch {
    return null;
  }
}

/** Converte um score 0-100 do Progress existente num CourseLevelId por habilidade.
   O piso é L0: skills refletem a realidade (pode haver A2 speaking e A1 listening). */
function scoreToLevel(score: number): CourseLevelId {
  if (score >= 96) return 'C2';
  if (score >= 90) return 'C1';
  if (score >= 82) return 'B2';
  if (score >= 70) return 'B1';
  if (score >= 50) return 'A2';
  if (score >= 30) return 'A1';
  return 'L0';
}

/** Recalcula os níveis por habilidade a partir do Progress existente.
   NÃO altera currentLevel (o avanço de nível é por assessment). */
export function recomputeSkillLevels(p: CourseProgress, progress: Progress): CourseProgress {
  p.skillLevels.listening = scoreToLevel(progress.listening);
  p.skillLevels.speaking = scoreToLevel(progress.production);
  p.skillLevels.pronunciation = scoreToLevel(progress.pronunciation);
  p.skillLevels.vocabulary = scoreToLevel(progress.vocabulary);
  p.skillLevels.grammar = scoreToLevel(progress.comprehension);
  p.skillLevels.communication = scoreToLevel(progress.conversation);
  // reading/writing não têm scores diretos; estimam-se a partir de compreensão/produção
  p.skillLevels.reading = scoreToLevel(Math.round((progress.comprehension + progress.vocabulary) / 2));
  p.skillLevels.writing = scoreToLevel(Math.round((progress.production + progress.comprehension) / 2));
  return p;
}

/** Nível geral: o menor nível entre habilidades críticas, para não mascarar fraquezas. */
export function overallLevel(p: CourseProgress): CourseLevelId {
  const critical: SkillId[] = ['listening', 'speaking', 'vocabulary', 'grammar'];
  const minIdx = Math.min(...critical.map((k) => levelIndex(p.skillLevels[k])));
  return LEVEL_ORDER[Math.max(0, minIdx)];
}

/** Recalcula níveis por habilidade. Mantém currentLevel (avanço é explícito).
   Mantido por compatibilidade — equivalente a recomputeSkillLevels. */
export function recomputeOverall(p: CourseProgress): CourseProgress {
  return p;
}

/** Gate de uma competência a partir do mastery (0-100). */
export function gateForMastery(mastery: number): MasteryGate {
  if (mastery >= 90) return 'mastered';
  if (mastery >= 75) return 'strong';
  if (mastery >= 50) return 'usable';
  if (mastery > 0) return 'learning';
  return 'locked';
}

/** Verifica se o aluno está pronto para o assessment do próximo nível. */
export function readyForNextLevel(p: CourseProgress): boolean {
  const target = nextLevel(p.currentLevel);
  if (!target) return false;
  const comps = competenciesForLevel(p.currentLevel);
  if (comps.length === 0) return false;
  // todas as competências do nível atual devem estar pelo menos "strong"
  const allStrong = comps.every((c) => {
    const m = p.competencyMastery[c.id] ?? 0;
    return m >= c.masteryThreshold;
  });
  // e nenhuma habilidade crítica abaixo do nível atual
  const critical: SkillId[] = ['listening', 'speaking'];
  const noCriticalGap = critical.every((k) => levelIndex(p.skillLevels[k]) >= levelIndex(p.currentLevel));
  return allStrong && noCriticalGap;
}

/** Avança o aluno para o próximo nível (após assessment aprovado). */
export function advanceToNextLevel(p: CourseProgress): CourseProgress {
  const target = nextLevel(p.currentLevel);
  if (!target) return p;
  if (!p.completedLevels.includes(p.currentLevel)) p.completedLevels.push(p.currentLevel);
  p.currentLevel = target;
  for (const k of SKILL_KEYS) {
    if (levelIndex(p.skillLevels[k]) < levelIndex(target)) p.skillLevels[k] = target;
  }
  return p;
}

/** Placement/skip: posiciona o aluno num nível-alvo (após diagnóstico de proficiência).
   Marca os níveis anteriores como concluídos e eleva skills abaixo do alvo. */
export function placeAtLevel(p: CourseProgress, target: CourseLevelId): CourseProgress {
  const tIdx = levelIndex(target);
  for (const id of LEVEL_ORDER) {
    if (levelIndex(id) < tIdx && !p.completedLevels.includes(id)) p.completedLevels.push(id);
  }
  p.currentLevel = target;
  for (const k of SKILL_KEYS) {
    if (levelIndex(p.skillLevels[k]) < tIdx) p.skillLevels[k] = target;
  }
  return p;
}

/** Indica que o aluno está bem acima do nível atual e pode fazer um placement skip. */
export function readyForPlacementSkip(p: CourseProgress): boolean {
  return levelIndex(overallLevel(p)) > levelIndex(p.currentLevel);
}

/** Atualiza o mastery de uma competência a partir de um evento de aprendizagem. */
export function bumpCompetency(p: CourseProgress, competencyId: string, delta: number): CourseProgress {
  const id = resolveCompetencyId(competencyId);
  const comp = COMPETENCY_BY_ID[id];
  if (!comp) return p;
  p.competencyMastery = foldLegacyCompetencyMastery(p.competencyMastery ?? {});
  const cur = p.competencyMastery[id] ?? 0;
  const next = Math.max(0, Math.min(100, cur + delta));
  p.competencyMastery[id] = next;
  p.competencyGates[id] = gateForMastery(next);
  return p;
}

/** Habilidade mais fraca (foco), se houver gap. */
export function focusSkill(p: CourseProgress): SkillId | null {
  const curIdx = levelIndex(p.currentLevel);
  const weak = SKILL_KEYS.filter((k) => levelIndex(p.skillLevels[k]) < curIdx);
  if (weak.length === 0) return null;
  // prioriza speaking/listening
  return weak.find((k) => k === 'speaking') ?? weak.find((k) => k === 'listening') ?? weak[0];
}

/** Aplica o desempenho de uma sessão à competência em foco do nível atual.
   delta = (sucessos - falhas)*3 + espontaneos*4, limitado a [-10, +18].
   Recompensa a próxima competência pendente; se dominada, o CourseEngine
   automaticamente recomenda a próxima. */
export async function applySessionToCourse(
  appLevel: UserProfile['level'],
  stats: { successes: number; failures: number; spontaneous: number },
): Promise<CourseProgress | null> {
  try {
    let p = await loadCourseProgress(appLevel);
    const compId = nextCompetency(p);
    if (compId) {
      const before = p.competencyMastery[compId] ?? 0;
      const delta = Math.max(-10, Math.min(18, (stats.successes - stats.failures) * 3 + stats.spontaneous * 4));
      p = bumpCompetency(p, compId, delta);
      const after = p.competencyMastery[compId] ?? before;
      const { recordMasterySnapshot, updateRecoveryAfterSession } = await import('./CoursePlateauEngine');
      p = recordMasterySnapshot(p, compId, after);
      p = updateRecoveryAfterSession(p, after - before);
    }
    await saveCourseProgress(p);
    return p;
  } catch {
    return null;
  }
}

/** Próxima competência não-dominada do nível atual. */
export function nextCompetency(p: CourseProgress): string | null {
  const comps = competenciesForLevel(p.currentLevel);
  const pending = comps.find((c) => (p.competencyMastery[c.id] ?? 0) < c.masteryThreshold);
  return pending?.id ?? comps[0]?.id ?? null;
}

/** Label humano do próximo objetivo. */
export function nextObjectiveLabel(p: CourseProgress): string {
  const id = nextCompetency(p);
  if (!id) {
    if (readyForNextLevel(p)) {
      const nl = nextLevel(p.currentLevel);
      return nl ? `Pronto para o exame de ${LEVEL_BY_ID[nl].label} 🎉` : 'Continue praticando.';
    }
    return 'Continue praticando para consolidar.';
  }
  return COMPETENCY_BY_ID[id].title;
}
