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
import { isAutomated } from '@/services/learning/AutomationScoreEngine';
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

/** Progressão L0: frases curtas em ordem (uma por vez). Cobertura ampla = orçamento de tempo. */
export const ZERO_LANGUAGE_SEED_SPECS: Array<{ id: string; german: string; portuguese: string }> = [
  // Bloco 1 — Cumprimentos
  { id: 'l0-guten-morgen', german: 'Guten Morgen.', portuguese: 'Bom dia.' },
  { id: 'l0-guten-tag', german: 'Guten Tag.', portuguese: 'Boa tarde.' },
  { id: 'l0-guten-abend', german: 'Guten Abend.', portuguese: 'Boa tarde / boa noite (início da noite).' },
  { id: 'l0-gute-nacht', german: 'Gute Nacht.', portuguese: 'Boa noite (ao dormir).' },
  { id: 'l0-hallo', german: 'Hallo.', portuguese: 'Oi.' },
  { id: 'l0-tschuess', german: 'Tschüss!', portuguese: 'Tchau!' },
  // Bloco 2 — Como estou
  { id: 'l0-wie-gehts', german: "Wie geht's?", portuguese: 'Como você está?' },
  { id: 'l0-mir-gehts-gut', german: "Mir geht's gut.", portuguese: 'Estou bem.' },
  // legado (merge/memória) — não entram na prioridade linear
  { id: 'survival-gut', german: 'Mir geht es gut.', portuguese: 'Estou bem.' },
  // Bloco 3 — Apresentação / vida
  { id: 'l0-ich-heisse', german: 'Ich heiße...', portuguese: 'Eu me chamo...' },
  { id: 'survival-heisse', german: 'Ich heiße...', portuguese: 'Me chamo...' },
  { id: 'l0-ich-bin', german: 'Ich bin...', portuguese: 'Eu sou...' },
  { id: 'l0-ich-wohne', german: 'Ich wohne in...', portuguese: 'Eu moro em...' },
  { id: 'l0-ich-komme', german: 'Ich komme aus...', portuguese: 'Eu venho de...' },
  { id: 'survival-arbeite', german: 'Ich arbeite.', portuguese: 'Eu trabalho.' },
  // Bloco 4 — Sobrevivência
  { id: 'l0-ja', german: 'Ja.', portuguese: 'Sim.' },
  { id: 'l0-nein', german: 'Nein.', portuguese: 'Não.' },
  { id: 'l0-danke', german: 'Danke.', portuguese: 'Obrigado.' },
  { id: 'l0-bitte', german: 'Bitte.', portuguese: 'Por favor. / De nada.' },
  { id: 'l0-hilfe', german: 'Hilfe, bitte!', portuguese: 'Socorro, por favor!' },
  { id: 'l0-pause', german: 'Ich brauche eine Pause.', portuguese: 'Preciso de uma pausa.' },
  { id: 'l0-verstehe-nicht', german: 'Ich verstehe nicht.', portuguese: 'Eu não entendo.' },
  { id: 'l0-noch-einmal', german: 'Noch einmal, bitte.', portuguese: 'Mais uma vez, por favor.' },
];

/** Blocos pedagógicos L0 — prioridade linear = cobertura da sessão (sem duplicatas). */
export const ZERO_LANGUAGE_BLOCKS: Array<{ id: string; namePt: string; phraseIds: string[] }> = [
  {
    id: 'greetings',
    namePt: 'Cumprimentos',
    phraseIds: ['l0-guten-morgen', 'l0-guten-tag', 'l0-guten-abend', 'l0-gute-nacht', 'l0-hallo', 'l0-tschuess'],
  },
  {
    id: 'wellbeing',
    namePt: 'Como estou',
    phraseIds: ['l0-wie-gehts', 'l0-mir-gehts-gut'],
  },
  {
    id: 'identity',
    namePt: 'Apresentação',
    phraseIds: ['l0-ich-heisse', 'l0-ich-bin', 'l0-ich-wohne', 'l0-ich-komme', 'survival-arbeite'],
  },
  {
    id: 'survival',
    namePt: 'Sobrevivência',
    phraseIds: ['l0-ja', 'l0-nein', 'l0-danke', 'l0-bitte', 'l0-hilfe', 'l0-pause', 'l0-verstehe-nicht', 'l0-noch-einmal'],
  },
];

/**
 * Ponte + ganchos L0 (chunks) + substituições funcionais.
 * Objetivo: formar frases, não memorizar uma linha estática.
 */
export const L0_BRIDGE_A1_SPECS: Array<{ id: string; german: string; portuguese: string }> = [
  // Expansões de "Ich arbeite."
  { id: 'l0-bridge-ich-arbeite-in', german: 'Ich arbeite in...', portuguese: 'Eu trabalho em...' },
  { id: 'l0-bridge-ich-arbeite-heute', german: 'Ich arbeite heute.', portuguese: 'Eu trabalho hoje.' },
  { id: 'l0-var-ich-arbeite-morgens', german: 'Ich arbeite morgens.', portuguese: 'Eu trabalho de manhã.' },
  { id: 'l0-bridge-wo-arbeitest', german: 'Wo arbeitest du?', portuguese: 'Onde você trabalha?' },
  { id: 'l0-bridge-wann-arbeitest', german: 'Wann arbeitest du?', portuguese: 'Quando você trabalha?' },
  // Expansões de identidade
  { id: 'l0-bridge-ich-wohne-in', german: 'Ich wohne in Cuxhaven.', portuguese: 'Eu moro em Cuxhaven.' },
  { id: 'l0-bridge-ich-komme-aus', german: 'Ich komme aus Brasilien.', portuguese: 'Eu venho do Brasil.' },
  { id: 'l0-bridge-ich-heisse-name', german: 'Ich heiße Rick.', portuguese: 'Eu me chamo Rick.' },
  { id: 'l0-var-ich-bin-student', german: 'Ich bin Student.', portuguese: 'Eu sou estudante.' },
  // Ganchos estruturantes (chunks) + substituições
  { id: 'l0-hook-ich-muss', german: 'Ich muss...', portuguese: 'Eu preciso / tenho que...' },
  { id: 'l0-var-ich-muss-arbeiten', german: 'Ich muss arbeiten.', portuguese: 'Eu preciso trabalhar.' },
  { id: 'l0-var-ich-muss-gehen', german: 'Ich muss gehen.', portuguese: 'Eu preciso ir.' },
  { id: 'l0-hook-ich-moechte', german: 'Ich möchte...', portuguese: 'Eu gostaria de...' },
  { id: 'l0-var-ich-moechte-wasser', german: 'Ich möchte Wasser.', portuguese: 'Eu gostaria de água.' },
  { id: 'l0-var-ich-moechte-pause', german: 'Ich möchte eine Pause.', portuguese: 'Eu gostaria de uma pausa.' },
  { id: 'l0-hook-kannst-du', german: 'Kannst du...?', portuguese: 'Você pode...?' },
  { id: 'l0-var-kannst-du-helfen', german: 'Kannst du helfen?', portuguese: 'Você pode ajudar?' },
  { id: 'l0-hook-ich-brauche', german: 'Ich brauche...', portuguese: 'Eu preciso de...' },
  { id: 'l0-var-ich-brauche-hilfe', german: 'Ich brauche Hilfe.', portuguese: 'Eu preciso de ajuda.' },
  { id: 'l0-bridge-was-machst', german: 'Was machst du?', portuguese: 'O que você faz?' },
];

/**
 * Gancho base → variações/substituições (ordem pedagógica).
 * Após CORRECT no base, o pick prioriza a próxima variação não aceita.
 */
export const L0_BASE_TO_VARIATIONS: Record<string, string[]> = {
  'survival-arbeite': [
    'l0-bridge-ich-arbeite-in',
    'l0-bridge-ich-arbeite-heute',
    'l0-var-ich-arbeite-morgens',
    'l0-bridge-wo-arbeitest',
    'l0-bridge-wann-arbeitest',
  ],
  'l0-ich-wohne': ['l0-bridge-ich-wohne-in'],
  'l0-ich-komme': ['l0-bridge-ich-komme-aus'],
  'l0-ich-heisse': ['l0-bridge-ich-heisse-name'],
  'l0-ich-bin': ['l0-var-ich-bin-student'],
  'l0-hook-ich-muss': ['l0-var-ich-muss-arbeiten', 'l0-var-ich-muss-gehen'],
  'l0-hook-ich-moechte': ['l0-var-ich-moechte-wasser', 'l0-var-ich-moechte-pause'],
  'l0-hook-kannst-du': ['l0-var-kannst-du-helfen'],
  'l0-hook-ich-brauche': ['l0-var-ich-brauche-hilfe'],
  'l0-hilfe': ['l0-var-ich-brauche-hilfe'],
};

/** Ganchos estruturantes introduzidos após o core inicial (ainda L0). */
export const L0_CHUNK_HOOK_IDS = [
  'l0-hook-ich-muss',
  'l0-hook-ich-moechte',
  'l0-hook-kannst-du',
  'l0-hook-ich-brauche',
] as const;

export function l0VariationsForBase(baseId: string): string[] {
  return L0_BASE_TO_VARIATIONS[baseId] || [];
}

const L0_GREETING_IDS = new Set(
  ZERO_LANGUAGE_BLOCKS.find((b) => b.id === 'greetings')?.phraseIds || [],
);

export function isL0GreetingPhraseId(phraseId: string): boolean {
  return L0_GREETING_IDS.has(phraseId);
}

export function zeroLanguageSeedPhrases(): Phrase[] {
  const specs = [...ZERO_LANGUAGE_SEED_SPECS, ...L0_BRIDGE_A1_SPECS];
  return specs.map((s) => ({
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
const L0_BRIDGE_PRIORITY_IDS = L0_BRIDGE_A1_SPECS.map((s) => s.id);

/** Currículo core L0 (cumprimentos → sobrevivência) esgotado = todas aceitas. */
export function isL0CoreCurriculumComplete(learning: UserLearningProfile): boolean {
  return L0_PRIORITY_IDS.every((id) => isZeroLanguagePhraseAccepted(learning.phrases[id]));
}

export function isL0BridgeCurriculumComplete(learning: UserLearningProfile): boolean {
  return L0_BRIDGE_PRIORITY_IDS.every((id) => isZeroLanguagePhraseAccepted(learning.phrases[id]));
}

/**
 * Acertos necessários para AVANÇAR à próxima frase (aceitação).
 * Domínio longitudinal usa automationScore/memória — não bloqueia avanço.
 */
export const L0_MIN_CORRECT_BEFORE_ADVANCE = 1;

/** Erros reais no mesmo bloco antes de ativar recuperação do bloco.
 * Alto de propósito: dificuldade vai para revisão futura; não monopoliza a sessão. */
export const L0_BLOCK_RECOVERY_ERROR_THRESHOLD = 99;

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

/** Próxima variação/substituição ainda não aceita para um gancho base. */
export function l0NextUnacceptedVariation(
  learning: UserLearningProfile,
  baseId: string,
  skip?: Set<string>,
): string | null {
  for (const id of l0VariationsForBase(baseId)) {
    if (skip?.has(id)) continue;
    if (!isZeroLanguagePhraseAccepted(learning.phrases[id])) return id;
  }
  return null;
}

/**
 * Após CORRECT num base: prioriza variação do próprio base; senão de outros bases aceitos.
 */
export function l0PickPendingVariationId(
  learning: UserLearningProfile,
  opts?: { preferBaseId?: string | null; skip?: Set<string> },
): string | null {
  const skip = opts?.skip || new Set<string>();
  if (opts?.preferBaseId) {
    const hit = l0NextUnacceptedVariation(learning, opts.preferBaseId, skip);
    if (hit) return hit;
  }
  const acceptedBases = Object.keys(L0_BASE_TO_VARIATIONS).filter((id) =>
    isZeroLanguagePhraseAccepted(learning.phrases[id]),
  );
  // Preferir o base aceito mais recentemente (lastProduced)
  acceptedBases.sort((a, b) => {
    const ta = Date.parse(learning.phrases[a]?.lastProduced || '') || 0;
    const tb = Date.parse(learning.phrases[b]?.lastProduced || '') || 0;
    return tb - ta;
  });
  for (const baseId of acceptedBases) {
    const hit = l0NextUnacceptedVariation(learning, baseId, skip);
    if (hit) return hit;
  }
  return null;
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

/** Máximo de acertos seguidos no MESMO target sem erro antes de forçar rotação (anti-loop). */
export const L0_MAX_IMMEDIATE_CORRECT_STREAK = 2;

/**
 * Tentativas de correção (após o 1º erro) antes de postergar a dificuldade
 * e CONTINUAR a sessão — não monopolizar o orçamento de tempo.
 */
export const L0_MAX_CORRECTION_ATTEMPTS = 2;

/** Estimativa de frases novas exploráveis por orçamento de minutos (não é teto rígido). */
export function l0ExpectedCoverageForMinutes(dailyMinutes: number): number {
  const m = Math.max(10, Math.min(90, dailyMinutes || 20));
  const poolLen = L0_PRIORITY_IDS.length + L0_BRIDGE_PRIORITY_IDS.length;
  // ~1 frase nova / 1.5–2 min no início; sessões longas exploram mais (core + ponte)
  return Math.max(6, Math.min(poolLen, Math.round(m / 1.75)));
}

export function pickZeroLanguageTarget(
  learning: UserLearningProfile,
  phrases: Phrase[],
  opts?: {
    blockReviewPhraseId?: string | null;
    /** Frase acabada de acertar — não repetir imediatamente no recall. */
    excludePhraseId?: string | null;
    /** Frases difíceis postergadas nesta sessão — pular para maximizar cobertura. */
    skipPhraseIds?: string[] | null;
  },
): { conf: PhraseConfidence | undefined; phrase: Phrase | null; action: 'introduce' | 'practice' | 'recall' | 'converse' } {
  const pool = mergeZeroLanguagePhrases(phrases);
  const exclude = opts?.excludePhraseId || null;
  const skip = new Set((opts?.skipPhraseIds || []).filter(Boolean));

  const resolveAction = (id: string, conf: PhraseConfidence | undefined) => {
    const phrase = pool.find((p) => p.id === id) || null;
    if (!phrase) return null;
    const times = conf?.timesCorrect ?? 0;
    if (!conf || conf.state === 'new' || times === 0) {
      return { conf, phrase, action: 'introduce' as const };
    }
    return { conf, phrase, action: 'practice' as const };
  };

  // Modo BLOCK_REVIEW: reforço local do bloco atual (não volta à sessão inteira)
  if (opts?.blockReviewPhraseId) {
    const reviewBlock = findZeroLanguageBlock(opts.blockReviewPhraseId);
    if (reviewBlock) {
      for (const id of reviewBlock.phraseIds) {
        if (skip.has(id)) continue;
        if (id === exclude) continue;
        const phrase = pool.find((p) => p.id === id) || null;
        if (!phrase) continue;
        const conf = learning.phrases[id];
        if (!isZeroLanguagePhraseAccepted(conf)) {
          return { conf, phrase, action: (conf?.timesCorrect ?? 0) > 0 ? 'practice' : 'introduce' };
        }
      }
    }
  }

  // MODELO → SUBSTITUIÇÃO: só logo após CORRECT (exclude), avançar para variação do mesmo gancho
  if (exclude) {
    let pendingVar = l0NextUnacceptedVariation(learning, exclude, skip);
    if (!pendingVar) {
      const parentBase = Object.entries(L0_BASE_TO_VARIATIONS).find(([, vars]) =>
        vars.includes(exclude),
      )?.[0];
      if (parentBase) pendingVar = l0NextUnacceptedVariation(learning, parentBase, skip);
    }
    if (pendingVar && pendingVar !== exclude) {
      const hit = resolveAction(pendingVar, learning.phrases[pendingVar]);
      if (hit) return hit;
    }
  }

  // Avanço linear core (cumprimentos → sobrevivência)
  for (const id of L0_PRIORITY_IDS) {
    if (skip.has(id)) continue;
    if (id === exclude) continue;
    const phrase = pool.find((p) => p.id === id) || null;
    if (!phrase) continue;
    const conf = learning.phrases[id];
    if (conf && isAutomated(conf)) continue;
    if (isZeroLanguagePhraseAccepted(conf)) continue;
    return resolveAction(id, conf)!;
  }

  // Core esgotado: completar variações pendentes de ganchos já aceitos, depois novos hooks
  {
    const pending = l0PickPendingVariationId(learning, { preferBaseId: exclude, skip });
    if (pending && pending !== exclude) {
      const hit = resolveAction(pending, learning.phrases[pending]);
      if (hit) return hit;
    }
  }

  // Ganchos estruturantes (Ich muss / möchte / Kannst du / brauche)
  for (const id of L0_CHUNK_HOOK_IDS) {
    if (skip.has(id)) continue;
    if (id === exclude) continue;
    const conf = learning.phrases[id];
    if (conf && isAutomated(conf)) continue;
    if (isZeroLanguagePhraseAccepted(conf)) continue;
    const hit = resolveAction(id, conf);
    if (hit) return hit;
  }

  // Restante da ponte (ainda não coberta por variações de bases aceitos)
  for (const id of L0_BRIDGE_PRIORITY_IDS) {
    if (skip.has(id)) continue;
    if (id === exclude) continue;
    if ((L0_CHUNK_HOOK_IDS as readonly string[]).includes(id)) continue;
    const phrase = pool.find((p) => p.id === id) || null;
    if (!phrase) continue;
    const conf = learning.phrases[id];
    if (conf && isAutomated(conf)) continue;
    if (isZeroLanguagePhraseAccepted(conf)) continue;
    return resolveAction(id, conf)!;
  }

  // Core + ponte aceitos.
  // Recall: NUNCA priorizar greetings já aceitos (timesCorrect>=1).
  const acceptedCore = L0_PRIORITY_IDS.filter((id) => isZeroLanguagePhraseAccepted(learning.phrases[id]));
  const acceptedBridge = L0_BRIDGE_PRIORITY_IDS.filter((id) => isZeroLanguagePhraseAccepted(learning.phrases[id]));
  const acceptedIds = [...acceptedCore, ...acceptedBridge];
  const recallEligible = acceptedIds.filter(
    (id) => id !== exclude && !isL0GreetingPhraseId(id),
  );

  const pickSpaced = (ids: string[]) => {
    let best: { id: string; score: number } | null = null;
    for (const id of ids) {
      const conf = learning.phrases[id];
      if (!conf) continue;
      const auto = typeof conf.automationScore === 'number' ? conf.automationScore : 50;
      const last = conf.lastProduced ? Date.parse(conf.lastProduced) : 0;
      const score = auto * 10 + (last ? last / 1e12 : 0);
      if (!best || score < best.score) best = { id, score };
    }
    return best?.id || ids[0] || null;
  };

  if (!exclude) {
    const lastFunctional =
      [...L0_BRIDGE_PRIORITY_IDS].reverse().find((id) => isZeroLanguagePhraseAccepted(learning.phrases[id])) ||
      [...L0_PRIORITY_IDS].reverse().find(
        (id) => isZeroLanguagePhraseAccepted(learning.phrases[id]) && !isL0GreetingPhraseId(id),
      ) ||
      null;
    if (lastFunctional) {
      const phrase = pool.find((p) => p.id === lastFunctional) || null;
      return {
        conf: learning.phrases[lastFunctional],
        phrase,
        action: 'recall',
      };
    }
  }

  const spacedId = pickSpaced(recallEligible);
  if (spacedId) {
    const phrase = pool.find((p) => p.id === spacedId) || null;
    return {
      conf: learning.phrases[spacedId],
      phrase,
      action: 'recall',
    };
  }

  // Sem recall funcional → converse situacional (montagem de frases)
  const expandBase =
    [...L0_BRIDGE_PRIORITY_IDS, ...L0_PRIORITY_IDS]
      .reverse()
      .find((id) => isZeroLanguagePhraseAccepted(learning.phrases[id]) && !isL0GreetingPhraseId(id)) ||
    exclude ||
    null;
  if (expandBase) {
    return {
      conf: learning.phrases[expandBase],
      phrase: null,
      action: 'converse',
    };
  }

  const fallback = pool.find((p) => L0_BRIDGE_PRIORITY_IDS.includes(p.id)) || pool[pool.length - 1] || null;
  return { conf: fallback ? learning.phrases[fallback.id] : undefined, phrase: fallback, action: 'converse' };
}

/**
 * L0 → Gemini Live: frases já ACEITAS não entram em "FRACAS (reforce)".
 * Caso contrário o model volta para Wie geht's / Morgen após erro em frase nova.
 * Greetings aceitos não vão para known no topo (evita Gemini reiniciar em Morgen).
 */
export function l0PhrasesForLiveProfile(learning: UserLearningProfile): {
  knownPhrases: string[];
  weakPhrases: string[];
} {
  const all = Object.values(learning.phrases);
  const knownPhrases = all
    .filter((c) => isZeroLanguagePhraseAccepted(c) && !isL0GreetingPhraseId(c.phraseId))
    .map((c) => c.phraseId)
    .slice(0, 16);
  // Se só há greetings conhecidos, manter um mínimo sem priorizar o bloco inteiro
  const knownFallback = knownPhrases.length
    ? knownPhrases
    : all.filter((c) => isZeroLanguagePhraseAccepted(c)).map((c) => c.phraseId).slice(0, 4);
  const weakPhrases = all
    .filter((c) => !isZeroLanguagePhraseAccepted(c) && c.confidence > 0 && c.confidence < 40)
    .map((c) => c.phraseId)
    .slice(0, 6);
  return { knownPhrases: knownFallback, weakPhrases };
}

/** Expansões funcionais curtas a partir do último target conhecido (L0). */
export function l0FunctionalExpansionsFor(baseGerman: string | null | undefined): string[] {
  const g = (baseGerman || '').toLowerCase();
  if (/muss/.test(g)) {
    return ['Ich muss arbeiten.', 'Ich muss gehen.', 'Ich muss...'];
  }
  if (/möchte|moechte/.test(g)) {
    return ['Ich möchte Wasser.', 'Ich möchte eine Pause.', 'Ich möchte...'];
  }
  if (/kannst du/.test(g)) {
    return ['Kannst du helfen?', 'Kannst du...?'];
  }
  if (/brauche/.test(g)) {
    return ['Ich brauche Hilfe.', 'Ich brauche...'];
  }
  if (/arbeite|arbeitest/.test(g)) {
    return ['Ich arbeite in...', 'Ich arbeite heute.', 'Ich arbeite morgens.', 'Wo arbeitest du?'];
  }
  if (/wohne|wohnst/.test(g)) {
    return ['Ich wohne in Cuxhaven.', 'Ich wohne in...'];
  }
  if (/heiße|heisse/.test(g)) {
    return ['Ich heiße Rick.', 'Ich heiße...'];
  }
  if (/komme|kommst/.test(g)) {
    return ['Ich komme aus Brasilien.', 'Ich komme aus...'];
  }
  if (/bin\b/.test(g)) {
    return ['Ich bin Student.', 'Ich bin...'];
  }
  return ['Ich muss...', 'Ich möchte...', 'Ich arbeite in...'];
}

/** Após CORRECT: avançar para SUBSTITUIÇÃO / montagem — não repetir o mesmo target. */
export function l0SubstitutionAdvanceNudge(opts: {
  acceptedGerman: string;
  nextGerman: string;
  nextPt?: string;
}): string {
  return [
    '[INSTRUÇÃO INTERNA — não leia isto em voz alta]',
    'ZERO LANGUAGE MODE — MODELO → SUBSTITUIÇÃO (tutor ativo).',
    `Elogie curto: "Perfeito!" O aluno produziu: "${opts.acceptedGerman}".`,
    'PROIBIDO: pedir a MESMA frase de novo / "fale de novo para fixar".',
    'PROIBIDO: voltar a Guten Morgen / Wie geht\'s / Hallo.',
    `Agora EXPANDIR o padrão. Nova frase-alvo ÚNICA: "${opts.nextGerman}"${opts.nextPt ? ` (= ${opts.nextPt})` : ''}.`,
    'Ciclo CURTO: PT (gancho) → modelo DE → "Agora você monta / repete." → AGUARDE.',
    'Explique que é o MESMO gancho com complemento novo (substituição), não uma frase isolada.',
  ].join('\n');
}

/** Nudge: converse / produção — montar frases em situação real. */
export function l0ConverseExpandNudge(opts: {
  lastGerman?: string | null;
  nextBridgeGerman?: string | null;
}): string {
  const base = opts.lastGerman || 'Ich arbeite.';
  const expansions = l0FunctionalExpansionsFor(base);
  const next = opts.nextBridgeGerman || expansions[0];
  return [
    '[INSTRUÇÃO INTERNA — não leia isto em voz alta]',
    'ZERO LANGUAGE MODE — PRODUÇÃO / CONVERSA SITUACIONAL (parceiro ativo).',
    'Elogie curto se acabou de acertar. NÃO reinicie em cumprimentos.',
    'PROIBIDO: Guten Morgen / Wie geht\'s / Hallo / Tschüss só por hábito.',
    'PROIBIDO: só pedir eco da mesma frase estática.',
    `Gancho/base: "${base}".`,
    'Situação: conversa real sobre trabalho / necessidades / rotina.',
    `Peça ao aluno MONTAR uma variação (uma só): "${next}".`,
    `Outras substituições OK: ${expansions.slice(0, 3).map((e) => `"${e}"`).join(' | ')}.`,
    'Se faltar PALAVRA: forneça só a palavra e peça de novo.',
    'Se faltar ESTRUTURA: mostre modelo parcial (gancho + ...) e peça completar.',
    'Se acertar com facilidade: reduza ajuda no próximo turno.',
    'Continua L0: frases curtas, uma estrutura, português de suporte, correção local.',
  ].join('\n');
}

/**
 * Diagnóstico de produção vs alvo — inclui near-miss de pronúncia (Morgem ≈ Morgen).
 */
/**
 * Snapshot de avaliação do turno L0 — “o que o professor pediu agora”
 * vs o target do plano (podem divergir se o Live inventar variação).
 */
export interface L0TurnEvalSnapshot {
  turnId: string;
  targetId: string;
  targetText: string;
  previousTargetId: string | null;
  previousTargetText: string | null;
  expectedAnswer: string;
  acceptedAnswers: string[];
  teacherText: string;
}

function pushUnique(list: string[], value: string) {
  const v = value.trim();
  if (!v) return;
  if (!list.some((x) => normalizeDe(x) === normalizeDe(v))) list.push(v);
}

/**
 * Respostas aceitáveis para o target L0, incluindo respostas naturais
 * quando o professor elicita com pergunta/variação (ex.: Arbeitest du? → Ja, ich arbeite.).
 * Não aceita frases aleatórias só por overlap de palavras.
 */
export function buildL0AcceptedAnswers(targetGerman: string, teacherText = ''): string[] {
  const primary = (targetGerman || '').trim();
  const out: string[] = [];
  if (!primary) return out;
  pushUnique(out, primary);
  pushUnique(out, primary.replace(/[.?!…]+$/u, ''));

  const teacher = teacherText || '';
  const stemArbeite = /ich\s+arbeite\b/i.test(primary);
  const stemGeht = /wie\s+geht/i.test(primary) || /mir\s+geht/i.test(primary);
  const teacherAsksArbeitest = /arbeitest\s+du\b/i.test(teacher);
  const teacherAsksGeht = /wie\s+geht/i.test(teacher);

  if (stemArbeite) {
    pushUnique(out, 'Ja, ich arbeite.');
    pushUnique(out, 'Ja ich arbeite.');
    if (teacherAsksArbeitest) {
      pushUnique(out, 'Arbeitest du?');
      pushUnique(out, 'Arbeitest du.');
      pushUnique(out, 'Ja.');
      pushUnique(out, 'Ja');
    }
  }

  if (stemGeht || teacherAsksGeht) {
    pushUnique(out, 'Mir geht es gut.');
    pushUnique(out, "Mir geht's gut.");
    pushUnique(out, 'Mir gehts gut.');
    pushUnique(out, 'Gut.');
    if (/wie\s+geht/i.test(primary) || teacherAsksGeht) {
      pushUnique(out, 'Mir geht es gut.');
    }
  }

  return out;
}

export function buildL0TurnEvalSnapshot(opts: {
  turnId: string;
  targetId: string;
  targetText: string;
  previousTargetId?: string | null;
  previousTargetText?: string | null;
  teacherText: string;
}): L0TurnEvalSnapshot {
  const expectedAnswer = opts.targetText;
  return {
    turnId: opts.turnId,
    targetId: opts.targetId,
    targetText: opts.targetText,
    previousTargetId: opts.previousTargetId ?? null,
    previousTargetText: opts.previousTargetText ?? null,
    expectedAnswer,
    acceptedAnswers: buildL0AcceptedAnswers(opts.targetText, opts.teacherText),
    teacherText: opts.teacherText,
  };
}

/** Avalia contra a lista de respostas aceitas do turno (primeira CORRECT vence). */
export function diagnoseAgainstAccepted(
  text: string,
  acceptedAnswers: string[],
  fallbackExpected?: string | null,
): ProductionDiagnosis & { matchedAnswer: string | null } {
  const list = acceptedAnswers.filter(Boolean);
  if (list.length === 0) {
    const d = diagnoseProduction(text, fallbackExpected);
    return { ...d, matchedAnswer: d.verdict === 'CORRECT' ? (fallbackExpected || null) : null };
  }
  let best: ProductionDiagnosis | null = null;
  for (const a of list) {
    const d = diagnoseProduction(text, a);
    if (d.verdict === 'CORRECT') return { ...d, matchedAnswer: a };
    if (!best) best = d;
    else if (d.verdict === 'NEEDS_REPAIR' && best.verdict === 'INCORRECT') best = d;
    else if (d.verdict === 'NEEDS_REPAIR' && best.verdict === 'UNKNOWN') best = d;
  }
  const fallback = best || diagnoseProduction(text, fallbackExpected || list[0]);
  return { ...fallback, matchedAnswer: null };
}

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
    `DURAÇÃO DA SESSÃO: ~${minutes} minutos (~${l0ExpectedCoverageForMinutes(minutes)} frases exploráveis como meta, não teto rígido).`,
    'O tempo é ORÇAMENTO DE APRENDIZADO: maximize conteúdo apropriado (vocabulário, estruturas, produção, situações). NÃO maximize repetição da mesma frase.',
    'MÉTODO: GANCHO (chunk) → SUBSTITUIÇÃO → PRODUÇÃO → CONVERSA. Ex.: Ich arbeite. → Ich arbeite in... → Wo arbeitest du?',
    'Ciclo OBRIGATÓRIO por frase nova (VOZ):',
    '1) PT: "Vamos aprender uma frase nova." / "Vamos montar uma frase."',
    `2) PT: "${pt} em alemão é ${de}"`,
    `3) DE (modelo claro): "${de}"`,
    `4) PT: "Significa ${pt}."`,
    `5) DE de novo: "${de}"`,
    '6) PT: "Agora você." / "Agora monte."',
    '7) PARE. AGUARDE o microfone. Silêncio ≠ erro.',
    '8) Se quase (pronúncia): "Quase!" → destaque a parte → modelo → "Agora você." AGUARDE.',
    '9) Se erro: corrija → 1 nova tentativa. Se persistir: registre dificuldade e AVANCE (revisão depois). NÃO monopolize a sessão.',
    '10) Um acerto correto = aceitar e avançar à PRÓXIMA variação/estrutura. NÃO repetir o mesmo target.',
    'PROIBIDO: perguntas abertas sem ter ensinado o gancho; aula teórica longa; despejar várias frases.',
    'Permitido: ganchos ensinado + substituição (Ich muss arbeiten / Ich möchte Wasser) com modelo.',
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
  const words = opts.correction.trim().split(/\s+/).filter(Boolean);
  const partialModel =
    words.length >= 2 ? `${words.slice(0, Math.max(1, words.length - 1)).join(' ')}...` : opts.correction;
  const soft = opts.attempt <= 1 ? 'Quase!' : 'Vamos tentar de novo.';
  const focus = opts.hardPart
    ? opts.errorType === 'pronunciation_approx'
      ? `A palavra que falta/ajustar é "${opts.hardPart}". Forneça SÓ essa palavra e peça de novo.`
      : `Palavra/parte: "${opts.hardPart}". Dê a palavra e peça montar a frase.`
    : opts.errorType === 'conjugation'
      ? 'Corrija só a forma do verbo; mantenha o gancho.'
      : opts.attempt >= 2
        ? `Mostre modelo PARCIAL: "${partialModel}" e peça completar.`
        : 'Só uma pequena correção — não reinicie a aula.';
  const slow = opts.errorType === 'pronunciation_approx'
    ? `Diga: "Escute." Depois pronuncie DEVAGAR: "${opts.correction}"`
    : opts.attempt >= 2
      ? `Modele parcial "${partialModel}", depois completo: "${opts.correction}"`
      : `Modele: "${opts.correction}"`;
  return [
    '[INSTRUÇÃO INTERNA — não leia isto em voz alta]',
    'TUTOR ATIVO L0 — ensinar a MONTAR a frase (não só repetir):',
    `O aluno disse: "${opts.userSaid}"`,
    `Alvo: "${opts.correction}"`,
    soft,
    focus,
    slow,
    'Peça NOVA TENTATIVA: "Agora você monta." / "Agora você."',
    'AGUARDE. NÃO mude de assunto. NÃO avance. NÃO volte a cumprimentos.',
    `ALVO ÚNICO: "${opts.correction}".`,
    'Tom encorajador. Nunca diga "errado" ou "você não sabe".',
  ].join('\n');
}

export function praiseGuidedRetryNudge(correction: string): string {
  return [
    '[INSTRUÇÃO INTERNA — não leia isto em voz alta]',
    `O aluno acertou após correção: "${correction}"`,
    'Elogie de forma curta: "Perfeito!"',
    'Produção GUIADA. NÃO declare fluência.',
    'AVANCE para SUBSTITUIÇÃO / próxima variação do gancho — NÃO repita a mesma frase.',
    'PROIBIDO: voltar a Guten Morgen / Wie geht\'s / frases já aceitas.',
  ].join('\n');
}

/** Após retries esgotados: postergar dificuldade e continuar a aula. */
export function deferDifficultyAndContinueNudge(opts: {
  hardPhrase: string;
  nextGerman?: string | null;
}): string {
  return [
    '[INSTRUÇÃO INTERNA — não leia isto em voz alta]',
    'ZERO LANGUAGE MODE — dificuldade POSTERGADA (não monopolize o tempo).',
    `Em português, curto: "Vamos continuar. Mais tarde voltamos a: ${opts.hardPhrase}"`,
    opts.nextGerman
      ? `Em seguida ensine a PRÓXIMA frase: "${opts.nextGerman}". Ciclo PT→modelo→repita→AGUARDE.`
      : 'Continue com outro conteúdo apropriado. NÃO repita a frase difícil agora.',
    'PROIBIDO: ficar vários minutos na mesma frase. A revisão virá depois (memória/review).',
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
