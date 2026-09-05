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
  { id: 'g.a1.separable', title: 'Verbos separáveis (introdutório)', level: 'A1', summary: 'Rotina com aufstehen, einkaufen, anrufen em frases do dia a dia.', examples: ['Ich stehe um sieben Uhr auf.', 'Ich gehe einkaufen.'], prerequisites: ['g.a1.word_order'] },
  { id: 'g.a1.dative_functional', title: 'Dativo funcional (introdutório)', level: 'A1', summary: 'Expressões úteis: mit dem Bus, mit Freunden, zum Arzt, bei der Arbeit.', examples: ['Ich fahre mit dem Bus.', 'Ich gehe zum Arzt.'], prerequisites: ['g.a1.articles', 'g.a1.accusative'] },
  { id: 'g.a1.perfekt_intro', title: 'Perfekt introdutório', level: 'A1', summary: 'Experiências recentes e pequenas histórias pessoais (sem aprofundar).', examples: ['Gestern habe ich Pizza gegessen.', 'Am Wochenende habe ich Fußball gespielt.'], prerequisites: ['g.a1.verbs_common', 'g.l0.haben'] },

  // ---- A2 ----
  { id: 'g.a2.perfekt', title: 'Perfekt comunicativo (haben/sein)', level: 'A2', summary: 'Contar experiências recentes com haben e sein.', examples: ['Ich habe gearbeitet.', 'Ich bin gegangen.'], prerequisites: ['g.a1.perfekt_intro', 'g.a1.verbs_common', 'g.l0.haben', 'g.l0.sein'] },
  { id: 'g.a2.praeteritum', title: 'Präteritum funcional', level: 'A2', summary: 'war, hatte e modais frequentes no cotidiano.', examples: ['Ich war…', 'Ich hatte…', 'Ich konnte…'], prerequisites: ['g.a2.perfekt'] },
  { id: 'g.a2.dative', title: 'Dativo prático', level: 'A2', summary: 'Objeto indireto e preposições em situações reais.', examples: ['Ich helfe dir.', 'mit dem Zug'], prerequisites: ['g.a1.dative_functional', 'g.a1.accusative'] },
  { id: 'g.a2.wechselprep', title: 'Wechselpräpositionen em contexto', level: 'A2', summary: 'Localização e movimento (in, auf, an…) sem teoria isolada.', examples: ['in der Wohnung', 'in die Stadt'], prerequisites: ['g.a2.dative', 'g.a1.accusative'] },
  { id: 'g.a2.comparatives', title: 'Comparativo e superlativo', level: 'A2', summary: 'Comparar opções em compras e preferências.', examples: ['günstiger', 'größer als'], prerequisites: ['g.a1.verbs_common'] },
  { id: 'g.a2.subordinate', title: 'Conectores simples (weil, dass, wenn)', level: 'A2', summary: 'Justificar e ligar ideias em conversas curtas.', examples: ['Ich bleibe, weil ich müde bin.'], prerequisites: ['g.a1.word_order'] },
  { id: 'g.a2.reflexive', title: 'Verbos reflexivos úteis', level: 'A2', summary: 'sich ausruhen, sich fühlen… em saúde e rotina.', examples: ['Ich muss mich ausruhen.'], prerequisites: ['g.a1.verbs_common'] },
  { id: 'g.a2.separable', title: 'Verbos separáveis', level: 'A2', summary: 'anrufen, umtauschen, mitkommen…', examples: ['Ich rufe dich an.', 'Ich möchte das umtauschen.'], prerequisites: ['g.a1.separable', 'g.a1.word_order'] },
  { id: 'g.a2.polite', title: 'Pedidos educados e imperativo leve', level: 'A2', summary: 'Können Sie…?, bitte, e instruções simples.', examples: ['Können Sie mir bitte helfen?'], prerequisites: ['g.a1.modal', 'g.a1.word_order'] },

  // ---- B1 (esqueleto) ----
  { id: 'g.b1.narrative', title: 'Narrativa no passado', level: 'B1', summary: 'Perfekt e Präteritum funcional para contar experiências.', examples: ['Zuerst …, dann …', 'Damals habe ich …'], prerequisites: ['g.a2.perfekt', 'g.a2.praeteritum'] },
  { id: 'g.b1.connectors', title: 'Conectores B1 (weil, dass, wenn, obwohl, damit)', level: 'B1', summary: 'Ligar ideias e justificar em subordinadas.', examples: ['obwohl es schwer war', 'damit wir …'], prerequisites: ['g.a2.subordinate'] },
  { id: 'g.b1.relative', title: 'Orações relativas básicas', level: 'B1', summary: 'der, die, das em descrições úteis.', examples: ['der Mann, der…', 'die Wohnung, die…'], prerequisites: ['g.a2.subordinate', 'g.a1.articles'] },
  { id: 'g.b1.konjunktiv2', title: 'Konjunktiv II (desejo, hipótese, cortesia)', level: 'B1', summary: 'würde, hätte, wäre e pedidos educados.', examples: ['Ich würde vorschlagen…', 'Könnten Sie…?'], prerequisites: ['g.a2.praeteritum'] },
  { id: 'g.b1.prep_verbs', title: 'Verbos com preposição e da-/wo-', level: 'B1', summary: 'Interessieren an, sich entscheiden für, darüber sprechen…', examples: ['Ich interessiere mich dafür.', 'Wofür hast du dich entschieden?'], prerequisites: ['g.a2.dative', 'g.a2.separable'] },
  { id: 'g.b1.infinitiv_zu', title: 'Infinitivo com zu / um … zu', level: 'B1', summary: 'Expressar finalidade e planos.', examples: ['Es ist wichtig, … zu …', 'um … zu erreichen'], prerequisites: ['g.a2.subordinate'] },
  { id: 'g.b1.passiv', title: 'Passiv introdutório', level: 'B1', summary: 'werden + Partizip II em contextos úteis (serviço, processo).', examples: ['Das wird gemacht.', 'Die Kosten werden übernommen.'], prerequisites: ['g.a2.perfekt'] },
  { id: 'g.b1.ndekl', title: 'N-Deklination e genitivo frequente', level: 'B1', summary: 'Formas frequentes e expressões úteis (não teoria isolada).', examples: ['den Kollegen', 'trotz des Problems'], prerequisites: ['g.a2.dative'] },

  // ---- B2 (esqueleto) ----
  { id: 'g.b2.connectors', title: 'Conectores argumentativos', level: 'B2', summary: 'zwar…aber, einerseits…andererseits, folglich, dennoch.', examples: ['Zwar…, aber…', 'Folglich…'], prerequisites: ['g.b1.connectors', 'g.a2.subordinate'] },
  { id: 'g.b2.subordinate', title: 'Subordinadas B2', level: 'B2', summary: 'obwohl, während, sofern, nachdem, bevor, damit em contexto.', examples: ['obwohl es schwierig ist', 'damit wir…'], prerequisites: ['g.b1.connectors'] },
  { id: 'g.b2.konjunktiv', title: 'Konjunktiv II (hipótese e diplomacia)', level: 'B2', summary: 'Sugestão, negociação e hipótese sem sofisticação C1.', examples: ['Mein Vorschlag wäre…', 'Wenn wir… hätten'], prerequisites: ['g.b1.konjunktiv2'] },
  { id: 'g.b2.passiv', title: 'Passiv em contextos profissionais', level: 'B2', summary: 'werden + Partizip e passiv com modal em processos.', examples: ['Es muss dokumentiert werden.', 'Die Kosten werden übernommen.'], prerequisites: ['g.b1.passiv'] },
  { id: 'g.b2.relative', title: 'Relative clauses variadas', level: 'B2', summary: 'Relativas em descrições e argumentos.', examples: ['die Lösung, die…', 'das Problem, bei dem…'], prerequisites: ['g.b1.relative'] },
  { id: 'g.b2.prep_verbs', title: 'Verbos com preposição e da-/wo-', level: 'B2', summary: 'sich beziehen auf, eingehen auf, darüber sprechen…', examples: ['Darauf möchte ich eingehen.', 'Wovon hängt das ab?'], prerequisites: ['g.b1.prep_verbs'] },
  { id: 'g.b2.register', title: 'Registro informal vs profissional', level: 'B2', summary: 'Adaptar formulação ao contexto sem estilo acadêmico C1.', examples: ['Im beruflichen Kontext…', 'Ehrlich gesagt…'], prerequisites: ['g.b2.connectors'] },
  { id: 'g.b2.indirect', title: 'Indirekte Rede introdutória', level: 'B2', summary: 'Relatar informação com würde/sei quando necessário.', examples: ['Es heißt, dass…', 'Man sagt, …'], prerequisites: ['g.b2.konjunktiv'] },

  // ---- C1 (esqueleto) ----
  { id: 'g.c1.connectors', title: 'Conectores discursivos avançados', level: 'C1', summary: 'Organizar discurso com coesão e contraste.', examples: ['insofern', 'daraus folgt', 'unter dem Vorbehalt'], prerequisites: ['g.b2.connectors'] },
  { id: 'g.c1.concession', title: 'Concessão, condição e consequência', level: 'C1', summary: 'obwohl, während, sofern, insofern, dadurch dass…', examples: ['sofern die Daten…', 'dadurch dass…'], prerequisites: ['g.b2.subordinate', 'g.c1.connectors'] },
  { id: 'g.c1.konjunktiv', title: 'Konjunktiv II (diplomacia e hipótese)', level: 'C1', summary: 'Negociação, nuance e cenários sem estilo C2.', examples: ['Ich würde entgegnen…', 'Wäre … gewesen'], prerequisites: ['g.b2.konjunktiv'] },
  { id: 'g.c1.indirect', title: 'Indirekte Rede / Konjunktiv I introdutório', level: 'C1', summary: 'Relatar informação e fontes quando útil.', examples: ['Die Studie besagt, dass…', 'Es heißt, …'], prerequisites: ['g.b2.indirect'] },
  { id: 'g.c1.passiv', title: 'Passivo e alternativas naturais', level: 'C1', summary: 'Passivo e formulações equivalentes em contextos profissionais.', examples: ['Es muss geprüft werden.', 'lässt sich … finden'], prerequisites: ['g.b2.passiv'] },
  { id: 'g.c1.nominal', title: 'Nominalização funcional', level: 'C1', summary: 'Estilo formal moderado em síntese e propostas.', examples: ['die Lösung des Problems', 'Entscheidungsbedarf'], prerequisites: ['g.b2.connectors'] },
  { id: 'g.c1.partizip', title: 'Particípios e atributos complexos', level: 'C1', summary: 'Atributos frequentes em frases comuns, sem estilo literário.', examples: ['die vorliegenden Daten', 'die strittigen Punkte'], prerequisites: ['g.b2.passiv'] },
  { id: 'g.c1.register', title: 'Registro e fórmulas profissionais', level: 'C1', summary: 'Adaptar formalidade e collocations profissionais.', examples: ['Ich möchte Sie bitten…', 'verbindlich festhalten'], prerequisites: ['g.b2.register', 'g.c1.nominal'] },

  // ---- C2 (em contexto comunicativo) ----
  { id: 'g.c2.connectors', title: 'Conectores discursivos avançados', level: 'C2', summary: 'Coesão, reformulação e síntese em discurso complexo.', examples: ['unter dem Vorbehalt', 'daraus folgt', 'anders gesagt'], prerequisites: ['g.c1.connectors'] },
  { id: 'g.c2.concession', title: 'Concessão, condição, consequência e gradação', level: 'C2', summary: 'obwohl, insofern, sofern, dadurch dass e grau de certeza.', examples: ['insofern …', 'sofern die Daten …', 'nur bedingt'], prerequisites: ['g.c1.concession', 'g.c2.connectors'] },
  { id: 'g.c2.konjunktiv', title: 'Konjunktiv II (nuance, hipótese, diplomacia)', level: 'C2', summary: 'Distanciamento, hipótese e diplomacia em contextos de alto impacto.', examples: ['Ich würde entgegnen…', 'Wäre … gewesen'], prerequisites: ['g.c1.konjunktiv'] },
  { id: 'g.c2.indirect', title: 'Konjunktiv I / indirekte Rede', level: 'C2', summary: 'Relatar fontes e perspectivas quando útil à síntese.', examples: ['Die Studie besagt, dass…', 'Es heißt, …'], prerequisites: ['g.c1.indirect'] },
  { id: 'g.c2.passiv', title: 'Passivo e alternativas estilísticas', level: 'C2', summary: 'Passivo e formulações equivalentes naturais.', examples: ['Es muss geprüft werden.', 'lässt sich … finden'], prerequisites: ['g.c1.passiv'] },
  { id: 'g.c2.nominal', title: 'Nominalização e condensação', level: 'C2', summary: 'Condensar informação em estilo formal/académico moderado.', examples: ['Entscheidungsbedarf', 'Glaubwürdigkeit der Information'], prerequisites: ['g.c1.nominal'] },
  { id: 'g.c2.relative', title: 'Relativas e frases complexas', level: 'C2', summary: 'Cláusulas relativas e atributos participiais frequentes.', examples: ['die vorliegenden Daten', 'das Muster, das …'], prerequisites: ['g.b2.relative', 'g.c1.partizip'] },
  { id: 'g.c2.register', title: 'Registro, tom e collocations', level: 'C2', summary: 'Formal, profissional, académico e informal com precisão lexical.', examples: ['diplomatisch gesagt', 'im akademischen Register'], prerequisites: ['g.c1.register', 'g.c2.nominal'] },
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
