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

  // ---- B2 (Fluência funcional) ----
  { id: 'b2.argue', level: 'B2', title: 'Argumentar', description: 'Defender ideias e discordar com fundamentos.', masteryThreshold: 60, prerequisites: ['b1.opinion_justify'] },
  { id: 'b2.disagree', level: 'B2', title: 'Discordar com tato', description: 'Discordar de forma educada e construtiva.', masteryThreshold: 60, prerequisites: ['b2.argue'] },
  { id: 'b2.current_affairs', level: 'B2', title: 'Debater atualidades', description: 'Discutir economia, sociedade, cultura e tecnologia.', masteryThreshold: 60, prerequisites: ['b2.argue'] },
  { id: 'b2.work_pro', level: 'B2', title: 'Alemão profissional', description: 'Participar de reuniões e negociações de trabalho.', masteryThreshold: 60, prerequisites: ['b2.argue', 'b1.work_social'] },
  { id: 'b2.fluent', level: 'B2', title: 'Fluência funcional', description: 'Manter conversas longas com naturalidade.', masteryThreshold: 65, prerequisites: ['b2.argue', 'b2.disagree'] },

  // ---- C1 (Alemão avançado) ----
  { id: 'c1.nuance', level: 'C1', title: 'Expressar nuances', description: 'Usar registro formal/informal e ironia com precisão.', masteryThreshold: 60, prerequisites: ['b2.fluent'] },
  { id: 'c1.academic', level: 'C1', title: 'Linguagem acadêmica', description: 'Apresentar e debater conceitos complexos.', masteryThreshold: 60, prerequisites: ['c1.nuance'] },
  { id: 'c1.subtext', level: 'C1', title: 'Captar subtexto', description: 'Entender ironia, humor e o não-dito.', masteryThreshold: 60, prerequisites: ['c1.nuance'] },
  { id: 'c1.register', level: 'C1', title: 'Adaptar registro', description: 'Alternar formal/informal/profissional com naturalidade.', masteryThreshold: 60, prerequisites: ['c1.nuance'] },
  { id: 'c1.debates', level: 'C1', title: 'Participar de debates', description: 'Argumentar em debates rápidos e densos.', masteryThreshold: 60, prerequisites: ['c1.academic'] },

  // ---- C2 (Domínio avançado) ----
  { id: 'c2.mastery', level: 'C2', title: 'Domínio avançado', description: 'Naturalidade, estilo e registro plenos.', masteryThreshold: 65, prerequisites: ['c1.academic', 'c1.subtext'] },
  { id: 'c2.humor', level: 'C2', title: 'Usar humor e ironia', description: 'Empregar humor, ironia e jogo de palavras.', masteryThreshold: 60, prerequisites: ['c2.mastery'] },
  { id: 'c2.dialect', level: 'C2', title: 'Lidar com sotaques e dialetos', description: 'Compreender fala regional e contextos ruidosos.', masteryThreshold: 60, prerequisites: ['c2.mastery'] },
  { id: 'c2.style', level: 'C2', title: 'Estilo e escrita sofisticada', description: 'Produzir textos com estilo e nuance controlados.', masteryThreshold: 65, prerequisites: ['c2.mastery'] },
];

export const COMPETENCY_BY_ID: Record<string, Competency> = Object.fromEntries(
  COMPETENCIES.map((c) => [c.id, c]),
);

export function competenciesForLevel(level: CourseLevelId): Competency[] {
  return COMPETENCIES.filter((c) => c.level === level);
}
