/* Tela 4 — autoavaliação compacta Zero → Muito avançado. */
import { haptic } from '@/services/ui/UiPrefsService';
import { IconMic, IconShield } from '@/components/ui/Icons';
import { ColorIcon, LevelGlyph, OnboardingQuestion, SelectCheck } from '@/components/onboarding/Onboarding';
import {
  GERMAN_LEVEL_OPTIONS,
  diagnosticPromptFor,
  type GermanLevelOption,
} from '@/services/onboarding/GermanLevelOptions';
import type { SelfReportedLevel } from '@/types';

export function GermanLevelCard({
  option,
  selected,
  onSelect,
}: {
  option: GermanLevelOption;
  selected: boolean;
  onSelect: (v: SelfReportedLevel) => void;
}) {
  const special = option.special;
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={() => { haptic(8); onSelect(option.id); }}
      className={[
        'w-full text-left rounded-[18px] px-3 py-2.5 min-h-[52px] border transition-all duration-200 flex items-center gap-3',
        selected
          ? 'border-primary bg-primary-soft shadow-sm shadow-primary/10'
          : special
            ? 'border-[#8b5cf6]/45 bg-[#8b5cf6]/10 hover:border-[#8b5cf6]/70'
            : 'border-border bg-surface hover:border-primary/25',
      ].join(' ')}
    >
      <ColorIcon color={option.color} size="sm">
        <LevelGlyph id={option.icon} size={18} />
      </ColorIcon>
      <span className="min-w-0 flex-1">
        <span className="block text-[14px] font-bold text-text leading-tight">{option.label}</span>
        <span className="block text-[12px] text-text-muted leading-snug mt-0.5">{option.desc}</span>
      </span>
      <SelectCheck selected={selected} />
    </button>
  );
}

export function LevelSelection({
  value,
  onSelect,
  onRequestTest,
}: {
  value: SelfReportedLevel | null;
  onSelect: (v: SelfReportedLevel) => void;
  onRequestTest?: () => void;
}) {
  return (
    <div>
      <OnboardingQuestion
        title={<>Você sabe alguma coisa<br />de alemão?</>}
        subtitle="Escolha a opção que mais se aproxima de você."
      />
      <div className="flex flex-col gap-2">
        {GERMAN_LEVEL_OPTIONS.map((o) => (
          <GermanLevelCard key={o.id} option={o} selected={value === o.id} onSelect={onSelect} />
        ))}
      </div>
      <p className="mt-3 flex items-start justify-center gap-1.5 text-[12px] text-text-faint text-center leading-snug px-2">
        <span className="text-primary mt-0.5 shrink-0" aria-hidden><IconShield size={14} /></span>
        Isso é apenas uma estimativa. Vamos confirmar seu nível depois.
      </p>
      {value && <DiagnosticIntro selected={value} onRequestTest={onRequestTest} />}
    </div>
  );
}

export function DiagnosticIntro({ selected, onRequestTest }: { selected: SelfReportedLevel; onRequestTest?: () => void }) {
  const kind = diagnosticPromptFor(selected);
  if (kind === 'none') return null;

  if (kind === 'recommended') {
    return (
      <div className="mt-3 rounded-[18px] border border-[#8b5cf6]/40 bg-[#8b5cf6]/10 p-3.5 animate-fade-in">
        <h3 className="text-[15px] font-bold text-text">Vamos descobrir juntos.</h3>
        <p className="text-sm text-text-muted mt-1 leading-snug flex items-center gap-1.5">
          <IconMic size={14} /> Teste rápido de nível · aprox. 2 minutos
        </p>
      </div>
    );
  }

  if (kind === 'suggested') {
    return (
      <div className="mt-3 rounded-[18px] border border-primary/25 bg-primary-soft p-3.5 animate-fade-in">
        <h3 className="text-[15px] font-bold text-text">Quer confirmar seu nível?</h3>
        <p className="text-sm text-text-muted mt-1 leading-snug">
          Teste rápido — 2 min. Ou continue assim, se preferir.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-3 text-center animate-fade-in">
      <p className="text-[12px] text-text-faint">Opcional: um teste rápido de ~2 min para confirmar.</p>
      {onRequestTest && (
        <button type="button" onClick={() => { haptic(8); onRequestTest(); }} className="mt-1 text-sm font-semibold text-primary min-h-11">
          Fazer teste rápido
        </button>
      )}
    </div>
  );
}

export function DiagnosticPrompt({
  required,
  onTest,
  onSkip,
}: {
  required: boolean;
  onTest: () => void;
  onSkip: () => void;
}) {
  return (
    <div className="animate-fade-in">
      <OnboardingQuestion
        title={required ? 'Vamos descobrir seu nível' : 'Quer confirmar seu nível?'}
        subtitle={required
          ? 'Um teste rápido de cerca de 2 minutos. Não é prova e não é certificação.'
          : 'Podemos conversar por cerca de 2 minutos, ou você continua com a estimativa.'}
      />
      <div className="rounded-[22px] bg-surface border border-border shadow-sm p-5">
        <p className="text-sm text-text leading-relaxed">
          O professor avalia fala, compreensão e vocabulário com poucas perguntas — só para começar no lugar certo.
        </p>
      </div>
      <div className="mt-6 space-y-3">
        <button
          type="button"
          onClick={() => { haptic(); onTest(); }}
          className="w-full min-h-14 rounded-full bg-primary text-white font-semibold shadow-md shadow-primary/25 inline-flex items-center justify-center gap-2"
        >
          <IconMic size={18} /> Teste rápido — 2 min
        </button>
        {!required && (
          <button
            type="button"
            onClick={() => { haptic(8); onSkip(); }}
            className="w-full min-h-11 text-sm font-semibold text-text-muted"
          >
            Continuar assim
          </button>
        )}
      </div>
    </div>
  );
}

export function DiagnosticResultView({
  estimatedLabel,
  skills,
  nextFocus,
}: {
  estimatedLabel: string;
  skills: { speaking: string; listening: string; reading: string; vocabulary: string; communication?: string };
  nextFocus: string;
}) {
  const rows = [
    { label: 'Speaking', value: skills.speaking },
    { label: 'Listening', value: skills.listening },
    { label: 'Vocabulary', value: skills.vocabulary },
    { label: 'Communication', value: skills.communication ?? skills.reading },
  ];
  return (
    <div className="animate-fade-in pt-2">
      <p className="text-[12px] font-medium text-text-faint tracking-wide uppercase">Nível estimado</p>
      <h1 className="text-[32px] font-bold tracking-tight text-text mt-1">{estimatedLabel}</h1>
      <p className="text-sm text-text-muted mt-1 leading-snug">
        Desempenho compatível com este ponto de partida — não é uma certificação.
      </p>
      <ul className="mt-5 space-y-2">
        {rows.map((r) => (
          <li key={r.label} className="flex items-center gap-3 rounded-[16px] bg-surface border border-border px-3.5 py-2.5 min-h-[44px]">
            <span className="flex-1 text-sm font-medium text-text">{r.label}</span>
            <span className="text-sm font-bold text-primary">{r.value}</span>
          </li>
        ))}
      </ul>
      <div className="mt-5 rounded-[18px] bg-surface border border-border p-4">
        <p className="text-[12px] text-text-faint font-medium">Seu próximo foco</p>
        <p className="text-[15px] font-semibold text-text mt-1">{nextFocus}</p>
      </div>
    </div>
  );
}
