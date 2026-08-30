/* ContentLevelValidator — verifica se um conteúdo (frase/gramática) está dentro
   do nível permitido, evitando que a IA gere, p.ex., uma pergunta C1 num exercício A1. */
import type { CourseLevelId } from './types';
import { isContentUnlocked } from './CourseUnlockService';
import { GRAMMAR_BY_ID, grammarForLevel } from './grammar';
import { categoriesForLevel, CURATED_BY_COMPETENCY } from './content';

/** Conjunto de palavras/gestos permitidos por nível (aproximação por comprimento). */
const MAX_LEN_BY_LEVEL: Record<CourseLevelId, number> = {
  L0: 6,
  A1: 8,
  A2: 12,
  B1: 16,
  B2: 20,
  C1: 28,
  C2: 40,
};

export interface ValidationResult {
  ok: boolean;
  reasons: string[];
  cappedLevel: CourseLevelId;
}

/** Valida uma frase contra um nível-alvo. */
export function validatePhrase(
  text: string,
  target: CourseLevelId,
  competencyId?: string,
): ValidationResult {
  const reasons: string[] = [];
  const words = text.trim().split(/\s+/).filter(Boolean);
  const maxLen = MAX_LEN_BY_LEVEL[target];
  if (words.length > maxLen) {
    reasons.push(`Frase longa demais para ${target} (${words.length} > ${maxLen} palavras).`);
  }
  if (competencyId) {
    const c = CURATED_BY_COMPETENCY[competencyId];
    if (c && c.level !== target) {
      reasons.push(`Competência ${competencyId} pertence a ${c.level}, não a ${target}.`);
    }
  }
  // se a frase excede o nível, recomenda o nível mínimo compatível
  let cappedLevel = target;
  for (const lvl of ['L0', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as CourseLevelId[]) {
    if (words.length <= MAX_LEN_BY_LEVEL[lvl]) { cappedLevel = lvl; break; }
    cappedLevel = lvl;
  }
  return { ok: reasons.length === 0, reasons, cappedLevel };
}

/** Verifica se um tópico de gramática pode ser usado no nível-alvo. */
export function grammarAllowedInLevel(topicId: string, target: CourseLevelId): boolean {
  const t = GRAMMAR_BY_ID[topicId];
  if (!t) return false;
  return isContentUnlocked(t.level, target);
}

/** Lista tópicos de gramática liberados até o nível-alvo. */
export function grammarUnlockedUpTo(target: CourseLevelId): string[] {
  return grammarForLevel(target).map((g) => g.id);
}

/** Verifica se uma categoria de vocabulário pertence ao nível-alvo. */
export function categoryAllowedInLevel(category: string, target: CourseLevelId): boolean {
  return categoriesForLevel(target).includes(category);
}

/** Prompt base para o gerador de conteúdo por IA, informando nível/competência. */
export function buildGeneratorPrompt(opts: {
  level: CourseLevelId;
  skill: string;
  targetCompetency?: string;
  knownLanguage: string;
  newLanguage: string;
  difficulty: 'easy' | 'medium' | 'hard';
}): string {
  return [
    `Nível CEFR-alvo: ${opts.level}.`,
    `Habilidade: ${opts.skill}.`,
    opts.targetCompetency ? `Competência-alvo: ${opts.targetCompetency}.` : '',
    `Língua conhecida: ${opts.knownLanguage}.`,
    `Língua-alvo: ${opts.newLanguage}.`,
    `Dificuldade: ${opts.difficulty}.`,
    `Regra: NÃO use vocabulário ou gramática acima do nível ${opts.level}.`,
    `Responda APENAS com o conteúdo solicitado, em alemão, com tradução em ${opts.knownLanguage}.`,
  ].filter(Boolean).join(' ');
}
