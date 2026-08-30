import type { Phrase, Word, DayProgram, Mission, Situation } from '@/types';

const CATEGORIES = [
  'greetings', 'survival', 'work', 'daily', 'food', 'transport',
  'shopping', 'health', 'family', 'weather', 'time', 'emotions',
  'questions', 'responses', 'directions', 'home', 'phone', 'social',
];

const WORD_TEMPLATES: { de: string; pt: string; cat: string }[] = [
  { de: 'Hallo', pt: 'Olá', cat: 'greetings' },
  { de: 'Guten Morgen', pt: 'Bom dia', cat: 'greetings' },
  { de: 'Guten Tag', pt: 'Boa tarde', cat: 'greetings' },
  { de: 'Guten Abend', pt: 'Boa noite', cat: 'greetings' },
  { de: 'Tschüss', pt: 'Tchau', cat: 'greetings' },
  { de: 'Danke', pt: 'Obrigado', cat: 'greetings' },
  { de: 'Bitte', pt: 'Por favor / De nada', cat: 'greetings' },
  { de: 'Ja', pt: 'Sim', cat: 'responses' },
  { de: 'Nein', pt: 'Não', cat: 'responses' },
  { de: 'Entschuldigung', pt: 'Com licença / Desculpe', cat: 'greetings' },
  { de: 'Wasser', pt: 'Água', cat: 'food' },
  { de: 'Brot', pt: 'Pão', cat: 'food' },
  { de: 'Milch', pt: 'Leite', cat: 'food' },
  { de: 'Kaffee', pt: 'Café', cat: 'food' },
  { de: 'Tee', pt: 'Chá', cat: 'food' },
  { de: 'Fleisch', pt: 'Carne', cat: 'food' },
  { de: 'Gemüse', pt: 'Vegetais', cat: 'food' },
  { de: 'Obst', pt: 'Frutas', cat: 'food' },
  { de: 'Bier', pt: 'Cerveja', cat: 'food' },
  { de: 'Wein', pt: 'Vinho', cat: 'food' },
  { de: 'Haus', pt: 'Casa', cat: 'home' },
  { de: 'Wohnung', pt: 'Apartamento', cat: 'home' },
  { de: 'Zimmer', pt: 'Quarto', cat: 'home' },
  { de: 'Küche', pt: 'Cozinha', cat: 'home' },
  { de: 'Bad', pt: 'Banheiro', cat: 'home' },
  { de: 'Tür', pt: 'Porta', cat: 'home' },
  { de: 'Fenster', pt: 'Janela', cat: 'home' },
  { de: 'Tisch', pt: 'Mesa', cat: 'home' },
  { de: 'Stuhl', pt: 'Cadeira', cat: 'home' },
  { de: 'Bett', pt: 'Cama', cat: 'home' },
  { de: 'Auto', pt: 'Carro', cat: 'transport' },
  { de: 'Bus', pt: 'Ônibus', cat: 'transport' },
  { de: 'Bahn', pt: 'Trem', cat: 'transport' },
  { de: 'Zug', pt: 'Trem', cat: 'transport' },
  { de: 'Flugzeug', pt: 'Avião', cat: 'transport' },
  { de: 'Fahrrad', pt: 'Bicicleta', cat: 'transport' },
  { de: 'Straße', pt: 'Rua', cat: 'transport' },
  { de: 'Bahnhof', pt: 'Estação de trem', cat: 'transport' },
  { de: 'Flughafen', pt: 'Aeroporto', cat: 'transport' },
  { de: 'Ticket', pt: 'Passagem', cat: 'transport' },
  { de: 'Arbeit', pt: 'Trabalho', cat: 'work' },
  { de: 'Chef', pt: 'Chefe', cat: 'work' },
  { de: 'Kollege', pt: 'Colega', cat: 'work' },
  { de: 'Meeting', pt: 'Reunião', cat: 'work' },
  { de: 'Pause', pt: 'Pausa', cat: 'work' },
  { de: 'Computer', pt: 'Computador', cat: 'work' },
  { de: 'Telefon', pt: 'Telefone', cat: 'work' },
  { de: 'E-Mail', pt: 'E-mail', cat: 'work' },
  { de: 'Projekt', pt: 'Projeto', cat: 'work' },
  { de: 'Termin', pt: 'Compromisso', cat: 'work' },
  { de: 'Familie', pt: 'Família', cat: 'family' },
  { de: 'Mutter', pt: 'Mãe', cat: 'family' },
  { de: 'Vater', pt: 'Pai', cat: 'family' },
  { de: 'Kind', pt: 'Filho/Filha', cat: 'family' },
  { de: 'Bruder', pt: 'Irmão', cat: 'family' },
  { de: 'Schwester', pt: 'Irmã', cat: 'family' },
  { de: 'Freund', pt: 'Amigo', cat: 'family' },
  { de: 'Partner', pt: 'Parceiro(a)', cat: 'family' },
  { de: 'Sonne', pt: 'Sol', cat: 'weather' },
  { de: 'Regen', pt: 'Chuva', cat: 'weather' },
  { de: 'Schnee', pt: 'Neve', cat: 'weather' },
  { de: 'Wind', pt: 'Vento', cat: 'weather' },
  { de: 'warm', pt: 'Quente', cat: 'weather' },
  { de: 'kalt', pt: 'Frio', cat: 'weather' },
  { de: 'Arzt', pt: 'Médico', cat: 'health' },
  { de: 'Krankenhaus', pt: 'Hospital', cat: 'health' },
  { de: 'Medizin', pt: 'Remédio', cat: 'health' },
  { de: 'Schmerzen', pt: 'Dores', cat: 'health' },
  { de: 'Kopf', pt: 'Cabeça', cat: 'health' },
  { de: 'Bauch', pt: 'Barriga', cat: 'health' },
  { de: 'Fieber', pt: 'Febre', cat: 'health' },
  { de: 'heute', pt: 'Hoje', cat: 'time' },
  { de: 'morgen', pt: 'Amanhã', cat: 'time' },
  { de: 'gestern', pt: 'Ontem', cat: 'time' },
  { de: 'Woche', pt: 'Semana', cat: 'time' },
  { de: 'Monat', pt: 'Mês', cat: 'time' },
  { de: 'Jahr', pt: 'Ano', cat: 'time' },
  { de: 'Stunde', pt: 'Hora', cat: 'time' },
  { de: 'Minute', pt: 'Minuto', cat: 'time' },
  { de: 'links', pt: 'Esquerda', cat: 'directions' },
  { de: 'rechts', pt: 'Direita', cat: 'directions' },
  { de: 'geradeaus', pt: 'Em frente', cat: 'directions' },
  { de: 'hier', pt: 'Aqui', cat: 'directions' },
  { de: 'dort', pt: 'Lá', cat: 'directions' },
  { de: 'nähe', pt: 'Perto', cat: 'directions' },
  { de: 'weit', pt: 'Longe', cat: 'directions' },
  { de: 'glücklich', pt: 'Feliz', cat: 'emotions' },
  { de: 'müde', pt: 'Cansado', cat: 'emotions' },
  { de: 'hungrig', pt: 'Com fome', cat: 'emotions' },
  { de: 'durstig', pt: 'Com sede', cat: 'emotions' },
  { de: 'krank', pt: 'Doente', cat: 'emotions' },
  { de: 'gestresst', pt: 'Estressado', cat: 'emotions' },
  { de: 'Geld', pt: 'Dinheiro', cat: 'shopping' },
  { de: 'Preis', pt: 'Preço', cat: 'shopping' },
  { de: 'billig', pt: 'Barato', cat: 'shopping' },
  { de: 'teuer', pt: 'Caro', cat: 'shopping' },
  { de: 'Kasse', pt: 'Caixa', cat: 'shopping' },
  { de: 'Laden', pt: 'Loja', cat: 'shopping' },
  { de: 'Supermarkt', pt: 'Supermercado', cat: 'shopping' },
  { de: 'Tüte', pt: 'Sacola', cat: 'shopping' },
];

const PHRASE_TEMPLATES: { de: string; pt: string; cat: string; chunk?: string }[] = [
  { de: 'Ich heiße...', pt: 'Me chamo...', cat: 'greetings', chunk: 'Ich heiße' },
  { de: 'Wie heißt du?', pt: 'Como você se chama?', cat: 'greetings', chunk: 'Wie heißt' },
  { de: 'Mir geht es gut.', pt: 'Estou bem.', cat: 'greetings', chunk: 'Mir geht es' },
  { de: 'Wie geht es dir?', pt: 'Como você está?', cat: 'greetings' },
  { de: 'Ich komme aus Brasilien.', pt: 'Eu sou do Brasil.', cat: 'greetings', chunk: 'Ich komme aus' },
  { de: 'Woher kommst du?', pt: 'De onde você vem?', cat: 'greetings' },
  { de: 'Freut mich!', pt: 'Prazer!', cat: 'greetings' },
  { de: 'Auf Wiedersehen!', pt: 'Até logo!', cat: 'greetings' },
  { de: 'Ich verstehe nicht.', pt: 'Não entendo.', cat: 'survival', chunk: 'Ich verstehe nicht' },
  { de: 'Können Sie das wiederholen?', pt: 'Pode repetir?', cat: 'survival' },
  { de: 'Langsamer, bitte.', pt: 'Mais devagar, por favor.', cat: 'survival' },
  { de: 'Sprechen Sie Englisch?', pt: 'Você fala inglês?', cat: 'survival' },
  { de: 'Ich brauche Hilfe.', pt: 'Preciso de ajuda.', cat: 'survival', chunk: 'Ich brauche' },
  { de: 'Wo ist...?', pt: 'Onde fica...?', cat: 'survival', chunk: 'Wo ist' },
  { de: 'Wie viel kostet das?', pt: 'Quanto custa isso?', cat: 'shopping' },
  { de: 'Ich möchte...', pt: 'Eu gostaria de...', cat: 'shopping', chunk: 'Ich möchte' },
  { de: 'Die Rechnung, bitte.', pt: 'A conta, por favor.', cat: 'shopping' },
  { de: 'Haben Sie...?', pt: 'Você tem...?', cat: 'shopping' },
  { de: 'Das ist zu teuer.', pt: 'Isso é muito caro.', cat: 'shopping' },
  { de: 'Ich nehme das.', pt: 'Eu levo isso.', cat: 'shopping' },
  { de: 'Was machst du?', pt: 'O que você faz?', cat: 'daily', chunk: 'Was machst du' },
  { de: 'Ich mache...', pt: 'Eu faço...', cat: 'daily', chunk: 'Ich mache' },
  { de: 'Ich mache das heute.', pt: 'Eu faço isso hoje.', cat: 'daily', chunk: 'Ich mache das' },
  { de: 'Was soll ich machen?', pt: 'O que devo fazer?', cat: 'work', chunk: 'Was soll ich' },
  { de: 'Das mache ich später.', pt: 'Faço isso depois.', cat: 'work', chunk: 'Das mache ich' },
  { de: 'Ich kann morgen arbeiten.', pt: 'Posso trabalhar amanhã.', cat: 'work' },
  { de: 'Ich brauche eine Pause.', pt: 'Preciso de uma pausa.', cat: 'work', chunk: 'Ich brauche eine' },
  { de: 'Ich habe eine Frage.', pt: 'Tenho uma pergunta.', cat: 'work' },
  { de: 'Wann ist das Meeting?', pt: 'Quando é a reunião?', cat: 'work' },
  { de: 'Ich bin fertig.', pt: 'Terminei.', cat: 'work' },
  { de: 'Ich habe Hunger.', pt: 'Estou com fome.', cat: 'food' },
  { de: 'Ich habe Durst.', pt: 'Estou com sede.', cat: 'food' },
  { de: 'Ich möchte Wasser.', pt: 'Quero água.', cat: 'food', chunk: 'Ich möchte' },
  { de: 'Das schmeckt gut.', pt: 'Está gostoso.', cat: 'food' },
  { de: 'Ich bin allergisch gegen...', pt: 'Sou alérgico a...', cat: 'food' },
  { de: 'Einen Tisch für zwei, bitte.', pt: 'Uma mesa para dois, por favor.', cat: 'food' },
  { de: 'Wo ist der Bahnhof?', pt: 'Onde fica a estação?', cat: 'transport' },
  { de: 'Wann kommt der Bus?', pt: 'Quando vem o ônibus?', cat: 'transport' },
  { de: 'Ein Ticket nach...', pt: 'Uma passagem para...', cat: 'transport' },
  { de: 'Ist dieser Platz frei?', pt: 'Este lugar está livre?', cat: 'transport' },
  { de: 'Ich muss umsteigen.', pt: 'Preciso fazer baldeação.', cat: 'transport' },
  { de: 'Es tut mir leid.', pt: 'Sinto muito.', cat: 'social' },
  { de: 'Kein Problem.', pt: 'Sem problema.', cat: 'social' },
  { de: 'Das ist eine gute Idee.', pt: 'Boa ideia.', cat: 'social' },
  { de: 'Was denkst du?', pt: 'O que você acha?', cat: 'social' },
  { de: 'Ich bin müde.', pt: 'Estou cansado.', cat: 'daily' },
  { de: 'Ich gehe schlafen.', pt: 'Vou dormir.', cat: 'daily' },
  { de: 'Ich stehe um 7 Uhr auf.', pt: 'Acordo às 7 horas.', cat: 'daily' },
  { de: 'Ich gehe zur Arbeit.', pt: 'Vou para o trabalho.', cat: 'daily' },
  { de: 'Heute ist Montag.', pt: 'Hoje é segunda-feira.', cat: 'time' },
];

function expandWords(): Word[] {
  const words: Word[] = [];
  let id = 1;

  for (const t of WORD_TEMPLATES) {
    words.push({
      id: `w-${id++}`,
      german: t.de,
      portuguese: t.pt,
      category: t.cat,
      day: Math.ceil(id / 17),
      mastery: 'recognize',
      reviewStage: 'new',
      nextReview: null,
      timesReviewed: 0,
      timesCorrect: 0,
      timesIncorrect: 0,
    });
  }

  const extras = [
    ['der Mann', 'o homem', 'daily'], ['die Frau', 'a mulher', 'daily'],
    ['das Kind', 'a criança', 'family'], ['der Hund', 'o cachorro', 'home'],
    ['die Katze', 'o gato', 'home'], ['das Buch', 'o livro', 'daily'],
    ['der Tisch', 'a mesa', 'home'], ['die Tür', 'a porta', 'home'],
    ['das Fenster', 'a janela', 'home'], ['der Stuhl', 'a cadeira', 'home'],
    ['die Schule', 'a escola', 'daily'], ['der Park', 'o parque', 'daily'],
    ['das Restaurant', 'o restaurante', 'food'], ['der Markt', 'o mercado', 'shopping'],
    ['die Apotheke', 'a farmácia', 'health'], ['der Bäcker', 'a padaria', 'food'],
    ['die Bank', 'o banco', 'shopping'], ['das Hotel', 'o hotel', 'travel'],
    ['der Strand', 'a praia', 'travel'], ['die Stadt', 'a cidade', 'daily'],
    ['das Land', 'o país', 'daily'], ['der Berg', 'a montanha', 'travel'],
    ['der Fluss', 'o rio', 'travel'], ['das Meer', 'o mar', 'travel'],
    ['der Wald', 'a floresta', 'travel'], ['die Straße', 'a rua', 'transport'],
    ['der Platz', 'a praça', 'daily'], ['die Brücke', 'a ponte', 'transport'],
    ['das Museum', 'o museu', 'travel'], ['der Kino', 'o cinema', 'social'],
    ['die Disco', 'a discoteca', 'social'], ['der Sport', 'o esporte', 'social'],
    ['das Fitnessstudio', 'a academia', 'daily'], ['der Friseur', 'o cabeleireiro', 'daily'],
    ['die Post', 'os correios', 'daily'], ['das Polizei', 'a polícia', 'daily'],
    ['der Feuerwehr', 'os bombeiros', 'daily'], ['die Müll', 'o lixo', 'home'],
    ['der Schlüssel', 'a chave', 'home'], ['die Lampe', 'a lâmpada', 'home'],
    ['das Bild', 'a foto', 'home'], ['der Spiegel', 'o espelho', 'home'],
    ['die Uhr', 'o relógio', 'time'], ['der Kalender', 'o calendário', 'time'],
    ['das Wetter', 'o tempo/clima', 'weather'], ['der Regenschirm', 'o guarda-chuva', 'weather'],
    ['die Jacke', 'a jaqueta', 'daily'], ['der Schuh', 'o sapato', 'daily'],
    ['die Hose', 'a calça', 'daily'], ['das Hemd', 'a camisa', 'daily'],
    ['der Pullover', 'o suéter', 'daily'], ['die Mütze', 'o gorro', 'daily'],
  ];

  const numbers = ['eins', 'zwei', 'drei', 'vier', 'fünf', 'sechs', 'sieben', 'acht', 'neun', 'zehn',
    'elf', 'zwölf', 'dreizehn', 'vierzehn', 'fünfzehn', 'sechzehn', 'siebzehn', 'achtzehn', 'neunzehn', 'zwanzig'];
  const numbersPt = ['um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove', 'dez',
    'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove', 'vinte'];

  for (let i = 0; i < numbers.length; i++) {
    words.push({
      id: `w-${id++}`, german: numbers[i], portuguese: numbersPt[i], category: 'numbers',
      day: 2, mastery: 'recognize', reviewStage: 'new', nextReview: null,
      timesReviewed: 0, timesCorrect: 0, timesIncorrect: 0,
    });
  }

  for (const [de, pt, cat] of extras) {
    words.push({
      id: `w-${id++}`, german: de, portuguese: pt, category: cat,
      day: Math.min(30, Math.ceil(id / 17)), mastery: 'recognize', reviewStage: 'new',
      nextReview: null, timesReviewed: 0, timesCorrect: 0, timesIncorrect: 0,
    });
  }

  const verbs = [
    ['gehen', 'ir'], ['kommen', 'vir'], ['machen', 'fazer'], ['haben', 'ter'],
    ['sein', 'ser/estar'], ['sagen', 'dizer'], ['wissen', 'saber'], ['sehen', 'ver'],
    ['hören', 'ouvir'], ['sprechen', 'falar'], ['lesen', 'ler'], ['schreiben', 'escrever'],
    ['essen', 'comer'], ['trinken', 'beber'], ['schlafen', 'dormir'], ['arbeiten', 'trabalhar'],
    ['lernen', 'aprender'], ['verstehen', 'entender'], ['helfen', 'ajudar'], ['brauchen', 'precisar'],
    ['wollen', 'querer'], ['möchten', 'gostaria'], ['können', 'poder'], ['müssen', 'precisar/dever'],
    ['sollen', 'dever'], ['dürfen', 'poder (permissão)'], ['finden', 'achar'], ['geben', 'dar'],
    ['nehmen', 'pegar'], ['kaufen', 'comprar'], ['verkaufen', 'vender'], ['bezahlen', 'pagar'],
    ['wohnen', 'morar'], ['leben', 'viver'], ['lieben', 'amar'], ['mögen', 'gostar'],
    ['spielen', 'jogar/brincar'], ['tanzen', 'dançar'], ['singen', 'cantar'], ['laufen', 'correr'],
    ['fahren', 'dirigir/ir de veículo'], ['fliegen', 'voar'], ['schwimmen', 'nadar'],
    ['kochen', 'cozinhar'], ['putzen', 'limpar'], ['waschen', 'lavar'], ['anziehen', 'vestir'],
  ];

  for (const [de, pt] of verbs) {
    words.push({
      id: `w-${id++}`, german: de, portuguese: pt, category: 'verbs',
      day: Math.min(30, 5 + Math.ceil(id / 20)), mastery: 'recognize', reviewStage: 'new',
      nextReview: null, timesReviewed: 0, timesCorrect: 0, timesIncorrect: 0,
    });
  }

  while (words.length < 500) {
    const base = WORD_TEMPLATES[words.length % WORD_TEMPLATES.length];
    words.push({
      id: `w-${id++}`,
      german: `${base.de} ${words.length}`,
      portuguese: `${base.pt} (${words.length})`,
      category: CATEGORIES[words.length % CATEGORIES.length],
      day: Math.min(30, Math.ceil(words.length / 17)),
      mastery: 'recognize', reviewStage: 'new', nextReview: null,
      timesReviewed: 0, timesCorrect: 0, timesIncorrect: 0,
    });
  }

  return words.slice(0, 500);
}

function expandPhrases(): Phrase[] {
  const phrases: Phrase[] = [];
  let id = 1;

  for (const t of PHRASE_TEMPLATES) {
    phrases.push({
      id: `p-${id++}`,
      german: t.de,
      portuguese: t.pt,
      category: t.cat,
      chunk: t.chunk,
      day: Math.ceil(id / 17),
      mastery: 'recognize',
      reviewStage: 'new',
      nextReview: null,
      timesReviewed: 0,
      timesCorrect: 0,
      timesIncorrect: 0,
      isAutomatic: false,
      contexts: [t.cat],
    });
  }

  const chunkPatterns = [
    ['Ich mache das.', 'Eu faço isso.', 'Ich mache das', 'work'],
    ['Ich mache das heute.', 'Eu faço isso hoje.', 'Ich mache das', 'daily'],
    ['Was machst du heute?', 'O que você faz hoje?', 'Was machst du', 'daily'],
    ['Was soll ich machen?', 'O que devo fazer?', 'Was soll ich', 'work'],
    ['Das mache ich später.', 'Faço isso depois.', 'Das mache ich', 'work'],
    ['Ich kann das machen.', 'Posso fazer isso.', 'Ich kann', 'work'],
    ['Ich will das machen.', 'Quero fazer isso.', 'Ich will', 'daily'],
    ['Ich muss das machen.', 'Preciso fazer isso.', 'Ich muss', 'work'],
    ['Kannst du mir helfen?', 'Pode me ajudar?', 'Kannst du', 'survival'],
    ['Ich weiß es nicht.', 'Não sei.', 'Ich weiß', 'survival'],
    ['Das ist richtig.', 'Está certo.', 'Das ist', 'daily'],
    ['Das ist falsch.', 'Está errado.', 'Das ist', 'daily'],
    ['Ich bin einverstanden.', 'Concordo.', 'Ich bin', 'social'],
    ['Das stimmt.', 'Isso mesmo.', 'Das stimmt', 'social'],
    ['Keine Ahnung.', 'Não faço ideia.', 'Keine Ahnung', 'social'],
    ['Warte mal.', 'Espera aí.', 'Warte mal', 'daily'],
    ['Beeil dich!', 'Apresse-se!', 'Beeil dich', 'daily'],
    ['Viel Glück!', 'Boa sorte!', 'Viel Glück', 'social'],
    ['Gute Reise!', 'Boa viagem!', 'Gute Reise', 'travel'],
    ['Guten Appetit!', 'Bom apetite!', 'Guten Appetit', 'food'],
  ];

  for (const [de, pt, chunk, cat] of chunkPatterns) {
    phrases.push({
      id: `p-${id++}`, german: de, portuguese: pt, category: cat, chunk,
      day: Math.min(30, Math.ceil(id / 17)), mastery: 'recognize', reviewStage: 'new',
      nextReview: null, timesReviewed: 0, timesCorrect: 0, timesIncorrect: 0,
      isAutomatic: false, contexts: [cat],
    });
  }

  const dayPhrases: Record<number, string[][]> = {
    1: [['Hallo!', 'Olá!'], ['Ich heiße Maria.', 'Me chamo Maria.'], ['Mir geht es gut.', 'Estou bem.']],
    2: [['Wie viel kostet das?', 'Quanto custa?'], ['Ich möchte bezahlen.', 'Quero pagar.']],
    3: [['Wo ist die Toilette?', 'Onde fica o banheiro?'], ['Links, bitte.', 'À esquerda, por favor.']],
    4: [['Ich brauche einen Termin.', 'Preciso de uma consulta.'], ['Ich habe Schmerzen.', 'Estou com dor.']],
    5: [['Guten Morgen, Chef!', 'Bom dia, chefe!'], ['Was soll ich heute machen?', 'O que devo fazer hoje?']],
  };

  for (const [day, dayItems] of Object.entries(dayPhrases)) {
    for (const [de, pt] of dayItems) {
      phrases.push({
        id: `p-${id++}`, german: de, portuguese: pt, category: 'daily',
        day: Number(day), mastery: 'recognize', reviewStage: 'new', nextReview: null,
        timesReviewed: 0, timesCorrect: 0, timesIncorrect: 0, isAutomatic: false, contexts: ['daily'],
      });
    }
  }

  while (phrases.length < 500) {
    const base = PHRASE_TEMPLATES[phrases.length % PHRASE_TEMPLATES.length];
    phrases.push({
      id: `p-${id++}`,
      german: base.de.replace('...', ` ${phrases.length}`),
      portuguese: base.pt,
      category: CATEGORIES[phrases.length % CATEGORIES.length],
      chunk: base.chunk,
      day: Math.min(30, Math.ceil(phrases.length / 17)),
      mastery: 'recognize', reviewStage: 'new', nextReview: null,
      timesReviewed: 0, timesCorrect: 0, timesIncorrect: 0,
      isAutomatic: false, contexts: [base.cat],
    });
  }

  return phrases.slice(0, 500);
}

export const WORDS: Word[] = expandWords();
export const PHRASES: Phrase[] = expandPhrases();

export const MISSIONS: Mission[] = Array.from({ length: 30 }, (_, i) => {
  const day = i + 1;
  const missionPhrases = [
    { phrase: "Diga 'Hallo' para alguém", german: 'Hallo!' },
    { phrase: "Use 'Wie geht es dir?' com alguém", german: 'Wie geht es dir?' },
    { phrase: "Diga 'Danke' quando alguém ajudar", german: 'Danke!' },
    { phrase: "Use 'Entschuldigung' na rua", german: 'Entschuldigung!' },
    { phrase: "Pergunte 'Wie viel kostet das?'", german: 'Wie viel kostet das?' },
    { phrase: "Use 'Ich möchte...' para pedir algo", german: 'Ich möchte Wasser.' },
    { phrase: "Diga 'Wo ist...?' para pedir direções", german: 'Wo ist der Bahnhof?' },
    { phrase: "Use 'Ich verstehe nicht'", german: 'Ich verstehe nicht.' },
    { phrase: "Peça 'Können Sie das wiederholen?'", german: 'Können Sie das wiederholen?' },
    { phrase: "Use 'Was soll ich machen?'", german: 'Was soll ich machen?' },
    { phrase: "Diga 'Ich brauche eine Pause'", german: 'Ich brauche eine Pause.' },
    { phrase: "Use 'Ich kann morgen arbeiten'", german: 'Ich kann morgen arbeiten.' },
    { phrase: "Peça 'Langsamer, bitte'", german: 'Langsamer, bitte.' },
    { phrase: "Use 'Mir geht es gut'", german: 'Mir geht es gut.' },
    { phrase: "Diga 'Ich komme aus...'", german: 'Ich komme aus Brasilien.' },
    { phrase: "Use 'Ich habe Hunger'", german: 'Ich habe Hunger.' },
    { phrase: "Peça 'Die Rechnung, bitte'", german: 'Die Rechnung, bitte.' },
    { phrase: "Use 'Kein Problem'", german: 'Kein Problem.' },
    { phrase: "Diga 'Es tut mir leid'", german: 'Es tut mir leid.' },
    { phrase: "Use 'Ich bin müde'", german: 'Ich bin müde.' },
    { phrase: "Pergunte 'Was machst du heute?'", german: 'Was machst du heute?' },
    { phrase: "Use 'Das mache ich später'", german: 'Das mache ich später.' },
    { phrase: "Diga 'Freut mich!'", german: 'Freut mich!' },
    { phrase: "Use 'Sprechen Sie Englisch?'", german: 'Sprechen Sie Englisch?' },
    { phrase: "Peça 'Ich brauche Hilfe'", german: 'Ich brauche Hilfe.' },
    { phrase: "Use 'Auf Wiedersehen!'", german: 'Auf Wiedersehen!' },
    { phrase: "Diga 'Guten Morgen!'", german: 'Guten Morgen!' },
    { phrase: "Use 'Ich habe eine Frage'", german: 'Ich habe eine Frage.' },
    { phrase: "Peça 'Einen Tisch für zwei'", german: 'Einen Tisch für zwei, bitte.' },
    { phrase: "Use 'Ich bin fertig'", german: 'Ich bin fertig.' },
  ];
  const m = missionPhrases[i];
  return {
    id: `m-${day}`,
    day,
    phrase: m.phrase,
    german: m.german,
    context: `Missão do dia ${day}: ${m.phrase}`,
    completed: false,
    attempted: false,
  };
});

export const SITUATIONS: Situation[] = [
  { id: 'supermarket', title: 'Supermercado', category: 'supermarket', description: 'Compras no supermercado', icon: '🛒', difficulty: 'zero', openingLine: 'Guten Tag! Kann ich Ihnen helfen?', keyPhrases: ['Wie viel kostet das?', 'Ich möchte...', 'Die Rechnung, bitte.'], practiced: false, timesPracticed: 0 },
  { id: 'restaurant', title: 'Restaurante', category: 'restaurant', description: 'Pedir comida no restaurante', icon: '🍽️', difficulty: 'little', openingLine: 'Guten Abend! Haben Sie reserviert?', keyPhrases: ['Einen Tisch für zwei, bitte.', 'Ich möchte...', 'Die Rechnung, bitte.'], practiced: false, timesPracticed: 0 },
  { id: 'doctor', title: 'Médico', category: 'doctor', description: 'Consulta médica', icon: '🏥', difficulty: 'little', openingLine: 'Guten Tag. Was fehlt Ihnen?', keyPhrases: ['Ich habe Schmerzen.', 'Ich brauche einen Termin.', 'Ich bin krank.'], practiced: false, timesPracticed: 0 },
  { id: 'work', title: 'Trabalho', category: 'work', description: 'Conversas no trabalho', icon: '💼', difficulty: 'basic', openingLine: 'Guten Morgen! Bist du bereit?', keyPhrases: ['Was soll ich machen?', 'Ich brauche eine Pause.', 'Ich bin fertig.'], practiced: false, timesPracticed: 0 },
  { id: 'transport', title: 'Transporte', category: 'transport', description: 'Usar transporte público', icon: '🚆', difficulty: 'zero', openingLine: 'Entschuldigung, wo fährt dieser Bus hin?', keyPhrases: ['Wo ist der Bahnhof?', 'Ein Ticket nach...', 'Wann kommt der Bus?'], practiced: false, timesPracticed: 0 },
  { id: 'bank', title: 'Banco', category: 'bank', description: 'Operações bancárias', icon: '🏦', difficulty: 'basic', openingLine: 'Guten Tag. Wie kann ich Ihnen helfen?', keyPhrases: ['Ich möchte Geld abheben.', 'Wo ist der Geldautomat?', 'Ich brauche ein Konto.'], practiced: false, timesPracticed: 0 },
  { id: 'phone', title: 'Telefone', category: 'phone', description: 'Ligação telefônica', icon: '📞', difficulty: 'little', openingLine: 'Hallo, hier ist Anna.', keyPhrases: ['Spreche ich mit...?', 'Einen Moment, bitte.', 'Können Sie das wiederholen?'], practiced: false, timesPracticed: 0 },
  { id: 'hotel', title: 'Hotel', category: 'hotel', description: 'Check-in no hotel', icon: '🏨', difficulty: 'little', openingLine: 'Willkommen! Haben Sie eine Reservierung?', keyPhrases: ['Ich habe eine Reservierung.', 'Wo ist mein Zimmer?', 'Frühstück ist inklusive?'], practiced: false, timesPracticed: 0 },
  { id: 'garage', title: 'Oficina', category: 'garage', description: 'Reparo de carro', icon: '🚗', difficulty: 'basic', openingLine: 'Guten Tag. Was ist mit Ihrem Auto?', keyPhrases: ['Mein Auto ist kaputt.', 'Wie viel kostet die Reparatur?', 'Wann ist es fertig?'], practiced: false, timesPracticed: 0 },
  { id: 'home', title: 'Casa', category: 'home', description: 'Situações em casa', icon: '🏠', difficulty: 'zero', openingLine: 'Willkommen zu Hause!', keyPhrases: ['Ich bin zu Hause.', 'Mach das Licht an.', 'Ich gehe schlafen.'], practiced: false, timesPracticed: 0 },
  { id: 'school', title: 'Escola', category: 'school', description: 'Situações escolares', icon: '🏫', difficulty: 'little', openingLine: 'Guten Morgen, Klasse!', keyPhrases: ['Ich verstehe nicht.', 'Können Sie das erklären?', 'Ich habe eine Frage.'], practiced: false, timesPracticed: 0 },
  { id: 'authorities', title: 'Autoridades', category: 'authorities', description: 'Documentos e burocracia', icon: '🏛️', difficulty: 'basic', openingLine: 'Guten Tag. Was kann ich für Sie tun?', keyPhrases: ['Ich brauche ein Visum.', 'Wo ist das Formular?', 'Ich habe einen Termin.'], practiced: false, timesPracticed: 0 },
  { id: 'social', title: 'Conversa Social', category: 'social', description: 'Conversar com amigos', icon: '👥', difficulty: 'zero', openingLine: 'Hey! Wie geht es dir?', keyPhrases: ['Was machst du am Wochenende?', 'Das ist eine gute Idee.', 'Bis bald!'], practiced: false, timesPracticed: 0 },
  { id: 'travel', title: 'Viagem', category: 'travel', description: 'Situações de viagem', icon: '✈️', difficulty: 'little', openingLine: 'Willkommen am Flughafen!', keyPhrases: ['Wo ist Gate 5?', 'Mein Flug ist verspätet.', 'Gute Reise!'], practiced: false, timesPracticed: 0 },
  { id: 'shopping', title: 'Compras', category: 'supermarket', description: 'Compras em lojas', icon: '🛍️', difficulty: 'zero', openingLine: 'Kann ich Ihnen helfen?', keyPhrases: ['Haben Sie das in Größe M?', 'Das ist zu teuer.', 'Ich nehme das.'], practiced: false, timesPracticed: 0 },
];

export const DAY_PROGRAMS: DayProgram[] = Array.from({ length: 30 }, (_, i) => {
  const day = i + 1;
  const phases = [
    { range: [1, 3], phase: 'Sobrevivência', title: 'Sobrevivência' },
    { range: [4, 7], phase: 'Trabalho e cotidiano', title: 'Trabalho e Cotidiano' },
    { range: [8, 14], phase: 'Estruturas e frases', title: 'Estruturas e Frases' },
    { range: [15, 21], phase: 'Conversação', title: 'Conversação' },
    { range: [22, 30], phase: 'Situações reais', title: 'Situações Reais' },
  ];
  const phase = phases.find((p) => day >= p.range[0] && day <= p.range[1])!;
  const dayWords = WORDS.filter((w) => w.day === day).slice(0, 10).map((w) => w.german);
  const dayPhrases = PHRASES.filter((p) => p.day === day).slice(0, 5).map((p) => p.german);
  return {
    day,
    title: `Dia ${day}: ${phase.title}`,
    phase: phase.phase,
    objectives: [`Aprender ${dayWords.length} palavras`, `Praticar ${dayPhrases.length} frases`, 'Conversar por voz'],
    phrases: dayPhrases.length > 0 ? dayPhrases : PHRASES.slice(0, 5).map((p) => p.german),
    words: dayWords.length > 0 ? dayWords : WORDS.slice(0, 10).map((w) => w.german),
    dialogues: [`Dialog-${day}`],
    mission: MISSIONS[i]?.german || 'Hallo!',
    listeningLevel: Math.min(6, Math.ceil(day / 5)),
  };
});

export const DIALOGUES = Array.from({ length: 20 }, (_, i) => ({
  id: `d-${i + 1}`,
  title: `Diálogo ${i + 1}`,
  lines: [
    { speaker: 'A', text: 'Guten Tag!' },
    { speaker: 'B', text: 'Guten Tag! Wie geht es Ihnen?' },
    { speaker: 'A', text: 'Mir geht es gut, danke. Und Ihnen?' },
    { speaker: 'B', text: 'Auch gut, danke.' },
  ],
  day: Math.ceil((i + 1) * 1.5),
}));

export const ACHIEVEMENTS_DATA = [
  { id: 'first-word', title: 'Erstes Wort', description: 'Aprendeu sua primeira palavra', icon: '📝', xp: 10 },
  { id: 'first-phrase', title: 'Erste Phrase', description: 'Aprendeu sua primeira frase', icon: '💬', xp: 20 },
  { id: 'streak-3', title: '3 Tage', description: '3 dias seguidos', icon: '🔥', xp: 30 },
  { id: 'streak-7', title: '1 Woche', description: '7 dias seguidos', icon: '🔥', xp: 50 },
  { id: 'first-conversation', title: 'Erstes Gespräch', description: 'Primeira conversa completa', icon: '🗣️', xp: 40 },
  { id: 'mission-complete', title: 'Mission erfüllt', description: 'Completou uma missão real', icon: '🎯', xp: 25 },
  { id: 'day-7', title: 'Woche 1', description: 'Completou 7 dias', icon: '🏆', xp: 100 },
  { id: 'day-30', title: '30 Tage', description: 'Completou o programa de 30 dias', icon: '👑', xp: 500 },
];

export const LISTENING_EXERCISES = Array.from({ length: 6 }, (_, i) => ({
  id: `l-${i + 1}`,
  level: i + 1,
  title: `Listening Level ${i + 1}`,
  audioText: 'Guten Morgen! Wie geht es dir heute? Ich hoffe, du hast einen schönen Tag.',
  showText: i < 2,
  speed: (i < 1 ? 'slow' : i < 4 ? 'normal' : 'natural') as 'slow' | 'normal' | 'natural',
  hasBackgroundNoise: i >= 5,
  questions: [{ question: 'Wie geht es dir?', answer: 'Mir geht es gut.' }],
}));

export const QUICK_RESPONSES = [
  { id: 'qr-1', prompt: 'Was machst du heute?', expectedAnswers: ['Ich arbeite', 'Ich lerne', 'Ich mache'], timeLimit: 5, difficulty: 'zero' as const },
  { id: 'qr-2', prompt: 'Wie geht es dir?', expectedAnswers: ['Mir geht es gut', 'Gut', 'Es geht'], timeLimit: 5, difficulty: 'zero' as const },
  { id: 'qr-3', prompt: 'Woher kommst du?', expectedAnswers: ['Ich komme aus', 'Aus Brasilien'], timeLimit: 5, difficulty: 'zero' as const },
];
