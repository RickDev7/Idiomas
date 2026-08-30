/* ============================================================
   DEUTSCH TURBO — Curso completo 0 → C2
   Tipos do sistema de curso. Camada nova que roda sobre o
   TeacherEngine/LearningEngine existentes, sem quebrá-los.
   ============================================================ */

/** Níveis do curso CEFR + etapa pré-A1 (Nível 0). */
export type CourseLevelId = 'L0' | 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';

/** Habilidades acompanhadas separadamente (nível por habilidade). */
export type SkillId =
  | 'listening'
  | 'speaking'
  | 'reading'
  | 'writing'
  | 'pronunciation'
  | 'grammar'
  | 'vocabulary'
  | 'communication';

/** Estado de desbloqueio de uma competência/conteúdo. */
export type MasteryGate = 'locked' | 'learning' | 'usable' | 'strong' | 'mastered';

/** Definição estática de um nível do curso. */
export interface CourseLevel {
  id: CourseLevelId;
  label: string;          // "Nível 0", "A1", ...
  cefr?: string;         // referência CEFR, se aplicável
  emoji: string;         // 🌱 🟢 ...
  objective: string;    // objetivo comunicativo do nível
  germanPercentage: number; // quanto de alemão o professor usa (0-100)
  /** competências esperadas ao concluir o nível */
  competencies: string[];
  /** módulos sugeridos (estrutura, não obrigatória) */
  modules: CourseModule[];
  /** tópicos de gramática do nível (ids do GrammarMap) */
  grammar: string[];
  /** situação real-world representativa do nível */
  realWorldScenario: string;
}

export interface CourseModule {
  id: string;
  level: CourseLevelId;
  title: string;
  description: string;
  units: CourseUnit[];
}

export interface CourseUnit {
  id: string;
  title: string;
  /** ids de frases (Phrase.id) que pertencem a esta unidade */
  phraseIds: string[];
  /** ids de palavras (Word.id) */
  wordIds: string[];
  /** competências trabalhadas (ids do CompetencyMap) */
  competencies: string[];
  /** pré-requisitos: ids de unidade */
  prerequisites: string[];
}

/** Competência comunicativa (o que o aluno consegue fazer). */
export interface Competency {
  id: string;
  level: CourseLevelId;
  title: string;        // "Apresentar-se"
  description: string;  // "Dizer seu nome e perguntar o nome do outro"
  /** níveis de domínio esperados (0-100) para considerar dominada */
  masteryThreshold: number;
  /** pré-requisitos: ids de competência */
  prerequisites: string[];
}

/** Tópico de gramática com gating. */
export interface GrammarTopic {
  id: string;
  title: string;
  level: CourseLevelId;
  summary: string;
  examples: string[];
  /** pré-requisitos: ids de tópico de gramática */
  prerequisites: string[];
}

/** Especificação de um exame de nível (assessment). */
export interface AssessmentSpec {
  id: string;
  level: CourseLevelId;
  title: string;
  /** competências avaliadas */
  competencies: string[];
  /** número de interações na avaliação */
  interactions: number;
}

/** Nível por habilidade + geral. */
export interface SkillLevelProfile {
  perSkill: Record<SkillId, CourseLevelId>;
  overall: CourseLevelId;
}

/** Progresso do curso persistido (localStorage). */
export interface CourseProgress {
  /** nível do curso em que o aluno está (geral) */
  currentLevel: CourseLevelId;
  /** nível por habilidade */
  skillLevels: Record<SkillId, CourseLevelId>;
  /** domínio por competência (0-100) */
  competencyMastery: Record<string, number>;
  /** gates desbloqueados por competência */
  competencyGates: Record<string, MasteryGate>;
  /** níveis já concluídos */
  completedLevels: CourseLevelId[];
  /** último assessment feito (level + data) */
  lastAssessment?: { level: CourseLevelId; at: string; passed: boolean };
  /** histórico recente de mastery (para detectar platô) */
  masteryHistory?: MasterySnapshot[];
  /** plano de recovery ativo, se houver platô */
  recovery?: CourseRecovery | null;
  /** atualizado em */
  updatedAt: string;
}

export interface MasterySnapshot {
  at: string;
  competencyId: string;
  mastery: number;
}

export interface CourseRecovery {
  until: string;
  strategy: string;
  focus: 'listening' | 'speaking' | 'review' | 'rapid';
  reason: string;
  competencyId?: string;
}

/** Recomendação do CourseEngine para a próxima ação. */
export interface CourseRecommendation {
  currentLevel: CourseLevelId;
  levelLabel: string;
  levelEmoji: string;
  nextObjective: string;       // "Conseguir falar sobre sua rotina."
  nextCompetencyId?: string;
  germanPercentage: number;
  /** níveis da jornada com estado de desbloqueio */
  journey: { level: CourseLevelId; label: string; emoji: string; status: 'done' | 'current' | 'locked' }[];
  /** se está pronto para o assessment do próximo nível */
  readyForAssessment: boolean;
  /** foco de habilidade mais fraca, se houver */
  focusSkill?: SkillId;
}
