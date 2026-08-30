export interface EfficiencyInput {
  gain: number;
  minutes: number;
  retention: number;
  helpUsed: number;
  transfer: number;
  spontaneous: number;
  errors: number;
}

export interface EfficiencyOutput {
  score: number;
  gainPerMinute: number;
  label: string;
}

export function computeEfficiency(input: EfficiencyInput): EfficiencyOutput {
  const gainPerMinute = input.minutes > 0 ? input.gain / input.minutes : 0;
  const effort = 1 - Math.min(1, input.helpUsed / 5);
  const quality = 0.4 * input.retention + 0.25 * (input.transfer + input.spontaneous) / 2 + 0.2 * effort + 0.15 * (1 - Math.min(1, input.errors / 5));
  const score = Math.max(0, Math.min(1, 0.6 * gainPerMinute + 0.4 * quality));
  let label = 'médio';
  if (score > 0.75) label = 'excelente';
  else if (score > 0.55) label = 'bom';
  else if (score < 0.3) label = 'baixo';
  return { score, gainPerMinute, label };
}
