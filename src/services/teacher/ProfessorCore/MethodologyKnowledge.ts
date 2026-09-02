/**
 * Metodologia pedagógica explícita do Deutsch Turbo.
 */
import type { MethodPrinciple } from './Types';

export const METHOD_PRINCIPLES: MethodPrinciple[] = [
  { id: 'active_recall', name: 'ACTIVE RECALL', description: 'Recuperar sem olhar o modelo.' },
  { id: 'retrieval', name: 'RETRIEVAL PRACTICE', description: 'Praticar recuperar da memória.' },
  { id: 'spaced', name: 'SPACED REVIEW', description: 'Revisar com espaçamento.' },
  { id: 'chunking', name: 'CHUNKING', description: 'Unidade = chunk comunicativo.' },
  { id: 'substitution', name: 'SUBSTITUTION', description: 'Trocar slots no mesmo padrão.' },
  { id: 'contextual', name: 'CONTEXTUAL PRACTICE', description: 'Usar em situação realista.' },
  { id: 'transfer', name: 'TRANSFER', description: 'Mesma estrutura, contexto novo.' },
  { id: 'autonomous', name: 'AUTONOMOUS PRODUCTION', description: 'Produzir sem modelo prévio.' },
  { id: 'comprehension', name: 'COMPREHENSION', description: 'Entender antes de exigir produção.' },
  { id: 'variation', name: 'VARIATION', description: 'Variar forma e contexto.' },
  { id: 'interleaving', name: 'INTERLEAVING', description: 'Intercalar estruturas.' },
  { id: 'gradual_release', name: 'GRADUAL RELEASE OF SUPPORT', description: 'Retirar ajuda progressivamente.' },
];

/** Sequência canônica — usar quando pedagogicamente apropriado, não em toda sessão. */
export const PEDAGOGICAL_SEQUENCE = [
  'MODELO',
  'SUBSTITUIÇÃO',
  'PRODUÇÃO COM AJUDA',
  'PRODUÇÃO INDEPENDENTE',
  'TRANSFERÊNCIA',
  'CONVERSAÇÃO',
] as const;

export function methodologyHintsForMode(mode: string): string[] {
  switch (mode) {
    case 'LESSON':
      return [
        'COMPREHENSION → MODELO → SUBSTITUIÇÃO → PRODUÇÃO COM AJUDA',
        'GRADUAL RELEASE OF SUPPORT',
        'CHUNKING',
      ];
    case 'REVIEW':
      return ['ACTIVE RECALL', 'RETRIEVAL PRACTICE', 'SPACED REVIEW'];
    case 'SIMULATOR':
      return [
        'CONTEXTUAL PRACTICE',
        'TRANSFER',
        'AUTONOMOUS PRODUCTION',
        'Aluno fala mais que o professor',
      ];
    case 'MINI_PROVA':
      return ['TESTAR autonomia', 'Sem ensino durante a questão', 'Sem mostrar resposta'];
    case 'CONVERSATION':
      return ['VARIATION', 'TRANSFER', 'INTERLEAVING', 'produção livre controlada'];
    default:
      return ['CHUNKING', 'GRADUAL RELEASE OF SUPPORT'];
  }
}
