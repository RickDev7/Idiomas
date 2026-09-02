/**
 * Chunk Knowledge — estruturas comunicativas (unidade central).
 * Learning State decide quais estão disponíveis para ESTE aluno.
 */
import type { ChunkKnowledge } from './Types';

export const CHUNK_CATALOG: ChunkKnowledge[] = [
  {
    id: 'ck.ich-moechte',
    pattern: 'Ich möchte…',
    meaningPt: 'Eu gostaria / quero…',
    communicativeFunction: 'expressar desejo ou pedido',
    band: 'L0',
    substitutions: ['Kaffee', 'Wasser', 'essen', 'trinken', 'nach Hause gehen'],
    situations: ['restaurant', 'cafe', 'home', 'needs'],
    relatedStructures: ['Was möchtest du?', 'Möchtest du…?'],
    commonErrors: ['omitir infinitivo', 'traduzir literalmente "eu quero" sem möchten'],
  },
  {
    id: 'ck.ich-brauche',
    pattern: 'Ich brauche…',
    meaningPt: 'Eu preciso de…',
    communicativeFunction: 'expressar necessidade',
    band: 'L0',
    substitutions: ['Hilfe', 'Wasser', 'Zeit', 'Informationen'],
    situations: ['work', 'behoerde', 'needs', 'home'],
    relatedStructures: ['Was brauchst du?'],
    commonErrors: ['confundir com möchten'],
  },
  {
    id: 'ck.ich-muss',
    pattern: 'Ich muss…',
    meaningPt: 'Eu preciso / tenho que…',
    communicativeFunction: 'obrigação / plano necessário',
    band: 'L0',
    substitutions: ['arbeiten', 'gehen', 'warten', 'lernen'],
    situations: ['work', 'routine', 'home'],
    relatedStructures: ['Was musst du machen?'],
    commonErrors: ['posição do infinitivo'],
  },
  {
    id: 'ck.ich-kann',
    pattern: 'Ich kann…',
    meaningPt: 'Eu posso / consigo…',
    communicativeFunction: 'capacidade ou possibilidade',
    band: 'L0',
    substitutions: ['helfen', 'kommen', 'Deutsch sprechen'],
    situations: ['work', 'social', 'help'],
    relatedStructures: ['Kannst du…?'],
    commonErrors: ['kann vs möchte'],
  },
  {
    id: 'ck.kannst-du',
    pattern: 'Kannst du…?',
    meaningPt: 'Você pode…?',
    communicativeFunction: 'pedir ajuda / favor',
    band: 'L0',
    substitutions: ['helfen', 'wiederholen', 'langsamer sprechen'],
    situations: ['work', 'help', 'social'],
    relatedStructures: ['Ich kann…'],
    commonErrors: ['ordem do verbo'],
  },
  {
    id: 'ck.ich-arbeite',
    pattern: 'Ich arbeite…',
    meaningPt: 'Eu trabalho…',
    communicativeFunction: 'falar sobre trabalho',
    band: 'L0',
    substitutions: ['heute', 'hier', 'in Berlin', 'als Entwickler'],
    situations: ['work', 'social'],
    relatedStructures: ['Wo arbeitest du?', 'Was machst du?'],
    commonErrors: ['esquecer conjugação'],
  },
  {
    id: 'ck.ich-habe',
    pattern: 'Ich habe…',
    meaningPt: 'Eu tenho…',
    communicativeFunction: 'posse / estado',
    band: 'L0',
    substitutions: ['Zeit', 'eine Frage', 'Hunger'],
    situations: ['work', 'home', 'social'],
    relatedStructures: ['Hast du…?'],
    commonErrors: ['haben vs sein'],
  },
  {
    id: 'ck.ich-gehe',
    pattern: 'Ich gehe…',
    meaningPt: 'Eu vou…',
    communicativeFunction: 'movimento / plano',
    band: 'L0',
    substitutions: ['nach Hause', 'zur Arbeit', 'einkaufen'],
    situations: ['transport', 'routine', 'home'],
    relatedStructures: ['Wohin gehst du?'],
    commonErrors: ['nach vs zu'],
  },
  {
    id: 'ck.ich-moechte-wissen',
    pattern: 'Ich möchte wissen…',
    meaningPt: 'Eu gostaria de saber…',
    communicativeFunction: 'pedir informação',
    band: 'A1',
    substitutions: ['wo…', 'wann…', 'wie…'],
    situations: ['behoerde', 'transport', 'city'],
    relatedStructures: ['Können Sie mir sagen…?'],
    commonErrors: ['misturar com Was ist…'],
  },
];

export function chunkByPattern(german: string): ChunkKnowledge | undefined {
  const g = german.trim().toLowerCase();
  return CHUNK_CATALOG.find((c) => g.startsWith(c.pattern.replace('…', '').trim().toLowerCase()));
}

export function chunksForDomain(domain: string): ChunkKnowledge[] {
  return CHUNK_CATALOG.filter((c) => c.situations.includes(domain));
}
