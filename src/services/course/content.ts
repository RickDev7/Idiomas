/* Conteúdo curado (núcleo) por competência + mapeamento competência→categoria
   do pool de frases existente. O núcleo é a referência canônica do que o aluno
   deve dominar; a categoria permite ao CourseEngine filtrar o pool existente. */
import type { CourseLevelId } from './types';

export interface CuratedPhrase {
  german: string;
  portuguese: string;
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
    { german: 'Das ist meine Mutter.', portuguese: 'Esta é a minha mãe.' },
    { german: 'Ich habe einen Bruder.', portuguese: 'Eu tenho um irmão.' },
    { german: 'Meine Schwester heißt …', portuguese: 'Minha irmã se chama …' },
  ] },
  { competencyId: 'a1.numbers_time', level: 'A1', categories: ['time'], core: [
    { german: 'Es ist drei Uhr.', portuguese: 'São três horas.' },
    { german: 'Heute ist Montag.', portuguese: 'Hoje é segunda-feira.' },
    { german: 'Ich habe am Freitag Zeit.', portuguese: 'Tenho tempo na sexta-feira.' },
  ] },
  { competencyId: 'a1.routine', level: 'A1', categories: ['daily'], core: [
    { german: 'Ich stehe um sieben Uhr auf.', portuguese: 'Eu levanto às sete horas.' },
    { german: 'Ich gehe zur Arbeit.', portuguese: 'Eu vou ao trabalho.' },
    { german: 'Am Abend koche ich.', portuguese: 'À noite eu cozinho.' },
  ] },
  { competencyId: 'a1.shopping', level: 'A1', categories: ['shopping'], core: [
    { german: 'Was kostet das?', portuguese: 'Quanto custa isso?' },
    { german: 'Ich nehme das.', portuguese: 'Eu fico com isso.' },
    { german: 'Haben Sie …?', portuguese: 'Você tem …?' },
  ] },
  { competencyId: 'a1.food', level: 'A1', categories: ['food'], core: [
    { german: 'Ich möchte einen Kaffee.', portuguese: 'Eu gostaria de um café.' },
    { german: 'Die Rechnung, bitte.', portuguese: 'A conta, por favor.' },
    { german: 'Ich nehme ein Wasser.', portuguese: 'Eu pego uma água.' },
  ] },
  { competencyId: 'a1.ask_info', level: 'A1', categories: ['directions', 'transport'], core: [
    { german: 'Wo ist der Bahnhof?', portuguese: 'Onde é a estação?' },
    { german: 'Wie komme ich zum Hotel?', portuguese: 'Como chego ao hotel?' },
    { german: 'Wann fährt der Bus?', portuguese: 'Quando sai o ônibus?' },
  ] },
  { competencyId: 'a1.help', level: 'A1', categories: ['survival'], core: [
    { german: 'Können Sie mir helfen, bitte?', portuguese: 'Você pode me ajudar, por favor?' },
    { german: 'Ich brauche Hilfe.', portuguese: 'Eu preciso de ajuda.' },
  ] },

  // ---------------- A2 ----------------
  { competencyId: 'a2.past', level: 'A2', categories: ['daily'], core: [
    { german: 'Ich habe gestern gearbeitet.', portuguese: 'Eu trabalhei ontem.' },
    { german: 'Wir waren im Kino.', portuguese: 'Fomos ao cinema.' },
    { german: 'Was hast du gemacht?', portuguese: 'O que você fez?' },
  ] },
  { competencyId: 'a2.plans', level: 'A2', categories: ['daily'], core: [
    { german: 'Morgen werde ich …', portuguese: 'Amanhã eu vou …' },
    { german: 'Ich plane, …', portuguese: 'Eu planejo …' },
    { german: 'Nächstes Jahr möchte ich reisen.', portuguese: 'No próximo ano quero viajar.' },
  ] },
  { competencyId: 'a2.problem', level: 'A2', categories: ['health', 'work'], core: [
    { german: 'Mir geht es nicht gut.', portuguese: 'Não estou me sentindo bem.' },
    { german: 'Ich habe ein Problem mit …', portuguese: 'Tenho um problema com …' },
    { german: 'Die Wohnung ist zu klein.', portuguese: 'O apartamento é pequeno demais.' },
  ] },
  { competencyId: 'a2.opinion', level: 'A2', categories: ['social'], core: [
    { german: 'Ich finde das gut.', portuguese: 'Eu acho isso bom.' },
    { german: 'Meiner Meinung nach …', portuguese: 'Na minha opinião …' },
    { german: 'Ich mag … lieber.', portuguese: 'Eu prefiro …' },
  ] },
  { competencyId: 'a2.travel', level: 'A2', categories: ['travel'], core: [
    { german: 'Ich bin nach Berlin gefahren.', portuguese: 'Eu fui para Berlim.' },
    { german: 'Die Reise war schön.', portuguese: 'A viagem foi boa.' },
    { german: 'Wo übernachten wir?', portuguese: 'Onde vamos dormir?' },
  ] },
  { competencyId: 'a2.phone', level: 'A2', categories: ['phone'], core: [
    { german: 'Hallo, hier ist …', portuguese: 'Olá, aqui é …' },
    { german: 'Kann ich eine Nachricht hinterlassen?', portuguese: 'Posso deixar um recado?' },
    { german: 'Ich rufe später an.', portuguese: 'Eu ligo mais tarde.' },
  ] },

  // ---------------- B1 ----------------
  { competencyId: 'b1.story', level: 'B1', categories: ['daily', 'social'], core: [
    { german: 'Letztes Jahr bin ich nach München gezogen.', portuguese: 'No ano passado me mudei para Munique.' },
    { german: 'Zuerst war es schwer, aber dann hat es geklappt.', portuguese: 'No começo foi difícil, mas depois deu certo.' },
    { german: 'Das habe ich gemacht, weil …', portuguese: 'Eu fiz isso porque …' },
  ] },
  { competencyId: 'b1.opinion_justify', level: 'B1', categories: ['social'], core: [
    { german: 'Ich bin der Meinung, dass …', portuguese: 'Sou da opinião de que …' },
    { german: 'Das finde ich deshalb, weil …', portuguese: 'Acho isso porque …' },
    { german: 'Auf der einen Seite …, auf der anderen Seite …', portuguese: 'Por um lado …, por outro …' },
  ] },
  { competencyId: 'b1.work_social', level: 'B1', categories: ['work', 'social'], core: [
    { german: 'Wie war Ihr Wochenende?', portuguese: 'Como foi o seu fim de semana?' },
    { german: 'Können wir das besprechen?', portuguese: 'Podemos conversar sobre isso?' },
    { german: 'Ich schlage vor, dass …', portuguese: 'Sugiro que …' },
  ] },
  { competencyId: 'b1.news', level: 'B1', categories: ['daily'], core: [
    { german: 'In den Nachrichten stand, dass …', portuguese: 'Nas notícias dizia que …' },
    { german: 'Haben Sie das gehört?', portuguese: 'Você ouviu isso?' },
    { german: 'Das interessiert mich.', portuguese: 'Isso me interessa.' },
  ] },
  { competencyId: 'b1.explain_problem', level: 'B1', categories: ['work', 'health'], core: [
    { german: 'Ich habe ein Problem, und zwar …', portuguese: 'Tenho um problema, a saber …' },
    { german: 'Können Sie mir dabei helfen?', portuguese: 'Você pode me ajudar com isso?' },
    { german: 'Es geht um Folgendes …', portuguese: 'Trata-se do seguinte …' },
  ] },
  { competencyId: 'b1.live_daily', level: 'B1', categories: ['daily', 'work'], core: [
    { german: 'Ich habe alles erledigt.', portuguese: 'Eu terminei tudo.' },
    { german: 'Kann ich einen Termin machen?', portuguese: 'Posso marcar um horário?' },
    { german: 'Das passt mir gut.', portuguese: 'Isso me serve bem.' },
  ] },
  { competencyId: 'b1.present', level: 'B1', categories: ['work'], core: [
    { german: 'Mein Thema heute ist …', portuguese: 'Meu tema hoje é …' },
    { german: 'Lassen Sie uns mit den wichtigsten Punkten beginnen.', portuguese: 'Vamos começar com os pontos mais importantes.' },
    { german: 'Gibt es dazu Fragen?', portuguese: 'Há perguntas sobre isso?' },
  ] },

  // ---------------- B2 ----------------
  { competencyId: 'b2.argue', level: 'B2', categories: ['social'], core: [
    { german: 'Ich vertrete die Auffassung, dass …', portuguese: 'Defendo a visão de que …' },
    { german: 'Dagegen spricht, dass …', portuguese: 'Contra isso fala que …' },
    { german: 'Das lässt sich so nicht sagen.', portuguese: 'Não se pode dizer isso assim.' },
  ] },
  { competencyId: 'b2.disagree', level: 'B2', categories: ['social'], core: [
    { german: 'Da muss ich Ihnen widersprechen.', portuguese: 'Aí tenho que discordar de você.' },
    { german: 'Ich sehe das anders, denn …', portuguese: 'Vejo isso de outro jeito, pois …' },
    { german: 'Das ist ein guter Punkt, aber …', portuguese: 'Esse é um bom ponto, mas …' },
  ] },
  { competencyId: 'b2.current_affairs', level: 'B2', categories: ['social'], core: [
    { german: 'Die aktuelle Lage zeigt, dass …', portuguese: 'A situação atual mostra que …' },
    { german: 'Man könnte argumentieren, dass …', portuguese: 'Poder-se-ia argumentar que …' },
    { german: 'Das hat weitreichende Folgen.', portuguese: 'Isso tem consequências de longo alcance.' },
  ] },
  { competencyId: 'b2.work_pro', level: 'B2', categories: ['work'], core: [
    { german: 'Wir sollten folgende Optionen prüfen.', portuguese: 'Deveríamos avaliar as seguintes opções.' },
    { german: 'Lassen Sie uns auf einen Kompromiss hinarbeiten.', portuguese: 'Vamos buscar um compromisso.' },
    { german: 'Das ist aus meiner Sicht verhandelbar.', portuguese: 'Do meu ponto de vista isso é negociável.' },
  ] },
  { competencyId: 'b2.fluent', level: 'B2', categories: ['social', 'daily'], core: [
    { german: 'Ehrlich gesagt, habe ich da eine andere Erfahrung gemacht.', portuguese: 'Sinceramente, tive uma experiência diferente.' },
    { german: 'Wenn ich das so höre, fällt mir ein, dass …', portuguese: 'Ouvindo isso, me ocorre que …' },
    { german: 'Lange Rede kurzer Sinn: …', portuguese: 'Em resumo: …' },
  ] },

  // ---------------- C1 ----------------
  { competencyId: 'c1.nuance', level: 'C1', categories: ['social'], core: [
    { german: 'Das ist wohl wahr, aber …', portuguese: 'Isso é provavelmente verdade, mas …' },
    { german: 'Man könnte auch so argumentieren.', portuguese: 'Pode-se também argumentar assim.' },
    { german: 'Das klingt einfacher, als es ist.', portuguese: 'Isso soa mais simples do que é.' },
  ] },
  { competencyId: 'c1.academic', level: 'C1', categories: ['work'], core: [
    { german: 'Die Untersuchung zeigt, dass …', portuguese: 'A investigação mostra que …' },
    { german: 'Es liegt nahe, dies so zu deuten.', portuguese: 'É plausível interpretar isso assim.' },
    { german: 'Daraus lässt sich schlussfolgern, dass …', portuguese: 'Disso pode-se concluir que …' },
  ] },
  { competencyId: 'c1.subtext', level: 'C1', categories: ['social'], core: [
    { german: 'Das war wohl eher ironisch gemeint.', portuguese: 'Isso era provavelmente ironia.' },
    { german: 'Er sagt das, meint aber etwas anderes.', portuguese: 'Ele diz isso, mas quer dizer outra coisa.' },
    { german: 'Zwischen den Zeilen heißt das …', portuguese: 'Entre as linhas isso significa …' },
  ] },
  { competencyId: 'c1.register', level: 'C1', categories: ['social', 'work'], core: [
    { german: 'Darf ich Sie um einen Gefallen bitten?', portuguese: 'Posso lhe pedir um favor?' },
    { german: 'Kannst du mir mal helfen?', portuguese: 'Podes me ajudar um instante?' },
    { german: 'Das wäre zu klären.', portuguese: 'Isso teria que ser esclarecido.' },
  ] },
  { competencyId: 'c1.debates', level: 'C1', categories: ['social'], core: [
    { german: 'Ich nehme Bezug auf Ihren Punkt und …', portuguese: 'Faço referência ao seu ponto e …' },
    { german: 'Das widerlegt meine These nicht, denn …', portuguese: 'Isso não refuta minha tese, pois …' },
    { german: 'Lassen Sie uns das differenzierter betrachten.', portuguese: 'Vamos observar isso de modo mais diferenciado.' },
  ] },

  // ---------------- C2 ----------------
  { competencyId: 'c2.mastery', level: 'C2', categories: ['social'], core: [
    { german: 'Es ist, wie es ist — man muss es nur richtig deuten.', portuguese: 'É como é — só é preciso interpretar corretamente.' },
    { german: 'Das hat seinen eigenen Reiz.', portuguese: 'Isso tem seu próprio encanto.' },
    { german: 'Man merkt, wie sehr sich das verschränkt.', portuguese: 'Nota-se o quanto isso se entrelaça.' },
  ] },
  { competencyId: 'c2.humor', level: 'C2', categories: ['social'], core: [
    { german: 'Man könnte das auch andersrum sehen — mit einem Augenzwinkern.', portuguese: 'Pode-se ver isso ao contrário — com uma piscadela.' },
    { german: 'Das ist fast schon wieder charmant falsch.', portuguese: 'Isso é quase charmoso de errado.' },
    { german: 'Wenn das keiner kapiert, ist auch gut.', portuguese: 'Se ninguém entende, tudo bem também.' },
  ] },
  { competencyId: 'c2.dialect', level: 'C2', categories: ['social'], core: [
    { german: 'Des lass ma moi so steh.', portuguese: 'Deixa isso assim (estilo dialetal).' },
    { german: 'I woas ned, wos i sog soi.', portuguese: 'Não sei o que deveria dizer (bávaro).' },
    { german: 'Moin Moin — alles klar bei dir?', portuguese: 'Bom dia — tudo bem com você? (norte).' },
  ] },
  { competencyId: 'c2.style', level: 'C2', categories: ['work'], core: [
    { german: 'Es sei an dieser Stelle angemerkt, dass …', portuguese: 'Note-se aqui que …' },
    { german: 'Dies vorausgeschickt, lässt sich Folgendes festhalten.', portuguese: 'Posto isso, pode-se constatar o seguinte.' },
    { german: 'Wer so argumentiert, übersieht, dass …', portuguese: 'Quem argumenta assim negligencia que …' },
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
