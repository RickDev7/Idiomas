/* Diagnóstico curto de onboarding (~2 min). Reusa o banco adaptativo existente. */
export {
  pickAdaptiveItems,
  gradeAdaptiveDiagnostic,
  diagnosticStartLevel,
  storeDiagnosticPlan,
  recordDiagnosticAnswer,
  gradeStoredDiagnostic,
  type DiagnosticItem,
  type DiagnosticItemResult,
  type DiagnosticResult,
} from '@/services/course/AdaptiveLevelAssessment';
