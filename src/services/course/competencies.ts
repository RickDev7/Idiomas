/* CompetencyMap — competências comunicativas por nível. */
import type { Competency, CourseLevelId } from './types';

export const COMPETENCIES: Competency[] = [
  // ---- Nível 0 (pré-A1 — 8 competências = 8 módulos) ----
  { id: 'l0.greet', level: 'L0', title: 'Primeiros contatos', description: 'Interação social básica: cumprimentos, agradecer, despedir-se.', masteryThreshold: 70, prerequisites: [] },
  { id: 'l0.introduce', level: 'L0', title: 'Eu sou', description: 'Apresentar-se: nome, origem, moradia, idade e perguntas básicas.', masteryThreshold: 70, prerequisites: ['l0.greet'] },
  { id: 'l0.people', level: 'L0', title: 'Pessoas importantes', description: 'Falar de família e pessoas próximas (Das ist…, Ich habe…).', masteryThreshold: 65, prerequisites: ['l0.introduce'] },
  { id: 'l0.basics', level: 'L0', title: 'Números, tempo e informações', description: 'Números, hora, dias e informações básicas do dia a dia.', masteryThreshold: 65, prerequisites: ['l0.people'] },
  { id: 'l0.help', level: 'L0', title: 'Entender e pedir ajuda', description: 'Sim/não, compreensão, repetição e pedir ajuda.', masteryThreshold: 65, prerequisites: ['l0.basics'] },
  { id: 'l0.needs', level: 'L0', title: 'Necessidades básicas', description: 'Ich möchte…, Ich brauche…, Ich kann… e vocabulário de sobrevivência.', masteryThreshold: 60, prerequisites: ['l0.help'] },
  { id: 'l0.world', level: 'L0', title: 'O mundo ao meu redor', description: 'Casa, cidade, trabalho e artigos leves (der/die/das, ein/eine).', masteryThreshold: 60, prerequisites: ['l0.needs'] },
  { id: 'l0.phrases', level: 'L0', title: 'Minhas primeiras frases', description: 'Combinar 3–5 frases curtas em sequências úteis.', masteryThreshold: 65, prerequisites: ['l0.world'] },

  // ---- A1 ----
  { id: 'a1.personal', level: 'A1', title: 'Apresentação e identidade', description: 'Falar de si: nome, origem, cidade, idade, idiomas, trabalho e interesses.', masteryThreshold: 65, prerequisites: ['l0.basics', 'l0.introduce'] },
  { id: 'a1.family', level: 'A1', title: 'Família e pessoas', description: 'Apresentar a família e pessoas próximas (aparência e personalidade básicas).', masteryThreshold: 65, prerequisites: ['a1.personal'] },
  { id: 'a1.routine', level: 'A1', title: 'Rotina, trabalho e dia a dia', description: 'Descrever um dia normal, horários e rotina de trabalho ou estudo.', masteryThreshold: 65, prerequisites: ['a1.family'] },
  { id: 'a1.shopping', level: 'A1', title: 'Compras, restaurante e comida', description: 'Comprar, pedir comida/bebida e resolver preços e quantidades.', masteryThreshold: 60, prerequisites: ['a1.routine'] },
  { id: 'a1.ask_info', level: 'A1', title: 'Cidade, transporte e orientação', description: 'Pedir e compreender informações sobre lugares, direções e transporte.', masteryThreshold: 60, prerequisites: ['a1.shopping'] },
  { id: 'a1.numbers_time', level: 'A1', title: 'Tempo, compromissos e planos', description: 'Combinar horários, marcar encontros e falar de planos simples.', masteryThreshold: 65, prerequisites: ['a1.ask_info'] },
  { id: 'a1.help', level: 'A1', title: 'Situações cotidianas', description: 'Resolver pequenos problemas, convites e diálogos do dia a dia com ajuda reduzida.', masteryThreshold: 65, prerequisites: ['a1.numbers_time', 'l0.help'] },

  // ---- A2 (IDs preservados; títulos alinhados aos blocos escolares) ----
  { id: 'a2.past', level: 'A2', title: 'Experiências e passado', description: 'Contar o que aconteceu, o que fez e como foi uma experiência.', masteryThreshold: 60, prerequisites: ['a1.help', 'a1.routine'] },
  { id: 'a2.plans', level: 'A2', title: 'Casa, moradia e bairro', description: 'Descrever onde mora, cômodos, vizinhança e necessidades simples de moradia.', masteryThreshold: 60, prerequisites: ['a2.past'] },
  { id: 'a2.problem', level: 'A2', title: 'Saúde e bem-estar', description: 'Explicar sintomas simples, pedir ajuda e compreender orientações básicas.', masteryThreshold: 60, prerequisites: ['a2.plans'] },
  { id: 'a2.phone', level: 'A2', title: 'Trabalho e vida profissional', description: 'Falar de tarefas, colegas, horários e resolver situações profissionais curtas.', masteryThreshold: 60, prerequisites: ['a2.problem'] },
  { id: 'a2.travel', level: 'A2', title: 'Viagem, serviços e deslocamento', description: 'Agir com autonomia em hotel, estação, reservas e pequenos imprevistos de viagem.', masteryThreshold: 60, prerequisites: ['a2.phone'] },
  { id: 'a2.opinion', level: 'A2', title: 'Compras, lazer, planos e imprevistos', description: 'Comparar, reclamar educadamente, convidar, planejar e pedir ajuda em situações sociais.', masteryThreshold: 60, prerequisites: ['a2.travel'] },

  // ---- B1 (IDs preservados; títulos alinhados aos blocos escolares) ----
  { id: 'b1.story', level: 'B1', title: 'História pessoal e experiências', description: 'Relatar experiências, mudanças e decisões com sequência clara.', masteryThreshold: 60, prerequisites: ['a2.past'] },
  { id: 'b1.opinion_justify', level: 'B1', title: 'Opiniões, relações e planos', description: 'Dar e justificar opiniões, comparar opções e combinar planos.', masteryThreshold: 60, prerequisites: ['a2.opinion', 'b1.story'] },
  { id: 'b1.work_social', level: 'B1', title: 'Trabalho e vida profissional', description: 'Falar de tarefas, dificuldades, soluções e planos de carreira.', masteryThreshold: 60, prerequisites: ['b1.opinion_justify'] },
  { id: 'b1.news', level: 'B1', title: 'Viagem, cultura e mídia', description: 'Comentar mídia, recomendar e resolver situações de viagem.', masteryThreshold: 55, prerequisites: ['b1.story'] },
  { id: 'b1.explain_problem', level: 'B1', title: 'Moradia, comunidade e serviços', description: 'Explicar problemas de moradia ou serviço e negociar soluções.', masteryThreshold: 60, prerequisites: ['b1.story', 'a2.problem'] },
  { id: 'b1.present', level: 'B1', title: 'Apresentação profissional', description: 'Apresentar formação, pontos fortes e escolhas profissionais.', masteryThreshold: 55, prerequisites: ['b1.work_social'] },
  { id: 'b1.live_daily', level: 'B1', title: 'Saúde e situações práticas', description: 'Explicar necessidades de saúde, imprevistos e pedir esclarecimentos.', masteryThreshold: 65, prerequisites: ['b1.story', 'b1.opinion_justify', 'b1.work_social', 'b1.explain_problem'] },

  // ---- B2 (Fluência funcional executável) ----
  // ---- B2 (IDs preservados; títulos alinhados aos blocos escolares) ----
  { id: 'b2.narrative', level: 'B2', title: 'Cultura, viagem e identidade', description: 'Relatar experiências culturais, adaptação e escolhas pessoais com detalhe.', masteryThreshold: 60, prerequisites: ['b1.story'] },
  { id: 'b2.cause_effect', level: 'B2', title: 'Sociedade, tecnologia e mídia', description: 'Explicar causas, efeitos e nuance em temas contemporâneos familiares.', masteryThreshold: 60, prerequisites: ['b2.narrative'] },
  { id: 'b2.argue', level: 'B2', title: 'Argumentação e tomada de posição', description: 'Defender opinião com razões, exemplos, conclusão e busca de consenso.', masteryThreshold: 60, prerequisites: ['b1.opinion_justify', 'b2.cause_effect'] },
  { id: 'b2.compare', level: 'B2', title: 'Comparar opções e decidir', description: 'Avaliar vantagens, desvantagens, consequências e justificar a escolha.', masteryThreshold: 60, prerequisites: ['b2.argue'] },
  { id: 'b2.problems_solutions', level: 'B2', title: 'Serviços, cidadania e soluções', description: 'Resolver situações práticas complexas e propor medidas concretas.', masteryThreshold: 60, prerequisites: ['b2.cause_effect', 'b1.explain_problem'] },
  { id: 'b2.work_pro', level: 'B2', title: 'Trabalho e comunicação profissional', description: 'Apresentar, negociar prazos, dar feedback e explicar processos.', masteryThreshold: 60, prerequisites: ['b2.argue', 'b1.work_social'] },
  { id: 'b2.defend', level: 'B2', title: 'Relações, conflitos e negociação', description: 'Lidar com objeção, mal-entendido e negociar saída respeitosa.', masteryThreshold: 60, prerequisites: ['b2.argue', 'b2.compare'] },
  { id: 'b2.fluent', level: 'B2', title: 'Apresentação, discussão e integração', description: 'Sustentar discussão estruturada de 5–7 minutos com registro adequado.', masteryThreshold: 65, prerequisites: ['b2.defend', 'b2.work_pro'] },

  // ---- C1 (Comunicação avançada independente) ----
  // ---- C1 (IDs preservados; títulos alinhados aos blocos escolares) ----
  { id: 'c1.nuance', level: 'C1', title: 'Nuance, cultura e mídia', description: 'Reformular com precisão e analisar experiências culturais com profundidade adequada.', masteryThreshold: 60, prerequisites: ['b2.fluent'] },
  { id: 'c1.argue', level: 'C1', title: 'Argumentação avançada e nuance', description: 'Construir argumentos com evidência, ressalvas, concessão parcial e conclusão.', masteryThreshold: 60, prerequisites: ['c1.nuance', 'b2.argue'] },
  { id: 'c1.debate', level: 'C1', title: 'Debate e contra-argumentação', description: 'Responder a objeções, diferenciar e buscar consenso produtivo.', masteryThreshold: 60, prerequisites: ['c1.argue'] },
  { id: 'c1.hypothesis', level: 'C1', title: 'Acadêmico, pesquisa e síntese', description: 'Formular hipóteses, sintetizar fontes e distinguir fato, interpretação e opinião.', masteryThreshold: 60, prerequisites: ['c1.argue', 'b2.cause_effect'] },
  { id: 'c1.register', level: 'C1', title: 'Comunicação profissional e liderança', description: 'Alternar registro e comunicar risco, prioridade e feedback com precisão.', masteryThreshold: 60, prerequisites: ['c1.nuance'] },
  { id: 'c1.abstract', level: 'C1', title: 'Sociedade, ética e temas abstratos', description: 'Discutir temas sociais abstratos com exemplos, consequências e propostas.', masteryThreshold: 60, prerequisites: ['c1.hypothesis', 'c1.debate'] },
  { id: 'c1.negotiate', level: 'C1', title: 'Situações complexas, crise e mediação', description: 'Negociar sob pressão, mediar interesses e confirmar próximos passos.', masteryThreshold: 60, prerequisites: ['c1.register', 'c1.debate'] },
  { id: 'c1.spontaneous', level: 'C1', title: 'Integração, apresentação e discussão', description: 'Sustentar interação estruturada de 7–10 minutos com coesão e reação a contrapontos.', masteryThreshold: 65, prerequisites: ['c1.negotiate', 'c1.abstract'] },

  // ---- C2 (Domínio pleno — nuance, inferência, persuasão) ----
  { id: 'c2.nuance', level: 'C2', title: 'Cultura, identidade, mídia e nuance', description: 'Precisão semântica e análise cultural/mediática com profundidade.', masteryThreshold: 65, prerequisites: ['c1.spontaneous'] },
  { id: 'c2.argue', level: 'C2', title: 'Argumentação sofisticada e retórica', description: 'Construir argumentos com evidência, ressalvas, consequências e conclusão equilibrada.', masteryThreshold: 65, prerequisites: ['c2.nuance', 'c1.argue'] },
  { id: 'c2.discourse', level: 'C2', title: 'Discurso estruturado e dilemas', description: 'Sustentar discurso contínuo, reformular, modular grau e moderar.', masteryThreshold: 65, prerequisites: ['c2.argue'] },
  { id: 'c2.inference', level: 'C2', title: 'Síntese acadêmica e análise', description: 'Inferir, comparar fontes, explicar limitações e sintetizar perspectivas.', masteryThreshold: 65, prerequisites: ['c2.nuance', 'c1.debate'] },
  { id: 'c2.register', level: 'C2', title: 'Registro, estilo e adequação', description: 'Controlar registro formal, académico, de liderança e diplomático.', masteryThreshold: 65, prerequisites: ['c2.nuance', 'c1.register'] },
  { id: 'c2.mediate', level: 'C2', title: 'Liderança, negociação e crise', description: 'Mediar interesses, comunicar decisões e gerir situações de alto impacto.', masteryThreshold: 65, prerequisites: ['c2.argue', 'c1.negotiate'] },
  { id: 'c2.critical', level: 'C2', title: 'Sociedade, ética e temas abstratos', description: 'Discutir ética, sustentabilidade e temas abstratos sem simplificação excessiva.', masteryThreshold: 65, prerequisites: ['c2.inference', 'c1.abstract'] },
  { id: 'c2.fluent', level: 'C2', title: 'Integração C2 — apresentação e discussão', description: 'Apresentar, mediar e sustentar discussão espontânea de 10–12 minutos.', masteryThreshold: 70, prerequisites: ['c2.mediate', 'c2.discourse', 'c2.critical'] },
];

export const COMPETENCY_BY_ID: Record<string, Competency> = Object.fromEntries(
  COMPETENCIES.map((c) => [c.id, c]),
);

/**
 * Aliases legados → canônico (sem segundo sistema de competências).
 * `a1.food` foi fundido em `a1.shopping` no A1 escolar.
 */
export const COMPETENCY_ID_ALIASES: Readonly<Record<string, string>> = {
  'a1.food': 'a1.shopping',
};

/** Resolve id legado para o canônico atual. */
export function resolveCompetencyId(id: string): string {
  return COMPETENCY_ID_ALIASES[id] ?? id;
}

/** Expõe aliases em COMPETENCY_BY_ID para lookups de título/masteryThreshold. */
for (const [legacy, canonical] of Object.entries(COMPETENCY_ID_ALIASES)) {
  const target = COMPETENCY_BY_ID[canonical];
  if (target) COMPETENCY_BY_ID[legacy] = target;
}

/**
 * Funde mastery órfão de aliases no canônico (sem duplicar pontuação).
 * Ex.: competencyMastery['a1.food'] → max em ['a1.shopping'], remove a chave legada.
 */
export function foldLegacyCompetencyMastery(
  mastery: Record<string, number>,
): Record<string, number> {
  const out: Record<string, number> = { ...mastery };
  for (const [legacy, canonical] of Object.entries(COMPETENCY_ID_ALIASES)) {
    if (!(legacy in out)) continue;
    const legacyVal = out[legacy] ?? 0;
    out[canonical] = Math.max(out[canonical] ?? 0, legacyVal);
    delete out[legacy];
  }
  return out;
}

export function competenciesForLevel(level: CourseLevelId): Competency[] {
  return COMPETENCIES.filter((c) => c.level === level);
}
