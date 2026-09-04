/* Selected Learning Target — Home + Meus Chunks + isolamento + fallback.
   Rodar: npx tsx src/services/teacher/__tests__/HomeSelectedTarget.test.ts */
const _store = new Map<string, string>();
(globalThis as unknown as { localStorage: Storage; sessionStorage: Storage }).localStorage = {
  getItem: (k) => _store.get(k) ?? null,
  setItem: (k, v) => { _store.set(k, String(v)); },
  removeItem: (k) => { _store.delete(k); },
  clear: () => { _store.clear(); },
  key: () => null,
  length: 0,
} as Storage;
(globalThis as unknown as { sessionStorage: Storage }).sessionStorage =
  (globalThis as unknown as { localStorage: Storage }).localStorage;

import { ConversationOrchestrator } from '@/services/teacher/ConversationOrchestrator';
import {
  beginSelectedLearningSession,
  clearSelectedLearningTarget,
  lessonSessionPathForSelectedTarget,
  readLessonStartPhraseId,
  readSelectedLearningTarget,
  storeSelectedLearningTarget,
  type SelectedLearningTarget,
} from '@/services/teacher/LessonStartIntent';
import { emptyLearningProfile } from '@/services/learning/RealProgress';
import { EventStore } from '@/services/learning/EventStore';
import { MemoryService } from '@/services/learning/MemoryService';
import { zeroLanguageSeedPhrases, L0_CHUNK_GRAPH } from '@/services/teacher/ZeroLanguageMode';
import type { UserProfile } from '@/types';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean) {
  if (cond) {
    passed += 1;
    console.log(`  ✓ ${name}`);
  } else {
    failed += 1;
    console.error(`  ✗ ${name}`);
  }
}

function profileZero(): UserProfile {
  return {
    id: 'selected-target',
    name: 'Rick',
    level: 'zero',
    selfReportedLevel: 'zero',
    diagnosticLevel: 'L0',
    goal: 'daily',
    dailyMinutes: 20,
    germanPercentage: 30,
    turboMode: false,
    streak: 0,
    currentDay: 1,
    onboardingComplete: true,
    firstLessonComplete: false,
    profession: '',
    frequentSituations: [],
    interests: [],
    lastStudyDate: null,
    immersionPhase: 1,
    speechSpeed: 'normal',
    createdAt: new Date().toISOString(),
  };
}

const HOME_CASES = [
  { id: 'survival-arbeite', german: 'Ich arbeite.' },
  { id: 'l0-hook-ich-moechte', german: 'Ich möchte...' },
  { id: 'l0-ich-wohne', german: 'Ich wohne in...' },
] as const;

const CHUNK_CASES = [
  { id: 'l0-ich-wohne', german: 'Ich wohne in...' },
  { id: 'l0-ich-komme', german: 'Ich komme aus...' },
  { id: 'l0-ich-heisse', german: 'Ich heiße...' },
  { id: 'l0-ich-bin', german: 'Ich bin...' },
  { id: 'l0-hook-ich-muss', german: 'Ich muss...' },
  { id: 'l0-hook-ich-moechte', german: 'Ich möchte...' },
] as const;

function firstContext(startPhraseId?: string) {
  const orch = ConversationOrchestrator.create({
    profile: profileZero(),
    learning: emptyLearningProfile(),
    phrases: [],
    startPhraseId,
  });
  const plan = orch.getPlan();
  return {
    orch,
    id: plan.target?.id ?? null,
    german: plan.target?.german ?? null,
    kickoff: plan.actionKickoff || '',
    reason: plan.actionReason || '',
  };
}

function simulateEntry(sel: SelectedLearningTarget): SelectedLearningTarget | undefined {
  storeSelectedLearningTarget(sel);
  const path = lessonSessionPathForSelectedTarget(sel);
  return readSelectedLearningTarget(path.split('?')[1] || '');
}

async function run() {
  const __dir = dirname(fileURLToPath(import.meta.url));
  const root = resolve(__dir, '../../../..');
  const homeSrc = readFileSync(resolve(root, 'src/pages/HomePage.tsx'), 'utf8');
  const chunksSrc = readFileSync(resolve(root, 'src/pages/MyGermanPage.tsx'), 'utf8');
  const structureSrc = readFileSync(resolve(root, 'src/pages/StructureDetailPage.tsx'), 'utf8');

  console.log('— ponto central único (código)');
  check('Home usa beginSelectedLearningSession', homeSrc.includes('beginSelectedLearningSession'));
  check('Home source:home', homeSrc.includes("source: 'home'"));
  check('Chunks usa beginSelectedLearningSession', chunksSrc.includes('beginSelectedLearningSession'));
  check('Chunks source:chunks', chunksSrc.includes("source: 'chunks'"));
  check('Chunks NÃO navega mais só para /estrutura/', !chunksSrc.includes('`/estrutura/${'));
  check('Estrutura usa beginSelectedLearningSession', structureSrc.includes('beginSelectedLearningSession'));

  console.log('— seeds / grafo');
  const seeds = new Map(zeroLanguageSeedPhrases().map((p) => [p.id, p]));
  for (const c of [...HOME_CASES, ...CHUNK_CASES]) {
    check(`${c.id} no grafo`, !!L0_CHUNK_GRAPH[c.id]);
    check(`${c.id} = ${c.german}`, seeds.get(c.id)?.german === c.german);
  }

  console.log('— Home selected target');
  for (const c of HOME_CASES) {
    clearSelectedLearningTarget();
    const read = simulateEntry({
      source: 'home',
      targetId: c.id,
      baseId: c.id,
      targetPhrase: c.german,
    });
    check(`Home ${c.german} lido`, read?.targetId === c.id && read.source === 'home');
    const hit = firstContext(read?.targetId);
    check(`Home ${c.german} → sessão`, hit.german === c.german && hit.id === c.id);
  }

  console.log('— Meus Chunks selected target');
  for (const c of CHUNK_CASES) {
    clearSelectedLearningTarget();
    const read = simulateEntry({
      source: 'chunks',
      targetId: c.id,
      baseId: c.id,
      targetPhrase: c.german,
    });
    check(`Chunks ${c.german} lido`, read?.targetId === c.id && read.source === 'chunks');
    const hit = firstContext(read?.targetId);
    check(`Chunks ${c.german} → sessão`, hit.german === c.german && hit.id === c.id);
  }

  console.log('— isolamento (não herda sessão anterior)');
  {
    clearSelectedLearningTarget();
    simulateEntry({
      source: 'home',
      targetId: 'survival-arbeite',
      baseId: 'survival-arbeite',
      targetPhrase: 'Ich arbeite.',
    });
    const a = firstContext('survival-arbeite');
    check('sessão 1 = Ich arbeite.', a.german === 'Ich arbeite.');

    clearSelectedLearningTarget();
    const bRead = simulateEntry({
      source: 'home',
      targetId: 'l0-hook-ich-moechte',
      baseId: 'l0-hook-ich-moechte',
      targetPhrase: 'Ich möchte...',
    });
    const b = firstContext(bRead?.targetId);
    check('sessão 2 = Ich möchte...', b.german === 'Ich möchte...');
    check('sessão 2 ≠ Ich arbeite.', b.german !== 'Ich arbeite.');

    clearSelectedLearningTarget();
    const cRead = simulateEntry({
      source: 'chunks',
      targetId: 'l0-ich-wohne',
      baseId: 'l0-ich-wohne',
      targetPhrase: 'Ich wohne in...',
    });
    const c = firstContext(cRead?.targetId);
    check('sessão 3 = Ich wohne in...', c.german === 'Ich wohne in...');
    check('sessão 3 ≠ möchten/arbeite', c.german !== 'Ich möchte...' && c.german !== 'Ich arbeite.');
  }

  console.log('— fallback sem seleção (/conversar ou lesson limpa)');
  {
    storeSelectedLearningTarget({
      source: 'home',
      targetId: 'survival-arbeite',
      targetPhrase: 'Ich arbeite.',
    });
    const cleared = readSelectedLearningTarget('type=lesson');
    check('lesson sem phrase limpa storage', cleared === undefined);
    check('storage limpo', sessionStorage.getItem('dt_selected_learning_target') == null);

    const free = readSelectedLearningTarget('type=free&topic=work');
    check('type=free ignora seleção lesson', free === undefined);
    check('review phrase não vira Home target', readLessonStartPhraseId('type=review&phrase=survival-arbeite') === undefined);

    const generic = firstContext();
    check('sem seleção → currículo genérico', generic.german !== 'Ich arbeite.');
    check('sem seleção → Guten Morgen.', generic.id === 'l0-guten-morgen' || (generic.german || '').includes('Guten Morgen'));
  }

  console.log('— beginSelectedLearningSession navega');
  {
    let navigated = '';
    beginSelectedLearningSession((to) => { navigated = to; }, {
      source: 'chunks',
      targetId: 'l0-ich-komme',
      baseId: 'l0-ich-komme',
      targetPhrase: 'Ich komme aus...',
    });
    check('path tem phrase=l0-ich-komme', navigated.includes('phrase=l0-ich-komme'));
    check('path from=chunks', navigated.includes('from=chunks'));
    check('type=lesson', navigated.includes('type=lesson'));
  }

  console.log('— progressão após target inicial');
  await EventStore.clear();
  await MemoryService.saveConfidenceMap({});
  {
    const { orch } = firstContext('survival-arbeite');
    check('início Ich arbeite.', orch.getPlan().target?.id === 'survival-arbeite');
    await orch.handle({ type: 'TEACHER_UTTERANCE', text: 'Ich arbeite.' });
    const decision = await orch.handle({ type: 'USER_UTTERANCE', text: 'Ich arbeite.' });
    const nextId = orch.getPlan().target?.id ?? null;
    check('avançou', nextId !== 'survival-arbeite');
    check(
      'próximo variação/frage do chunk',
      nextId === 'l0-bridge-ich-arbeite-in'
        || nextId === 'l0-bridge-ich-arbeite-heute'
        || nextId === 'l0-var-ich-arbeite-morgens'
        || nextId === 'l0-bridge-wo-arbeitest'
        || nextId === 'l0-bridge-wann-arbeitest',
    );
    check('não re-mira base no nudge', !/Nova frase-alvo ÚNICA: "Ich arbeite\."/i.test(decision.geminiNudge || ''));
  }

  console.log('— kickoff FINAL (payload Gemini) respeita target');
  {
    const { prepareSession } = await import('@/services/teacher/sessionContinuity');
    const { buildSessionKickoffFromProfile } = await import('@/services/voice/LiveSessionKickoff');
    const { SelectedStartTargetError } = await import('@/services/teacher/ConversationOrchestrator');
    const { emptyConfidence } = await import('@/services/learning/ConfidenceService');

    for (const c of HOME_CASES) {
      clearSelectedLearningTarget();
      const orch = ConversationOrchestrator.create({
        profile: profileZero(),
        learning: emptyLearningProfile(),
        phrases: [],
        startPhraseId: c.id,
      });
      const plan = orch.getPlan();
      const live = orch.toLiveFields();
      check(`kickoff orch ${c.german} plan.id`, plan.target?.id === c.id);
      check(`kickoff orch ${c.german} plan.german`, plan.target?.german === c.german);
      check(`selectedStartApplied ${c.german}`, orch.wasSelectedStartApplied() === true);
      const prepared = prepareSession(profileZero(), emptyLearningProfile(), {
        forcedOpening: {
          german: plan.target!.german,
          portuguese: plan.target!.portuguese,
          reason: plan.actionReason,
        },
      });
      check(`prepare forced ≠ Guten Morgen (${c.german})`, !/^Guten (Morgen|Tag|Abend)/i.test(prepared.opening.german));
      check(`prepare forced = ${c.german}`, prepared.opening.german === c.german);
      const kick = buildSessionKickoffFromProfile({
        openingGerman: plan.target!.german,
        zeroLanguageMode: true,
        level: 'zero',
        sessionKind: prepared.opening.kind,
        lastQuestion: 'Guten Morgen.',
        unfinishedGoal: 'Guten Morgen.',
        nextStep: 'L0: primeira microaula — Guten Morgen.',
        targetPhrasePt: live.targetPhrasePt,
        orchestratorKickoff: live.orchestratorKickoff,
      });
      check(`kickoff final contém ${c.german}`, kick.includes(c.german));
      check(`kickoff final NÃO contém Guten Abend (${c.german})`, !/Guten Abend/i.test(kick));
      check(`kickoff final NÃO injeta Guten Morgen como alvo (${c.german})`, !/Frase-alvo: "Guten Morgen/i.test(kick));
      check(
        `kickoff final filtra Próximo passo Guten Morgen (${c.german})`,
        !/Próximo passo:.*Guten Morgen/i.test(kick),
      );
      check(
        `kickoff final filtra Última pergunta Guten Morgen (${c.german})`,
        !/Última pergunta:.*Guten Morgen/i.test(kick),
      );
      check(`orchKickoff ensina ${c.german}`, (live.orchestratorKickoff || '').includes(c.german));
    }

    // Genérico sem seleção: Guten Morgen OK
    const genOrch = ConversationOrchestrator.create({
      profile: profileZero(),
      learning: emptyLearningProfile(),
      phrases: [],
    });
    const genPlan = genOrch.getPlan();
    const genLive = genOrch.toLiveFields();
    check('sem startPhraseId → selectedStartApplied false', genOrch.wasSelectedStartApplied() === false);
    const genKick = buildSessionKickoffFromProfile({
      openingGerman: genPlan.target?.german,
      zeroLanguageMode: true,
      level: 'zero',
      targetPhrasePt: genLive.targetPhrasePt,
      orchestratorKickoff: genLive.orchestratorKickoff,
    });
    check('genérico kickoff pode ser Guten Morgen', /Guten Morgen/i.test(genKick));

    console.log('— REGRESSÃO: Morgen+Tag aceitos → NÃO Guten Abend com startPhraseId');
    {
      function accepted(id: string) {
        return {
          ...emptyConfidence(id),
          timesCorrect: 2,
          timesSeen: 3,
          timesProduced: 2,
          confidence: 70,
          state: 'answeredAlone' as const,
        };
      }
      const learningStuck = emptyLearningProfile();
      learningStuck.phrases['l0-guten-morgen'] = accepted('l0-guten-morgen');
      learningStuck.phrases['l0-guten-tag'] = accepted('l0-guten-tag');

      const curriculum = ConversationOrchestrator.create({
        profile: profileZero(),
        learning: learningStuck,
        phrases: [],
      });
      check(
        'currículo sem seleção → Guten Abend',
        curriculum.getPlan().target?.id === 'l0-guten-abend',
      );

      for (const c of HOME_CASES) {
        const orch = ConversationOrchestrator.create({
          profile: profileZero(),
          learning: learningStuck,
          phrases: [],
          startPhraseId: c.id,
        });
        check(`Morgen+Tag + ${c.german} → id`, orch.getPlan().target?.id === c.id);
        check(`Morgen+Tag + ${c.german} → german`, orch.getPlan().target?.german === c.german);
        check(`Morgen+Tag + ${c.german} ≠ Abend`, orch.getPlan().target?.id !== 'l0-guten-abend');
        check(`Morgen+Tag + ${c.german} applied`, orch.wasSelectedStartApplied());
        const kick = buildSessionKickoffFromProfile({
          openingGerman: orch.getPlan().target!.german,
          zeroLanguageMode: true,
          level: 'zero',
          targetPhrasePt: orch.toLiveFields().targetPhrasePt,
          orchestratorKickoff: orch.toLiveFields().orchestratorKickoff,
        });
        check(`Morgen+Tag kickoff sem Abend (${c.german})`, !/Guten Abend/i.test(kick));
        check(`Morgen+Tag kickoff tem alvo (${c.german})`, kick.includes(c.german));
      }
    }

    console.log('— FALHA controlada: ID inexistente');
    {
      let threw = false;
      let errName = '';
      try {
        ConversationOrchestrator.create({
          profile: profileZero(),
          learning: emptyLearningProfile(),
          phrases: [],
          startPhraseId: 'phrase-que-nao-existe-xyz',
        });
      } catch (e) {
        threw = true;
        errName = (e as Error).name;
        check('erro é SelectedStartTargetError', e instanceof SelectedStartTargetError);
      }
      check('ID inexistente lança erro', threw);
      check('não mascara com currículo', errName === 'SelectedStartTargetError');
    }
  }

  console.log(`\n${passed} passaram, ${failed} falharam`);
  if (failed > 0) process.exit(1);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
