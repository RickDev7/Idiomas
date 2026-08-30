/* BottleneckDetector — maior limitação atual (impacto × frequência × progresso). Fase 9. */

import type { UserLearningProfile } from '@/services/learning/ConfidenceService';
import type { LearningEvent } from '@/services/learning/EventStore';

export type BottleneckType =
  | 'listening'
  | 'speaking'
  | 'vocabulary'
  | 'grammar'
  | 'pronunciation'
  | 'response_speed'
  | 'retention'
  | 'confidence'
  | null;

export interface Bottleneck {
  type: Exclude<BottleneckType, null>;
  description: string;
  recommendation: string;
  score: number;
  /** 0–1 — confiança da inferência. */
  confidence: number;
  reason: string;
}

export interface BottleneckReport {
  primary: Bottleneck | null;
  secondary: Bottleneck | null;
}

/** Impacto relativo na comunicação (não só a menor nota). */
const IMPACT: Record<Exclude<BottleneckType, null>, number> = {
  speaking: 1.35,
  listening: 1.25,
  confidence: 1.2,
  retention: 1.1,
  response_speed: 1.05,
  pronunciation: 0.95,
  vocabulary: 1.0,
  grammar: 1.05,
};

const COPY: Record<
  Exclude<BottleneckType, null>,
  { description: string; recommendation: string }
> = {
  listening: {
    description: 'Você fala, mas precisa treinar mais o ouvido.',
    recommendation: 'Aumentar exercícios de escuta.',
  },
  speaking: {
    description: 'Você entende, mas precisa falar mais.',
    recommendation: 'Aumentar produção oral guiada.',
  },
  retention: {
    description: 'Você aprende, mas esquece rápido.',
    recommendation: 'Revisões espaçadas mais frequentes.',
  },
  pronunciation: {
    description: 'Sua pronúncia precisa de prática.',
    recommendation: 'Repetir com áudio.',
  },
  response_speed: {
    description: 'Você demora para responder.',
    recommendation: 'Exercícios de resposta rápida.',
  },
  confidence: {
    description: 'Você está pedindo muita ajuda. Vamos reforçar o que você já viu.',
    recommendation: 'Revisar frases conhecidas antes de avançar.',
  },
  vocabulary: {
    description: 'Falta vocabulário para se expressar.',
    recommendation: 'Introduzir e reutilizar palavras em contexto.',
  },
  grammar: {
    description: 'Padrões gramaticais ainda travam a produção.',
    recommendation: 'Praticar as estruturas que mais falham, em conversa.',
  },
};

function skillScores(profile: UserLearningProfile): { type: Exclude<BottleneckType, null>; value: number }[] {
  const known = profile.knownPhrases ?? [];
  const weak = profile.weakPhrases ?? [];
  const weakRatio =
    known.length + weak.length > 0
      ? weak.length / Math.max(1, known.length + weak.length)
      : 0;
  const vocabScore = Math.round(100 - weakRatio * 80);

  const grammarHint =
    (profile.recurringMistakes?.length ?? 0) >= 2
      ? Math.max(25, 70 - profile.recurringMistakes.length * 8)
      : 70;

  return [
    { type: 'listening', value: profile.listeningScore },
    { type: 'speaking', value: profile.speakingScore },
    { type: 'retention', value: profile.retentionScore },
    { type: 'pronunciation', value: profile.pronunciationScore },
    { type: 'response_speed', value: profile.responseSpeedScore },
    { type: 'vocabulary', value: vocabScore },
    { type: 'grammar', value: grammarHint },
  ];
}

function pressureFromEvents(
  type: Exclude<BottleneckType, null>,
  events: LearningEvent[],
): number {
  const recent = events.slice(-60);
  if (!recent.length) return 0;
  if (type === 'speaking') {
    const fails = recent.filter((e) => e.type === 'PHRASE_FAILED').length;
    const help = recent.filter((e) => e.type === 'HELP_REQUESTED' || e.type === 'SCAFFOLD_USED').length;
    const indep = recent.filter((e) => e.type === 'INDEPENDENT_RESPONSE').length;
    return Math.min(40, fails * 4 + help * 2 - indep * 2);
  }
  if (type === 'listening') {
    const fail = recent.filter((e) => e.type === 'LISTENING_FAILURE').length;
    const ok = recent.filter((e) => e.type === 'LISTENING_SUCCESS' || e.type === 'PHRASE_HEARD').length;
    return Math.min(40, fail * 8 - ok);
  }
  if (type === 'retention') {
    const recallFail = recent.filter((e) => e.type === 'REVIEW_FAILED').length;
    return Math.min(35, recallFail * 7);
  }
  if (type === 'response_speed') {
    const slow = recent.filter((e) => (e.responseTimeMs ?? 0) > 7000).length;
    return Math.min(35, slow * 5);
  }
  return 0;
}

function toBottleneck(
  type: Exclude<BottleneckType, null>,
  score: number,
  reason: string,
  confidence: number,
): Bottleneck {
  const info = COPY[type];
  return {
    type,
    description: info.description,
    recommendation: info.recommendation,
    score,
    confidence: Math.max(0, Math.min(1, confidence)),
    reason,
  };
}

export function detectBottlenecks(
  profile: UserLearningProfile,
  events: LearningEvent[] = [],
): BottleneckReport {
  const helpCount = Object.values(profile.phrases ?? {}).filter((p) => p.needsHelp).length;
  if (helpCount > 3) {
    const primary = toBottleneck(
      'confidence',
      40,
      `needsHelp em ${helpCount} frases`,
      0.75,
    );
    const scores = skillScores(profile)
      .map((s) => ({
        ...s,
        weighted: (100 - s.value) * IMPACT[s.type] + pressureFromEvents(s.type, events),
      }))
      .sort((a, b) => b.weighted - a.weighted);
    const secType = scores.find((s) => s.type !== 'confidence' && s.value < 70)?.type;
    const secondary = secType
      ? toBottleneck(
          secType,
          scores.find((s) => s.type === secType)!.value,
          `secundário após confiança`,
          0.55,
        )
      : null;
    return { primary, secondary };
  }

  const ranked = skillScores(profile)
    .map((s) => {
      const pressure = pressureFromEvents(s.type, events);
      const gap = 100 - s.value;
      const weighted = gap * IMPACT[s.type] + pressure;
      return { ...s, pressure, weighted };
    })
    .sort((a, b) => b.weighted - a.weighted);

  const top = ranked[0];
  if (!top || top.value >= 70 && top.pressure < 8) {
    return { primary: null, secondary: null };
  }

  const conf = clamp01(0.45 + (70 - Math.min(70, top.value)) / 80 + Math.min(0.25, top.pressure / 80));
  const primary = toBottleneck(
    top.type,
    top.value,
    `${top.type} score=${top.value}; impacto=${IMPACT[top.type]}; pressão_eventos=${top.pressure.toFixed(0)}`,
    conf,
  );

  const second = ranked[1];
  let secondary: Bottleneck | null = null;
  if (second && second.value < 72 && second.weighted > top.weighted * 0.55) {
    secondary = toBottleneck(
      second.type,
      second.value,
      `secundário: score=${second.value}; weighted=${second.weighted.toFixed(0)}`,
      clamp01(conf - 0.15),
    );
  }

  // Speeding as secondary when speaking primary and latency high
  if (primary.type === 'speaking' && profile.responseSpeedScore < 55 && !secondary) {
    secondary = toBottleneck(
      'response_speed',
      profile.responseSpeedScore,
      'latência alta junto de speaking fraco',
      0.6,
    );
  }

  return { primary, secondary };
}

/** Compatível com Fases anteriores — retorna só o primary. */
export function detectBottleneck(
  profile: UserLearningProfile,
  events: LearningEvent[] = [],
): Bottleneck | null {
  return detectBottlenecks(profile, events).primary;
}

export function immersionAdjustment(profile: UserLearningProfile, recentCorrectRate: number): number {
  const base = profile.immersionLevel;
  if (recentCorrectRate < 0.4) return Math.max(40, base - 20);
  if (recentCorrectRate > 0.85) return Math.min(100, base + 10);
  return base;
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}
