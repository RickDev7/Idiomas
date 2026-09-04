/**
 * Espelho do kickoff enviado ao Gemini (server/index.js buildSessionKickoff).
 * Usado em testes para provar o payload FINAL — não só plan.target.
 * Manter alinhado com o backend.
 */
import { isScriptedGreeting } from '@/services/teacher/sessionContinuity/SessionOpeningEngine';

export type KickoffProfileInput = {
  openingGerman?: string;
  openingStrategy?: string;
  sessionKind?: string;
  zeroLanguageMode?: boolean;
  level?: string;
  skipKickoff?: boolean;
  lastQuestion?: string;
  lastUserAnswer?: string;
  unfinishedGoal?: string;
  nextStep?: string;
  lastTopic?: string;
  recentMistakes?: string[];
  targetPhrasePt?: string;
  orchestratorKickoff?: string;
  simulatorMode?: boolean;
  miniProvaMode?: boolean;
};

/** Continuidade com saudação NÃO pode sobrescrever target explícito. */
export function continuityLineConflictsWithOpening(line: string, openingGerman: string): boolean {
  const opening = (openingGerman || '').trim();
  if (!opening) return false;
  if (isScriptedGreeting(opening)) return false;
  if (isScriptedGreeting(line)) return true;
  // Linhas de continuidade: "Última pergunta: Guten Abend." / "Objetivo incompleto: …"
  if (/guten (morgen|tag|abend)|gute nacht/i.test(line) && !opening.toLowerCase().includes('guten')) {
    return true;
  }
  if (/primeira microaula\s*[—\-–]?\s*guten morgen/i.test(line)) return true;
  if (/próximo passo:\s*.*guten (morgen|tag|abend)/i.test(line)) return true;
  if (/última pergunta:\s*.*guten (morgen|tag|abend)/i.test(line)) return true;
  if (/objetivo incompleto:\s*.*guten (morgen|tag|abend)/i.test(line)) return true;
  return false;
}

function memoryBits(profile: KickoffProfileInput): string[] {
  const opening = profile.openingGerman || '';
  const bits = [
    profile.lastQuestion ? `Última pergunta: ${profile.lastQuestion}` : '',
    profile.lastUserAnswer ? `Última resposta do aluno: ${profile.lastUserAnswer}` : '',
    profile.unfinishedGoal ? `Objetivo incompleto: ${profile.unfinishedGoal}` : '',
    profile.nextStep ? `Próximo passo: ${profile.nextStep}` : '',
    profile.lastTopic ? `Tema: ${profile.lastTopic}` : '',
    Array.isArray(profile.recentMistakes) && profile.recentMistakes.length
      ? `Erros: ${profile.recentMistakes.slice(0, 3).join(' | ')}`
      : '',
  ].filter(Boolean);
  return bits.filter((line) => !continuityLineConflictsWithOpening(line, opening));
}

/** Replica server/index.js buildSessionKickoff (ramos lesson/zero — sem simulador). */
export function buildSessionKickoffFromProfile(profile: KickoffProfileInput): string {
  if (profile.simulatorMode || profile.miniProvaMode) {
    return profile.orchestratorKickoff
      || [
        '[INSTRUÇÃO INTERNA — não leia isto em voz alta]',
        profile.openingGerman ? `Abertura: "${profile.openingGerman}"` : '',
      ].filter(Boolean).join('\n');
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
  const bits = memoryBits(profile);

  if (zeroActive) {
    return [
      '[INSTRUÇÃO INTERNA — não leia isto em voz alta]',
      'ZERO LANGUAGE MODE — FALE AGORA em áudio (obrigatório).',
      'Ordem desta abertura: 1) significado em português, 2) modelo em alemão, 3) diga "Agora você".',
      opening ? `Frase-alvo: "${opening}"` : '',
      profile.targetPhrasePt ? `Significado: ${profile.targetPhrasePt}` : '',
      ...bits,
      'NÃO reinicie com "Hallo! Wie geht es dir?" por hábito.',
      'Só espere o aluno DEPOIS de terminar essa fala. Não fique em silêncio no início.',
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
      ...bits,
      'PROIBIDO nesta abertura: "Guten Morgen! Wie geht\'s?", "Guten Morgen! Wie geht es dir?", "Hallo! Wie geht es dir?" — a menos que a abertura acima seja exatamente isso.',
      'NÃO comece com "Hallo." nem "Wie geht es dir?" a menos que a abertura acima seja exatamente isso.',
      'Depois continue a aula a partir dela e faça o aluno falar.',
      profile.orchestratorKickoff || '',
    ].filter(Boolean).join('\n');
  }
  return [
    '[INSTRUÇÃO INTERNA — não leia isto em voz alta]',
    'Comece a sessão em alemão de forma natural, usando a memória compacta do aluno.',
    ...bits,
    'NÃO use o roteiro "Hallo" + "Wie geht es dir?".',
    'Faça o aluno falar.',
    profile.orchestratorKickoff || '',
  ].filter(Boolean).join('\n');
}
