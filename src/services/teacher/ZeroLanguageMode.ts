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
  // Bloco 1 — Cumprimentos
  { id: 'l0-guten-morgen', german: 'Guten Morgen.', portuguese: 'Bom dia.' },
  { id: 'l0-guten-abend', german: 'Guten Abend.', portuguese: 'Boa tarde / boa noite (início da noite).' },
  { id: 'l0-gute-nacht', german: 'Gute Nacht.', portuguese: 'Boa noite (ao dormir).' },
  // Bloco 2 — Como estou
  { id: 'l0-wie-gehts', german: "Wie geht's?", portuguese: 'Como você está?' },
  { id: 'l0-mir-gehts-gut', german: "Mir geht's gut.", portuguese: 'Estou bem.' },
  { id: 'survival-gut', german: 'Mir geht es gut.', portuguese: 'Estou bem.' },
  // Bloco 3 — Apresentação
  { id: 'l0-hallo', german: 'Hallo.', portuguese: 'Oi.' },
  { id: 'l0-ich-heisse', german: 'Ich heiße...', portuguese: 'Eu me chamo...' },
  { id: 'survival-heisse', german: 'Ich heiße...', portuguese: 'Me chamo...' },
  { id: 'survival-arbeite', german: 'Ich arbeite.', portuguese: 'Eu trabalho.' },
];

/** Blocos pedagógicos L0 — recuperação volta ao início do bloco atual, não da sessão. */
export const ZERO_LANGUAGE_BLOCKS: Array<{ id: string; namePt: string; phraseIds: string[] }> = [
  {
    id: 'greetings',
    namePt: 'Cumprimentos',
    phraseIds: ['l0-guten-morgen', 'l0-guten-abend', 'l0-gute-nacht'],
  },
  {
    id: 'wellbeing',
    namePt: 'Como estou',
    phraseIds: ['l0-wie-gehts', 'l0-mir-gehts-gut', 'survival-gut'],
  },
  {
    id: 'identity',
    namePt: 'Apresentação',
    phraseIds: ['l0-hallo', 'l0-ich-heisse', 'survival-heisse', 'survival-arbeite'],
  },
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

const L0_PRIORITY_IDS = ZERO_LANGUAGE_BLOCKS.flatMap((b) => b.phraseIds);

/**
 * Acertos necessários para AVANÇAR à próxima frase (aceitação).
 * Domínio longitudinal usa automationScore/memória — não bloqueia avanço.
 */
export const L0_MIN_CORRECT_BEFORE_ADVANCE = 1;

/** Erros reais no mesmo bloco antes de ativar recuperação do bloco. */
export const L0_BLOCK_RECOVERY_ERROR_THRESHOLD = 2;

/** Máximo de recuperações de bloco por sessão (por bloco). */
export const L0_MAX_BLOCK_RECOVERIES_PER_BLOCK = 1;

/** Estados explícitos do ciclo L0 por frase. */
export type L0PhrasePhase =
  | 'INTRODUCE'
  | 'MODEL'
  | 'WAITING_FOR_USER'
  | 'EVALUATING'
  | 'CORRECT'
  | 'NEAR_MISS'
  | 'INCORRECT'
  | 'RETRY'
  | 'ADVANCE'
  | 'BLOCK_REVIEW'
  | 'COMPLETE';

/** Frase aceita para avanço — 1 produção correta basta. */
export function isZeroLanguagePhraseAccepted(conf: PhraseConfidence | undefined): boolean {
  return (conf?.timesCorrect ?? 0) >= L0_MIN_CORRECT_BEFORE_ADVANCE;
}

export function findZeroLanguageBlock(phraseId: string) {
  return ZERO_LANGUAGE_BLOCKS.find((b) => b.phraseIds.includes(phraseId)) || null;
}

/** Frases do bloco para revisão — NUNCA inclui frases já aceitas/dominadas. */
export function getBlockRecoverySequence(
  phraseId: string,
  phrases: Phrase[],
  learning?: UserLearningProfile | null,
): Array<{ id: string; german: string; portuguese: string }> {
  const block = findZeroLanguageBlock(phraseId);
  if (!block) return [];
  const pool = mergeZeroLanguagePhrases(phrases);
  const idx = block.phraseIds.indexOf(phraseId);
  const slice = idx >= 0 ? block.phraseIds.slice(0, idx + 1) : block.phraseIds.slice(0, 1);
  const mapped = slice
    .map((id) => {
      const p = pool.find((x) => x.id === id);
      const seed = ZERO_LANGUAGE_SEED_SPECS.find((s) => s.id === id);
      if (!p && !seed) return null;
      return {
        id,
        german: p?.german || seed!.german,
        portuguese: p?.portuguese || seed!.portuguese,
      };
    })
    .filter((x): x is { id: string; german: string; portuguese: string } => !!x);

  // Preserva progresso: frases já aceitas não entram no recovery
  const filtered = mapped.filter((item) => {
    if (item.id === phraseId) return true; // sempre a frase atual falhada
    if (!learning) return true;
    return !isZeroLanguagePhraseAccepted(learning.phrases[item.id]);
  });
  // Se só sobrou a falhada (ou nada), recovery = local na frase atual
  return filtered.length > 0 ? filtered : mapped.filter((item) => item.id === phraseId);
}

/**
 * Recuperação de bloco — somente com evidência de perda de estrutura:
 * erro real (não near-miss), não na 1ª frase do bloco, e após N erros no bloco.
 */
export function shouldRecoverZeroLanguageBlock(
  phraseId: string,
  verdict: ProductionDiagnosis['verdict'],
  errorType?: ProductionErrorType,
  blockErrorCount = 0,
  recoveriesUsed = 0,
): boolean {
  if (verdict !== 'INCORRECT') return false;
  if (errorType === 'pronunciation_approx') return false;
  if (blockErrorCount < L0_BLOCK_RECOVERY_ERROR_THRESHOLD) return false;
  if (recoveriesUsed >= L0_MAX_BLOCK_RECOVERIES_PER_BLOCK) return false;
  const block = findZeroLanguageBlock(phraseId);
  if (!block) return false;
  return block.phraseIds.indexOf(phraseId) > 0;
}

/** Progresso da UI em L0 = orçamento de tempo, não “5 frases e acabou”. */
export function zeroLanguageSessionUnits(dailyMinutes: number): number {
  const m = Math.max(10, Math.min(90, dailyMinutes || 20));
  return m;
}

export function pickZeroLanguageTarget(
  learning: UserLearningProfile,
  phrases: Phrase[],
  opts?: { blockReviewPhraseId?: string | null },
): { conf: PhraseConfidence | undefined; phrase: Phrase | null; action: 'introduce' | 'practice' | 'recall' } {
  const pool = mergeZeroLanguagePhrases(phrases);

  // Modo BLOCK_REVIEW: reforço local do bloco atual (não volta à sessão inteira)
  if (opts?.blockReviewPhraseId) {
    const reviewBlock = findZeroLanguageBlock(opts.blockReviewPhraseId);
    if (reviewBlock) {
      for (const id of reviewBlock.phraseIds) {
        const phrase = pool.find((p) => p.id === id) || null;
        if (!phrase) continue;
        const conf = learning.phrases[id];
        if (!isZeroLanguagePhraseAccepted(conf)) {
          return { conf, phrase, action: (conf?.timesCorrect ?? 0) > 0 ? 'practice' : 'introduce' };
        }
      }
    }
  }

  // Avanço linear: primeira frase ainda não aceita na ordem pedagógica
  for (const id of L0_PRIORITY_IDS) {
    const phrase = pool.find((p) => p.id === id) || null;
    if (!phrase) continue;
    const conf = learning.phrases[id];
    if (conf && isAutomated(conf)) continue;
    if (isZeroLanguagePhraseAccepted(conf)) continue;
    const times = conf?.timesCorrect ?? 0;
    if (!conf || conf.state === 'new' || times === 0) {
      return { conf, phrase, action: 'introduce' };
    }
    return { conf, phrase, action: 'practice' };
  }

  // Todas aceitas: recall LEVE só no ÚLTIMO bloco tocado — nunca reinicia cumprimentos
  const lastTouched =
    [...L0_PRIORITY_IDS].reverse().find((id) => isZeroLanguagePhraseAccepted(learning.phrases[id])) ||
    null;
  const lastBlock = lastTouched ? findZeroLanguageBlock(lastTouched) : ZERO_LANGUAGE_BLOCKS[ZERO_LANGUAGE_BLOCKS.length - 1];
  if (lastBlock) {
    let weakestInBlock: { conf: PhraseConfidence; phrase: Phrase; score: number } | null = null;
    for (const id of lastBlock.phraseIds) {
      const phrase = pool.find((p) => p.id === id);
      if (!phrase) continue;
      const conf = learning.phrases[id];
      if (!conf || !isZeroLanguagePhraseAccepted(conf)) continue;
      const score = readAutomationScore(conf);
      if (!weakestInBlock || score < weakestInBlock.score) {
        weakestInBlock = { conf, phrase, score };
      }
    }
    if (weakestInBlock) {
      return { conf: weakestInBlock.conf, phrase: weakestInBlock.phrase, action: 'recall' };
    }
  }

  const fallback = pool.find((p) => p.id === lastTouched) || pool[pool.length - 1] || null;
  return { conf: fallback ? learning.phrases[fallback.id] : undefined, phrase: fallback, action: 'recall' };
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
  const contentExp = expTokens.filter((w) => w.length > 1 && !stop.has(w));
  let closeHits = 0;
  for (let i = 0; i < contentExp.length; i++) {
    const t = contentExp[i];
    const aligned = userTokens[i];
    if (aligned && (aligned === t || levenshtein(aligned, t) <= 2)) {
      closeHits += 1;
      continue;
    }
    // Match não alinhado: só exato ou distância 1 (evita mir≈bin, gut≈auto)
    if (userTokens.some((u) => u === t || levenshtein(u, t) <= 1)) closeHits += 1;
  }
  // Erro total (ex.: "Ich bin Auto" vs "Mir geht es gut") NÃO é near-miss
  if (contentExp.length >= 2 && closeHits / contentExp.length < 0.5) {
    return {
      verdict: 'INCORRECT',
      errorType: userTokens.length < contentExp.length ? 'omission' : 'mismatch',
      expected: correction,
      userSaid,
      correction,
    };
  }

  for (let i = 0; i < expTokens.length; i++) {
    const et = expTokens[i];
    if (stop.has(et) || et.length < 3) continue;
    // Preferir token alinhado; senão só vizinho com d<=1 para não cruzar palavras não relacionadas
    const ut =
      userTokens[i] && levenshtein(userTokens[i], et) <= 2
        ? userTokens[i]
        : userTokens.find((u) => u === et || levenshtein(u, et) <= 1);
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
  sessionMinutes?: number;
}): string {
  const de = opts.targetGerman || 'Guten Morgen.';
  const pt = opts.targetPt || 'Bom dia.';
  const minutes = opts.sessionMinutes ?? 20;
  return [
    '=== ZERO LANGUAGE MODE (nível 0) ===',
    'O aluno entende pouco ou NENHUM alemão — ensine como a uma criança pequena: UMA coisa por vez.',
    'Português = suporte. Alemão = doses mínimas. Fale CURTO. Não monologue.',
    `DURAÇÃO DA SESSÃO: ~${minutes} minutos. NÃO encerre só porque ensinou poucas frases.`,
    'Use o tempo: ensinar → repetir → corrigir → revisar → recuperar → só então avançar.',
    'Ciclo OBRIGATÓRIO por frase nova (VOZ):',
    '1) PT: "Vamos aprender uma frase nova."',
    `2) PT: "${pt} em alemão é ${de}"`,
    `3) DE (modelo claro): "${de}"`,
    `4) PT: "Significa ${pt}."`,
    `5) DE de novo: "${de}"`,
    '6) PT: "Agora repita." / "Agora você."',
    '7) PARE. AGUARDE o microfone. Silêncio ≠ erro.',
    '8) Se quase (pronúncia): "Quase!" → destaque a parte → modelo → "Agora você." AGUARDE.',
    '9) Se erro claro: corrija a frase atual → "Agora você." → AGUARDE. Só após erros repetidos no MESMO bloco, revisão curta local.',
    '10) Um acerto correto = aceitar e avançar à PRÓXIMA frase. UMA estrutura nova por vez.',
    'PROIBIDO em L0: Wo wohnst du? / Was machst du? / Was brauchst du? / perguntas abertas sem estrutura ensinado.',
    'PROIBIDO: aula teórica longa, despejar várias frases, falar enquanto o aluno deve responder.',
    `AÇÃO: ${opts.action}. SCAFFOLD: ${opts.scaffoldLevel}/5.`,
    `FRASE ATUAL: "${de}" = "${pt}"`,
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
    'ZERO LANGUAGE MODE — microaula por voz AGORA (fale nesta ordem, CURTO):',
    '1. Em português: "Vamos aprender uma frase nova."',
    `2. Em português: "${pt} em alemão é:"`,
    `3. Em alemão, claro: "${de}"`,
    `4. Em português: "Significa ${pt}."`,
    '5. Em português: "Escute."',
    `6. Em alemão novamente: "${de}"`,
    `7. Em português: "Agora repita: ${stem}."`,
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
    ? opts.errorType === 'pronunciation_approx'
      ? `É "${opts.hardPart}".`
      : `A palavra/parte difícil é "${opts.hardPart}".`
    : opts.errorType === 'conjugation'
      ? 'Só uma pequena correção na forma do verbo.'
      : 'Só uma pequena correção.';
  const slow = opts.errorType === 'pronunciation_approx'
    ? `Diga: "Escute novamente." Depois pronuncie DEVAGAR: "${opts.correction}"`
    : `Diga: "Escute novamente." Depois modele: "${opts.correction}"`;
  return [
    '[INSTRUÇÃO INTERNA — não leia isto em voz alta]',
    'ENSINO A PARTIR DO ERRO — obrigatório (CURTO):',
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
    'Elogie de forma curta: "Perfeito!"',
    'Isso foi produção GUIADA (havia modelo). NÃO declare fluência.',
    'Avance para a próxima frase. NÃO volte a frases anteriores já aceitas.',
  ].join('\n');
}

/** Recuperação LOCAL do bloco atual — só frases ainda não aceitas (+ a falhada). */
export function blockRecoveryNudge(opts: {
  failedGerman: string;
  sequence: Array<{ german: string; portuguese?: string }>;
  blockNamePt?: string;
}): string {
  const onlyCurrent = opts.sequence.length <= 1;
  const lines = opts.sequence
    .map((p, i) => `${i + 1}. Modele "${p.german}" → "Agora você." → AGUARDE → confirme com "Perfeito!" se ok.`)
    .join('\n');
  return [
    '[INSTRUÇÃO INTERNA — não leia isto em voz alta]',
    onlyCurrent
      ? 'RECUPERAÇÃO LOCAL L0 — só a frase atual (NÃO volte a frases já dominadas):'
      : 'RECUPERAÇÃO DO BLOCO ATUAL L0 — só itens ainda fracos deste bloco (NÃO volte a blocos anteriores):',
    `Foque em: "${opts.failedGerman}"${opts.blockNamePt ? ` (bloco "${opts.blockNamePt}")` : ''}.`,
    onlyCurrent
      ? 'Em português, curto: "Vamos tentar de novo esta frase."'
      : 'Em português, curto: "Vamos reforçar esta parte."',
    'Percorra EM ORDEM, UMA de cada vez, com AGUARDA após cada pedido:',
    lines,
    'PROIBIDO: voltar para Guten Morgen / Wie geht\'s / frases de blocos anteriores já aceitas.',
    'NÃO apague progresso. NÃO reinicie a sessão.',
  ].join('\n');
}

/** Encerramento suave quando o tempo da sessão está no fim. */
export function zeroLanguageWrapUpNudge(opts: { minutes: number; learnedHint?: string }): string {
  return [
    '[INSTRUÇÃO INTERNA — não leia isto em voz alta]',
    `O tempo da sessão (~${opts.minutes} min) está no fim.`,
    'NÃO inicie uma sequência longa nova.',
    'Conclua o exercício atual em 1–2 turnos curtos.',
    'Em português: "Vamos terminar por hoje."',
    opts.learnedHint ? `Mencione de forma curta o que praticou: ${opts.learnedHint}` : 'Elogie o esforço em uma frase curta.',
    'Encerre naturalmente. O app salva o estado.',
  ].join('\n');
}
