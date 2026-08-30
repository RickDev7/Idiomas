/* VariationEngine — Fase 4
   Um eixo por vez: tempo | pessoa | contexto | pergunta | objeto | situação | negação.
   Gera variações para uso em conversa (role-play), não lista de exercícios. */

export type VariationAxis =
  | 'tempo'
  | 'pessoa'
  | 'contexto'
  | 'pergunta'
  | 'objeto'
  | 'situação'
  | 'negação';

export interface PhraseLike {
  id: string;
  german: string;
  portuguese: string;
}

export interface Variation {
  axis: VariationAxis;
  baseId: string;
  baseGerman: string;
  german: string;
  portuguese: string;
  expected: string;
  hint: string;
  /** Cena curta em alemão para o professor (conversa, não drill). */
  rolePlay: string;
  /** Necessidade comunicativa em PT. */
  communicativeNeed: string;
  /** Prompt situacional DE para elicitar a variação. */
  situationPrompt: string;
}

export const VARIATION_AXIS_ORDER: VariationAxis[] = [
  'tempo',
  'pessoa',
  'contexto',
  'pergunta',
  'objeto',
  'situação',
  'negação',
];

/** Eixos da spec (EN) → eixos internos. */
export const AXIS_EN: Record<string, VariationAxis> = {
  TIME: 'tempo',
  PERSON: 'pessoa',
  QUESTION: 'pergunta',
  CONTEXT: 'contexto',
  OBJECT: 'objeto',
  SITUATION: 'situação',
  NEGATION: 'negação',
};

export type CefrBand = 'a0' | 'a1' | 'a2' | 'b1' | 'b2' | 'c1';

export function cefrBandFromProfile(opts?: {
  level?: string;
  selfReportedLevel?: string;
}): CefrBand {
  const self = (opts?.selfReportedLevel || '').toLowerCase();
  if (self === 'advanced' || self === 'very_advanced') return 'c1';
  if (self === 'intermediate_plus') return 'b2';
  if (self === 'intermediate') return 'b1';
  if (self === 'basic') return 'a2';
  if (self === 'beginner') return 'a1';
  if (self === 'zero') return 'a0';
  const lvl = (opts?.level || '').toLowerCase();
  if (lvl === 'basic') return 'a2';
  if (lvl === 'little') return 'a1';
  if (lvl === 'zero') return 'a0';
  return 'a1';
}

function axesForBand(band: CefrBand): VariationAxis[] {
  if (band === 'a0' || band === 'a1') return ['tempo', 'contexto', 'pessoa', 'pergunta'];
  if (band === 'a2') return ['tempo', 'contexto', 'pessoa', 'pergunta', 'objeto', 'situação'];
  return VARIATION_AXIS_ORDER;
}

const TIME_SWAPS: { from: RegExp; to: string; pt: string }[] = [
  { from: /\bheute\b/i, to: 'morgen', pt: 'amanhã' },
  { from: /\bheute\b/i, to: 'am Montag', pt: 'na segunda' },
  { from: /\bheute\b/i, to: 'gestern', pt: 'ontem' },
  { from: /\bmorgen\b/i, to: 'heute', pt: 'hoje' },
  { from: /\bmorgen\b/i, to: 'am Montag', pt: 'na segunda' },
  { from: /\bjetzt\b/i, to: 'später', pt: 'mais tarde' },
];

const OBJECT_SWAPS: { from: RegExp; to: string; pt: string }[] = [
  { from: /\beine Pause\b/i, to: 'Hilfe', pt: 'ajuda' },
  { from: /\beine Pause\b/i, to: 'Wasser', pt: 'água' },
  { from: /\bHilfe\b/i, to: 'eine Pause', pt: 'uma pausa' },
  { from: /\bWasser\b/i, to: 'Hilfe', pt: 'ajuda' },
];

type Scene = { id: string; rolePlay: string; need: string; prompt: string };

function contextScenesFor(german: string, profession?: string): Scene[] {
  const lower = german.toLowerCase();
  const job = (profession || '').toLowerCase();
  const cleaning = /reinig|putz|fenster|limpez|clean|haushalt/.test(job);

  if (/pause|brauche/.test(lower)) {
    const scenes: Scene[] = [
      {
        id: 'work-shift',
        rolePlay: 'Ihr arbeitet seit Stunden.',
        need: 'Pedir pausa no trabalho',
        prompt: 'Was brauchst du nach zwei Stunden Arbeit?',
      },
      {
        id: 'home',
        rolePlay: 'Nach dem Putzen zu Hause.',
        need: 'Pedir pausa em casa',
        prompt: 'Du hast schon viel zu Hause gemacht. Was brauchst du?',
      },
      {
        id: 'drive',
        rolePlay: 'Lange Autofahrt.',
        need: 'Pedir pausa depois de dirigir',
        prompt: 'Die Fahrt war lang. Was brauchst du?',
      },
    ];
    if (cleaning) {
      scenes.unshift({
        id: 'windows',
        rolePlay: 'Viele Fenster geputzt.',
        need: 'Pedir pausa após limpar janelas',
        prompt: 'Du hast schon viele Fenster gereinigt. Was brauchst du?',
      });
    }
    return scenes;
  }

  if (/arbeit/.test(lower)) {
    return [
      {
        id: 'office',
        rolePlay: 'Du bist im Büro.',
        need: 'Falar do trabalho hoje',
        prompt: 'Was machst du heute bei der Arbeit?',
      },
      {
        id: 'home-office',
        rolePlay: 'Heute arbeitest du zu Hause.',
        need: 'Falar do trabalho em casa',
        prompt: 'Und zu Hause — arbeitest du heute auch?',
      },
      {
        id: 'weekend',
        rolePlay: 'Am Wochenende.',
        need: 'Falar do trabalho no fim de semana',
        prompt: 'Arbeitest du am Wochenende?',
      },
    ];
  }

  return [
    {
      id: 'daily',
      rolePlay: 'Alltag, gleiche Idee.',
      need: 'Usar a estrutura no dia a dia',
      prompt: 'Sag das noch einmal — in deinem Alltag.',
    },
    {
      id: 'other',
      rolePlay: 'Eine andere Situation, gleiche Struktur.',
      need: 'Usar a estrutura noutro contexto',
      prompt: 'Und in einer anderen Situation?',
    },
    {
      id: 'later',
      rolePlay: 'Später am Tag.',
      need: 'Usar a estrutura mais tarde',
      prompt: 'Und später?',
    },
  ];
}

function situationScenesFor(german: string): Scene[] {
  const lower = german.toLowerCase();
  if (/pause|brauche/.test(lower)) {
    return [
      {
        id: 'lager',
        rolePlay: 'Du bist im Lager und fühlst dich erschöpft.',
        need: 'Pedir pausa no depósito',
        prompt: 'Du arbeitest im Lager. Was sagst du dem Chef?',
      },
      {
        id: 'sport',
        rolePlay: 'Nach dem Sport.',
        need: 'Pedir pausa após exercício',
        prompt: 'Nach dem Training — was brauchst du?',
      },
      {
        id: 'fahrt',
        rolePlay: 'Lange Autofahrt.',
        need: 'Pedir pausa na viagem',
        prompt: 'Die Fahrt ist lang. Was sagst du?',
      },
    ];
  }
  if (/arbeit/.test(lower)) {
    return [
      {
        id: 'chef',
        rolePlay: 'Dein Chef fragt nach deinem Tag.',
        need: 'Responder ao chefe',
        prompt: 'Dein Chef fragt: Was machst du heute?',
      },
      {
        id: 'kollege',
        rolePlay: 'Ein Kollege fragt.',
        need: 'Responder ao colega',
        prompt: 'Ein Kollege: Und du, arbeitest du heute?',
      },
    ];
  }
  return [
    {
      id: 'generic',
      rolePlay: 'Gleiche Struktur, neue Szene.',
      need: 'Usar a estrutura numa cena nova',
      prompt: 'Sag es in dieser Situation.',
    },
  ];
}

function clampWords(text: string, n = 3): string {
  return text.toLowerCase().replace(/[.?!,]/g, '').split(/\s+/).filter(Boolean).slice(0, n).join(' ');
}

function conjugateBrauchen(person: 'du' | 'er' | 'wir'): string {
  if (person === 'du') return 'brauchst';
  if (person === 'er') return 'braucht';
  return 'brauchen';
}

function conjugateGeneric(verb: string, person: 'du' | 'er' | 'wir'): string {
  const base = verb.toLowerCase().replace(/\.$/, '');
  if (base === 'brauche' || base === 'brauchen') return conjugateBrauchen(person);
  const stem = base.endsWith('en') ? base.slice(0, -2) : base.endsWith('e') ? base.slice(0, -1) : base;
  if (person === 'du') return `${stem}st`;
  if (person === 'er') return `${stem}t`;
  return `${stem}en`;
}

function replaceFirst(hay: string, re: RegExp, to: string): string {
  return hay.replace(re, to);
}

function pushUnique(out: Variation[], v: Variation) {
  // Contexto/situação podem repetir a frase-alvo; distinguir pela necessidade comunicativa
  if (
    out.some(
      (x) =>
        x.axis === v.axis &&
        x.german === v.german &&
        x.communicativeNeed === v.communicativeNeed,
    )
  ) {
    return;
  }
  out.push(v);
}

export interface VariationOpts {
  maxPerAxis?: number;
  axes?: VariationAxis[];
  userLevel?: string;
  selfReportedLevel?: string;
  profession?: string;
}

/** Gera variações — no máximo um eixo alterado por item. */
export function generateVariations(
  phrase: PhraseLike,
  opts?: VariationOpts,
): Variation[] {
  const band = cefrBandFromProfile(opts);
  const maxPerAxis = opts?.maxPerAxis ?? 2;
  const axes = opts?.axes ?? (
    opts?.userLevel || opts?.selfReportedLevel ? axesForBand(band) : VARIATION_AXIS_ORDER
  );
  const g = phrase.german.trim();
  const pt = phrase.portuguese.trim();
  const lower = g.toLowerCase();
  const out: Variation[] = [];

  const add = (partial: Omit<Variation, 'baseId' | 'baseGerman'>) => {
    pushUnique(out, { ...partial, baseId: phrase.id, baseGerman: g });
  };

  for (const axis of axes) {
    let count = 0;

    if (axis === 'tempo') {
      for (const swap of TIME_SWAPS) {
        if (count >= maxPerAxis) break;
        if (!swap.from.test(g)) continue;
        const german = replaceFirst(g, swap.from, swap.to);
        if (german === g) continue;
        add({
          axis,
          german,
          portuguese: pt.replace(/\bhoje\b/i, swap.pt).replace(/\bamanhã\b/i, swap.pt),
          expected: clampWords(german),
          hint: `${swap.to.charAt(0).toUpperCase()}${swap.to.slice(1)}...`,
          rolePlay: `Gleiche Situation, aber die Zeit ändert sich: ${swap.to}.`,
          communicativeNeed: `Mesma ideia, outro tempo (${swap.pt})`,
          situationPrompt: `Und ${swap.to}?`,
        });
        count++;
      }
      // Frases sem marcador temporal → acrescentar um
      if (count === 0 && !/\b(heute|morgen|gestern|jetzt|später|montag)\b/i.test(lower)) {
        const german = g.replace(/\.$/, ' heute.');
        add({
          axis,
          german,
          portuguese: `${pt.replace(/\.$/, '')} hoje.`,
          expected: clampWords(german),
          hint: 'Heute...',
          rolePlay: 'Sag es für heute.',
          communicativeNeed: 'Especificar que é para hoje',
          situationPrompt: 'Und heute?',
        });
        count++;
        if (count < maxPerAxis) {
          const german2 = g.replace(/\.$/, ' morgen.');
          add({
            axis,
            german: german2,
            portuguese: `${pt.replace(/\.$/, '')} amanhã.`,
            expected: clampWords(german2),
            hint: 'Morgen...',
            rolePlay: 'Jetzt für morgen.',
            communicativeNeed: 'Especificar que é para amanhã',
            situationPrompt: 'Und morgen?',
          });
        }
      }
    }

    if (axis === 'pessoa' && /^ich\b/i.test(g) && !g.includes('?')) {
      const words = g.replace(/\.$/, '').split(/\s+/);
      const verbIdx = words.findIndex((w, i) => i > 0 && /e$|en$|st$|t$/i.test(w));
      if (verbIdx > 0) {
        for (const person of ['du', 'er'] as const) {
          if (count >= maxPerAxis) break;
          const conj = conjugateGeneric(words[verbIdx], person);
          const nw = [...words];
          nw[0] = person === 'du' ? 'Du' : 'Er';
          nw[verbIdx] = conj;
          const german = `${nw.join(' ')}.`;
          add({
            axis,
            german,
            portuguese: pt.replace(/^Eu\b/i, person === 'du' ? 'Você' : 'Ele'),
            expected: clampWords(german),
            hint: `${nw[0]}...`,
            rolePlay: person === 'du'
              ? 'Sprich über deinen Kollegen / über dich als „du“.'
              : 'Sprich über eine andere Person.',
            communicativeNeed: `Mudar a pessoa (${person})`,
            situationPrompt: person === 'du' ? 'Und du?' : 'Und er?',
          });
          count++;
        }
      }
    }

    if (axis === 'contexto') {
      for (const scene of contextScenesFor(g, opts?.profession)) {
        if (count >= maxPerAxis) break;
        add({
          axis,
          german: g,
          portuguese: pt,
          expected: clampWords(g),
          hint: g.split(/\s+/)[0] + '...',
          rolePlay: scene.rolePlay,
          communicativeNeed: scene.need,
          situationPrompt: scene.prompt,
        });
        count++;
      }
    }

    if (axis === 'pergunta' && !g.includes('?')) {
      if (/^ich brauche\b/i.test(g)) {
        const rest = g.replace(/^ich brauche\s+/i, '').replace(/\.$/, '');
        const german = `Brauchst du ${rest}?`;
        add({
          axis,
          german,
          portuguese: pt.replace(/^Eu\b/i, 'Você').replace(/\.$/, '?'),
          expected: clampWords(german),
          hint: 'Brauchst du...',
          rolePlay: 'Frag deinen Kollegen.',
          communicativeNeed: 'Transformar em pergunta ao interlocutor',
          situationPrompt: 'Frag mich: brauchst du das auch?',
        });
        count++;
        if (count < maxPerAxis) {
          const german2 = `Wo brauchst du ${rest.includes('Pause') ? 'die Pause' : 'das'}?`;
          add({
            axis,
            german: german2,
            portuguese: 'Onde você precisa disso?',
            expected: clampWords(german2),
            hint: 'Wo...',
            rolePlay: 'Du willst den Ort wissen.',
            communicativeNeed: 'Perguntar o lugar',
            situationPrompt: 'Frag nach dem Ort.',
          });
        }
      } else if (/^ich\b/i.test(g)) {
        const words = g.replace(/\.$/, '').split(/\s+/);
        const verb = words[1] || 'machst';
        const conj = conjugateGeneric(verb, 'du');
        const rest = words.slice(2).join(' ');
        const german = `${conj.charAt(0).toUpperCase()}${conj.slice(1)} du ${rest}?`.replace(/\s+\?/g, '?');
        add({
          axis,
          german,
          portuguese: 'E você?',
          expected: clampWords(german),
          hint: `${conj.charAt(0).toUpperCase()}${conj.slice(1)} du...`,
          rolePlay: 'Frag zurück.',
          communicativeNeed: 'Virar pergunta de volta',
          situationPrompt: 'Frag mich zurück.',
        });
        count++;
        if (count < maxPerAxis && /arbeit/i.test(g)) {
          add({
            axis,
            german: 'Wo arbeitest du?',
            portuguese: 'Onde você trabalha?',
            expected: 'wo arbeitest du',
            hint: 'Wo...',
            rolePlay: 'Du willst den Ort wissen.',
            communicativeNeed: 'Perguntar o lugar de trabalho',
            situationPrompt: 'Und wo arbeitest du?',
          });
          count++;
        }
      }
    }

    if (axis === 'objeto') {
      for (const swap of OBJECT_SWAPS) {
        if (count >= maxPerAxis) break;
        if (!swap.from.test(g)) continue;
        const german = replaceFirst(g, swap.from, swap.to);
        if (german === g) continue;
        add({
          axis,
          german,
          portuguese: pt.replace(/uma pausa|ajuda|água/i, swap.pt),
          expected: clampWords(german),
          hint: `${swap.to}...`,
          rolePlay: `Gleiche Struktur, anderes Objekt: ${swap.to}.`,
          communicativeNeed: `Trocar o objeto (${swap.pt})`,
          situationPrompt: `Nicht Pause — sag ${swap.to}.`,
        });
        count++;
      }
    }

    if (axis === 'situação') {
      for (const s of situationScenesFor(g)) {
        if (count >= maxPerAxis) break;
        add({
          axis,
          german: g,
          portuguese: pt,
          expected: clampWords(g),
          hint: g.split(/\s+/)[0] + '...',
          rolePlay: s.rolePlay,
          communicativeNeed: s.need,
          situationPrompt: s.prompt,
        });
        count++;
      }
    }

    if (axis === 'negação' && !/\bnicht\b|\bkein/i.test(lower)) {
      let german: string;
      if (/\beine Pause\b/i.test(g)) {
        german = g.replace(/\beine Pause\b/i, 'keine Pause');
      } else if (/\bHilfe\b/i.test(g)) {
        german = g.replace(/\bHilfe\b/i, 'keine Hilfe');
      } else {
        german = g.replace(/\.$/, ' nicht.');
      }
      add({
        axis,
        german,
        portuguese: pt.replace(/\.$/, ' não.'),
        expected: clampWords(german),
        hint: german.toLowerCase().includes('kein') ? 'Keine...' : '...nicht',
        rolePlay: 'Diesmal brauchst du es NICHT.',
        communicativeNeed: 'Negar a necessidade',
        situationPrompt: 'Und wenn nicht? Sag das Gegenteil.',
      });
    }
  }

  // Nível A2+: um eixo de tempo composto (não misturar com pessoa)
  if ((band === 'a2' || band === 'b1' || band === 'b2' || band === 'c1') && /ich arbeite\b/i.test(g)) {
    add({
      axis: 'tempo',
      german: g.replace(/ich arbeite/i, 'Ich habe').replace(/\.$/, ' gearbeitet.'),
      portuguese: pt.replace(/trabalho/i, 'trabalhei'),
      expected: 'ich habe gearbeitet',
      hint: 'Ich habe...',
      rolePlay: 'Gleiche Arbeit, aber in der Vergangenheit.',
      communicativeNeed: 'Passado (Perfekt) — um eixo: tempo',
      situationPrompt: 'Und gestern? Was hast du gemacht?',
    });
  }
  if ((band === 'b1' || band === 'b2' || band === 'c1') && /ich arbeite\b/i.test(g)) {
    add({
      axis: 'situação',
      german: 'Ich arbeite heute, weil ich Geld brauche.',
      portuguese: 'Eu trabalho hoje porque preciso de dinheiro.',
      expected: 'ich arbeite heute weil',
      hint: 'Ich arbeite heute, weil...',
      rolePlay: 'Erkläre kurz warum.',
      communicativeNeed: 'Causa (weil) — um eixo: situação',
      situationPrompt: 'Warum arbeitest du heute?',
    });
  }
  if ((band === 'b2' || band === 'c1') && /arbeit/i.test(g)) {
    const job = opts?.profession ? ` als ${opts.profession}` : ' im Team';
    add({
      axis: 'contexto',
      german: `Ich arbeite heute${job}.`,
      portuguese: 'Eu trabalho hoje no contexto profissional.',
      expected: 'ich arbeite heute',
      hint: 'Ich arbeite...',
      rolePlay: 'Kurzes professionelles Update.',
      communicativeNeed: 'Registro profissional',
      situationPrompt: 'Sag deinem Chef kurz, was du heute machst.',
    });
  }

  return out;
}

/** Próxima variação: um eixo novo, guiado pelo progresso de transferência. */
export function pickNextVariation(
  phrase: PhraseLike,
  opts?: {
    transferCount?: number;
    usedAxes?: VariationAxis[];
    preferAxis?: VariationAxis;
    userLevel?: string;
    selfReportedLevel?: string;
    profession?: string;
  },
): Variation | null {
  const used = new Set(opts?.usedAxes ?? []);
  const all = generateVariations(phrase, {
    maxPerAxis: 2,
    userLevel: opts?.userLevel,
    selfReportedLevel: opts?.selfReportedLevel,
    profession: opts?.profession,
  });

  if (opts?.preferAxis) {
    const preferred = all.find((v) => v.axis === opts.preferAxis && !used.has(v.axis));
    if (preferred) return preferred;
  }

  const startIdx = Math.max(0, opts?.transferCount ?? 0) % VARIATION_AXIS_ORDER.length;
  const ordered = [
    ...VARIATION_AXIS_ORDER.slice(startIdx),
    ...VARIATION_AXIS_ORDER.slice(0, startIdx),
  ];

  for (const axis of ordered) {
    if (used.has(axis)) continue;
    const hit = all.find((v) => v.axis === axis);
    if (hit) return hit;
  }

  return all.find((v) => !used.has(v.axis)) ?? all[0] ?? null;
}

/** Diretiva para Gemini Live — pergunta natural, NÃO entregar a resposta. */
export function variationConversationDirective(v: Variation): string {
  return [
    `TRANSFER — um eixo só: ${v.axis}. NÃO é repetição. NÃO é tradução. NÃO é espontâneo.`,
    `Role-play: ${v.rolePlay}`,
    `Necessidade: ${v.communicativeNeed}`,
    `Faça UMA pergunta natural. Não anuncie exercício. Não liste variantes.`,
    `Pergunta sugerida (pode verbalizar): "${v.situationPrompt}"`,
    `O aluno deve produzir algo como a estrutura-alvo. NÃO diga a resposta completa.`,
    `Se travar, use scaffolding (pista), nunca a frase inteira de imediato.`,
  ].join('\n');
}

export function contextsForPhrase(phrase: PhraseLike, min = 3): Variation[] {
  const ctx = generateVariations(phrase, { axes: ['contexto', 'situação'], maxPerAxis: 3 });
  return ctx.slice(0, Math.max(min, 3));
}
