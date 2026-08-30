/**
 * Fase 11 — ZERO LANGUAGE / BEGINNER ACQUISITION MODE
 * Camada de comportamento para nível 0. Reutiliza memória, scaffold, NBA e orquestrador.
 * NÃO cria segundo TeacherEngine / memória / pontuação.
 */
import type { Phrase, UserProfile } from '@/types';
import { startingCourseLevel } from '@/services/onboarding/GermanLevelOptions';
import { getCurrentLevel } from '@/services/course/LevelPresentation';
import { getStoredCourseProgress } from '@/services/course/CourseProgressEngine';
import type { SupportLevel } from '@/services/learning/ScaffoldingEngine';
import { isAutomated, readAutomationScore } from '@/services/learning/AutomationScoreEngine';
import type { PhraseConfidence, UserLearningProfile } from '@/services/learning/ConfidenceService';

/**
 * Gate único — A1+ permanece intacto.
 * Usa o nível efetivo do curso (getCurrentLevel) + coarse profile.level.
 * Não cria segunda fonte de verdade.
 */
export function isZeroLanguageMode(
  profile: Pick<UserProfile, 'level' | 'selfReportedLevel' | 'diagnosticLevel'>,
): boolean {
  try {
    const course = getStoredCourseProgress();
    const effective = getCurrentLevel(profile, course);
    if (effective !== 'L0') return false;
  } catch {
    if (startingCourseLevel(profile) !== 'L0') return false;
  }
  if (profile.level && profile.level !== 'zero') return false;
  return true;
}

export type ProductionErrorType =
  | 'pronunciation_approx'
  | 'wrong_word'
  | 'omission'
  | 'addition'
  | 'conjugation'
  | 'structure'
  | 'mismatch'
  | 'other';

export interface ProductionDiagnosis {
  verdict: 'CORRECT' | 'INCORRECT' | 'NEEDS_REPAIR' | 'UNKNOWN';
  errorType?: ProductionErrorType;
  expected: string;
  userSaid: string;
  hardPart?: string;
  correction: string;
}

function normalizeDe(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = i - 1;
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = row[j];
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + cost);
      prev = tmp;
    }
  }
  return row[b.length];
}

/** Progressão L0: frases curtas em ordem (uma por vez). */
export const ZERO_LANGUAGE_SEED_SPECS: Array<{ id: string; german: string; portuguese: string }> = [
  { id: 'l0-guten-morgen', german: 'Guten Morgen.', portuguese: 'Bom dia.' },
  { id: 'l0-wie-gehts', german: "Wie geht's?", portuguese: 'Como você está?' },
  { id: 'l0-mir-gehts-gut', german: "Mir geht's gut.", portuguese: 'Estou bem.' },
  { id: 'l0-hallo', german: 'Hallo.', portuguese: 'Oi.' },
  { id: 'l0-ich-heisse', german: 'Ich heiße...', portuguese: 'Eu me chamo...' },
  { id: 'survival-heisse', german: 'Ich heiße...', portuguese: 'Me chamo...' },
  { id: 'survival-gut', german: 'Mir geht es gut.', portuguese: 'Estou bem.' },
  { id: 'survival-arbeite', german: 'Ich arbeite.', portuguese: 'Eu trabalho.' },
];

export function zeroLanguageSeedPhrases(): Phrase[] {
  return ZERO_LANGUAGE_SEED_SPECS.map((s) => ({
    id: s.id,
    german: s.german,
    portuguese: s.portuguese,
    category: 'greetings',
    mastery: 'recognize' as const,
    reviewStage: 'learning' as const,
    nextReview: null,
    timesReviewed: 0,
    timesCorrect: 0,
    timesIncorrect: 0,
    isAutomatic: false,
    contexts: [],
  }));
}

export function mergeZeroLanguagePhrases(phrases: Phrase[]): Phrase[] {
  const seeds = zeroLanguageSeedPhrases();
  const byId = new Map(phrases.map((p) => [p.id, p]));
  for (const s of seeds) {
    if (!byId.has(s.id)) byId.set(s.id, s);
  }
  for (const s of seeds) {
    const hit = phrases.find((p) => normalizeDe(p.german) === normalizeDe(s.german));
    if (hit && !byId.has(s.id)) byId.set(hit.id, hit);
  }
  return [...byId.values()];
}

const L0_PRIORITY_IDS = [
  'l0-guten-morgen',
  'l0-wie-gehts',
  'l0-mir-gehts-gut',
  'l0-hallo',
  'l0-ich-heisse',
  'survival-heisse',
  'survival-gut',
  'survival-arbeite',
];

export function pickZeroLanguageTarget(
  learning: UserLearningProfile,
  phrases: Phrase[],
): { conf: PhraseConfidence | undefined; phrase: Phrase | null; action: 'introduce' | 'practice' | 'recall' } {
  const pool = mergeZeroLanguagePhrases(phrases);
  for (const id of L0_PRIORITY_IDS) {
    const phrase = pool.find((p) => p.id === id) || null;
    if (!phrase) continue;
    const conf = learning.phrases[id];
    if (conf && isAutomated(conf)) continue;
    const score = conf ? readAutomationScore(conf) : 0;
    const times = conf?.timesCorrect ?? 0;
    if (!conf || conf.state === 'new' || times === 0) {
      return { conf, phrase, action: 'introduce' };
    }
    if (score < 35 || (conf.needsHelp && times < 3)) {
      return { conf, phrase, action: 'practice' };
    }
    if (score < 55 && times < 4) {
      return { conf, phrase, action: 'recall' };
    }
  }
  const fallback = pool.find((p) => p.id === 'l0-guten-morgen') || pool[0] || null;
  return { conf: fallback ? learning.phrases[fallback.id] : undefined, phrase: fallback, action: 'introduce' };
}

/**
 * Diagnóstico de produção vs alvo — inclui near-miss de pronúncia (Morgem ≈ Morgen).
 */
export function diagnoseProduction(text: string, expected?: string | null): ProductionDiagnosis {
  const userSaid = text.trim();
  const user = normalizeDe(userSaid);
  const correction = (expected || '').trim() || userSaid;
  if (!user) {
    return { verdict: 'UNKNOWN', expected: correction, userSaid, correction };
  }
  if (!expected) {
    return { verdict: 'UNKNOWN', expected: correction, userSaid, correction };
  }
  const exp = normalizeDe(expected);
  if (!exp) {
    return { verdict: 'UNKNOWN', expected: correction, userSaid, correction };
  }

  if (user === exp) {
    return { verdict: 'CORRECT', expected: correction, userSaid, correction };
  }

  const stop = new Set(['der', 'die', 'das', 'ein', 'eine', 'und', 'oder', 'mit', 'auf', 'fur', 'zu', 'in', 'am', 'im']);
  const expTokens = exp.split(' ').filter((w) => w.length > 0);
  const userTokens = user.split(' ').filter((w) => w.length > 0);

  for (let i = 0; i < expTokens.length; i++) {
    const et = expTokens[i];
    if (stop.has(et) || et.length < 3) continue;
    const ut = userTokens[i] ?? userTokens.find((u) => levenshtein(u, et) <= 2);
    if (!ut) continue;
    const d = levenshtein(ut, et);
    if (d >= 1 && d <= 2) {
      return {
        verdict: 'NEEDS_REPAIR',
        errorType: 'pronunciation_approx',
        expected: correction,
        userSaid,
        hardPart: et,
        correction,
      };
    }
  }

  if (user.includes(exp) || (exp.includes(user) && user.length >= Math.max(6, exp.length * 0.7))) {
    return { verdict: 'CORRECT', expected: correction, userSaid, correction };
  }

  const contentExp = expTokens.filter((w) => w.length > 1 && !stop.has(w));
  let hit = 0;
  for (const t of contentExp) {
    if (userTokens.some((u) => u === t)) hit += 1;
  }
  if (contentExp.length >= 2 && hit / contentExp.length >= 0.85) {
    return { verdict: 'CORRECT', expected: correction, userSaid, correction };
  }
  if (contentExp.length >= 2 && hit / contentExp.length < 0.4) {
    return {
      verdict: 'INCORRECT',
      errorType: userTokens.length < contentExp.length ? 'omission' : 'mismatch',
      expected: correction,
      userSaid,
      correction,
    };
  }
  if (contentExp.length === 1 && hit === 0) {
    return {
      verdict: 'INCORRECT',
      errorType: 'wrong_word',
      expected: correction,
      userSaid,
      correction,
    };
  }
  return { verdict: 'UNKNOWN', expected: correction, userSaid, correction };
}

export function zeroLanguageDirective(opts: {
  targetGerman?: string;
  targetPt?: string;
  scaffoldLevel: SupportLevel;
  action: string;
}): string {
  const de = opts.targetGerman || 'Guten Morgen.';
  const pt = opts.targetPt || 'Bom dia.';
  return [
    '=== ZERO LANGUAGE MODE (nível 0) ===',
    'O aluno está no nível ZERO. Ele pode NÃO entender alemão.',
    'Português = língua principal de EXPLICAÇÃO. Alemão = doses pequenas.',
    'Padrão de microaula por VOZ (conteúdo NOVO):',
    '1) Em PT: "Vamos aprender uma frase simples." / "Vamos aprender a dizer …"',
    `2) Em PT: "Em alemão: ${de}"`,
    `3) Em PT: "Significa ${pt}."`,
    '4) Em PT: "Escute."',
    `5) Pronuncie claramente em alemão: "${de}"`,
    '6) Em PT: "Agora você." / "Agora repita."',
    '7) PARE e AGUARDE o aluno. Silêncio ≠ erro imediato.',
    '8) Se errar: Quase → ponto difícil → Escute novamente → modelo → Agora você. NÃO mude de assunto.',
    '9) Se acertar com modelo: "Perfeito! Sehr gut!" — isso é produção GUIADA, não automação.',
    '10) Depois: recall sem tradução ("Como dizemos …?") → microconversa curta.',
    'UMA estrutura por vez. Frases muito curtas. Não teste. Não avance rápido.',
    `AÇÃO: ${opts.action}. SCAFFOLD: ${opts.scaffoldLevel}/5.`,
    `FRASE ATUAL: "${de}" = "${pt}"`,
    'PROIBIDO: perguntas abertas longas, vocabulário não ensinado, monólogo em alemão, reiniciar com Hallo/Wie geht\'s sem motivo pedagógico.',
    '=== FIM ZERO LANGUAGE MODE ===',
  ].join('\n');
}

export function zeroLanguageKickoff(opts: {
  targetGerman?: string;
  targetPt?: string;
  scaffoldLevel: SupportLevel;
  returning?: boolean;
  weakOrUnfinished?: string;
}): string {
  const de = opts.targetGerman || 'Guten Morgen.';
  const pt = opts.targetPt || 'Bom dia.';
  const withPt = opts.scaffoldLevel >= 2;
  const stem = de.replace(/[.?!…]+$/, '');

  if (opts.returning && opts.weakOrUnfinished) {
    const w = opts.weakOrUnfinished;
    return [
      '[INSTRUÇÃO INTERNA — não leia isto em voz alta]',
      'ZERO LANGUAGE MODE — CONTINUIDADE (não reinicie do zero):',
      '1. Em português: "Vamos continuar de onde paramos."',
      `2. Trabalhe a frase pendente/fraca: "${w}"`,
      withPt ? '3. Explique em PT se ainda precisar; depois peça produção.' : '3. Peça recall sem traduzir de imediato.',
      '4. AGUARDE o aluno. NÃO diga Hallo nem Wie geht\'s só por hábito.',
    ].join('\n');
  }

  if (opts.returning && !withPt) {
    return [
      '[INSTRUÇÃO INTERNA — não leia isto em voz alta]',
      'ZERO LANGUAGE MODE — RECALL:',
      `1. Em português: "Agora vamos ver se você lembra. Como dizemos ${pt}?"`,
      '2. AGUARDE. Não revele a frase inteira de imediato.',
      '3. Se precisar: pista → primeira palavra → modelo completo.',
    ].join('\n');
  }

  return [
    '[INSTRUÇÃO INTERNA — não leia isto em voz alta]',
    'ZERO LANGUAGE MODE — microaula por voz AGORA (fale nesta ordem):',
    '1. Em português: "Vamos aprender uma frase simples."',
    `2. Em português: explique o sentido ("${pt} em alemão é:")`,
    `3. Em alemão, claro: "${de}"`,
    `4. Em português: "Significa ${pt}."`,
    '5. Em português: "Escute."',
    `6. Em alemão novamente: "${de}"`,
    `7. Em português: "Agora você." / "Agora repita: ${stem}."`,
    '8. PARE. AGUARDE o aluno. Não continue sozinho. Silêncio não é erro imediato.',
  ].join('\n');
}

/** Nudge: ensinar a partir do erro — modelo + nova tentativa (sem mudar de assunto). */
export function teachFromErrorNudge(opts: {
  userSaid: string;
  correction: string;
  hardPart?: string;
  errorType?: ProductionErrorType;
  attempt: number;
}): string {
  const soft = opts.attempt <= 1 ? 'Quase!' : 'Vamos tentar de novo.';
  const focus = opts.hardPart
    ? `A palavra/parte difícil é "${opts.hardPart}".`
    : opts.errorType === 'conjugation'
      ? 'Só uma pequena correção na forma do verbo.'
      : 'Só uma pequena correção.';
  const slow = opts.errorType === 'pronunciation_approx'
    ? `Diga: "Escute novamente." Depois pronuncie DEVAGAR: "${opts.correction}"`
    : `Diga: "Escute novamente." Depois modele: "${opts.correction}"`;
  return [
    '[INSTRUÇÃO INTERNA — não leia isto em voz alta]',
    'ENSINO A PARTIR DO ERRO — obrigatório:',
    `O aluno disse: "${opts.userSaid}"`,
    `Forma correta: "${opts.correction}"`,
    soft,
    focus,
    slow,
    'Peça NOVA TENTATIVA: "Agora você."',
    'AGUARDE. NÃO mude de assunto. NÃO avance para outra frase.',
    'Tom: encorajador. Nunca diga "errado" ou "você não sabe".',
  ].join('\n');
}

export function praiseGuidedRetryNudge(correction: string): string {
  return [
    '[INSTRUÇÃO INTERNA — não leia isto em voz alta]',
    `O aluno acertou após correção: "${correction}"`,
    'Elogie de forma curta: "Perfeito! Sehr gut!"',
    'Isso foi produção GUIADA (havia modelo). NÃO declare fluência.',
    'Pode avançar para a próxima micro-etapa do mesmo tema (recall ou contexto curto).',
  ].join('\n');
}
