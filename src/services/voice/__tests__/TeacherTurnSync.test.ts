import {
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

  // Um target → não emitir nudge duplicado se Gemini já responde
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

  // intervenePedagogically → sempre emite (override)
  {
    const d = decision({
      geminiNudge: 'Corrija',
      flow: 'intervenePedagogically',
    });
    const emit = shouldEmitPedagogicalNudge(d, {
      liveVoiceActive: true,
      naturalTeacherResponseExpected: true,
      assistantSpeaking: true,
      teacherReceiving: true,
      playerPlaying: true,
    });
    assert('intervenePedagogically → nudge permitido', emit);
  }

  // abertura → nunca emite nudge
  {
    const d = decision({
      geminiNudge: 'kickoff',
      reason: 'sessão iniciada com plano TeacherEngine',
    });
    const emit = shouldEmitPedagogicalNudge(d, {
      liveVoiceActive: true,
      naturalTeacherResponseExpected: false,
      assistantSpeaking: false,
      teacherReceiving: false,
      playerPlaying: false,
    });
    assert('abertura → nudge bloqueado', !emit);
  }

  // modo texto (sem live voice) → nudge permitido
  {
    const d = decision({
      geminiNudge: '[INSTRUÇÃO INTERNA] próximo passo',
      flow: 'continueConversation',
    });
    const emit = shouldEmitPedagogicalNudge(d, {
      liveVoiceActive: false,
      naturalTeacherResponseExpected: false,
      assistantSpeaking: false,
      teacherReceiving: false,
      playerPlaying: false,
    });
    assert('modo sem live voice → nudge permitido', emit);
  }

  // target imediato só em micro/intervenção
  {
    assert(
      'micro → target imediato',
      shouldUpdateTargetImmediately(decision({ flow: 'startMicroPractice', targetItem: 'Hallo' })),
    );
    assert(
      'continue → target adiado',
      !shouldUpdateTargetImmediately(decision({ flow: 'continueConversation', targetItem: 'Hallo' })),
    );
  }

  // UI target A vs teacher audio B — política: target só após professor (continue adia)
  {
    const uiShowsA = !shouldUpdateTargetImmediately(
      decision({ flow: 'continueConversation', targetItem: 'Ich möchte...' }),
    );
    const uiShowsAOnMicro = shouldUpdateTargetImmediately(
      decision({ flow: 'startMicroPractice', targetItem: 'Ich möchte...' }),
    );
    assert('UI target A antes do professor (continue) → adiado', uiShowsA);
    assert('UI target A em micro → imediato', uiShowsAOnMicro);
  }

  console.log(`\n${passed} passaram, ${failed} falharam.`);
  if (failed > 0) process.exit(1);
}

run().catch((e) => { console.error(e); process.exit(1); });
