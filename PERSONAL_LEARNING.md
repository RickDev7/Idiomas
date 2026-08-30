# Personal Learning Adaptation (Fase 9)

O Deutsch Turbo já sabe **o que** o aluno consegue fazer (`UserLearningProfile`).  
A Fase 9 adiciona **como** ensinar este aluno (`PersonalLearningProfile` + `AdaptationEngine`).

## Arquitetura

```
Performance / EventStore / Memory
        ↓
BottleneckDetector + StrengthDetector + ErrorPatternDetector
        ↓
AdaptationEngine → PersonalLearningProfile + TeachingStrategy
        ↓
TeacherEngine (planTodaysTraining) + ConversationOrchestrator (diretiva Gemini)
```

O `AdaptationEngine` **não** substitui o `TeacherEngine`. Ele informa a estratégia; o Teacher decide o turno.

## PersonalLearningProfile

Persistido em `localStorage` (`personal-learning-profile`).

Contém:

- skills (speaking, listening, …)
- primaryBottleneck / secondaryBottleneck + confidence
- strengths, errorPatterns
- learningPace (sessões estimadas até estabilizar)
- preferredSupport (context | translation | example | minimal)
- conversationPerformance
- teachingStrategy / learningStrategy
- currentLearningFocus (texto amigável)

## Gargalos

`detectBottlenecks` usa **impacto na comunicação**, não só a menor nota.

Exemplos:

- Speaking fraco + listening forte → `PRIMARY = speaking`
- Listening fraco + speaking forte → `PRIMARY = listening`

Histerese: trocar o gargalo exige confiança e estabilidade (evita foco a cada sessão).

## Forças e erros

- `StrengthDetector` — padrões fortes observáveis
- `ErrorPatternDetector` — só padrões **recorrentes** (≥3), ex.: `verb_conjugation` em “Ich arbeiten…”

## TeachingStrategy

```ts
{
  supportPreference, preferredActivity, correctionStyle,
  pace, conversationRatio, reviewIntensity, challengeLevel,
  contextBridge?, errorFocus?, reason
}
```

`challengeLevel` ≠ nível CEFR (Nível 0…C2 continua no curso).

## Efeito no professor

1. `planTodaysTraining` redistribui minutos (mais speaking vs listening).
2. `buildConversationPlan` altera ação (practice / introduce / recall / transfer).
3. Diretiva Gemini recebe só o resumo (`geminiAdaptationSnippet`) — não o perfil inteiro.

## Home

“Seu foco de hoje” usa `currentLearningFocus` quando há evidência.

## Eventos

`ADAPTATION_APPLIED`, `STRATEGY_CHANGED`, `BOTTLENECK_DETECTED`, `STRENGTH_DETECTED` no `EventStore`.

## Critérios de aprovação

Dois perfis com desempenhos diferentes devem produzir **estratégias e planos diferentes** (não só labels).
