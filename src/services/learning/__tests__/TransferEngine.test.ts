import {
  buildTransferVariants,
  decideTransfer,
  isSuccessfulTransfer,
  pickTransferForItem,
  recordTransferAttempt,
  restoreTransferHistory,
  shouldTransfer,
  shouldTransferItem,
} from '@/services/learning/TransferEngine';
import {
  contextsForPhrase,
  generateVariations,
  pickNextVariation,
} from '@/services/learning/VariationEngine';
import { toLearningItemState } from '@/services/learning/RealUseEngine';
import type { Phrase } from '@/types';
import type { PhraseConfidence } from '@/services/learning/ConfidenceService';
import { assert } from './assert';

const PAUSE: Phrase = {
  id: 'pause-1',
  german: 'Ich brauche eine Pause.',
  portuguese: 'Preciso de uma pausa.',
  category: 'work',
  mastery: 'speak',
  reviewStage: 'learning',
  nextReview: null,
  timesReviewed: 2,
  timesCorrect: 2,
  timesIncorrect: 0,
  isAutomatic: false,
  contexts: [],
};

const confReady: PhraseConfidence = {
  phraseId: 'pause-1',
  state: 'answeredAlone',
  confidence: 72,
  recognition: 70,
  listening: 70,
  speaking: 70,
  production: 70,
  speed: 60,
  contextTransfer: 20,
  timesSeen: 6,
  timesProduced: 4,
  timesCorrect: 4,
  lastSeen: new Date().toISOString(),
  lastProduced: new Date().toISOString(),
  avgResponseMs: 3500,
  needsHelp: false,
};

export function testVariationEngine() {
  const all = generateVariations(PAUSE);
  assert(all.length >= 3, 'gera várias variações');

  const axes = new Set(all.map((v) => v.axis));
  assert(axes.has('tempo') || axes.has('contexto') || axes.has('situação'), 'cobre eixos principais');
  assert(axes.has('pergunta') || axes.has('pessoa'), 'varia pessoa/pergunta');
  assert(axes.has('negação') || axes.has('objeto'), 'varia negação/objeto');

  // Um eixo por variação
  for (const v of all) {
    assert(typeof v.axis === 'string', 'cada item tem um eixo');
    assert(v.rolePlay.length > 0, 'tem role-play');
    assert(v.communicativeNeed.length > 0, 'tem necessidade comunicativa');
    assert(v.situationPrompt.length > 0, 'tem prompt situacional');
  }

  // Target: Ich brauche eine Pause — ≥3 contextos diferentes
  const contexts = contextsForPhrase(PAUSE, 3);
  assert(contexts.length >= 3, 'pelo menos 3 contextos para Ich brauche eine Pause');
  const needs = new Set(contexts.map((c) => c.communicativeNeed));
  assert(needs.size >= 3, '3 necessidades comunicativas distintas');

  const first = pickNextVariation(PAUSE, { transferCount: 0 });
  const second = pickNextVariation(PAUSE, { transferCount: 1, usedAxes: first ? [first.axis] : [] });
  assert(first !== null, 'pickNextVariation retorna algo');
  assert(second !== null, 'próximo eixo disponível');
  if (first && second) {
    assert(first.axis !== second.axis, 'eixos diferentes em sequência (um por vez)');
  }

  const workA1 = generateVariations(
    { id: 'w', german: 'Ich arbeite heute.', portuguese: 'Eu trabalho hoje.' },
    { userLevel: 'little' },
  );
  assert(workA1.some((v) => v.german.includes('morgen')), 'A1: hoje → morgen');
  assert(!workA1.some((v) => /weil/i.test(v.german)), 'A1: sem subordinada weil');

  const workB1 = generateVariations(
    { id: 'w', german: 'Ich arbeite heute.', portuguese: 'Eu trabalho hoje.' },
    { selfReportedLevel: 'intermediate' },
  );
  assert(workB1.some((v) => /weil/i.test(v.german)), 'B1: pode usar weil');
}

export function testTransferEngine() {
  if (typeof globalThis.localStorage === 'undefined') {
    const store: Record<string, string> = {};
    (globalThis as unknown as { localStorage: Storage }).localStorage = {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => { store[k] = String(v); },
      removeItem: (k: string) => { delete store[k]; },
      clear: () => { Object.keys(store).forEach((key) => delete store[key]); },
      key: () => null,
      length: 0,
    };
  }
  const phrase: Phrase = {
    id: 'p1',
    german: 'Ich arbeite heute.',
    portuguese: 'Eu trabalho hoje.',
    category: 'work',
    mastery: 'recognize',
    reviewStage: 'learning',
    nextReview: null,
    timesReviewed: 0,
    timesCorrect: 0,
    timesIncorrect: 0,
    isAutomatic: false,
    contexts: [],
  };
  const variants = buildTransferVariants(phrase);
  assert(variants.length > 0, 'gera variantes');
  const timeVariant = variants.find((v) => v.kind === 'time');
  assert(timeVariant !== undefined, 'gera variante de tempo');
  assert(
    timeVariant!.german.includes('morgen') || timeVariant!.german.includes('Montag') || timeVariant!.german.includes('gestern'),
    'troca hoje por morgen/Montag/gestern',
  );

  const questionVariant = variants.find((v) => v.kind === 'question');
  assert(questionVariant !== undefined, 'gera variante de pergunta');
  assert(questionVariant!.german.includes('?'), 'pergunta termina com ?');

  const negVariant = variants.find((v) => v.kind === 'negation');
  assert(negVariant !== undefined, 'gera variante de negação');
  assert(negVariant!.german.includes('nicht') || /kein/i.test(negVariant!.german), 'negação usa nicht/kein');

  assert(
    shouldTransfer(confReady),
    'deve transferir quando domina mas transferência baixa',
  );

  // Ligado ao LearningItemState
  const item = toLearningItemState(confReady);
  assert(item.itemId === 'pause-1', 'LearningItemState do target');
  assert(shouldTransferItem(item), 'shouldTransferItem com independência');
  const picked = pickTransferForItem(PAUSE, item);
  assert(picked !== null, 'pickTransferForItem retorna variação');
  assert(Boolean(picked!.rolePlay || picked!.situationPrompt), 'transferência em contexto real');

  // Sequência tipo exemplo: hoje → morgen → Montag (eixos de tempo quando aplicável)
  const work = buildTransferVariants(phrase);
  const times = work.filter((v) => v.kind === 'time');
  assert(times.length >= 1, 'Ich arbeite heute → variação de tempo');

  assert(
    decideTransfer({
      producedNow: true,
      recentError: false,
      hasProducedBefore: true,
      sessionTransfers: 0,
      turnsSinceLastTransfer: 99,
      pendingTransfer: false,
      hasVariant: true,
    }) === 'TRANSFER',
    'produção pronta → TRANSFER',
  );
  assert(
    decideTransfer({
      producedNow: true,
      recentError: true,
      hasProducedBefore: true,
      sessionTransfers: 0,
      turnsSinceLastTransfer: 99,
      pendingTransfer: false,
      hasVariant: true,
    }) === 'CONTINUE',
    'após erro → não transfer',
  );

  const morgen = times[0];
  assert(isSuccessfulTransfer('Ich arbeite morgen.', 'Ich arbeite heute.', morgen), 'morgen conta como transfer');
  assert(!isSuccessfulTransfer('Ich arbeite heute.', 'Ich arbeite heute.', morgen), 'repetir fonte não é transfer');
  assert(!isSuccessfulTransfer('Ich wohne in Cuxhaven.', 'Ich arbeite heute.', morgen), 'não relacionado');

  localStorage.removeItem('deutsch-turbo:transfer-history:v1');
  recordTransferAttempt({
    phraseId: 'p1',
    sourcePhrase: 'Ich arbeite heute.',
    variant: morgen,
    success: true,
    helpLevel: 0,
    sessionId: 's1',
  });
  const restored = restoreTransferHistory('p1');
  assert(!!restored && restored.successfulTransfers === 1, 'persist transferHistory');
  assert(restored!.lastTransfer?.variant === morgen.german, 'lastTransfer');
}
