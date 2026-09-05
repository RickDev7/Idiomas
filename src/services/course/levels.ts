/* Definição estática dos níveis do curso (0 → C2) com módulos e situações. */
import type { CourseLevel, CourseLevelId } from './types';

export const COURSE_LEVELS: CourseLevel[] = [
  {
    id: 'L0',
    label: 'Nível 0',
    cefr: 'pré-A1',
    emoji: '🌱',
    objective: 'Pré-A1 completo: interagir, apresentar-se, pedir ajuda e formar primeiras sequências.',
    germanPercentage: 35,
    competencies: [
      'l0.greet',
      'l0.introduce',
      'l0.people',
      'l0.basics',
      'l0.help',
      'l0.needs',
      'l0.world',
      'l0.phrases',
    ],
    grammar: ['g.l0.pronouns', 'g.l0.sein', 'g.l0.haben', 'g.l0.ja_nein'],
    realWorldScenario: 'Conhecer alguém e pedir ajuda',
    modules: [
      {
        id: 'l0.m1',
        level: 'L0',
        title: 'Fundações pré-A1',
        description: 'Contatos, identidade, pessoas e informações básicas.',
        units: [
          { id: 'l0.u1', title: 'Primeiros contatos', phraseIds: [], wordIds: [], competencies: ['l0.greet'], prerequisites: [] },
          { id: 'l0.u2', title: 'Eu sou', phraseIds: [], wordIds: [], competencies: ['l0.introduce'], prerequisites: ['l0.u1'] },
          { id: 'l0.u3', title: 'Pessoas importantes', phraseIds: [], wordIds: [], competencies: ['l0.people'], prerequisites: ['l0.u2'] },
          { id: 'l0.u4', title: 'Números, tempo e informações', phraseIds: [], wordIds: [], competencies: ['l0.basics'], prerequisites: ['l0.u3'] },
        ],
      },
      {
        id: 'l0.m2',
        level: 'L0',
        title: 'Comunicação pré-A1',
        description: 'Ajuda, necessidades, mundo ao redor e primeiras sequências.',
        units: [
          { id: 'l0.u5', title: 'Entender e pedir ajuda', phraseIds: [], wordIds: [], competencies: ['l0.help'], prerequisites: ['l0.u4'] },
          { id: 'l0.u6', title: 'Necessidades básicas', phraseIds: [], wordIds: [], competencies: ['l0.needs'], prerequisites: ['l0.u5'] },
          { id: 'l0.u7', title: 'O mundo ao meu redor', phraseIds: [], wordIds: [], competencies: ['l0.world'], prerequisites: ['l0.u6'] },
          { id: 'l0.u8', title: 'Minhas primeiras frases', phraseIds: [], wordIds: [], competencies: ['l0.phrases'], prerequisites: ['l0.u7'] },
        ],
      },
    ],
  },
  {
    id: 'A1',
    label: 'A1',
    cefr: 'A1',
    emoji: '🟢',
    objective: 'Lidar com situações simples do cotidiano e falar sobre a própria vida.',
    germanPercentage: 55,
    competencies: ['a1.personal', 'a1.family', 'a1.routine', 'a1.shopping', 'a1.ask_info', 'a1.numbers_time', 'a1.help'],
    grammar: [
      'g.a1.verbs_common',
      'g.a1.articles',
      'g.a1.plural',
      'g.a1.negation',
      'g.a1.questions',
      'g.a1.word_order',
      'g.a1.modal',
      'g.a1.accusative',
      'g.a1.possessives',
      'g.a1.separable',
      'g.a1.dative_functional',
      'g.a1.perfekt_intro',
    ],
    realWorldScenario: 'Apresentar-se, comprar e marcar um encontro',
    modules: [
      { id: 'a1.m1', level: 'A1', title: 'Eu e as pessoas próximas', description: 'Apresentação pessoal e família.', units: [
        { id: 'a1.u1', title: 'Apresentação e identidade', phraseIds: [
          'a1-personal-heisse', 'a1-personal-komme', 'a1-personal-wohne', 'a1-personal-alter',
          'a1-personal-sprache', 'a1-personal-beruf', 'a1-personal-gern', 'a1-personal-frage-woher',
        ], wordIds: [], competencies: ['a1.personal'], prerequisites: [] },
        { id: 'a1.u2', title: 'Família e pessoas', phraseIds: [
          'a1-family-mutter', 'a1-family-bruder', 'a1-family-schwester', 'a1-family-eltern',
          'a1-family-kinder', 'a1-family-freund', 'a1-family-frage',
        ], wordIds: [], competencies: ['a1.family'], prerequisites: ['a1.u1'] },
      ] },
      { id: 'a1.m2', level: 'A1', title: 'Rotina e trabalho', description: 'Dia a dia, horários e verbos no presente.', units: [
        { id: 'a1.u3', title: 'Rotina, trabalho e dia a dia', phraseIds: [
          'a1-routine-aufstehen', 'a1-routine-fruehstueck', 'a1-routine-arbeit', 'a1-routine-pause',
          'a1-routine-kochen', 'a1-routine-schlafen', 'a1-routine-jeden-tag', 'a1-routine-frage-tag',
        ], wordIds: [], competencies: ['a1.routine'], prerequisites: ['a1.u2'] },
      ] },
      { id: 'a1.m3', level: 'A1', title: 'Compras e alimentação', description: 'Supermercado, padaria, café e restaurante.', units: [
        { id: 'a1.u4', title: 'Compras, restaurante e comida', phraseIds: [
          'a1-shopping-kostet', 'a1-shopping-wie-viel', 'a1-shopping-haben', 'a1-shopping-nehme',
          'a1-shopping-moechte', 'a1-shopping-haette', 'a1-food-kaffee', 'a1-food-wasser',
          'a1-food-rechnung', 'a1-food-speisekarte',
        ], wordIds: [], competencies: ['a1.shopping'], prerequisites: ['a1.u3'] },
      ] },
      { id: 'a1.m4', level: 'A1', title: 'Cidade, tempo e situações', description: 'Orientação, compromissos e diálogos do cotidiano.', units: [
        { id: 'a1.u5', title: 'Cidade, transporte e orientação', phraseIds: [
          'a1-info-bahnhof', 'a1-info-hotel', 'a1-info-bus', 'a1-info-suche',
          'a1-info-arzt', 'a1-info-links', 'a1-info-weit', 'a1-info-mit-bus',
        ], wordIds: [], competencies: ['a1.ask_info'], prerequisites: ['a1.u4'] },
        { id: 'a1.u6', title: 'Tempo, compromissos e planos', phraseIds: [
          'a1-time-drei-uhr', 'a1-time-montag', 'a1-time-freitag', 'a1-time-wann',
          'a1-time-treffen', 'a1-time-morgen', 'a1-time-wochenende', 'a1-time-mit-freunden',
        ], wordIds: [], competencies: ['a1.numbers_time'], prerequisites: ['a1.u5'] },
        { id: 'a1.u7', title: 'Situações cotidianas', phraseIds: [
          'a1-help-koennen', 'a1-help-brauche', 'a1-help-wiederholen', 'a1-everyday-einladung',
          'a1-everyday-ablehnen', 'a1-everyday-problem', 'a1-everyday-bei-arbeit',
          'a1-everyday-perfekt-wochenende', 'a1-everyday-perfekt-essen',
        ], wordIds: [], competencies: ['a1.help'], prerequisites: ['a1.u6'] },
      ] },
    ],
  },
  {
    id: 'A2',
    label: 'A2',
    cefr: 'A2',
    emoji: '🔵',
    objective: 'Consigo me virar com mais independência em situações previsíveis, explicar experiências, resolver problemas comuns e sustentar conversas cotidianas.',
    germanPercentage: 75,
    competencies: ['a2.past', 'a2.plans', 'a2.problem', 'a2.phone', 'a2.travel', 'a2.opinion'],
    grammar: [
      'g.a2.perfekt', 'g.a2.praeteritum', 'g.a2.dative', 'g.a2.wechselprep',
      'g.a2.comparatives', 'g.a2.subordinate', 'g.a2.reflexive', 'g.a2.separable', 'g.a2.polite',
    ],
    realWorldScenario: 'Resolver um imprevisto cotidiano com autonomia',
    modules: [
      { id: 'a2.m1', level: 'A2', title: 'Experiências e moradia', description: 'Contar o passado e descrever onde se mora.', units: [
        { id: 'a2.u1', title: 'Experiências e passado', phraseIds: [
          'a2-past-gearbeitet', 'a2-past-kino', 'a2-past-gemacht', 'a2-past-wochenende',
          'a2-past-besucht', 'a2-past-gegessen', 'a2-past-gewesen', 'a2-past-passiert', 'a2-past-erzaehlen',
        ], wordIds: [], competencies: ['a2.past'], prerequisites: [] },
        { id: 'a2.u2', title: 'Casa, moradia e bairro', phraseIds: [
          'a2-home-wohne', 'a2-home-zimmer', 'a2-home-kueche', 'a2-problem-wohnung',
          'a2-home-nachbarn', 'a2-home-naehe', 'a2-home-miete', 'a2-home-heizung', 'a2-home-hilfe',
        ], wordIds: [], competencies: ['a2.plans'], prerequisites: ['a2.u1'] },
      ] },
      { id: 'a2.m2', level: 'A2', title: 'Saúde e trabalho', description: 'Sintomas, ajuda e vida profissional.', units: [
        { id: 'a2.u3', title: 'Saúde e bem-estar', phraseIds: [
          'a2-problem-nicht-gut', 'a2-problem-mit', 'a2-health-kopfschmerzen', 'a2-health-schmerz',
          'a2-health-apotheke', 'a2-health-termin', 'a2-health-medikament', 'a2-health-ruhen', 'a2-health-fieber',
        ], wordIds: [], competencies: ['a2.problem'], prerequisites: ['a2.u2'] },
        { id: 'a2.u4', title: 'Trabalho e vida profissional', phraseIds: [
          'a2-phone-hier-ist', 'a2-phone-nachricht', 'a2-phone-spaeter', 'a2-work-aufgabe',
          'a2-work-spaet', 'a2-work-erklaeren', 'a2-work-kollegen', 'a2-work-schwierig', 'a2-work-termin',
        ], wordIds: [], competencies: ['a2.phone'], prerequisites: ['a2.u3'] },
      ] },
      { id: 'a2.m3', level: 'A2', title: 'Viagem, compras e relações', description: 'Deslocamento, serviços, opinião e planos.', units: [
        { id: 'a2.u5', title: 'Viagem, serviços e deslocamento', phraseIds: [
          'a2-travel-berlin', 'a2-travel-reise', 'a2-travel-uebernachten', 'a2-travel-hotel',
          'a2-travel-zug', 'a2-travel-verspaetet', 'a2-travel-fahrkarte', 'a2-travel-weg', 'a2-travel-beschwerde',
        ], wordIds: [], competencies: ['a2.travel'], prerequisites: ['a2.u4'] },
        { id: 'a2.u6', title: 'Compras, lazer, planos e imprevistos', phraseIds: [
          'a2-opinion-finde', 'a2-opinion-meinung', 'a2-opinion-lieber',
          'a2-plans-werde', 'a2-plans-plane', 'a2-plans-reisen',
          'a2-shop-defekt', 'a2-shop-umtauschen', 'a2-shop-guenstiger',
          'a2-invite-kommen', 'a2-invite-leider', 'a2-invite-helfen',
        ], wordIds: [], competencies: ['a2.opinion'], prerequisites: ['a2.u5'] },
      ] },
    ],
  },
  // ---- Esqueletos B1–C2 (arquitetura pronta, conteúdo a expandir) ----
  {
    id: 'B1', label: 'B1', cefr: 'B1', emoji: '🟡',
    objective: 'Consigo me comunicar com autonomia em situações familiares, explicar opiniões, justificar decisões, relatar experiências e resolver situações menos previsíveis.',
    germanPercentage: 88,
    competencies: ['b1.story', 'b1.opinion_justify', 'b1.work_social', 'b1.news', 'b1.explain_problem', 'b1.present', 'b1.live_daily'],
    grammar: [
      'g.b1.narrative', 'g.b1.connectors', 'g.b1.relative', 'g.b1.konjunktiv2',
      'g.b1.prep_verbs', 'g.b1.infinitiv_zu', 'g.b1.passiv', 'g.b1.ndekl',
    ],
    realWorldScenario: 'Resolver um problema e justificar uma decisão',
    modules: [
      { id: 'b1.m1', level: 'B1', title: 'Experiências e opiniões', description: 'Narrar mudanças e justificar escolhas.', units: [
        { id: 'b1.u1', title: 'História pessoal e experiências', phraseIds: [
          'b1-story-muenchen', 'b1-story-geklappt', 'b1-story-weil', 'b1-story-reise',
          'b1-story-entscheidung', 'b1-story-vorher', 'b1-story-danach', 'b1-story-ziel',
        ], wordIds: [], competencies: ['b1.story'], prerequisites: [] },
        { id: 'b1.u2', title: 'Opiniões, relações e planos', phraseIds: [
          'b1-opinion-meinung', 'b1-opinion-deshalb', 'b1-opinion-seiten', 'b1-opinion-stimme-zu',
          'b1-opinion-anders', 'b1-opinion-vorschlagen', 'b1-opinion-vergleichen',
          'b1-opinion-entscheiden', 'b1-opinion-planen',
        ], wordIds: [], competencies: ['b1.opinion_justify'], prerequisites: ['b1.u1'] },
      ] },
      { id: 'b1.m2', level: 'B1', title: 'Trabalho e cultura', description: 'Vida profissional, mídia e viagem.', units: [
        { id: 'b1.u3', title: 'Trabalho e vida profissional', phraseIds: [
          'b1-work-wochenende', 'b1-work-besprechen', 'b1-work-schlage', 'b1-work-aufgaben',
          'b1-work-erfahrung', 'b1-work-schwierigkeit', 'b1-work-loesung', 'b1-work-karriere',
        ], wordIds: [], competencies: ['b1.work_social'], prerequisites: ['b1.u2'] },
        { id: 'b1.u4', title: 'Viagem, cultura e mídia', phraseIds: [
          'b1-news-nachrichten', 'b1-news-gehoert', 'b1-news-interessiert', 'b1-media-empfehlen',
          'b1-media-serie', 'b1-travel-aendern', 'b1-travel-erstattung', 'b1-travel-ort',
        ], wordIds: [], competencies: ['b1.news'], prerequisites: ['b1.u1'] },
      ] },
      { id: 'b1.m3', level: 'B1', title: 'Serviços e carreira', description: 'Moradia, serviços e apresentações.', units: [
        { id: 'b1.u5', title: 'Moradia, comunidade e serviços', phraseIds: [
          'b1-problem-und-zwar', 'b1-problem-helfen', 'b1-problem-folgendes', 'b1-home-suche',
          'b1-home-defekt', 'b1-home-vermieter', 'b1-home-beschwerde', 'b1-home-frist',
        ], wordIds: [], competencies: ['b1.explain_problem'], prerequisites: ['b1.u1'] },
        { id: 'b1.u6', title: 'Apresentação profissional', phraseIds: [
          'b1-present-thema', 'b1-present-punkten', 'b1-present-fragen', 'b1-present-ausbildung',
          'b1-present-staerken', 'b1-present-wahl', 'b1-present-zusammen', 'b1-present-naechste',
        ], wordIds: [], competencies: ['b1.present'], prerequisites: ['b1.u3'] },
      ] },
      { id: 'b1.m4', level: 'B1', title: 'Saúde e autonomia', description: 'Bem-estar e situações práticas.', units: [
        { id: 'b1.u7', title: 'Saúde, bem-estar e situações práticas', phraseIds: [
          'b1-daily-erledigt', 'b1-daily-termin', 'b1-daily-passt', 'b1-health-symptome',
          'b1-health-versicherung', 'b1-health-empfehlung', 'b1-daily-unvorhergesehen', 'b1-daily-hilfe-bitten',
        ], wordIds: [], competencies: ['b1.live_daily'], prerequisites: ['b1.u3', 'b1.u5'] },
      ] },
    ],
  },
  {
    id: 'B2', label: 'B2', cefr: 'B2', emoji: '🟠',
    objective: 'Consigo me expressar com fluência e precisão em situações sociais, profissionais e acadêmicas familiares; defender pontos de vista, negociar, explicar vantagens e desvantagens e participar de discussões estruturadas.',
    germanPercentage: 95,
    competencies: ['b2.narrative', 'b2.cause_effect', 'b2.argue', 'b2.compare', 'b2.problems_solutions', 'b2.work_pro', 'b2.defend', 'b2.fluent'],
    grammar: [
      'g.b2.connectors', 'g.b2.subordinate', 'g.b2.konjunktiv', 'g.b2.passiv',
      'g.b2.relative', 'g.b2.prep_verbs', 'g.b2.register', 'g.b2.indirect',
    ],
    realWorldScenario: 'Negociação e discussão estruturada',
    modules: [
      { id: 'b2.m1', level: 'B2', title: 'Cultura e sociedade', description: 'Identidade, causas e temas contemporâneos.', units: [
        { id: 'b2.u1', title: 'Cultura, viagem e identidade', phraseIds: [
          'b2-narrative-erfahrung', 'b2-narrative-damals', 'b2-narrative-rueckblick',
          'b2-culture-empfehlen', 'b2-culture-gewohnheiten', 'b2-culture-anpassung', 'b2-culture-identitaet',
        ], wordIds: [], competencies: ['b2.narrative'], prerequisites: [] },
        { id: 'b2.u2', title: 'Sociedade, tecnologia e mídia', phraseIds: [
          'b2-cause-dadurch', 'b2-cause-waere', 'b2-cause-folglich',
          'b2-society-technik', 'b2-society-medien', 'b2-society-datenschutz', 'b2-society-bildung',
        ], wordIds: [], competencies: ['b2.cause_effect'], prerequisites: ['b2.u1'] },
      ] },
      { id: 'b2.m2', level: 'B2', title: 'Argumentação e comparação', description: 'Posição, contraponto e decisão.', units: [
        { id: 'b2.u3', title: 'Argumentação e tomada de posição', phraseIds: [
          'b2-argue-auffassung', 'b2-argue-dagegen', 'b2-argue-laesst',
          'b2-argue-beispiel', 'b2-argue-schluss', 'b2-argue-einwand', 'b2-argue-konsens',
        ], wordIds: [], competencies: ['b2.argue'], prerequisites: ['b2.u2'] },
        { id: 'b2.u4', title: 'Comparar opções e decidir', phraseIds: [
          'b2-compare-optionen', 'b2-compare-vorteile', 'b2-compare-abwaegen',
          'b2-compare-nachteile', 'b2-compare-folgen', 'b2-compare-entscheiden', 'b2-compare-begruenden',
        ], wordIds: [], competencies: ['b2.compare'], prerequisites: ['b2.u3'] },
      ] },
      { id: 'b2.m3', level: 'B2', title: 'Serviços e trabalho', description: 'Situações complexas e comunicação profissional.', units: [
        { id: 'b2.u5', title: 'Serviços, cidadania e soluções', phraseIds: [
          'b2-solve-problem', 'b2-solve-vorschlag', 'b2-solve-schritt',
          'b2-service-vertrag', 'b2-service-versicherung', 'b2-service-beschwerde', 'b2-service-bedingungen',
        ], wordIds: [], competencies: ['b2.problems_solutions'], prerequisites: ['b2.u2'] },
        { id: 'b2.u6', title: 'Trabalho e comunicação profissional', phraseIds: [
          'b2-work-optionen', 'b2-work-kompromiss', 'b2-work-verhandelbar',
          'b2-work-praesentation', 'b2-work-feedback', 'b2-work-frist', 'b2-work-prozess',
        ], wordIds: [], competencies: ['b2.work_pro'], prerequisites: ['b2.u3'] },
      ] },
      { id: 'b2.m4', level: 'B2', title: 'Negociação e integração', description: 'Conflitos, defesa e discussão longa.', units: [
        { id: 'b2.u7', title: 'Relações, conflitos e negociação', phraseIds: [
          'b2-defend-entscheidung', 'b2-defend-widersprechen', 'b2-defend-halten',
          'b2-conflict-missverstaendnis', 'b2-conflict-ablehnen', 'b2-conflict-zuhoeren', 'b2-conflict-ausweg',
        ], wordIds: [], competencies: ['b2.defend'], prerequisites: ['b2.u4'] },
        { id: 'b2.u8', title: 'Apresentação, discussão e integração', phraseIds: [
          'b2-fluent-ehrlich', 'b2-fluent-hoere', 'b2-fluent-sinn',
          'b2-fluent-register', 'b2-fluent-diskussion', 'b2-fluent-zusammen', 'b2-fluent-reaktion',
        ], wordIds: [], competencies: ['b2.fluent'], prerequisites: ['b2.u6', 'b2.u7'] },
      ] },
    ],
  },
  {
    id: 'C1', label: 'C1', cefr: 'C1', emoji: '🔴',
    objective: 'Consigo me expressar com fluência, precisão, flexibilidade e nuance em contextos sociais, profissionais e acadêmicos complexos.',
    germanPercentage: 100,
    competencies: ['c1.nuance', 'c1.argue', 'c1.debate', 'c1.hypothesis', 'c1.register', 'c1.abstract', 'c1.negotiate', 'c1.spontaneous'],
    grammar: [
      'g.c1.connectors', 'g.c1.concession', 'g.c1.konjunktiv', 'g.c1.indirect',
      'g.c1.passiv', 'g.c1.nominal', 'g.c1.partizip', 'g.c1.register',
    ],
    realWorldScenario: 'Debate, síntese e negociação avançada',
    modules: [
      { id: 'c1.m1', level: 'C1', title: 'Nuance e argumentação', description: 'Cultura, reformulação e argumentos complexos.', units: [
        { id: 'c1.u1', title: 'Nuance, cultura e mídia', phraseIds: [
          'c1-nuance-perspektive', 'c1-nuance-anders', 'c1-nuance-nuance',
          'c1-culture-werk', 'c1-culture-medien', 'c1-culture-interkulturell', 'c1-culture-alternative',
        ], wordIds: [], competencies: ['c1.nuance'], prerequisites: [] },
        { id: 'c1.u2', title: 'Argumentação avançada', phraseIds: [
          'c1-argue-zwar', 'c1-argue-grundlage', 'c1-argue-folgerung',
          'c1-argue-vorbehalt', 'c1-argue-teilweise', 'c1-argue-beispiel', 'c1-argue-schluss',
        ], wordIds: [], competencies: ['c1.argue'], prerequisites: ['c1.u1'] },
      ] },
      { id: 'c1.m2', level: 'C1', title: 'Debate e síntese', description: 'Contraponto, hipóteses e análise.', units: [
        { id: 'c1.u3', title: 'Debate e contra-argumentação', phraseIds: [
          'c1-debate-einwand', 'c1-debate-entkraeftet', 'c1-debate-differenzieren',
          'c1-debate-zugeben', 'c1-debate-umkehren', 'c1-debate-konsens', 'c1-debate-grenze',
        ], wordIds: [], competencies: ['c1.debate'], prerequisites: ['c1.u2'] },
        { id: 'c1.u4', title: 'Acadêmico, pesquisa e síntese', phraseIds: [
          'c1-hyp-angenommen', 'c1-hyp-waere', 'c1-hyp-szenario',
          'c1-acad-daten', 'c1-acad-zusammenfassen', 'c1-acad-unterscheiden', 'c1-acad-quellen',
        ], wordIds: [], competencies: ['c1.hypothesis'], prerequisites: ['c1.u2'] },
      ] },
      { id: 'c1.m3', level: 'C1', title: 'Profissional e sociedade', description: 'Liderança, registro e ética.', units: [
        { id: 'c1.u5', title: 'Comunicação profissional e liderança', phraseIds: [
          'c1-reg-formal', 'c1-reg-informal', 'c1-reg-neutral',
          'c1-pro-praesentation', 'c1-pro-feedback', 'c1-pro-prioritaeten', 'c1-pro-risiko',
        ], wordIds: [], competencies: ['c1.register'], prerequisites: ['c1.u1'] },
        { id: 'c1.u6', title: 'Sociedade, ética e temas abstratos', phraseIds: [
          'c1-abs-gesellschaft', 'c1-abs-verantwortung', 'c1-abs-spannung',
          'c1-abs-nachhaltigkeit', 'c1-abs-ungleichheit', 'c1-abs-automation', 'c1-abs-vorschlag',
        ], wordIds: [], competencies: ['c1.abstract'], prerequisites: ['c1.u3', 'c1.u4'] },
      ] },
      { id: 'c1.m4', level: 'C1', title: 'Crise e integração', description: 'Mediação e discussão longa.', units: [
        { id: 'c1.u7', title: 'Situações complexas, crise e mediação', phraseIds: [
          'c1-neg-interesse', 'c1-neg-kompromiss', 'c1-neg-entspannen',
          'c1-crisis-vertrag', 'c1-crisis-dringlichkeit', 'c1-crisis-mediation', 'c1-crisis-naechste',
        ], wordIds: [], competencies: ['c1.negotiate'], prerequisites: ['c1.u5', 'c1.u3'] },
        { id: 'c1.u8', title: 'Integração, apresentação e discussão', phraseIds: [
          'c1-spon-ehrlich', 'c1-spon-anschluss', 'c1-spon-fazit',
          'c1-int-praesentation', 'c1-int-register', 'c1-int-reaktion', 'c1-int-diskussion',
        ], wordIds: [], competencies: ['c1.spontaneous'], prerequisites: ['c1.u6', 'c1.u7'] },
      ] },
    ],
  },
  {
    id: 'C2', label: 'C2', cefr: 'C2', emoji: '⚫',
    objective: 'Consigo compreender, sintetizar e produzir comunicação altamente flexível, espontânea, precisa e adequada em contextos complexos, abstratos, profissionais e acadêmicos.',
    germanPercentage: 100,
    competencies: ['c2.nuance', 'c2.argue', 'c2.discourse', 'c2.inference', 'c2.register', 'c2.mediate', 'c2.critical', 'c2.fluent'],
    grammar: [
      'g.c2.connectors', 'g.c2.concession', 'g.c2.konjunktiv', 'g.c2.indirect',
      'g.c2.passiv', 'g.c2.nominal', 'g.c2.relative', 'g.c2.register',
    ],
    realWorldScenario: 'Mediação, síntese e discussão de alto impacto',
    modules: [
      { id: 'c2.m1', level: 'C2', title: 'Cultura e argumentação', description: 'Nuance cultural e retórica sofisticada.', units: [
        { id: 'c2.u1', title: 'Cultura, identidade, mídia e nuance', phraseIds: [
          'c2-nuance-ambivalent', 'c2-nuance-nuancenreich', 'c2-nuance-praezise',
          'c2-culture-werk', 'c2-culture-medien', 'c2-culture-narrativ', 'c2-culture-glaubwuerdigkeit',
        ], wordIds: [], competencies: ['c2.nuance'], prerequisites: [] },
        { id: 'c2.u2', title: 'Argumentação sofisticada e retórica', phraseIds: [
          'c2-argue-vorbehalt', 'c2-argue-mehrschichtig', 'c2-argue-zugestaendnis',
          'c2-argue-these', 'c2-argue-evidenz', 'c2-argue-folge', 'c2-argue-schluss',
        ], wordIds: [], competencies: ['c2.argue'], prerequisites: ['c2.u1'] },
      ] },
      { id: 'c2.m2', level: 'C2', title: 'Discurso e síntese', description: 'Estrutura discursiva e análise de informação.', units: [
        { id: 'c2.u3', title: 'Discurso estruturado e dilemas', phraseIds: [
          'c2-disc-aufbau', 'c2-disc-roterfaden', 'c2-disc-schluss',
          'c2-disc-reformulieren', 'c2-disc-grad', 'c2-disc-dilemma', 'c2-disc-moderieren',
        ], wordIds: [], competencies: ['c2.discourse'], prerequisites: ['c2.u2'] },
        { id: 'c2.u4', title: 'Síntese acadêmica e análise', phraseIds: [
          'c2-inf-implizit', 'c2-inf-deuten', 'c2-inf-ableiten',
          'c2-acad-quellen', 'c2-acad-methode', 'c2-acad-limitation', 'c2-acad-synthese',
        ], wordIds: [], competencies: ['c2.inference'], prerequisites: ['c2.u1'] },
      ] },
      { id: 'c2.m3', level: 'C2', title: 'Registro e liderança', description: 'Estilo, decisão e mediação sob pressão.', units: [
        { id: 'c2.u5', title: 'Registro, estilo e adequação', phraseIds: [
          'c2-reg-formell', 'c2-reg-umgang', 'c2-reg-wechseln',
          'c2-reg-akademisch', 'c2-reg-fuehrung', 'c2-reg-diplomatie', 'c2-reg-klarheit',
        ], wordIds: [], competencies: ['c2.register'], prerequisites: ['c2.u1'] },
        { id: 'c2.u6', title: 'Liderança, negociação e crise', phraseIds: [
          'c2-med-interessen', 'c2-med-bruecke', 'c2-med-persuasion',
          'c2-crisis-entscheidung', 'c2-crisis-risiko', 'c2-crisis-vertrag', 'c2-crisis-naechste',
        ], wordIds: [], competencies: ['c2.mediate'], prerequisites: ['c2.u2', 'c2.u5'] },
      ] },
      { id: 'c2.m4', level: 'C2', title: 'Ética e integração', description: 'Temas abstratos e discussão terminal.', units: [
        { id: 'c2.u7', title: 'Sociedade, ética e temas abstratos', phraseIds: [
          'c2-crit-begriff', 'c2-crit-widerspruch', 'c2-crit-reflexion',
          'c2-ethik-technik', 'c2-ethik-nachhaltigkeit', 'c2-ethik-ungleichheit', 'c2-ethik-unsicherheit',
        ], wordIds: [], competencies: ['c2.critical'], prerequisites: ['c2.u4', 'c2.u3'] },
        { id: 'c2.u8', title: 'Integração C2 — apresentação e discussão', phraseIds: [
          'c2-flu-spontan', 'c2-flu-anpassen', 'c2-flu-abschluss',
          'c2-int-praesentation', 'c2-int-mediation', 'c2-int-reaktion', 'c2-int-diskussion',
        ], wordIds: [], competencies: ['c2.fluent'], prerequisites: ['c2.u6', 'c2.u7'] },
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
