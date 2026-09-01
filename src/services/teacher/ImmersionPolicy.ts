/**
 * Política de imersão — Simulador e Mini Prova.
 * Simulador = conversa natural. Mini Prova = avaliação objetiva.
 */
import type { SimulatorContext } from '@/services/teacher/SimulatorTypes';

export const GERMAN_PROGRESSIVE_HELP = [
  'Stufe 1: Wiederhole die Frage auf Deutsch.',
  'Stufe 2: Sprich langsamer: "Langsam."',
  'Stufe 3: Formuliere die Frage einfacher auf Deutsch.',
  'Stufe 4: Gib einen kleinen Hinweis auf Deutsch (ein Wort).',
  'Stufe 5: Gib den Anfang der Struktur auf Deutsch.',
  'Stufe 6 (nur extrem): português mínimo — nie in der UI.',
].join('\n');

export const GERMAN_SILENCE_POLICY = [
  'Warte nach jeder Frage mindestens 5–8 Sekunden.',
  'Schweigen ist KEIN Fehler — der Schüler braucht Zeit zum Abrufen.',
  'Unterbreche den Schüler nicht vorzeitig.',
  'Erst nach Wartezeit: sanfte Hilfe Stufe 1.',
].join('\n');

export const SIMULATOR_FORBIDDEN = [
  'VERBOTEN (Unterrichtssprache):',
  '- "Jetzt lernen wir..." / "Wiederhole..." / "Die richtige Antwort ist..."',
  '- "Das bedeutet..." / "Lass uns diese Struktur üben..." / "Sag nach:"',
  '- Modell vor der Antwort des Schülers zeigen',
  '- Portugiesisch, Übersetzung, Erklärung',
  '- Korrektur-Schleife wie in der Lektion',
].join('\n');

export const MINI_PROVA_FORBIDDEN = [
  'VERBOTEN während der Prüfung:',
  '- Antwort zeigen, Struktur zeigen, Satz vervollständigen',
  '- Nach Fehler unterrichten oder erklären',
  '- Dieselbe Frage wiederholen oder zurückgehen',
  '- Portugiesisch, Übersetzung, Hilfe mit Lösung',
].join('\n');

export function buildImmersionSimulatorKickoff(opts: {
  settingDe: string;
  roleDe: string;
  durationMinutes: number;
  openingGerman: string;
  structures: string[];
  vocabulary: string[];
  conversationHints: string[];
}): string {
  return [
    '[INTERNE ANWEISUNG — nicht vorlesen]',
    'SIMULATOR — NATÜRLICHES GESPRÄCH. KEIN Unterricht. KEIN Test. KEINE Note.',
    'SPRACHE: NUR DEUTSCH.',
    `Situation: ${opts.settingDe}`,
    `Rolle: ${opts.roleDe}`,
    `Dauer: ca. ${opts.durationMinutes} Minuten.`,
    `Starte SOFORT mit einer natürlichen Frage: "${opts.openingGerman}"`,
    'GESPRÄCHSFLUSS (nicht Lektion):',
    '- Situation → Frage → Schüler antwortet → kurze Reaktion → neue Frage/Situation.',
    '- Reagiere auf das, was der Schüler sagt ("Gut!", "Ah, verstehe!", "Und du?").',
    '- Wechsle Kontexte und Formulierungen — nie dieselbe Frage zweimal hintereinander.',
    opts.conversationHints.length
      ? `Mögliche Richtungen (variieren, nicht aufzählen): ${opts.conversationHints.join(' | ')}`
      : '',
    `Bekanntes Material: ${opts.structures.slice(0, 10).join(' | ')}`,
    `Vokabular: ${opts.vocabulary.join(', ')}`,
    'Schwächen natürlich einbauen — NICHT ankündigen dass du übst.',
    SIMULATOR_FORBIDDEN,
    GERMAN_SILENCE_POLICY,
    GERMAN_PROGRESSIVE_HELP,
    'Am Ende: "Sehr gut! Die Simulation ist fertig."',
    'VERBOTEN: zweite Stimme pro Zug, Endlosschleife, Begrüßung neu starten.',
  ].filter(Boolean).join('\n');
}

export function buildSimulatorDirective(ctx: SimulatorContext): string {
  return [
    '=== SIMULATOR — GESPRÄCHSMODUS ===',
    `Situation: ${ctx.scenario.settingDe}`,
    `Thema: ${ctx.scenario.titleDe}`,
    'MODUS: freies Gespräch auf Deutsch — KEIN Unterricht.',
    'Nach jeder Antwort: kurz reagieren, dann neue Frage in neuem Kontext.',
    'Schwächen durch Situationen abfragen, nicht durch Wiederholung derselben Frage.',
    SIMULATOR_FORBIDDEN,
    '=== ENDE SIMULATOR ===',
  ].join('\n');
}

export function buildSimulatorCoachContext(ctx: SimulatorContext, hints: string[]): string {
  return [
    'INTERNE GESPRÄCHSPLANUNG (nicht vorlesen):',
    `Situation: ${ctx.scenario.settingDe}`,
    hints.length ? `Nächste Fragen-Richtungen: ${hints.join(' | ')}` : '',
    `Strukturen (natürlich einbauen): ${ctx.focusStructures.join(' | ')}`,
    'NICHT sagen dass Schwächen geübt werden.',
  ].filter(Boolean).join('\n');
}

export function buildSimulatorTurnNudge(opts: {
  userSaid: string;
  nextHint: string;
  settingDe: string;
}): string {
  return [
    '[INTERNE ANWEISUNG — nicht vorlesen]',
    'SIMULATOR — Gespräch fortsetzen, KEIN Unterricht.',
    `Schüler sagte: "${opts.userSaid}"`,
    '1) Reagiere kurz und natürlich auf Deutsch (max. 1 Satz).',
    '2) Stelle eine NEUE Frage — andere Formulierung, anderer Kontext.',
    opts.nextHint ? `Richtung: ${opts.settingDe} ${opts.nextHint}` : '',
    SIMULATOR_FORBIDDEN,
    'Erlaubt: "Gut!", "Ah!", "Und?", "Was noch?", natürliche Follow-ups.',
  ].filter(Boolean).join('\n');
}

export function buildSimulatorHelpNudge(supportLevel: number, lastQuestion: string | null): string {
  const level = Math.min(5, Math.max(1, supportLevel));
  const lines = [
    '[INTERNE ANWEISUNG — nicht vorlesen]',
    'SIMULATOR — Hilfe ohne Unterricht.',
    `Hilfestufe: ${level}.`,
    lastQuestion ? `Letzte Frage: "${lastQuestion}"` : '',
  ];
  if (level <= 1) lines.push('Wiederhole die letzte Frage auf Deutsch.');
  else if (level === 2) lines.push('Sage "Langsam." und wiederhole die Frage langsamer.');
  else if (level === 3) lines.push('Formuliere die Frage einfacher auf Deutsch.');
  else if (level === 4) lines.push('Gib EIN Wort als Hinweis auf Deutsch — keine ganze Antwort.');
  else lines.push('Gib nur den ANFANG der Struktur auf Deutsch — nicht die volle Antwort.');
  lines.push('KEIN Portugiesisch. KEIN "Die richtige Antwort ist".');
  return lines.filter(Boolean).join('\n');
}

export function buildImmersionMiniProvaKickoff(opts: {
  questionGerman: string;
  questionType: string;
  total: number;
  index: number;
}): string {
  return [
    '[INTERNE ANWEISUNG — nicht vorlesen]',
    'MINI-PRÜFUNG — objektive Bewertung. KEIN Gespräch. KEIN Unterricht.',
    'SPRACHE: NUR DEUTSCH.',
    `Frage ${opts.index + 1} von ${opts.total}.`,
    `Stelle NUR diese Frage: "${opts.questionGerman}"`,
    'Dann WARTEN. Schweigen ist erlaubt (5–8 Sekunden).',
    'Nach der Antwort: kurz "Danke." oder "Gut." — dann STOP.',
    'Die App stellt die nächste Frage — du unterrichtest NICHT.',
    MINI_PROVA_FORBIDDEN,
    GERMAN_SILENCE_POLICY,
    'VERBOTEN: zweite Stimme, Lösung vor dem Versuch, Übersetzung.',
  ].join('\n');
}

export function buildMiniProvaDirective(total: number): string {
  return [
    '=== MINI-PRÜFUNG — BEWERTUNGSMODUS ===',
    `Gesamt: ${total} Fragen.`,
    'Jede Frage ist unabhängig. Eine Antwort pro Frage.',
    'Kein Unterricht. Keine Korrektur. Keine Wiederholung.',
    'Nur fragen, warten, kurz bestätigen.',
    MINI_PROVA_FORBIDDEN,
    '=== ENDE MINI-PRÜFUNG ===',
  ].join('\n');
}

export function buildMiniProvaNextNudge(opts: {
  questionGerman: string;
  index: number;
  total: number;
}): string {
  return [
    '[INTERNE ANWEISUNG — nicht vorlesen]',
    'MINI-PRÜFUNG — nächste Frage.',
    `Frage ${opts.index + 1} von ${opts.total}:`,
    `"${opts.questionGerman}"`,
    'Nur die Frage stellen. Kein Feedback zur vorherigen Antwort.',
    MINI_PROVA_FORBIDDEN,
  ].join('\n');
}
