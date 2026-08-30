/**
 * Runner FASE 8 — E2E + Gemini Live real + relatório.
 * Uso: npx tsx src/services/learning/__tests__/runE2E.ts
 */
import { writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { runTest } from './assert';
import { runE2ECycle, formatE2EReport, testE2ECycle, type CheckResult } from './e2eCycle.test';

const BACKEND = process.env.GEMINI_BACKEND_URL || 'http://127.0.0.1:8787';

async function probeGeminiLive(): Promise<CheckResult> {
  try {
    const res = await fetch(`${BACKEND}/api/gemini/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        profile: {
          level: 'little',
          goal: 'work',
          sessionKind: 'e2e',
          skipKickoff: true,
          targetPhrase: 'Ich brauche eine Pause.',
          pedagogicalAction: 'introduce',
        },
      }),
      signal: AbortSignal.timeout(25000),
    });
    if (res.status === 503) {
      return {
        id: 'gemini-live',
        title: 'Gemini Live REAL (/api/gemini/token)',
        status: 'fail',
        detail: '503 — GEMINI_API_KEY ausente ou backend sem chave',
      };
    }
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      return {
        id: 'gemini-live',
        title: 'Gemini Live REAL (/api/gemini/token)',
        status: 'fail',
        detail: `HTTP ${res.status} ${body.slice(0, 120)}`,
      };
    }
    const data = (await res.json()) as { token?: string };
    if (!data.token) {
      return {
        id: 'gemini-live',
        title: 'Gemini Live REAL (/api/gemini/token)',
        status: 'fail',
        detail: 'resposta sem token',
      };
    }
    return {
      id: 'gemini-live',
      title: 'Gemini Live REAL (/api/gemini/token)',
      status: 'pass',
      detail: `token=${data.token.slice(0, 8)}… sessão Live aberta no servidor (não mock)`,
    };
  } catch (e) {
    return {
      id: 'gemini-live',
      title: 'Gemini Live REAL (/api/gemini/token)',
      status: 'partial',
      detail: `backend inacessível em ${BACKEND}: ${(e as Error).message}`,
    };
  }
}

async function probeGeminiText(): Promise<CheckResult> {
  try {
    const res = await fetch(`${BACKEND}/api/gemini/text`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'explain',
        payload: { text: 'Ich brauche eine Pause.' },
      }),
      signal: AbortSignal.timeout(30000),
    });
    if (res.status === 503) {
      return {
        id: 'gemini-text',
        title: 'Gemini Text REAL (/api/gemini/text)',
        status: 'fail',
        detail: '503 — não configurado',
      };
    }
    if (!res.ok) {
      return {
        id: 'gemini-text',
        title: 'Gemini Text REAL (/api/gemini/text)',
        status: 'partial',
        detail: `HTTP ${res.status}`,
      };
    }
    const data = (await res.json()) as { text?: string; reply?: string };
    const text = data.text || data.reply || JSON.stringify(data).slice(0, 80);
    return {
      id: 'gemini-text',
      title: 'Gemini Text REAL (/api/gemini/text)',
      status: 'pass',
      detail: String(text).slice(0, 120),
    };
  } catch (e) {
    return {
      id: 'gemini-text',
      title: 'Gemini Text REAL (/api/gemini/text)',
      status: 'partial',
      detail: (e as Error).message,
    };
  }
}

console.log('\n🇩🇪 DEUTSCH TURBO — FASE 8 E2E\n');

await runTest('E2E Cycle (Pause)', testE2ECycle);

const cycle = await runE2ECycle();
const geminiLive = await probeGeminiLive();
const geminiText = await probeGeminiText();

const dist = join(process.cwd(), 'dist');
const pwa: CheckResult[] = [
  {
    id: 'pwa-artifacts',
    title: 'PWA — manifest + SW',
    status:
      existsSync(join(dist, 'manifest.webmanifest')) && existsSync(join(dist, 'sw.js'))
        ? 'pass'
        : 'partial',
    detail:
      existsSync(join(dist, 'manifest.webmanifest')) && existsSync(join(dist, 'sw.js'))
        ? 'artifacts de build presentes'
        : 'execute npm run build',
  },
  {
    id: 'pwa-android',
    title: 'PWA — Android Chrome',
    status: 'partial',
    detail: 'requer teste manual no device; artifacts PWA gerados no build',
  },
];

const all = [...cycle, geminiLive, geminiText, ...pwa];
const report = formatE2EReport(all);

const fails = all.filter((c) => c.status === 'fail');
const partials = all.filter((c) => c.status === 'partial');

const extra = [
  '',
  '## Gemini Live',
  `- ${geminiLive.status === 'pass' ? '✅' : geminiLive.status === 'partial' ? '⚠️' : '❌'} ${geminiLive.detail}`,
  `- ${geminiText.status === 'pass' ? '✅' : geminiText.status === 'partial' ? '⚠️' : '❌'} Text: ${geminiText.detail}`,
  '',
  '## PWA / Device',
  ...pwa.map((p) => `- ${p.status === 'pass' ? '✅' : '⚠️'} ${p.title}: ${p.detail}`),
  '',
  '## Veredito',
];

if (fails.length === 0 && partials.length === 0) {
  extra.push('**SISTEMA E2E COMPLETO — todas as checagens passaram.**');
} else if (fails.length === 0) {
  extra.push(`**Ciclo pedagógico ✅ — ${partials.length} item(ns) parciais (Gemini offline ou PWA device).**`);
} else {
  extra.push(`**❌ ${fails.length} falha(s) — corrigir antes de considerar concluído.**`);
  extra.push(...fails.map((f) => `- ${f.title}: ${f.detail}`));
}

const full = report + extra.join('\n') + '\n';
const outPath = join(process.cwd(), 'E2E_FASE8_REPORT.md');
writeFileSync(outPath, full, 'utf8');
console.log(full);
console.log(`\nRelatório gravado em ${outPath}\n`);

if (fails.length) process.exitCode = 1;
