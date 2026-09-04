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
        { id: 'a1.u1', title: 'Família', phraseIds: ['a1-family-mutter', 'a1-family-bruder', 'a1-family-schwester'], wordIds: [], competencies: ['a1.family'], prerequisites: [] },
        { id: 'a1.u2', title: 'Números e horários', phraseIds: ['a1-time-drei-uhr', 'a1-time-montag', 'a1-time-freitag'], wordIds: [], competencies: ['a1.numbers_time'], prerequisites: ['a1.u1'] },
      ] },
      { id: 'a1.m2', level: 'A1', title: 'Rotina', description: 'Rotina diária, verbos no presente.', units: [
        { id: 'a1.u3', title: 'Rotina', phraseIds: ['a1-routine-aufstehen', 'a1-routine-arbeit', 'a1-routine-kochen'], wordIds: [], competencies: ['a1.routine'], prerequisites: ['a1.u2'] },
      ] },
      { id: 'a1.m3', level: 'A1', title: 'Compras e comida', description: 'Supermercado, restaurante.', units: [
        { id: 'a1.u4', title: 'Compras', phraseIds: ['a1-shopping-kostet', 'a1-shopping-nehme', 'a1-shopping-haben'], wordIds: [], competencies: ['a1.shopping'], prerequisites: ['a1.u2'] },
        { id: 'a1.u5', title: 'Comida', phraseIds: ['a1-food-kaffee', 'a1-food-rechnung', 'a1-food-wasser'], wordIds: [], competencies: ['a1.food'], prerequisites: ['a1.u4'] },
      ] },
      { id: 'a1.m4', level: 'A1', title: 'Cidade e ajuda', description: 'Pedir informações e ajuda.', units: [
        { id: 'a1.u6', title: 'Informações', phraseIds: ['a1-info-bahnhof', 'a1-info-hotel', 'a1-info-bus'], wordIds: [], competencies: ['a1.ask_info'], prerequisites: ['a1.u3'] },
        { id: 'a1.u7', title: 'Ajuda no dia a dia', phraseIds: ['a1-help-koennen', 'a1-help-brauche'], wordIds: [], competencies: ['a1.help'], prerequisites: ['a1.u6'] },
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
        { id: 'a2.u1', title: 'Passado', phraseIds: ['a2-past-gearbeitet', 'a2-past-kino', 'a2-past-gemacht'], wordIds: [], competencies: ['a2.past'], prerequisites: [] },
        { id: 'a2.u2', title: 'Planos', phraseIds: ['a2-plans-werde', 'a2-plans-plane', 'a2-plans-reisen'], wordIds: [], competencies: ['a2.plans'], prerequisites: ['a2.u1'] },
      ] },
      { id: 'a2.m2', level: 'A2', title: 'Problemas e opiniões', description: 'Saúde, trabalho, moradia.', units: [
        { id: 'a2.u3', title: 'Problemas', phraseIds: ['a2-problem-nicht-gut', 'a2-problem-mit', 'a2-problem-wohnung'], wordIds: [], competencies: ['a2.problem'], prerequisites: ['a2.u1'] },
        { id: 'a2.u4', title: 'Opiniões', phraseIds: ['a2-opinion-finde', 'a2-opinion-meinung', 'a2-opinion-lieber'], wordIds: [], competencies: ['a2.opinion'], prerequisites: ['a2.u2'] },
      ] },
      { id: 'a2.m3', level: 'A2', title: 'Viagens e telefonemas', description: 'Viagens, serviços, telefone.', units: [
        { id: 'a2.u5', title: 'Viagens', phraseIds: ['a2-travel-berlin', 'a2-travel-reise', 'a2-travel-uebernachten'], wordIds: [], competencies: ['a2.travel'], prerequisites: ['a2.u1'] },
        { id: 'a2.u6', title: 'Telefonemas', phraseIds: ['a2-phone-hier-ist', 'a2-phone-nachricht', 'a2-phone-spaeter'], wordIds: [], competencies: ['a2.phone'], prerequisites: ['a2.u3'] },
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
        { id: 'b1.u1', title: 'Contar histórias', phraseIds: ['b1-story-muenchen', 'b1-story-geklappt', 'b1-story-weil'], wordIds: [], competencies: ['b1.story'], prerequisites: [] },
        { id: 'b1.u2', title: 'Justificar opiniões', phraseIds: ['b1-opinion-meinung', 'b1-opinion-deshalb', 'b1-opinion-seiten'], wordIds: [], competencies: ['b1.opinion_justify'], prerequisites: ['b1.u1'] },
      ] },
      { id: 'b1.m2', level: 'B1', title: 'Trabalho e sociedade', description: 'Conversas sociais e notícias.', units: [
        { id: 'b1.u3', title: 'Conversar no trabalho', phraseIds: ['b1-work-wochenende', 'b1-work-besprechen', 'b1-work-schlage'], wordIds: [], competencies: ['b1.work_social'], prerequisites: ['b1.u2'] },
        { id: 'b1.u4', title: 'Entender notícias', phraseIds: ['b1-news-nachrichten', 'b1-news-gehoert', 'b1-news-interessiert'], wordIds: [], competencies: ['b1.news'], prerequisites: ['b1.u1'] },
      ] },
      { id: 'b1.m3', level: 'B1', title: 'Problemas e apresentações', description: 'Explicar e apresentar.', units: [
        { id: 'b1.u5', title: 'Explicar problemas', phraseIds: ['b1-problem-und-zwar', 'b1-problem-helfen', 'b1-problem-folgendes'], wordIds: [], competencies: ['b1.explain_problem'], prerequisites: ['b1.u1'] },
        { id: 'b1.u6', title: 'Apresentações', phraseIds: ['b1-present-thema', 'b1-present-punkten', 'b1-present-fragen'], wordIds: [], competencies: ['b1.present'], prerequisites: ['b1.u2'] },
      ] },
      { id: 'b1.m4', level: 'B1', title: 'Vida cotidiana', description: 'Resolver a vida em alemão.', units: [
        { id: 'b1.u7', title: 'Vida cotidiana', phraseIds: ['b1-daily-erledigt', 'b1-daily-termin', 'b1-daily-passt'], wordIds: [], competencies: ['b1.live_daily'], prerequisites: ['b1.u3', 'b1.u5'] },
      ] },
    ],
  },
  {
    id: 'B2', label: 'B2', cefr: 'B2', emoji: '🟠',
    objective: 'Fluência funcional.',
    germanPercentage: 95,
    competencies: ['b2.narrative', 'b2.cause_effect', 'b2.argue', 'b2.compare', 'b2.problems_solutions', 'b2.work_pro', 'b2.defend', 'b2.fluent'],
    grammar: ['g.b2.konjunktiv', 'g.b2.passiv', 'g.b2.connectors'],
    realWorldScenario: 'Negociação',
    modules: [
      { id: 'b2.m1', level: 'B2', title: 'Narrativa e causalidade', description: 'Experiências, causas e consequências.', units: [
        { id: 'b2.u1', title: 'Narrar experiências', phraseIds: ['b2-narrative-erfahrung', 'b2-narrative-damals', 'b2-narrative-rueckblick'], wordIds: [], competencies: ['b2.narrative'], prerequisites: [] },
        { id: 'b2.u2', title: 'Causas e consequências', phraseIds: ['b2-cause-dadurch', 'b2-cause-waere', 'b2-cause-folglich'], wordIds: [], competencies: ['b2.cause_effect'], prerequisites: ['b2.u1'] },
      ] },
      { id: 'b2.m2', level: 'B2', title: 'Argumentação e comparação', description: 'Opinião, contraste e avaliação.', units: [
        { id: 'b2.u3', title: 'Opinião e argumentação', phraseIds: ['b2-argue-auffassung', 'b2-argue-dagegen', 'b2-argue-laesst'], wordIds: [], competencies: ['b2.argue'], prerequisites: ['b2.u2'] },
        { id: 'b2.u4', title: 'Comparar opções', phraseIds: ['b2-compare-optionen', 'b2-compare-vorteile', 'b2-compare-abwaegen'], wordIds: [], competencies: ['b2.compare'], prerequisites: ['b2.u3'] },
      ] },
      { id: 'b2.m3', level: 'B2', title: 'Soluções e trabalho', description: 'Problemas, soluções e temas profissionais.', units: [
        { id: 'b2.u5', title: 'Problemas e soluções', phraseIds: ['b2-solve-problem', 'b2-solve-vorschlag', 'b2-solve-schritt'], wordIds: [], competencies: ['b2.problems_solutions'], prerequisites: ['b2.u2'] },
        { id: 'b2.u6', title: 'Profissional e cotidiano', phraseIds: ['b2-work-optionen', 'b2-work-kompromiss', 'b2-work-verhandelbar'], wordIds: [], competencies: ['b2.work_pro'], prerequisites: ['b2.u3'] },
      ] },
      { id: 'b2.m4', level: 'B2', title: 'Defesa e espontaneidade', description: 'Justificar posições e conversar com autonomia.', units: [
        { id: 'b2.u7', title: 'Defender posições', phraseIds: ['b2-defend-entscheidung', 'b2-defend-widersprechen', 'b2-defend-halten'], wordIds: [], competencies: ['b2.defend'], prerequisites: ['b2.u4'] },
        { id: 'b2.u8', title: 'Conversação espontânea', phraseIds: ['b2-fluent-ehrlich', 'b2-fluent-hoere', 'b2-fluent-sinn'], wordIds: [], competencies: ['b2.fluent'], prerequisites: ['b2.u6', 'b2.u7'] },
      ] },
    ],
  },
  {
    id: 'C1', label: 'C1', cefr: 'C1', emoji: '🔴',
    objective: 'Comunicação avançada e independente.',
    germanPercentage: 100,
    competencies: ['c1.nuance', 'c1.argue', 'c1.debate', 'c1.hypothesis', 'c1.register', 'c1.abstract', 'c1.negotiate', 'c1.spontaneous'],
    grammar: ['g.c1.nominal', 'g.c1.partizip'],
    realWorldScenario: 'Debate e negociação',
    modules: [
      { id: 'c1.m1', level: 'C1', title: 'Nuance e argumentação', description: 'Reformulação e argumentos complexos.', units: [
        { id: 'c1.u1', title: 'Nuance e reformulação', phraseIds: ['c1-nuance-perspektive', 'c1-nuance-anders', 'c1-nuance-nuance'], wordIds: [], competencies: ['c1.nuance'], prerequisites: [] },
        { id: 'c1.u2', title: 'Argumentação complexa', phraseIds: ['c1-argue-zwar', 'c1-argue-grundlage', 'c1-argue-folgerung'], wordIds: [], competencies: ['c1.argue'], prerequisites: ['c1.u1'] },
      ] },
      { id: 'c1.m2', level: 'C1', title: 'Debate e hipóteses', description: 'Contra-argumentação e cenários.', units: [
        { id: 'c1.u3', title: 'Debate e contra-argumentação', phraseIds: ['c1-debate-einwand', 'c1-debate-entkraeftet', 'c1-debate-differenzieren'], wordIds: [], competencies: ['c1.debate'], prerequisites: ['c1.u2'] },
        { id: 'c1.u4', title: 'Hipóteses e cenários', phraseIds: ['c1-hyp-angenommen', 'c1-hyp-waere', 'c1-hyp-szenario'], wordIds: [], competencies: ['c1.hypothesis'], prerequisites: ['c1.u2'] },
      ] },
      { id: 'c1.m3', level: 'C1', title: 'Registro e abstração', description: 'Comunicação profissional e temas sociais.', units: [
        { id: 'c1.u5', title: 'Registro e comunicação profissional', phraseIds: ['c1-reg-formal', 'c1-reg-informal', 'c1-reg-neutral'], wordIds: [], competencies: ['c1.register'], prerequisites: ['c1.u1'] },
        { id: 'c1.u6', title: 'Temas abstratos e sociais', phraseIds: ['c1-abs-gesellschaft', 'c1-abs-verantwortung', 'c1-abs-spannung'], wordIds: [], competencies: ['c1.abstract'], prerequisites: ['c1.u3', 'c1.u4'] },
      ] },
      { id: 'c1.m4', level: 'C1', title: 'Negociação e espontaneidade', description: 'Conflitos e discurso avançado.', units: [
        { id: 'c1.u7', title: 'Negociação e resolução de conflitos', phraseIds: ['c1-neg-interesse', 'c1-neg-kompromiss', 'c1-neg-entspannen'], wordIds: [], competencies: ['c1.negotiate'], prerequisites: ['c1.u5', 'c1.u3'] },
        { id: 'c1.u8', title: 'Conversação avançada espontânea', phraseIds: ['c1-spon-ehrlich', 'c1-spon-anschluss', 'c1-spon-fazit'], wordIds: [], competencies: ['c1.spontaneous'], prerequisites: ['c1.u6', 'c1.u7'] },
      ] },
    ],
  },
  {
    id: 'C2', label: 'C2', cefr: 'C2', emoji: '⚫',
    objective: 'Domínio pleno com nuance, inferência e persuasão.',
    germanPercentage: 100,
    competencies: ['c2.nuance', 'c2.argue', 'c2.discourse', 'c2.inference', 'c2.register', 'c2.mediate', 'c2.critical', 'c2.fluent'],
    grammar: ['g.c2.register'],
    realWorldScenario: 'Debate complexo e mediação',
    modules: [
      { id: 'c2.m1', level: 'C2', title: 'Nuance e argumentação', description: 'Precisão semântica e argumentos sofisticados.', units: [
        { id: 'c2.u1', title: 'Nuance extrema e precisão', phraseIds: ['c2-nuance-ambivalent', 'c2-nuance-nuancenreich', 'c2-nuance-praezise'], wordIds: [], competencies: ['c2.nuance'], prerequisites: [] },
        { id: 'c2.u2', title: 'Argumentação sofisticada', phraseIds: ['c2-argue-vorbehalt', 'c2-argue-mehrschichtig', 'c2-argue-zugestaendnis'], wordIds: [], competencies: ['c2.argue'], prerequisites: ['c2.u1'] },
      ] },
      { id: 'c2.m2', level: 'C2', title: 'Discurso e interpretação', description: 'Sustentação de ideias e inferência.', units: [
        { id: 'c2.u3', title: 'Discurso estruturado', phraseIds: ['c2-disc-aufbau', 'c2-disc-roterfaden', 'c2-disc-schluss'], wordIds: [], competencies: ['c2.discourse'], prerequisites: ['c2.u2'] },
        { id: 'c2.u4', title: 'Implicação e interpretação', phraseIds: ['c2-inf-implizit', 'c2-inf-deuten', 'c2-inf-ableiten'], wordIds: [], competencies: ['c2.inference'], prerequisites: ['c2.u1'] },
      ] },
      { id: 'c2.m3', level: 'C2', title: 'Registro e mediação', description: 'Estilo, adequação e persuasão.', units: [
        { id: 'c2.u5', title: 'Registro, estilo e adequação', phraseIds: ['c2-reg-formell', 'c2-reg-umgang', 'c2-reg-wechseln'], wordIds: [], competencies: ['c2.register'], prerequisites: ['c2.u1'] },
        { id: 'c2.u6', title: 'Negociação, mediação e persuasão', phraseIds: ['c2-med-interessen', 'c2-med-bruecke', 'c2-med-persuasion'], wordIds: [], competencies: ['c2.mediate'], prerequisites: ['c2.u2', 'c2.u5'] },
      ] },
      { id: 'c2.m4', level: 'C2', title: 'Crítica e fluência', description: 'Pensamento crítico e comunicação espontânea.', units: [
        { id: 'c2.u7', title: 'Abstração e pensamento crítico', phraseIds: ['c2-crit-begriff', 'c2-crit-widerspruch', 'c2-crit-reflexion'], wordIds: [], competencies: ['c2.critical'], prerequisites: ['c2.u4', 'c2.u3'] },
        { id: 'c2.u8', title: 'Fluência avançada espontânea', phraseIds: ['c2-flu-spontan', 'c2-flu-anpassen', 'c2-flu-abschluss'], wordIds: [], competencies: ['c2.fluent'], prerequisites: ['c2.u6', 'c2.u7'] },
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
