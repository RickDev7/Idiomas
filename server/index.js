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
  'http://localhost:4196',
  'http://127.0.0.1:4196',
  'http://localhost:4200',
  'http://127.0.0.1:4200',
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
  const known = (profile.knownPhrases || []).slice(0, 8).join('\n');
  const weak = (profile.weakPhrases || []).slice(0, 4).join('\n');
  const opening = profile.openingGerman || '';
  const kind = profile.sessionKind || 'RETURNING_SESSION';
  const zeroActive = profile.zeroLanguageMode === true
    || ((profile.level || '') === 'zero' && profile.zeroLanguageMode !== false);

  // Live: instrução compacta. System instruction longa (≥2.8k) foi medida
  // causando kickoff aceito sem áudio (sessão aberta, 0 chunks).
  const lines = [
    'Você é o DEUTSCH COACH — professor de alemão por voz. Responda SEMPRE em áudio.',
    zeroActive
      ? 'NÍVEL ZERO: explique em português, modele alemão curto, peça produção. Uma frase por vez.'
      : 'Fale alemão por padrão. Use português só para explicar ou quando o aluno não entender.',
    'Ensine antes de exigir. Corrija breve. Não reinicie com Hallo/Wie geht\'s por hábito.',
    'Comece pela ABERTURA escolhida. Faça o aluno falar. Silêncio ≠ erro imediato.',
    `SESSÃO: ${kind} | NÍVEL: ${profile.level || 'zero'} | OBJETIVO: ${profile.goal || 'daily'}`,
    opening ? `ABERTURA (fale isto primeiro):\n${opening}` : '',
    profile.sessionTopic ? `TEMA: ${profile.sessionTopic}` : '',
    profile.lastTopic ? `ÚLTIMO TEMA: ${profile.lastTopic}` : '',
    profile.profession ? `PROFISSÃO: ${profile.profession}` : '',
    known ? `CONHECIDAS:\n${known}` : '',
    weak ? `FRACAS:\n${weak}` : '',
    profile.memorySummary ? `MEMÓRIA:\n${String(profile.memorySummary).slice(0, 600)}` : '',
    profile.teacherDirective ? String(profile.teacherDirective).slice(0, 800) : '',
    profile.coachContext ? `CONTEXTO:\n${String(profile.coachContext).slice(0, 500)}` : '',
    profile.pedagogicalAction
      ? `AÇÃO: ${profile.pedagogicalAction}${profile.targetPhrase ? ` | alvo: ${profile.targetPhrase}` : ''}`
      : '',
    profile.targetPhrasePt ? `SIGNIFICADO: ${profile.targetPhrasePt}` : '',
  ];
  return lines.filter(Boolean).join('\n');
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

function isGreetingLike(s) {
  if (!s || typeof s !== 'string') return false;
  const t = s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[''`´]/g, '')
    .replace(/[!?.…,;:"""«»]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!t) return false;
  if (/^(guten morgen|guten tag|guten abend|gute nacht)(\s|$)/.test(t)) return true;
  if (/wie geht(s| es dir| es ihnen)?(\s|$)/.test(t)) return true;
  if (/primeira microaula/.test(t) && /guten morgen/.test(t)) return true;
  if (/guten morgen|guten tag|guten abend|gute nacht/.test(t) && /ultima pergunta|proximo passo|objetivo incompleto/.test(t)) {
    return true;
  }
  return false;
}

/** Se a abertura pedagógica não é saudação, não reinjetar saudações da continuidade. */
function continuityConflictsWithOpening(line, openingGerman) {
  const opening = (openingGerman || '').trim();
  if (!opening || isGreetingLike(opening)) return false;
  if (isGreetingLike(line)) return true;
  if (/guten (morgen|tag|abend)|gute nacht/i.test(line) && !/guten/i.test(opening)) return true;
  if (/primeira microaula\s*[—\-–]?\s*guten morgen/i.test(line)) return true;
  return false;
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
  ].filter(Boolean).filter((line) => !continuityConflictsWithOpening(line, opening));

  if (zeroActive) {
    const kick = [
      '[INSTRUÇÃO INTERNA — não leia isto em voz alta]',
      'ZERO LANGUAGE MODE — FALE AGORA em áudio (obrigatório).',
      'Ordem desta abertura: 1) significado em português, 2) modelo em alemão, 3) diga "Agora você".',
      opening ? `Frase-alvo: "${opening}"` : '',
      profile.targetPhrasePt ? `Significado: ${profile.targetPhrasePt}` : '',
      ...memoryBits,
      'NÃO reinicie com "Hallo! Wie geht es dir?" por hábito.',
      'Só espere o aluno DEPOIS de terminar essa fala. Não fique em silêncio no início.',
      profile.orchestratorKickoff || '',
    ].filter(Boolean).join('\n');
    if (process.env.NODE_ENV !== 'production' || process.env.LOG_SESSION === '1' || process.env.TARGET_TRACE === '1') {
      console.log(
        `[TARGET_TRACE] KICKOFF opening=${JSON.stringify(opening).slice(0, 80)} ` +
          `hasGuten=${/Guten (Morgen|Tag|Abend)|Gute Nacht/i.test(kick)} kickLen=${kick.length}`,
      );
    }
    return kick;
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

function maybeSendKickoff(entry) {
  if (!entry || entry.kickoffSent || entry.profile?.skipKickoff) return;
  if (!entry.setupComplete) return;
  if (!entry.clientWs || entry.clientWs.readyState !== entry.clientWs.OPEN) return;
  if (!entry.session) return;
  entry.kickoffSent = true;
  const profile = entry.profile || {};
  const kick = buildSessionKickoff(profile);
  try {
    entry.session.sendClientContent({
      turns: [{ role: 'user', parts: [{ text: kick }] }],
      turnComplete: true,
    });
    console.log(
      `[KICKOFF] sent token=${entry.token?.slice(0, 8)} level=${profile.level || '?'} ` +
        `zero=${!!profile.zeroLanguageMode} kickLen=${kick.length} sysReady=1`,
    );
    if (process.env.NODE_ENV !== 'production' || process.env.TARGET_FLOW === '1' || process.env.TARGET_TRACE === '1') {
      console.log('[TARGET_FLOW] BACKEND_KICKOFF', {
        openingGerman: profile.openingGerman || null,
        targetPhrase: profile.targetPhrase || null,
        actionReason: profile.actionReason || null,
        nextStep: profile.nextStep || null,
        lastQuestion: profile.lastQuestion || null,
        kickoffHasGutenAbend: /Guten Abend/i.test(kick),
        kickSnippet: kick.split('\n').slice(0, 8).join(' | ').slice(0, 400),
      });
    }
  } catch (err) {
    entry.kickoffSent = false;
    console.error(`[KICKOFF] fail token=${entry.token?.slice(0, 8)}:`, String(err?.message || err).slice(0, 200));
    try {
      entry.clientWs.send(JSON.stringify({ type: 'error', message: 'kickoff_failed' }));
    } catch {
      /* ignore */
    }
  }
}

function sendReadyOnce(entry) {
  if (!entry || entry.readySent) return;
  const ws = entry.clientWs;
  if (!ws || ws.readyState !== ws.OPEN) return;
  entry.readySent = true;
  ws.send(JSON.stringify({ type: 'ready' }));
  console.log(`[ws] ready token=${entry.token?.slice(0, 8)}`);
}

async function ensureGeminiSession(entry) {
  if (entry.session || entry.connecting) return;
  entry.connecting = true;
  const token = entry.token;
  const profile = entry.profile || {};
  try {
    const sys = buildSystemInstruction(profile);
    console.log(
      `[SESSION] create token=${token.slice(0, 8)} level=${profile.level || '?'} ` +
        `zero=${!!profile.zeroLanguageMode} sysLen=${sys.length}`,
    );
    const session = await ai.live.connect({
      model: MODEL,
      callbacks: {
        onmessage: (e) => handleLiveMessage(entry, e),
        onerror: (err) => {
          console.error(
            `[gemini] onerror token=${token.slice(0, 8)}:`,
            String(err?.message || err).slice(0, 240),
          );
          const ws = entry.clientWs;
          if (ws && ws.readyState === ws.OPEN) {
            ws.send(JSON.stringify({ type: 'error', message: 'live_error' }));
          }
        },
        onclose: (ev) => {
          console.log(
            `[gemini] session closed (token ${token.slice(0, 8)}) code=${ev?.code ?? '?'} reason=${String(ev?.reason || '').slice(0, 120)}`,
          );
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
        // Gemini 3.1 Flash Live: languageCode + voz Aoede foram medidos
        // causando setupComplete + kickoff sem nenhum chunk de áudio.
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
        },
        systemInstruction: sys,
      },
    });
    entry.session = session;
    logSession(profile);
  } catch (err) {
    console.error(`[gemini] connect fail token=${token.slice(0, 8)}:`, String(err?.message || err).slice(0, 240));
    const ws = entry.clientWs;
    if (ws && ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify({ type: 'error', message: 'session_failed' }));
      try { ws.close(); } catch {}
    }
    sessions.delete(token);
  } finally {
    entry.connecting = false;
  }
}

// POST /api/gemini/token — emite token efêmero; sessão Gemini sobe no WebSocket (após setupComplete).
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
      setupComplete: false,
      readySent: false,
      connecting: false,
    };
    sessions.set(token, entry);

    // Limpa tickets sem cliente.
    setTimeout(() => {
      const s = sessions.get(token);
      if (s && !s.clientWs) {
        try { s.session?.close(); } catch {}
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
    entry.setupComplete = true;
    console.log(`[gemini] setupComplete token=${entry.token?.slice(0, 8)}`);
    sendReadyOnce(entry);
    maybeSendKickoff(entry);
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
    console.log(`[ws] connect REJECTED (invalid token ${String(token || '').slice(0, 8)})`);
    return;
  }
  if (Date.now() - s.createdAt > TOKEN_TTL_MS) {
    ws.send(JSON.stringify({ type: 'error', message: 'token_expired' }));
    ws.close(4002);
    try { s.session?.close(); } catch {}
    sessions.delete(token);
    console.log(`[ws] connect REJECTED (expired token ${token.slice(0, 8)})`);
    return;
  }

  s.clientWs = ws;
  console.log(`[ws] connect OK (token ${token.slice(0, 8)})`);

  // Sessão Gemini sobe aqui — ready + kickoff só após setupComplete.
  void ensureGeminiSession(s).then(() => {
    if (s.setupComplete) {
      sendReadyOnce(s);
      maybeSendKickoff(s);
    }
  });

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
              const sample = buf.readInt16LE(i * 2);
              sumSq += sample * sample;
            }
            const rms = Math.sqrt(sumSq / n);
            console.log(`[ws] audio recv (token ${token.slice(0, 8)}, packets=${audioPackets}, rms=${rms.toFixed(1)})`);
          } catch {
            console.log(`[ws] audio recv (token ${token.slice(0, 8)}, packets=${audioPackets}, rms=ERR)`);
          }
        }
        if (!s.session) return;
        // A SDK @google/genai espera { data: base64, mimeType }, NÃO um W3C Blob.
        s.session.sendRealtimeInput({
          audio: { data: msg.data, mimeType: 'audio/pcm;rate=16000' },
        });
      } else if (msg.type === 'text' && typeof msg.text === 'string') {
        if (!s.session) return;
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
      try { s.session?.close(); } catch {}
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
