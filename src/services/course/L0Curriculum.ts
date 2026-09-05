/**
 * L0Curriculum — pré-A1 executável em 8 módulos.
 * Targets canônicos para Meu Curso / ContinueCourse / gate L0→A1.
 * ZeroLanguageMode continua a ser a camada pedagógica Live (seeds, blocks, chunk graph).
 *
 * Targets NOVOS (mínimos) — ver L0_NEW_TARGET_IDS.
 */
import type { Phrase } from '@/types';
import type { PhraseConfidence, UserLearningProfile } from '@/services/learning/ConfidenceService';
import { isZeroLanguagePhraseAccepted } from '@/services/teacher/ZeroLanguageMode';

export interface L0Target {
  id: string;
  level: 'L0';
  unitId: string;
  competencyId: string;
  german: string;
  portuguese: string;
  order: number;
  category: string;
  /** true = criado nesta refatoração pré-A1 */
  isNew?: boolean;
}

/** Cenários da avaliação de saída L0 (produção comunicativa). */
export interface L0ExitScenario {
  id: string;
  titlePt: string;
  situationPt: string;
  competencyIds: readonly string[];
  /** Targets que evidenciam capacidade neste cenário */
  evidenceTargetIds: readonly string[];
}

const T = (
  partial: Omit<L0Target, 'level'> & { level?: 'L0' },
): L0Target => ({
  level: 'L0',
  ...partial,
});

/**
 * Registry canônico L0 — ordem curricular u1→u8.
 * Reutiliza IDs existentes sempre que possível.
 */
export const L0_CURRICULUM: L0Target[] = [
  // ——— u1 Primeiros contatos (l0.greet) ———
  T({ id: 'l0-hallo', unitId: 'l0.u1', competencyId: 'l0.greet', german: 'Hallo.', portuguese: 'Oi.', order: 1, category: 'greetings' }),
  T({ id: 'l0-guten-morgen', unitId: 'l0.u1', competencyId: 'l0.greet', german: 'Guten Morgen.', portuguese: 'Bom dia.', order: 2, category: 'greetings' }),
  T({ id: 'l0-guten-tag', unitId: 'l0.u1', competencyId: 'l0.greet', german: 'Guten Tag.', portuguese: 'Boa tarde.', order: 3, category: 'greetings' }),
  T({ id: 'l0-guten-abend', unitId: 'l0.u1', competencyId: 'l0.greet', german: 'Guten Abend.', portuguese: 'Boa noite (início).', order: 4, category: 'greetings' }),
  T({ id: 'l0-gute-nacht', unitId: 'l0.u1', competencyId: 'l0.greet', german: 'Gute Nacht.', portuguese: 'Boa noite (ao dormir).', order: 5, category: 'greetings' }),
  T({ id: 'l0-tschuess', unitId: 'l0.u1', competencyId: 'l0.greet', german: 'Tschüss!', portuguese: 'Tchau!', order: 6, category: 'greetings' }),
  T({ id: 'l0-auf-wiedersehen', unitId: 'l0.u1', competencyId: 'l0.greet', german: 'Auf Wiedersehen.', portuguese: 'Até logo / adeus.', order: 7, category: 'greetings', isNew: true }),
  T({ id: 'l0-bis-morgen', unitId: 'l0.u1', competencyId: 'l0.greet', german: 'Bis morgen.', portuguese: 'Até amanhã.', order: 8, category: 'greetings', isNew: true }),
  T({ id: 'l0-danke', unitId: 'l0.u1', competencyId: 'l0.greet', german: 'Danke.', portuguese: 'Obrigado.', order: 9, category: 'greetings' }),
  T({ id: 'l0-vielen-dank', unitId: 'l0.u1', competencyId: 'l0.greet', german: 'Vielen Dank.', portuguese: 'Muito obrigado.', order: 10, category: 'greetings', isNew: true }),
  T({ id: 'l0-bitte', unitId: 'l0.u1', competencyId: 'l0.greet', german: 'Bitte.', portuguese: 'Por favor. / De nada.', order: 11, category: 'greetings' }),
  T({ id: 'l0-entschuldigung', unitId: 'l0.u1', competencyId: 'l0.greet', german: 'Entschuldigung.', portuguese: 'Com licença / desculpe.', order: 12, category: 'greetings', isNew: true }),
  T({ id: 'l0-kein-problem', unitId: 'l0.u1', competencyId: 'l0.greet', german: 'Kein Problem.', portuguese: 'Sem problema.', order: 13, category: 'greetings', isNew: true }),
  T({ id: 'l0-wie-gehts', unitId: 'l0.u1', competencyId: 'l0.greet', german: "Wie geht's?", portuguese: 'Como você está?', order: 14, category: 'greetings' }),
  T({ id: 'l0-mir-gehts-gut', unitId: 'l0.u1', competencyId: 'l0.greet', german: "Mir geht's gut.", portuguese: 'Estou bem.', order: 15, category: 'greetings' }),

  // ——— u2 Eu sou (l0.introduce) ———
  T({ id: 'l0-ich-heisse', unitId: 'l0.u2', competencyId: 'l0.introduce', german: 'Ich heiße...', portuguese: 'Eu me chamo...', order: 16, category: 'identity' }),
  T({ id: 'l0-ich-bin', unitId: 'l0.u2', competencyId: 'l0.introduce', german: 'Ich bin...', portuguese: 'Eu sou...', order: 17, category: 'identity' }),
  T({ id: 'l0-ich-komme', unitId: 'l0.u2', competencyId: 'l0.introduce', german: 'Ich komme aus...', portuguese: 'Eu venho de...', order: 18, category: 'identity' }),
  T({ id: 'l0-ich-wohne', unitId: 'l0.u2', competencyId: 'l0.introduce', german: 'Ich wohne in...', portuguese: 'Eu moro em...', order: 19, category: 'identity' }),
  T({ id: 'l0-ich-bin-jahre', unitId: 'l0.u2', competencyId: 'l0.introduce', german: 'Ich bin ... Jahre alt.', portuguese: 'Eu tenho ... anos.', order: 20, category: 'identity', isNew: true }),
  T({ id: 'l0-wie-heisst-du', unitId: 'l0.u2', competencyId: 'l0.introduce', german: 'Wie heißt du?', portuguese: 'Como você se chama?', order: 21, category: 'identity', isNew: true }),
  T({ id: 'l0-woher-kommst-du', unitId: 'l0.u2', competencyId: 'l0.introduce', german: 'Woher kommst du?', portuguese: 'De onde você vem?', order: 22, category: 'identity', isNew: true }),
  T({ id: 'l0-wo-wohnst-du', unitId: 'l0.u2', competencyId: 'l0.introduce', german: 'Wo wohnst du?', portuguese: 'Onde você mora?', order: 23, category: 'identity', isNew: true }),
  T({ id: 'l0-wie-alt-bist-du', unitId: 'l0.u2', competencyId: 'l0.introduce', german: 'Wie alt bist du?', portuguese: 'Quantos anos você tem?', order: 24, category: 'identity', isNew: true }),

  // ——— u3 Pessoas importantes (l0.people) ———
  T({ id: 'l0-das-ist', unitId: 'l0.u3', competencyId: 'l0.people', german: 'Das ist...', portuguese: 'Isto / esta é...', order: 25, category: 'people', isNew: true }),
  T({ id: 'l0-ich-habe', unitId: 'l0.u3', competencyId: 'l0.people', german: 'Ich habe...', portuguese: 'Eu tenho...', order: 26, category: 'people', isNew: true }),
  T({ id: 'l0-das-ist-meine-mutter', unitId: 'l0.u3', competencyId: 'l0.people', german: 'Das ist meine Mutter.', portuguese: 'Esta é a minha mãe.', order: 27, category: 'people', isNew: true }),
  T({ id: 'l0-das-ist-mein-vater', unitId: 'l0.u3', competencyId: 'l0.people', german: 'Das ist mein Vater.', portuguese: 'Este é o meu pai.', order: 28, category: 'people', isNew: true }),
  T({ id: 'l0-meine-familie', unitId: 'l0.u3', competencyId: 'l0.people', german: 'Meine Familie.', portuguese: 'Minha família.', order: 29, category: 'people', isNew: true }),
  T({ id: 'l0-mein-freund', unitId: 'l0.u3', competencyId: 'l0.people', german: 'Das ist mein Freund.', portuguese: 'Este é o meu amigo.', order: 30, category: 'people', isNew: true }),
  T({ id: 'l0-meine-freundin', unitId: 'l0.u3', competencyId: 'l0.people', german: 'Das ist meine Freundin.', portuguese: 'Esta é a minha amiga.', order: 31, category: 'people', isNew: true }),

  // ——— u4 Números / tempo / informações (l0.basics) ———
  T({ id: 'l0-eins-zwei-drei', unitId: 'l0.u4', competencyId: 'l0.basics', german: 'Eins, zwei, drei.', portuguese: 'Um, dois, três.', order: 32, category: 'numbers', isNew: true }),
  T({ id: 'l0-zahlen-bis-zehn', unitId: 'l0.u4', competencyId: 'l0.basics', german: 'Eins bis zehn.', portuguese: 'De um a dez.', order: 33, category: 'numbers', isNew: true }),
  T({ id: 'l0-heute', unitId: 'l0.u4', competencyId: 'l0.basics', german: 'Heute.', portuguese: 'Hoje.', order: 34, category: 'time', isNew: true }),
  T({ id: 'l0-morgen-zeit', unitId: 'l0.u4', competencyId: 'l0.basics', german: 'Morgen.', portuguese: 'Amanhã.', order: 35, category: 'time', isNew: true }),
  T({ id: 'l0-gestern', unitId: 'l0.u4', competencyId: 'l0.basics', german: 'Gestern.', portuguese: 'Ontem.', order: 36, category: 'time', isNew: true }),
  T({ id: 'l0-jetzt', unitId: 'l0.u4', competencyId: 'l0.basics', german: 'Jetzt.', portuguese: 'Agora.', order: 37, category: 'time', isNew: true }),
  T({ id: 'l0-spaeter', unitId: 'l0.u4', competencyId: 'l0.basics', german: 'Später.', portuguese: 'Mais tarde.', order: 38, category: 'time', isNew: true }),
  T({ id: 'l0-es-ist-uhr', unitId: 'l0.u4', competencyId: 'l0.basics', german: 'Es ist ... Uhr.', portuguese: 'São ... horas.', order: 39, category: 'time', isNew: true }),
  T({ id: 'l0-das-kostet', unitId: 'l0.u4', competencyId: 'l0.basics', german: 'Das kostet...', portuguese: 'Isso custa...', order: 40, category: 'numbers', isNew: true }),

  // ——— u5 Entender e pedir ajuda (l0.help) ———
  T({ id: 'l0-ja', unitId: 'l0.u5', competencyId: 'l0.help', german: 'Ja.', portuguese: 'Sim.', order: 41, category: 'survival' }),
  T({ id: 'l0-nein', unitId: 'l0.u5', competencyId: 'l0.help', german: 'Nein.', portuguese: 'Não.', order: 42, category: 'survival' }),
  T({ id: 'l0-vielleicht', unitId: 'l0.u5', competencyId: 'l0.help', german: 'Vielleicht.', portuguese: 'Talvez.', order: 43, category: 'survival', isNew: true }),
  T({ id: 'l0-ich-weiss-nicht', unitId: 'l0.u5', competencyId: 'l0.help', german: 'Ich weiß nicht.', portuguese: 'Eu não sei.', order: 44, category: 'survival', isNew: true }),
  T({ id: 'l0-ich-verstehe', unitId: 'l0.u5', competencyId: 'l0.help', german: 'Ich verstehe.', portuguese: 'Eu entendo.', order: 45, category: 'survival', isNew: true }),
  T({ id: 'l0-verstehe-nicht', unitId: 'l0.u5', competencyId: 'l0.help', german: 'Ich verstehe nicht.', portuguese: 'Eu não entendo.', order: 46, category: 'survival' }),
  T({ id: 'l0-noch-einmal', unitId: 'l0.u5', competencyId: 'l0.help', german: 'Noch einmal, bitte.', portuguese: 'Mais uma vez, por favor.', order: 47, category: 'survival' }),
  T({ id: 'l0-langsam-bitte', unitId: 'l0.u5', competencyId: 'l0.help', german: 'Langsam, bitte.', portuguese: 'Devagar, por favor.', order: 48, category: 'survival', isNew: true }),
  T({ id: 'l0-was-bedeutet-das', unitId: 'l0.u5', competencyId: 'l0.help', german: 'Was bedeutet das?', portuguese: 'O que isso significa?', order: 49, category: 'survival', isNew: true }),
  T({ id: 'l0-wie-sagt-man', unitId: 'l0.u5', competencyId: 'l0.help', german: 'Wie sagt man das auf Deutsch?', portuguese: 'Como se diz isso em alemão?', order: 50, category: 'survival', isNew: true }),
  T({ id: 'l0-hilfe', unitId: 'l0.u5', competencyId: 'l0.help', german: 'Hilfe, bitte!', portuguese: 'Socorro, por favor!', order: 51, category: 'survival' }),
  T({ id: 'l0-koennen-sie-wiederholen', unitId: 'l0.u5', competencyId: 'l0.help', german: 'Können Sie das bitte wiederholen?', portuguese: 'Pode repetir, por favor?', order: 52, category: 'survival', isNew: true }),

  // ——— u6 Necessidades (l0.needs) ———
  T({ id: 'l0-hook-ich-moechte', unitId: 'l0.u6', competencyId: 'l0.needs', german: 'Ich möchte...', portuguese: 'Eu gostaria de...', order: 53, category: 'needs' }),
  T({ id: 'l0-hook-ich-brauche', unitId: 'l0.u6', competencyId: 'l0.needs', german: 'Ich brauche...', portuguese: 'Eu preciso de...', order: 54, category: 'needs' }),
  T({ id: 'l0-pause', unitId: 'l0.u6', competencyId: 'l0.needs', german: 'Ich brauche eine Pause.', portuguese: 'Preciso de uma pausa.', order: 55, category: 'needs' }),
  T({ id: 'l0-ich-kann', unitId: 'l0.u6', competencyId: 'l0.needs', german: 'Ich kann...', portuguese: 'Eu posso / consigo...', order: 56, category: 'needs', isNew: true }),
  T({ id: 'l0-ich-kann-nicht', unitId: 'l0.u6', competencyId: 'l0.needs', german: 'Ich kann nicht...', portuguese: 'Eu não posso / não consigo...', order: 57, category: 'needs', isNew: true }),
  T({ id: 'l0-wasser-bitte', unitId: 'l0.u6', competencyId: 'l0.needs', german: 'Wasser, bitte.', portuguese: 'Água, por favor.', order: 58, category: 'needs', isNew: true }),
  T({ id: 'l0-toilette-bitte', unitId: 'l0.u6', competencyId: 'l0.needs', german: 'Die Toilette, bitte.', portuguese: 'O banheiro, por favor.', order: 59, category: 'needs', isNew: true }),

  // ——— u7 Mundo ao redor (l0.world) ———
  T({ id: 'l0-mein-haus', unitId: 'l0.u7', competencyId: 'l0.world', german: 'Das ist mein Haus.', portuguese: 'Esta é a minha casa.', order: 60, category: 'world', isNew: true }),
  T({ id: 'l0-in-der-stadt', unitId: 'l0.u7', competencyId: 'l0.world', german: 'Ich bin in der Stadt.', portuguese: 'Estou na cidade.', order: 61, category: 'world', isNew: true }),
  T({ id: 'l0-zur-arbeit', unitId: 'l0.u7', competencyId: 'l0.world', german: 'Ich gehe zur Arbeit.', portuguese: 'Eu vou ao trabalho.', order: 62, category: 'world', isNew: true }),
  T({ id: 'l0-der-tisch', unitId: 'l0.u7', competencyId: 'l0.world', german: 'Der Tisch.', portuguese: 'A mesa (der).', order: 63, category: 'world', isNew: true }),
  T({ id: 'l0-die-tuer', unitId: 'l0.u7', competencyId: 'l0.world', german: 'Die Tür.', portuguese: 'A porta (die).', order: 64, category: 'world', isNew: true }),
  T({ id: 'l0-das-buch', unitId: 'l0.u7', competencyId: 'l0.world', german: 'Das Buch.', portuguese: 'O livro (das).', order: 65, category: 'world', isNew: true }),
  T({ id: 'l0-ein-apfel', unitId: 'l0.u7', competencyId: 'l0.world', german: 'Ein Apfel.', portuguese: 'Uma maçã (ein).', order: 66, category: 'world', isNew: true }),
  T({ id: 'l0-eine-flasche', unitId: 'l0.u7', competencyId: 'l0.world', german: 'Eine Flasche.', portuguese: 'Uma garrafa (eine).', order: 67, category: 'world', isNew: true }),

  // ——— u8 Primeiras frases (l0.phrases) ———
  T({ id: 'survival-arbeite', unitId: 'l0.u8', competencyId: 'l0.phrases', german: 'Ich arbeite.', portuguese: 'Eu trabalho.', order: 68, category: 'phrases' }),
  T({ id: 'l0-hook-ich-muss', unitId: 'l0.u8', competencyId: 'l0.phrases', german: 'Ich muss...', portuguese: 'Eu preciso / tenho que...', order: 69, category: 'phrases' }),
  T({ id: 'l0-hook-kannst-du', unitId: 'l0.u8', competencyId: 'l0.phrases', german: 'Kannst du...?', portuguese: 'Você pode...?', order: 70, category: 'phrases' }),
  T({ id: 'l0-seq-vorstellen', unitId: 'l0.u8', competencyId: 'l0.phrases', german: 'Ich heiße... Ich komme aus... Ich wohne in...', portuguese: 'Apresentação em sequência.', order: 71, category: 'phrases', isNew: true }),
  T({ id: 'l0-seq-bedarf', unitId: 'l0.u8', competencyId: 'l0.phrases', german: 'Ich möchte Wasser. Ich brauche Hilfe.', portuguese: 'Necessidade em sequência.', order: 72, category: 'phrases', isNew: true }),
  T({ id: 'l0-seq-arbeitstag', unitId: 'l0.u8', competencyId: 'l0.phrases', german: 'Ich arbeite. Heute. Später.', portuguese: 'Dia de trabalho em sequência.', order: 73, category: 'phrases', isNew: true }),
];

const BY_ID = new Map(L0_CURRICULUM.map((t) => [t.id, t]));

/** IDs criados nesta refatoração (mínimos para competências ausentes). */
export const L0_NEW_TARGET_IDS: readonly string[] = L0_CURRICULUM.filter((t) => t.isNew).map((t) => t.id);

export const L0_UNIT_IDS_IN_ORDER = [
  'l0.u1',
  'l0.u2',
  'l0.u3',
  'l0.u4',
  'l0.u5',
  'l0.u6',
  'l0.u7',
  'l0.u8',
] as const;

export const L0_UNIT_TITLES: Record<(typeof L0_UNIT_IDS_IN_ORDER)[number], string> = {
  'l0.u1': 'Primeiros contatos',
  'l0.u2': 'Eu sou',
  'l0.u3': 'Pessoas importantes',
  'l0.u4': 'Números, tempo e informações',
  'l0.u5': 'Entender e pedir ajuda',
  'l0.u6': 'Necessidades básicas',
  'l0.u7': 'O mundo ao meu redor',
  'l0.u8': 'Minhas primeiras frases',
};

/** Frases por competência — fonte única para getModules('L0'). */
export const L0_COMPETENCY_PHRASE_IDS: Record<string, readonly string[]> = {
  'l0.greet': L0_CURRICULUM.filter((t) => t.competencyId === 'l0.greet').map((t) => t.id),
  'l0.introduce': L0_CURRICULUM.filter((t) => t.competencyId === 'l0.introduce').map((t) => t.id),
  'l0.people': L0_CURRICULUM.filter((t) => t.competencyId === 'l0.people').map((t) => t.id),
  'l0.basics': L0_CURRICULUM.filter((t) => t.competencyId === 'l0.basics').map((t) => t.id),
  'l0.help': L0_CURRICULUM.filter((t) => t.competencyId === 'l0.help').map((t) => t.id),
  'l0.needs': L0_CURRICULUM.filter((t) => t.competencyId === 'l0.needs').map((t) => t.id),
  'l0.world': L0_CURRICULUM.filter((t) => t.competencyId === 'l0.world').map((t) => t.id),
  'l0.phrases': L0_CURRICULUM.filter((t) => t.competencyId === 'l0.phrases').map((t) => t.id),
};

export function getL0Targets(): L0Target[] {
  return L0_CURRICULUM;
}

export function getL0TargetById(id: string): L0Target | undefined {
  return BY_ID.get(id);
}

export function getL0TargetsByUnit(unitId: string): L0Target[] {
  return L0_CURRICULUM.filter((t) => t.unitId === unitId);
}

export function getL0TargetsByCompetency(competencyId: string): L0Target[] {
  return L0_CURRICULUM.filter((t) => t.competencyId === competencyId);
}

export function isL0TargetId(id: string | null | undefined): boolean {
  return !!id && BY_ID.has(id);
}

export function phraseIdsForL0Competency(competencyId: string): string[] {
  return [...(L0_COMPETENCY_PHRASE_IDS[competencyId] ?? [])];
}

export function l0CurriculumSeedPhrases(): Phrase[] {
  return L0_CURRICULUM.map((t) => ({
    id: t.id,
    german: t.german,
    portuguese: t.portuguese,
    category: t.category,
    chunk: t.german.replace(/[.…]+$/, '').trim(),
    mastery: 'recognize' as const,
    reviewStage: 'new' as const,
    nextReview: null,
    timesReviewed: 0,
    timesCorrect: 0,
    timesIncorrect: 0,
    isAutomatic: false,
    contexts: [t.competencyId, t.unitId],
  }));
}

export function mergeL0CurriculumPhrases(existing: Phrase[]): Phrase[] {
  const byId = new Map(existing.map((p) => [p.id, p]));
  for (const seed of l0CurriculumSeedPhrases()) {
    const cur = byId.get(seed.id);
    if (!cur) {
      byId.set(seed.id, seed);
      continue;
    }
    byId.set(seed.id, {
      ...cur,
      german: seed.german,
      portuguese: seed.portuguese,
      category: seed.category,
      contexts: seed.contexts,
    });
  }
  return [...byId.values()];
}

/** Cobertura curricular dos 8 módulos (não só contagem). */
export function isL0CurriculumComplete(learning: UserLearningProfile): boolean {
  return L0_CURRICULUM.every((t) => isZeroLanguagePhraseAccepted(learning.phrases[t.id]));
}

export function l0CompetencyMasteryFromLearning(
  competencyId: string,
  learning: UserLearningProfile,
): number {
  const ids = L0_COMPETENCY_PHRASE_IDS[competencyId] ?? [];
  if (ids.length === 0) return 0;
  let accepted = 0;
  let produced = 0;
  let confidenceSum = 0;
  let seen = 0;
  for (const id of ids) {
    const c = learning.phrases[id] as PhraseConfidence | undefined;
    if (!c) continue;
    seen += 1;
    if (isZeroLanguagePhraseAccepted(c)) accepted += 1;
    if ((c.timesProduced ?? 0) > 0 || (c.timesCorrect ?? 0) > 0) produced += 1;
    confidenceSum += c.confidence ?? 0;
  }
  const acceptRate = accepted / ids.length;
  const produceRate = produced / ids.length;
  const avgConf = confidenceSum / Math.max(1, seen);
  return Math.round(Math.min(100, acceptRate * 55 + produceRate * 25 + (avgConf / 100) * 20));
}

export function assertL0CurriculumIntegrity(): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  const seen = new Set<string>();
  for (const u of L0_UNIT_IDS_IN_ORDER) {
    const targets = getL0TargetsByUnit(u);
    if (targets.length === 0) errors.push(`${u}: sem targets`);
  }
  for (const t of L0_CURRICULUM) {
    if (seen.has(t.id)) errors.push(`duplicado ${t.id}`);
    seen.add(t.id);
    if (!t.id.startsWith('l0-') && t.id !== 'survival-arbeite') {
      errors.push(`id inválido ${t.id}`);
    }
    if (!L0_UNIT_IDS_IN_ORDER.includes(t.unitId as (typeof L0_UNIT_IDS_IN_ORDER)[number])) {
      errors.push(`${t.id}: unit desconhecida ${t.unitId}`);
    }
  }
  if (L0_UNIT_IDS_IN_ORDER.length !== 8) errors.push('esperado 8 unidades');
  return { ok: errors.length === 0, errors };
}

/** Avaliação de saída situacional L0 — produção, não memória isolada. */
export const L0_EXIT_SCENARIOS: readonly L0ExitScenario[] = [
  {
    id: 'l0-exit-meet',
    titlePt: 'Conhecer alguém',
    situationPt: 'Apresentar-se e cumprimentar.',
    competencyIds: ['l0.greet', 'l0.introduce'],
    evidenceTargetIds: ['l0-hallo', 'l0-ich-heisse', 'l0-ich-komme', 'l0-wie-heisst-du'],
  },
  {
    id: 'l0-exit-work',
    titlePt: 'No trabalho',
    situationPt: 'Dar informação básica sobre si e o trabalho.',
    competencyIds: ['l0.introduce', 'l0.phrases'],
    evidenceTargetIds: ['survival-arbeite', 'l0-ich-wohne', 'l0-seq-arbeitstag'],
  },
  {
    id: 'l0-exit-problem',
    titlePt: 'Problema',
    situationPt: 'Pedir ajuda e sinalizar que não entendeu.',
    competencyIds: ['l0.help'],
    evidenceTargetIds: ['l0-hilfe', 'l0-verstehe-nicht', 'l0-noch-einmal'],
  },
  {
    id: 'l0-exit-need',
    titlePt: 'Necessidade',
    situationPt: 'Pedir algo de que precisa.',
    competencyIds: ['l0.needs'],
    evidenceTargetIds: ['l0-hook-ich-moechte', 'l0-hook-ich-brauche', 'l0-wasser-bitte'],
  },
  {
    id: 'l0-exit-short-talk',
    titlePt: 'Conversa curta',
    situationPt: 'Perguntas e respostas básicas + pessoas próximas.',
    competencyIds: ['l0.people', 'l0.basics', 'l0.world'],
    evidenceTargetIds: ['l0-das-ist-meine-mutter', 'l0-heute', 'l0-ja', 'l0-seq-vorstellen'],
  },
];

/**
 * Gate situacional: cada cenário exige evidência aceita em ≥50% dos targets
 * e pelo menos 1 produção (timesProduced/Correct) no cenário.
 */
export function gradeL0ExitAssessment(learning: UserLearningProfile): {
  passed: boolean;
  score: number;
  reason: string;
  scenariosPassed: number;
  scenarioResults: Array<{ id: string; passed: boolean; coverage: number }>;
} {
  const scenarioResults = L0_EXIT_SCENARIOS.map((sc) => {
    const ids = sc.evidenceTargetIds;
    let accepted = 0;
    let produced = 0;
    for (const id of ids) {
      const c = learning.phrases[id];
      if (isZeroLanguagePhraseAccepted(c)) accepted += 1;
      if ((c?.timesProduced ?? 0) > 0 || (c?.timesCorrect ?? 0) > 0) produced += 1;
    }
    const coverage = accepted / Math.max(1, ids.length);
    const passed = coverage >= 0.5 && produced >= 1;
    return { id: sc.id, passed, coverage };
  });
  const scenariosPassed = scenarioResults.filter((r) => r.passed).length;
  const score = Math.round((scenariosPassed / L0_EXIT_SCENARIOS.length) * 100);
  const passed = scenariosPassed >= 4; // 4 de 5 situações
  return {
    passed,
    score,
    reason: passed
      ? 'Produção situacional L0 suficiente para avançar.'
      : 'Ainda faltam situações comunicativas L0.',
    scenariosPassed,
    scenarioResults,
  };
}
