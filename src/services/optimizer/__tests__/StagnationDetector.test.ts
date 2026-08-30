import { detectStagnation, recentActivity } from '@/services/optimizer/StagnationDetector';
import { recoveryStrategy } from '@/services/optimizer/RecoveryStrategyEngine';
import type { ProgressSummary } from '@/services/learning/ProgressEngine';
import { assert } from '../../learning/__tests__/assert';

function fakeSummary(over: Partial<ProgressSummary>): ProgressSummary {
  return {
    communicationScore: 50, independenceScore: 50, comprehensionScore: 50,
    retentionScore: 50, responseSpeedScore: 50, spontaneousUses: 0, automationScore: 50,
    ...over,
  };
}

export async function testStagnationDetector() {
  const growing = [fakeSummary({ communicationScore: 40 }), fakeSummary({ communicationScore: 55 })];
  const g = detectStagnation(growing);
  assert(!g.stagnant, 'progresso não é estagnação');

  const flat = [fakeSummary({ communicationScore: 50 }), fakeSummary({ communicationScore: 51 })];
  const s = detectStagnation(flat);
  assert(s.stagnant, 'pouca variação = estagnação');
  assert(s.area !== null, 'identifica área estagnada');

  const recovery = recoveryStrategy(s);
  assert(recovery !== null, 'gera estratégia de recuperação');
  assert(recovery!.days >= 2, 'recuperação tem duração');
  assert(recovery!.focusMethods.length > 0, 'recuperação tem métodos focados');

  const noRecovery = recoveryStrategy({ stagnant: false, area: null, weeksStagnant: 0 });
  assert(noRecovery === null, 'sem estagnação -> sem recuperação');

  const activity = await recentActivity();
  assert(typeof activity.total === 'number', 'atividade recente é número');
}
