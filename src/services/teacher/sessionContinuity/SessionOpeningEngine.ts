/* Escolhe a abertura da sessão. Prioridade pedagógica, não variedade vazia. */
import type { OpeningContext, SessionKind, SessionOpening, OpeningStrategy } from './types';

const RECENT_WINDOW = 3;

interface Candidate {
  german: string;
  portuguese: string;
  expected?: string;
  hint?: string;
}

/**
 * Currículo executável A1–C2 (não L0).
 * Usado para impedir que first_intro L0 substitua o target planejado.
 */
export function isActiveCurriculumTargetId(id: string | undefined | null): boolean {
  return typeof id === 'string' && /^(a1|a2|b1|b2|c1|c2)-/i.test(id.trim());
}

function timeGreeting(): Candidate {
  const h = new Date().getHours();
  if (h < 12) return { german: 'Guten Morgen!', portuguese: 'Bom dia!' };
  if (h < 18) return { german: 'Guten Tag!', portuguese: 'Boa tarde!' };
  return { german: 'Guten Abend!', portuguese: 'Boa noite!' };
}

function pickUnused(pool: Candidate[], recent: string[]): Candidate {
  const unused = pool.filter((c) => !recent.includes(c.german));
  const list = unused.length ? unused : pool;
  return list[0];
}

function phraseStem(s: string): string {
  return s.replace(/[.…!?]/g, '').trim();
}

/** Saudações genéricas — NÃO são objetivo pedagógico para CONTINUATION. */
export function isScriptedGreeting(s: string): boolean {
  const t = s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[''`´]/g, '')
    .replace(/[!?.…,;:"""«»]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!t) return false;
  if (/^(guten morgen|guten tag|guten abend|gute nacht)(\s|$)/.test(t)) return true;
  if (/^hallo(\s|$)/.test(t) && !/heiss|wohn|arbeit|heisse/.test(t)) return true;
  if (/wie geht(s| es dir| es ihnen)?(\s|$)/.test(t)) return true;
  if (/^(alles klar|alles gut)(\s|$)/.test(t)) return true;
  // "Guten Morgen! Wie geht's?" / "Hallo! Wie geht es dir?"
  if (/guten morgen/.test(t) && /wie geht/.test(t)) return true;
  if (/hallo/.test(t) && /wie geht/.test(t)) return true;
  return false;
}

export function getSessionOpening(ctx: OpeningContext): SessionOpening {
  const recent = ctx.recentOpenings.slice(-RECENT_WINDOW);
  const hours = ctx.hoursSinceLast;
  const last = ctx.lastSession;
  const incomplete = ctx.incomplete;
  const weak = ctx.weakPhrases[0];
  const known = ctx.knownPhrases[0];
  const planned = ctx.plannedCurricularTarget;
  const topic =
    planned?.topic ||
    incomplete?.topic ||
    last?.topic ||
    (ctx.goal === 'work' ? 'work' : 'daily');
  const mistake = last?.mistakes[0] || incomplete?.mistakes[0]?.userSaid;

  const make = (
    kind: SessionKind,
    strategy: OpeningStrategy,
    cand: Candidate,
    reason: string,
    pedagogicalRepeat = false,
  ): SessionOpening => ({
    kind,
    strategy,
    german: cand.german,
    portuguese: cand.portuguese,
    expected: cand.expected,
    hint: cand.hint,
    topic,
    reason,
    pedagogicalRepeat,
  });

  // 0. Currículo ativo + target planejado (A1–B2) — vence first_intro e continuidade genérica
  if (planned && isActiveCurriculumTargetId(planned.id) && planned.german.trim()) {
    const de = planned.german.trim();
    return make(
      'NEW_CONTENT_SESSION',
      'planned_curricular',
      {
        german: de,
        portuguese: (planned.portuguese || de).trim(),
        expected: de.toLowerCase().split(/\s+/).slice(0, 3).join(' '),
        hint: de.split(/\s+/)[0] + '...',
      },
      planned.reason || `planned_curricular:${planned.id}`,
    );
  }

  // 1. Primeira sessão de verdade
  if (ctx.sessionCount === 0 && !last) {
    if (ctx.zeroLanguageMode) {
      return make(
        'FIRST_SESSION',
        'first_intro',
        {
          german: 'Guten Morgen.',
          portuguese: 'Bom dia.',
          expected: 'guten morgen',
          hint: 'Guten Morgen.',
        },
        'L0: primeira microaula — Guten Morgen.',
      );
    }
    return make(
      'FIRST_SESSION',
      'first_intro',
      {
        german: 'Hallo! Ich bin dein Deutsch Coach. Wie heißt du?',
        portuguese: 'Olá! Eu sou seu professor de alemão. Como você se chama?',
        expected: 'ich heiße',
        hint: 'Ich heiße...',
      },
      'Primeira sessão: introdução.',
    );
  }

  // 1b. Começou uma vez mas não gravou resumo completo — não repetir a intro
  if (ctx.sessionCount === 0 && last) {
    if (ctx.zeroLanguageMode) {
      const weak = ctx.weakPhrases[0] || last.phrasesLearned[0] || 'Guten Morgen.';
      return make(
        'CONTINUATION_SESSION',
        'continue_topic',
        {
          german: phraseStem(weak),
          portuguese: 'Vamos continuar de onde paramos.',
          expected: phraseStem(weak).toLowerCase().split(/\s+/).slice(0, 3).join(' '),
          hint: phraseStem(weak).split(' ')[0] + '...',
        },
        'L0: continuidade sem reiniciar.',
      );
    }
    const phrase = last.phrasesLearned[0] || known || 'Ich heiße...';
    return make(
      'RETURNING_SESSION',
      'welcome_back',
      pickUnused([
        { german: `Schön, dich wiederzusehen. Erinnerst du dich an "${phraseStem(phrase)}"?`, portuguese: 'Que bom te ver de novo. Você se lembra?', expected: phrase.toLowerCase().split(/\s+/).slice(0, 3).join(' '), hint: phrase.split(' ')[0] + '...' },
        { german: 'Hallo wieder. Wo wohnst du?', portuguese: 'Olá de novo. Onde você mora?', expected: 'ich wohne', hint: 'Ich wohne...' },
      ], recent),
      'Retorno após primeira abertura (sem repetir o roteiro).',
    );
  }

  if (!last) {
    if (ctx.zeroLanguageMode) {
      return make(
        'FIRST_SESSION',
        'first_intro',
        { german: 'Guten Morgen.', portuguese: 'Bom dia.', expected: 'guten morgen', hint: 'Guten Morgen.' },
        'L0 sem memória: microaula Guten Morgen.',
      );
    }
    return make(
      'FIRST_SESSION',
      'first_intro',
      {
        german: 'Hallo! Ich bin dein Deutsch Coach. Wie heißt du?',
        portuguese: 'Olá! Eu sou seu professor de alemão. Como você se chama?',
        expected: 'ich heiße',
        hint: 'Ich heiße...',
      },
      'Sem memória: introdução.',
    );
  }

  // L0 returning: priorizar unfinished/weak com PT continuity
  if (ctx.zeroLanguageMode) {
    const unfinished = incomplete?.unfinishedContent[0] || last.unfinishedContent[0] || last.unfinishedGoal;
    const focus = (unfinished && !isScriptedGreeting(unfinished) ? unfinished : null)
      || weak
      || last.phrasesLearned[0]
      || 'Guten Morgen.';
    return make(
      unfinished ? 'CONTINUATION_SESSION' : 'RETURNING_SESSION',
      unfinished ? 'continue_topic' : 'review_weak',
      {
        german: phraseStem(focus),
        portuguese: 'Vamos continuar de onde paramos.',
        expected: phraseStem(focus).toLowerCase().split(/\s+/).slice(0, 3).join(' '),
        hint: phraseStem(focus).split(' ')[0] + '...',
      },
      'L0: retomar conteúdo pendente/fraco — não reiniciar.',
      true,
    );
  }

  // 2. Conteúdo inacabado — continuar (pedagógico, não necessariamente literal)
  const unfinished = incomplete?.unfinishedContent[0] || last.unfinishedContent[0] || last.unfinishedGoal;
  if (unfinished && !isScriptedGreeting(unfinished)) {
    const stem = phraseStem(unfinished);
    const recentReturn = hours !== null && hours < 0.5;
    return make(
      'CONTINUATION_SESSION',
      'continue_topic',
      recentReturn
        ? { german: stem, portuguese: 'Vamos continuar de onde paramos.', expected: stem.toLowerCase().split(/\s+/).slice(0, 3).join(' ') }
        : { german: `Erinnerst du dich? ${stem}`, portuguese: 'Você se lembra? Continuamos de onde paramos.', expected: stem.toLowerCase().split(/\s+/).slice(0, 3).join(' ') },
      'Sessão anterior incompleta: retomar o objetivo.',
    );
  }

  // 3. Pausa longa (≥ 3 dias) — recuperação
  if (hours !== null && hours >= 72) {
    const phrase = last.phrasesLearned[0] || known || 'Ich heiße...';
    return make(
      'REVIEW_SESSION',
      'recall_old',
      pickUnused([
        { german: 'Was weißt du noch von letztem Mal?', portuguese: 'O que você ainda lembra da última vez?' },
        { german: `Erinnerst du dich an "${phraseStem(phrase)}"?`, portuguese: 'Você se lembra desta frase?', expected: phrase.toLowerCase().split(/\s+/).slice(0, 3).join(' '), hint: phrase.split(' ')[0] + '...' },
        { german: 'Lass uns das Wichtige wiederholen.', portuguese: 'Vamos repetir o importante.' },
      ], recent),
      'Pausa longa: recuperação.',
    );
  }

  // 4. Erro recente — só depois da primeira sessão, se ainda não acabamos de abrir
  if (mistake && ctx.sessionCount >= 1) {
    const cand: Candidate = mistake.toLowerCase().includes('arbeit')
      ? { german: 'Was machst du heute?', portuguese: 'O que você faz hoje?', expected: 'ich arbeite', hint: 'Ich arbeite...' }
      : {
          german: `Versuch noch einmal. Sag richtig: ${phraseStem(last.phrasesLearned[0] || known || 'Ich arbeite heute.')}.`,
          portuguese: 'Tente de novo, desta vez certo.',
          expected: (last.phrasesLearned[0] || known || 'ich').toLowerCase().split(/\s+/).slice(0, 3).join(' '),
          hint: last.phrasesLearned[0]?.split(' ')[0] + '...',
        };
    if (!recent.includes(cand.german)) {
      return make('REVIEW_SESSION', 'review_mistake', cand, 'Último erro: recuperar a forma correta.', true);
    }
  }

  // 5. Frase fraca — revisão contextual (não na primeira volta se já temos abertura de retorno)
  if (weak && ctx.sessionCount >= 2 && (hours === null || hours >= 0.2)) {
    const cand: Candidate = {
      german: `Erinnerst du dich? ${weak}`,
      portuguese: 'Você se lembra?',
      expected: weak.toLowerCase().split(/\s+/).slice(0, 3).join(' '),
      hint: weak.split(' ')[0] + '...',
    };
    if (!recent.includes(cand.german)) {
      return make('REVIEW_SESSION', 'review_weak', cand, 'Frase fraca: recuperação ativa.', true);
    }
  }

  // 6. Segunda sessão
  if (ctx.sessionCount === 1) {
    const phrase = last.phrasesLearned[0] || 'Ich heiße...';
    return make(
      'RETURNING_SESSION',
      'welcome_back',
      pickUnused([
        { german: `Schön, dich wiederzusehen. Erinnerst du dich an "${phraseStem(phrase)}"?`, portuguese: 'Que bom te ver de novo. Você se lembra?', expected: phrase.toLowerCase().split(/\s+/).slice(0, 3).join(' '), hint: phrase.split(' ')[0] + '...' },
        { german: 'Hallo wieder. Wo wohnst du?', portuguese: 'Olá de novo. Onde você mora?', expected: 'ich wohne', hint: 'Ich wohne...' },
      ], recent),
      'Segunda sessão: retomar sem repetir o roteiro inicial.',
    );
  }

  // 7. Terceira sessão
  if (ctx.sessionCount === 2) {
    return make(
      'RETURNING_SESSION',
      'recall_old',
      pickUnused([
        { german: 'Was weißt du noch von gestern?', portuguese: 'O que você ainda sabe de ontem?' },
        { german: 'Wo wohnst du?', portuguese: 'Onde você mora?', expected: 'ich wohne', hint: 'Ich wohne...' },
      ], recent),
      'Terceira sessão: recuperar ontem.',
    );
  }

  // 8. Continuar o tema se a última sessão foi recente
  const lastQ = last.lastQuestion && !isScriptedGreeting(last.lastQuestion) ? last.lastQuestion : '';
  if (hours !== null && hours < 24 && (lastQ || last.phrasesLearned[0] || last.topic)) {
    const follow = lastQ || last.phrasesLearned[0];
    const pool: Candidate[] = [
      last.topic === 'work'
        ? { german: 'Gestern haben wir über deine Arbeit gesprochen. Was machst du heute?', portuguese: 'Ontem falamos do seu trabalho. O que você faz hoje?', expected: 'ich', hint: 'Ich...' }
        : { german: follow ? `Gestern haben wir das geübt. ${follow}` : 'Was machst du heute?', portuguese: 'Ontem praticamos isso.', expected: (follow || 'ich').toLowerCase().split(/\s+/).slice(0, 3).join(' ') },
      { german: 'Lass uns weitermachen.', portuguese: 'Vamos continuar.' },
      { german: 'Und? Was machst du heute?', portuguese: 'E então? O que você faz hoje?', expected: 'ich', hint: 'Ich...' },
      { german: 'Was hast du gestern gemacht?', portuguese: 'O que você fez ontem?', expected: 'ich habe', hint: 'Ich habe...' },
    ];
    return make('CONTINUATION_SESSION', 'continue_topic', pickUnused(pool, recent), 'Continuar o contexto da última sessão.');
  }

  // 8. Sessões posteriores — avançar / natural, sem saudação obrigatória
  if (ctx.sessionCount >= 4) {
    const workLead = ctx.profession || last.topic === 'work';
    const pool: Candidate[] = [
      workLead
        ? { german: 'Du hast mir erzählt, dass du arbeitest. Was machst du bei der Arbeit?', portuguese: 'Você me disse que trabalha. O que você faz no trabalho?', expected: 'ich', hint: 'Ich...' }
        : { german: 'Erzähl mir von deinem Tag.', portuguese: 'Me conte do seu dia.' },
      { german: 'Was hast du gestern gemacht?', portuguese: 'O que você fez ontem?', expected: 'ich habe', hint: 'Ich habe...' },
      { german: 'Was machst du heute?', portuguese: 'O que você faz hoje?', expected: 'ich', hint: 'Ich...' },
      { german: 'Bereit?', portuguese: 'Pronto?' },
    ];
    return make('FREE_CONVERSATION', 'natural', pickUnused(pool, recent), 'Sessão avançada: conversa natural.');
  }

  const greet = timeGreeting();
  const advancePool: Candidate[] = [
    { german: 'Was machst du heute?', portuguese: 'O que você faz hoje?', expected: 'ich', hint: 'Ich...' },
    { german: 'Was hast du gestern gemacht?', portuguese: 'O que você fez ontem?', expected: 'ich habe', hint: 'Ich habe...' },
    { german: 'Was möchtest du heute üben?', portuguese: 'O que você quer treinar hoje?' },
    { german: 'Lass uns anfangen.', portuguese: 'Vamos começar.' },
    { german: `${greet.german} Wie war dein Tag?`, portuguese: `${greet.portuguese} Como foi o seu dia?` },
  ];
  return make('NEW_CONTENT_SESSION', 'advance', pickUnused(advancePool, recent), 'Avançar com abertura nova.');
}
