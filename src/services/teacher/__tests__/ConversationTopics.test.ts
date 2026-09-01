import type { PhraseConfidence, UserLearningProfile } from '@/services/learning/ConfidenceService';
import {
  buildConversationTopicKickoff,
  getConversationTopics,
  openingMatchesTopic,
  pickConversationOpening,
  readLastShownConversationTopics,
  recordConversationTopicsShown,
  toConversationContext,
} from '@/services/teacher/ConversationTopics';
import { ConversationOrchestrator } from '@/services/teacher/ConversationOrchestrator';
import type { UserProfile } from '@/types';

function fakeConf(phraseId: string, timesCorrect = 1, confidence = 55): PhraseConfidence {
  return {
    phraseId,
    state: 'answeredAlone',
    confidence,
    recognition: 50,
    listening: 50,
    speaking: 50,
    production: 50,
    speed: 50,
    contextTransfer: 50,
    timesSeen: 2,
    timesProduced: timesCorrect,
    timesCorrect,
    lastSeen: new Date().toISOString(),
    lastProduced: new Date().toISOString(),
    avgResponseMs: 2000,
    needsHelp: false,
  };
}

function fakeLearning(phrases: Record<string, PhraseConfidence>): UserLearningProfile {
  return {
    userLevel: 'zero',
    communicationScore: 40,
    listeningScore: 40,
    speakingScore: 40,
    retentionScore: 40,
    pronunciationScore: 40,
    responseSpeedScore: 40,
    immersionLevel: 50,
    dailyGoal: 20,
    currentStreak: 1,
    totalStudyTime: 30,
    knownWords: [],
    knownPhrases: Object.keys(phrases),
    weakPhrases: [],
    strongPhrases: [],
    recurringMistakes: [],
    recentTopics: [],
    recentSituations: [],
    lastSession: null,
    learningVelocity: 1,
    phrases,
    bottleneck: null,
  };
}

const profile: UserProfile = {
  id: 'u1',
  name: 'Test',
  level: 'zero',
  dailyMinutes: 20,
  goal: 'work',
  profession: 'dev',
  frequentSituations: [],
  interests: [],
  onboardingComplete: true,
  firstLessonComplete: true,
  currentDay: 1,
  streak: 1,
  lastStudyDate: null,
  immersionPhase: 1,
  turboMode: false,
  speechSpeed: 'normal',
  germanPercentage: 50,
  createdAt: new Date().toISOString(),
};

async function run() {
  let passed = 0;
  let failed = 0;
  const assert = (name: string, cond: boolean) => {
    if (cond) { passed++; console.log('  ✓', name); }
    else { failed++; console.log('  ✗', name); }
  };

  // 7. dynamic conversation topics — trabalho
  {
    const learning = fakeLearning({
      'survival-arbeite': fakeConf('survival-arbeite'),
      'l0-bridge-wo-arbeitest': fakeConf('l0-bridge-wo-arbeitest'),
    });
    const topics = getConversationTopics(learning, []);
    assert('trabalho → Ich arbeite...', topics.some((t) => t.label.includes('Ich arbeite') && t.topic === 'work'));
  }

  // 8. comida com emoji/subtitle
  {
    const learning = fakeLearning({
      'l0-hook-ich-moechte': fakeConf('l0-hook-ich-moechte'),
      'l0-var-ich-moechte-wasser': fakeConf('l0-var-ich-moechte-wasser'),
      'l0-bridge-was-moechtest': fakeConf('l0-bridge-was-moechtest'),
    });
    const topics = getConversationTopics(learning, []);
    const food = topics.find((t) => t.topic === 'food');
    assert('comida → Ich möchte...', !!food?.label.includes('Ich möchte'));
    assert('comida subtitle Essen', food?.subtitle.includes('Essen') ?? false);
    assert('comida emoji', food?.emoji === '🍽');
  }

  // 9. learned-content filtering — sem transporte
  {
    const topics = getConversationTopics(fakeLearning({
      'l0-hook-ich-moechte': fakeConf('l0-hook-ich-moechte'),
    }), []);
    assert('sem transporte artificial', !topics.some((t) => /fahr|transport/i.test(t.subtitle)));
  }

  // 10. conversation context creation
  {
    const learning = fakeLearning({
      'survival-arbeite': fakeConf('survival-arbeite'),
      'l0-bridge-wo-arbeitest': fakeConf('l0-bridge-wo-arbeitest'),
    });
    const work = getConversationTopics(learning, []).find((t) => t.topic === 'work')!;
    const ctx = toConversationContext(work);
    assert('context id/topic work', ctx.id === 'work' && ctx.topic === 'work');
    assert('context tem chunk', !!ctx.chunk?.includes('Ich arbeite'));
    assert('context tem structures', ctx.knownStructures.length > 0);
    assert('context tem difficulty', !!ctx.difficulty);
    assert('abertura trabalho', pickConversationOpening(ctx).includes('arbeitest'));
  }

  // cenário real — food
  {
    const learning = fakeLearning({
      'l0-hook-ich-moechte': fakeConf('l0-hook-ich-moechte'),
      'l0-var-ich-moechte-wasser': fakeConf('l0-var-ich-moechte-wasser'),
      'l0-bridge-was-moechtest': fakeConf('l0-bridge-was-moechtest'),
    });
    const food = getConversationTopics(learning, []).find((t) => t.topic === 'food')!;
    const ctx = toConversationContext(food);
    assert('food context topic', ctx.topic === 'food');
    assert('food structures estudadas', ctx.knownStructures.some((s) => /möchte|möchtest/i.test(s)));
    assert('food vocab Wasser', ctx.knownVocabulary.includes('Wasser'));
    const opening = pickConversationOpening(ctx);
    assert('abertura food relacionada', openingMatchesTopic(opening, 'food'));
    assert('abertura NÃO é trabalho', !/Wo arbeitest/i.test(opening));
    assert('abertura essen derivada', opening.includes('essen') || opening.includes('möchtest'));
  }

  // 11. topic diversity
  {
    if (typeof localStorage !== 'undefined') localStorage.removeItem('dt_conversation_topics_shown');
    const learning = fakeLearning({
      'survival-arbeite': fakeConf('survival-arbeite'),
      'l0-hook-ich-moechte': fakeConf('l0-hook-ich-moechte'),
      'l0-hook-ich-brauche': fakeConf('l0-hook-ich-brauche'),
    });
    const first = getConversationTopics(learning, []);
    recordConversationTopicsShown([first[0]?.topic || 'work']);
    const second = getConversationTopics(learning, [], { lastShownTopics: ['work'] });
    assert('diversidade: primeiro chip muda', second[0]?.topic !== 'work' || second.length === 1);
  }

  // 12. no fake topics + máximo 6
  {
    const phrases: Record<string, PhraseConfidence> = {};
    for (const id of [
      'survival-arbeite', 'l0-hook-ich-moechte', 'l0-hook-ich-brauche',
      'l0-hook-ich-muss', 'l0-hook-kannst-du', 'l0-ich-wohne', 'l0-ich-komme',
    ]) phrases[id] = fakeConf(id);
    const topics = getConversationTopics(fakeLearning(phrases), []);
    assert('máximo 6 opções', topics.length <= 6);
    assert('sem estudo → sem chips', getConversationTopics(fakeLearning({}), []).length === 0);
  }

  // 13. Gemini receives context
  {
    const ctx = toConversationContext({
      id: 'food',
      baseId: 'l0-hook-ich-moechte',
      chunk: 'Ich möchte...',
      label: 'Ich möchte...',
      subtitle: 'Essen',
      emoji: '🍽',
      topic: 'food',
      vocabulary: ['Wasser', 'Pizza', 'essen', 'trinken'],
      learnedStructures: ['Ich möchte...', 'Was möchtest du?', 'Was möchtest du essen?'],
      recentTargets: ['Ich möchte Pizza.'],
      recentVariations: ['Was möchtest du trinken?'],
      difficulty: 'production',
      priority: 0.9,
      reason: 'studied+recent',
    });
    const kickoff = buildConversationTopicKickoff(ctx, 'Was möchtest du essen?');
    assert('kickoff mantém tema', kickoff.includes('comida'));
    assert('kickoff variações', kickoff.includes('trinken'));
    assert('kickoff proíbe troca tema', kickoff.includes('PROIBIDO: mudar'));
    assert('kickoff não inventa transporte', !kickoff.includes('fahren'));
  }

  // 14. selected topic remains active (orchestrator)
  {
    const learning = fakeLearning({
      'l0-hook-ich-moechte': fakeConf('l0-hook-ich-moechte'),
      'l0-var-ich-moechte-wasser': fakeConf('l0-var-ich-moechte-wasser'),
      'l0-bridge-was-moechtest': fakeConf('l0-bridge-was-moechtest'),
    });
    const food = getConversationTopics(learning, []).find((t) => t.topic === 'food')!;
    const ctx = toConversationContext(food);
    const orch = ConversationOrchestrator.create({ profile, learning, phrases: [], conversationIntent: ctx });
    const plan = orch.getPlan();
    assert('orch action converse', plan.action === 'converse');
    assert('orch tema comida', plan.topic.includes('comida'));
    assert('orch kickoff food', (plan.actionKickoff || '').includes('essen') || (plan.actionKickoff || '').includes('möchtest'));
    assert('orch kickoff não trabalho', !(plan.actionKickoff || '').includes('Wo arbeitest du?'));
  }

  // 15. variation guidance without loop
  {
    const ctx = toConversationContext({
      id: 'food',
      baseId: 'l0-hook-ich-moechte',
      chunk: 'Ich möchte...',
      label: 'Ich möchte...',
      subtitle: 'Essen',
      emoji: '🍽',
      topic: 'food',
      vocabulary: ['Pizza', 'Wasser'],
      learnedStructures: ['Was möchtest du essen?', 'Was möchtest du trinken?'],
      recentTargets: [],
      recentVariations: ['Was möchtest du trinken?', 'Möchtest du Pizza?'],
      difficulty: 'production',
      priority: 0.9,
      reason: 'studied',
    });
    const kickoff = buildConversationTopicKickoff(ctx, 'Was möchtest du essen?');
    assert('anti-loop no kickoff', kickoff.includes('PROIBIDO: repetir'));
    assert('variações sugeridas', kickoff.includes('trinken') || kickoff.includes('Pizza'));
  }

  // novos estudos alteram temas
  {
    const before = getConversationTopics(fakeLearning({
      'l0-hook-ich-brauche': fakeConf('l0-hook-ich-brauche'),
    }), []);
    const after = getConversationTopics(fakeLearning({
      'l0-hook-ich-brauche': fakeConf('l0-hook-ich-brauche'),
      'l0-hook-ich-moechte': fakeConf('l0-hook-ich-moechte'),
    }), []);
    assert('antes sem comida', !before.some((t) => t.topic === 'food'));
    assert('depois com comida', after.some((t) => t.topic === 'food'));
  }

  // readLastShownConversationTopics
  {
    if (typeof localStorage !== 'undefined') {
      recordConversationTopicsShown(['food', 'work']);
      const shown = readLastShownConversationTopics();
      assert('histórico topics shown', shown.includes('food') && shown.includes('work'));
      localStorage.removeItem('dt_conversation_topics_shown');
    }
  }

  console.log(`\n${passed} passaram, ${failed} falharam.`);
  if (failed > 0) process.exit(1);
}

run().catch((e) => { console.error(e); process.exit(1); });
