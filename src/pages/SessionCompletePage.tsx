/**
 * Sessão concluída — visual forte de conclusão (SessionCompleteStore).
 */
import { useNavigate } from 'react-router-dom';
import { BottomNav } from '@/components/layout/BottomNav';
import {
  DTPage,
  DTMain,
  DTSectionLabel,
  DTGlassCard,
  DTProgressRing,
  DTMetricCard,
  DTNeonButton,
  DTBadge,
  glassStyle,
} from '@/components/dt';
import {
  IconCheck,
  IconClock,
  IconPuzzle,
  IconSparkle,
  IconFlame,
  IconChat,
} from '@/components/ui/Icons';
import {
  readSessionComplete,
  clearSessionComplete,
} from '@/services/ui/SessionCompleteStore';

export function SessionCompletePage() {
  const navigate = useNavigate();
  const data = readSessionComplete();

  if (!data) {
    return (
      <DTPage>
        <div className="flex-1 flex flex-col items-center justify-center px-6">
          <p className="text-[#94A3B8] text-center">Nenhum resumo de sessão encontrado.</p>
          <button
            type="button"
            onClick={() => navigate('/')}
            className="mt-4 px-5 py-3 rounded-[14px] text-white font-semibold"
            style={glassStyle}
          >
            Voltar ao início
          </button>
        </div>
      </DTPage>
    );
  }

  const name = data.name?.trim() || 'Aluno';
  const ringValue = data.autonomyPct != null ? data.autonomyPct : null;

  const done = () => {
    clearSessionComplete();
    navigate('/');
  };

  return (
    <DTPage>
      <header className="px-4 pt-6 safe-top shrink-0 text-center">
        <div className="inline-flex items-center justify-center mb-3">
          <span
            className="w-14 h-14 rounded-full flex items-center justify-center text-[#050816]"
            style={{
              background: 'linear-gradient(135deg, #00F2FE, #22C55E)',
              boxShadow: '0 0 28px rgba(0,242,254,0.45)',
            }}
          >
            <IconCheck size={28} />
          </span>
        </div>
        <h1 className="text-[18px] font-bold text-white font-[family-name:var(--font-display)] tracking-wide uppercase">
          {data.headline || 'SESSÃO CONCLUÍDA'}
        </h1>
        <p className="text-[14px] text-[#CBD5E1] mt-2">Muito bem, {name}!</p>
        {data.streak != null && data.streak > 0 ? (
          <div className="mt-3 flex justify-center">
            <DTBadge color="#F97316">
              <IconFlame size={12} /> {data.streak} dias de sequência
            </DTBadge>
          </div>
        ) : null}
      </header>

      <DTMain>
        <div className="pt-2 space-y-5">
          <DTGlassCard
            variant="cyan"
            className="p-6 flex flex-col items-center relative overflow-hidden"
          >
            <span
              className="absolute -top-16 w-52 h-52 rounded-full pointer-events-none"
              style={{
                background: 'radial-gradient(circle, rgba(0,242,254,0.35), transparent 70%)',
              }}
            />
            <DTProgressRing
              value={ringValue ?? 100}
              size={128}
              stroke={10}
              color="#00F2FE"
              label={
                data.autonomyPct != null
                  ? `${data.autonomyPct}%`
                  : data.minutes != null
                    ? `${data.minutes}m`
                    : '✓'
              }
            />
            <p className="relative mt-3">
              <DTSectionLabel>Sessão encerrada</DTSectionLabel>
            </p>
          </DTGlassCard>

          <div className="grid grid-cols-2 gap-2.5">
            <DTMetricCard
              value={data.minutes != null ? `${data.minutes}` : '—'}
              label="Minutos"
              color="#00F2FE"
              icon={<IconClock size={14} />}
            />
            <DTMetricCard
              value={data.structures != null ? String(data.structures) : '—'}
              label="Estruturas"
              color="#8B5CF6"
              icon={<IconPuzzle size={14} />}
            />
            <DTMetricCard
              value={data.variations != null ? String(data.variations) : '—'}
              label="Variações"
              color="#EC4899"
              icon={<IconSparkle size={14} />}
            />
            <DTMetricCard
              value={data.autonomyPct != null ? `${data.autonomyPct}%` : '—'}
              label="Autonomia"
              color="#22C55E"
              icon={<IconChat size={14} />}
            />
          </div>

          {data.improved && data.improved.length > 0 && (
            <section>
              <DTSectionLabel className="mb-2">Melhorou hoje</DTSectionLabel>
              <DTGlassCard className="p-4 space-y-2">
                {data.improved.slice(0, 8).map((g) => (
                  <p key={g} className="text-[14px] text-white flex gap-2">
                    <span className="text-[#22C55E] font-bold">+</span>
                    <span className="truncate">{g}</span>
                  </p>
                ))}
              </DTGlassCard>
            </section>
          )}

          {data.nextStep?.trim() && (
            <section>
              <DTSectionLabel className="mb-2">Próximo passo</DTSectionLabel>
              <DTGlassCard className="p-4">
                <p className="text-[14px] text-white">{data.nextStep.trim()}</p>
              </DTGlassCard>
            </section>
          )}

          <DTNeonButton
            variant="accent"
            onClick={() => {
              clearSessionComplete();
              navigate('/aprender');
            }}
          >
            Continuar treino
          </DTNeonButton>

          <button
            type="button"
            onClick={done}
            className="w-full py-3.5 rounded-[18px] text-[14px] font-semibold text-white"
            style={glassStyle}
          >
            Concluído
          </button>
        </div>
      </DTMain>
      <BottomNav />
    </DTPage>
  );
}
