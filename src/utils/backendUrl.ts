/** URL do backend Gemini Live — sem fallback silencioso para localhost em produção. */

function isLoopbackUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.hostname === 'localhost' || u.hostname === '127.0.0.1' || u.hostname === '[::1]';
  } catch {
    return /localhost|127\.0\.0\.1/i.test(url);
  }
}

function assertProductionBackendUrl(url: string): void {
  if (!url) {
    throw new Error(
      'CONFIGURAÇÃO: VITE_BACKEND_URL ausente em produção. Defina a URL HTTPS pública do backend Gemini Live na Vercel.',
    );
  }
  if (isLoopbackUrl(url)) {
    throw new Error(
      'CONFIGURAÇÃO: VITE_BACKEND_URL não pode apontar para localhost em produção. Use a URL HTTPS/WSS pública do backend.',
    );
  }
  if (!/^https:\/\//i.test(url)) {
    throw new Error(
      'CONFIGURAÇÃO: VITE_BACKEND_URL em produção deve usar HTTPS (ex.: https://seu-backend.up.railway.app).',
    );
  }
}

/** URL base do backend Gemini. Dev: localhost ok. Prod: exige VITE_BACKEND_URL HTTPS. */
export function resolveBackendUrl(explicit?: string): string {
  if (explicit) {
    const u = explicit.replace(/\/$/, '');
    if (import.meta.env.PROD) assertProductionBackendUrl(u);
    return u;
  }
  const env = (import.meta.env.VITE_BACKEND_URL as string | undefined)?.trim();
  if (import.meta.env.PROD) {
    const u = (env || '').replace(/\/$/, '');
    assertProductionBackendUrl(u);
    return u;
  }
  return (env || 'http://localhost:8787').replace(/\/$/, '');
}

/** Base HTTP para fetch. */
export function httpBackendBase(backendUrl: string): string {
  if (backendUrl) {
    if (import.meta.env.PROD) assertProductionBackendUrl(backendUrl);
    return backendUrl;
  }
  if (import.meta.env.PROD) {
    throw new Error('CONFIGURAÇÃO: backend URL vazia em produção.');
  }
  return 'http://localhost:8787';
}

/** Base WS (ws/wss) a partir da URL HTTP do backend. */
export function wsBackendBase(backendUrl: string): string {
  return httpBackendBase(backendUrl).replace(/^http/, 'ws');
}
