import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { IconButton } from '@/components/ui/Button';
import { IconBack, IconSun, IconMoon } from '@/components/ui/Icons';
import { useProfile } from '@/hooks/useProfile';
import type { SessionDuration, SpeechSpeed } from '@/types';
import { ThemeService, type Theme } from '@/services/ui/ThemeService';
import {
  UiPrefsService,
  immersionHint,
  type UiPrefs,
} from '@/services/ui/UiPrefsService';
import { HapticService, haptic } from '@/services/ui/HapticService';
import { SoundService } from '@/services/ui/SoundService';
import { NotificationService } from '@/services/ui/NotificationService';
import { LocaleService, t, immersionHintLocalized } from '@/services/ui/LocaleService';

export function SettingsPage() {
  const { profile, updateProfile } = useProfile();
  const [theme, setTheme] = useState<Theme>(ThemeService.get());
  const [prefs, setPrefs] = useState<UiPrefs>(() => UiPrefsService.get());
  const [notifNote, setNotifNote] = useState('');
  const [, bumpLang] = useState(0);

  useEffect(() => UiPrefsService.subscribe((p) => setPrefs({ ...p })), []);

  useEffect(() => {
    if (!profile) return;
    // Migração: instalações antigas sem immersionTarget usam o % do perfil.
    const cur = UiPrefsService.get();
    if (cur.immersionTarget === 80 && profile.germanPercentage !== 80) {
      const raw = localStorage.getItem('dt_uiprefs');
      const hadExplicit = raw ? Object.prototype.hasOwnProperty.call(JSON.parse(raw), 'immersionTarget') : false;
      if (!hadExplicit) {
        setPrefs(UiPrefsService.set({ immersionTarget: profile.germanPercentage }));
      }
    }
  }, [profile]);

  if (!profile) return null;

  const speeds: SpeechSpeed[] = ['slow', 'normal', 'natural'];
  const times: SessionDuration[] = [10, 20, 30, 60, 90];
  const immersion = prefs.immersionTarget ?? profile.germanPercentage ?? 80;
  const hapticsOk = HapticService.supported();

  const changeTheme = (th: Theme) => {
    ThemeService.set(th);
    setTheme(th);
    SoundService.play('tap');
  };

  const changePref = (partial: Partial<UiPrefs>) => {
    const next = UiPrefsService.set(partial);
    setPrefs(next);
    if (partial.interfaceLanguage) {
      LocaleService.applyDocumentLang(partial.interfaceLanguage);
      bumpLang((n) => n + 1);
    }
  };

  const setImmersion = (value: number) => {
    const v = Math.max(0, Math.min(100, Math.round(value)));
    changePref({ immersionTarget: v });
    void updateProfile({ germanPercentage: v });
  };

  const toggleNotifications = async () => {
    if (prefs.notifications) {
      NotificationService.disable();
      setNotifNote('');
      setPrefs(UiPrefsService.get());
      return;
    }
    const result = await NotificationService.enable();
    setPrefs(UiPrefsService.get());
    if (result.permission === 'unsupported') {
      setNotifNote(t('settings.notifications.unsupported'));
    } else if (result.permission === 'denied') {
      setNotifNote(t('settings.notifications.denied'));
    } else if (result.ok) {
      setNotifNote('');
      void NotificationService.showTest();
      SoundService.play('success');
    }
  };

  const resetPrefs = () => {
    const next = UiPrefsService.reset();
    setPrefs(next);
    LocaleService.applyDocumentLang(next.interfaceLanguage);
    void updateProfile({ germanPercentage: next.immersionTarget, turboMode: false });
    NotificationService.disable();
    SoundService.play('tap');
    bumpLang((n) => n + 1);
  };

  return (
    <Layout
      left={
        <Link to="/" aria-label={t('settings.back')}>
          <IconButton label={t('settings.back')}><IconBack size={20} /></IconButton>
        </Link>
      }
      title={t('settings.title')}
    >
      <div className="px-6 pt-4 pb-10 space-y-8">
        <Section title={t('settings.theme')}>
          <div className="flex gap-2">
            <Choice active={theme === 'dark'} onClick={() => changeTheme('dark')} icon={<IconMoon size={16} />} label={t('settings.theme.dark')} />
            <Choice active={theme === 'light'} onClick={() => changeTheme('light')} icon={<IconSun size={16} />} label={t('settings.theme.light')} />
            <Choice active={theme === 'system'} onClick={() => changeTheme('system')} label={t('settings.theme.system')} />
          </div>
        </Section>

        <Section title={t('settings.translation')}>
          <p className="text-caption text-text-faint mb-2">{t('settings.translation.hint')}</p>
          <div className="space-y-2">
            <ChoiceRow active={prefs.translationMode === 'always'} onClick={() => changePref({ translationMode: 'always' })} icon="🇧🇷" label={t('settings.translation.always')} hint={t('settings.translation.always.hint')} />
            <ChoiceRow active={prefs.translationMode === 'ondemand'} onClick={() => changePref({ translationMode: 'ondemand' })} icon="👁" label={t('settings.translation.ondemand')} hint={t('settings.translation.ondemand.hint')} />
            <ChoiceRow active={prefs.translationMode === 'immersion'} onClick={() => changePref({ translationMode: 'immersion' })} icon="🇩🇪" label={t('settings.translation.immersion')} hint={t('settings.translation.immersion.hint')} />
          </div>
        </Section>

        <Section title={t('settings.help')}>
          <div className="grid grid-cols-2 gap-2">
            <Choice active={prefs.helpLevel === 'auto'} onClick={() => changePref({ helpLevel: 'auto' })} label={t('settings.help.auto')} full />
            <Choice active={prefs.helpLevel === 'extra'} onClick={() => changePref({ helpLevel: 'extra' })} label={t('settings.help.extra')} full />
            <Choice active={prefs.helpLevel === 'normal'} onClick={() => changePref({ helpLevel: 'normal' })} label={t('settings.help.normal')} full />
            <Choice active={prefs.helpLevel === 'minimal'} onClick={() => changePref({ helpLevel: 'minimal' })} label={t('settings.help.minimal')} full />
          </div>
        </Section>

        <Section title={t('settings.voice')}>
          <p className="text-caption text-text-faint mb-2">{t('settings.voice.hint')}</p>
          <div className="flex gap-2">
            {speeds.map((s) => (
              <Choice
                key={s}
                active={profile.speechSpeed === s}
                onClick={() => { void updateProfile({ speechSpeed: s }); SoundService.play('tap'); }}
                label={t(`settings.voice.${s}`)}
                full
              />
            ))}
          </div>
        </Section>

        <Section title={t('settings.training')}>
          <p className="text-caption text-text-faint mb-2">{t('settings.training.hint')}</p>
          <div className="flex flex-wrap gap-2">
            {times.map((m) => (
              <Choice key={m} active={profile.dailyMinutes === m} onClick={() => { void updateProfile({ dailyMinutes: m }); SoundService.play('tap'); }} label={`${m} min`} />
            ))}
          </div>
          <div className="mt-4">
            <Toggle
              label={t('settings.intensive')}
              hint={t('settings.intensive.hint')}
              active={profile.turboMode}
              onClick={() => {
                void updateProfile({ turboMode: !profile.turboMode });
                SoundService.play('tap');
                haptic(8);
              }}
            />
          </div>
        </Section>

        <Section title={t('settings.immersion')}>
          <p className="text-caption text-text-faint mb-2">{t('settings.immersion.hint')}</p>
          <div className="rounded-[var(--radius-md)] bg-surface border border-border/50 p-4">
            <div className="flex items-baseline justify-between gap-2 mb-2">
              <p className="text-h2 font-bold text-text">{immersion}%</p>
              <p className="text-caption text-text-faint text-right">{immersionHintLocalized(immersion)}</p>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={immersion}
              aria-label={t('settings.immersion')}
              onChange={(e) => setImmersion(Number(e.target.value))}
              className="w-full accent-[var(--primary)]"
            />
            <div className="flex justify-between text-caption text-text-faint mt-1">
              <span>0%</span><span>25%</span><span>50%</span><span>75%</span><span>100%</span>
            </div>
          </div>
        </Section>

        <Section title={t('settings.experience')}>
          <Toggle
            label={t('settings.sound')}
            hint={t('settings.sound.hint')}
            active={prefs.sound}
            onClick={() => {
              const on = !prefs.sound;
              changePref({ sound: on });
              if (on) SoundService.play('success');
            }}
          />
          <div className="mt-3">
            <Toggle
              label={t('settings.haptics')}
              hint={hapticsOk ? t('settings.haptics.hint') : t('settings.haptics.unsupported')}
              active={prefs.haptics}
              onClick={() => {
                const on = !prefs.haptics;
                changePref({ haptics: on });
                if (on) HapticService.pulse(16);
              }}
            />
          </div>
          <div className="mt-3">
            <Toggle
              label={t('settings.notifications')}
              hint={t('settings.notifications.hint')}
              active={prefs.notifications && NotificationService.permission() === 'granted'}
              onClick={() => { void toggleNotifications(); }}
            />
            {notifNote && <p className="text-caption text-accent mt-2">{notifNote}</p>}
          </div>
        </Section>

        <Section title={t('settings.language')}>
          <div className="flex gap-2">
            <Choice active={prefs.interfaceLanguage === 'pt-BR'} onClick={() => { changePref({ interfaceLanguage: 'pt-BR' }); SoundService.play('tap'); }} label="Português" />
            <Choice active={prefs.interfaceLanguage === 'en-US'} onClick={() => { changePref({ interfaceLanguage: 'en-US' }); SoundService.play('tap'); }} label="English" />
            <Choice active={prefs.interfaceLanguage === 'de-DE'} onClick={() => { changePref({ interfaceLanguage: 'de-DE' }); SoundService.play('tap'); }} label="Deutsch" />
          </div>
        </Section>

        <Section title={t('settings.reset')}>
          <button
            type="button"
            onClick={resetPrefs}
            className="w-full text-left p-3.5 rounded-[var(--radius-md)] border border-border bg-surface hover:border-primary/40 min-h-11"
          >
            <span className="block text-body text-text font-medium">{t('settings.reset')}</span>
            <span className="block text-caption text-text-faint mt-0.5">{t('settings.reset.hint')}</span>
          </button>
        </Section>

        <p className="text-caption text-text-faint leading-relaxed">
          {t('settings.immersion')} {immersion}% — {immersionHint(immersion)}. {t('settings.privacy')}
        </p>
      </div>
    </Layout>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <p className="text-eyebrow text-text-faint mb-3">{title}</p>
      {children}
    </section>
  );
}

function Choice({ active, onClick, label, icon, full }: { active: boolean; onClick: () => void; label: string; icon?: React.ReactNode; full?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center justify-center gap-2 ${full ? 'flex-1' : ''} px-4 py-2.5 rounded-[var(--radius-md)] text-secondary font-medium transition-all min-h-11 ${
        active
          ? 'bg-primary text-white shadow-sm shadow-primary/25'
          : 'bg-surface text-text-muted border border-border/60 hover:text-text'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function ChoiceRow({ active, onClick, icon, label, hint }: { active: boolean; onClick: () => void; icon: string; label: string; hint?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex items-center gap-3 p-3.5 rounded-[var(--radius-md)] border text-left transition-all min-h-11 ${
        active ? 'border-primary bg-primary-soft' : 'border-border bg-surface hover:border-border'
      }`}
    >
      <span className="text-xl" aria-hidden>{icon}</span>
      <span className="flex-1">
        <span className="block text-body text-text font-medium">{label}</span>
        {hint && <span className="block text-caption text-text-faint mt-0.5">{hint}</span>}
      </span>
      {active && <span className="w-5 h-5 rounded-full bg-primary text-white flex items-center justify-center text-xs">✓</span>}
    </button>
  );
}

function Toggle({ label, hint, active, onClick }: { label: string; hint?: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center justify-between gap-3 py-1 min-h-11"
      role="switch"
      aria-checked={active}
      aria-label={label}
    >
      <span className="text-left">
        <span className="block text-body text-text">{label}</span>
        {hint && <span className="block text-caption text-text-faint mt-0.5">{hint}</span>}
      </span>
      <span className={`relative w-12 h-7 rounded-full transition-colors shrink-0 ${active ? 'bg-primary' : 'bg-surface-light border border-border'}`}>
        <span className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow-sm transition-all ${active ? 'left-6' : 'left-1'}`} />
      </span>
    </button>
  );
}
