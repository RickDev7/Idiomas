/* Definição estática dos níveis do curso (0 → C2) com módulos e situações. */
import type { CourseLevel, CourseLevelId } from './types';

export const COURSE_LEVELS: CourseLevel[] = [
  {
    id: 'L0',
    label: 'Nível 0',
    cefr: 'pré-A1',
    emoji: '🌱',
    objective: 'Interagir minimamente: cumprimentar, apresentar-se, pedir ajuda.',
    germanPercentage: 30,
    competencies: ['l0.greet', 'l0.introduce', 'l0.basics', 'l0.yesno', 'l0.thanks', 'l0.needs', 'l0.help', 'l0.repeat'],
    grammar: ['g.l0.pronouns', 'g.l0.sein', 'g.l0.haben', 'g.l0.ja_nein'],
    realWorldScenario: 'Cumprimentar um vizinho',
    modules: [
      {
        id: 'l0.m1',
        level: 'L0',
        title: 'Cumprimentos e apresentação',
        description: 'Olá, bom dia, meu nome…',
        units: [
          { id: 'l0.u1', title: 'Cumprimentos', phraseIds: [], wordIds: [], competencies: ['l0.greet'], prerequisites: [] },
          { id: 'l0.u2', title: 'Apresentação', phraseIds: [], wordIds: [], competencies: ['l0.introduce'], prerequisites: ['l0.u1'] },
          { id: 'l0.u3', title: 'Informações básicas', phraseIds: [], wordIds: [], competencies: ['l0.basics'], prerequisites: ['l0.u2'] },
        ],
      },
      {
        id: 'l0.m2',
        level: 'L0',
        title: 'Necessidades e ajuda',
        description: 'Ich brauche…, Hilfe, bitte.',
        units: [
          { id: 'l0.u4', title: 'Sim, não e agradecer', phraseIds: [], wordIds: [], competencies: ['l0.yesno', 'l0.thanks'], prerequisites: ['l0.u1'] },
          { id: 'l0.u5', title: 'Necessidades', phraseIds: [], wordIds: [], competencies: ['l0.needs'], prerequisites: ['l0.u3'] },
          { id: 'l0.u6', title: 'Pedir ajuda e repetição', phraseIds: [], wordIds: [], competencies: ['l0.help', 'l0.repeat'], prerequisites: ['l0.u5'] },
        ],
      },
    ],
  },
  {
    id: 'A1',
    label: 'A1',
    cefr: 'A1',
    emoji: '🟢',
    objective: 'Sobrevivência e vida cotidiana básica.',
    germanPercentage: 55,
    competencies: ['a1.family', 'a1.numbers_time', 'a1.routine', 'a1.shopping', 'a1.food', 'a1.ask_info', 'a1.help'],
    grammar: ['g.a1.verbs_common', 'g.a1.articles', 'g.a1.plural', 'g.a1.negation', 'g.a1.questions', 'g.a1.word_order', 'g.a1.modal', 'g.a1.accusative', 'g.a1.possessives'],
    realWorldScenario: 'Comprando no supermercado',
    modules: [
      { id: 'a1.m1', level: 'A1', title: 'Apresentação e família', description: 'Família, pronomes, artigos.', units: [
        { id: 'a1.u1', title: 'Família', phraseIds: [], wordIds: [], competencies: ['a1.family'], prerequisites: [] },
        { id: 'a1.u2', title: 'Números e horários', phraseIds: [], wordIds: [], competencies: ['a1.numbers_time'], prerequisites: ['a1.u1'] },
      ] },
      { id: 'a1.m2', level: 'A1', title: 'Rotina', description: 'Rotina diária, verbos no presente.', units: [
        { id: 'a1.u3', title: 'Rotina', phraseIds: [], wordIds: [], competencies: ['a1.routine'], prerequisites: ['a1.u2'] },
      ] },
      { id: 'a1.m3', level: 'A1', title: 'Compras e comida', description: 'Supermercado, restaurante.', units: [
        { id: 'a1.u4', title: 'Compras', phraseIds: [], wordIds: [], competencies: ['a1.shopping'], prerequisites: ['a1.u2'] },
        { id: 'a1.u5', title: 'Comida', phraseIds: [], wordIds: [], competencies: ['a1.food'], prerequisites: ['a1.u4'] },
      ] },
      { id: 'a1.m4', level: 'A1', title: 'Cidade e ajuda', description: 'Pedir informações e ajuda.', units: [
        { id: 'a1.u6', title: 'Informações', phraseIds: [], wordIds: [], competencies: ['a1.ask_info'], prerequisites: ['a1.u3'] },
        { id: 'a1.u7', title: 'Ajuda no dia a dia', phraseIds: [], wordIds: [], competencies: ['a1.help'], prerequisites: ['a1.u6'] },
      ] },
    ],
  },
  {
    id: 'A2',
    label: 'A2',
    cefr: 'A2',
    emoji: '🔵',
    objective: 'Vida cotidiana com mais autonomia.',
    germanPercentage: 75,
    competencies: ['a2.past', 'a2.plans', 'a2.problem', 'a2.opinion', 'a2.travel', 'a2.phone'],
    grammar: ['g.a2.perfekt', 'g.a2.praeteritum', 'g.a2.dative', 'g.a2.comparatives', 'g.a2.subordinate', 'g.a2.reflexive', 'g.a2.separable'],
    realWorldScenario: 'Telefonema de trabalho',
    modules: [
      { id: 'a2.m1', level: 'A2', title: 'Passado e planos', description: 'Perfekt, futuro, intenções.', units: [
        { id: 'a2.u1', title: 'Passado', phraseIds: [], wordIds: [], competencies: ['a2.past'], prerequisites: [] },
        { id: 'a2.u2', title: 'Planos', phraseIds: [], wordIds: [], competencies: ['a2.plans'], prerequisites: ['a2.u1'] },
      ] },
      { id: 'a2.m2', level: 'A2', title: 'Problemas e opiniões', description: 'Saúde, trabalho, moradia.', units: [
        { id: 'a2.u3', title: 'Problemas', phraseIds: [], wordIds: [], competencies: ['a2.problem'], prerequisites: ['a2.u1'] },
        { id: 'a2.u4', title: 'Opiniões', phraseIds: [], wordIds: [], competencies: ['a2.opinion'], prerequisites: ['a2.u2'] },
      ] },
      { id: 'a2.m3', level: 'A2', title: 'Viagens e telefonemas', description: 'Viagens, serviços, telefone.', units: [
        { id: 'a2.u5', title: 'Viagens', phraseIds: [], wordIds: [], competencies: ['a2.travel'], prerequisites: ['a2.u1'] },
        { id: 'a2.u6', title: 'Telefonemas', phraseIds: [], wordIds: [], competencies: ['a2.phone'], prerequisites: ['a2.u3'] },
      ] },
    ],
  },
  // ---- Esqueletos B1–C2 (arquitetura pronta, conteúdo a expandir) ----
  {
    id: 'B1', label: 'B1', cefr: 'B1', emoji: '🟡',
    objective: 'Independência linguística.',
    germanPercentage: 88,
    competencies: ['b1.story', 'b1.opinion_justify', 'b1.work_social', 'b1.news', 'b1.explain_problem', 'b1.live_daily', 'b1.present'],
    grammar: ['g.b1.relative', 'g.b1.konjunktiv2', 'g.b1.passiv', 'g.b1.ndekl'],
    realWorldScenario: 'Problema profissional',
    modules: [
      { id: 'b1.m1', level: 'B1', title: 'Histórias e opiniões', description: 'Narrar e justificar.', units: [
        { id: 'b1.u1', title: 'Contar histórias', phraseIds: [], wordIds: [], competencies: ['b1.story'], prerequisites: [] },
        { id: 'b1.u2', title: 'Justificar opiniões', phraseIds: [], wordIds: [], competencies: ['b1.opinion_justify'], prerequisites: ['b1.u1'] },
      ] },
      { id: 'b1.m2', level: 'B1', title: 'Trabalho e sociedade', description: 'Conversas sociais e notícias.', units: [
        { id: 'b1.u3', title: 'Conversar no trabalho', phraseIds: [], wordIds: [], competencies: ['b1.work_social'], prerequisites: ['b1.u2'] },
        { id: 'b1.u4', title: 'Entender notícias', phraseIds: [], wordIds: [], competencies: ['b1.news'], prerequisites: ['b1.u1'] },
      ] },
      { id: 'b1.m3', level: 'B1', title: 'Problemas e apresentações', description: 'Explicar e apresentar.', units: [
        { id: 'b1.u5', title: 'Explicar problemas', phraseIds: [], wordIds: [], competencies: ['b1.explain_problem'], prerequisites: ['b1.u1'] },
        { id: 'b1.u6', title: 'Apresentações', phraseIds: [], wordIds: [], competencies: ['b1.present'], prerequisites: ['b1.u2'] },
      ] },
      { id: 'b1.m4', level: 'B1', title: 'Vida cotidiana', description: 'Resolver a vida em alemão.', units: [
        { id: 'b1.u7', title: 'Vida cotidiana', phraseIds: [], wordIds: [], competencies: ['b1.live_daily'], prerequisites: ['b1.u3', 'b1.u5'] },
      ] },
    ],
  },
  {
    id: 'B2', label: 'B2', cefr: 'B2', emoji: '🟠',
    objective: 'Fluência funcional.',
    germanPercentage: 95,
    competencies: ['b2.argue', 'b2.disagree', 'b2.current_affairs', 'b2.work_pro', 'b2.fluent'],
    grammar: ['g.b2.konjunktiv', 'g.b2.passiv', 'g.b2.connectors'],
    realWorldScenario: 'Negociação',
    modules: [
      { id: 'b2.m1', level: 'B2', title: 'Argumentação', description: 'Debater e defender ideias.', units: [
        { id: 'b2.u1', title: 'Argumentar', phraseIds: [], wordIds: [], competencies: ['b2.argue'], prerequisites: [] },
        { id: 'b2.u2', title: 'Discordar com tato', phraseIds: [], wordIds: [], competencies: ['b2.disagree'], prerequisites: ['b2.u1'] },
      ] },
      { id: 'b2.m2', level: 'B2', title: 'Atualidades e trabalho', description: 'Debater sociedade e trabalho.', units: [
        { id: 'b2.u3', title: 'Atualidades', phraseIds: [], wordIds: [], competencies: ['b2.current_affairs'], prerequisites: ['b2.u1'] },
        { id: 'b2.u4', title: 'Alemão profissional', phraseIds: [], wordIds: [], competencies: ['b2.work_pro'], prerequisites: ['b2.u1'] },
      ] },
      { id: 'b2.m3', level: 'B2', title: 'Fluência', description: 'Conversas longas com naturalidade.', units: [
        { id: 'b2.u5', title: 'Fluência funcional', phraseIds: [], wordIds: [], competencies: ['b2.fluent'], prerequisites: ['b2.u2', 'b2.u3'] },
      ] },
    ],
  },
  {
    id: 'C1', label: 'C1', cefr: 'C1', emoji: '🔴',
    objective: 'Alemão avançado.',
    germanPercentage: 100,
    competencies: ['c1.nuance', 'c1.academic', 'c1.subtext', 'c1.register', 'c1.debates'],
    grammar: ['g.c1.nominal', 'g.c1.partizip'],
    realWorldScenario: 'Apresentação',
    modules: [
      { id: 'c1.m1', level: 'C1', title: 'Nuances e registro', description: 'Formal, informal, ironia.', units: [
        { id: 'c1.u1', title: 'Nuances', phraseIds: [], wordIds: [], competencies: ['c1.nuance'], prerequisites: [] },
        { id: 'c1.u2', title: 'Adaptar registro', phraseIds: [], wordIds: [], competencies: ['c1.register'], prerequisites: ['c1.u1'] },
      ] },
      { id: 'c1.m2', level: 'C1', title: 'Acadêmico e subtexto', description: 'Conceitos complexos e ironia.', units: [
        { id: 'c1.u3', title: 'Linguagem acadêmica', phraseIds: [], wordIds: [], competencies: ['c1.academic'], prerequisites: ['c1.u1'] },
        { id: 'c1.u4', title: 'Captar subtexto', phraseIds: [], wordIds: [], competencies: ['c1.subtext'], prerequisites: ['c1.u1'] },
      ] },
      { id: 'c1.m3', level: 'C1', title: 'Debates', description: 'Debates rápidos e densos.', units: [
        { id: 'c1.u5', title: 'Participar de debates', phraseIds: [], wordIds: [], competencies: ['c1.debates'], prerequisites: ['c1.u3'] },
      ] },
    ],
  },
  {
    id: 'C2', label: 'C2', cefr: 'C2', emoji: '⚫',
    objective: 'Domínio avançado.',
    germanPercentage: 100,
    competencies: ['c2.mastery', 'c2.humor', 'c2.dialect', 'c2.style'],
    grammar: ['g.c2.register'],
    realWorldScenario: 'Debate complexo',
    modules: [
      { id: 'c2.m1', level: 'C2', title: 'Domínio pleno', description: 'Naturalidade, estilo, registro.', units: [
        { id: 'c2.u1', title: 'Domínio', phraseIds: [], wordIds: [], competencies: ['c2.mastery'], prerequisites: [] },
      ] },
      { id: 'c2.m2', level: 'C2', title: 'Humor e sotaques', description: 'Ironia, dialetos, fala regional.', units: [
        { id: 'c2.u2', title: 'Humor e ironia', phraseIds: [], wordIds: [], competencies: ['c2.humor'], prerequisites: ['c2.u1'] },
        { id: 'c2.u3', title: 'Sotaques e dialetos', phraseIds: [], wordIds: [], competencies: ['c2.dialect'], prerequisites: ['c2.u1'] },
      ] },
      { id: 'c2.m3', level: 'C2', title: 'Estilo e escrita', description: 'Produção sofisticada.', units: [
        { id: 'c2.u4', title: 'Estilo e escrita', phraseIds: [], wordIds: [], competencies: ['c2.style'], prerequisites: ['c2.u1'] },
      ] },
    ],
  },
];

export const LEVEL_ORDER: CourseLevelId[] = ['L0', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

export const LEVEL_BY_ID: Record<CourseLevelId, CourseLevel> = Object.fromEntries(
  COURSE_LEVELS.map((l) => [l.id, l]),
) as Record<CourseLevelId, CourseLevel>;

export function levelIndex(id: CourseLevelId): number {
  return LEVEL_ORDER.indexOf(id);
}

export function nextLevel(id: CourseLevelId): CourseLevelId | null {
  const i = levelIndex(id);
  return i >= 0 && i < LEVEL_ORDER.length - 1 ? LEVEL_ORDER[i + 1] : null;
}
