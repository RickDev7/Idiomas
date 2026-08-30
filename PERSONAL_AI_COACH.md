# Personal AI Language Coach (Fase 10)

O Deutsch Turbo deixa de ser um conjunto de motores e passa a ser **um professor que conhece o aluno**.

## Princípio

Não é “mais memória”. É **memória útil no momento certo**.

## Tipos

| Tipo | Onde |
|------|------|
| USER_FACTS | `CoachMemory` (confiança) |
| LINGUISTIC_MEMORY | `MemoryService` / `LearningItemState` |
| CONVERSATION_MEMORY | episódios curtos + continuidade de sessão |
| LEARNING_PROFILE | `PersonalLearningProfile` (Fase 9) |
| GOAL_MEMORY | objetivos explícitos |
| CONTEXT_MEMORY | `RealWorldEvent` |

Nunca enviar o arquivo inteiro ao Gemini. `MemoryRelevanceEngine` escolhe o que entra (`coachContext`, ≤1600 chars).

## Persona

`TeacherPersonaProfile` — tom estável (`warm_professional`), incentivo moderado, du, humor leve.  
Estratégia (Fase 9) pode mudar; a persona **não reinicia**.

## Situações reais

1. **PrepareMode** — “Amanhã preciso falar com meu chefe.” → evento + simulação curta.  
2. **Dia seguinte** — só se o evento estiver salvo: `Wie ist das Gespräch gelaufen?`  
3. **PostEventLearning** — “Foi difícil falar sobre horário.” → estrutura em contexto, sem corrigir a história inteira.

## Ensino invisível

`decideInterruption`: CONTINUE | CORRECT_BRIEFLY | TEACH | MICRO_PRACTICE | REVIEW | TRANSFER | SPONTANEOUS.

`NaturalnessScore` avalia o **sistema** (interrupções, exercícios, repetição).

## Confiança

Fato com `confidence` baixa **não** é afirmado. Sem registro = o professor não “lembra”.

## Privacidade

Sem áudio bruto. Perfil local. Gemini recebe só o recorte relevante.
