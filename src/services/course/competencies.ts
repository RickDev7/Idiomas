/* CompetencyMap — competências comunicativas por nível. */
import type { Competency, CourseLevelId } from './types';

export const COMPETENCIES: Competency[] = [
  // ---- Nível 0 ----
  { id: 'l0.greet', level: 'L0', title: 'Cumprimentar', description: 'Dizer olá, bom dia, boa noite e tchau.', masteryThreshold: 70, prerequisites: [] },
  { id: 'l0.introduce', level: 'L0', title: 'Apresentar-se', description: 'Dizer seu nome e perguntar o nome do outro.', masteryThreshold: 70, prerequisites: ['l0.greet'] },
  { id: 'l0.basics', level: 'L0', title: 'Informações básicas', description: 'Dizer onde mora, de onde vem e o que faz.', masteryThreshold: 65, prerequisites: ['l0.introduce'] },
  { id: 'l0.yesno', level: 'L0', title: 'Sim e não', description: 'Responder sim/não a perguntas simples.', masteryThreshold: 80, prerequisites: ['l0.greet'] },
  { id: 'l0.thanks', level: 'L0', title: 'Agradecer', description: 'Danke, Danke schön, Bitte.', masteryThreshold: 75, prerequisites: ['l0.greet'] },
  { id: 'l0.needs', level: 'L0', title: 'Expressar necessidades', description: 'Ich brauche…, Ich möchte…, Ich habe…', masteryThreshold: 60, prerequisites: ['l0.basics'] },
  { id: 'l0.help', level: 'L0', title: 'Pedir ajuda', description: 'Hilfe, bitte. Können Sie mir helfen? Ich verstehe nicht.', masteryThreshold: 60, prerequisites: ['l0.needs'] },
  { id: 'l0.repeat', level: 'L0', title: 'Pedir repetição', description: 'Noch einmal, bitte. Langsamer, bitte.', masteryThreshold: 70, prerequisites: ['l0.help'] },

  // ---- A1 ----
  { id: 'a1.family', level: 'A1', title: 'Falar da família', description: 'Descrever membros da família.', masteryThreshold: 65, prerequisites: ['l0.basics'] },
  { id: 'a1.numbers_time', level: 'A1', title: 'Números e horários', description: 'Dizer números, dias, meses e horas.', masteryThreshold: 65, prerequisites: ['l0.basics'] },
  { id: 'a1.routine', level: 'A1', title: 'Falar da rotina', description: 'Descrever a rotina diária.', masteryThreshold: 65, prerequisites: ['a1.numbers_time'] },
  { id: 'a1.shopping', level: 'A1', title: 'Comprar', description: 'Pedir produtos, perguntar preço, pagar.', masteryThreshold: 60, prerequisites: ['a1.numbers_time'] },
  { id: 'a1.food', level: 'A1', title: 'Pedir comida', description: 'Pedir comida e bebida em um restaurante.', masteryThreshold: 60, prerequisites: ['a1.shopping'] },
  { id: 'a1.ask_info', level: 'A1', title: 'Pedir informações', description: 'Perguntar por lugares, horários e direções simples.', masteryThreshold: 60, prerequisites: ['a1.routine'] },
  { id: 'a1.help', level: 'A1', title: 'Pedir ajuda no dia a dia', description: 'Pedir ajuda em situações cotidianas.', masteryThreshold: 65, prerequisites: ['l0.help'] },

  // ---- A2 ----
  { id: 'a2.past', level: 'A2', title: 'Contar o passado', description: 'Usar Perfekt para contar o que aconteceu.', masteryThreshold: 60, prerequisites: ['a1.routine'] },
  { id: 'a2.plans', level: 'A2', title: 'Falar de planos', description: 'Descrever planos e intenções futuras.', masteryThreshold: 60, prerequisites: ['a2.past'] },
  { id: 'a2.problem', level: 'A2', title: 'Explicar problemas', description: 'Descrever problemas simples de saúde, trabalho, moradia.', masteryThreshold: 60, prerequisites: ['a2.past'] },
  { id: 'a2.opinion', level: 'A2', title: 'Dar opiniões simples', description: 'Expressar preferências e opiniões básicas.', masteryThreshold: 60, prerequisites: ['a2.plans'] },
  { id: 'a2.travel', level: 'A2', title: 'Falar de viagens', description: 'Descrever viagens e experiências.', masteryThreshold: 60, prerequisites: ['a2.past'] },
  { id: 'a2.phone', level: 'A2', title: 'Lidar com telefonemas', description: 'Atender, pedir e passar recados.', masteryThreshold: 55, prerequisites: ['a2.problem'] },

  // ---- B1 (Independência linguística) ----
  { id: 'b1.story', level: 'B1', title: 'Contar histórias', description: 'Narrar experiências com detalhe e sequência clara.', masteryThreshold: 60, prerequisites: ['a2.past'] },
  { id: 'b1.opinion_justify', level: 'B1', title: 'Justificar opiniões', description: 'Dar e justificar opiniões em discussões do dia a dia.', masteryThreshold: 60, prerequisites: ['a2.opinion'] },
  { id: 'b1.work_social', level: 'B1', title: 'Conversar no trabalho', description: 'Participar de conversas sociais e pequenas reuniões.', masteryThreshold: 60, prerequisites: ['b1.opinion_justify'] },
  { id: 'b1.news', level: 'B1', title: 'Entender notícias simples', description: 'Compreender manchetes e notícias curtas.', masteryThreshold: 55, prerequisites: ['b1.story'] },
  { id: 'b1.explain_problem', level: 'B1', title: 'Explicar problemas em detalhe', description: 'Descrever problemas e pedir soluções de forma articulada.', masteryThreshold: 60, prerequisites: ['b1.story', 'a2.problem'] },
  { id: 'b1.live_daily', level: 'B1', title: 'Viver o dia a dia em alemão', description: 'Resolver a maior parte da vida cotidiana em alemão.', masteryThreshold: 65, prerequisites: ['b1.story', 'b1.opinion_justify', 'b1.work_social'] },
  { id: 'b1.present', level: 'B1', title: 'Fazer pequenas apresentações', description: 'Apresentar um tema conhecido por alguns minutos.', masteryThreshold: 55, prerequisites: ['b1.opinion_justify'] },

  // ---- B2 (Fluência funcional executável) ----
  { id: 'b2.narrative', level: 'B2', title: 'Narrar experiências com detalhe', description: 'Contar experiências com nuance, impacto e reflexão.', masteryThreshold: 60, prerequisites: ['b1.story'] },
  { id: 'b2.cause_effect', level: 'B2', title: 'Explicar causas e consequências', description: 'Ligar ações a causas, efeitos e hipóteses.', masteryThreshold: 60, prerequisites: ['b2.narrative'] },
  { id: 'b2.argue', level: 'B2', title: 'Expressar opinião e argumentar', description: 'Defender ideias com fundamentos claros.', masteryThreshold: 60, prerequisites: ['b1.opinion_justify', 'b2.cause_effect'] },
  { id: 'b2.compare', level: 'B2', title: 'Comparar e avaliar opções', description: 'Comparar alternativas e avaliar prós e contras.', masteryThreshold: 60, prerequisites: ['b2.argue'] },
  { id: 'b2.problems_solutions', level: 'B2', title: 'Problemas e soluções', description: 'Relatar problemas e propor soluções concretas.', masteryThreshold: 60, prerequisites: ['b2.cause_effect', 'b1.explain_problem'] },
  { id: 'b2.work_pro', level: 'B2', title: 'Temas profissionais e cotidianos', description: 'Discutir trabalho e vida cotidiana com fluência.', masteryThreshold: 60, prerequisites: ['b2.argue', 'b1.work_social'] },
  { id: 'b2.defend', level: 'B2', title: 'Justificar decisões e defender posições', description: 'Justificar decisões e defender posições sob pressão.', masteryThreshold: 60, prerequisites: ['b2.argue', 'b2.compare'] },
  { id: 'b2.fluent', level: 'B2', title: 'Conversação espontânea', description: 'Produção mais independente e conversação espontânea.', masteryThreshold: 65, prerequisites: ['b2.defend', 'b2.work_pro'] },

  // ---- C1 (Comunicação avançada independente) ----
  { id: 'c1.nuance', level: 'C1', title: 'Nuance e reformulação', description: 'Reformular ideias com precisão e matiz.', masteryThreshold: 60, prerequisites: ['b2.fluent'] },
  { id: 'c1.argue', level: 'C1', title: 'Argumentação complexa', description: 'Construir argumentos com concessão e fundamento.', masteryThreshold: 60, prerequisites: ['c1.nuance', 'b2.argue'] },
  { id: 'c1.debate', level: 'C1', title: 'Debate e contra-argumentação', description: 'Responder a objeções e reestruturar posições.', masteryThreshold: 60, prerequisites: ['c1.argue'] },
  { id: 'c1.hypothesis', level: 'C1', title: 'Hipóteses e cenários', description: 'Formular hipóteses e explorar consequências.', masteryThreshold: 60, prerequisites: ['c1.argue', 'b2.cause_effect'] },
  { id: 'c1.register', level: 'C1', title: 'Registro e comunicação profissional', description: 'Alternar formal, neutro e informal com controle.', masteryThreshold: 60, prerequisites: ['c1.nuance'] },
  { id: 'c1.abstract', level: 'C1', title: 'Temas abstratos e sociais', description: 'Discutir temas sociais e conceitos abstratos.', masteryThreshold: 60, prerequisites: ['c1.hypothesis', 'c1.debate'] },
  { id: 'c1.negotiate', level: 'C1', title: 'Negociação e resolução de conflitos', description: 'Negociar interesses e desativar tensão.', masteryThreshold: 60, prerequisites: ['c1.register', 'c1.debate'] },
  { id: 'c1.spontaneous', level: 'C1', title: 'Conversação avançada espontânea', description: 'Discurso contínuo e produção espontânea.', masteryThreshold: 65, prerequisites: ['c1.negotiate', 'c1.abstract'] },

  // ---- C2 (Domínio pleno — nuance, inferência, persuasão) ----
  { id: 'c2.nuance', level: 'C2', title: 'Nuance extrema e precisão', description: 'Precisão semântica e matizes finos de significado.', masteryThreshold: 65, prerequisites: ['c1.spontaneous'] },
  { id: 'c2.argue', level: 'C2', title: 'Argumentação sofisticada', description: 'Argumentos multilayers com concessões e ressalvas.', masteryThreshold: 65, prerequisites: ['c2.nuance', 'c1.argue'] },
  { id: 'c2.discourse', level: 'C2', title: 'Discurso estruturado', description: 'Sustentar ideias em discurso contínuo e coerente.', masteryThreshold: 65, prerequisites: ['c2.argue'] },
  { id: 'c2.inference', level: 'C2', title: 'Implicação e interpretação', description: 'Inferir, interpretar e negociar o não-dito.', masteryThreshold: 65, prerequisites: ['c2.nuance', 'c1.debate'] },
  { id: 'c2.register', level: 'C2', title: 'Registro, estilo e adequação', description: 'Controlar registro e estilo conforme o contexto.', masteryThreshold: 65, prerequisites: ['c2.nuance', 'c1.register'] },
  { id: 'c2.mediate', level: 'C2', title: 'Negociação, mediação e persuasão', description: 'Mediar interesses e persuadir com nuance.', masteryThreshold: 65, prerequisites: ['c2.argue', 'c1.negotiate'] },
  { id: 'c2.critical', level: 'C2', title: 'Abstração e pensamento crítico', description: 'Analisar conceitos abstratos com rigor.', masteryThreshold: 65, prerequisites: ['c2.inference', 'c1.abstract'] },
  { id: 'c2.fluent', level: 'C2', title: 'Fluência avançada espontânea', description: 'Comunicação espontânea com controle total.', masteryThreshold: 70, prerequisites: ['c2.mediate', 'c2.discourse', 'c2.critical'] },
];

export const COMPETENCY_BY_ID: Record<string, Competency> = Object.fromEntries(
  COMPETENCIES.map((c) => [c.id, c]),
);

export function competenciesForLevel(level: CourseLevelId): Competency[] {
  return COMPETENCIES.filter((c) => c.level === level);
}
