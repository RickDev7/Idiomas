/**
 * Resultado do Simulador — UI premium (DT).
 * Somente métricas/evidências reais de SimulatorResult.
 */
import { useNavigate } from 'react-router-dom';
import { BottomNav } from '@/components/layout/BottomNav';
import {
  DTPage,
  DTMain,
  DTTopBar,
  DTSectionLabel,
  DTGlassCard,
  DTProgressRing,
  DTMetricCard,
  DTNeonButton,
  DTBadge,
  glassStyle,
} from '@/components/dt';
import {
  IconBolt,
  IconCheck,
  IconClock,
  IconMic,
  IconRefresh,
  IconTarget,
} from '@/components/ui/Icons';
import { readSimulatorResult } from '@/services/teacher/SimulatorIntent';

export function SimulatorResultPage() {
  const navigate = useNavigate();
  const result = readSimulatorResult();

  if (!result) {
    return (
      <DTPage>
        <DTMain withNav={false} className="flex flex-col items-center justify-center px-6">
          <p className="text-[#94A3B8] text-center">Nenhum resultado de simulação encontrado.</p>
          <button
            type="button"
            onClick={() => navigate('/simulador')}
            className="mt-4 px-5 py-3 rounded-[14px] text-white font-semibold"
            style={glassStyle}
          >
            Voltar ao simulador
          </button>
        </DTMain>
      </DTPage>
    );
  }

  const autonomousPct =
    result.responsesProduced > 0
      ? Math.round((result.autonomousCount / result.responsesProduced) * 100)
      : null;

  const leistungPct = autonomousPct;

  const teacherTalkPct =
    typeof result.teacherTalkRatio === 'number'
      ? Math.round(result.teacherTalkRatio * 100)
      : null;

  const nextStep = result.needsPractice[0] || result.deferredToReview[0] || null;

  const strengthLines: string[] = [];
  for (const g of result.contentsUsed.slice(0, 6)) {
    strengthLines.push(`${g} usado`);
  }
  if (result.scenario?.titleDe) {
    strengthLines.push(`Falou sobre ${result.scenario.titleDe}`);
  }
  if (result.responsesProduced > 0) {
    strengthLines.push(`${result.responsesProduced} produções`);
  }

  return (
    <DTPage>
      <DTTopBar
        title="Resultado"
        subtitle={`${result.scenario.emoji} ${result.scenario.titleDe}`}
        right={<DTBadge color="#00F2FE">Simulação</DTBadge>}
      />

      <DTMain className="pt-5 space-y-5">
        <DTGlassCard variant="cyan" className="p-6 flex flex-col items-center relative overflow-hidden">
          <span
            className="absolute -top-16 w-56 h-56 rounded-full pointer-events-none"
            style={{ background: 'radial-gradient(circle, rgba(0,242,254,0.3), transparent 70%)' }}
          />
          <DTProgressRing
            value={leistungPct ?? 0}
            size={148}
            stroke={11}
            color="#00F2FE"
            label={leistungPct != null ? `${leistungPct}%` : '—'}
          />
          <p className="relative mt-4 dt-label">Seu desempenho</p>
          <p className="relative text-[12px] text-[#64748B] mt-1 text-center">
            {leistungPct != null
              ? 'Autonomia nesta sessão'
              : 'Ainda sem produções — desempenho não calculável'}
          </p>
        </DTGlassCard>

        <div className="grid grid-cols-2 gap-2.5">
          <DTMetricCard
            label="Autonomia"
            value={autonomousPct != null ? `${autonomousPct}%` : '—'}
            color="#00F2FE"
            icon={<IconBolt size={14} />}
          />
          <DTMetricCard
            label="Ajudas"
            value={result.helpCount}
            color="#F97316"
            icon={<IconTarget size={14} />}
          />
          <DTMetricCard
            label="Conteúdos usados"
            value={result.contentsUsed.length}
            color="#8B5CF6"
            icon={<IconCheck size={14} />}
          />
          <DTMetricCard
            label="Tempo"
            value={`${result.elapsedMinutes} min`}
            color="#EC4899"
            icon={<IconClock size={14} />}
          />
          <DTMetricCard
            label="Produções"
            value={result.responsesProduced}
            color="#22C55E"
            icon={<IconMic size={14} />}
          />
          <DTMetricCard
            label="Correções"
            value={result.correctionCount}
            color="#A855F7"
            icon={<IconRefresh size={14} />}
          />
        </div>

        {teacherTalkPct != null && (
          <DTGlassCard className="p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <DTSectionLabel>Fala do professor</DTSectionLabel>
                <p className="text-[28px] font-bold text-white tabular-nums mt-1">
                  {teacherTalkPct}%
                </p>
                <p className="text-[12px] text-[#CBD5E1] mt-1">
                  {teacherTalkPct <= 35
                    ? 'Você falou mais.'
                    : 'Meta ≈ ≤35% — só sinal, não domínio.'}
                </p>
              </div>
              <div
                className="h-16 w-16 rounded-full flex items-center justify-center text-[13px] font-bold"
                style={{
                  background:
                    teacherTalkPct <= 35
                      ? 'rgba(34,197,94,0.18)'
                      : 'rgba(245,158,11,0.18)',
                  color: teacherTalkPct <= 35 ? '#22C55E' : '#F59E0B',
                  border: `1px solid ${
                    teacherTalkPct <= 35
                      ? 'rgba(34,197,94,0.4)'
                      : 'rgba(245,158,11,0.4)'
                  }`,
                }}
              >
                {teacherTalkPct <= 35 ? 'OK' : '!'}
              </div>
            </div>
          </DTGlassCard>
        )}

        {strengthLines.length > 0 && (
          <section>
            <DTSectionLabel className="mb-2">Pontos fortes</DTSectionLabel>
            <DTGlassCard className="p-4 space-y-2.5">
              {strengthLines.map((line) => (
                <p key={line} className="text-[14px] text-white flex gap-2">
                  <span className="text-[#22C55E] shrink-0">
                    <IconCheck size={16} />
                  </span>
                  <span className="truncate">{line}</span>
                </p>
              ))}
            </DTGlassCard>
          </section>
        )}

        <section>
          <DTSectionLabel className="mb-2">Próximo passo</DTSectionLabel>
          <DTGlassCard className="p-4">
            {nextStep ? (
              <p className="text-[15px] font-semibold text-white">
                {'german' in nextStep ? nextStep.german : nextStep}
              </p>
            ) : (
              <p className="text-[14px] text-[#64748B]">—</p>
            )}
            {result.deferredToReview.length > 0 && (
              <p className="text-[12px] text-[#94A3B8] mt-2">
                {result.deferredToReview.length} marcados para revisão posterior
              </p>
            )}
          </DTGlassCard>
        </section>

        <DTNeonButton onClick={() => navigate(nextStep ? '/revisar' : '/aprender')}>
          Continuar treino
        </DTNeonButton>
      </DTMain>
      <BottomNav />
    </DTPage>
  );
}
