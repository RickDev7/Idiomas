/**
 * REAL_COMMUNICATION — evidência qualitativa de uso fora do app.
 * NÃO inventa experiências. NÃO marca mastery automaticamente.
 */
import { EventStore } from '@/services/learning/EventStore';
import type { RealCommunicationEvidence } from './Types';

const STORAGE_KEY = 'dt_real_communication_evidence';
const MAX_ITEMS = 40;

function loadAll(): RealCommunicationEvidence[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as RealCommunicationEvidence[];
  } catch {
    return [];
  }
}

function saveAll(items: RealCommunicationEvidence[]): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, MAX_ITEMS)));
  } catch {
    /* ignore */
  }
}

export interface RecordRealCommunicationInput {
  observation: string;
  context?: string;
  relatedPhraseId?: string;
  relatedStructure?: string;
  evidenceConfidence?: 'low' | 'medium' | 'high';
}

/**
 * Registra evidência explícita do usuário/sistema.
 * Nunca define confidence/mastery da frase.
 */
export async function recordRealCommunicationEvidence(
  input: RecordRealCommunicationInput,
): Promise<RealCommunicationEvidence> {
  const observation = (input.observation || '').trim();
  if (!observation) {
    throw new Error('real_communication_requires_observation');
  }

  const evidence: RealCommunicationEvidence = {
    id: `rc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    reportedAt: new Date().toISOString(),
    observation,
    context: input.context,
    relatedPhraseId: input.relatedPhraseId,
    relatedStructure: input.relatedStructure,
    evidenceConfidence: input.evidenceConfidence || 'medium',
    doesNotImplyMastery: true,
  };

  const all = loadAll();
  all.unshift(evidence);
  saveAll(all);

  await EventStore.record({
    type: 'REAL_WORLD_EVENT_CREATED',
    phraseId: input.relatedPhraseId,
    context: JSON.stringify({
      kind: 'REAL_COMMUNICATION',
      observation: observation.slice(0, 200),
      relatedStructure: input.relatedStructure,
      evidenceConfidence: evidence.evidenceConfidence,
      doesNotImplyMastery: true,
    }),
  });

  return evidence;
}

export function listRealCommunicationEvidence(limit = 10): RealCommunicationEvidence[] {
  return loadAll().slice(0, limit);
}

export function clearRealCommunicationEvidenceForTests(): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
