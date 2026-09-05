/**
 * Rotas e intenções de navegação — uma fonte para CTAs e fallbacks.
 * Separar “ir para página X” de “iniciar sessão Live”.
 */

import type { NavigateFunction } from 'react-router-dom';

export const APP_ROUTES = {
  home: '/',
  onboarding: '/onboarding',
  aprender: '/aprender',
  conversar: '/conversar',
  chunks: '/chunks',
  situacoes: '/situacoes',
  lernweg: '/lernweg',
  simulador: '/simulador',
  simuladorResultado: '/simulador/resultado',
  miniProva: '/mini-prova',
  miniProvaResultado: '/mini-prova/resultado',
  sessao: '/sessao',
  sessaoConcluida: '/sessao/concluida',
  revisar: '/revisar',
  progresso: '/progresso',
  jornada: '/jornada',
  /** Detalhe de módulo: /curso/:level/:moduleId */
  cursoModule: '/curso/:level/:moduleId',
  conquistas: '/conquistas',
  perfil: '/perfil',
  configuracoes: '/configuracoes',
} as const;

export type AppRoute = (typeof APP_ROUTES)[keyof typeof APP_ROUTES];

/** Título do chrome da sessão Live — NÃO rotular treino/review como Conversar. */
export function sessionChromeTitle(type: string | null | undefined): string {
  switch ((type || 'lesson').toLowerCase()) {
    case 'free':
      return 'Conversar';
    case 'review':
      return 'Revisar';
    case 'simulator':
      return 'Simulador';
    case 'miniprova':
      return 'Mini Prova';
    case 'assessment':
      return 'Avaliação';
    case 'first':
    case 'lesson':
    default:
      return 'Treino';
  }
}

/** Voltar com fallback coerente (sem default /conversar). */
export function navigateBack(navigate: NavigateFunction, fallback: string = APP_ROUTES.home): void {
  if (typeof window === 'undefined') {
    navigate(fallback);
    return;
  }
  const idx = (window.history.state as { idx?: number } | null)?.idx;
  if (typeof idx === 'number' && idx > 0) {
    navigate(-1);
    return;
  }
  navigate(fallback);
}

/** CTAs de navegação simples — nunca /conversar. */
export function goAprender(navigate: NavigateFunction): void {
  navigate(APP_ROUTES.aprender);
}

export function goJornada(navigate: NavigateFunction): void {
  navigate(APP_ROUTES.jornada);
}

export function goHome(navigate: NavigateFunction): void {
  navigate(APP_ROUTES.home);
}

export function goChunks(navigate: NavigateFunction): void {
  navigate(APP_ROUTES.chunks);
}

export function goRevisar(navigate: NavigateFunction): void {
  navigate(APP_ROUTES.revisar);
}

export function goProgresso(navigate: NavigateFunction): void {
  navigate(APP_ROUTES.progresso);
}

export function goConversar(navigate: NavigateFunction): void {
  navigate(APP_ROUTES.conversar);
}

export const BOTTOM_NAV_ITEMS = [
  { to: APP_ROUTES.home, end: true as const, key: 'start' },
  { to: APP_ROUTES.jornada, end: false as const, key: 'course' },
  { to: APP_ROUTES.conversar, end: false as const, key: 'talk' },
  { to: APP_ROUTES.revisar, end: false as const, key: 'review' },
] as const;
