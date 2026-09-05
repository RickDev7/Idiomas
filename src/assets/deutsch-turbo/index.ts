/**
 * Assets oficiais do redesign Deutsch Turbo.
 * layout-reference: só referência de design — NÃO renderizar no PWA.
 *
 * Os arquivos *-alpha.png são PNG reais (RGBA) derivados dos JPEGs
 * misnamed .png (fundo preto embutido, sem alpha). Preferir *-alpha
 * para mascote/orb/journey; topographic permanece JPEG de textura dark.
 */
import learningJourneyUrl from './learning-journey-alpha.png';
import mascotUrl from './deutsch-turbo-mascot-alpha.png';
import voiceOrbUrl from './voice-orb-alpha.png';
import topographicUrl from './dark-topographic-background.png';

export const DT_ASSETS = {
  learningJourney: learningJourneyUrl,
  mascot: mascotUrl,
  voiceOrb: voiceOrbUrl,
  topographic: topographicUrl,
} as const;

export type DtAssetKey = keyof typeof DT_ASSETS;
