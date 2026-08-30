/* ============================================================
   DEUTSCH TURBO — Onboarding (identidade visual da referência)
   Shell, header, progresso numerado, botão, cards e telas 1–3 e 5.
   ============================================================ */
import type { ReactNode, CSSProperties } from 'react';
import { haptic } from '@/services/ui/UiPrefsService';
import { DeutschTurboMascot } from '@/components/ui/Mascot';
import {
  IconArrowUp,
  IconBriefcase,
  IconBrain,
  IconChart,
  IconChat,
  IconCheck,
  IconClock,
  IconGlobe,
  IconHouse,
  IconLaptop,
  IconLightbulb,
  IconPlane,
  IconPlay,
  IconRocket,
  IconSignal,
  IconSparkle,
  IconSprout,
  IconTarget,
  IconTrophy,
  IconUser,
  IconWrench,
} from '@/components/ui/Icons';
import type { Goal, SessionDuration } from '@/types';
import type { LevelIconId } from '@/services/onboarding/GermanLevelOptions';

export function LevelGlyph({ id, size = 18 }: { id: LevelIconId; size?: number }) {
  const map: Record<LevelIconId, typeof IconSprout> = {
    sprout: IconSprout,
    star: IconSparkle,
    chat: IconChat,
    signal: IconSignal,
    arrowUp: IconArrowUp,
    rocket: IconRocket,
    trophy: IconTrophy,
    target: IconTarget,
  };
  const Icon = map[id];
  return <Icon size={size} />;
}

/* ---------- Shell ---------- */
export function OnboardingShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col h-full max-w-md mx-auto bg-background text-text">
      {children}
    </div>
  );
}

/* ---------- Header ---------- */
export function OnboardingHeader({ onSkip }: { onSkip: () => void }) {
  return (
    <header className="flex items-center justify-between px-5 pt-3 safe-top shrink-0">
      <div className="flex items-center gap-2.5 min-h-11">
        <span className="w-8 h-8 rounded-[10px] bg-gradient-to-br from-[#ff6b35] to-[#ff9a3c] flex items-end justify-center gap-[3px] pb-[5px] shadow-sm" aria-hidden>
          <span className="w-[3px] h-[7px] bg-white/95 rounded-sm" />
          <span className="w-[3px] h-[13px] bg-white/95 rounded-sm" />
          <span className="w-[3px] h-[10px] bg-white/95 rounded-sm" />
        </span>
        <span className="text-[11px] font-bold tracking-[0.14em] text-text">DEUTSCH TURBO</span>
      </div>
      <button
        type="button"
        onClick={onSkip}
        className="text-sm font-semibold text-primary min-h-11 px-2 hover:opacity-80 transition-opacity"
      >
        Pular
      </button>
    </header>
  );
}

/* ---------- Progress 1—5 ---------- */
export function OnboardingProgress({
  current,
  total = 5,
  onJump,
}: {
  current: number;
  total?: number;
  onJump?: (i: number) => void;
}) {
  return (
    <nav className="flex items-center justify-center px-8 py-3 shrink-0" aria-label="Progresso do onboarding">
      {Array.from({ length: total }).map((_, i) => {
        const active = i === current;
        const done = i < current;
        return (
          <span key={i} className="flex items-center">
            <button
              type="button"
              disabled={!onJump || i > current}
              onClick={() => { if (onJump && i < current) { haptic(6); onJump(i); } }}
              aria-current={active ? 'step' : undefined}
              aria-label={`Passo ${i + 1}${active ? ', atual' : done ? ', concluído' : ''}`}
              className={[
                'w-8 h-8 rounded-full text-[13px] font-bold flex items-center justify-center transition-all duration-300',
                active
                  ? 'bg-primary text-white shadow-sm shadow-primary/30 scale-105'
                  : done
                    ? 'bg-primary/15 text-primary border border-primary/30'
                    : 'bg-surface text-text-faint border border-border',
                onJump && i < current ? 'cursor-pointer' : 'cursor-default',
              ].join(' ')}
            >
              {i + 1}
            </button>
            {i < total - 1 && (
              <span className={`w-6 sm:w-8 h-[2px] mx-0.5 rounded-full transition-colors ${i < current ? 'bg-primary/50' : 'bg-border'}`} aria-hidden />
            )}
          </span>
        );
      })}
    </nav>
  );
}

/* ---------- Slide ---------- */
export function OnboardingSlide({
  children,
  dir = 1,
}: {
  children: ReactNode;
  dir?: 1 | -1;
}) {
  return (
    <div
      className={dir >= 0 ? 'animate-ob-next' : 'animate-ob-prev'}
      style={{ minHeight: '100%' }}
    >
      {children}
    </div>
  );
}

/* ---------- Question header ---------- */
export function OnboardingQuestion({ title, subtitle }: { title: ReactNode; subtitle: string }) {
  return (
    <div className="mb-5">
      <h1 className="text-[26px] leading-[1.18] font-bold tracking-tight text-text">{title}</h1>
      <p className="text-[15px] text-text-muted mt-2 leading-relaxed">{subtitle}</p>
    </div>
  );
}

/* ---------- Primary button ---------- */
export function OnboardingButton({
  children,
  onClick,
  disabled,
  icon,
  ariaLabel,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  icon?: ReactNode;
  ariaLabel?: string;
}) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => { if (disabled) return; haptic(); onClick(); }}
      className="w-full min-h-14 rounded-full bg-primary hover:bg-primary-dark text-white text-[16px] font-semibold shadow-md shadow-primary/25 active:scale-[0.98] transition-all inline-flex items-center justify-center gap-2 disabled:opacity-40 disabled:active:scale-100 disabled:shadow-none"
    >
      {icon}
      {children}
    </button>
  );
}

export function SelectCheck({ selected }: { selected: boolean }) {
  return (
    <span
      className={[
        'w-5 h-5 rounded-full border flex items-center justify-center shrink-0 transition-all',
        selected ? 'bg-primary border-primary text-white' : 'border-border bg-transparent text-transparent',
      ].join(' ')}
      aria-hidden
    >
      <IconCheck size={12} />
    </span>
  );
}

export function ColorIcon({ color, children, size = 'md' }: { color: string; children: ReactNode; size?: 'sm' | 'md' }) {
  const box = size === 'sm' ? 'w-9 h-9 rounded-xl' : 'w-11 h-11 rounded-2xl';
  return (
    <span
      className={`${box} flex items-center justify-center shrink-0`}
      style={{ background: `${color}18`, color }}
      aria-hidden
    >
      {children}
    </span>
  );
}

/* ---------- Profession ---------- */
export function ProfessionInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="sr-only">Profissão</span>
      <span className="flex items-center gap-3 w-full min-h-14 px-4 rounded-[22px] bg-surface border border-border shadow-sm focus-within:border-primary focus-within:shadow-md focus-within:shadow-primary/10 transition-all">
        <span className="text-primary shrink-0" aria-hidden><IconBriefcase size={22} /></span>
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Ex: engenheiro, estudante..."
          autoComplete="organization-title"
          className="flex-1 min-w-0 bg-transparent py-3.5 text-[16px] text-text placeholder:text-text-faint outline-none"
        />
      </span>
    </label>
  );
}

export function ProfessionScreen({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const floats: { Icon: typeof IconLaptop; color: string; style: CSSProperties }[] = [
    { Icon: IconLaptop, color: '#3b82f6', style: { top: 8, left: 18 } },
    { Icon: IconWrench, color: '#f97316', style: { top: 18, right: 22 } },
    { Icon: IconGlobe, color: '#22c55e', style: { bottom: 28, left: 28 } },
    { Icon: IconUser, color: '#8b5cf6', style: { bottom: 20, right: 18 } },
  ];
  return (
    <div>
      <OnboardingQuestion
        title="Qual é sua profissão?"
        subtitle="Isso ajuda o professor a escolher exemplos e vocabulário relevantes para você."
      />
      <ProfessionInput value={value} onChange={onChange} />
      <div className="relative flex items-center justify-center my-6 h-[210px]">
        {floats.map((f, i) => (
          <span
            key={i}
            className="absolute w-11 h-11 rounded-full bg-surface shadow-md border border-border/60 flex items-center justify-center animate-orb-breathe"
            style={{ ...f.style, color: f.color, animationDelay: `${i * 0.3}s` }}
            aria-hidden
          >
            <f.Icon size={18} />
          </span>
        ))}
        <DeutschTurboMascot size="hero" state="idle" />
      </div>
      <p className="flex items-center justify-center gap-2 text-sm text-text-faint">
        <span className="text-warning" aria-hidden><IconLightbulb size={16} /></span>
        Você pode pular essa pergunta.
      </p>
    </div>
  );
}

/* ---------- Goals ---------- */
const GOALS: { value: Goal; label: string; desc: string; color: string; Icon: typeof IconBriefcase }[] = [
  { value: 'work', label: 'Trabalho', desc: 'Alemão para carreira e negócios', color: '#3b82f6', Icon: IconBriefcase },
  { value: 'daily', label: 'Vida cotidiana', desc: 'Comunicação no dia a dia e situações reais', color: '#22c55e', Icon: IconHouse },
  { value: 'conversation', label: 'Conversação', desc: 'Falar com mais confiança e fluência', color: '#8b5cf6', Icon: IconChat },
  { value: 'travel', label: 'Viagem', desc: 'Alemão para viajar com tranquilidade', color: '#f97316', Icon: IconPlane },
];

export function GoalCard({
  selected,
  label,
  desc,
  color,
  icon,
  onSelect,
}: {
  selected: boolean;
  label: string;
  desc: string;
  color: string;
  icon: ReactNode;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={() => { haptic(8); onSelect(); }}
      className={[
        'w-full text-left rounded-[20px] px-3.5 py-3 min-h-[64px] border flex items-center gap-3 transition-all duration-200',
        selected
          ? 'border-primary bg-primary-soft shadow-sm shadow-primary/10'
          : 'border-border bg-surface hover:border-primary/30',
      ].join(' ')}
    >
      <ColorIcon color={color}>{icon}</ColorIcon>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-bold text-text leading-tight">{label}</span>
        <span className="block text-[13px] text-text-muted leading-snug mt-0.5">{desc}</span>
      </span>
      <SelectCheck selected={selected} />
    </button>
  );
}

export function GoalScreen({ value, onSelect }: { value: Goal | null; onSelect: (v: Goal) => void }) {
  return (
    <div>
      <OnboardingQuestion
        title="Qual seu principal objetivo?"
        subtitle="Vamos focar no que realmente importa para você."
      />
      <div className="flex flex-col gap-2.5">
        {GOALS.map((g) => (
          <GoalCard
            key={g.value}
            selected={value === g.value}
            label={g.label}
            desc={g.desc}
            color={g.color}
            icon={<g.Icon size={20} />}
            onSelect={() => onSelect(g.value)}
          />
        ))}
      </div>
    </div>
  );
}

/* ---------- Time ---------- */
const TIMES: { value: SessionDuration; color: string }[] = [
  { value: 10, color: '#3b82f6' },
  { value: 20, color: '#22c55e' },
  { value: 30, color: '#f97316' },
  { value: 60, color: '#1d4ed8' },
  { value: 90, color: '#ec4899' },
];

export function TimeOption({
  minutes,
  color,
  selected,
  onSelect,
}: {
  minutes: SessionDuration;
  color: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={() => { haptic(8); onSelect(); }}
      className={[
        'relative flex flex-col items-center justify-center gap-1.5 rounded-[20px] min-h-[88px] border py-3 px-2 transition-all duration-200',
        selected
          ? 'border-primary bg-primary-soft shadow-sm shadow-primary/10'
          : 'border-border bg-surface hover:border-primary/30',
      ].join(' ')}
    >
      {selected && (
        <span className="absolute top-2 right-2 w-5 h-5 rounded-full bg-primary text-white flex items-center justify-center" aria-hidden>
          <IconCheck size={11} />
        </span>
      )}
      <span style={{ color }} aria-hidden><IconClock size={22} /></span>
      <span className="text-[15px] font-bold text-text">{minutes} min</span>
    </button>
  );
}

export function TimeScreen({
  value,
  onSelect,
}: {
  value: SessionDuration | null;
  onSelect: (v: SessionDuration) => void;
}) {
  return (
    <div>
      <OnboardingQuestion
        title="Quanto tempo por dia?"
        subtitle="Não se preocupe, você pode mudar depois."
      />
      <div className="grid grid-cols-3 gap-2.5">
        {TIMES.slice(0, 3).map((t) => (
          <TimeOption key={t.value} minutes={t.value} color={t.color} selected={value === t.value} onSelect={() => onSelect(t.value)} />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2.5 mt-2.5">
        {TIMES.slice(3).map((t) => (
          <TimeOption key={t.value} minutes={t.value} color={t.color} selected={value === t.value} onSelect={() => onSelect(t.value)} />
        ))}
      </div>
      <div className="mt-5 flex items-start gap-3 rounded-[20px] bg-primary-soft border border-primary/20 p-4">
        <span className="text-primary mt-0.5" aria-hidden><IconClock size={20} /></span>
        <p className="text-sm text-text leading-snug">
          <span className="font-bold">O importante é a consistência.</span>{' '}
          Pequenos passos todos os dias fazem muita diferença.
        </p>
      </div>
    </div>
  );
}

/* ---------- Ready ---------- */
const BENEFITS = [
  { Icon: IconTarget, color: '#3b82f6', title: 'Conteúdo personalizado', desc: 'Feito para seus objetivos e rotina.' },
  { Icon: IconBrain, color: '#8b5cf6', title: 'Aprendizado adaptativo', desc: 'Evolui conforme seu desempenho.' },
  { Icon: IconChart, color: '#f97316', title: 'Evolução contínua', desc: 'Acompanhamos seu progresso.' },
];

export function ReadyScreen() {
  const confetti = [
    { bg: '#5b8cff', t: '8%', l: '18%' },
    { bg: '#f97316', t: '14%', r: '16%' },
    { bg: '#22c55e', t: '4%', r: '38%' },
    { bg: '#8b5cf6', t: '22%', l: '10%' },
    { bg: '#eab308', t: '6%', l: '42%' },
    { bg: '#ec4899', t: '20%', r: '8%' },
  ];
  return (
    <div className="flex flex-col items-center text-center pt-2">
      <div className="relative w-[220px] h-[200px] flex items-center justify-center mb-2">
        {confetti.map((c, i) => (
          <span
            key={i}
            className="absolute w-2 h-2 rounded-full opacity-80"
            style={{ background: c.bg, top: c.t, left: c.l, right: c.r }}
            aria-hidden
          />
        ))}
        <DeutschTurboMascot size="onboarding" state="success" />
      </div>
      <h1 className="text-[28px] font-bold tracking-tight text-text">Tudo pronto!</h1>
      <p className="text-[15px] text-text-muted mt-1.5 leading-relaxed max-w-[280px]">
        Seu plano de estudos personalizado está sendo preparado.
      </p>
      <ul className="w-full mt-6 space-y-3 text-left">
        {BENEFITS.map((b) => (
          <li key={b.title} className="flex items-center gap-3 rounded-[18px] bg-surface border border-border/70 px-3.5 py-3 shadow-sm">
            <ColorIcon color={b.color}><b.Icon size={20} /></ColorIcon>
            <span>
              <span className="block text-[14px] font-bold text-text leading-tight">{b.title}</span>
              <span className="block text-[12px] text-text-muted mt-0.5">{b.desc}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ReadyCta({
  onStart,
  onLater,
  preparing,
}: {
  onStart: () => void;
  onLater: () => void;
  preparing?: boolean;
}) {
  return (
    <div className="space-y-3">
      <OnboardingButton onClick={onStart} disabled={preparing} icon={<IconPlay size={18} />} ariaLabel="Começar agora">
        {preparing ? 'Preparando…' : 'Começar agora'}
      </OnboardingButton>
      <button
        type="button"
        onClick={onLater}
        className="w-full min-h-11 text-sm font-semibold text-text-muted hover:text-text transition-colors"
      >
        Agora não
      </button>
    </div>
  );
}
