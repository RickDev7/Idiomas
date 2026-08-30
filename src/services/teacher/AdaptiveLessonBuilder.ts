import type { Phrase, UserProfile } from '@/types';
import type { UserLearningProfile, PhraseConfidence } from '@/services/learning/ConfidenceService';
import type { Bottleneck } from '@/services/learning/BottleneckDetector';
import type { PlannedActivity } from '@/services/learning/NextBestActivityEngine';
import type { Interaction, Lesson } from '@/services/teacher/LessonEngine';
import type { SessionOpening } from '@/services/teacher/sessionContinuity';
import { buildTransferVariants, pickTransferFromConfidence, shouldTransfer } from '@/services/learning/TransferEngine';
import { toLearningItemState } from '@/services/learning/RealUseEngine';
import { buildActiveRecall, pickActiveRecallTarget } from '@/services/learning/ActiveRecallEngine';
import { nextBestLearningAction } from '@/services/learning/AutomationScoreEngine';

const SURVIVAL_PHRASES: { id: string; german: string; portuguese: string; expected: string; hint: string }[] = [
  { id: 'survival-hilfe', german: 'Ich brauche Hilfe.', portuguese: 'Preciso de ajuda.', expected: 'ich brauche hilfe', hint: 'Ich brauche...' },
  { id: 'survival-verstehe', german: 'Ich verstehe nicht.', portuguese: 'Não entendo.', expected: 'ich verstehe nicht', hint: 'Ich verstehe...' },
  { id: 'survival-kostet', german: 'Wie viel kostet das?', portuguese: 'Quanto custa isso?', expected: 'wie viel kostet', hint: 'Wie viel...' },
  { id: 'survival-toilette', german: 'Wo ist die Toilette?', portuguese: 'Onde fica o banheiro?', expected: 'wo ist', hint: 'Wo ist...' },
  { id: 'survival-wasser', german: 'Ich möchte Wasser.', portuguese: 'Quero água.', expected: 'ich möchte', hint: 'Ich möchte...' },
  { id: 'survival-wiederholen', german: 'Können Sie das wiederholen?', portuguese: 'Pode repetir?', expected: 'wiederholen', hint: 'Können Sie...' },
  { id: 'survival-muede', german: 'Ich bin müde.', portuguese: 'Estou cansado.', expected: 'ich bin müde', hint: 'Ich bin...' },
  { id: 'survival-hunger', german: 'Ich habe Hunger.', portuguese: 'Estou com fome.', expected: 'ich habe hunger', hint: 'Ich habe...' },
  { id: 'survival-machen', german: 'Was soll ich machen?', portuguese: 'O que devo fazer?', expected: 'was soll ich', hint: 'Was soll ich...' },
  { id: 'survival-arbeite', german: 'Ich arbeite heute.', portuguese: 'Eu trabalho hoje.', expected: 'ich arbeite', hint: 'Ich arbeite...' },
  { id: 'survival-gut', german: 'Mir geht es gut.', portuguese: 'Estou bem.', expected: 'mir geht es gut', hint: 'Mir geht es gut.' },
  { id: 'survival-heisse', german: 'Ich heiße...', portuguese: 'Me chamo...', expected: 'ich heiße', hint: 'Ich heiße...' },
];

function supportFor(c: PhraseConfidence | undefined): 0 | 1 | 2 | 3 {
  if (!c) return 3;
  if (c.confidence >= 85) return 0;
  if (c.confidence >= 60) return 1;
  if (c.confidence >= 30) return 2;
  return 3;
}

export function buildAdaptiveLesson(
  user: UserProfile,
  learning: UserLearningProfile | null,
  activities: PlannedActivity[],
  allPhrases: Phrase[],
  bottleneck: Bottleneck | null,
  opening?: SessionOpening | null,
): Lesson {
  const interactions: Interaction[] = [];
  let idc = 0;
  const nid = () => `a${idc++}`;

  const phraseById = (id: string) => allPhrases.find((p) => p.id === id);

  const teachPhrase = (
    p: { id?: string; german: string; portuguese: string; expected: string; hint: string },
    support: 0 | 1 | 2 | 3,
  ) => {
    const phraseId = p.id;
    interactions.push({
      id: nid(), type: 'teach', german: p.german, portuguese: p.portuguese, support,
      phraseId, pedagogicalKind: 'introduce',
    });
    interactions.push({
      id: nid(), type: 'repeat', german: p.german, expected: p.expected,
      support: Math.max(0, support - 1) as 0 | 1 | 2,
      phraseId, pedagogicalKind: 'guided',
    });
    interactions.push({
      id: nid(), type: 'open', german: 'Jetzt du!', portuguese: 'Agora você!',
      expected: p.expected, hint: p.hint,
      support: Math.max(0, support - 2) as 0 | 1, praise: 'Sehr gut!',
      phraseId, pedagogicalKind: support >= 2 ? 'guided' : 'independent',
    });
  };

  const pushOpening = () => {
    if (!opening) return;
    interactions.push({
      id: nid(),
      type: opening.kind === 'FIRST_SESSION' ? 'greet' : 'open',
      german: opening.german,
      portuguese: opening.portuguese,
      expected: opening.expected,
      hint: opening.hint,
      support: opening.kind === 'FIRST_SESSION' ? 3 : 1,
      praise: 'Sehr gut!',
      pedagogicalKind: opening.kind === 'FIRST_SESSION' ? 'introduce' : 'independent',
    });
  };

  const pushTransfer = (p: Phrase, conf: PhraseConfidence | undefined) => {
    if (!conf || !shouldTransfer(conf)) return;
    const item = toLearningItemState(conf);
    const v = pickTransferFromConfidence(p, conf) || buildTransferVariants(p, conf)[0];
    if (!v) return;
    // Conversa situacional — não "exercício 1, 2, 3"
    const situation = v.situationPrompt
      || (v.kind === 'question' ? 'Frag mich zurück.' : 'Sag es in dieser Situation.');
    interactions.push({
      id: nid(),
      type: 'conversation',
      german: [v.rolePlay, situation].filter(Boolean).join(' ') || situation,
      portuguese: v.communicativeNeed || `Transferência (eixo ${v.kind}) · item ${item.itemId}`,
      expected: v.expected,
      hint: v.hint,
      support: Math.min(2, item.helpLevel || 1) as 0 | 1 | 2 | 3,
      praise: 'Genau! Neue Situation!',
      phraseId: p.id,
      pedagogicalKind: 'transfer',
    });
  };

  const pushRecall = () => {
    if (!learning) return;
    const target = pickActiveRecallTarget(learning, allPhrases);
    if (!target) return;
    const conf = learning.phrases[target.id];
    const recall = buildActiveRecall(target, conf);
    interactions.push({
      id: nid(),
      type: 'open',
      german: recall.prompt,
      portuguese: recall.difficulty === 'hard' ? undefined : recall.portuguese,
      expected: recall.expected,
      hint: target.german.split(' ')[0] + '...',
      support: recall.difficulty === 'easy' ? 2 : recall.difficulty === 'medium' ? 1 : 0,
      praise: 'Richtig! Du erinnerst dich.',
      phraseId: target.id,
      pedagogicalKind: 'recall',
    });
  };

  if (!learning || Object.keys(learning.phrases).length === 0) {
    pushOpening();
    if (!opening || opening.kind === 'FIRST_SESSION') {
      teachPhrase(SURVIVAL_PHRASES[11], 3);
      teachPhrase(SURVIVAL_PHRASES[10], 3);
      teachPhrase(SURVIVAL_PHRASES[9], 3);
      interactions.push({
        id: nid(), type: 'conversation',
        german: 'Stell dich vor: Sag alles zusammen.',
        portuguese: 'Apresente-se: diga tudo junto.',
        expected: 'ich heiße',
        hint: 'Ich heiße... Mir geht es gut. Ich arbeite heute.',
        support: 1, praise: 'Herzlichen Glückwunsch!',
        pedagogicalKind: 'spontaneous',
      });
    } else {
      teachPhrase(SURVIVAL_PHRASES[9], 2);
    }
    interactions.push({ id: nid(), type: 'done', german: 'Du hast deine erste Konversation!', portuguese: 'Você fez sua primeira conversa!', support: 0 });
    return { id: 'adaptive-first', title: 'Primeira conversa', level: user.level, interactions };
  }

  pushOpening();
  pushRecall();

  for (const activity of activities) {
    if (activity.kind === 'warmup') {
      for (const pid of activity.phraseIds.slice(0, 2)) {
        const p = phraseById(pid);
        if (p) {
          teachPhrase(
            { id: p.id, german: p.german, portuguese: p.portuguese, expected: p.german.toLowerCase().split(/\s+/).slice(0, 3).join(' '), hint: p.german.split(' ')[0] + '...' },
            supportFor(learning.phrases[pid]),
          );
        }
      }
    } else if (activity.kind === 'review') {
      for (const pid of activity.phraseIds.slice(0, 3)) {
        const p = phraseById(pid);
        if (!p) continue;
        const conf = learning.phrases[pid];
        const action = nextBestLearningAction(conf);
        if (action === 'transfer') {
          pushTransfer(p, conf);
        } else {
          const recall = buildActiveRecall(p, conf);
          interactions.push({
            id: nid(),
            type: 'open',
            german: recall.prompt,
            portuguese: supportFor(conf) >= 2 ? p.portuguese : undefined,
            expected: recall.expected,
            hint: p.german.split(' ')[0] + '...',
            support: supportFor(conf),
            praise: 'Richtig!',
            phraseId: p.id,
            pedagogicalKind: 'recall',
          });
        }
      }
    } else if (activity.kind === 'newContent') {
      for (const pid of activity.phraseIds.slice(0, 2)) {
        const p = phraseById(pid);
        if (p) {
          teachPhrase(
            { id: p.id, german: p.german, portuguese: p.portuguese, expected: p.german.toLowerCase().split(/\s+/).slice(0, 3).join(' '), hint: p.german.split(' ')[0] + '...' },
            3,
          );
        }
      }
    } else if (activity.kind === 'speaking' || activity.kind === 'listening') {
      for (const pid of activity.phraseIds.slice(0, 3)) {
        const p = phraseById(pid);
        if (!p) continue;
        const conf = learning.phrases[pid];
        const support = supportFor(conf);
        interactions.push({
          id: nid(),
          type: activity.kind === 'listening' ? 'listen' : 'repeat',
          german: p.german,
          portuguese: support >= 2 ? p.portuguese : undefined,
          expected: p.german.toLowerCase().split(/\s+/).slice(0, 3).join(' '),
          support,
          phraseId: p.id,
          pedagogicalKind: activity.kind === 'listening' ? 'introduce' : 'guided',
        });
        if (activity.kind === 'speaking') pushTransfer(p, conf);
      }
    } else if (activity.kind === 'rapidResponse') {
      for (const pid of activity.phraseIds.slice(0, 2)) {
        const p = phraseById(pid);
        if (p) {
          interactions.push({
            id: nid(), type: 'open', german: `Schnell! ${p.german}`, portuguese: 'Responda rápido!',
            expected: p.german.toLowerCase().split(/\s+/).slice(0, 3).join(' '),
            hint: p.german.split(' ')[0] + '...', support: 1, praise: 'Schnell!',
            phraseId: p.id, pedagogicalKind: 'automation',
          });
        }
      }
    } else if (activity.kind === 'conversation') {
      const ids = activity.phraseIds.slice(0, 3);
      const first = phraseById(ids[0]);
      if (first) {
        interactions.push({
          id: nid(), type: 'conversation',
          german: `Lass uns sprechen. Was brauchst du? / Was machst du heute?`,
          portuguese: 'Vamos conversar — use o que sabe.',
          expected: first.german.toLowerCase().split(/\s+/).slice(0, 3).join(' '),
          hint: first.german.split(' ')[0] + '...',
          support: 1, praise: 'Sehr gut!',
          phraseId: first.id, pedagogicalKind: 'spontaneous',
        });
      }
    }
  }

  // Delayed reuse: re-ask one strong phrase later as micro automation check
  const reusable = Object.values(learning.phrases)
    .filter((c) => c.timesCorrect >= 1 && c.confidence >= 40)
    .sort((a, b) => b.confidence - a.confidence)[0];
  if (reusable) {
    const p = phraseById(reusable.phraseId);
    if (p) {
      interactions.push({
        id: nid(),
        type: 'open',
        german: 'Noch einmal — ohne Hilfe. Sag es.',
        portuguese: 'Mais uma vez, sem ajuda.',
        expected: p.german.toLowerCase().split(/\s+/).slice(0, 3).join(' '),
        hint: undefined,
        support: 0,
        praise: 'Automatisch!',
        phraseId: p.id,
        pedagogicalKind: 'automation',
      });
    }
  }

  if (bottleneck?.type === 'confidence' || bottleneck?.type === 'response_speed') {
    const easy = SURVIVAL_PHRASES[0];
    interactions.splice(Math.max(0, interactions.length - 2), 0, {
      id: nid(), type: 'repeat', german: easy.german, expected: easy.expected, support: 2,
      phraseId: easy.id, pedagogicalKind: 'guided',
    });
  }

  interactions.push({ id: nid(), type: 'done', german: 'Sehr gut! Bis morgen.', portuguese: 'Muito bem! Até amanhã.', support: 0 });

  return { id: 'adaptive', title: 'Treino de hoje', level: user.level, interactions };
}

export { SURVIVAL_PHRASES };
