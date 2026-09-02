/**
 * SituationKnowledge — filtros pedagógicos sobre o catálogo unificado.
 * Fonte: SituationCatalog (legado SITUATIONS + overlays + extras).
 */
import type { EverydaySituation } from './Types';
import {
  getNormalizedSituations,
  UNIFIED_SIMULATOR_SCENARIOS,
} from './SituationCatalog';

/** Catálogo pedagógico normalizado (não duplica data/content SITUATIONS). */
export const EVERYDAY_SITUATIONS: EverydaySituation[] = getNormalizedSituations();

export function situationsByDomain(domain: string): EverydaySituation[] {
  return getNormalizedSituations().filter((s) => s.domain === domain);
}

/** Situação só é adequada se o aluno conhece ≥1 padrão requerido. */
export function filterSituationsByKnownPatterns(
  situations: EverydaySituation[],
  knownGermans: string[],
): EverydaySituation[] {
  const lower = knownGermans.map((g) => g.toLowerCase());
  return situations.filter((sit) =>
    sit.requiredPatterns.some((pat) =>
      lower.some((g) => g.includes(pat.toLowerCase().replace('…', '').trim())),
    ),
  );
}

export function allPedagogicalSituations(): EverydaySituation[] {
  return getNormalizedSituations();
}

export { UNIFIED_SIMULATOR_SCENARIOS };
