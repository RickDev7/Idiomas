// Backend do Deutsch Turbo — proxy seguro para Gemini Live API
// Mantém GEMINI_API_KEY no servidor. Nunca expõe a chave ao frontend.

import 'dotenv/config';
import express from 'express';
import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { GoogleGenAI, Modality } from '@google/genai';
import crypto from 'node:crypto';

const PORT = process.env.PORT || 8787;
const HOST = process.env.HOST || '0.0.0.0';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const MODEL = process.env.GEMINI_MODEL || 'gemini-3.1-flash-live-preview';
const TEXT_MODEL = process.env.GEMINI_TEXT_MODEL || 'gemini-3.6-flash';
const TEXT_MODEL_FALLBACKS = [
  TEXT_MODEL,
  'gemini-3.6-flash',
  'gemini-3-flash-preview',
  'gemini-2.0-flash',
].filter((m, i, arr) => m && arr.indexOf(m) === i);
const TOKEN_TTL_MS = 5 * 60 * 1000; // 5 minutos
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST_PATH = path.resolve(__dirname, '../dist');

const DEFAULT_ALLOWED_ORIGINS = [
  'https://idiomas-kappa.vercel.app',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:4173',
  'http://127.0.0.1:4173',
  'http://localhost:4175',
  'http://127.0.0.1:4175',
];

const ALLOWED_ORIGINS = new Set([
  ...DEFAULT_ALLOWED_ORIGINS,
  ...(process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
]);

function isAllowedOrigin(origin) {
  if (!origin) return false;
  if (ALLOWED_ORIGINS.has(origin)) return true;
  // Previews Vercel opcionais: ALLOW_VERCEL_PREVIEWS=1
  if (process.env.ALLOW_VERCEL_PREVIEWS === '1') {
    try {
      const host = new URL(origin).hostname;
      return host.endsWith('.vercel.app');
    } catch {
      return false;
    }
  }
  return false;
}

if (!GEMINI_API_KEY) {
  console.warn('[gemini] GEMINI_API_KEY ausente. /api/gemini/token retornará erro 503.');
}

const app = express();
app.use(express.json({ limit: '256kb' }));

// CORS: allowlist (Vercel + localhost). Sem * em produção.
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && isAllowedOrigin(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Vary', 'Origin');
  if (req.method === 'OPTIONS') {
    if (origin && !isAllowedOrigin(origin)) return res.sendStatus(403);
    return res.sendStatus(204);
  }
  next();
});

const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

// token efêmero -> sessão
const sessions = new Map();

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'deutsch-turbo-backend',
    geminiConfigured: Boolean(GEMINI_API_KEY),
  });
});

function buildSimulatorSystemInstruction(profile) {
  const known = (profile.knownPhrases || []).slice(0, 12).join('\n');
  return [
    'Você é um interlocutor alemão em um SIMULADOR de conversa real — NÃO é aula, NÃO é teste.',
    'REGRAS:',
    '1. Fale SOMENTE alemão. Nunca português.',
    '2. Uma situação, uma voz, uma pergunta por vez — nunca duas aberturas ou dois assuntos simultâneos.',
    '3. Reaja naturalmente ao que o aluno diz e varie contexto.',
    '4. NÃO ensine, NÃO corrija como professor, NÃO use ciclo PT→DE nem "Vamos aprender".',
    '5. Comece imediatamente com UMA abertura do cenário.',
    profile.openingGerman ? `ABERTURA ÚNICA (sua primeira fala em áudio): ${profile.openingGerman}` : '',
    profile.teacherDirective || '',
    profile.coachContext ? `=== KONTEXT ===\n${profile.coachContext}\n=== FIM ===` : '',
    known ? `Material conhecido:\n${known}` : '',
    profile.memorySummary ? `MEMÓRIA:\n${profile.memorySummary}` : '',
    `TEMA: ${profile.sessionTopic || profile.lastTopic || 'Simulador'}`,
  ].filter(Boolean).join('\n');
}

function buildMiniProvaSystemInstruction(profile) {
  const known = (profile.knownPhrases || []).slice(0, 12).join('\n');
  return [
    'Você é examinador em uma MINI-PRÜFUNG — avaliação objetiva, não aula.',
    'REGRAS:',
    '1. Fale SOMENTE alemão.',
    '2. Uma pergunta por vez. Uma voz. Sem segunda abertura.',
    '3. Não ensine, não repita a pergunta após erro, não mostre a resposta.',
    profile.openingGerman ? `PRIMEIRA PERGUNTA: ${profile.openingGerman}` : '',
    profile.teacherDirective || '',
    known ? `Material:\n${known}` : '',
  ].filter(Boolean).join('\n');
}

function buildImmersionSessionKickoff(profile) {
  const kick = profile.orchestratorKickoff;
  const gen = profile.liveSessionGeneration;
  if (kick) {
    console.log(`[KICKOFF] mode=${profile.simulatorMode ? 'simulator' : 'miniprova'} session=${gen ?? '?'}`);
    return kick;
  }
  return [
    '[INSTRUÇÃO INTERNA — não leia isto em voz alta]',
    profile.simulatorMode
      ? 'SIMULATOR — comece FALANDO agora em alemão, uma única abertura natural.'
      : 'MINI-PRÜFUNG — comece FALANDO agora em alemão, uma única pergunta.',
    profile.openingGerman ? `Abertura: "${profile.openingGerman}"` : '',
  ].filter(Boolean).join('\n');
}

function buildSystemInstruction(profile) {
  if (profile.simulatorMode) {
    return buildSimulatorSystemInstruction(profile);
  }
  if (profile.miniProvaMode) {
    return buildMiniProvaSystemInstruction(profile);
  }
  const known = (profile.knownPhrases || []).slice(0, 12).join('\n');
  const weak = (profile.weakPhrases || []).slice(0, 6).join('\n');
  const opening = profile.openingGerman || '';
  const kind = profile.sessionKind || 'RETURNING_SESSION';
  // Prefer flag do cliente (isZeroLanguageMode). Fallback: level===zero se flag ausente.
  const zeroActive = profile.zeroLanguageMode === true
    || ((profile.level || '') === 'zero' && profile.zeroLanguageMode !== false);
  const zeroBlock = zeroActive
    ? [
        '=== ZERO LANGUAGE MODE (nível 0) ===',
        'O aluno está no nível ZERO. Ele pode NÃO entender alemão.',
        'Português = língua principal de EXPLICAÇÃO. Alemão = doses pequenas.',
        'Ciclo de microaula por voz:',
        'Vamos aprender… → modelo DE → Significa… → Escute → modelo DE → Agora você → AGUARDE.',
        'Silêncio do aluno NÃO é erro imediato.',
        'Se errar: Quase → ponto difícil → Escute novamente → modelo → Agora você. NÃO mude de assunto.',
        'Produção após modelo = GUIADA (não declare automação).',
        'UMA frase por vez. Sem perguntas abertas. Continuidade: não reinicie com Hallo/Wie geht\'s por hábito.',
        '=== FIM ZERO LANGUAGE MODE ===',
      ]
    : [];
  return [
    'Você é o DEUTSCH COACH, um professor particular de alemão por voz.',
    'REGRAS:',
    '1. O aluno pode estar começando do ZERO. Nunca presuma conhecimento que ainda não foi ensinado.',
    zeroActive
      ? '2. No nível 0: use português para explicar significados. Alemão curto para modelar e pedir produção.'
      : '2. Fale alemão por padrão. Use português (pt-BR) somente para explicar, corrigir ou quando o aluno demonstrar que não entendeu.',
    '3. OBJETIVO PEDAGÓGICO: transformar conhecimento em USO REAL — compreender → recuperar → falar → variar → usar espontaneamente → automatizar.',
    zeroActive
      ? '4. No nível 0, repetir COM modelo faz parte da aquisição. Depois retire a ajuda e peça recall/uso.'
      : '4. Não peça só "repita". Crie necessidade comunicativa (situações curtas) para o aluno precisar da frase.',
    '5. Ensine ANTES de exigir produção. Se o aluno não souber, dê ajuda progressiva (pista → palavra → modelo), depois retire a ajuda.',
    '6. Após acertar com ajuda, peça de novo SEM ajuda e depois em CONTEXTO DIFERENTE (tempo/pessoa/pergunta).',
    '7. Corrija só o essencial: "Quase! Sag: <correção>. Agora você." AGUARDE a nova tentativa. NÃO mude de assunto após corrigir.',
    '8. Não interrompa o aluno excessivamente. Deixe ele pensar e falar. Silêncio ≠ erro imediato.',
    '9. Reforce erros recorrentes criando situações que usem a estrutura correta.',
    '10. Priorize situações da vida real e o vocabulário conhecido do aluno.',
    '11. Faça perguntas para o aluno responder. O objetivo é fazê-lo falar com independência.',
    '12. Varie contexto: se aprendeu "Ich arbeite heute", use "morgen", "gestern", perguntas — um elemento por vez.',
    '13. Não exija sotaque nativo. Priorize inteligibilidade e uso. Em dúvida de pronúncia: indique a parte difícil, fale devagar, peça nova tentativa.',
    '14. Responda em áudio de forma natural e clara.',
    '15. CONTINUIDADE: você LEMBRA da sessão anterior. Não reinicie a aula do zero.',
    '16. NÃO comece automaticamente com "Hallo" nem "Wie geht es dir?" — isso NÃO é o roteiro padrão.',
    '17. Só use "Hallo" / "Wie geht es dir?" se a abertura escolhida abaixo for exatamente essa, ou se for revisão pedagógica dessa frase.',
    '18. Comece a sessão com a ABERTURA ESCOLHIDA. Depois continue a partir dela.',
    '19. Não precisa saudar em toda sessão. Pode começar direto com uma pergunta ou revisão.',
    '20. Pareça um professor conversando, não um avaliador de provas. Tom encorajador: Quase / Muito bom / Vamos tentar novamente.',
    '21. Use memória SOMENTE se estiver listada. Nunca invente fatos sobre o aluno.',
    '22. Não repita a mesma informação pessoal em toda sessão.',
    '23. Se o aluno mudar de assunto, acompanhe. O plano não é uma prisão.',
    '24. Prefira correção breve e conversa; só abra exercício quando for realmente necessário.',
    ...zeroBlock,
    '',
    `TIPO DE SESSÃO: ${kind}`,
    `ESTRATÉGIA DE ABERTURA: ${profile.openingStrategy || 'advance'}`,
    opening ? `ABERTURA ESCOLHIDA (fale isto primeiro, em alemão):\n${opening}` : '',
    profile.lastTopic ? `TEMA DA ÚLTIMA SESSÃO: ${profile.lastTopic} — continue neste contexto se fizer sentido.` : '',
    profile.lastQuestion ? `ÚLTIMA PERGUNTA DO PROFESSOR: ${profile.lastQuestion}` : '',
    profile.lastUserAnswer ? `ÚLTIMA RESPOSTA DO ALUNO: ${profile.lastUserAnswer}` : '',
    profile.unfinishedGoal ? `OBJETIVO INCOMPLETO: ${profile.unfinishedGoal}` : '',
    profile.nextStep ? `PRÓXIMO PASSO RECOMENDADO: ${profile.nextStep}` : '',
    Array.isArray(profile.recentMistakes) && profile.recentMistakes.length
      ? `ERROS RECENTES (trabalhe a forma correta, sem humilhar):\n${profile.recentMistakes.slice(0, 4).join('\n')}`
      : '',
    '',
    `NÍVEL DO ALUNO: ${profile.level || 'zero'}`,
    `OBJETIVO: ${profile.goal || 'daily'}`,
    `PROFISSÃO: ${profile.profession || 'não informada'}`,
    `IMERSÃO (0-100): ${profile.immersionLevel ?? 50}`,
    profile.immersionGuidance || '',
    profile.intensiveMode ? 'MODO INTENSIVO: ATIVO' : 'MODO INTENSIVO: OFF',
    profile.intensiveGuidance || '',
    profile.helpLevel ? `NÍVEL DE AJUDA DO ALUNO: ${profile.helpLevel}` : '',
    profile.profession ? `CONTEXTO PROFISSIONAL: ${profile.profession}` : '',
    known ? `FRASES CONHECIDAS (prefira este vocabulário):\n${known}` : 'FRASES CONHECIDAS: nenhuma ainda.',
    weak ? `FRASES FRACAS (reforce):\n${weak}` : '',
    profile.memorySummary ? `MEMÓRIA COMPACTA DO ALUNO:\n${profile.memorySummary}` : '',
    profile.teacherDirective || '',
    profile.coachContext ? `=== PROFESSOR PESSOAL ===\n${profile.coachContext}\n=== FIM PROFESSOR PESSOAL ===` : '',
    profile.pedagogicalAction
      ? `AÇÃO PEDAGÓGICA ATIVA: ${profile.pedagogicalAction}${profile.targetPhrase ? ` | alvo: ${profile.targetPhrase}` : ''}`
      : '',
    Number.isFinite(profile.scaffoldLevel) ? `SCAFFOLD MÁXIMO AGORA: ${profile.scaffoldLevel}/5` : '',
    profile.scaffoldHint ? `PISTA ATUAL (não ultrapasse este nível):\n${profile.scaffoldHint}` : '',
    profile.sessionTopic ? `TEMA ORQUESTRADO: ${profile.sessionTopic}` : '',
    profile.trainingStage ? `ESTÁGIO DO TREINO: ${profile.trainingStage}` : '',
    profile.actionReason ? `MOTIVO DA AÇÃO (interno): ${profile.actionReason}` : '',
    Number.isFinite(profile.automationScore)
      ? `AUTOMATION SCORE DO ALVO: ${profile.automationScore}`
      : '',
    `PLANO DE HOJE: continue a partir da abertura, da orquestração e da memória compacta.`,
    `IDIOMA DE APOIO: pt-BR`,
  ].filter(Boolean).join('\n');
}

function sanitizeProfile(input) {
  if (!input || typeof input !== 'object') return {};
  const p = input;
  const clip = (v, n) => (typeof v === 'string' ? v.slice(0, n) : '');
  return {
    level: clip(p.level, 16) || 'zero',
    zeroLanguageMode: p.zeroLanguageMode === true || p.zeroLanguageMode === 'true',
    goal: clip(p.goal, 32) || 'daily',
    profession: clip(p.profession, 80),
    immersionLevel: Number.isFinite(p.immersionLevel) ? Number(p.immersionLevel) : 50,
    intensiveMode: !!p.intensiveMode,
    helpLevel: clip(p.helpLevel, 16),
    immersionGuidance: clip(p.immersionGuidance, 320),
    intensiveGuidance: clip(p.intensiveGuidance, 320),
    knownPhrases: Array.isArray(p.knownPhrases) ? p.knownPhrases.filter((x) => typeof x === 'string').slice(0, 30) : [],
    weakPhrases: Array.isArray(p.weakPhrases) ? p.weakPhrases.filter((x) => typeof x === 'string').slice(0, 30) : [],
    memorySummary: clip(p.memorySummary, 2000),
    openingGerman: clip(p.openingGerman, 280),
    openingStrategy: clip(p.openingStrategy, 40),
    sessionKind: clip(p.sessionKind, 40),
    lastTopic: clip(p.lastTopic, 80),
    lastQuestion: clip(p.lastQuestion, 280),
    lastUserAnswer: clip(p.lastUserAnswer, 280),
    unfinishedGoal: clip(p.unfinishedGoal, 280),
    nextStep: clip(p.nextStep, 280),
    recentMistakes: Array.isArray(p.recentMistakes) ? p.recentMistakes.filter((x) => typeof x === 'string').slice(0, 8) : [],
    skipKickoff: !!p.skipKickoff,
    teacherDirective: clip(p.teacherDirective, 2400),
    pedagogicalAction: clip(p.pedagogicalAction, 32),
    targetPhrase: clip(p.targetPhrase, 160),
    targetPhrasePt: clip(p.targetPhrasePt, 160),
    scaffoldLevel: Number.isFinite(p.scaffoldLevel) ? Math.max(0, Math.min(5, Number(p.scaffoldLevel))) : undefined,
    sessionTopic: clip(p.sessionTopic, 80),
    trainingStage: clip(p.trainingStage, 32),
    orchestratorKickoff: clip(p.orchestratorKickoff, 900),
    scaffoldHint: clip(p.scaffoldHint, 280),
    actionReason: clip(p.actionReason, 280),
    automationScore: Number.isFinite(p.automationScore) ? Math.max(0, Math.min(100, Number(p.automationScore))) : undefined,
    coachContext: clip(p.coachContext, 1600),
    simulatorMode: !!p.simulatorMode,
    miniProvaMode: !!p.miniProvaMode,
    liveSessionGeneration: Number.isFinite(p.liveSessionGeneration) ? Number(p.liveSessionGeneration) : undefined,
  };
}

function buildSessionKickoff(profile) {
  if (profile.simulatorMode || profile.miniProvaMode) {
    return buildImmersionSessionKickoff(profile);
  }
  const opening = profile.openingGerman || '';
  const kind = profile.sessionKind || 'RETURNING_SESSION';
  const zeroActive = profile.zeroLanguageMode === true
    || ((profile.level || '') === 'zero' && profile.zeroLanguageMode !== false);
  if (profile.skipKickoff) {
    return [
      '[INSTRUÇÃO INTERNA — não leia isto em voz alta]',
      'A conexão caiu. Continue EXATAMENTE de onde parou.',
      'NÃO cumprimente de novo. NÃO recomece a aula. NÃO diga Hallo nem Wie geht es dir.',
      'Faça o aluno continuar falando.',
    ].join('\n');
  }
  const memoryBits = [
    profile.lastQuestion ? `Última pergunta: ${profile.lastQuestion}` : '',
    profile.lastUserAnswer ? `Última resposta do aluno: ${profile.lastUserAnswer}` : '',
    profile.unfinishedGoal ? `Objetivo incompleto: ${profile.unfinishedGoal}` : '',
    profile.nextStep ? `Próximo passo: ${profile.nextStep}` : '',
    profile.lastTopic ? `Tema: ${profile.lastTopic}` : '',
    Array.isArray(profile.recentMistakes) && profile.recentMistakes.length ? `Erros: ${profile.recentMistakes.slice(0, 3).join(' | ')}` : '',
  ].filter(Boolean);

  if (zeroActive) {
    return [
      '[INSTRUÇÃO INTERNA — não leia isto em voz alta]',
      'ZERO LANGUAGE MODE — comece FALANDO agora seguindo o ciclo PT→DE→Escute→Agora você→AGUARDE.',
      opening ? `Frase-alvo desta abertura: "${opening}"` : '',
      profile.targetPhrasePt ? `Significado: ${profile.targetPhrasePt}` : '',
      ...memoryBits,
      'NÃO reinicie com "Hallo! Wie geht es dir?" por hábito.',
      profile.orchestratorKickoff || '',
    ].filter(Boolean).join('\n');
  }

  if (kind === 'FIRST_SESSION' && opening) {
    return [
      '[INSTRUÇÃO INTERNA — não leia isto em voz alta]',
      'Esta é a PRIMEIRA sessão. Comece FALANDO agora, em alemão, usando esta abertura (variação mínima ok):',
      `"${opening}"`,
      'Depois ensine Ich heiße se o aluno não souber, e espere ele responder.',
      'NÃO use "Wie geht es dir?" como segunda fala automática.',
      profile.orchestratorKickoff || '',
    ].filter(Boolean).join('\n');
  }
  if (opening) {
    return [
      '[INSTRUÇÃO INTERNA — não leia isto em voz alta]',
      'Você LEMBRA da sessão anterior. NÃO reinicie o roteiro.',
      'Comece FALANDO agora, em alemão. Sua PRIMEIRA fala em áudio DEVE ser esta abertura (variação mínima ok, não troque o sentido):',
      `"${opening}"`,
      ...memoryBits,
      'PROIBIDO nesta abertura: "Guten Morgen! Wie geht\'s?", "Guten Morgen! Wie geht es dir?", "Hallo! Wie geht es dir?" — a menos que a abertura acima seja exatamente isso.',
      'NÃO comece com "Hallo." nem "Wie geht es dir?" a menos que a abertura acima seja exatamente isso.',
      'Depois continue a aula a partir dela e faça o aluno falar.',
      profile.orchestratorKickoff || '',
    ].filter(Boolean).join('\n');
  }
  return [
    '[INSTRUÇÃO INTERNA — não leia isto em voz alta]',
    'Comece a sessão em alemão de forma natural, usando a memória compacta do aluno.',
    ...memoryBits,
    'NÃO use o roteiro "Hallo" + "Wie geht es dir?".',
    'Faça o aluno falar.',
    profile.orchestratorKickoff || '',
  ].filter(Boolean).join('\n');
}

function logSession(profile) {
  if (process.env.NODE_ENV === 'production' && process.env.LOG_SESSION !== '1') return;
  console.log(`[SESSION] type=${profile?.sessionKind || '?'}`);
  console.log(`[OPENING] strategy=${profile?.openingStrategy || '?'} german=${profile?.openingGerman || '?'}`);
  console.log(`[MEMORY] loaded=${!!profile?.memorySummary}`);
  console.log(`[LAST_SESSION] topic=${profile?.lastTopic || 'none'}`);
  console.log(`[L0] zeroLanguageMode=${!!profile?.zeroLanguageMode} level=${profile?.level || '?'}`);
  if (profile?.simulatorMode) {
    console.log(`[SIMULATOR_INIT] session=${profile?.liveSessionGeneration ?? '?'}`);
  }
}

// POST /api/gemini/token — emite token efêmero e abre a sessão Live no servidor
app.post('/api/gemini/token', async (req, res) => {
  if (!GEMINI_API_KEY) {
    return res.status(503).json({ error: 'gemini_not_configured' });
  }
  try {
    const profile = sanitizeProfile(req.body?.profile);
    const token = crypto.randomBytes(24).toString('hex');

    const entry = {
      createdAt: Date.now(),
      token,
      session: null,
      clientWs: null,
      profile,
      kickoffSent: false,
    };
    sessions.set(token, entry);

    const session = await ai.live.connect({
      model: MODEL,
      callbacks: {
        onmessage: (e) => handleLiveMessage(entry, e),
        onerror: () => {
          const ws = entry.clientWs;
          if (ws && ws.readyState === ws.OPEN) {
            ws.send(JSON.stringify({ type: 'error', message: 'live_error' }));
          }
        },
        onclose: () => {
          console.log(`[gemini] session closed (token ${token.slice(0, 8)})`);
          const ws = entry.clientWs;
          if (ws && ws.readyState === ws.OPEN) {
            ws.send(JSON.stringify({ type: 'error', message: 'live_closed' }));
            try { ws.close(); } catch {}
          }
          sessions.delete(token);
        },
      },
      config: {
        responseModalities: [Modality.AUDIO],
        inputAudioTranscription: {},
        outputAudioTranscription: {},
        speechConfig: {
          languageCode: 'de-DE',
          voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Aoede' } },
        },
        systemInstruction: buildSystemInstruction(profile),
      },
    });
    entry.session = session;
    logSession(profile);

    // Kickoff adiado até o WebSocket do cliente conectar (evita áudio perdido/sobreposto).
    setTimeout(() => {
      const s = sessions.get(token);
      if (s && !s.clientWs) {
        try { s.session.close(); } catch {}
        sessions.delete(token);
      }
    }, TOKEN_TTL_MS);

    res.json({ token, model: MODEL, ttlMs: TOKEN_TTL_MS, zeroLanguageMode: !!profile.zeroLanguageMode });
  } catch (err) {
    console.error('[gemini] token error:', err?.message || err);
    res.status(500).json({ error: 'session_failed' });
  }
});

function mergeTranscript(previous, incoming) {
  const a = previous || '';
  const b = incoming || '';
  if (!b) return a;
  if (!a) return b;
  if (b === a) return a;
  if (b.startsWith(a)) return b;
  if (a.startsWith(b)) return a;
  if (a.endsWith(b)) return a;
  const max = Math.min(a.length, b.length);
  for (let n = max; n > 0; n--) {
    if (a.slice(-n) === b.slice(0, n)) return a + b.slice(n);
  }
  return a + b;
}

function logGeminiShape(entry, e) {
  const sc = e.serverContent;
  const parts = sc?.modelTurn?.parts ?? [];
  console.log('[GEMINI MESSAGE]', {
    token: entry.token?.slice(0, 8),
    setupComplete: !!e.setupComplete,
    turnComplete: !!sc?.turnComplete,
    interrupted: !!sc?.interrupted,
    partsCount: parts.length,
    hasText: parts.some((p) => typeof p.text === 'string' && p.text.length > 0),
    hasAudio: parts.some((p) => !!p.inlineData),
    inTxLen: (sc?.inputTranscription?.text || '').length,
    outTxLen: (sc?.outputTranscription?.text || '').length,
  });
}

function handleLiveMessage(entry, e) {
  const ws = entry.clientWs;
  const send = (obj) => {
    if (ws && ws.readyState === ws.OPEN) ws.send(JSON.stringify(obj));
  };

  if (e.setupComplete) {
    return;
  }

  const sc = e.serverContent;
  if (sc) {
    logGeminiShape(entry, e);
    if (!entry.assistantTx) entry.assistantTx = '';
    if (!entry.userTx) entry.userTx = '';

    const parts = sc.modelTurn?.parts ?? [];
    for (const part of parts) {
      if (part.inlineData && typeof part.inlineData.data === 'string' && part.inlineData.data.length > 0) {
        send({ type: 'audio', data: part.inlineData.data, mimeType: part.inlineData.mimeType });
        console.log(`[gemini] audio out (token ${entry.token?.slice(0,8) || '????????'}, ${part.inlineData.data.length} bytes)`);
      }
    }
    if (sc.inputTranscription?.text) {
      const t = sc.inputTranscription.text;
      entry.userTx = mergeTranscript(entry.userTx, t);
      send({ type: 'transcript', role: 'user', text: entry.userTx, delta: t });
      console.log(`[gemini] user said (token ${entry.token?.slice(0,8) || '????????'}): ${entry.userTx.slice(0, 180)}`);
    }
    const spoken = sc.outputTranscription?.text;
    const textParts = !spoken
      ? parts.map((p) => (typeof p.text === 'string' ? p.text : '')).filter(Boolean).join('')
      : '';
    const incoming = spoken || textParts;
    if (incoming) {
      if (entry.userTx) {
        send({ type: 'turn_complete', role: 'user', text: entry.userTx });
        entry.userTx = '';
      }
      entry.assistantTx = mergeTranscript(entry.assistantTx, incoming);
      send({ type: 'transcript', role: 'assistant', text: entry.assistantTx, delta: incoming });
      console.log(`[gemini] assistant said (token ${entry.token?.slice(0,8) || '????????'}): ${entry.assistantTx.slice(0, 180)}`);
    }
    if (sc.interrupted) {
      send({ type: 'interrupted', text: entry.assistantTx || undefined });
    }
    if (sc.turnComplete) {
      send({ type: 'turn_complete', role: 'assistant', text: entry.assistantTx || undefined });
      entry.assistantTx = '';
    }
  }

  if (e.goAway) {
    send({ type: 'error', message: 'session_limit' });
  }
}

function lookupLocalPt(text) {
  const norm = (s) => String(s || '')
    .toLowerCase()
    .replace(/ß/g, 'ss')
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, ' ')
    .replace(/[“”„"«»'`´]/g, ' ')
    .replace(/[.!?…,;:()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const map = {
    hallo: 'Olá!',
    'guten morgen': 'Bom dia!',
    'guten tag': 'Boa tarde!',
    'guten abend': 'Boa noite!',
    'wie geht es dir': 'Como você está?',
    'wie heisst du': 'Como você se chama?',
    'wo wohnst du': 'Onde você mora?',
    'was brauchst du': 'O que você precisa?',
    'was brauchst du jetzt': 'O que você precisa agora?',
    'was brauchst du da': 'O que você precisa aí?',
    'was hast du gestern nach der arbeit gemacht': 'O que você fez ontem depois do trabalho?',
    'ich brauche eine pause': 'Preciso de uma pausa.',
    'alles klar': 'Tudo bem?',
    'alles gut': 'Tudo bem?',
    'sag mal': 'Diga:',
    'sag mir': 'Diga:',
    'fang an mit': 'Comece com:',
    'mir geht es gut': 'Estou bem.',
    'jetzt du': 'Agora você!',
    'wie gehts': 'Como vai?',
    'wie geht s': 'Como vai?',
    danke: 'Obrigado.',
    bitte: 'Por favor. / De nada.',
    'sehr gut': 'Muito bem!',
  };
  const n = norm(text);
  if (map[n]) return map[n];
  const clauses = String(text || '').split(/(?<=[.!?…])\s+/).map((s) => s.trim()).filter((s) => norm(s));
  if (clauses.length < 2) return '';
  const parts = [];
  for (const c of clauses) {
    const t = map[norm(c)];
    if (!t) return '';
    parts.push(t);
  }
  return parts.join(' ');
}

function extractRetryAfterMs(err) {
  const msg = String(err?.message || err || '');
  const retryMatch = msg.match(/retry in ([\d.]+)\s*s/i) || msg.match(/"retryDelay"\s*:\s*"(\d+)s"/i);
  if (retryMatch) {
    const sec = Number(retryMatch[1]);
    if (Number.isFinite(sec) && sec > 0) return Math.ceil(sec * 1000);
  }
  const details = err?.error?.details || err?.details;
  if (Array.isArray(details)) {
    for (const d of details) {
      const delay = d?.retryDelay || d?.retry_delay;
      if (typeof delay === 'string') {
        const sec = Number(String(delay).replace(/s$/i, ''));
        if (Number.isFinite(sec) && sec > 0) return Math.ceil(sec * 1000);
      }
    }
  }
  return 8000;
}

function isRateLimitError(err) {
  const msg = String(err?.message || err || '');
  const code = err?.status || err?.code || err?.error?.code;
  return code === 429 || /RESOURCE_EXHAUSTED|quota|rate.?limit|429/i.test(msg);
}

// POST /api/gemini/text — tarefas de texto não-realtime
app.post('/api/gemini/text', async (req, res) => {
  const started = Date.now();
  try {
    const { action, payload } = req.body || {};
    const p = payload || {};
    const source = (p.text || '').toString();
    if (action === 'translate') {
      const local = lookupLocalPt(source);
      if (local) {
        console.log(`[TRANSLATION RESPONSE] status=200 latency=${Date.now() - started}ms source=local`);
        return res.json({ text: local });
      }
    }
    if (!GEMINI_API_KEY) {
      return res.status(503).json({ error: 'gemini_not_configured', message: 'Gemini não configurado.' });
    }
    let prompt = '';
    if (action === 'translate') {
      prompt = `You are a translation engine. Translate the following German text to Brazilian Portuguese (pt-BR). Reply with ONLY the translation, no quotes, no explanation, no notes.\nGerman: ${source}\nPortuguese:`;
    } else if (action === 'explain') {
      prompt = `You are a German teacher for a Brazilian beginner. In ONE short sentence (max 18 words), explain in Portuguese what the German phrase means or how it's used. No extra text.\nGerman: ${source}\nExplanation:`;
    } else {
      prompt = JSON.stringify({ action, payload }).slice(0, 4000);
    }
    const r = await generateText(prompt);
    if (action === 'translate') {
      console.log(`[TRANSLATION RESPONSE] status=200 latency=${Date.now() - started}ms source=api`);
    }
    res.json({ text: r || '' });
  } catch (err) {
    console.error('[gemini] text error:', err?.message || err);
    const local = lookupLocalPt(req.body?.payload?.text || '');
    if (local) {
      console.log(`[TRANSLATION RESPONSE] status=200 latency=${Date.now() - started}ms source=local_fallback`);
      return res.json({ text: local });
    }
    if (isRateLimitError(err)) {
      const retryAfterMs = extractRetryAfterMs(err);
      console.log(`[TRANSLATION ERROR] status=429 reason=TRANSLATION_RATE_LIMIT retryAfterMs=${retryAfterMs}`);
      res.setHeader('Retry-After', String(Math.ceil(retryAfterMs / 1000)));
      return res.status(429).json({
        error: 'TRANSLATION_RATE_LIMIT',
        retryAfterMs,
        message: 'Quota Gemini esgotada temporariamente.',
      });
    }
    const msg = String(err?.message || err || '');
    if (/400|INVALID_ARGUMENT/i.test(msg)) {
      return res.status(400).json({ error: 'TRANSLATION_BAD_REQUEST', message: 'Pedido inválido.' });
    }
    console.log(`[TRANSLATION ERROR] status=500 reason=text_failed`);
    res.status(500).json({ error: 'TRANSLATION_UNAVAILABLE', message: 'Falha ao traduzir.' });
  }
});

async function generateText(prompt) {
  let lastErr;
  for (const model of TEXT_MODEL_FALLBACKS) {
    try {
      const r = await ai.models.generateContent({ model, contents: prompt });
      const text = (r?.text || '').trim();
      if (text) {
        if (model !== TEXT_MODEL) console.warn(`[gemini] text fallback model=${model}`);
        return text;
      }
    } catch (err) {
      lastErr = err;
      const msg = String(err?.message || err);
      console.warn(`[gemini] text model failed (${model}):`, msg.slice(0, 180));
      // 429: não cascatear modelos (multiplica o gasto de quota)
      if (isRateLimitError(err)) throw err;
      if (!/404|NOT_FOUND|no longer available|not found/i.test(msg)) break;
    }
  }
  throw lastErr || new Error('text_failed');
}

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/api/gemini/live' });

wss.on('connection', (ws, req) => {
  const url = new URL(req.url, `http://localhost`);
  const token = url.searchParams.get('token');
  const s = sessions.get(token);

  if (!s) {
    ws.send(JSON.stringify({ type: 'error', message: 'invalid_or_expired_token' }));
    ws.close(4001);
    console.log(`[ws] connect REJECTED (invalid token ${token.slice(0, 8)})`);
    return;
  }
  if (Date.now() - s.createdAt > TOKEN_TTL_MS) {
    ws.send(JSON.stringify({ type: 'error', message: 'token_expired' }));
    ws.close(4002);
    try { s.session.close(); } catch {}
    sessions.delete(token);
    console.log(`[ws] connect REJECTED (expired token ${token.slice(0, 8)})`);
    return;
  }

  s.clientWs = ws;
  ws.send(JSON.stringify({ type: 'ready' }));
  console.log(`[ws] connect OK (token ${token.slice(0, 8)})`);

  // Kickoff pedagógico — após cliente conectar (evita áudio antes do player estar pronto).
  if (!s.kickoffSent && !s.profile?.skipKickoff) {
    s.kickoffSent = true;
    const profile = s.profile || {};
    try {
      s.session.sendClientContent({
        turns: [{ role: 'user', parts: [{ text: buildSessionKickoff(profile) }] }],
        turnComplete: true,
      });
    } catch {}
  }

  let audioPackets = 0;
  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch { return; }
    try {
      if (msg.type === 'audio' && typeof msg.data === 'string') {
        audioPackets++;
        // Log de RMS (volume) nos primeiros pacotes — diagnóstico de microfone mudo
        if (audioPackets === 1 || audioPackets === 5 || audioPackets === 50 || audioPackets === 100) {
          try {
            const buf = Buffer.from(msg.data, 'base64');
            let sumSq = 0;
            const n = Math.min(buf.length / 2, 2048);
            for (let i = 0; i < n; i++) {
              const s = buf.readInt16LE(i * 2);
              sumSq += s * s;
            }
            const rms = Math.sqrt(sumSq / n);
            console.log(`[ws] audio recv (token ${token.slice(0, 8)}, packets=${audioPackets}, rms=${rms.toFixed(1)})`);
          } catch {
            console.log(`[ws] audio recv (token ${token.slice(0, 8)}, packets=${audioPackets}, rms=ERR)`);
          }
        }
        // A SDK @google/genai espera { data: base64, mimeType }, NÃO um W3C Blob.
        s.session.sendRealtimeInput({
          audio: { data: msg.data, mimeType: 'audio/pcm;rate=16000' },
        });
      } else if (msg.type === 'text' && typeof msg.text === 'string') {
        s.session.sendClientContent({
          turns: [{ role: 'user', parts: [{ text: msg.text }] }],
          turnComplete: true,
        });
      } else if (msg.type === 'interrupt') {
        // Não há API direta de interrupt; o VAD do Gemini interrompe ao detectar voz do usuário.
        ws.send(JSON.stringify({ type: 'interrupted' }));
      }
    } catch (err) {
      ws.send(JSON.stringify({ type: 'error', message: 'send_failed' }));
    }
  });

  ws.on('close', (code, reason) => {
    console.log(`[ws] close (token ${token.slice(0, 8)}, code=${code}, reason=${reason?.toString() || ''})`);
    // Só encerra a sessão se este WS for o cliente ativo (órfãos de HMR não derrubam a sessão)
    if (s.clientWs === ws) {
      try { s.session.close(); } catch {}
      sessions.delete(token);
    }
  });
});

// PWA estático (produção): serve ../dist no mesmo processo do API/WS
if (fs.existsSync(DIST_PATH)) {
  app.use(express.static(DIST_PATH, { index: false, maxAge: '1h' }));
  app.get(/^\/(?!api\/).*/, (_req, res) => {
    res.sendFile(path.join(DIST_PATH, 'index.html'));
  });
  console.log(`[static] servindo PWA de ${DIST_PATH}`);
}

server.listen(Number(PORT), HOST, () => {
  console.log(`Deutsch Turbo backend em http://${HOST}:${PORT}`);
});
