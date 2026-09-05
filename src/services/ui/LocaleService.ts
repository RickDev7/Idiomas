/* i18n leve — idioma da interface (não muda o alemão do professor). */
import { UiPrefsService, type InterfaceLanguage } from '@/services/ui/UiPrefsService';

type Dict = Record<string, string>;

const pt: Dict = {
  'nav.home': 'Hoje',
  'nav.talk': 'Conversar',
  'nav.review': 'Revisar',
  'nav.progress': 'Progresso',
  'nav.course': 'Meu Curso',
  'nav.start': 'Início',
  'nav.aria': 'Navegação principal',
  'home.start': 'Começar curso',
  'home.continue': 'Continuar curso',
  'settings.title': 'Configurações',
  'settings.theme': 'Tema',
  'settings.theme.dark': 'Escuro',
  'settings.theme.light': 'Claro',
  'settings.theme.system': 'Sistema',
  'settings.translation': 'Tradução',
  'settings.translation.hint': 'Como mostrar a tradução em português',
  'settings.translation.always': 'Sempre visível',
  'settings.translation.always.hint': 'Ideal para iniciante',
  'settings.translation.ondemand': 'Sob demanda',
  'settings.translation.ondemand.hint': 'Mostra quando você tocar',
  'settings.translation.immersion': 'Imersão',
  'settings.translation.immersion.hint': 'Sem tradução por padrão',
  'settings.help': 'Nível de ajuda',
  'settings.help.auto': 'Automático',
  'settings.help.extra': 'Muita ajuda',
  'settings.help.normal': 'Normal',
  'settings.help.minimal': 'Pouca ajuda',
  'settings.voice': 'Voz',
  'settings.voice.hint': 'Velocidade da fala do professor',
  'settings.voice.slow': 'Devagar',
  'settings.voice.normal': 'Normal',
  'settings.voice.natural': 'Natural',
  'settings.training': 'Treino',
  'settings.training.hint': 'Tempo por dia',
  'settings.intensive': 'Modo intensivo',
  'settings.intensive.hint': 'Sessões mais densas e correções mais frequentes.',
  'settings.experience': 'Experiência',
  'settings.sound': 'Sons',
  'settings.sound.hint': 'Sons curtos de interface (não a voz do professor).',
  'settings.haptics': 'Vibração',
  'settings.haptics.hint': 'Feedback tátil ao tocar o microfone.',
  'settings.haptics.unsupported': 'Seu dispositivo não oferece suporte à vibração.',
  'settings.notifications': 'Notificações',
  'settings.notifications.hint': 'Lembretes de estudo enquanto o app está aberto.',
  'settings.notifications.denied': 'Permissão bloqueada no navegador. Ative nas configurações do site.',
  'settings.notifications.unsupported': 'Notificações não disponíveis neste navegador.',
  'settings.language': 'Idioma da interface',
  'settings.immersion': 'Imersão',
  'settings.immersion.hint': 'Quanto mais alto, mais o professor usa alemão.',
  'settings.privacy': 'Áudio não é gravado. A chave da IA fica no servidor, nunca neste aparelho.',
  'settings.reset': 'Restaurar configurações',
  'settings.reset.hint': 'Só preferências. Não apaga aprendizado nem memória.',
  'settings.back': 'Voltar',
  'settings.section.general': 'GERAL',
  'settings.section.audio': 'ÁUDIO',
  'settings.section.learning': 'APRENDIZADO',
  'settings.section.notifications': 'NOTIFICAÇÕES',
  'settings.subtitle': 'Preferências',
};

const en: Dict = {
  ...pt,
  'nav.home': 'Today',
  'nav.talk': 'Talk',
  'nav.review': 'Review',
  'nav.progress': 'Progress',
  'nav.course': 'My Course',
  'nav.start': 'Home',
  'nav.aria': 'Main navigation',
  'home.start': 'Start course',
  'home.continue': 'Continue course',
  'settings.title': 'Settings',
  'settings.theme': 'Theme',
  'settings.theme.dark': 'Dark',
  'settings.theme.light': 'Light',
  'settings.theme.system': 'System',
  'settings.translation': 'Translation',
  'settings.translation.hint': 'How to show the Portuguese translation',
  'settings.translation.always': 'Always visible',
  'settings.translation.always.hint': 'Best for beginners',
  'settings.translation.ondemand': 'On demand',
  'settings.translation.ondemand.hint': 'Show when you tap',
  'settings.translation.immersion': 'Immersion',
  'settings.translation.immersion.hint': 'No translation by default',
  'settings.help': 'Help level',
  'settings.help.auto': 'Automatic',
  'settings.help.extra': 'Lots of help',
  'settings.help.normal': 'Normal',
  'settings.help.minimal': 'Minimal help',
  'settings.voice': 'Voice',
  'settings.voice.hint': 'Teacher speaking speed',
  'settings.voice.slow': 'Slow',
  'settings.voice.normal': 'Normal',
  'settings.voice.natural': 'Natural',
  'settings.training': 'Training',
  'settings.training.hint': 'Minutes per day',
  'settings.intensive': 'Intensive mode',
  'settings.intensive.hint': 'Denser sessions and more frequent corrections.',
  'settings.experience': 'Experience',
  'settings.sound': 'Sounds',
  'settings.sound.hint': 'Short UI sounds (not the teacher voice).',
  'settings.haptics': 'Vibration',
  'settings.haptics.hint': 'Haptic feedback when tapping the mic.',
  'settings.haptics.unsupported': 'Your device does not support vibration.',
  'settings.notifications': 'Notifications',
  'settings.notifications.hint': 'Study reminders while the app is open.',
  'settings.notifications.denied': 'Permission blocked in the browser. Enable it in site settings.',
  'settings.notifications.unsupported': 'Notifications are not available in this browser.',
  'settings.language': 'Interface language',
  'settings.immersion': 'Immersion',
  'settings.immersion.hint': 'Higher means more German from the teacher.',
  'settings.privacy': 'Audio is not recorded. The AI key stays on the server, never on this device.',
  'settings.reset': 'Reset settings',
  'settings.reset.hint': 'Preferences only. Does not erase learning or memory.',
  'settings.back': 'Back',
  'settings.section.general': 'GENERAL',
  'settings.section.audio': 'AUDIO',
  'settings.section.learning': 'LEARNING',
  'settings.section.notifications': 'NOTIFICATIONS',
  'settings.subtitle': 'Preferences',
};

const de: Dict = {
  ...pt,
  'nav.home': 'Heute',
  'nav.talk': 'Sprechen',
  'nav.review': 'Wiederholen',
  'nav.progress': 'Fortschritt',
  'nav.course': 'Mein Kurs',
  'nav.start': 'Start',
  'nav.aria': 'Hauptnavigation',
  'home.start': 'Kurs starten',
  'home.continue': 'Kurs fortsetzen',
  'settings.title': 'Einstellungen',
  'settings.theme': 'Design',
  'settings.theme.dark': 'Dunkel',
  'settings.theme.light': 'Hell',
  'settings.theme.system': 'System',
  'settings.translation': 'Übersetzung',
  'settings.translation.hint': 'Wie die portugiesische Übersetzung gezeigt wird',
  'settings.translation.always': 'Immer sichtbar',
  'settings.translation.always.hint': 'Ideal für Anfänger',
  'settings.translation.ondemand': 'Auf Abruf',
  'settings.translation.ondemand.hint': 'Zeigen, wenn du tippst',
  'settings.translation.immersion': 'Immersion',
  'settings.translation.immersion.hint': 'Keine Übersetzung standardmäßig',
  'settings.help': 'Hilfeniveau',
  'settings.help.auto': 'Automatisch',
  'settings.help.extra': 'Viel Hilfe',
  'settings.help.normal': 'Normal',
  'settings.help.minimal': 'Wenig Hilfe',
  'settings.voice': 'Stimme',
  'settings.voice.hint': 'Sprechgeschwindigkeit des Lehrers',
  'settings.voice.slow': 'Langsam',
  'settings.voice.normal': 'Normal',
  'settings.voice.natural': 'Natürlich',
  'settings.training': 'Training',
  'settings.training.hint': 'Minuten pro Tag',
  'settings.intensive': 'Intensivmodus',
  'settings.intensive.hint': 'Dichtere Sitzungen und häufigere Korrekturen.',
  'settings.experience': 'Erlebnis',
  'settings.sound': 'Töne',
  'settings.sound.hint': 'Kurze UI-Töne (nicht die Lehrerstimme).',
  'settings.haptics': 'Vibration',
  'settings.haptics.hint': 'Haptisches Feedback beim Mikrofon.',
  'settings.haptics.unsupported': 'Dein Gerät unterstützt keine Vibration.',
  'settings.notifications': 'Benachrichtigungen',
  'settings.notifications.hint': 'Lern-Erinnerungen, solange die App offen ist.',
  'settings.notifications.denied': 'Berechtigung im Browser blockiert. Bitte in den Website-Einstellungen aktivieren.',
  'settings.notifications.unsupported': 'Benachrichtigungen in diesem Browser nicht verfügbar.',
  'settings.language': 'Sprache der Oberfläche',
  'settings.immersion': 'Immersion',
  'settings.immersion.hint': 'Je höher, desto mehr Deutsch vom Lehrer.',
  'settings.privacy': 'Audio wird nicht gespeichert. Der KI-Schlüssel bleibt auf dem Server.',
  'settings.reset': 'Einstellungen zurücksetzen',
  'settings.reset.hint': 'Nur Einstellungen. Lernen und Speicher bleiben.',
  'settings.back': 'Zurück',
  'settings.section.general': 'ALLGEMEIN',
  'settings.section.audio': 'AUDIO',
  'settings.section.learning': 'LERNEN',
  'settings.section.notifications': 'BENACHRICHTIGUNGEN',
  'settings.subtitle': 'Einstellungen',
};

const TABLES: Record<InterfaceLanguage, Dict> = {
  'pt-BR': pt,
  'en-US': en,
  'de-DE': de,
};

const immersionHints: Record<InterfaceLanguage, (p: number) => string> = {
  'pt-BR': (p) => {
    if (p <= 25) return 'bastante apoio em português';
    if (p <= 50) return 'alemão crescente, com apoio quando precisa';
    if (p <= 75) return 'alemão predominante';
    if (p <= 90) return 'o professor aumenta o alemão sozinho';
    return 'quase toda a interação em alemão';
  },
  'en-US': (p) => {
    if (p <= 25) return 'lots of Portuguese support';
    if (p <= 50) return 'growing German, with support when needed';
    if (p <= 75) return 'mostly German';
    if (p <= 90) return 'the teacher increases German on their own';
    return 'almost all interaction in German';
  },
  'de-DE': (p) => {
    if (p <= 25) return 'viel Unterstützung auf Portugiesisch';
    if (p <= 50) return 'mehr Deutsch, mit Hilfe bei Bedarf';
    if (p <= 75) return 'überwiegend Deutsch';
    if (p <= 90) return 'der Lehrer steigert das Deutsch selbst';
    return 'fast die gesamte Interaktion auf Deutsch';
  },
};

export function getLocale(): InterfaceLanguage {
  return UiPrefsService.get().interfaceLanguage;
}

export function t(key: string, lang?: InterfaceLanguage): string {
  const locale = lang || getLocale();
  const table = TABLES[locale] || TABLES['pt-BR'];
  return table[key] || TABLES['pt-BR'][key] || key;
}

export function immersionHintLocalized(pct: number, lang?: InterfaceLanguage): string {
  return immersionHints[lang || getLocale()](pct);
}

export function applyDocumentLang(lang?: InterfaceLanguage): void {
  const locale = lang || getLocale();
  try {
    document.documentElement.lang = locale === 'pt-BR' ? 'pt-BR' : locale === 'de-DE' ? 'de' : 'en';
  } catch {
    /* ignore */
  }
}

export const LocaleService = {
  t,
  get: getLocale,
  set(lang: InterfaceLanguage): void {
    UiPrefsService.set({ interfaceLanguage: lang });
    applyDocumentLang(lang);
  },
  applyDocumentLang,
  immersionHint: immersionHintLocalized,
};
