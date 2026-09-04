/**
 * Vocabulary Knowledge — domínio do professor.
 * Disponibilidade (KNOWN/LEARNING/WEAK/NOT_YET) vem do Learning State.
 */
import type { CurriculumBand, VocabEntry } from './Types';

export const VOCAB_DOMAINS = [
  'arbeit',
  'zuhause',
  'familie',
  'essen',
  'restaurant',
  'supermarkt',
  'einkaufen',
  'transport',
  'stadt',
  'zeit',
  'routine',
  'gesundheit',
  'dokumente',
  'behoerde',
  'alltag',
  'sozial',
  'grundbedarf',
] as const;

export type VocabDomain = (typeof VOCAB_DOMAINS)[number];

export const VOCABULARY: VocabEntry[] = [
  { lemma: 'Arbeit', domain: 'arbeit', band: 'L0', glossPt: 'trabalho' },
  { lemma: 'Kollege', domain: 'arbeit', band: 'A1', glossPt: 'colega' },
  { lemma: 'Aufgabe', domain: 'arbeit', band: 'A1', glossPt: 'tarefa' },
  { lemma: 'Hilfe', domain: 'arbeit', band: 'L0', glossPt: 'ajuda' },
  { lemma: 'Zuhause', domain: 'zuhause', band: 'L0', glossPt: 'em casa' },
  { lemma: 'Familie', domain: 'familie', band: 'A1', glossPt: 'família' },
  { lemma: 'Wasser', domain: 'essen', band: 'L0', glossPt: 'água' },
  { lemma: 'Kaffee', domain: 'essen', band: 'L0', glossPt: 'café' },
  { lemma: 'Essen', domain: 'essen', band: 'L0', glossPt: 'comida / comer' },
  { lemma: 'Rechnung', domain: 'restaurant', band: 'A1', glossPt: 'conta' },
  { lemma: 'Preis', domain: 'supermarkt', band: 'A1', glossPt: 'preço' },
  { lemma: 'Bus', domain: 'transport', band: 'A1', glossPt: 'ônibus' },
  { lemma: 'Bahnhof', domain: 'transport', band: 'A1', glossPt: 'estação' },
  { lemma: 'Uhr', domain: 'zeit', band: 'A1', glossPt: 'hora / relógio' },
  { lemma: 'heute', domain: 'routine', band: 'L0', glossPt: 'hoje' },
  { lemma: 'morgen', domain: 'routine', band: 'L0', glossPt: 'amanhã' },
  { lemma: 'Arzt', domain: 'gesundheit', band: 'A1', glossPt: 'médico' },
  { lemma: 'Termin', domain: 'behoerde', band: 'A1', glossPt: 'horário / consulta' },
  { lemma: 'Formular', domain: 'dokumente', band: 'A1+', glossPt: 'formulário' },
  { lemma: 'Name', domain: 'alltag', band: 'L0', glossPt: 'nome' },
  { lemma: 'Hallo', domain: 'sozial', band: 'L0', glossPt: 'olá' },
];

export function vocabByDomain(domain: string): VocabEntry[] {
  return VOCABULARY.filter((v) => v.domain === domain);
}

export function vocabUpToBand(band: CurriculumBand): VocabEntry[] {
  const order = ['L0', 'A1', 'A1+', 'A2', 'B1', 'B2', 'C1', 'C2'];
  const max = order.indexOf(band);
  return VOCABULARY.filter((v) => order.indexOf(v.band) <= max);
}
