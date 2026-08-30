/* GrammarMap — tópicos de gramática com gating (pré-requisitos). */
import type { GrammarTopic, CourseLevelId } from './types';

export const GRAMMAR: GrammarTopic[] = [
  // ---- Nível 0 ----
  { id: 'g.l0.pronouns', title: 'Pronomes pessoais (ich, du, er/sie/es)', level: 'L0', summary: 'Sujeitos básicos das frases.', examples: ['Ich heiße…', 'Du bist…'], prerequisites: [] },
  { id: 'g.l0.sein', title: 'Verbo sein (ser/estar)', level: 'L0', summary: 'O verbo mais básico do alemão.', examples: ['Ich bin…', 'Du bist…', 'Wir sind…'], prerequisites: ['g.l0.pronouns'] },
  { id: 'g.l0.haben', title: 'Verbo haben (ter)', level: 'L0', summary: 'Expressar posse e necessidades.', examples: ['Ich habe…', 'Du hast…'], prerequisites: ['g.l0.pronouns'] },
  { id: 'g.l0.ja_nein', title: 'Ja / Nein', level: 'L0', summary: 'Afirmação e negação mínima.', examples: ['Ja.', 'Nein.'], prerequisites: [] },

  // ---- A1 ----
  { id: 'g.a1.verbs_common', title: 'Verbos comuns no presente', level: 'A1', summary: 'machen, gehen, kommen, wohnen, arbeiten…', examples: ['Ich arbeite.', 'Du gehst.'], prerequisites: ['g.l0.sein', 'g.l0.haben'] },
  { id: 'g.a1.articles', title: 'Artigos definidos (der/die/das)', level: 'A1', summary: 'Gênero dos substantivos.', examples: ['der Mann', 'die Frau', 'das Kind'], prerequisites: ['g.l0.sein'] },
  { id: 'g.a1.plural', title: 'Plural básico', level: 'A1', summary: 'Formar plurais frequentes.', examples: ['die Kinder', 'die Häuser'], prerequisites: ['g.a1.articles'] },
  { id: 'g.a1.negation', title: 'Negação (nicht / kein)', level: 'A1', summary: 'Negar frases e substantivos.', examples: ['Ich habe keine Zeit.', 'Ich bin nicht müde.'], prerequisites: ['g.a1.verbs_common', 'g.a1.articles'] },
  { id: 'g.a1.questions', title: 'Perguntas (W-Fragen / Ja-Nein)', level: 'A1', summary: 'Formar perguntas básicas.', examples: ['Was machst du?', 'Kommst du?'], prerequisites: ['g.a1.verbs_common'] },
  { id: 'g.a1.word_order', title: 'Ordem básica (V2)', level: 'A1', summary: 'Verbo em segunda posição.', examples: ['Ich gehe heute ins Büro.'], prerequisites: ['g.a1.verbs_common'] },
  { id: 'g.a1.modal', title: 'Modal verbs básicos (können, müssen, wollen)', level: 'A1', summary: 'Expressar capacidade, obrigação, vontade.', examples: ['Ich kann…', 'Du musst…'], prerequisites: ['g.a1.verbs_common'] },
  { id: 'g.a1.accusative', title: 'Acusativo básico', level: 'A1', summary: 'Objeto direto e preposições de acusativo.', examples: ['Ich sehe den Mann.'], prerequisites: ['g.a1.articles'] },
  { id: 'g.a1.possessives', title: 'Possessivos (mein, dein…)', level: 'A1', summary: 'Indicar posse.', examples: ['mein Auto', 'deine Familie'], prerequisites: ['g.a1.articles'] },

  // ---- A2 ----
  { id: 'g.a2.perfekt', title: 'Perfekt (passado composto)', level: 'A2', summary: 'Falar do passado no cotidiano.', examples: ['Ich habe gegessen.', 'Du bist gegangen.'], prerequisites: ['g.a1.verbs_common', 'g.l0.haben', 'g.l0.sein'] },
  { id: 'g.a2.praeteritum', title: 'Präteritum de verbos comuns', level: 'A2', summary: 'war, hatte, konnte…', examples: ['Ich war…', 'Ich hatte…'], prerequisites: ['g.a2.perfekt'] },
  { id: 'g.a2.dative', title: 'Dativo básico', level: 'A2', summary: 'Objeto indireto e preposições de dativo.', examples: ['Ich helfe dir.'], prerequisites: ['g.a1.accusative'] },
  { id: 'g.a2.comparatives', title: 'Comparativos (mehr, -er, als)', level: 'A2', summary: 'Comparar coisas.', examples: ['größer als', 'mehr als'], prerequisites: ['g.a1.verbs_common'] },
  { id: 'g.a2.subordinate', title: 'Orações subordinadas (weil, dass, wenn)', level: 'A2', summary: 'Conectar ideias.', examples: ['Ich bleibe, weil ich müde bin.'], prerequisites: ['g.a1.word_order'] },
  { id: 'g.a2.reflexive', title: 'Verbos reflexivos', level: 'A2', summary: 'sich waschen, sich freuen…', examples: ['Ich wasche mich.'], prerequisites: ['g.a1.verbs_common'] },
  { id: 'g.a2.separable', title: 'Verbos separáveis', level: 'A2', summary: 'anrufen, mitkommen, abholen…', examples: ['Ich rufe dich an.'], prerequisites: ['g.a1.word_order'] },

  // ---- B1 (esqueleto) ----
  { id: 'g.b1.relative', title: 'Orações relativas', level: 'B1', summary: 'der, die, das como pronome relativo.', examples: ['der Mann, der…'], prerequisites: ['g.a2.subordinate', 'g.a1.articles'] },
  { id: 'g.b1.konjunktiv2', title: 'Konjunktiv II básico', level: 'B1', summary: 'würde, hätte, wäre (cortesia/hipótese).', examples: ['Ich würde…'], prerequisites: ['g.a2.praeteritum'] },
  { id: 'g.b1.passiv', title: 'Passiv básico', level: 'B1', summary: 'werden + Partizip II.', examples: ['Das wird gemacht.'], prerequisites: ['g.a2.perfekt'] },
  { id: 'g.b1.ndekl', title: 'N-Deklination', level: 'B1', summary: 'Declinação de adjetivos substantivados.', examples: ['der Junge, den Jungen'], prerequisites: ['g.a2.dative'] },

  // ---- B2 (esqueleto) ----
  { id: 'g.b2.konjunktiv', title: 'Konjunktiv avançado', level: 'B2', summary: 'Nuances de hipótese e relato.', examples: ['Er habe gesagt…'], prerequisites: ['g.b1.konjunktiv2'] },
  { id: 'g.b2.passiv', title: 'Passiv e Alternativen', level: 'B2', summary: 'Passiv com modal, Zustandspassiv.', examples: ['Es muss gemacht werden.'], prerequisites: ['g.b1.passiv'] },
  { id: 'g.b2.connectors', title: 'Conectores avançados', level: 'B2', summary: 'zwar…aber, einerseits…andererseits.', examples: ['Zwar…, aber…'], prerequisites: ['g.a2.subordinate'] },

  // ---- C1 (esqueleto) ----
  { id: 'g.c1.nominal', title: 'Nominalisierung', level: 'C1', summary: 'Estilo formal e substantivação.', examples: ['die Lösung des Problems'], prerequisites: ['g.b2.connectors'] },
  { id: 'g.c1.partizip', title: 'Partizipialattribute', level: 'C1', summary: 'Atributos participiais.', examples: ['das gestern gekaufte Auto'], prerequisites: ['g.b2.passiv'] },

  // ---- C2 (esqueleto) ----
  { id: 'g.c2.register', title: 'Registro e estilo', level: 'C2', summary: 'Variação fina de registro e ironia.', examples: ['(nuances)'], prerequisites: ['g.c1.nominal', 'g.c1.partizip'] },
];

export const GRAMMAR_BY_ID: Record<string, GrammarTopic> = Object.fromEntries(
  GRAMMAR.map((g) => [g.id, g]),
);

export function grammarForLevel(level: CourseLevelId): GrammarTopic[] {
  return GRAMMAR.filter((g) => g.level === level);
}

/** Verifica se todos os pré-requisitos de um tópico foram "vistos" (aparecem no nível atual ou anterior). */
export function grammarUnlocked(topic: GrammarTopic, knownTopicIds: Set<string>): boolean {
  return topic.prerequisites.every((p) => knownTopicIds.has(p));
}
