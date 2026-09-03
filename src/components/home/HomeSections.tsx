/**
 * Home cockpit — composição visual exclusiva da Home.
 * Sem dashboard de métricas; hero dominante + targets reais + progresso compacto.
 */
import { DTProgressRing } from '@/components/dt';
import { IconBell, IconClock, IconFlame, IconDrop, IconBolt, IconPlay, IconLock } from '@/components/ui/Icons';
import mascotImg from '@/assets/mascot/deutsch-turbo-mascot.png';

const LEVELS = ['L0', 'A1', 'A2', 'B1', 'B2'] as const;

export function germanGreetingForNow(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Guten Morgen';
  if (hour < 18) return 'Guten Tag';
  return 'Guten Abend';
}

/** Header compacto — sem card. */
export function HomeCockpitHeader({
  name,
  streak,
  onStreak,
  onBell,
}: {
  name?: string;
  streak: number;
  onStreak?: () => void;
  onBell?: () => void;
}) {
  const greet = germanGreetingForNow();
  const title = name ? `${greet}, ${name}!` : `${greet}!`;

  return (
    <header className="px-4 pt-2.5 safe-top shrink-0">
      <div className="flex items-start gap-2.5">
        <img
          src={mascotImg}
          alt=""
          className="shrink-0 w-9 h-9 rounded-full object-cover border border-white/10 mt-0.5"
          draggable={false}
        />
        <div className="min-w-0 flex-1">
          <h1 className="text-[17px] font-extrabold leading-tight text-white truncate font-[family-name:var(--font-display)]">
            {title} <span aria-hidden>👋</span>
          </h1>
          <p className="text-[11px] text-[#94A3B8] mt-0.5 leading-snug truncate">
            Heute ist ein guter Tag zum Lernen.
          </p>
        </div>
        <button
          type="button"
          onClick={onStreak}
          aria-label={`${streak} dias de sequência`}
          className="shrink-0 flex flex-col items-center justify-center min-w-[44px] pt-0.5 active:scale-95 transition-transform"
        >
          <span className="inline-flex items-center gap-0.5 text-[13px] font-extrabold text-white tabular-nums leading-none">
            <span aria-hidden>🔥</span>
            {streak}
          </span>
          <span className="text-[9px] font-semibold uppercase tracking-wider text-[#F97316] mt-0.5">
            Streak
          </span>
        </button>
        <button
          type="button"
          onClick={onBell}
          aria-label="Configurações"
          className="w-9 h-9 rounded-full flex items-center justify-center text-[#64748B] shrink-0 mt-0.5"
          style={{ background: 'rgba(255,255,255,0.04)' }}
        >
          <IconBell size={16} />
        </button>
      </div>
    </header>
  );
}

/** Seletor de nível fino — neon só no ativo. */
export function HomeLevelRail({ current = 'L0' }: { current?: string }) {
  const idx = Math.max(0, LEVELS.findIndex((l) => l === current));

  return (
    <section className="px-4" aria-label="Nível atual">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#64748B] mb-2">
        Nível atual
      </p>
      <div className="flex items-center justify-between gap-1.5">
        {LEVELS.map((lvl, i) => {
          const active = i === idx;
          const locked = i > idx;
          const done = i < idx;
          return (
            <div key={lvl} className="flex flex-col items-center gap-1 flex-1">
              <span
                className="w-10 h-10 rounded-full flex items-center justify-center text-[11px] font-bold"
                style={
                  active
                    ? {
                        background: 'linear-gradient(145deg, #A855F7, #7C3AED)',
                        color: '#fff',
                        boxShadow:
                          '0 0 0 2px rgba(139,92,246,0.45), 0 0 18px rgba(139,92,246,0.55)',
                      }
                    : done
                      ? {
                          background: 'rgba(34,197,94,0.14)',
                          color: '#4ADE80',
                          border: '1px solid rgba(34,197,94,0.35)',
                        }
                      : {
                          background: 'rgba(255,255,255,0.03)',
                          color: '#475569',
                          border: '1px solid rgba(255,255,255,0.06)',
                        }
                }
              >
                {locked ? <IconLock size={12} /> : done ? '✓' : lvl}
              </span>
              <span
                className={`text-[9px] font-semibold tracking-wide ${
                  active ? 'text-[#C4B5FD]' : 'text-[#475569]'
                }`}
              >
                {lvl}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/** Hero dominante — ~35–40% do viewport; play como âncora. */
export function HomeTrainingHero({
  title,
  badge,
  onBadgeClick,
  onStart,
  actionLabel,
}: {
  title: string;
  badge: string;
  onBadgeClick?: () => void;
  onStart: () => void;
  actionLabel: string;
}) {
  return (
    <section className="px-4">
      <div className="home-cockpit-hero relative overflow-hidden rounded-[28px] px-5 pt-4 pb-4 min-h-[268px] flex flex-col">
        <span className="home-cockpit-orb home-cockpit-orb--tl" aria-hidden />
        <span className="home-cockpit-orb home-cockpit-orb--br" aria-hidden />
        <span className="home-cockpit-particle home-cockpit-particle--1" aria-hidden />
        <span className="home-cockpit-particle home-cockpit-particle--2" aria-hidden />
        <span className="home-cockpit-particle home-cockpit-particle--3" aria-hidden />
        <span className="home-cockpit-particle home-cockpit-particle--4" aria-hidden />

        <p className="relative text-[10px] uppercase tracking-[0.22em] font-bold text-white/80">
          Treino do dia
        </p>
        <h2 className="relative mt-1.5 text-[28px] leading-[1.05] font-extrabold text-white font-[family-name:var(--font-display)] tracking-tight max-w-[68%]">
          {title}
        </h2>
        <p className="relative mt-1.5 text-[13px] text-white/85 max-w-[70%]">
          Sessão personalizada de hoje
        </p>

        <button
          type="button"
          onClick={onBadgeClick}
          className="relative mt-3 self-start inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-semibold text-white/95"
          style={{
            background: 'rgba(0,0,0,0.28)',
            border: '1px solid rgba(255,255,255,0.22)',
          }}
          aria-label="Ajustar meta diária"
        >
          <IconClock size={13} />
          {badge}
        </button>

        <div className="relative mt-auto pt-5 flex items-end justify-between gap-3">
          <span className="text-[14px] font-bold text-white/95 pb-3">{actionLabel}</span>
          <div className="relative flex items-center justify-center">
            <span className="home-cockpit-play-ring" aria-hidden />
            <button
              type="button"
              onClick={onStart}
              aria-label={actionLabel}
              className="relative z-[1] w-[88px] h-[88px] rounded-full flex items-center justify-center bg-white text-[#050816] active:scale-95 transition-transform"
              style={{
                boxShadow:
                  '0 0 0 5px rgba(255,255,255,0.22), 0 0 40px rgba(236,72,153,0.7), 0 12px 28px rgba(0,0,0,0.35)',
              }}
            >
              <IconPlay size={34} />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

export type StudyTarget = {
  id: string;
  german: string;
  portuguese: string;
  pct: number | null;
  tint: string;
  icon: 'flame' | 'drop' | 'bolt';
  onClick?: () => void;
};

const TARGET_ICONS = {
  flame: IconFlame,
  drop: IconDrop,
  bolt: IconBolt,
} as const;

/** Até 3 training targets — não grid de métricas. */
export function HomeStudyTargets({
  targets,
  onSeeAll,
}: {
  targets: StudyTarget[];
  onSeeAll?: () => void;
}) {
  return (
    <section className="px-4">
      <div className="flex items-baseline justify-between gap-2 mb-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#64748B]">
          O que estudar agora
        </p>
        {onSeeAll ? (
          <button
            type="button"
            onClick={onSeeAll}
            className="text-[11px] font-semibold text-[#00F2FE]/80"
          >
            Ver todos
          </button>
        ) : null}
      </div>

      {targets.length === 0 ? (
        <p className="text-[13px] text-[#64748B] py-2">
          Comece o treino para montar seus targets.
        </p>
      ) : (
        <ul className="home-cockpit-targets">
          {targets.map((t) => {
            const Icon = TARGET_ICONS[t.icon];
            return (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={t.onClick}
                  className="w-full flex items-center gap-3 py-2.5 text-left active:opacity-80 transition-opacity"
                >
                  <span
                    className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0"
                    style={{
                      background: `${t.tint}18`,
                      color: t.tint,
                      boxShadow: `0 0 14px ${t.tint}28`,
                    }}
                  >
                    <Icon size={18} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-bold text-white truncate leading-tight">
                      {t.german}
                    </span>
                    {t.portuguese ? (
                      <span className="block text-[11px] text-[#94A3B8] truncate mt-0.5">
                        {t.portuguese}
                      </span>
                    ) : null}
                  </span>
                  <span
                    className="text-[16px] font-extrabold tabular-nums shrink-0"
                    style={{ color: t.pct != null ? t.tint : '#64748B' }}
                  >
                    {t.pct != null ? `${t.pct}%` : '—'}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export type ProgressStat = {
  label: string;
  value: string;
};

/** Progresso compacto — ring importante, stats em texto. */
export function HomeProgressStrip({
  mastery,
  stats,
}: {
  mastery: number | null;
  stats: ProgressStat[];
}) {
  return (
    <section className="px-4 pb-1">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#64748B] mb-2.5">
        Seu progresso
      </p>
      <div className="flex items-center gap-4">
        <DTProgressRing
          value={mastery ?? 0}
          size={124}
          stroke={11}
          label={mastery != null ? `${mastery}%` : '—'}
          sublabel="domínio"
          color="#8B5CF6"
        />
        <div className="flex-1 min-w-0 grid grid-cols-2 gap-x-3 gap-y-2.5">
          {stats.map((s) => (
            <div key={s.label} className="min-w-0">
              <p className="text-[10px] text-[#64748B] leading-none">{s.label}</p>
              <p className="text-[15px] font-extrabold text-white tabular-nums mt-1 leading-none truncate">
                {s.value}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/** @deprecated stubs — Home não usa mais estes layouts */
export function HomeGreetingHeader(props: {
  greeting: string;
  name?: string;
  streak: number;
  onStreak?: () => void;
  onBell?: () => void;
}) {
  return (
    <HomeCockpitHeader
      name={props.name}
      streak={props.streak}
      onStreak={props.onStreak}
      onBell={props.onBell}
    />
  );
}

export function LevelTrack({ current = 'L0' }: { current?: string }) {
  return <HomeLevelRail current={current} />;
}

export function TrainingHero(_props: Record<string, unknown>) {
  return null;
}

export function NextStepCard(_props: Record<string, unknown>) {
  return null;
}

export function ChunksOfDay() {
  return null;
}

export function ProgressSection(_props: { metrics: unknown[] }) {
  return null;
}

export function NextLearnSection(_props: Record<string, unknown>) {
  return null;
}

export function HomeHeader({ onSettings }: { onSettings: () => void }) {
  return (
    <HomeCockpitHeader streak={0} onBell={onSettings} />
  );
}

export function Greeting(props: {
  greeting: string;
  name?: string;
  streak: number;
  onStreak?: () => void;
}) {
  return <HomeCockpitHeader name={props.name} streak={props.streak} onStreak={props.onStreak} />;
}

export function TrainingAreas() {
  return null;
}

export function FocusCard({ focusText }: { focusText: string }) {
  return (
    <p className="px-4 text-[13px] text-[#CBD5E1]">{focusText}</p>
  );
}

export { IconClock };
