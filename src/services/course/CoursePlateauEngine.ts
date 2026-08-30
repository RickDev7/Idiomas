/* Detecção de platô no curso + plano de recovery.
   Quando o mastery da competência em foco não sobe, muda a estratégia
   de treino (mais revisão/escuta/fala, menos conteúdo novo). */
import type { CourseProgress, CourseRecovery, MasterySnapshot, SkillId } from './types';
import { COMPETENCY_BY_ID } from './competencies';
import { LEVEL_ORDER } from './levels';
import type { PlannedActivity } from '@/services/learning/NextBestActivityEngine';

const HISTORY_LIMIT = 24;
const PLATEAU_WINDOW = 4;
const PLATEAU_DELTA = 6;
const RECOVERY_DAYS = 3;
const BREAKOUT_DELTA = 8;

export interface PlateauReport {
  stagnant: boolean;
  competencyId: string | null;
  sessionsStuck: number;
  delta: number;
}

export function isRecoveryActive(p: CourseProgress, now = Date.now()): boolean {
  if (!p.recovery) return false;
  return new Date(p.recovery.until).getTime() > now;
}

export function recordMasterySnapshot(
  p: CourseProgress,
  competencyId: string,
  mastery: number,
  at = new Date().toISOString(),
): CourseProgress {
  const hist: MasterySnapshot[] = [...(p.masteryHistory ?? []), { at, competencyId, mastery }];
  p.masteryHistory = hist.slice(-HISTORY_LIMIT);
  return p;
}

/** Platô: as últimas N medições da mesma competência avançaram pouco. */
export function detectCoursePlateau(p: CourseProgress): PlateauReport {
  const hist = p.masteryHistory ?? [];
  if (hist.length < PLATEAU_WINDOW) {
    return { stagnant: false, competencyId: null, sessionsStuck: 0, delta: 0 };
  }
  const last = hist[hist.length - 1];
  const same = hist.filter((h) => h.competencyId === last.competencyId).slice(-PLATEAU_WINDOW);
  if (same.length < PLATEAU_WINDOW) {
    return { stagnant: false, competencyId: last.competencyId, sessionsStuck: same.length, delta: 0 };
  }
  const delta = same[same.length - 1].mastery - same[0].mastery;
  const stagnant = delta < PLATEAU_DELTA;
  return {
    stagnant,
    competencyId: last.competencyId,
    sessionsStuck: same.length,
    delta,
  };
}

export function startRecovery(p: CourseProgress, report: PlateauReport): CourseRecovery {
  const curIdx = LEVEL_ORDER.indexOf(p.currentLevel);
  const weak = (Object.keys(p.skillLevels) as SkillId[])
    .filter((k) => LEVEL_ORDER.indexOf(p.skillLevels[k]) < curIdx);
  const skill: SkillId | null =
    weak.find((k) => k === 'speaking') ?? weak.find((k) => k === 'listening') ?? weak[0] ?? null;
  let focus: CourseRecovery['focus'] = 'review';
  let strategy = 'Revisão espaçada + menos conteúdo novo';
  if (skill === 'listening') {
    focus = 'listening';
    strategy = 'Mais escuta e shadowing';
  } else if (skill === 'speaking' || skill === 'pronunciation') {
    focus = 'speaking';
    strategy = 'Mais fala guiada e produção';
  } else if (skill === 'communication') {
    focus = 'rapid';
    strategy = 'Resposta rápida sem pistas';
  }
  const title = report.competencyId ? COMPETENCY_BY_ID[report.competencyId]?.title : null;
  const reason = title
    ? `"${title}" não está avançando. Vamos mudar a estratégia.`
    : 'O progresso desacelerou. Vamos reforçar o que já viu.';
  const until = new Date(Date.now() + RECOVERY_DAYS * 86_400_000).toISOString();
  return { until, strategy, focus, reason, competencyId: report.competencyId ?? undefined };
}

export function clearRecovery(p: CourseProgress): CourseProgress {
  p.recovery = null;
  return p;
}

/** Atualiza recovery após uma sessão: quebra o platô se o salto foi forte;
   senão, entra em recovery se detectar estagnação. */
export function updateRecoveryAfterSession(p: CourseProgress, sessionDelta: number): CourseProgress {
  if (sessionDelta >= BREAKOUT_DELTA && isRecoveryActive(p)) {
    return clearRecovery(p);
  }
  if (isRecoveryActive(p)) return p;
  const report = detectCoursePlateau(p);
  if (report.stagnant) p.recovery = startRecovery(p, report);
  return p;
}

/** Rebalanceia o plano do dia durante recovery: menos novidade, mais reforço. */
export function applyRecoveryToActivities(
  activities: PlannedActivity[],
  recovery: CourseRecovery,
  totalMinutes: number,
): PlannedActivity[] {
  const next = activities.map((a) => ({ ...a, phraseIds: [...a.phraseIds] }));
  const newContent = next.find((a) => a.kind === 'newContent');
  if (newContent) {
    newContent.phraseIds = newContent.phraseIds.slice(0, 1);
    newContent.minutes = Math.max(1, Math.round(totalMinutes * 0.08));
    newContent.reason = 'Recovery: pouco conteúdo novo.';
  }

  const bump = (kind: PlannedActivity['kind'], extra: number, reason: string) => {
    const a = next.find((x) => x.kind === kind);
    if (a) {
      a.minutes += extra;
      a.reason = reason;
    } else {
      next.push({
        kind,
        minutes: extra,
        phraseIds: next.find((x) => x.phraseIds.length)?.phraseIds.slice(0, 3) ?? [],
        reason,
      });
    }
  };

  if (recovery.focus === 'listening') bump('listening', Math.max(2, Math.round(totalMinutes * 0.12)), recovery.reason);
  if (recovery.focus === 'speaking') bump('speaking', Math.max(2, Math.round(totalMinutes * 0.12)), recovery.reason);
  if (recovery.focus === 'review') bump('review', Math.max(2, Math.round(totalMinutes * 0.12)), recovery.reason);
  if (recovery.focus === 'rapid') bump('rapidResponse', Math.max(2, Math.round(totalMinutes * 0.1)), recovery.reason);

  const used = next.reduce((s, a) => s + a.minutes, 0);
  if (next.length > 0 && used !== totalMinutes) {
    next[next.length - 1].minutes = Math.max(1, next[next.length - 1].minutes + (totalMinutes - used));
  }
  return next;
}
