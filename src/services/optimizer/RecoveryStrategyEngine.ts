import type { StagnationReport } from '@/services/optimizer/StagnationDetector';

export interface RecoveryPlan {
  strategy: string;
  days: number;
  focusMethods: string[];
  reason: string;
}

export function recoveryStrategy(report: StagnationReport): RecoveryPlan | null {
  if (!report.stagnant || !report.area) return null;
  const map: Record<string, RecoveryPlan> = {
    communicationScore: {
      strategy: 'Conversação guiada + situações pessoais',
      days: 3,
      focusMethods: ['guided_conversation', 'situation_try_teach_repeat'],
      reason: 'Comunicação estagnada — focar produção contextual.',
    },
    independenceScore: {
      strategy: 'Recordação ativa + resposta rápida sem pistas',
      days: 3,
      focusMethods: ['active_recall', 'rapid_response'],
      reason: 'Independência estagnada — reduzir suporte.',
    },
    comprehensionScore: {
      strategy: 'Escuta em níveis + shadowing',
      days: 4,
      focusMethods: ['graded_listening', 'shadowing'],
      reason: 'Compreensão estagnada — mais listening.',
    },
    responseSpeedScore: {
      strategy: 'Resposta rápida + padrões',
      days: 3,
      focusMethods: ['rapid_response', 'pattern_practice'],
      reason: 'Velocidade estagnada — automatizar.',
    },
  };
  return map[report.area] ?? null;
}
