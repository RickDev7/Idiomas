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
  // ---------------- Nível 0 (pré-A1) ----------------
  { competencyId: 'l0.greet', level: 'L0', categories: ['greetings'], core: [
    { german: 'Hallo!', portuguese: 'Olá!' },
    { german: 'Guten Morgen.', portuguese: 'Bom dia.' },
    { german: 'Danke.', portuguese: 'Obrigado.' },
    { german: 'Auf Wiedersehen.', portuguese: 'Até logo.' },
  ] },
  { competencyId: 'l0.introduce', level: 'L0', categories: ['greetings'], core: [
    { german: 'Ich heiße …', portuguese: 'Eu me chamo …' },
    { german: 'Ich komme aus …', portuguese: 'Eu venho de …' },
    { german: 'Wie heißt du?', portuguese: 'Como você se chama?' },
  ] },
  { competencyId: 'l0.people', level: 'L0', categories: ['family'], core: [
    { german: 'Das ist meine Mutter.', portuguese: 'Esta é a minha mãe.' },
    { german: 'Ich habe …', portuguese: 'Eu tenho …' },
  ] },
  { competencyId: 'l0.basics', level: 'L0', categories: ['time', 'daily'], core: [
    { german: 'Heute.', portuguese: 'Hoje.' },
    { german: 'Es ist … Uhr.', portuguese: 'São … horas.' },
    { german: 'Eins, zwei, drei.', portuguese: 'Um, dois, três.' },
  ] },
  { competencyId: 'l0.help', level: 'L0', categories: ['survival', 'responses'], core: [
    { german: 'Ja.', portuguese: 'Sim.' },
    { german: 'Ich verstehe nicht.', portuguese: 'Eu não entendo.' },
    { german: 'Hilfe, bitte!', portuguese: 'Socorro, por favor!' },
  ] },
  { competencyId: 'l0.needs', level: 'L0', categories: ['survival'], core: [
    { german: 'Ich brauche …', portuguese: 'Eu preciso de …' },
    { german: 'Ich möchte …', portuguese: 'Eu gostaria de …' },
    { german: 'Wasser, bitte.', portuguese: 'Água, por favor.' },
  ] },
  { competencyId: 'l0.world', level: 'L0', categories: ['daily', 'work'], core: [
    { german: 'Das ist mein Haus.', portuguese: 'Esta é a minha casa.' },
    { german: 'Der Tisch.', portuguese: 'A mesa.' },
  ] },
  { competencyId: 'l0.phrases', level: 'L0', categories: ['work', 'daily'], core: [
    { german: 'Ich arbeite.', portuguese: 'Eu trabalho.' },
    { german: 'Ich heiße… Ich wohne in…', portuguese: 'Sequência de apresentação.' },
  ] },

  // ---------------- A1 — curso escolar comunicativo ----------------
  { competencyId: 'a1.personal', level: 'A1', categories: ['personal', 'identity'], core: [
    { id: 'a1-personal-heisse', unitId: 'a1.u1', order: 1, type: 'statement', german: 'Ich heiße …', portuguese: 'Eu me chamo …' },
    { id: 'a1-personal-komme', unitId: 'a1.u1', order: 2, type: 'statement', german: 'Ich komme aus Brasilien.', portuguese: 'Eu venho do Brasil.' },
    { id: 'a1-personal-wohne', unitId: 'a1.u1', order: 3, type: 'statement', german: 'Ich wohne in …', portuguese: 'Eu moro em …' },
    { id: 'a1-personal-alter', unitId: 'a1.u1', order: 4, type: 'statement', german: 'Ich bin … Jahre alt.', portuguese: 'Eu tenho … anos.' },
    { id: 'a1-personal-sprache', unitId: 'a1.u1', order: 5, type: 'statement', german: 'Ich spreche Portugiesisch und ein bisschen Deutsch.', portuguese: 'Eu falo português e um pouco de alemão.' },
    { id: 'a1-personal-beruf', unitId: 'a1.u1', order: 6, type: 'statement', german: 'Ich arbeite als … / Ich bin Student.', portuguese: 'Eu trabalho como … / Eu sou estudante.' },
    { id: 'a1-personal-gern', unitId: 'a1.u1', order: 7, type: 'statement', german: 'Ich mache gern Sport.', portuguese: 'Eu gosto de praticar esporte.' },
    { id: 'a1-personal-frage-woher', unitId: 'a1.u1', order: 8, type: 'question', german: 'Woher kommst du?', portuguese: 'De onde você é?' },
  ] },
  { competencyId: 'a1.family', level: 'A1', categories: ['family'], core: [
    { id: 'a1-family-mutter', unitId: 'a1.u2', order: 9, type: 'statement', german: 'Das ist meine Mutter.', portuguese: 'Esta é a minha mãe.' },
    { id: 'a1-family-bruder', unitId: 'a1.u2', order: 10, type: 'statement', german: 'Ich habe einen Bruder.', portuguese: 'Eu tenho um irmão.' },
    { id: 'a1-family-schwester', unitId: 'a1.u2', order: 11, type: 'statement', german: 'Meine Schwester heißt …', portuguese: 'Minha irmã se chama …' },
    { id: 'a1-family-eltern', unitId: 'a1.u2', order: 12, type: 'statement', german: 'Meine Eltern wohnen in …', portuguese: 'Meus pais moram em …' },
    { id: 'a1-family-kinder', unitId: 'a1.u2', order: 13, type: 'statement', german: 'Das sind meine Kinder.', portuguese: 'Estas são as minhas crianças.' },
    { id: 'a1-family-freund', unitId: 'a1.u2', order: 14, type: 'statement', german: 'Mein Freund ist nett und hilfsbereit.', portuguese: 'Meu amigo é simpático e prestativo.' },
    { id: 'a1-family-frage', unitId: 'a1.u2', order: 15, type: 'question', german: 'Hast du Geschwister?', portuguese: 'Você tem irmãos?' },
  ] },
  { competencyId: 'a1.routine', level: 'A1', categories: ['daily'], core: [
    { id: 'a1-routine-aufstehen', unitId: 'a1.u3', order: 16, type: 'statement', german: 'Ich stehe um sieben Uhr auf.', portuguese: 'Eu levanto às sete horas.' },
    { id: 'a1-routine-fruehstueck', unitId: 'a1.u3', order: 17, type: 'statement', german: 'Am Morgen frühstücke ich.', portuguese: 'De manhã eu tomo café da manhã.' },
    { id: 'a1-routine-arbeit', unitId: 'a1.u3', order: 18, type: 'statement', german: 'Ich gehe zur Arbeit.', portuguese: 'Eu vou ao trabalho.' },
    { id: 'a1-routine-pause', unitId: 'a1.u3', order: 19, type: 'statement', german: 'Um zwölf Uhr mache ich Pause.', portuguese: 'Às doze eu faço uma pausa.' },
    { id: 'a1-routine-kochen', unitId: 'a1.u3', order: 20, type: 'statement', german: 'Am Abend koche ich.', portuguese: 'À noite eu cozinho.' },
    { id: 'a1-routine-schlafen', unitId: 'a1.u3', order: 21, type: 'statement', german: 'Ich gehe um elf Uhr schlafen.', portuguese: 'Eu vou dormir às onze.' },
    { id: 'a1-routine-jeden-tag', unitId: 'a1.u3', order: 22, type: 'statement', german: 'Jeden Tag fahre ich mit dem Bus.', portuguese: 'Todo dia eu vou de ônibus.' },
    { id: 'a1-routine-frage-tag', unitId: 'a1.u3', order: 23, type: 'question', german: 'Was machst du am Morgen?', portuguese: 'O que você faz de manhã?' },
  ] },
  { competencyId: 'a1.shopping', level: 'A1', categories: ['shopping', 'food'], core: [
    { id: 'a1-shopping-kostet', unitId: 'a1.u4', order: 24, type: 'question', german: 'Was kostet das?', portuguese: 'Quanto custa isso?' },
    { id: 'a1-shopping-wie-viel', unitId: 'a1.u4', order: 25, type: 'question', german: 'Wie viel kostet …?', portuguese: 'Quanto custa …?' },
    { id: 'a1-shopping-haben', unitId: 'a1.u4', order: 26, type: 'question', german: 'Haben Sie …?', portuguese: 'Você tem …?' },
    { id: 'a1-shopping-nehme', unitId: 'a1.u4', order: 27, type: 'statement', german: 'Ich nehme das.', portuguese: 'Eu fico com isso.' },
    { id: 'a1-shopping-moechte', unitId: 'a1.u4', order: 28, type: 'statement', german: 'Ich möchte ein Brot, bitte.', portuguese: 'Eu gostaria de um pão, por favor.' },
    { id: 'a1-shopping-haette', unitId: 'a1.u4', order: 29, type: 'statement', german: 'Ich hätte gern einen Kaffee.', portuguese: 'Eu gostaria de um café.' },
    { id: 'a1-food-kaffee', unitId: 'a1.u4', order: 30, type: 'statement', german: 'Ich möchte einen Kaffee.', portuguese: 'Eu gostaria de um café.' },
    { id: 'a1-food-wasser', unitId: 'a1.u4', order: 31, type: 'statement', german: 'Ich nehme ein Wasser.', portuguese: 'Eu pego uma água.' },
    { id: 'a1-food-rechnung', unitId: 'a1.u4', order: 32, type: 'request', german: 'Die Rechnung, bitte.', portuguese: 'A conta, por favor.' },
    { id: 'a1-food-speisekarte', unitId: 'a1.u4', order: 33, type: 'request', german: 'Die Speisekarte, bitte.', portuguese: 'O cardápio, por favor.' },
  ] },
  { competencyId: 'a1.ask_info', level: 'A1', categories: ['directions', 'transport'], core: [
    { id: 'a1-info-bahnhof', unitId: 'a1.u5', order: 34, type: 'question', german: 'Wo ist der Bahnhof?', portuguese: 'Onde é a estação?' },
    { id: 'a1-info-hotel', unitId: 'a1.u5', order: 35, type: 'question', german: 'Wie komme ich zum Hotel?', portuguese: 'Como chego ao hotel?' },
    { id: 'a1-info-bus', unitId: 'a1.u5', order: 36, type: 'question', german: 'Wann fährt der Bus?', portuguese: 'Quando sai o ônibus?' },
    { id: 'a1-info-suche', unitId: 'a1.u5', order: 37, type: 'statement', german: 'Ich suche die Apotheke.', portuguese: 'Estou procurando a farmácia.' },
    { id: 'a1-info-arzt', unitId: 'a1.u5', order: 38, type: 'question', german: 'Wie komme ich zum Arzt?', portuguese: 'Como chego ao médico?' },
    { id: 'a1-info-links', unitId: 'a1.u5', order: 39, type: 'statement', german: 'Gehen Sie links / rechts / geradeaus.', portuguese: 'Vá à esquerda / direita / em frente.' },
    { id: 'a1-info-weit', unitId: 'a1.u5', order: 40, type: 'question', german: 'Ist das weit?', portuguese: 'É longe?' },
    { id: 'a1-info-mit-bus', unitId: 'a1.u5', order: 41, type: 'statement', german: 'Ich fahre mit dem Bus.', portuguese: 'Eu vou de ônibus.' },
  ] },
  { competencyId: 'a1.numbers_time', level: 'A1', categories: ['time', 'appointments'], core: [
    { id: 'a1-time-drei-uhr', unitId: 'a1.u6', order: 42, type: 'statement', german: 'Es ist drei Uhr.', portuguese: 'São três horas.' },
    { id: 'a1-time-montag', unitId: 'a1.u6', order: 43, type: 'statement', german: 'Heute ist Montag.', portuguese: 'Hoje é segunda-feira.' },
    { id: 'a1-time-freitag', unitId: 'a1.u6', order: 44, type: 'statement', german: 'Ich habe am Freitag Zeit.', portuguese: 'Tenho tempo na sexta-feira.' },
    { id: 'a1-time-wann', unitId: 'a1.u6', order: 45, type: 'question', german: 'Wann hast du Zeit?', portuguese: 'Quando você tem tempo?' },
    { id: 'a1-time-treffen', unitId: 'a1.u6', order: 46, type: 'statement', german: 'Wir treffen uns um fünf Uhr.', portuguese: 'Nos encontramos às cinco.' },
    { id: 'a1-time-morgen', unitId: 'a1.u6', order: 47, type: 'statement', german: 'Morgen gehe ich einkaufen.', portuguese: 'Amanhã eu vou às compras.' },
    { id: 'a1-time-wochenende', unitId: 'a1.u6', order: 48, type: 'statement', german: 'Am Wochenende möchte ich Freunde treffen.', portuguese: 'No fim de semana gostaria de encontrar amigos.' },
    { id: 'a1-time-mit-freunden', unitId: 'a1.u6', order: 49, type: 'statement', german: 'Ich gehe mit Freunden ins Kino.', portuguese: 'Eu vou ao cinema com amigos.' },
  ] },
  { competencyId: 'a1.help', level: 'A1', categories: ['survival', 'everyday'], core: [
    { id: 'a1-help-koennen', unitId: 'a1.u7', order: 50, type: 'request', german: 'Können Sie mir helfen, bitte?', portuguese: 'Você pode me ajudar, por favor?' },
    { id: 'a1-help-brauche', unitId: 'a1.u7', order: 51, type: 'statement', german: 'Ich brauche Hilfe.', portuguese: 'Eu preciso de ajuda.' },
    { id: 'a1-help-wiederholen', unitId: 'a1.u7', order: 52, type: 'request', german: 'Können Sie das bitte wiederholen?', portuguese: 'Pode repetir, por favor?' },
    { id: 'a1-everyday-einladung', unitId: 'a1.u7', order: 53, type: 'statement', german: 'Hast du Lust, am Samstag zu kommen?', portuguese: 'Você tem vontade de vir no sábado?' },
    { id: 'a1-everyday-ablehnen', unitId: 'a1.u7', order: 54, type: 'statement', german: 'Leider kann ich nicht. Ich habe keine Zeit.', portuguese: 'Infelizmente não posso. Não tenho tempo.' },
    { id: 'a1-everyday-problem', unitId: 'a1.u7', order: 55, type: 'statement', german: 'Entschuldigung, das ist mein Fehler.', portuguese: 'Desculpe, isso foi meu erro.' },
    { id: 'a1-everyday-bei-arbeit', unitId: 'a1.u7', order: 56, type: 'statement', german: 'Ich bin bei der Arbeit.', portuguese: 'Eu estou no trabalho.' },
    { id: 'a1-everyday-perfekt-wochenende', unitId: 'a1.u7', order: 57, type: 'statement', german: 'Am Wochenende habe ich Fußball gespielt.', portuguese: 'No fim de semana eu joguei futebol.' },
    { id: 'a1-everyday-perfekt-essen', unitId: 'a1.u7', order: 58, type: 'statement', german: 'Gestern habe ich Pizza gegessen.', portuguese: 'Ontem eu comi pizza.' },
  ] },

  // ---------------- A2 (curso escolar comunicativo — 6 unidades existentes) ----------------
  // u1 Experiências | u2 Casa/moradia | u3 Saúde | u4 Trabalho | u5 Viagem | u6 Compras+lazer+planos
  { competencyId: 'a2.past', level: 'A2', categories: ['daily', 'social'], core: [
    { id: 'a2-past-gearbeitet', unitId: 'a2.u1', order: 1, type: 'statement', german: 'Ich habe gestern gearbeitet.', portuguese: 'Eu trabalhei ontem.' },
    { id: 'a2-past-kino', unitId: 'a2.u1', order: 2, type: 'statement', german: 'Wir waren im Kino.', portuguese: 'Fomos ao cinema.' },
    { id: 'a2-past-gemacht', unitId: 'a2.u1', order: 3, type: 'question', german: 'Was hast du gemacht?', portuguese: 'O que você fez?' },
    { id: 'a2-past-wochenende', unitId: 'a2.u1', order: 4, type: 'statement', german: 'Am Wochenende bin ich spazieren gegangen.', portuguese: 'No fim de semana eu fui caminhar.' },
    { id: 'a2-past-besucht', unitId: 'a2.u1', order: 5, type: 'statement', german: 'Ich habe Freunde besucht.', portuguese: 'Eu visitei amigos.' },
    { id: 'a2-past-gegessen', unitId: 'a2.u1', order: 6, type: 'statement', german: 'Wir haben in einem Restaurant gegessen.', portuguese: 'Comemos num restaurante.' },
    { id: 'a2-past-gewesen', unitId: 'a2.u1', order: 7, type: 'question', german: 'Wie war es?', portuguese: 'Como foi?' },
    { id: 'a2-past-passiert', unitId: 'a2.u1', order: 8, type: 'question', german: 'Was ist passiert?', portuguese: 'O que aconteceu?' },
    { id: 'a2-past-erzaehlen', unitId: 'a2.u1', order: 9, type: 'statement', german: 'Zuerst …, dann …, und danach …', portuguese: 'Primeiro …, depois …, e em seguida …' },
  ] },
  { competencyId: 'a2.plans', level: 'A2', categories: ['daily', 'housing'], core: [
    { id: 'a2-home-wohne', unitId: 'a2.u2', order: 10, type: 'statement', german: 'Ich wohne in einer Wohnung.', portuguese: 'Eu moro num apartamento.' },
    { id: 'a2-home-zimmer', unitId: 'a2.u2', order: 11, type: 'statement', german: 'Es gibt zwei Zimmer.', portuguese: 'Há dois cômodos.' },
    { id: 'a2-home-kueche', unitId: 'a2.u2', order: 12, type: 'statement', german: 'Die Küche ist groß.', portuguese: 'A cozinha é grande.' },
    { id: 'a2-problem-wohnung', unitId: 'a2.u2', order: 13, type: 'statement', german: 'Die Wohnung ist zu klein.', portuguese: 'O apartamento é pequeno demais.' },
    { id: 'a2-home-nachbarn', unitId: 'a2.u2', order: 14, type: 'statement', german: 'Die Nachbarn sind nett.', portuguese: 'Os vizinhos são simpáticos.' },
    { id: 'a2-home-naehe', unitId: 'a2.u2', order: 15, type: 'statement', german: 'Es gibt einen Supermarkt in der Nähe.', portuguese: 'Há um supermercado perto.' },
    { id: 'a2-home-miete', unitId: 'a2.u2', order: 16, type: 'statement', german: 'Die Miete ist zu teuer.', portuguese: 'O aluguel é caro demais.' },
    { id: 'a2-home-heizung', unitId: 'a2.u2', order: 17, type: 'statement', german: 'Die Heizung funktioniert nicht.', portuguese: 'O aquecimento não funciona.' },
    { id: 'a2-home-hilfe', unitId: 'a2.u2', order: 18, type: 'question', german: 'Können Sie mir bitte helfen?', portuguese: 'Pode me ajudar, por favor?' },
  ] },
  { competencyId: 'a2.problem', level: 'A2', categories: ['health'], core: [
    { id: 'a2-problem-nicht-gut', unitId: 'a2.u3', order: 19, type: 'statement', german: 'Mir geht es nicht gut.', portuguese: 'Não estou me sentindo bem.' },
    { id: 'a2-problem-mit', unitId: 'a2.u3', order: 20, type: 'statement', german: 'Ich habe ein Problem mit …', portuguese: 'Tenho um problema com …' },
    { id: 'a2-health-kopfschmerzen', unitId: 'a2.u3', order: 21, type: 'statement', german: 'Ich habe Kopfschmerzen.', portuguese: 'Estou com dor de cabeça.' },
    { id: 'a2-health-schmerz', unitId: 'a2.u3', order: 22, type: 'statement', german: 'Hier tut es weh.', portuguese: 'Dói aqui.' },
    { id: 'a2-health-apotheke', unitId: 'a2.u3', order: 23, type: 'question', german: 'Wo ist die Apotheke?', portuguese: 'Onde fica a farmácia?' },
    { id: 'a2-health-termin', unitId: 'a2.u3', order: 24, type: 'statement', german: 'Ich möchte einen Termin machen.', portuguese: 'Quero marcar uma consulta.' },
    { id: 'a2-health-medikament', unitId: 'a2.u3', order: 25, type: 'question', german: 'Brauche ich ein Medikament?', portuguese: 'Preciso de um medicamento?' },
    { id: 'a2-health-ruhen', unitId: 'a2.u3', order: 26, type: 'statement', german: 'Ich muss mich ausruhen.', portuguese: 'Preciso descansar.' },
    { id: 'a2-health-fieber', unitId: 'a2.u3', order: 27, type: 'statement', german: 'Ich habe Fieber.', portuguese: 'Estou com febre.' },
  ] },
  { competencyId: 'a2.phone', level: 'A2', categories: ['work', 'phone'], core: [
    { id: 'a2-phone-hier-ist', unitId: 'a2.u4', order: 28, type: 'statement', german: 'Hallo, hier ist …', portuguese: 'Olá, aqui é …' },
    { id: 'a2-phone-nachricht', unitId: 'a2.u4', order: 29, type: 'question', german: 'Kann ich eine Nachricht hinterlassen?', portuguese: 'Posso deixar um recado?' },
    { id: 'a2-phone-spaeter', unitId: 'a2.u4', order: 30, type: 'statement', german: 'Ich rufe später an.', portuguese: 'Eu ligo mais tarde.' },
    { id: 'a2-work-aufgabe', unitId: 'a2.u4', order: 31, type: 'statement', german: 'Ich muss diese Aufgabe erledigen.', portuguese: 'Preciso concluir esta tarefa.' },
    { id: 'a2-work-spaet', unitId: 'a2.u4', order: 32, type: 'statement', german: 'Ich komme heute etwas später.', portuguese: 'Hoje vou chegar um pouco atrasado.' },
    { id: 'a2-work-erklaeren', unitId: 'a2.u4', order: 33, type: 'question', german: 'Können Sie das bitte erklären?', portuguese: 'Pode explicar isso, por favor?' },
    { id: 'a2-work-kollegen', unitId: 'a2.u4', order: 34, type: 'statement', german: 'Meine Kollegen sind hilfreich.', portuguese: 'Meus colegas são prestativos.' },
    { id: 'a2-work-schwierig', unitId: 'a2.u4', order: 35, type: 'statement', german: 'Das ist schwierig für mich.', portuguese: 'Isso é difícil para mim.' },
    { id: 'a2-work-termin', unitId: 'a2.u4', order: 36, type: 'question', german: 'Haben wir heute ein Meeting?', portuguese: 'Temos reunião hoje?' },
  ] },
  { competencyId: 'a2.travel', level: 'A2', categories: ['travel'], core: [
    { id: 'a2-travel-berlin', unitId: 'a2.u5', order: 37, type: 'statement', german: 'Ich bin nach Berlin gefahren.', portuguese: 'Eu fui para Berlim.' },
    { id: 'a2-travel-reise', unitId: 'a2.u5', order: 38, type: 'statement', german: 'Die Reise war schön.', portuguese: 'A viagem foi boa.' },
    { id: 'a2-travel-uebernachten', unitId: 'a2.u5', order: 39, type: 'question', german: 'Wo übernachten wir?', portuguese: 'Onde vamos dormir?' },
    { id: 'a2-travel-hotel', unitId: 'a2.u5', order: 40, type: 'statement', german: 'Ich habe ein Zimmer reserviert.', portuguese: 'Reservei um quarto.' },
    { id: 'a2-travel-zug', unitId: 'a2.u5', order: 41, type: 'question', german: 'Wann fährt der Zug?', portuguese: 'Quando sai o trem?' },
    { id: 'a2-travel-verspaetet', unitId: 'a2.u5', order: 42, type: 'statement', german: 'Der Zug hat Verspätung.', portuguese: 'O trem está atrasado.' },
    { id: 'a2-travel-fahrkarte', unitId: 'a2.u5', order: 43, type: 'statement', german: 'Eine Fahrkarte nach München, bitte.', portuguese: 'Uma passagem para Munique, por favor.' },
    { id: 'a2-travel-weg', unitId: 'a2.u5', order: 44, type: 'question', german: 'Wie komme ich zum Bahnhof?', portuguese: 'Como chego à estação?' },
    { id: 'a2-travel-beschwerde', unitId: 'a2.u5', order: 45, type: 'statement', german: 'Es gibt ein Problem mit meinem Zimmer.', portuguese: 'Há um problema com o meu quarto.' },
  ] },
  { competencyId: 'a2.opinion', level: 'A2', categories: ['social', 'shopping'], core: [
    { id: 'a2-opinion-finde', unitId: 'a2.u6', order: 46, type: 'statement', german: 'Ich finde das gut.', portuguese: 'Eu acho isso bom.' },
    { id: 'a2-opinion-meinung', unitId: 'a2.u6', order: 47, type: 'statement', german: 'Meiner Meinung nach …', portuguese: 'Na minha opinião …' },
    { id: 'a2-opinion-lieber', unitId: 'a2.u6', order: 48, type: 'statement', german: 'Ich mag … lieber.', portuguese: 'Eu prefiro …' },
    { id: 'a2-plans-werde', unitId: 'a2.u6', order: 49, type: 'statement', german: 'Morgen werde ich …', portuguese: 'Amanhã eu vou …' },
    { id: 'a2-plans-plane', unitId: 'a2.u6', order: 50, type: 'statement', german: 'Ich plane, …', portuguese: 'Eu planejo …' },
    { id: 'a2-plans-reisen', unitId: 'a2.u6', order: 51, type: 'statement', german: 'Nächstes Jahr möchte ich reisen.', portuguese: 'No próximo ano quero viajar.' },
    { id: 'a2-shop-defekt', unitId: 'a2.u6', order: 52, type: 'statement', german: 'Das Produkt ist kaputt.', portuguese: 'O produto está com defeito.' },
    { id: 'a2-shop-umtauschen', unitId: 'a2.u6', order: 53, type: 'statement', german: 'Ich möchte das umtauschen.', portuguese: 'Quero trocar isto.' },
    { id: 'a2-shop-guenstiger', unitId: 'a2.u6', order: 54, type: 'statement', german: 'Das ist günstiger.', portuguese: 'Isto é mais barato.' },
    { id: 'a2-invite-kommen', unitId: 'a2.u6', order: 55, type: 'question', german: 'Möchtest du am Samstag kommen?', portuguese: 'Você quer vir no sábado?' },
    { id: 'a2-invite-leider', unitId: 'a2.u6', order: 56, type: 'statement', german: 'Leider kann ich nicht.', portuguese: 'Infelizmente não posso.' },
    { id: 'a2-invite-helfen', unitId: 'a2.u6', order: 57, type: 'question', german: 'Kannst du mir bitte helfen?', portuguese: 'Pode me ajudar, por favor?' },
  ] },

  // ---------------- B1 (curso escolar comunicativo — 7 unidades existentes) ----------------
  // u1 História | u2 Opiniões/planos | u3 Trabalho | u4 Cultura/mídia/viagem | u5 Moradia/serviços | u6 Apresentação profissional | u7 Saúde/prático
  { competencyId: 'b1.story', level: 'B1', categories: ['daily', 'social'], core: [
    { id: 'b1-story-muenchen', unitId: 'b1.u1', order: 1, type: 'statement', german: 'Letztes Jahr bin ich nach München gezogen.', portuguese: 'No ano passado me mudei para Munique.' },
    { id: 'b1-story-geklappt', unitId: 'b1.u1', order: 2, type: 'statement', german: 'Zuerst war es schwer, aber dann hat es geklappt.', portuguese: 'No começo foi difícil, mas depois deu certo.' },
    { id: 'b1-story-weil', unitId: 'b1.u1', order: 3, type: 'statement', german: 'Das habe ich gemacht, weil …', portuguese: 'Eu fiz isso porque …' },
    { id: 'b1-story-reise', unitId: 'b1.u1', order: 4, type: 'statement', german: 'Auf der Reise ist viel passiert.', portuguese: 'Na viagem aconteceu muita coisa.' },
    { id: 'b1-story-entscheidung', unitId: 'b1.u1', order: 5, type: 'statement', german: 'Damals habe ich mich entschieden, …', portuguese: 'Naquela época decidi …' },
    { id: 'b1-story-vorher', unitId: 'b1.u1', order: 6, type: 'statement', german: 'Vorher war alles anders.', portuguese: 'Antes tudo era diferente.' },
    { id: 'b1-story-danach', unitId: 'b1.u1', order: 7, type: 'statement', german: 'Danach hat sich vieles verändert.', portuguese: 'Depois disso muita coisa mudou.' },
    { id: 'b1-story-ziel', unitId: 'b1.u1', order: 8, type: 'statement', german: 'Mein Ziel war es, …', portuguese: 'Meu objetivo era …' },
  ] },
  { competencyId: 'b1.opinion_justify', level: 'B1', categories: ['social'], core: [
    { id: 'b1-opinion-meinung', unitId: 'b1.u2', order: 9, type: 'statement', german: 'Ich bin der Meinung, dass …', portuguese: 'Sou da opinião de que …' },
    { id: 'b1-opinion-deshalb', unitId: 'b1.u2', order: 10, type: 'statement', german: 'Das finde ich deshalb, weil …', portuguese: 'Acho isso porque …' },
    { id: 'b1-opinion-seiten', unitId: 'b1.u2', order: 11, type: 'statement', german: 'Auf der einen Seite …, auf der anderen Seite …', portuguese: 'Por um lado …, por outro …' },
    { id: 'b1-opinion-stimme-zu', unitId: 'b1.u2', order: 12, type: 'statement', german: 'Da stimme ich Ihnen zu.', portuguese: 'Concordo com você nisso.' },
    { id: 'b1-opinion-anders', unitId: 'b1.u2', order: 13, type: 'statement', german: 'Ich sehe das etwas anders.', portuguese: 'Vejo isso um pouco diferente.' },
    { id: 'b1-opinion-vorschlagen', unitId: 'b1.u2', order: 14, type: 'statement', german: 'Ich würde vorschlagen, dass wir …', portuguese: 'Eu sugeriria que nós …' },
    { id: 'b1-opinion-vergleichen', unitId: 'b1.u2', order: 15, type: 'statement', german: 'Wenn man die beiden Optionen vergleicht, …', portuguese: 'Se compararmos as duas opções, …' },
    { id: 'b1-opinion-entscheiden', unitId: 'b1.u2', order: 16, type: 'statement', german: 'Deshalb entscheide ich mich für …', portuguese: 'Por isso escolho …' },
    { id: 'b1-opinion-planen', unitId: 'b1.u2', order: 17, type: 'question', german: 'Wann passt es Ihnen, dass wir uns treffen?', portuguese: 'Quando lhe convém nos encontrarmos?' },
  ] },
  { competencyId: 'b1.work_social', level: 'B1', categories: ['work', 'social'], core: [
    { id: 'b1-work-wochenende', unitId: 'b1.u3', order: 18, type: 'question', german: 'Wie war Ihr Wochenende?', portuguese: 'Como foi o seu fim de semana?' },
    { id: 'b1-work-besprechen', unitId: 'b1.u3', order: 19, type: 'question', german: 'Können wir das besprechen?', portuguese: 'Podemos conversar sobre isso?' },
    { id: 'b1-work-schlage', unitId: 'b1.u3', order: 20, type: 'statement', german: 'Ich schlage vor, dass …', portuguese: 'Sugiro que …' },
    { id: 'b1-work-aufgaben', unitId: 'b1.u3', order: 21, type: 'statement', german: 'Zu meinen Aufgaben gehört, …', portuguese: 'Entre as minhas tarefas está …' },
    { id: 'b1-work-erfahrung', unitId: 'b1.u3', order: 22, type: 'statement', german: 'Ich habe Erfahrung mit …', portuguese: 'Tenho experiência com …' },
    { id: 'b1-work-schwierigkeit', unitId: 'b1.u3', order: 23, type: 'statement', german: 'Die größte Schwierigkeit ist, dass …', portuguese: 'A maior dificuldade é que …' },
    { id: 'b1-work-loesung', unitId: 'b1.u3', order: 24, type: 'statement', german: 'Eine mögliche Lösung wäre, …', portuguese: 'Uma solução possível seria …' },
    { id: 'b1-work-karriere', unitId: 'b1.u3', order: 25, type: 'statement', german: 'In Zukunft möchte ich …', portuguese: 'No futuro gostaria de …' },
  ] },
  { competencyId: 'b1.news', level: 'B1', categories: ['daily', 'travel', 'social'], core: [
    { id: 'b1-news-nachrichten', unitId: 'b1.u4', order: 26, type: 'statement', german: 'In den Nachrichten stand, dass …', portuguese: 'Nas notícias dizia que …' },
    { id: 'b1-news-gehoert', unitId: 'b1.u4', order: 27, type: 'question', german: 'Haben Sie das gehört?', portuguese: 'Você ouviu isso?' },
    { id: 'b1-news-interessiert', unitId: 'b1.u4', order: 28, type: 'statement', german: 'Das interessiert mich.', portuguese: 'Isso me interessa.' },
    { id: 'b1-media-empfehlen', unitId: 'b1.u4', order: 29, type: 'statement', german: 'Ich kann Ihnen diesen Film empfehlen, weil …', portuguese: 'Posso recomendar este filme porque …' },
    { id: 'b1-media-serie', unitId: 'b1.u4', order: 30, type: 'statement', german: 'Die Serie handelt davon, dass …', portuguese: 'A série trata de …' },
    { id: 'b1-travel-aendern', unitId: 'b1.u4', order: 31, type: 'statement', german: 'Ich möchte meine Reservierung ändern.', portuguese: 'Quero alterar a minha reserva.' },
    { id: 'b1-travel-erstattung', unitId: 'b1.u4', order: 32, type: 'question', german: 'Kann ich eine Erstattung bekommen?', portuguese: 'Posso receber um reembolso?' },
    { id: 'b1-travel-ort', unitId: 'b1.u4', order: 33, type: 'statement', german: 'Diesen Ort kann ich sehr empfehlen.', portuguese: 'Posso recomendar muito este lugar.' },
  ] },
  { competencyId: 'b1.explain_problem', level: 'B1', categories: ['work', 'home'], core: [
    { id: 'b1-problem-und-zwar', unitId: 'b1.u5', order: 34, type: 'statement', german: 'Ich habe ein Problem, und zwar …', portuguese: 'Tenho um problema, a saber …' },
    { id: 'b1-problem-helfen', unitId: 'b1.u5', order: 35, type: 'question', german: 'Können Sie mir dabei helfen?', portuguese: 'Você pode me ajudar com isso?' },
    { id: 'b1-problem-folgendes', unitId: 'b1.u5', order: 36, type: 'statement', german: 'Es geht um Folgendes …', portuguese: 'Trata-se do seguinte …' },
    { id: 'b1-home-suche', unitId: 'b1.u5', order: 37, type: 'statement', german: 'Ich suche eine Wohnung in dieser Gegend.', portuguese: 'Procuro um apartamento nesta região.' },
    { id: 'b1-home-defekt', unitId: 'b1.u5', order: 38, type: 'statement', german: 'Seit gestern funktioniert die Heizung nicht.', portuguese: 'Desde ontem o aquecimento não funciona.' },
    { id: 'b1-home-vermieter', unitId: 'b1.u5', order: 39, type: 'statement', german: 'Ich habe den Vermieter bereits informiert.', portuguese: 'Já informei o proprietário.' },
    { id: 'b1-home-beschwerde', unitId: 'b1.u5', order: 40, type: 'statement', german: 'Ich möchte mich über den Service beschweren.', portuguese: 'Quero reclamar do serviço.' },
    { id: 'b1-home-frist', unitId: 'b1.u5', order: 41, type: 'question', german: 'Bis wann muss das erledigt sein?', portuguese: 'Até quando isso precisa estar resolvido?' },
  ] },
  { competencyId: 'b1.present', level: 'B1', categories: ['work'], core: [
    { id: 'b1-present-thema', unitId: 'b1.u6', order: 42, type: 'statement', german: 'Mein Thema heute ist …', portuguese: 'Meu tema hoje é …' },
    { id: 'b1-present-punkten', unitId: 'b1.u6', order: 43, type: 'statement', german: 'Lassen Sie uns mit den wichtigsten Punkten beginnen.', portuguese: 'Vamos começar com os pontos mais importantes.' },
    { id: 'b1-present-fragen', unitId: 'b1.u6', order: 44, type: 'question', german: 'Gibt es dazu Fragen?', portuguese: 'Há perguntas sobre isso?' },
    { id: 'b1-present-ausbildung', unitId: 'b1.u6', order: 45, type: 'statement', german: 'Ich habe … studiert / gelernt.', portuguese: 'Estudei / aprendi …' },
    { id: 'b1-present-staerken', unitId: 'b1.u6', order: 46, type: 'statement', german: 'Zu meinen Stärken gehört, dass …', portuguese: 'Entre os meus pontos fortes está …' },
    { id: 'b1-present-wahl', unitId: 'b1.u6', order: 47, type: 'statement', german: 'Ich habe mich für diesen Weg entschieden, weil …', portuguese: 'Escolhi este caminho porque …' },
    { id: 'b1-present-zusammen', unitId: 'b1.u6', order: 48, type: 'statement', german: 'Zusammenfassend möchte ich sagen, dass …', portuguese: 'Em resumo, gostaria de dizer que …' },
    { id: 'b1-present-naechste', unitId: 'b1.u6', order: 49, type: 'statement', german: 'Als Nächstes plane ich, …', portuguese: 'A seguir planejo …' },
  ] },
  { competencyId: 'b1.live_daily', level: 'B1', categories: ['daily', 'health'], core: [
    { id: 'b1-daily-erledigt', unitId: 'b1.u7', order: 50, type: 'statement', german: 'Ich habe alles erledigt.', portuguese: 'Eu terminei tudo.' },
    { id: 'b1-daily-termin', unitId: 'b1.u7', order: 51, type: 'question', german: 'Kann ich einen Termin machen?', portuguese: 'Posso marcar um horário?' },
    { id: 'b1-daily-passt', unitId: 'b1.u7', order: 52, type: 'statement', german: 'Das passt mir gut.', portuguese: 'Isso me serve bem.' },
    { id: 'b1-health-symptome', unitId: 'b1.u7', order: 53, type: 'statement', german: 'Seit ein paar Tagen habe ich …', portuguese: 'Há alguns dias tenho …' },
    { id: 'b1-health-versicherung', unitId: 'b1.u7', order: 54, type: 'question', german: 'Übernimmt die Versicherung die Kosten?', portuguese: 'O seguro cobre os custos?' },
    { id: 'b1-health-empfehlung', unitId: 'b1.u7', order: 55, type: 'statement', german: 'Der Arzt hat mir empfohlen, dass …', portuguese: 'O médico me recomendou que …' },
    { id: 'b1-daily-unvorhergesehen', unitId: 'b1.u7', order: 56, type: 'statement', german: 'Leider ist etwas Unvorhergesehenes passiert.', portuguese: 'Infelizmente aconteceu algo imprevisto.' },
    { id: 'b1-daily-hilfe-bitten', unitId: 'b1.u7', order: 57, type: 'question', german: 'Könnten Sie mir bitte erklären, wie das geht?', portuguese: 'Poderia me explicar como isso funciona?' },
  ] },

  // ---------------- B2 (curso escolar comunicativo — 8 unidades existentes) ----------------
  // u1 Cultura/identidade | u2 Sociedade/tech | u3 Argumentação | u4 Comparação | u5 Conflitos/serviços | u6 Trabalho | u7 Defesa/negociação | u8 Integração
  { competencyId: 'b2.narrative', level: 'B2', categories: ['travel', 'social', 'daily'], core: [
    { id: 'b2-narrative-erfahrung', unitId: 'b2.u1', order: 1, type: 'statement', german: 'Letztes Jahr habe ich eine Erfahrung gemacht, die meine Sicht auf die Arbeit völlig verändert hat.', portuguese: 'No ano passado tive uma experiência que mudou completamente a minha visão sobre o trabalho.' },
    { id: 'b2-narrative-damals', unitId: 'b2.u1', order: 2, type: 'statement', german: 'Damals hätte ich nicht gedacht, dass daraus etwas so Wichtiges entstehen würde.', portuguese: 'Naquela época eu não teria imaginado que daquilo surgiria algo tão importante.' },
    { id: 'b2-narrative-rueckblick', unitId: 'b2.u1', order: 3, type: 'statement', german: 'Im Rückblick sehe ich klar, warum diese Situation mich so geprägt hat.', portuguese: 'Em retrospectiva vejo claramente por que essa situação me marcou tanto.' },
    { id: 'b2-culture-empfehlen', unitId: 'b2.u1', order: 4, type: 'statement', german: 'Diesen Ort / dieses Event kann ich empfehlen, weil …', portuguese: 'Posso recomendar este lugar / evento porque …' },
    { id: 'b2-culture-gewohnheiten', unitId: 'b2.u1', order: 5, type: 'statement', german: 'Im Vergleich zu früher unterscheiden sich die Gewohnheiten deutlich.', portuguese: 'Em comparação com antes, os hábitos diferem claramente.' },
    { id: 'b2-culture-anpassung', unitId: 'b2.u1', order: 6, type: 'statement', german: 'Die Anpassung an eine neue Umgebung hat mich gelehrt, dass …', portuguese: 'A adaptação a um novo ambiente me ensinou que …' },
    { id: 'b2-culture-identitaet', unitId: 'b2.u1', order: 7, type: 'statement', german: 'Für meine Identität spielt … eine wichtige Rolle.', portuguese: 'Para a minha identidade, … desempenha um papel importante.' },
  ] },
  { competencyId: 'b2.cause_effect', level: 'B2', categories: ['social', 'work'], core: [
    { id: 'b2-cause-dadurch', unitId: 'b2.u2', order: 8, type: 'statement', german: 'Dadurch, dass wir die Prioritäten geändert haben, ist der Druck deutlich gesunken.', portuguese: 'Ao mudarmos as prioridades, a pressão caiu claramente.' },
    { id: 'b2-cause-waere', unitId: 'b2.u2', order: 9, type: 'statement', german: 'Wenn wir früher kommuniziert hätten, wäre der Konflikt vermeidbar gewesen.', portuguese: 'Se tivéssemos comunicado mais cedo, o conflito teria sido evitável.' },
    { id: 'b2-cause-folglich', unitId: 'b2.u2', order: 10, type: 'statement', german: 'Folglich mussten wir den Plan überarbeiten und neue Verantwortlichkeiten klären.', portuguese: 'Consequentemente tivemos de rever o plano e esclarecer novas responsabilidades.' },
    { id: 'b2-society-technik', unitId: 'b2.u2', order: 11, type: 'statement', german: 'Die Technik erleichtert vieles, obwohl sie auch neue Risiken schafft.', portuguese: 'A tecnologia facilita muita coisa, embora também crie novos riscos.' },
    { id: 'b2-society-medien', unitId: 'b2.u2', order: 12, type: 'statement', german: 'In den Medien wird oft vereinfacht dargestellt, was eigentlich komplex ist.', portuguese: 'Na mídia muitas vezes se simplifica o que é complexo.' },
    { id: 'b2-society-datenschutz', unitId: 'b2.u2', order: 13, type: 'statement', german: 'Beim Datenschutz geht es darum, dass Nutzer die Kontrolle behalten.', portuguese: 'Na proteção de dados trata-se de os utilizadores manterem o controlo.' },
    { id: 'b2-society-bildung', unitId: 'b2.u2', order: 14, type: 'statement', german: 'Bildung und digitale Kompetenz hängen eng zusammen.', portuguese: 'Educação e competência digital estão intimamente ligadas.' },
  ] },
  { competencyId: 'b2.argue', level: 'B2', categories: ['social', 'work'], core: [
    { id: 'b2-argue-auffassung', unitId: 'b2.u3', order: 15, type: 'statement', german: 'Ich vertrete die Auffassung, dass wir hier einen klaren Qualitätsstandard brauchen.', portuguese: 'Defendo a visão de que precisamos aqui de um padrão de qualidade claro.' },
    { id: 'b2-argue-dagegen', unitId: 'b2.u3', order: 16, type: 'statement', german: 'Dagegen spricht vor allem, dass der Zeitplan unrealistisch ist.', portuguese: 'Contra isso fala sobretudo que o cronograma é irrealista.' },
    { id: 'b2-argue-laesst', unitId: 'b2.u3', order: 17, type: 'statement', german: 'Das lässt sich so pauschal nicht sagen — der Kontext entscheidet.', portuguese: 'Não se pode dizer isso de forma genérica — o contexto decide.' },
    { id: 'b2-argue-beispiel', unitId: 'b2.u3', order: 18, type: 'statement', german: 'Ein konkretes Beispiel dafür ist …', portuguese: 'Um exemplo concreto disso é …' },
    { id: 'b2-argue-schluss', unitId: 'b2.u3', order: 19, type: 'statement', german: 'Daraus folgt, dass wir uns klar positionieren sollten.', portuguese: 'Disso resulta que deveríamos nos posicionar com clareza.' },
    { id: 'b2-argue-einwand', unitId: 'b2.u3', order: 20, type: 'statement', german: 'Ihr Einwand ist nachvollziehbar, dennoch bleibe ich bei …', portuguese: 'A sua objeção é compreensível; mesmo assim mantenho …' },
    { id: 'b2-argue-konsens', unitId: 'b2.u3', order: 21, type: 'statement', german: 'Vielleicht finden wir einen Konsens, wenn wir …', portuguese: 'Talvez encontremos um consenso se …' },
  ] },
  { competencyId: 'b2.compare', level: 'B2', categories: ['work', 'social'], core: [
    { id: 'b2-compare-optionen', unitId: 'b2.u4', order: 22, type: 'statement', german: 'Im Vergleich zur ersten Option ist die zweite langfristig stabiler.', portuguese: 'Em comparação com a primeira opção, a segunda é mais estável a longo prazo.' },
    { id: 'b2-compare-vorteile', unitId: 'b2.u4', order: 23, type: 'statement', german: 'Beide Wege haben Vorteile, aber nur einer passt zu unseren Ressourcen.', portuguese: 'Ambos os caminhos têm vantagens, mas só um cabe nos nossos recursos.' },
    { id: 'b2-compare-abwaegen', unitId: 'b2.u4', order: 24, type: 'statement', german: 'Wenn man Kosten und Nutzen abwägt, ist der Kompromiss die bessere Wahl.', portuguese: 'Se se ponderam custos e benefícios, o compromisso é a melhor escolha.' },
    { id: 'b2-compare-nachteile', unitId: 'b2.u4', order: 25, type: 'statement', german: 'Der Nachteil dieser Lösung besteht darin, dass …', portuguese: 'A desvantagem desta solução consiste em que …' },
    { id: 'b2-compare-folgen', unitId: 'b2.u4', order: 26, type: 'statement', german: 'Die möglichen Folgen wären …', portuguese: 'As possíveis consequências seriam …' },
    { id: 'b2-compare-entscheiden', unitId: 'b2.u4', order: 27, type: 'statement', german: 'Unter diesen Umständen entscheide ich mich für …', portuguese: 'Nestas circunstâncias, decido-me por …' },
    { id: 'b2-compare-begruenden', unitId: 'b2.u4', order: 28, type: 'statement', german: 'Meine Entscheidung begründe ich damit, dass …', portuguese: 'Justifico a minha decisão com o facto de que …' },
  ] },
  { competencyId: 'b2.problems_solutions', level: 'B2', categories: ['work', 'home', 'daily'], core: [
    { id: 'b2-solve-problem', unitId: 'b2.u5', order: 29, type: 'statement', german: 'Das eigentliche Problem liegt darin, dass niemand die Verantwortung übernommen hat.', portuguese: 'O problema real está em que ninguém assumiu a responsabilidade.' },
    { id: 'b2-solve-vorschlag', unitId: 'b2.u5', order: 30, type: 'statement', german: 'Mein Vorschlag wäre, dass wir zuerst die Ursachen klären und dann priorisieren.', portuguese: 'Minha proposta seria esclarecermos primeiro as causas e depois priorizarmos.' },
    { id: 'b2-solve-schritt', unitId: 'b2.u5', order: 31, type: 'statement', german: 'Als nächsten Schritt sollten wir eine kurze Retrospektive mit konkreten Maßnahmen machen.', portuguese: 'Como próximo passo deveríamos fazer uma retrospectiva curta com medidas concretas.' },
    { id: 'b2-service-vertrag', unitId: 'b2.u5', order: 32, type: 'statement', german: 'Im Vertrag steht, dass … — das verstehe ich so, dass …', portuguese: 'No contrato está que … — entendo isso como …' },
    { id: 'b2-service-versicherung', unitId: 'b2.u5', order: 33, type: 'question', german: 'Welche Bedingungen gelten für die Erstattung?', portuguese: 'Que condições se aplicam ao reembolso?' },
    { id: 'b2-service-beschwerde', unitId: 'b2.u5', order: 34, type: 'statement', german: 'Ich möchte eine formelle Beschwerde einreichen, weil …', portuguese: 'Quero apresentar uma reclamação formal porque …' },
    { id: 'b2-service-bedingungen', unitId: 'b2.u5', order: 35, type: 'statement', german: 'Bevor ich zustimme, brauche ich Klarheit über die Bedingungen.', portuguese: 'Antes de concordar, preciso de clareza sobre as condições.' },
  ] },
  { competencyId: 'b2.work_pro', level: 'B2', categories: ['work'], core: [
    { id: 'b2-work-optionen', unitId: 'b2.u6', order: 36, type: 'statement', german: 'Wir sollten folgende Optionen prüfen, bevor wir uns festlegen.', portuguese: 'Deveríamos avaliar as seguintes opções antes de nos decidir.' },
    { id: 'b2-work-kompromiss', unitId: 'b2.u6', order: 37, type: 'statement', german: 'Lassen Sie uns auf einen Kompromiss hinarbeiten, der beide Seiten entlastet.', portuguese: 'Vamos buscar um compromisso que alivie ambos os lados.' },
    { id: 'b2-work-verhandelbar', unitId: 'b2.u6', order: 38, type: 'statement', german: 'Das ist aus meiner Sicht verhandelbar, solange die Qualität nicht leidet.', portuguese: 'Do meu ponto de vista isso é negociável, desde que a qualidade não sofra.' },
    { id: 'b2-work-praesentation', unitId: 'b2.u6', order: 39, type: 'statement', german: 'In meiner kurzen Präsentation möchte ich drei Punkte hervorheben.', portuguese: 'Na minha apresentação curta quero destacar três pontos.' },
    { id: 'b2-work-feedback', unitId: 'b2.u6', order: 40, type: 'statement', german: 'Mein Feedback dazu ist, dass der Prozess klarer dokumentiert werden sollte.', portuguese: 'O meu feedback é que o processo deveria ser documentado com mais clareza.' },
    { id: 'b2-work-frist', unitId: 'b2.u6', order: 41, type: 'statement', german: 'Können wir die Frist verschieben, damit die Qualität gesichert bleibt?', portuguese: 'Podemos adiar o prazo para a qualidade ficar assegurada?' },
    { id: 'b2-work-prozess', unitId: 'b2.u6', order: 42, type: 'statement', german: 'Der Prozess funktioniert so, dass zuerst … und anschließend …', portuguese: 'O processo funciona assim: primeiro … e em seguida …' },
  ] },
  { competencyId: 'b2.defend', level: 'B2', categories: ['work', 'social'], core: [
    { id: 'b2-defend-entscheidung', unitId: 'b2.u7', order: 43, type: 'statement', german: 'Ich stehe zu dieser Entscheidung, weil sie auf klaren Kriterien beruht.', portuguese: 'Mantenho esta decisão porque ela se baseia em critérios claros.' },
    { id: 'b2-defend-widersprechen', unitId: 'b2.u7', order: 44, type: 'statement', german: 'Da muss ich Ihnen widersprechen — die Daten zeigen ein anderes Bild.', portuguese: 'Aí tenho de discordar — os dados mostram outro quadro.' },
    { id: 'b2-defend-halten', unitId: 'b2.u7', order: 45, type: 'statement', german: 'Trotz der Kritik halte ich an meinem Standpunkt fest und erkläre gerne warum.', portuguese: 'Apesar da crítica, mantenho meu ponto de vista e explico com prazer por quê.' },
    { id: 'b2-conflict-missverstaendnis', unitId: 'b2.u7', order: 46, type: 'statement', german: 'Es scheint ein Missverständnis zu geben — lassen Sie uns das klären.', portuguese: 'Parece haver um mal-entendido — vamos esclarecer.' },
    { id: 'b2-conflict-ablehnen', unitId: 'b2.u7', order: 47, type: 'statement', german: 'Leider kann ich dem so nicht zustimmen, aber ich schlage vor, dass …', portuguese: 'Infelizmente não posso concordar assim, mas proponho que …' },
    { id: 'b2-conflict-zuhoeren', unitId: 'b2.u7', order: 48, type: 'statement', german: 'Ich höre Ihren Einwand und möchte darauf eingehen.', portuguese: 'Ouço a sua objeção e quero responder a ela.' },
    { id: 'b2-conflict-ausweg', unitId: 'b2.u7', order: 49, type: 'statement', german: 'Ein gangbarer Ausweg wäre ein befristeter Kompromiss.', portuguese: 'Uma saída viável seria um compromisso temporário.' },
  ] },
  { competencyId: 'b2.fluent', level: 'B2', categories: ['social', 'work', 'daily'], core: [
    { id: 'b2-fluent-ehrlich', unitId: 'b2.u8', order: 50, type: 'statement', german: 'Ehrlich gesagt, habe ich da eine andere Erfahrung gemacht und würde heute anders handeln.', portuguese: 'Sinceramente, tive uma experiência diferente e hoje agiria de outro modo.' },
    { id: 'b2-fluent-hoere', unitId: 'b2.u8', order: 51, type: 'statement', german: 'Wenn ich das so höre, fällt mir ein, dass wir denselben Mechanismus schon einmal gesehen haben.', portuguese: 'Ouvindo isso, me ocorre que já vimos o mesmo mecanismo antes.' },
    { id: 'b2-fluent-sinn', unitId: 'b2.u8', order: 52, type: 'statement', german: 'Lange Rede kurzer Sinn: wir brauchen Klarheit, Tempo und eine gemeinsame Priorität.', portuguese: 'Em resumo: precisamos de clareza, ritmo e uma prioridade comum.' },
    { id: 'b2-fluent-register', unitId: 'b2.u8', order: 53, type: 'statement', german: 'Im beruflichen Kontext würde ich das formeller formulieren.', portuguese: 'No contexto profissional formularia isso de forma mais formal.' },
    { id: 'b2-fluent-diskussion', unitId: 'b2.u8', order: 54, type: 'statement', german: 'Lassen Sie uns die verschiedenen Szenarien kurz diskutieren und dann entscheiden.', portuguese: 'Vamos discutir brevemente os vários cenários e depois decidir.' },
    { id: 'b2-fluent-zusammen', unitId: 'b2.u8', order: 55, type: 'statement', german: 'Wenn ich Ihre Punkte und meine Argumente zusammennehme, ergibt sich …', portuguese: 'Se junto os seus pontos e os meus argumentos, resulta …' },
    { id: 'b2-fluent-reaktion', unitId: 'b2.u8', order: 56, type: 'statement', german: 'Darauf würde ich so reagieren: zuerst zuhören, dann konkrete Alternativen nennen.', portuguese: 'Reagiria assim: primeiro ouvir, depois nomear alternativas concretas.' },
  ] },

  // ---------------- C1 (curso escolar comunicativo — 8 unidades existentes) ----------------
  // u1 Nuance/cultura | u2 Argumentação | u3 Debate | u4 Acadêmico | u5 Profissional | u6 Sociedade | u7 Crise/mediação | u8 Integração
  { competencyId: 'c1.nuance', level: 'C1', categories: ['social', 'work'], core: [
    { id: 'c1-nuance-perspektive', unitId: 'c1.u1', order: 1, type: 'statement', german: 'Aus meiner Sicht ist die Situation wesentlich komplexer, als es auf den ersten Blick erscheint.', portuguese: 'Na minha perspectiva, a situação é muito mais complexa do que parece à primeira vista.' },
    { id: 'c1-nuance-anders', unitId: 'c1.u1', order: 2, type: 'statement', german: 'Anders formuliert: wir unterschätzen die Wechselwirkungen zwischen den einzelnen Faktoren.', portuguese: 'Formulado de outro modo: subestimamos as interações entre os fatores individuais.' },
    { id: 'c1-nuance-nuance', unitId: 'c1.u1', order: 3, type: 'statement', german: 'Es kommt stark darauf an, welchen Aspekt man betont — die Nuance verändert die Aussage.', portuguese: 'Depende muito de qual aspecto se enfatiza — a nuance muda o enunciado.' },
    { id: 'c1-culture-werk', unitId: 'c1.u1', order: 4, type: 'statement', german: 'Das Werk wirft die Frage auf, inwiefern Identität durch Sprache mitgeprägt wird.', portuguese: 'A obra levanta a questão de até que ponto a identidade é moldada pela linguagem.' },
    { id: 'c1-culture-medien', unitId: 'c1.u1', order: 5, type: 'statement', german: 'In der medialen Darstellung wird oft eine Perspektive privilegiert, während andere ausgeblendet bleiben.', portuguese: 'Na representação mediática privilegiase muitas vezes uma perspetiva, enquanto outras ficam de fora.' },
    { id: 'c1-culture-interkulturell', unitId: 'c1.u1', order: 6, type: 'statement', german: 'Interkulturelle Erfahrungen zeigen, dass Missverständnisse selten nur sprachlich sind.', portuguese: 'Experiências interculturais mostram que mal-entendidos raramente são só linguísticos.' },
    { id: 'c1-culture-alternative', unitId: 'c1.u1', order: 7, type: 'statement', german: 'Eine alternative Lesart wäre, dass die Geschichte eher von Anpassung als von Widerstand handelt.', portuguese: 'Uma leitura alternativa seria que a história trata mais de adaptação do que de resistência.' },
  ] },
  { competencyId: 'c1.argue', level: 'C1', categories: ['work', 'social'], core: [
    { id: 'c1-argue-zwar', unitId: 'c1.u2', order: 8, type: 'statement', german: 'Zwar erkenne ich die Vorteile an, doch die langfristigen Risiken überwiegen aus meiner Sicht klar.', portuguese: 'Reconheço as vantagens, mas os riscos a longo prazo, na minha visão, pesam claramente mais.' },
    { id: 'c1-argue-grundlage', unitId: 'c1.u2', order: 9, type: 'statement', german: 'Meine Argumentation stützt sich vor allem darauf, dass die Annahmen der Gegenseite nicht belegt sind.', portuguese: 'Minha argumentação apoia-se sobretudo no fato de que as premissas do outro lado não estão comprovadas.' },
    { id: 'c1-argue-folgerung', unitId: 'c1.u2', order: 10, type: 'statement', german: 'Daraus folgt zwingend, dass wir die Entscheidung verschieben, bis belastbare Daten vorliegen.', portuguese: 'Disso se segue necessariamente que adiamos a decisão até haver dados confiáveis.' },
    { id: 'c1-argue-vorbehalt', unitId: 'c1.u2', order: 11, type: 'statement', german: 'Unter dem Vorbehalt, dass die Rahmenbedingungen stabil bleiben, halte ich den Vorschlag für tragfähig.', portuguese: 'Sob a ressalva de que as condições-quadro permaneçam estáveis, considero a proposta viável.' },
    { id: 'c1-argue-teilweise', unitId: 'c1.u2', order: 12, type: 'statement', german: 'Ich stimme teilweise zu, insofern die Analyse die sozialen Kosten stärker berücksichtigt.', portuguese: 'Concordo parcialmente, na medida em que a análise considere mais os custos sociais.' },
    { id: 'c1-argue-beispiel', unitId: 'c1.u2', order: 13, type: 'statement', german: 'Als Beleg dafür dient insbesondere der Fall, in dem …', portuguese: 'Como evidência serve sobretudo o caso em que …' },
    { id: 'c1-argue-schluss', unitId: 'c1.u2', order: 14, type: 'statement', german: 'Zusammenfassend plädiere ich dafür, dass wir die Entscheidung an klaren Kriterien ausrichten.', portuguese: 'Em resumo, defendo que orientemos a decisão por critérios claros.' },
  ] },
  { competencyId: 'c1.debate', level: 'C1', categories: ['social', 'work'], core: [
    { id: 'c1-debate-einwand', unitId: 'c1.u3', order: 15, type: 'statement', german: 'Auf diesen Einwand würde ich entgegnen, dass er die strukturelle Ursache ausblendet.', portuguese: 'A essa objeção eu responderia que ela deixa de lado a causa estrutural.' },
    { id: 'c1-debate-entkraeftet', unitId: 'c1.u3', order: 16, type: 'statement', german: 'Das entkräftet meine These nicht; es zeigt lediglich, dass der Anwendungsfall enger gefasst werden muss.', portuguese: 'Isso não enfraquece minha tese; apenas mostra que o caso de uso precisa ser delimitado com mais precisão.' },
    { id: 'c1-debate-differenzieren', unitId: 'c1.u3', order: 17, type: 'statement', german: 'Lassen Sie uns das differenzierter betrachten, bevor wir vorschnell eine Seite wählen.', portuguese: 'Vamos analisar isso de modo mais diferenciado antes de escolher um lado às pressas.' },
    { id: 'c1-debate-zugeben', unitId: 'c1.u3', order: 18, type: 'statement', german: 'Ich räume ein, dass Ihr Punkt berechtigt ist, insofern …', portuguese: 'Reconheço que o seu ponto é válido, na medida em que …' },
    { id: 'c1-debate-umkehren', unitId: 'c1.u3', order: 19, type: 'statement', german: 'Man könnte den Einwand sogar umkehren und fragen, was passiert, wenn wir nichts tun.', portuguese: 'Poderíamos até inverter a objeção e perguntar o que acontece se não fizermos nada.' },
    { id: 'c1-debate-konsens', unitId: 'c1.u3', order: 20, type: 'statement', german: 'Ein produktiver Konsens wäre, die strittigen Punkte zu isolieren und getrennt zu prüfen.', portuguese: 'Um consenso produtivo seria isolar os pontos controvertidos e examiná-los em separado.' },
    { id: 'c1-debate-grenze', unitId: 'c1.u3', order: 21, type: 'statement', german: 'Die Grenze meiner Position liegt dort, wo die Evidenz unzureichend wird.', portuguese: 'O limite da minha posição está onde a evidência se torna insuficiente.' },
  ] },
  { competencyId: 'c1.hypothesis', level: 'C1', categories: ['work', 'social'], core: [
    { id: 'c1-hyp-angenommen', unitId: 'c1.u4', order: 22, type: 'statement', german: 'Angenommen, die Rahmenbedingungen ändern sich, dann müssten wir unsere Strategie grundlegend überdenken.', portuguese: 'Supondo que as condições-quadro mudem, teríamos de repensar fundamentalmente nossa estratégia.' },
    { id: 'c1-hyp-waere', unitId: 'c1.u4', order: 23, type: 'statement', german: 'Wäre die Kommunikation transparenter gewesen, hätte sich der Konflikt vermutlich gar nicht erst zugespitzt.', portuguese: 'Se a comunicação tivesse sido mais transparente, o conflito provavelmente nem teria se agravado.' },
    { id: 'c1-hyp-szenario', unitId: 'c1.u4', order: 24, type: 'statement', german: 'In einem alternativen Szenario würden wir zuerst die Interessen aller Beteiligten explizit machen.', portuguese: 'Num cenário alternativo, tornaríamos explícitos primeiro os interesses de todos os envolvidos.' },
    { id: 'c1-acad-daten', unitId: 'c1.u4', order: 25, type: 'statement', german: 'Die Daten deuten darauf hin, dass …; eine kausale Aussage wäre allerdings verfrüht.', portuguese: 'Os dados sugerem que …; uma afirmação causal seria, porém, prematura.' },
    { id: 'c1-acad-zusammenfassen', unitId: 'c1.u4', order: 26, type: 'statement', german: 'Fasst man beide Studien zusammen, ergibt sich ein differenziertes Bild.', portuguese: 'Se se resumem ambos os estudos, resulta um quadro diferenciado.' },
    { id: 'c1-acad-unterscheiden', unitId: 'c1.u4', order: 27, type: 'statement', german: 'Wichtig ist, Fakt, Interpretation und Bewertung sauber voneinander zu trennen.', portuguese: 'É importante separar com rigor facto, interpretação e avaliação.' },
    { id: 'c1-acad-quellen', unitId: 'c1.u4', order: 28, type: 'statement', german: 'Die Quellen widersprechen sich teilweise; deshalb gewichte ich … stärker.', portuguese: 'As fontes contradizem-se em parte; por isso pondero … com mais peso.' },
  ] },
  { competencyId: 'c1.register', level: 'C1', categories: ['work', 'daily'], core: [
    { id: 'c1-reg-formal', unitId: 'c1.u5', order: 29, type: 'statement', german: 'Ich möchte Sie höflich bitten, mir die Unterlagen bis Freitag zukommen zu lassen.', portuguese: 'Gostaria de pedi-lhe cordialmente que me envie os documentos até sexta-feira.' },
    { id: 'c1-reg-informal', unitId: 'c1.u5', order: 30, type: 'statement', german: 'Kannst du mir die Unterlagen bis Freitag schicken? Das wäre super.', portuguese: 'Consegues me mandar os documentos até sexta? Seria ótimo.' },
    { id: 'c1-reg-neutral', unitId: 'c1.u5', order: 31, type: 'statement', german: 'Wir sollten den Termin verschieben und die offenen Punkte schriftlich festhalten.', portuguese: 'Deveríamos remarcar o horário e registrar por escrito os pontos em aberto.' },
    { id: 'c1-pro-praesentation', unitId: 'c1.u5', order: 32, type: 'statement', german: 'In meiner Präsentation möchte ich Risiko, Prioritäten und den Entscheidungsbedarf klar machen.', portuguese: 'Na minha apresentação quero deixar claros o risco, as prioridades e a necessidade de decisão.' },
    { id: 'c1-pro-feedback', unitId: 'c1.u5', order: 33, type: 'statement', german: 'Mein Feedback zielt darauf ab, die Zusammenarbeit zu verbessern, nicht die Person zu kritisieren.', portuguese: 'O meu feedback visa melhorar a colaboração, não criticar a pessoa.' },
    { id: 'c1-pro-prioritaeten', unitId: 'c1.u5', order: 34, type: 'statement', german: 'Wenn wir die Prioritäten neu ordnen, gewinnen wir Handlungsspielraum bei den kritischen Punkten.', portuguese: 'Se reordenarmos as prioridades, ganhamos margem de manobra nos pontos críticos.' },
    { id: 'c1-pro-risiko', unitId: 'c1.u5', order: 35, type: 'statement', german: 'Ich möchte das Risiko transparent machen, ohne unnötige Alarmstimmung zu erzeugen.', portuguese: 'Quero tornar o risco transparente sem criar alarme desnecessário.' },
  ] },
  { competencyId: 'c1.abstract', level: 'C1', categories: ['social'], core: [
    { id: 'c1-abs-gesellschaft', unitId: 'c1.u6', order: 36, type: 'statement', german: 'In einer zunehmend digitalisierten Gesellschaft verschieben sich die Grenzen zwischen privat und öffentlich.', portuguese: 'Numa sociedade cada vez mais digitalizada, deslocam-se as fronteiras entre privado e público.' },
    { id: 'c1-abs-verantwortung', unitId: 'c1.u6', order: 37, type: 'statement', german: 'Die Frage der Verantwortung lässt sich nicht allein technisch lösen; sie ist auch ethisch.', portuguese: 'A questão da responsabilidade não se resolve só tecnicamente; é também ética.' },
    { id: 'c1-abs-spannung', unitId: 'c1.u6', order: 38, type: 'statement', german: 'Hier zeigt sich die Spannung zwischen individueller Freiheit und kollektivem Interesse besonders deutlich.', portuguese: 'Aqui a tensão entre liberdade individual e interesse coletivo aparece com especial clareza.' },
    { id: 'c1-abs-nachhaltigkeit', unitId: 'c1.u6', order: 39, type: 'statement', german: 'Nachhaltigkeit erfordert, kurzfristige Vorteile gegen langfristige Folgen abzuwägen.', portuguese: 'A sustentabilidade exige ponderar vantagens de curto prazo face a consequências de longo prazo.' },
    { id: 'c1-abs-ungleichheit', unitId: 'c1.u6', order: 40, type: 'statement', german: 'Ungleichheit entsteht oft nicht aus Absicht, sondern aus strukturellen Mechanismen.', portuguese: 'A desigualdade muitas vezes não nasce da intenção, mas de mecanismos estruturais.' },
    { id: 'c1-abs-automation', unitId: 'c1.u6', order: 41, type: 'statement', german: 'Automatisierung verändert nicht nur Jobs, sondern auch die Verteilung von Verantwortung.', portuguese: 'A automação muda não só empregos, mas também a distribuição de responsabilidade.' },
    { id: 'c1-abs-vorschlag', unitId: 'c1.u6', order: 42, type: 'statement', german: 'Ein realistischer Vorschlag wäre, Pilotprojekte mit klaren Evaluationskriterien zu verbinden.', portuguese: 'Uma proposta realista seria ligar projetos-piloto a critérios claros de avaliação.' },
  ] },
  { competencyId: 'c1.negotiate', level: 'C1', categories: ['work', 'social'], core: [
    { id: 'c1-neg-interesse', unitId: 'c1.u7', order: 43, type: 'statement', german: 'Mein Interesse liegt weniger beim Preis als bei verlässlichen Lieferzeiten und klarer Kommunikation.', portuguese: 'Meu interesse está menos no preço do que em prazos de entrega confiáveis e comunicação clara.' },
    { id: 'c1-neg-kompromiss', unitId: 'c1.u7', order: 44, type: 'statement', german: 'Wenn beide Seiten einen Schritt aufeinander zugehen, lässt sich ein tragfähiger Kompromiss finden.', portuguese: 'Se ambos os lados derem um passo um em direção ao outro, dá para achar um compromisso sustentável.' },
    { id: 'c1-neg-entspannen', unitId: 'c1.u7', order: 45, type: 'statement', german: 'Lassen Sie uns die Tonlage etwas entspannen und zuerst klären, worüber wir uns überhaupt einig sind.', portuguese: 'Vamos baixar um pouco o tom e esclarecer primeiro sobre o que já estamos de acordo.' },
    { id: 'c1-crisis-vertrag', unitId: 'c1.u7', order: 46, type: 'statement', german: 'Im Vertrag ist vorgesehen, dass …; ich bitte um Klarstellung der Fristen und Haftung.', portuguese: 'No contrato está previsto que …; peço esclarecimento dos prazos e da responsabilidade.' },
    { id: 'c1-crisis-dringlichkeit', unitId: 'c1.u7', order: 47, type: 'statement', german: 'Wegen der Dringlichkeit bitte ich um eine schriftliche Rückmeldung noch heute.', portuguese: 'Devido à urgência, peço uma resposta por escrito ainda hoje.' },
    { id: 'c1-crisis-mediation', unitId: 'c1.u7', order: 48, type: 'statement', german: 'Als Vermittlungsschritt schlage ich vor, die Forderungen beider Seiten parallel zu prüfen.', portuguese: 'Como passo de mediação, proponho examinar em paralelo as exigências de ambas as partes.' },
    { id: 'c1-crisis-naechste', unitId: 'c1.u7', order: 49, type: 'statement', german: 'Können wir die nächsten Schritte und Verantwortlichkeiten verbindlich festhalten?', portuguese: 'Podemos registar de forma vinculativa os próximos passos e as responsabilidades?' },
  ] },
  { competencyId: 'c1.spontaneous', level: 'C1', categories: ['social', 'work', 'daily'], core: [
    { id: 'c1-spon-ehrlich', unitId: 'c1.u8', order: 50, type: 'statement', german: 'Ehrlich gesagt, habe ich dazu noch keine abschließende Meinung — ich muss das noch durchdenken.', portuguese: 'Sinceramente, ainda não tenho uma opinião definitiva sobre isso — preciso refletir mais.' },
    { id: 'c1-spon-anschluss', unitId: 'c1.u8', order: 51, type: 'statement', german: 'Wenn ich an das anknüpfe, was Sie gerade gesagt haben, dann sehe ich vor allem einen blinden Fleck in der Umsetzung.', portuguese: 'Se eu retomo o que você acabou de dizer, vejo sobretudo um ponto cego na implementação.' },
    { id: 'c1-spon-fazit', unitId: 'c1.u8', order: 52, type: 'statement', german: 'Um es auf den Punkt zu bringen: ohne gemeinsame Prioritäten bleibt jede Strategie Stückwerk.', portuguese: 'Para ir ao ponto: sem prioridades comuns, qualquer estratégia continua fragmentada.' },
    { id: 'c1-int-praesentation', unitId: 'c1.u8', order: 53, type: 'statement', german: 'Ich strukturiere meinen Beitrag in Analyse, Optionen und Empfehlung.', portuguese: 'Estruturo a minha intervenção em análise, opções e recomendação.' },
    { id: 'c1-int-register', unitId: 'c1.u8', order: 54, type: 'statement', german: 'Je nach Publikum würde ich denselben Inhalt formeller oder zugänglicher formulieren.', portuguese: 'Consoante o público, formularia o mesmo conteúdo de modo mais formal ou mais acessível.' },
    { id: 'c1-int-reaktion', unitId: 'c1.u8', order: 55, type: 'statement', german: 'Auf den Gegenpunkt reagiere ich mit einer Präzisierung und einem konkreten Beispiel.', portuguese: 'Ao contraponto reajo com uma precisão e um exemplo concreto.' },
    { id: 'c1-int-diskussion', unitId: 'c1.u8', order: 56, type: 'statement', german: 'Lassen Sie uns die Fallstudie 7–10 Minuten diskutieren und danach eine Empfehlung formulieren.', portuguese: 'Vamos discutir o estudo de caso durante 7–10 minutos e depois formular uma recomendação.' },
  ] },

  // ---------------- C2 (curso escolar comunicativo — 8 unidades existentes; nível terminal) ----------------
  // u1 Nuance/cultura | u2 Argumentação | u3 Discurso | u4 Síntese | u5 Registro | u6 Mediação/crise | u7 Ética | u8 Integração
  { competencyId: 'c2.nuance', level: 'C2', categories: ['social', 'work'], core: [
    { id: 'c2-nuance-ambivalent', unitId: 'c2.u1', order: 1, type: 'statement', german: 'Die Situation lässt sich keineswegs eindeutig beurteilen, da mehrere Faktoren miteinander in Wechselwirkung stehen.', portuguese: 'A situação está longe de poder ser avaliada de forma inequívoca, pois vários fatores interagem entre si.' },
    { id: 'c2-nuance-nuancenreich', unitId: 'c2.u1', order: 2, type: 'statement', german: 'Was auf den ersten Blick wie ein Widerspruch wirkt, erweist sich bei genauerem Hinsehen als nuancenreiche Spannung.', portuguese: 'O que à primeira vista parece uma contradição revela-se, com um olhar mais atento, uma tensão cheia de nuances.' },
    { id: 'c2-nuance-praezise', unitId: 'c2.u1', order: 3, type: 'statement', german: 'Ich möchte das präziser fassen: nicht die Absicht war problematisch, sondern die unverhandelten Prämissen.', portuguese: 'Quero formular isso com mais precisão: o problemático não era a intenção, e sim as premissas não negociadas.' },
    { id: 'c2-culture-werk', unitId: 'c2.u1', order: 4, type: 'statement', german: 'Das Werk entfaltet seine Wirkung weniger durch die Plotpointe als durch die sprachliche Rahmung der Figuren.', portuguese: 'A obra exerce o seu efeito menos pelo ponto da trama do que pelo enquadramento linguístico das personagens.' },
    { id: 'c2-culture-medien', unitId: 'c2.u1', order: 5, type: 'statement', german: 'Die mediale Darstellung selektiert Perspektiven und erzeugt dadurch eine scheinbare Selbstverständlichkeit.', portuguese: 'A representação mediática seleciona perspetivas e, com isso, produz uma aparente evidência.' },
    { id: 'c2-culture-narrativ', unitId: 'c2.u1', order: 6, type: 'statement', german: 'Vergleicht man die Narrative, zeigt sich, welche Interessen stillschweigend mittransportiert werden.', portuguese: 'Se se comparam as narrativas, vê-se que interesses são transportados em silêncio.' },
    { id: 'c2-culture-glaubwuerdigkeit', unitId: 'c2.u1', order: 7, type: 'statement', german: 'Die Glaubwürdigkeit der Information hängt weniger vom Ton als von der Nachvollziehbarkeit der Quellen ab.', portuguese: 'A credibilidade da informação depende menos do tom do que da verificabilidade das fontes.' },
  ] },
  { competencyId: 'c2.argue', level: 'C2', categories: ['work', 'social'], core: [
    { id: 'c2-argue-vorbehalt', unitId: 'c2.u2', order: 8, type: 'statement', german: 'Unter dem Vorbehalt, dass die Datenlage vorläufig bleibt, halte ich die vorgeschlagene Lesart für die stichhaltigste.', portuguese: 'Com a ressalva de que a base de dados ainda é provisória, considero a leitura proposta a mais sólida.' },
    { id: 'c2-argue-mehrschichtig', unitId: 'c2.u2', order: 9, type: 'statement', german: 'Meine Kritik richtet sich weniger gegen das Ziel als gegen die ungeprüften Annahmen, auf denen es beruht.', portuguese: 'Minha crítica dirige-se menos ao objetivo do que às premissas não examinadas nas quais ele se apoia.' },
    { id: 'c2-argue-zugestaendnis', unitId: 'c2.u2', order: 10, type: 'statement', german: 'Selbst wenn man den Einwand ernst nimmt, bleibt unerklärt, warum alternative Deutungen systematisch ausgeblendet wurden.', portuguese: 'Mesmo levando a objeção a sério, continua sem explicação por que interpretações alternativas foram sistematicamente excluídas.' },
    { id: 'c2-argue-these', unitId: 'c2.u2', order: 11, type: 'statement', german: 'Meine These lautet: ohne belastbare Maßstäbe wird jede Priorisierung zur Machtfrage.', portuguese: 'A minha tese é: sem critérios fiáveis, qualquer priorização torna-se uma questão de poder.' },
    { id: 'c2-argue-evidenz', unitId: 'c2.u2', order: 12, type: 'statement', german: 'Als Evidenz dient weniger der Einzelfall als das wiederkehrende Muster über mehrere Kontexte hinweg.', portuguese: 'Como evidência serve menos o caso isolado do que o padrão recorrente em vários contextos.' },
    { id: 'c2-argue-folge', unitId: 'c2.u2', order: 13, type: 'statement', german: 'Die absehbare Folge wäre, dass wir kurzfristig gewinnen und langfristig Steuerungsfähigkeit verlieren.', portuguese: 'A consequência previsível seria ganharmos a curto prazo e perdermos capacidade de direção a longo prazo.' },
    { id: 'c2-argue-schluss', unitId: 'c2.u2', order: 14, type: 'statement', german: 'Ich schließe daher mit einer Empfehlung unter klar benannten Unsicherheiten.', portuguese: 'Concluo, por isso, com uma recomendação sob incertezas claramente nomeadas.' },
  ] },
  { competencyId: 'c2.discourse', level: 'C2', categories: ['work', 'social'], core: [
    { id: 'c2-disc-aufbau', unitId: 'c2.u3', order: 15, type: 'statement', german: 'Ich gliedere meinen Gedankengang in drei Schritte: Diagnose, Gegenprobe und daraus abgeleitete Konsequenz.', portuguese: 'Organizo meu raciocínio em três passos: diagnóstico, contra-prova e consequência daí derivada.' },
    { id: 'c2-disc-roterfaden', unitId: 'c2.u3', order: 16, type: 'statement', german: 'Der rote Faden ist, dass ohne geteilte Kriterien jede Priorisierung willkürlich wirkt.', portuguese: 'O fio condutor é que, sem critérios compartilhados, qualquer priorização parece arbitrária.' },
    { id: 'c2-disc-schluss', unitId: 'c2.u3', order: 17, type: 'statement', german: 'Zusammenfassend lässt sich festhalten: die Debatte braucht weniger Positionen und mehr belastbare Maßstäbe.', portuguese: 'Em resumo: o debate precisa de menos posições e de critérios mais confiáveis.' },
    { id: 'c2-disc-reformulieren', unitId: 'c2.u3', order: 18, type: 'statement', german: 'Anders gesagt: wir streiten über Mittel, obwohl wir uns über Ziele noch nicht verständigt haben.', portuguese: 'Dito de outro modo: discutimos meios embora ainda não tenhamos acordado objetivos.' },
    { id: 'c2-disc-grad', unitId: 'c2.u3', order: 19, type: 'statement', german: 'Ich stimme dem nur bedingt zu — und zwar insofern die Nebenwirkungen mitgedacht werden.', portuguese: 'Só concordo parcialmente — e precisamente na medida em que se pensem os efeitos secundários.' },
    { id: 'c2-disc-dilemma', unitId: 'c2.u3', order: 20, type: 'statement', german: 'Das Dilemma besteht darin, dass jede Option einen Wert schützt und einen anderen gefährdet.', portuguese: 'O dilema consiste em que cada opção protege um valor e põe outro em risco.' },
    { id: 'c2-disc-moderieren', unitId: 'c2.u3', order: 21, type: 'statement', german: 'Lassen Sie mich den Dissens kurz bündeln, bevor wir eine Entscheidung erzwingen.', portuguese: 'Permitam-me condensar a discordância antes de forçarmos uma decisão.' },
  ] },
  { competencyId: 'c2.inference', level: 'C2', categories: ['social', 'work'], core: [
    { id: 'c2-inf-implizit', unitId: 'c2.u4', order: 22, type: 'statement', german: 'Zwischen den Zeilen klingt an, dass die eigentliche Entscheidung bereits getroffen wurde, ohne sie so zu nennen.', portuguese: 'Entre as linhas soa que a decisão real já foi tomada, sem nomeá-la como tal.' },
    { id: 'c2-inf-deuten', unitId: 'c2.u4', order: 23, type: 'statement', german: 'Wenn man diese Formulierung wörtlich nimmt, wirkt sie harmlos; gelesen als Signal, markiert sie eine Grenze.', portuguese: 'Se se toma essa formulação ao pé da letra, parece inofensiva; lida como sinal, marca um limite.' },
    { id: 'c2-inf-ableiten', unitId: 'c2.u4', order: 24, type: 'statement', german: 'Daraus lässt sich ableiten, dass Widerstand weniger gegen den Inhalt als gegen den Prozess gerichtet ist.', portuguese: 'Disso se pode inferir que a resistência se dirige menos ao conteúdo do que ao processo.' },
    { id: 'c2-acad-quellen', unitId: 'c2.u4', order: 25, type: 'statement', german: 'Die Quellen widersprechen sich teilweise; deshalb trenne ich Befund, Interpretation und Empfehlung.', portuguese: 'As fontes contradizem-se em parte; por isso separo achado, interpretação e recomendação.' },
    { id: 'c2-acad-methode', unitId: 'c2.u4', order: 26, type: 'statement', german: 'Die Methodik erklärt, warum die Aussagekraft begrenzt ist und wo Überinterpretation droht.', portuguese: 'A metodologia explica por que o poder explicativo é limitado e onde ameaça a sobreinterpretação.' },
    { id: 'c2-acad-limitation', unitId: 'c2.u4', order: 27, type: 'statement', german: 'Eine zentrale Limitation liegt darin, dass der Kontext der Erhebung nicht vollständig dokumentiert ist.', portuguese: 'Uma limitação central está em o contexto da recolha não estar completamente documentado.' },
    { id: 'c2-acad-synthese', unitId: 'c2.u4', order: 28, type: 'statement', german: 'Synthetisiert man beide Perspektiven, entsteht ein Bild, das weder Alarmismus noch Bagatellisierung rechtfertigt.', portuguese: 'Se se sintetizam ambas as perspetivas, surge um quadro que não justifica nem alarmismo nem bagatelização.' },
  ] },
  { competencyId: 'c2.register', level: 'C2', categories: ['work', 'daily'], core: [
    { id: 'c2-reg-formell', unitId: 'c2.u5', order: 29, type: 'statement', german: 'Gestatten Sie mir, den Punkt noch einmal in etwas förmlicherer Sprache zu fassen, damit nichts missverstanden wird.', portuguese: 'Permita-me reformular o ponto numa linguagem um pouco mais formal, para que nada seja mal interpretado.' },
    { id: 'c2-reg-umgang', unitId: 'c2.u5', order: 30, type: 'statement', german: 'Kurz gesagt: das zieht so nicht — wir müssen das anders aufziehen, sonst wird es chaotisch.', portuguese: 'Em resumo: assim não rola — temos de montar de outro jeito, senão vira caos.' },
    { id: 'c2-reg-wechseln', unitId: 'c2.u5', order: 31, type: 'statement', german: 'Je nach Gegenüber wechsle ich bewusst zwischen Distanz und Nähe, ohne die Sache selbst zu verwässern.', portuguese: 'Conforme o interlocutor, mudo conscientemente entre distância e proximidade, sem diluir o assunto em si.' },
    { id: 'c2-reg-akademisch', unitId: 'c2.u5', order: 32, type: 'statement', german: 'Im akademischen Register würde ich denselben Befund vorsichtiger und mit Quellenbezug formulieren.', portuguese: 'No registo académico formularia o mesmo achado com mais cautela e referência a fontes.' },
    { id: 'c2-reg-fuehrung', unitId: 'c2.u5', order: 33, type: 'statement', german: 'Gegenüber der Führungsebene verdichte ich die Botschaft auf Entscheidung, Risiko und nächsten Schritt.', portuguese: 'Perante a liderança, densifico a mensagem em decisão, risco e próximo passo.' },
    { id: 'c2-reg-diplomatie', unitId: 'c2.u5', order: 34, type: 'statement', german: 'Diplomatisch gesagt: wir teilen das Ziel, nicht aber die Premisse, aus der der Vorschlag folgt.', portuguese: 'Dito diplomaticamente: partilhamos o objetivo, mas não a premissa de que decorre a proposta.' },
    { id: 'c2-reg-klarheit', unitId: 'c2.u5', order: 35, type: 'statement', german: 'Ich bleibe klar, auch wenn ich den Ton anpasse — Präzision und Höflichkeit schließen sich nicht aus.', portuguese: 'Mantenho-me claro mesmo adaptando o tom — precisão e cortesia não se excluem.' },
  ] },
  { competencyId: 'c2.mediate', level: 'C2', categories: ['work', 'social'], core: [
    { id: 'c2-med-interessen', unitId: 'c2.u6', order: 36, type: 'statement', german: 'Statt Positionen gegeneinander zu stellen, lohnt es sich, die darunterliegenden Interessen sichtbar zu machen.', portuguese: 'Em vez de contrapôr posições, vale tornar visíveis os interesses que estão por baixo.' },
    { id: 'c2-med-bruecke', unitId: 'c2.u6', order: 37, type: 'statement', german: 'Ich schlage vor, eine Brücke zu formulieren, die beiden Seiten Gesichtswahrung erlaubt, ohne die Substanz zu opfern.', portuguese: 'Proponho formular uma ponte que permita a ambos os lados salvar as aparências sem sacrificar a substância.' },
    { id: 'c2-med-persuasion', unitId: 'c2.u6', order: 38, type: 'statement', german: 'Überzeugend wirkt hier weniger Druck als die präzise Benennung dessen, was für beide Seiten riskant wäre.', portuguese: 'Aqui convence menos a pressão do que nomear com precisão o que seria arriscado para ambos os lados.' },
    { id: 'c2-crisis-entscheidung', unitId: 'c2.u6', order: 39, type: 'statement', german: 'Ich kommuniziere die Entscheidung transparent: was feststeht, was offen bleibt und wer verantwortlich ist.', portuguese: 'Comunico a decisão de forma transparente: o que está fixo, o que permanece aberto e quem é responsável.' },
    { id: 'c2-crisis-risiko', unitId: 'c2.u6', order: 40, type: 'statement', german: 'Das Risiko muss benannt werden, ohne Panik zu erzeugen und ohne die Dringlichkeit zu verharmlosen.', portuguese: 'O risco tem de ser nomeado sem criar pânico e sem banalizar a urgência.' },
    { id: 'c2-crisis-vertrag', unitId: 'c2.u6', order: 41, type: 'statement', german: 'Im Konfliktfall bitte ich um schriftliche Klarstellung der Fristen, Haftung und Eskalationswege.', portuguese: 'Em caso de conflito, peço esclarecimento por escrito dos prazos, responsabilidade e vias de escalada.' },
    { id: 'c2-crisis-naechste', unitId: 'c2.u6', order: 42, type: 'statement', german: 'Können wir die nächsten Schritte verbindlich festhalten und den Review-Termin direkt setzen?', portuguese: 'Podemos registar de forma vinculativa os próximos passos e marcar já a data de revisão?' },
  ] },
  { competencyId: 'c2.critical', level: 'C2', categories: ['social'], core: [
    { id: 'c2-crit-begriff', unitId: 'c2.u7', order: 43, type: 'statement', german: 'Bevor wir über Freiheit sprechen, müssten wir klären, welchen Freiheitsbegriff wir eigentlich voraussetzen.', portuguese: 'Antes de falar de liberdade, teríamos de esclarecer que conceito de liberdade estamos pressupondo.' },
    { id: 'c2-crit-widerspruch', unitId: 'c2.u7', order: 44, type: 'statement', german: 'Der Widerspruch liegt darin, dass wir Effizienz fordern und zugleich die Bedingungen dafür systematisch untergraben.', portuguese: 'A contradição está em exigirmos eficiência e, ao mesmo tempo, minarmos sistematicamente as condições para ela.' },
    { id: 'c2-crit-reflexion', unitId: 'c2.u7', order: 45, type: 'statement', german: 'Kritische Reflexion bedeutet hier, die eigenen blinden Flecken ebenso ernst zu nehmen wie die der Gegenseite.', portuguese: 'Reflexão crítica significa aqui levar os próprios pontos cegos tão a sério quanto os do outro lado.' },
    { id: 'c2-ethik-technik', unitId: 'c2.u7', order: 46, type: 'statement', german: 'Bei Technik und Ethik geht es weniger um Ablehnung als um die Verteilung von Verantwortung und Kontrolle.', portuguese: 'Na técnica e na ética trata-se menos de rejeição do que da distribuição de responsabilidade e controlo.' },
    { id: 'c2-ethik-nachhaltigkeit', unitId: 'c2.u7', order: 47, type: 'statement', german: 'Nachhaltigkeit verlangt, kurzfristige Gewinne gegen irreversible Folgekosten abzuwägen.', portuguese: 'A sustentabilidade exige ponderar ganhos de curto prazo face a custos irreversíveis.' },
    { id: 'c2-ethik-ungleichheit', unitId: 'c2.u7', order: 48, type: 'statement', german: 'Ungleichheit erscheint oft als Einzelschicksal, ist aber häufig das Ergebnis struktureller Mechanismen.', portuguese: 'A desigualdade parece muitas vezes destino individual, mas é frequentemente resultado de mecanismos estruturais.' },
    { id: 'c2-ethik-unsicherheit', unitId: 'c2.u7', order: 49, type: 'statement', german: 'Ich halte Unsicherheit aus, statt sie mit Scheinsicherheit zu überdecken.', portuguese: 'Suporto a incerteza em vez de a cobrir com falsa segurança.' },
  ] },
  { competencyId: 'c2.fluent', level: 'C2', categories: ['social', 'work', 'daily'], core: [
    { id: 'c2-flu-spontan', unitId: 'c2.u8', order: 50, type: 'statement', german: 'Spontan gesagt: ich bin noch nicht fertig mit dem Gedanken, aber die Richtung scheint mir klarer als gestern.', portuguese: 'Dito espontaneamente: ainda não terminei o pensamento, mas a direção me parece mais clara do que ontem.' },
    { id: 'c2-flu-anpassen', unitId: 'c2.u8', order: 51, type: 'statement', german: 'Wenn das Gespräch kippt, passe ich den Ton an — ohne den Kern der Aussage aufzugeben.', portuguese: 'Se a conversa muda de tom, adapto o registro — sem abrir mão do núcleo do que quero dizer.' },
    { id: 'c2-flu-abschluss', unitId: 'c2.u8', order: 52, type: 'statement', german: 'Am Ende bleibt: wir brauchen Klarheit über Kriterien, Mut zur Unschärfe und die Bereitschaft, uns zu korrigieren.', portuguese: 'No fim, resta: precisamos de clareza sobre critérios, coragem perante a ambiguidade e disposição para nos corrigirmos.' },
    { id: 'c2-int-praesentation', unitId: 'c2.u8', order: 53, type: 'statement', german: 'Ich strukturiere die Präsentation in Lagebild, Optionen, Empfehlung und offene Risiken.', portuguese: 'Estruturo a apresentação em panorama, opções, recomendação e riscos em aberto.' },
    { id: 'c2-int-mediation', unitId: 'c2.u8', order: 54, type: 'statement', german: 'In der Mediation fasse ich beide Positionen präzise zusammen, bevor wir eine gemeinsame Lösung suchen.', portuguese: 'Na mediação, resumo com precisão ambas as posições antes de procurarmos uma solução comum.' },
    { id: 'c2-int-reaktion', unitId: 'c2.u8', order: 55, type: 'statement', german: 'Auf den scharfen Einwand reagiere ich mit einer Präzisierung und einer Gegenfrage zur Evidenz.', portuguese: 'À objeção aguda reajo com uma precisão e uma contra-pergunta sobre a evidência.' },
    { id: 'c2-int-diskussion', unitId: 'c2.u8', order: 56, type: 'statement', german: 'Lassen Sie uns den Fall 10–12 Minuten diskutieren und danach eine belastbare Empfehlung formulieren.', portuguese: 'Vamos discutir o caso durante 10–12 minutos e depois formular uma recomendação sólida.' },
  ] },
];

export const CURATED_BY_COMPETENCY: Record<string, CompetencyContent> = Object.fromEntries(
  CURATED.map((c) => [c.competencyId, c]),
);

/** Compatibilidade: conteúdo de comida vive em a1.shopping. */
if (CURATED_BY_COMPETENCY['a1.shopping']) {
  CURATED_BY_COMPETENCY['a1.food'] = CURATED_BY_COMPETENCY['a1.shopping'];
}

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
