/**
 * Gate de confiabilidade do transcript do usuário (Gemini Live).
 * Não filtra idioma/agressivo — só evita decisões pedagógicas sobre
 * áudio sem fala utilizável ou eco claro do professor.
 */

export type UserTranscriptRejectReason =
  | 'empty'
  | 'no_letters'
  | 'too_short'
  | 'teacher_echo';

export type UserTranscriptGateResult =
  | { ok: true; reason: 'reliable' }
  | { ok: false; reason: UserTranscriptRejectReason };

function normalizeForCompare(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Produção legítima do alvo (aluno repetindo a frase ensinada). */
export function transcriptMatchesTarget(
  userText: string,
  targetGerman: string | null | undefined,
): boolean {
  if (!targetGerman) return false;
  const u = normalizeForCompare(userText);
  const t = normalizeForCompare(targetGerman);
  if (!u || !t) return false;
  if (u === t) return true;
  // Aluno produziu o alvo completo mesmo se o professor falou mais
  if (u.includes(t) && t.split(' ').length >= 2) return true;
  if (t.includes(u) && u.split(' ').length >= 2 && u.length >= Math.min(8, t.length)) return true;
  return false;
}

/** Similaridade grosseira por tokens (eco do professor). */
export function transcriptLikelyTeacherEcho(userText: string, teacherText: string | null | undefined): boolean {
  if (!teacherText) return false;
  const u = normalizeForCompare(userText);
  const t = normalizeForCompare(teacherText);
  if (!u || !t) return false;
  if (u === t) return true;
  if (t.includes(u) && u.split(' ').length >= 3) return true;
  if (u.includes(t) && t.split(' ').length >= 3) return true;
  const uTokens = new Set(u.split(' ').filter((w) => w.length > 2));
  const tTokens = t.split(' ').filter((w) => w.length > 2);
  if (uTokens.size === 0 || tTokens.length === 0) return false;
  let hit = 0;
  for (const w of tTokens) if (uTokens.has(w)) hit += 1;
  const overlap = hit / Math.max(uTokens.size, 1);
  // Eco típico: usuário "repete" boa parte do que o professor acabou de dizer
  return overlap >= 0.85 && uTokens.size >= 3;
}

/**
 * Transcript final confiável o bastante para chamar handleUserUtterance.
 * Interrupção legítima (fala distinta do professor) passa.
 * Repetição do alvo pedagógico NÃO é tratada como eco.
 */
export function assessUserTranscriptReliability(input: {
  text: string;
  lastTeacherText?: string | null;
  targetGerman?: string | null;
}): UserTranscriptGateResult {
  const trimmed = (input.text || '').trim();
  if (!trimmed) return { ok: false, reason: 'empty' };
  if (!/\p{L}/u.test(trimmed)) return { ok: false, reason: 'no_letters' };
  // "hm" / "á" isolados — sem decisão pedagógica
  const lettersOnly = trimmed.replace(/[^\p{L}]/gu, '');
  if (lettersOnly.length < 2) return { ok: false, reason: 'too_short' };
  if (transcriptMatchesTarget(trimmed, input.targetGerman)) {
    return { ok: true, reason: 'reliable' };
  }
  if (transcriptLikelyTeacherEcho(trimmed, input.lastTeacherText)) {
    return { ok: false, reason: 'teacher_echo' };
  }
  return { ok: true, reason: 'reliable' };
}
