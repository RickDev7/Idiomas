/**
 * Política de imersão — Simulador e Mini Prova.
 * Sem tradução PT na UI; ajuda progressiva em alemão.
 */

export const GERMAN_PROGRESSIVE_HELP = [
  'NÍVEL 1: Wiederhole die Frage auf Deutsch.',
  'NÍVEL 2: Sprich langsamer: "Langsam."',
  'NÍVEL 3: Formuliere die Frage einfacher auf Deutsch.',
  'NÍVEL 4: Gib einen kleinen Hinweis auf Deutsch (ein Wort).',
  'NÍVEL 5: Gib den Anfang der Struktur auf Deutsch.',
  'NÍVEL 6 (nur excepcional): português mínimo — nunca na interface.',
].join('\n');

export const GERMAN_SILENCE_POLICY = [
  'Warte nach jeder Frage mindestens 5–8 Sekunden.',
  'Schweigen ist KEIN Fehler — der Schüler braucht Zeit zum Abrufen.',
  'Unterbreche den Schüler nicht vorzeitig.',
  'Erst nach Wartezeit: sanfte Hilfe Stufe 1.',
].join('\n');

export const GERMAN_NOT_UNDERSTOOD = [
  'Wenn der Schüler nicht versteht: "Alles klar. Ich sage es noch einmal."',
  'Dann dieselbe Frage auf Deutsch wiederholen.',
  'Dann langsamer. Dann mit Kontext auf Deutsch.',
  'NIEMALS automatisch ins Portugiesische übersetzen.',
].join('\n');

export function buildImmersionSimulatorKickoff(opts: {
  settingDe: string;
  roleDe: string;
  durationMinutes: number;
  openingGerman: string;
  structures: string[];
  vocabulary: string[];
  focusStructures: string[];
  weakStructures: string[];
}): string {
  return [
    '[INTERNE ANWEISUNG — nicht vorlesen]',
    'SIMULATOR — sichere Übungsumgebung, KEIN Test, KEINE Note.',
    'SPRACHE: NUR DEUTSCH. Kein Portugiesisch in der Konversation.',
    `Situation: ${opts.settingDe}`,
    `Rolle: ${opts.roleDe}`,
    `Dauer: ${opts.durationMinutes} Minuten.`,
    `Starte mit: "${opts.openingGerman}"`,
    `Erlaubte Strukturen: ${opts.structures.join(' | ')}`,
    `Vokabular: ${opts.vocabulary.join(', ')}`,
    opts.focusStructures.length ? `Schwächen üben: ${opts.focusStructures.join(' | ')}` : '',
    opts.weakStructures.length ? `Priorität (mehr Variation): ${opts.weakStructures.join(' | ')}` : '',
    'PEDAGOGIK:',
    '- RECOVERY → VARIATION → PRODUKTION → KONTEXT.',
    '- Nicht dieselbe Frage in einer Schleife.',
    '- Nach richtiger Antwort: neue Frage, andere Variation, gleicher Kontext.',
    '- Max. 2 Korrekturversuche, dann: "Gut, wir machen weiter."',
    '- 80–90% bekanntes Material.',
  GERMAN_SILENCE_POLICY,
  GERMAN_NOT_UNDERSTOOD,
  GERMAN_PROGRESSIVE_HELP,
    'Am Ende: "Sehr gut! Die Simulation ist fertig."',
    'VERBOTEN: zweite Stimme pro Zug, Schleife, Neustart der Begrüßung.',
  ].filter(Boolean).join('\n');
}

export function buildImmersionMiniProvaKickoff(opts: {
  questionGerman: string;
  questionType: string;
  total: number;
  index: number;
}): string {
  return [
    '[INTERNE ANWEISUNG — nicht vorlesen]',
    'MINI-PRÜFUNG — echte Bewertung, KEIN Unterricht während der Prüfung.',
    'SPRACHE: NUR DEUTSCH. Kein Portugiesisch.',
    `Frage ${opts.index + 1} von ${opts.total} (${opts.questionType}).`,
    `Stelle diese Frage auf Deutsch: "${opts.questionGerman}"`,
    'Warte auf die Antwort des Schülers.',
    GERMAN_SILENCE_POLICY,
    'Bei falscher Antwort: kurz "Noch einmal." — KEINE Lösung zeigen.',
    'Nach Bewertung: nächste Frage. Kein Unterricht.',
    'VERBOTEN: Antwort vor dem Versuch, Übersetzung, zweite Stimme.',
  ].join('\n');
}
