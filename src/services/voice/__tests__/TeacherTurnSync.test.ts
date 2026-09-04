import {
  extractTeacherGermanForUi,
  pedagogicalMatchesTeacherUtterance,
  resolveUiTeacherTurn,
  shouldEmitPedagogicalNudge,
  shouldUpdateTargetImmediately,
} from '@/services/voice/TeacherTurnSync';
import type { OrchestratorDecision } from '@/services/voice/TeacherTurnSync';

function decision(partial: Partial<OrchestratorDecision>): OrchestratorDecision {
  return {
    flow: 'continueConversation',
    action: 'practice',
    mode: 'GUIDED_CONVERSATION',
    reason: 'test',
    grammar: null,
    targetItem: null,
    geminiNudge: null,
    eventsRecorded: [],
    ...partial,
  } as OrchestratorDecision;
}

async function run() {
  let passed = 0;
  let failed = 0;
  const assert = (name: string, cond: boolean) => {
    if (cond) { passed++; console.log('  ✓', name); }
    else { failed++; console.log('  ✗', name); }
  };

  // CASO EXATO: pedagogical ≠ teacher utterance → UI = teacher
  {
    const pedagogical = 'Was möchtest du?';
    const teacher = 'Was möchtest du essen?';
    const ui = resolveUiTeacherTurn({
      teacherUtterance: teacher,
      pedagogicalTarget: pedagogical,
      turnId: 't-1',
      sessionGeneration: 1,
      final: true,
    });
    assert('UI = teacher utterance completo', ui === 'Was möchtest du essen?');
    assert('UI ≠ pedagogical target', ui !== pedagogical);
    assert('mismatch detectável', !pedagogicalMatchesTeacherUtterance(pedagogical, teacher));
  }

  // Target Ich arbeite / Teacher Wo arbeitest du?
  {
    const ui = resolveUiTeacherTurn({
      teacherUtterance: 'Wo arbeitest du?',
      pedagogicalTarget: 'Ich arbeite.',
      turnId: 't-2',
      sessionGeneration: 1,
      final: true,
    });
    assert('pergunta real do professor na UI', ui === 'Wo arbeitest du?');
    assert('não mostra chunk alvo', ui !== 'Ich arbeite');
  }

  // Target Ich möchte / Teacher Was möchtest du essen?
  {
    const ui = resolveUiTeacherTurn({
      teacherUtterance: 'Was möchtest du essen?',
      pedagogicalTarget: 'Ich möchte...',
      turnId: 't-3',
      sessionGeneration: 1,
      final: true,
    });
    assert('não mostra Ich möchte', ui !== 'Ich möchte...');
    assert('mostra pergunta real', ui === 'Was möchtest du essen?');
  }

  // A) teacher fala X → UI mostra X
  {
    const x = 'Guten Tag! Wie geht es dir?';
    assert('teacher X → UI X', resolveUiTeacherTurn({
      teacherUtterance: x,
      turnId: 't-4',
      sessionGeneration: 1,
    }) === extractTeacherGermanForUi(x));
  }

  // B) pedagogical Y, teacher X → UI X
  {
    const ui = resolveUiTeacherTurn({
      teacherUtterance: 'Was möchtest du essen?',
      pedagogicalTarget: 'Was möchtest du?',
      turnId: 't-5',
      sessionGeneration: 1,
    });
    assert('pedagogical Y teacher X → UI X', ui === 'Was möchtest du essen?');
  }

  // C) pequena variação do Gemini ainda é o utterance real
  {
    const ui = resolveUiTeacherTurn({
      teacherUtterance: 'Was möchtest du heute essen?',
      pedagogicalTarget: 'Was möchtest du essen?',
      turnId: 't-6',
      sessionGeneration: 1,
    });
    assert('variação natural preservada', ui === 'Was möchtest du heute essen?');
  }

  // D) nunca antecipar target pedagógico na UI
  {
    assert(
      'shouldUpdateTargetImmediately sempre false',
      !shouldUpdateTargetImmediately(decision({ flow: 'startMicroPractice', targetItem: 'Hallo' })),
    );
  }

  // nudge duplicado bloqueado em live
  {
    const d = decision({
      geminiNudge: '[INSTRUÇÃO INTERNA] Fale X',
      flow: 'continueConversation',
    });
    const emit = shouldEmitPedagogicalNudge(d, {
      liveVoiceActive: true,
      naturalTeacherResponseExpected: true,
      assistantSpeaking: true,
      teacherReceiving: false,
      playerPlaying: false,
    });
    assert('live + resposta natural → nudge bloqueado', !emit);
  }

  // intervene → override permitido
  {
    const emit = shouldEmitPedagogicalNudge(
      decision({ geminiNudge: 'Corrija', flow: 'intervenePedagogically' }),
      {
        liveVoiceActive: true,
        naturalTeacherResponseExpected: true,
        assistantSpeaking: true,
        teacherReceiving: true,
        playerPlaying: true,
      },
    );
    assert('intervenePedagogically → nudge permitido', emit);
  }

  {
    const emit = shouldEmitPedagogicalNudge(
      decision({
        flow: 'continueConversation',
        reason: 'review_session_complete',
        geminiNudge: '[INSTRUÇÃO INTERNA — não leia isto em voz alta]\nRevisão concluída.',
      }),
      {
        liveVoiceActive: true,
        naturalTeacherResponseExpected: true,
        assistantSpeaking: false,
        teacherReceiving: false,
        playerPlaying: false,
      },
    );
    assert('review_session_complete não envia nudge (conclusão visível)', !emit);
  }

  console.log(`\n${passed} passaram, ${failed} falharam.`);
  if (failed > 0) process.exit(1);
}

run().catch((e) => { console.error(e); process.exit(1); });
