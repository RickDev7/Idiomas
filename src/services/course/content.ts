/* Conteúdo curado (núcleo) por competência + mapeamento competência→categoria
   do pool de frases existente. O núcleo é a referência canônica do que o aluno
   deve dominar; a categoria permite ao CourseEngine filtrar o pool existente. */
import type { CourseLevelId } from './types';

export interface CuratedPhrase {
  german: string;
  portuguese: string;
  /** ID estável do target (obrigatório em A1+ executável). */
  id?: string;
  /** Unidade curricular dona deste target. */
  unitId?: string;
  /** Ordem dentro da competência/unidade. */
  order?: number;
  /** Categoria pedagógica opcional (ex.: statement, question). */
  type?: string;
}

export interface CompetencyContent {
  competencyId: string;
  level: CourseLevelId;
  /** categorias do pool de frases existente (content.ts) relacionadas */
  categories: string[];
  /** núcleo canônico de frases que o aluno deve dominar nesta competência */
  core: CuratedPhrase[];
}

export const CURATED: CompetencyContent[] = [
  // ---------------- Nível 0 ----------------
  { competencyId: 'l0.greet', level: 'L0', categories: ['greetings'], core: [
    { german: 'Hallo!', portuguese: 'Olá!' },
    { german: 'Guten Morgen.', portuguese: 'Bom dia.' },
    { german: 'Guten Tag.', portuguese: 'Boa tarde.' },
    { german: 'Guten Abend.', portuguese: 'Boa noite.' },
    { german: 'Gute Nacht.', portuguese: 'Boa noite (ao dormir).' },
    { german: 'Tschüss!', portuguese: 'Tchau!' },
  ] },
  { competencyId: 'l0.introduce', level: 'L0', categories: ['greetings'], core: [
    { german: 'Ich heiße …', portuguese: 'Eu me chamo …' },
    { german: 'Ich bin …', portuguese: 'Eu sou …' },
    { german: 'Mein Name ist …', portuguese: 'Meu nome é …' },
    { german: 'Wie heißt du?', portuguese: 'Como você se chama?' },
  ] },
  { competencyId: 'l0.basics', level: 'L0', categories: ['daily', 'work'], core: [
    { german: 'Ich wohne in …', portuguese: 'Eu moro em …' },
    { german: 'Ich komme aus …', portuguese: 'Eu venho de …' },
    { german: 'Ich arbeite …', portuguese: 'Eu trabalho …' },
  ] },
  { competencyId: 'l0.yesno', level: 'L0', categories: ['responses'], core: [
    { german: 'Ja.', portuguese: 'Sim.' },
    { german: 'Nein.', portuguese: 'Não.' },
  ] },
  { competencyId: 'l0.thanks', level: 'L0', categories: ['greetings'], core: [
    { german: 'Danke.', portuguese: 'Obrigado.' },
    { german: 'Danke schön.', portuguese: 'Muito obrigado.' },
    { german: 'Bitte.', portuguese: 'Por favor / De nada.' },
  ] },
  { competencyId: 'l0.needs', level: 'L0', categories: ['survival'], core: [
    { german: 'Ich brauche …', portuguese: 'Eu preciso de …' },
    { german: 'Ich möchte …', portuguese: 'Eu gostaria de …' },
    { german: 'Ich habe …', portuguese: 'Eu tenho …' },
  ] },
  { competencyId: 'l0.help', level: 'L0', categories: ['survival'], core: [
    { german: 'Hilfe, bitte!', portuguese: 'Socorro, por favor!' },
    { german: 'Können Sie mir helfen?', portuguese: 'Você pode me ajudar?' },
    { german: 'Ich verstehe nicht.', portuguese: 'Eu não entendo.' },
  ] },
  { competencyId: 'l0.repeat', level: 'L0', categories: ['survival'], core: [
    { german: 'Noch einmal, bitte.', portuguese: 'De novo, por favor.' },
    { german: 'Langsamer, bitte.', portuguese: 'Mais devagar, por favor.' },
  ] },

  // ---------------- A1 ----------------
  { competencyId: 'a1.family', level: 'A1', categories: ['family'], core: [
    { id: 'a1-family-mutter', unitId: 'a1.u1', order: 1, type: 'statement', german: 'Das ist meine Mutter.', portuguese: 'Esta é a minha mãe.' },
    { id: 'a1-family-bruder', unitId: 'a1.u1', order: 2, type: 'statement', german: 'Ich habe einen Bruder.', portuguese: 'Eu tenho um irmão.' },
    { id: 'a1-family-schwester', unitId: 'a1.u1', order: 3, type: 'statement', german: 'Meine Schwester heißt …', portuguese: 'Minha irmã se chama …' },
  ] },
  { competencyId: 'a1.numbers_time', level: 'A1', categories: ['time'], core: [
    { id: 'a1-time-drei-uhr', unitId: 'a1.u2', order: 4, type: 'statement', german: 'Es ist drei Uhr.', portuguese: 'São três horas.' },
    { id: 'a1-time-montag', unitId: 'a1.u2', order: 5, type: 'statement', german: 'Heute ist Montag.', portuguese: 'Hoje é segunda-feira.' },
    { id: 'a1-time-freitag', unitId: 'a1.u2', order: 6, type: 'statement', german: 'Ich habe am Freitag Zeit.', portuguese: 'Tenho tempo na sexta-feira.' },
  ] },
  { competencyId: 'a1.routine', level: 'A1', categories: ['daily'], core: [
    { id: 'a1-routine-aufstehen', unitId: 'a1.u3', order: 7, type: 'statement', german: 'Ich stehe um sieben Uhr auf.', portuguese: 'Eu levanto às sete horas.' },
    { id: 'a1-routine-arbeit', unitId: 'a1.u3', order: 8, type: 'statement', german: 'Ich gehe zur Arbeit.', portuguese: 'Eu vou ao trabalho.' },
    { id: 'a1-routine-kochen', unitId: 'a1.u3', order: 9, type: 'statement', german: 'Am Abend koche ich.', portuguese: 'À noite eu cozinho.' },
  ] },
  { competencyId: 'a1.shopping', level: 'A1', categories: ['shopping'], core: [
    { id: 'a1-shopping-kostet', unitId: 'a1.u4', order: 10, type: 'question', german: 'Was kostet das?', portuguese: 'Quanto custa isso?' },
    { id: 'a1-shopping-nehme', unitId: 'a1.u4', order: 11, type: 'statement', german: 'Ich nehme das.', portuguese: 'Eu fico com isso.' },
    { id: 'a1-shopping-haben', unitId: 'a1.u4', order: 12, type: 'question', german: 'Haben Sie …?', portuguese: 'Você tem …?' },
  ] },
  { competencyId: 'a1.food', level: 'A1', categories: ['food'], core: [
    { id: 'a1-food-kaffee', unitId: 'a1.u5', order: 13, type: 'statement', german: 'Ich möchte einen Kaffee.', portuguese: 'Eu gostaria de um café.' },
    { id: 'a1-food-rechnung', unitId: 'a1.u5', order: 14, type: 'request', german: 'Die Rechnung, bitte.', portuguese: 'A conta, por favor.' },
    { id: 'a1-food-wasser', unitId: 'a1.u5', order: 15, type: 'statement', german: 'Ich nehme ein Wasser.', portuguese: 'Eu pego uma água.' },
  ] },
  { competencyId: 'a1.ask_info', level: 'A1', categories: ['directions', 'transport'], core: [
    { id: 'a1-info-bahnhof', unitId: 'a1.u6', order: 16, type: 'question', german: 'Wo ist der Bahnhof?', portuguese: 'Onde é a estação?' },
    { id: 'a1-info-hotel', unitId: 'a1.u6', order: 17, type: 'question', german: 'Wie komme ich zum Hotel?', portuguese: 'Como chego ao hotel?' },
    { id: 'a1-info-bus', unitId: 'a1.u6', order: 18, type: 'question', german: 'Wann fährt der Bus?', portuguese: 'Quando sai o ônibus?' },
  ] },
  { competencyId: 'a1.help', level: 'A1', categories: ['survival'], core: [
    { id: 'a1-help-koennen', unitId: 'a1.u7', order: 19, type: 'request', german: 'Können Sie mir helfen, bitte?', portuguese: 'Você pode me ajudar, por favor?' },
    { id: 'a1-help-brauche', unitId: 'a1.u7', order: 20, type: 'statement', german: 'Ich brauche Hilfe.', portuguese: 'Eu preciso de ajuda.' },
  ] },

  // ---------------- A2 ----------------
  { competencyId: 'a2.past', level: 'A2', categories: ['daily'], core: [
    { id: 'a2-past-gearbeitet', unitId: 'a2.u1', order: 1, type: 'statement', german: 'Ich habe gestern gearbeitet.', portuguese: 'Eu trabalhei ontem.' },
    { id: 'a2-past-kino', unitId: 'a2.u1', order: 2, type: 'statement', german: 'Wir waren im Kino.', portuguese: 'Fomos ao cinema.' },
    { id: 'a2-past-gemacht', unitId: 'a2.u1', order: 3, type: 'question', german: 'Was hast du gemacht?', portuguese: 'O que você fez?' },
  ] },
  { competencyId: 'a2.plans', level: 'A2', categories: ['daily'], core: [
    { id: 'a2-plans-werde', unitId: 'a2.u2', order: 4, type: 'statement', german: 'Morgen werde ich …', portuguese: 'Amanhã eu vou …' },
    { id: 'a2-plans-plane', unitId: 'a2.u2', order: 5, type: 'statement', german: 'Ich plane, …', portuguese: 'Eu planejo …' },
    { id: 'a2-plans-reisen', unitId: 'a2.u2', order: 6, type: 'statement', german: 'Nächstes Jahr möchte ich reisen.', portuguese: 'No próximo ano quero viajar.' },
  ] },
  { competencyId: 'a2.problem', level: 'A2', categories: ['health', 'work'], core: [
    { id: 'a2-problem-nicht-gut', unitId: 'a2.u3', order: 7, type: 'statement', german: 'Mir geht es nicht gut.', portuguese: 'Não estou me sentindo bem.' },
    { id: 'a2-problem-mit', unitId: 'a2.u3', order: 8, type: 'statement', german: 'Ich habe ein Problem mit …', portuguese: 'Tenho um problema com …' },
    { id: 'a2-problem-wohnung', unitId: 'a2.u3', order: 9, type: 'statement', german: 'Die Wohnung ist zu klein.', portuguese: 'O apartamento é pequeno demais.' },
  ] },
  { competencyId: 'a2.opinion', level: 'A2', categories: ['social'], core: [
    { id: 'a2-opinion-finde', unitId: 'a2.u4', order: 10, type: 'statement', german: 'Ich finde das gut.', portuguese: 'Eu acho isso bom.' },
    { id: 'a2-opinion-meinung', unitId: 'a2.u4', order: 11, type: 'statement', german: 'Meiner Meinung nach …', portuguese: 'Na minha opinião …' },
    { id: 'a2-opinion-lieber', unitId: 'a2.u4', order: 12, type: 'statement', german: 'Ich mag … lieber.', portuguese: 'Eu prefiro …' },
  ] },
  { competencyId: 'a2.travel', level: 'A2', categories: ['travel'], core: [
    { id: 'a2-travel-berlin', unitId: 'a2.u5', order: 13, type: 'statement', german: 'Ich bin nach Berlin gefahren.', portuguese: 'Eu fui para Berlim.' },
    { id: 'a2-travel-reise', unitId: 'a2.u5', order: 14, type: 'statement', german: 'Die Reise war schön.', portuguese: 'A viagem foi boa.' },
    { id: 'a2-travel-uebernachten', unitId: 'a2.u5', order: 15, type: 'question', german: 'Wo übernachten wir?', portuguese: 'Onde vamos dormir?' },
  ] },
  { competencyId: 'a2.phone', level: 'A2', categories: ['phone'], core: [
    { id: 'a2-phone-hier-ist', unitId: 'a2.u6', order: 16, type: 'statement', german: 'Hallo, hier ist …', portuguese: 'Olá, aqui é …' },
    { id: 'a2-phone-nachricht', unitId: 'a2.u6', order: 17, type: 'question', german: 'Kann ich eine Nachricht hinterlassen?', portuguese: 'Posso deixar um recado?' },
    { id: 'a2-phone-spaeter', unitId: 'a2.u6', order: 18, type: 'statement', german: 'Ich rufe später an.', portuguese: 'Eu ligo mais tarde.' },
  ] },

  // ---------------- B1 ----------------
  { competencyId: 'b1.story', level: 'B1', categories: ['daily', 'social'], core: [
    { id: 'b1-story-muenchen', unitId: 'b1.u1', order: 1, type: 'statement', german: 'Letztes Jahr bin ich nach München gezogen.', portuguese: 'No ano passado me mudei para Munique.' },
    { id: 'b1-story-geklappt', unitId: 'b1.u1', order: 2, type: 'statement', german: 'Zuerst war es schwer, aber dann hat es geklappt.', portuguese: 'No começo foi difícil, mas depois deu certo.' },
    { id: 'b1-story-weil', unitId: 'b1.u1', order: 3, type: 'statement', german: 'Das habe ich gemacht, weil …', portuguese: 'Eu fiz isso porque …' },
  ] },
  { competencyId: 'b1.opinion_justify', level: 'B1', categories: ['social'], core: [
    { id: 'b1-opinion-meinung', unitId: 'b1.u2', order: 4, type: 'statement', german: 'Ich bin der Meinung, dass …', portuguese: 'Sou da opinião de que …' },
    { id: 'b1-opinion-deshalb', unitId: 'b1.u2', order: 5, type: 'statement', german: 'Das finde ich deshalb, weil …', portuguese: 'Acho isso porque …' },
    { id: 'b1-opinion-seiten', unitId: 'b1.u2', order: 6, type: 'statement', german: 'Auf der einen Seite …, auf der anderen Seite …', portuguese: 'Por um lado …, por outro …' },
  ] },
  { competencyId: 'b1.work_social', level: 'B1', categories: ['work', 'social'], core: [
    { id: 'b1-work-wochenende', unitId: 'b1.u3', order: 7, type: 'question', german: 'Wie war Ihr Wochenende?', portuguese: 'Como foi o seu fim de semana?' },
    { id: 'b1-work-besprechen', unitId: 'b1.u3', order: 8, type: 'question', german: 'Können wir das besprechen?', portuguese: 'Podemos conversar sobre isso?' },
    { id: 'b1-work-schlage', unitId: 'b1.u3', order: 9, type: 'statement', german: 'Ich schlage vor, dass …', portuguese: 'Sugiro que …' },
  ] },
  { competencyId: 'b1.news', level: 'B1', categories: ['daily'], core: [
    { id: 'b1-news-nachrichten', unitId: 'b1.u4', order: 10, type: 'statement', german: 'In den Nachrichten stand, dass …', portuguese: 'Nas notícias dizia que …' },
    { id: 'b1-news-gehoert', unitId: 'b1.u4', order: 11, type: 'question', german: 'Haben Sie das gehört?', portuguese: 'Você ouviu isso?' },
    { id: 'b1-news-interessiert', unitId: 'b1.u4', order: 12, type: 'statement', german: 'Das interessiert mich.', portuguese: 'Isso me interessa.' },
  ] },
  { competencyId: 'b1.explain_problem', level: 'B1', categories: ['work', 'health'], core: [
    { id: 'b1-problem-und-zwar', unitId: 'b1.u5', order: 13, type: 'statement', german: 'Ich habe ein Problem, und zwar …', portuguese: 'Tenho um problema, a saber …' },
    { id: 'b1-problem-helfen', unitId: 'b1.u5', order: 14, type: 'question', german: 'Können Sie mir dabei helfen?', portuguese: 'Você pode me ajudar com isso?' },
    { id: 'b1-problem-folgendes', unitId: 'b1.u5', order: 15, type: 'statement', german: 'Es geht um Folgendes …', portuguese: 'Trata-se do seguinte …' },
  ] },
  { competencyId: 'b1.present', level: 'B1', categories: ['work'], core: [
    { id: 'b1-present-thema', unitId: 'b1.u6', order: 16, type: 'statement', german: 'Mein Thema heute ist …', portuguese: 'Meu tema hoje é …' },
    { id: 'b1-present-punkten', unitId: 'b1.u6', order: 17, type: 'statement', german: 'Lassen Sie uns mit den wichtigsten Punkten beginnen.', portuguese: 'Vamos começar com os pontos mais importantes.' },
    { id: 'b1-present-fragen', unitId: 'b1.u6', order: 18, type: 'question', german: 'Gibt es dazu Fragen?', portuguese: 'Há perguntas sobre isso?' },
  ] },
  { competencyId: 'b1.live_daily', level: 'B1', categories: ['daily', 'work'], core: [
    { id: 'b1-daily-erledigt', unitId: 'b1.u7', order: 19, type: 'statement', german: 'Ich habe alles erledigt.', portuguese: 'Eu terminei tudo.' },
    { id: 'b1-daily-termin', unitId: 'b1.u7', order: 20, type: 'question', german: 'Kann ich einen Termin machen?', portuguese: 'Posso marcar um horário?' },
    { id: 'b1-daily-passt', unitId: 'b1.u7', order: 21, type: 'statement', german: 'Das passt mir gut.', portuguese: 'Isso me serve bem.' },
  ] },

  // ---------------- B2 ----------------
  { competencyId: 'b2.narrative', level: 'B2', categories: ['work', 'daily'], core: [
    { id: 'b2-narrative-erfahrung', unitId: 'b2.u1', order: 1, type: 'statement', german: 'Letztes Jahr habe ich eine Erfahrung gemacht, die meine Sicht auf die Arbeit völlig verändert hat.', portuguese: 'No ano passado tive uma experiência que mudou completamente a minha visão sobre o trabalho.' },
    { id: 'b2-narrative-damals', unitId: 'b2.u1', order: 2, type: 'statement', german: 'Damals hätte ich nicht gedacht, dass daraus etwas so Wichtiges entstehen würde.', portuguese: 'Naquela época eu não teria imaginado que daquilo surgiria algo tão importante.' },
    { id: 'b2-narrative-rueckblick', unitId: 'b2.u1', order: 3, type: 'statement', german: 'Im Rückblick sehe ich klar, warum diese Situation mich so geprägt hat.', portuguese: 'Em retrospectiva vejo claramente por que essa situação me marcou tanto.' },
  ] },
  { competencyId: 'b2.cause_effect', level: 'B2', categories: ['work', 'social'], core: [
    { id: 'b2-cause-dadurch', unitId: 'b2.u2', order: 4, type: 'statement', german: 'Dadurch, dass wir die Prioritäten geändert haben, ist der Druck deutlich gesunken.', portuguese: 'Ao mudarmos as prioridades, a pressão caiu claramente.' },
    { id: 'b2-cause-waere', unitId: 'b2.u2', order: 5, type: 'statement', german: 'Wenn wir früher kommuniziert hätten, wäre der Konflikt vermeidbar gewesen.', portuguese: 'Se tivéssemos comunicado mais cedo, o conflito teria sido evitável.' },
    { id: 'b2-cause-folglich', unitId: 'b2.u2', order: 6, type: 'statement', german: 'Folglich mussten wir den Plan überarbeiten und neue Verantwortlichkeiten klären.', portuguese: 'Consequentemente tivemos de rever o plano e esclarecer novas responsabilidades.' },
  ] },
  { competencyId: 'b2.argue', level: 'B2', categories: ['social', 'work'], core: [
    { id: 'b2-argue-auffassung', unitId: 'b2.u3', order: 7, type: 'statement', german: 'Ich vertrete die Auffassung, dass wir hier einen klaren Qualitätsstandard brauchen.', portuguese: 'Defendo a visão de que precisamos aqui de um padrão de qualidade claro.' },
    { id: 'b2-argue-dagegen', unitId: 'b2.u3', order: 8, type: 'statement', german: 'Dagegen spricht vor allem, dass der Zeitplan unrealistisch ist.', portuguese: 'Contra isso fala sobretudo que o cronograma é irrealista.' },
    { id: 'b2-argue-laesst', unitId: 'b2.u3', order: 9, type: 'statement', german: 'Das lässt sich so pauschal nicht sagen — der Kontext entscheidet.', portuguese: 'Não se pode dizer isso de forma genérica — o contexto decide.' },
  ] },
  { competencyId: 'b2.compare', level: 'B2', categories: ['work'], core: [
    { id: 'b2-compare-optionen', unitId: 'b2.u4', order: 10, type: 'statement', german: 'Im Vergleich zur ersten Option ist die zweite langfristig stabiler.', portuguese: 'Em comparação com a primeira opção, a segunda é mais estável a longo prazo.' },
    { id: 'b2-compare-vorteile', unitId: 'b2.u4', order: 11, type: 'statement', german: 'Beide Wege haben Vorteile, aber nur einer passt zu unseren Ressourcen.', portuguese: 'Ambos os caminhos têm vantagens, mas só um cabe nos nossos recursos.' },
    { id: 'b2-compare-abwaegen', unitId: 'b2.u4', order: 12, type: 'statement', german: 'Wenn man Kosten und Nutzen abwägt, ist der Kompromiss die bessere Wahl.', portuguese: 'Se se ponderam custos e benefícios, o compromisso é a melhor escolha.' },
  ] },
  { competencyId: 'b2.problems_solutions', level: 'B2', categories: ['work', 'health'], core: [
    { id: 'b2-solve-problem', unitId: 'b2.u5', order: 13, type: 'statement', german: 'Das eigentliche Problem liegt darin, dass niemand die Verantwortung übernommen hat.', portuguese: 'O problema real está em que ninguém assumiu a responsabilidade.' },
    { id: 'b2-solve-vorschlag', unitId: 'b2.u5', order: 14, type: 'statement', german: 'Mein Vorschlag wäre, dass wir zuerst die Ursachen klären und dann priorisieren.', portuguese: 'Minha proposta seria esclarecermos primeiro as causas e depois priorizarmos.' },
    { id: 'b2-solve-schritt', unitId: 'b2.u5', order: 15, type: 'statement', german: 'Als nächsten Schritt sollten wir eine kurze Retrospektive mit konkreten Maßnahmen machen.', portuguese: 'Como próximo passo deveríamos fazer uma retrospectiva curta com medidas concretas.' },
  ] },
  { competencyId: 'b2.work_pro', level: 'B2', categories: ['work', 'daily'], core: [
    { id: 'b2-work-optionen', unitId: 'b2.u6', order: 16, type: 'statement', german: 'Wir sollten folgende Optionen prüfen, bevor wir uns festlegen.', portuguese: 'Deveríamos avaliar as seguintes opções antes de nos decidir.' },
    { id: 'b2-work-kompromiss', unitId: 'b2.u6', order: 17, type: 'statement', german: 'Lassen Sie uns auf einen Kompromiss hinarbeiten, der beide Seiten entlastet.', portuguese: 'Vamos buscar um compromisso que alivie ambos os lados.' },
    { id: 'b2-work-verhandelbar', unitId: 'b2.u6', order: 18, type: 'statement', german: 'Das ist aus meiner Sicht verhandelbar, solange die Qualität nicht leidet.', portuguese: 'Do meu ponto de vista isso é negociável, desde que a qualidade não sofra.' },
  ] },
  { competencyId: 'b2.defend', level: 'B2', categories: ['work', 'social'], core: [
    { id: 'b2-defend-entscheidung', unitId: 'b2.u7', order: 19, type: 'statement', german: 'Ich stehe zu dieser Entscheidung, weil sie auf klaren Kriterien beruht.', portuguese: 'Mantenho esta decisão porque ela se baseia em critérios claros.' },
    { id: 'b2-defend-widersprechen', unitId: 'b2.u7', order: 20, type: 'statement', german: 'Da muss ich Ihnen widersprechen — die Daten zeigen ein anderes Bild.', portuguese: 'Aí tenho de discordar — os dados mostram outro quadro.' },
    { id: 'b2-defend-halten', unitId: 'b2.u7', order: 21, type: 'statement', german: 'Trotz der Kritik halte ich an meinem Standpunkt fest und erkläre gerne warum.', portuguese: 'Apesar da crítica, mantenho meu ponto de vista e explico com prazer por quê.' },
  ] },
  { competencyId: 'b2.fluent', level: 'B2', categories: ['social', 'daily'], core: [
    { id: 'b2-fluent-ehrlich', unitId: 'b2.u8', order: 22, type: 'statement', german: 'Ehrlich gesagt, habe ich da eine andere Erfahrung gemacht und würde heute anders handeln.', portuguese: 'Sinceramente, tive uma experiência diferente e hoje agiria de outro modo.' },
    { id: 'b2-fluent-hoere', unitId: 'b2.u8', order: 23, type: 'statement', german: 'Wenn ich das so höre, fällt mir ein, dass wir denselben Mechanismus schon einmal gesehen haben.', portuguese: 'Ouvindo isso, me ocorre que já vimos o mesmo mecanismo antes.' },
    { id: 'b2-fluent-sinn', unitId: 'b2.u8', order: 24, type: 'statement', german: 'Lange Rede kurzer Sinn: wir brauchen Klarheit, Tempo und eine gemeinsame Priorität.', portuguese: 'Em resumo: precisamos de clareza, ritmo e uma prioridade comum.' },
  ] },

  // ---------------- C1 ----------------
  { competencyId: 'c1.nuance', level: 'C1', categories: ['social', 'work'], core: [
    { id: 'c1-nuance-perspektive', unitId: 'c1.u1', order: 1, type: 'statement', german: 'Aus meiner Sicht ist die Situation wesentlich komplexer, als es auf den ersten Blick erscheint.', portuguese: 'Na minha perspectiva, a situação é muito mais complexa do que parece à primeira vista.' },
    { id: 'c1-nuance-anders', unitId: 'c1.u1', order: 2, type: 'statement', german: 'Anders formuliert: wir unterschätzen die Wechselwirkungen zwischen den einzelnen Faktoren.', portuguese: 'Formulado de outro modo: subestimamos as interações entre os fatores individuais.' },
    { id: 'c1-nuance-nuance', unitId: 'c1.u1', order: 3, type: 'statement', german: 'Es kommt stark darauf an, welchen Aspekt man betont — die Nuance verändert die Aussage.', portuguese: 'Depende muito de qual aspecto se enfatiza — a nuance muda o enunciado.' },
  ] },
  { competencyId: 'c1.argue', level: 'C1', categories: ['work', 'social'], core: [
    { id: 'c1-argue-zwar', unitId: 'c1.u2', order: 4, type: 'statement', german: 'Zwar erkenne ich die Vorteile an, doch die langfristigen Risiken überwiegen aus meiner Sicht klar.', portuguese: 'Reconheço as vantagens, mas os riscos a longo prazo, na minha visão, pesam claramente mais.' },
    { id: 'c1-argue-grundlage', unitId: 'c1.u2', order: 5, type: 'statement', german: 'Meine Argumentation stützt sich vor allem darauf, dass die Annahmen der Gegenseite nicht belegt sind.', portuguese: 'Minha argumentação apoia-se sobretudo no fato de que as premissas do outro lado não estão comprovadas.' },
    { id: 'c1-argue-folgerung', unitId: 'c1.u2', order: 6, type: 'statement', german: 'Daraus folgt zwingend, dass wir die Entscheidung verschieben, bis belastbare Daten vorliegen.', portuguese: 'Disso se segue necessariamente que adiamos a decisão até haver dados confiáveis.' },
  ] },
  { competencyId: 'c1.debate', level: 'C1', categories: ['social', 'work'], core: [
    { id: 'c1-debate-einwand', unitId: 'c1.u3', order: 7, type: 'statement', german: 'Auf diesen Einwand würde ich entgegnen, dass er die strukturelle Ursache ausblendet.', portuguese: 'A essa objeção eu responderia que ela deixa de lado a causa estrutural.' },
    { id: 'c1-debate-entkraeftet', unitId: 'c1.u3', order: 8, type: 'statement', german: 'Das entkräftet meine These nicht; es zeigt lediglich, dass der Anwendungsfall enger gefasst werden muss.', portuguese: 'Isso não enfraquece minha tese; apenas mostra que o caso de uso precisa ser delimitado com mais precisão.' },
    { id: 'c1-debate-differenzieren', unitId: 'c1.u3', order: 9, type: 'statement', german: 'Lassen Sie uns das differenzierter betrachten, bevor wir vorschnell eine Seite wählen.', portuguese: 'Vamos analisar isso de modo mais diferenciado antes de escolher um lado às pressas.' },
  ] },
  { competencyId: 'c1.hypothesis', level: 'C1', categories: ['work', 'social'], core: [
    { id: 'c1-hyp-angenommen', unitId: 'c1.u4', order: 10, type: 'statement', german: 'Angenommen, die Rahmenbedingungen ändern sich, dann müssten wir unsere Strategie grundlegend überdenken.', portuguese: 'Supondo que as condições-quadro mudem, teríamos de repensar fundamentalmente nossa estratégia.' },
    { id: 'c1-hyp-waere', unitId: 'c1.u4', order: 11, type: 'statement', german: 'Wäre die Kommunikation transparenter gewesen, hätte sich der Konflikt vermutlich gar nicht erst zugespitzt.', portuguese: 'Se a comunicação tivesse sido mais transparente, o conflito provavelmente nem teria se agravado.' },
    { id: 'c1-hyp-szenario', unitId: 'c1.u4', order: 12, type: 'statement', german: 'In einem alternativen Szenario würden wir zuerst die Interessen aller Beteiligten explizit machen.', portuguese: 'Num cenário alternativo, tornaríamos explícitos primeiro os interesses de todos os envolvidos.' },
  ] },
  { competencyId: 'c1.register', level: 'C1', categories: ['work', 'daily'], core: [
    { id: 'c1-reg-formal', unitId: 'c1.u5', order: 13, type: 'statement', german: 'Ich möchte Sie höflich bitten, mir die Unterlagen bis Freitag zukommen zu lassen.', portuguese: 'Gostaria de pedi-lhe cordialmente que me envie os documentos até sexta-feira.' },
    { id: 'c1-reg-informal', unitId: 'c1.u5', order: 14, type: 'statement', german: 'Kannst du mir die Unterlagen bis Freitag schicken? Das wäre super.', portuguese: 'Consegues me mandar os documentos até sexta? Seria ótimo.' },
    { id: 'c1-reg-neutral', unitId: 'c1.u5', order: 15, type: 'statement', german: 'Wir sollten den Termin verschieben und die offenen Punkte schriftlich festhalten.', portuguese: 'Deveríamos remarcar o horário e registrar por escrito os pontos em aberto.' },
  ] },
  { competencyId: 'c1.abstract', level: 'C1', categories: ['social'], core: [
    { id: 'c1-abs-gesellschaft', unitId: 'c1.u6', order: 16, type: 'statement', german: 'In einer zunehmend digitalisierten Gesellschaft verschieben sich die Grenzen zwischen privat und öffentlich.', portuguese: 'Numa sociedade cada vez mais digitalizada, deslocam-se as fronteiras entre privado e público.' },
    { id: 'c1-abs-verantwortung', unitId: 'c1.u6', order: 17, type: 'statement', german: 'Die Frage der Verantwortung lässt sich nicht allein technisch lösen; sie ist auch ethisch.', portuguese: 'A questão da responsabilidade não se resolve só tecnicamente; é também ética.' },
    { id: 'c1-abs-spannung', unitId: 'c1.u6', order: 18, type: 'statement', german: 'Hier zeigt sich die Spannung zwischen individueller Freiheit und kollektivem Interesse besonders deutlich.', portuguese: 'Aqui a tensão entre liberdade individual e interesse coletivo aparece com especial clareza.' },
  ] },
  { competencyId: 'c1.negotiate', level: 'C1', categories: ['work', 'social'], core: [
    { id: 'c1-neg-interesse', unitId: 'c1.u7', order: 19, type: 'statement', german: 'Mein Interesse liegt weniger beim Preis als bei verlässlichen Lieferzeiten und klarer Kommunikation.', portuguese: 'Meu interesse está menos no preço do que em prazos de entrega confiáveis e comunicação clara.' },
    { id: 'c1-neg-kompromiss', unitId: 'c1.u7', order: 20, type: 'statement', german: 'Wenn beide Seiten einen Schritt aufeinander zugehen, lässt sich ein tragfähiger Kompromiss finden.', portuguese: 'Se ambos os lados derem um passo um em direção ao outro, dá para achar um compromisso sustentável.' },
    { id: 'c1-neg-entspannen', unitId: 'c1.u7', order: 21, type: 'statement', german: 'Lassen Sie uns die Tonlage etwas entspannen und zuerst klären, worüber wir uns überhaupt einig sind.', portuguese: 'Vamos baixar um pouco o tom e esclarecer primeiro sobre o que já estamos de acordo.' },
  ] },
  { competencyId: 'c1.spontaneous', level: 'C1', categories: ['social', 'daily'], core: [
    { id: 'c1-spon-ehrlich', unitId: 'c1.u8', order: 22, type: 'statement', german: 'Ehrlich gesagt, habe ich dazu noch keine abschließende Meinung — ich muss das noch durchdenken.', portuguese: 'Sinceramente, ainda não tenho uma opinião definitiva sobre isso — preciso refletir mais.' },
    { id: 'c1-spon-anschluss', unitId: 'c1.u8', order: 23, type: 'statement', german: 'Wenn ich an das anknüpfe, was Sie gerade gesagt haben, dann sehe ich vor allem einen blinden Fleck in der Umsetzung.', portuguese: 'Se eu retomo o que você acabou de dizer, vejo sobretudo um ponto cego na implementação.' },
    { id: 'c1-spon-fazit', unitId: 'c1.u8', order: 24, type: 'statement', german: 'Um es auf den Punkt zu bringen: ohne gemeinsame Prioritäten bleibt jede Strategie Stückwerk.', portuguese: 'Para ir ao ponto: sem prioridades comuns, qualquer estratégia continua fragmentada.' },
  ] },

  // ---------------- C2 ----------------
  { competencyId: 'c2.nuance', level: 'C2', categories: ['social', 'work'], core: [
    { id: 'c2-nuance-ambivalent', unitId: 'c2.u1', order: 1, type: 'statement', german: 'Die Situation lässt sich keineswegs eindeutig beurteilen, da mehrere Faktoren miteinander in Wechselwirkung stehen.', portuguese: 'A situação está longe de poder ser avaliada de forma inequívoca, pois vários fatores interagem entre si.' },
    { id: 'c2-nuance-nuancenreich', unitId: 'c2.u1', order: 2, type: 'statement', german: 'Was auf den ersten Blick wie ein Widerspruch wirkt, erweist sich bei genauerem Hinsehen als nuancenreiche Spannung.', portuguese: 'O que à primeira vista parece uma contradição revela-se, com um olhar mais atento, uma tensão cheia de nuances.' },
    { id: 'c2-nuance-praezise', unitId: 'c2.u1', order: 3, type: 'statement', german: 'Ich möchte das präziser fassen: nicht die Absicht war problematisch, sondern die unverhandelten Prämissen.', portuguese: 'Quero formular isso com mais precisão: o problemático não era a intenção, e sim as premissas não negociadas.' },
  ] },
  { competencyId: 'c2.argue', level: 'C2', categories: ['work', 'social'], core: [
    { id: 'c2-argue-vorbehalt', unitId: 'c2.u2', order: 4, type: 'statement', german: 'Unter dem Vorbehalt, dass die Datenlage vorläufig bleibt, halte ich die vorgeschlagene Lesart für die stichhaltigste.', portuguese: 'Com a ressalva de que a base de dados ainda é provisória, considero a leitura proposta a mais sólida.' },
    { id: 'c2-argue-mehrschichtig', unitId: 'c2.u2', order: 5, type: 'statement', german: 'Meine Kritik richtet sich weniger gegen das Ziel als gegen die ungeprüften Annahmen, auf denen es beruht.', portuguese: 'Minha crítica dirige-se menos ao objetivo do que às premissas não examinadas nas quais ele se apoia.' },
    { id: 'c2-argue-zugestaendnis', unitId: 'c2.u2', order: 6, type: 'statement', german: 'Selbst wenn man den Einwand ernst nimmt, bleibt unerklärt, warum alternative Deutungen systematisch ausgeblendet wurden.', portuguese: 'Mesmo levando a objeção a sério, continua sem explicação por que interpretações alternativas foram sistematicamente excluídas.' },
  ] },
  { competencyId: 'c2.discourse', level: 'C2', categories: ['work', 'social'], core: [
    { id: 'c2-disc-aufbau', unitId: 'c2.u3', order: 7, type: 'statement', german: 'Ich gliedere meinen Gedankengang in drei Schritte: Diagnose, Gegenprobe und daraus abgeleitete Konsequenz.', portuguese: 'Organizo meu raciocínio em três passos: diagnóstico, contra-prova e consequência daí derivada.' },
    { id: 'c2-disc-roterfaden', unitId: 'c2.u3', order: 8, type: 'statement', german: 'Der rote Faden ist, dass ohne geteilte Kriterien jede Priorisierung willkürlich wirkt.', portuguese: 'O fio condutor é que, sem critérios compartilhados, qualquer priorização parece arbitrária.' },
    { id: 'c2-disc-schluss', unitId: 'c2.u3', order: 9, type: 'statement', german: 'Zusammenfassend lässt sich festhalten: die Debatte braucht weniger Positionen und mehr belastbare Maßstäbe.', portuguese: 'Em resumo: o debate precisa de menos posições e de critérios mais confiáveis.' },
  ] },
  { competencyId: 'c2.inference', level: 'C2', categories: ['social', 'work'], core: [
    { id: 'c2-inf-implizit', unitId: 'c2.u4', order: 10, type: 'statement', german: 'Zwischen den Zeilen klingt an, dass die eigentliche Entscheidung bereits getroffen wurde, ohne sie so zu nennen.', portuguese: 'Entre as linhas soa que a decisão real já foi tomada, sem nomeá-la como tal.' },
    { id: 'c2-inf-deuten', unitId: 'c2.u4', order: 11, type: 'statement', german: 'Wenn man diese Formulierung wörtlich nimmt, wirkt sie harmlos; gelesen als Signal, markiert sie eine Grenze.', portuguese: 'Se se toma essa formulação ao pé da letra, parece inofensiva; lida como sinal, marca um limite.' },
    { id: 'c2-inf-ableiten', unitId: 'c2.u4', order: 12, type: 'statement', german: 'Daraus lässt sich ableiten, dass Widerstand weniger gegen den Inhalt als gegen den Prozess gerichtet ist.', portuguese: 'Disso se pode inferir que a resistência se dirige menos ao conteúdo do que ao processo.' },
  ] },
  { competencyId: 'c2.register', level: 'C2', categories: ['work', 'daily'], core: [
    { id: 'c2-reg-formell', unitId: 'c2.u5', order: 13, type: 'statement', german: 'Gestatten Sie mir, den Punkt noch einmal in etwas förmlicherer Sprache zu fassen, damit nichts missverstanden wird.', portuguese: 'Permita-me reformular o ponto numa linguagem um pouco mais formal, para que nada seja mal interpretado.' },
    { id: 'c2-reg-umgang', unitId: 'c2.u5', order: 14, type: 'statement', german: 'Kurz gesagt: das zieht so nicht — wir müssen das anders aufziehen, sonst wird es chaotisch.', portuguese: 'Em resumo: assim não rola — temos de montar de outro jeito, senão vira caos.' },
    { id: 'c2-reg-wechseln', unitId: 'c2.u5', order: 15, type: 'statement', german: 'Je nach Gegenüber wechsle ich bewusst zwischen Distanz und Nähe, ohne die Sache selbst zu verwässern.', portuguese: 'Conforme o interlocutor, mudo conscientemente entre distância e proximidade, sem diluir o assunto em si.' },
  ] },
  { competencyId: 'c2.mediate', level: 'C2', categories: ['work', 'social'], core: [
    { id: 'c2-med-interessen', unitId: 'c2.u6', order: 16, type: 'statement', german: 'Statt Positionen gegeneinander zu stellen, lohnt es sich, die darunterliegenden Interessen sichtbar zu machen.', portuguese: 'Em vez de contrapôr posições, vale tornar visíveis os interesses que estão por baixo.' },
    { id: 'c2-med-bruecke', unitId: 'c2.u6', order: 17, type: 'statement', german: 'Ich schlage vor, eine Brücke zu formulieren, die beiden Seiten Gesichtswahrung erlaubt, ohne die Substanz zu opfern.', portuguese: 'Proponho formular uma ponte que permita a ambos os lados salvar as aparências sem sacrificar a substância.' },
    { id: 'c2-med-persuasion', unitId: 'c2.u6', order: 18, type: 'statement', german: 'Überzeugend wirkt hier weniger Druck als die präzise Benennung dessen, was für beide Seiten riskant wäre.', portuguese: 'Aqui convence menos a pressão do que nomear com precisão o que seria arriscado para ambos os lados.' },
  ] },
  { competencyId: 'c2.critical', level: 'C2', categories: ['social'], core: [
    { id: 'c2-crit-begriff', unitId: 'c2.u7', order: 19, type: 'statement', german: 'Bevor wir über Freiheit sprechen, müssten wir klären, welchen Freiheitsbegriff wir eigentlich voraussetzen.', portuguese: 'Antes de falar de liberdade, teríamos de esclarecer que conceito de liberdade estamos pressupondo.' },
    { id: 'c2-crit-widerspruch', unitId: 'c2.u7', order: 20, type: 'statement', german: 'Der Widerspruch liegt darin, dass wir Effizienz fordern und zugleich die Bedingungen dafür systematisch untergraben.', portuguese: 'A contradição está em exigirmos eficiência e, ao mesmo tempo, minarmos sistematicamente as condições para ela.' },
    { id: 'c2-crit-reflexion', unitId: 'c2.u7', order: 21, type: 'statement', german: 'Kritische Reflexion bedeutet hier, die eigenen blinden Flecken ebenso ernst zu nehmen wie die der Gegenseite.', portuguese: 'Reflexão crítica significa aqui levar os próprios pontos cegos tão a sério quanto os do outro lado.' },
  ] },
  { competencyId: 'c2.fluent', level: 'C2', categories: ['social', 'daily'], core: [
    { id: 'c2-flu-spontan', unitId: 'c2.u8', order: 22, type: 'statement', german: 'Spontan gesagt: ich bin noch nicht fertig mit dem Gedanken, aber die Richtung scheint mir klarer als gestern.', portuguese: 'Dito espontaneamente: ainda não terminei o pensamento, mas a direção me parece mais clara do que ontem.' },
    { id: 'c2-flu-anpassen', unitId: 'c2.u8', order: 23, type: 'statement', german: 'Wenn das Gespräch kippt, passe ich den Ton an — ohne den Kern der Aussage aufzugeben.', portuguese: 'Se a conversa muda de tom, adapto o registro — sem abrir mão do núcleo do que quero dizer.' },
    { id: 'c2-flu-abschluss', unitId: 'c2.u8', order: 24, type: 'statement', german: 'Am Ende bleibt: wir brauchen Klarheit über Kriterien, Mut zur Unschärfe und die Bereitschaft, uns zu korrigieren.', portuguese: 'No fim, resta: precisamos de clareza sobre critérios, coragem perante a ambiguidade e disposição para nos corrigirmos.' },
  ] },
];

export const CURATED_BY_COMPETENCY: Record<string, CompetencyContent> = Object.fromEntries(
  CURATED.map((c) => [c.competencyId, c]),
);

export function curatedForLevel(level: CourseLevelId): CompetencyContent[] {
  return CURATED.filter((c) => c.level === level);
}

/** Categorias relevantes para um nível (união das competências do nível). */
export function categoriesForLevel(level: CourseLevelId): string[] {
  const set = new Set<string>();
  for (const c of CURATED.filter((c) => c.level === level)) {
    for (const cat of c.categories) set.add(cat);
  }
  return [...set];
}
