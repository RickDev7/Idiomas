/**
 * Políticas por modo de sessão — Gemini não deve misturar.
 */
import type { ModePolicy, ProfessorSessionMode } from './Types';

const IMMERSION_SUPPORT = [
  '1. warten',
  '2. auf Deutsch wiederholen',
  '3. langsamer sprechen',
  '4. auf Deutsch umformulieren',
  '5. Hinweis auf Deutsch',
  '6. Strukturanfang geben',
  '7. Portugiesisch nur als letzte Ausnahme',
];

export const MODE_POLICIES: Record<ProfessorSessionMode, ModePolicy> = {
  LESSON: {
    mode: 'LESSON',
    goal: 'ENSINAR — compreensão → modelo → produção guiada',
    allowPortuguese: true,
    allowTeaching: true,
    allowCorrectionLoop: true,
    teacherTalkRatioMax: 0.55,
    knownContentMinRatio: 0.6,
    newContentMaxRatio: 0.4,
    supportOrder: ['explicar significado', 'modelo', 'substituição', 'produção com ajuda', 'produção independente'],
    forbidden: ['pular para conversa livre sem modelo no L0', 'inventar mastery'],
    focus: 'introduzir e praticar com suporte',
  },
  REVIEW: {
    mode: 'REVIEW',
    goal: 'RECUPERAR E FORTALECER — active recall',
    allowPortuguese: true,
    allowTeaching: false,
    allowCorrectionLoop: true,
    teacherTalkRatioMax: 0.45,
    knownContentMinRatio: 1,
    newContentMaxRatio: 0,
    supportOrder: ['pedir recall', 'pista mínima', 'modelo só se falhar', 'nova tentativa'],
    forbidden: ['introduzir conteúdo novo', 'aula longa'],
    focus: 'recuperação espaçada do já estudado',
  },
  SIMULATOR: {
    mode: 'SIMULATOR',
    goal: 'FAZER O ALUNO USAR O ALEMÃO — conversar e automatizar',
    allowPortuguese: false,
    allowTeaching: false,
    allowCorrectionLoop: false,
    teacherTalkRatioMax: 0.35,
    knownContentMinRatio: 0.8,
    newContentMaxRatio: 0.2,
    supportOrder: IMMERSION_SUPPORT,
    forbidden: [
      'Portugiesisch',
      'Übersetzung',
      'Unterrichtssprache',
      'Antwort zeigen',
      'lange Erklärungen',
      'dieselbe Frage endlos',
    ],
    focus: 'perguntas curtas → aluno fala → reação curta → nova oportunidade',
  },
  MINI_PROVA: {
    mode: 'MINI_PROVA',
    goal: 'DESCOBRIR O QUE O ALUNO CONSEGUE FAZER SOZINHO',
    allowPortuguese: false,
    allowTeaching: false,
    allowCorrectionLoop: false,
    teacherTalkRatioMax: 0.3,
    knownContentMinRatio: 1,
    newContentMaxRatio: 0,
    supportOrder: IMMERSION_SUPPORT.slice(0, 3),
    forbidden: [
      'Portugiesisch',
      'Übersetzung',
      'Antwort zeigen',
      'nach Fehler unterrichten',
      'dieselbe Frage wiederholen',
    ],
    focus: 'avaliar compreensão, produção, variação, transferência, autonomia',
  },
  CONVERSATION: {
    mode: 'CONVERSATION',
    goal: 'PRODUÇÃO LIVRE controlada pelo Learning State',
    allowPortuguese: false,
    allowTeaching: false,
    allowCorrectionLoop: false,
    teacherTalkRatioMax: 0.4,
    knownContentMinRatio: 0.85,
    newContentMaxRatio: 0.15,
    supportOrder: IMMERSION_SUPPORT,
    forbidden: ['inventar vocabulário não estudado em massa', 'monopolizar a conversa'],
    focus: 'variação e transferência com material conhecido',
  },
};

export function getModePolicy(mode: ProfessorSessionMode): ModePolicy {
  return MODE_POLICIES[mode];
}

export function resolveSessionMode(opts: {
  simulator?: boolean;
  miniProva?: boolean;
  review?: boolean;
  conversation?: boolean;
}): ProfessorSessionMode {
  if (opts.miniProva) return 'MINI_PROVA';
  if (opts.simulator) return 'SIMULATOR';
  if (opts.review) return 'REVIEW';
  if (opts.conversation) return 'CONVERSATION';
  return 'LESSON';
}
