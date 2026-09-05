/**
 * Cards de apoio da Home — ícone + label + valor + chevron.
 * Só apresentação; dados e handlers vêm do consumidor.
 */
import type { ReactNode } from 'react';
import { GlassRow } from '@/components/premium';
import { IconTarget, IconSparkle, IconRefresh } from '@/components/ui/Icons';

export function HomeSupportCard({
  label,
  value,
  icon,
  tone = 'violet',
  onClick,
}: {
  label: string;
  value: string;
  icon?: ReactNode;
  tone?: 'violet' | 'cyan' | 'coral';
  onClick?: () => void;
}) {
  return (
    <GlassRow
      icon={icon ?? <IconTarget size={20} />}
      label={label}
      value={value}
      tone={tone}
      onClick={onClick}
    />
  );
}

export function HomeBriefingSupport({
  focus,
  nextSkill,
  reviewPending,
  onFocus,
  onNextSkill,
  onReview,
}: {
  focus: string;
  nextSkill: string;
  reviewPending: string;
  onFocus?: () => void;
  onNextSkill?: () => void;
  onReview?: () => void;
}) {
  return (
    <section className="px-5 space-y-3" aria-label="Resumo do dia">
      <HomeSupportCard
        label="Seu foco"
        value={focus}
        tone="violet"
        icon={<IconTarget size={20} />}
        onClick={onFocus}
      />
      <HomeSupportCard
        label="Próxima habilidade"
        value={nextSkill}
        tone="violet"
        icon={<IconSparkle size={20} />}
        onClick={onNextSkill}
      />
      <HomeSupportCard
        label="Revisão pendente"
        value={reviewPending}
        tone="coral"
        icon={<IconRefresh size={20} />}
        onClick={onReview}
      />
    </section>
  );
}
