/**
 * Selected Learning Target — ponto central Home / Meus Chunks / Estrutura → sessão.
 * Query `phrase` é a fonte autoritativa da sessão; sessionStorage só carrega metadados
 * e é limpo quando não há seleção explícita (anti-herança).
 */
import { l0ChunkBaseForPhraseId } from '@/services/teacher/ZeroLanguageMode';
import { newTargetFlowSessionId, targetFlow } from '@/services/ui/TargetFlowTrace';

export type SelectedLearningSource = 'home' | 'chunks' | 'structure' | 'other';

export type SelectedLearningTarget = {
  source: SelectedLearningSource;
  targetId: string;
  baseId?: string;
  targetPhrase?: string;
};

const STORAGE_KEY = 'dt_selected_learning_target';

function decodeMaybe(raw: string): string {
  try {
    return decodeURIComponent(raw).trim();
  } catch {
    return raw.trim();
  }
}

export function storeSelectedLearningTarget(sel: SelectedLearningTarget): void {
  if (typeof sessionStorage === 'undefined') return;
  const targetId = sel.targetId.trim();
  if (!targetId) return;
  const baseId = sel.baseId || l0ChunkBaseForPhraseId(targetId) || targetId;
  try {
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        source: sel.source,
        targetId,
        baseId,
        targetPhrase: sel.targetPhrase,
      } satisfies SelectedLearningTarget),
    );
  } catch {
    /* quota / private mode */
  }
}

export function clearSelectedLearningTarget(): void {
  if (typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

function readStored(): SelectedLearningTarget | undefined {
  if (typeof sessionStorage === 'undefined') return undefined;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as Partial<SelectedLearningTarget>;
    const targetId = typeof parsed.targetId === 'string' ? parsed.targetId.trim() : '';
    if (!targetId) return undefined;
    const source = parsed.source;
    if (source !== 'home' && source !== 'chunks' && source !== 'structure' && source !== 'other') {
      return { source: 'other', targetId, baseId: parsed.baseId, targetPhrase: parsed.targetPhrase };
    }
    return {
      source,
      targetId,
      baseId: parsed.baseId,
      targetPhrase: parsed.targetPhrase,
    };
  } catch {
    return undefined;
  }
}

/**
 * Lê a seleção para type=lesson|first.
 * Prioridade: phrase da URL (autoritativo) > metadados sessionStorage (só se mesmo targetId).
 * Sem `phrase` na URL → limpa storage e retorna undefined (fallback genérico / currículo).
 * Continuity NUNCA substitui o phrase da sessão atual.
 */
export function readSelectedLearningTarget(
  search: string = typeof window !== 'undefined' ? window.location.search : '',
): SelectedLearningTarget | undefined {
  const raw = search.startsWith('?') ? search.slice(1) : search;
  const q = new URLSearchParams(raw);
  const type = q.get('type') || 'lesson';
  if (type !== 'lesson' && type !== 'first') {
    return undefined;
  }
  const phraseRaw = (q.get('phrase') || '').trim();
  if (!phraseRaw) {
    clearSelectedLearningTarget();
    return undefined;
  }
  const targetId = decodeMaybe(phraseRaw);
  if (!targetId) {
    clearSelectedLearningTarget();
    return undefined;
  }
  // Metadados só se baterem com o phrase da URL — nunca herdar targetId antigo.
  const stored = readStored();
  const meta = stored?.targetId === targetId ? stored : undefined;
  if (stored && stored.targetId !== targetId) {
    clearSelectedLearningTarget();
  }
  const fromRaw = q.get('from');
  const fromValid: SelectedLearningSource | undefined =
    fromRaw === 'home' || fromRaw === 'chunks' || fromRaw === 'structure' || fromRaw === 'other'
      ? fromRaw
      : undefined;
  const baseId = meta?.baseId || l0ChunkBaseForPhraseId(targetId) || targetId;
  return {
    source: meta?.source || fromValid || 'other',
    targetId,
    baseId,
    targetPhrase: meta?.targetPhrase,
  };
}

/** @deprecated alias — use readSelectedLearningTarget()?.targetId */
export function readLessonStartPhraseId(
  search: string = typeof window !== 'undefined' ? window.location.search : '',
): string | undefined {
  return readSelectedLearningTarget(search)?.targetId;
}

export function lessonSessionPathForSelectedTarget(
  sel: SelectedLearningTarget,
  sessionType: 'lesson' | 'first' = 'lesson',
): string {
  const targetId = sel.targetId.trim();
  const params = new URLSearchParams();
  params.set('type', sessionType);
  params.set('phrase', targetId);
  if (sel.source) params.set('from', sel.source);
  return `/sessao?${params.toString()}`;
}

/** Compat: monta path + opcionalmente grava metadados. */
export function lessonSessionPathForPhrase(
  phraseId: string,
  source: SelectedLearningSource = 'other',
  targetPhrase?: string,
): string {
  const sel: SelectedLearningTarget = {
    source,
    targetId: phraseId,
    baseId: l0ChunkBaseForPhraseId(phraseId) || phraseId,
    targetPhrase,
  };
  storeSelectedLearningTarget(sel);
  return lessonSessionPathForSelectedTarget(sel);
}

/** Entrada única Home / Chunks / Estrutura / Aprender. */
export function beginSelectedLearningSession(
  navigate: (to: string) => void,
  sel: SelectedLearningTarget,
  sessionType: 'lesson' | 'first' = 'lesson',
): void {
  storeSelectedLearningTarget(sel);
  const path = lessonSessionPathForSelectedTarget(sel, sessionType);
  const sessionId = newTargetFlowSessionId();
  try {
    sessionStorage.setItem('dt_target_flow_session', sessionId);
  } catch { /* ignore */ }
  targetFlow('HOME_CLICK', {
    sessionId,
    route: path,
    startPhraseId: sel.targetId,
    selectedTarget: sel.targetPhrase ?? null,
    selectedTargetId: sel.targetId,
    note: `source=${sel.source}`,
  });
  targetFlow('LESSON_INTENT_CREATED', {
    sessionId,
    route: path,
    startPhraseId: sel.targetId,
    selectedTarget: sel.targetPhrase ?? null,
    selectedTargetId: sel.targetId,
  });
  navigate(path);
}
