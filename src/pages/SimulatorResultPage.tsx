/**
 * Simulator Result — redesign premium Fase 3.
 * Somente métricas/evidências reais de SimulatorResult.
 */
import { useNavigate } from 'react-router-dom';
import { BottomNav } from '@/components/layout/BottomNav';
import { GlassCard, glassStyle } from '@/components/ui/GlassCard';
import { ProgressRing } from '@/components/ui/ProgressRing';
import { readSimulatorResult } from '@/services/teacher/SimulatorIntent';

export function SimulatorResultPage() {
  const navigate = useNavigate();
  const result = readSimulatorResult();

  if (!result) {
    return (
      <div className="flex flex-col h-full max-w-md mx-auto items-center justify-center px-6 dt-page">
        <p className="text-[#94A3B8] text-center">Nenhum resultado de simulação encontrado.</p>
        <button
          type="button"
          onClick={() => navigate('/simulador')}
          className="mt-4 px-5 py-3 rounded-[14px] text-white font-semibold"
          style={glassStyle}
        >
          Voltar ao simulador
        </button>
      </div>
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
    strengthLines.push(`${g} benutzt`);
  }
  if (result.scenario?.titleDe) {
    strengthLines.push(`Über ${result.scenario.titleDe} gesprochen`);
  }
  if (result.responsesProduced > 0) {
    strengthLines.push(`${result.responsesProduced} Produktionen`);
  }

  return (
    <div className="flex flex-col h-full max-w-md mx-auto dt-page">
      <header className="px-5 pt-4 safe-top shrink-0">
        <h1 className="text-[18px] font-bold text-white font-[family-name:var(--font-display)]">
          SIMULATION BEENDET
        </h1>
        <p className="text-[12px] text-[#CBD5E1] mt-0.5">
          {result.scenario.emoji} {result.scenario.titleDe}
        </p>
      </header>

      <main className="flex-1 overflow-y-auto scrollbar-hide px-5 pt-5 pb-28 space-y-5">
        <GlassCard variant="cyan" className="p-6 flex flex-col items-center relative overflow-hidden">
          <span
            className="absolute -top-16 w-52 h-52 rounded-full pointer-events-none"
            style={{ background: 'radial-gradient(circle, rgba(0,242,254,0.28), transparent 70%)' }}
          />
          <ProgressRing
            value={leistungPct ?? 0}
            size={128}
            stroke={10}
            color="#00F2FE"
            label={leistungPct != null ? `${leistungPct}%` : '—'}
          />
          <p className="relative mt-3 dt-label">Leistung</p>
          <p className="relative text-[12px] text-[#64748B] mt-1">
            {leistungPct != null
              ? 'Autonomie in dieser Session'
              : 'Noch keine Produktionen — Leistung nicht berechenbar'}
          </p>
        </GlassCard>

        <div className="grid grid-cols-2 gap-2.5">
          <MetricCard label="Autonomie" value={autonomousPct != null ? `${autonomousPct}%` : '—'} />
          <MetricCard label="Hilfen" value={String(result.helpCount)} />
          <MetricCard label="Inhalte genutzt" value={String(result.contentsUsed.length)} />
          <MetricCard label="Tempo" value={`${result.elapsedMinutes} min`} />
          <MetricCard label="Produktionen" value={String(result.responsesProduced)} />
          <MetricCard label="Korrekturen" value={String(result.correctionCount)} />
        </div>

        {teacherTalkPct != null && (
          <GlassCard className="p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="dt-label">Teacher Talk</p>
                <p className="text-[28px] font-bold text-white tabular-nums mt-1">{teacherTalkPct}%</p>
                <p className="text-[12px] text-[#CBD5E1] mt-1">
                  {teacherTalkPct <= 35
                    ? 'Du hast mehr gesprochen.'
                    : 'Ziel ≈ ≤35% — nur Signal, kein Mastery.'}
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
                  border: `1px solid ${teacherTalkPct <= 35 ? 'rgba(34,197,94,0.4)' : 'rgba(245,158,11,0.4)'}`,
                }}
              >
                {teacherTalkPct <= 35 ? 'OK' : '!'}
              </div>
            </div>
          </GlassCard>
        )}

        {strengthLines.length > 0 && (
          <section>
            <p className="dt-label mb-2">Stärken</p>
            <GlassCard className="p-4 space-y-2">
              {strengthLines.map((line) => (
                <p key={line} className="text-[14px] text-white flex gap-2">
                  <span className="text-[#22C55E]">✓</span>
                  <span className="truncate">{line}</span>
                </p>
              ))}
            </GlassCard>
          </section>
        )}

        <section>
          <p className="dt-label mb-2">Nächster Schritt</p>
          <GlassCard className="p-4">
            {nextStep ? (
              <p className="text-[15px] font-semibold text-white">
                {'german' in nextStep ? nextStep.german : nextStep}
              </p>
            ) : (
              <p className="text-[14px] text-[#64748B]">—</p>
            )}
            {result.deferredToReview.length > 0 && (
              <p className="text-[12px] text-[#94A3B8] mt-2">
                {result.deferredToReview.length} für spätere Revision markiert
              </p>
            )}
          </GlassCard>
        </section>

        <button
          type="button"
          onClick={() => navigate(nextStep ? '/revisar' : '/aprender')}
          className="w-full py-4 rounded-[20px] text-[15px] font-bold text-[#050816] active:scale-[0.98] transition-transform duration-200"
          style={{
            background: 'linear-gradient(135deg, #00F2FE, #8B5CF6)',
            boxShadow: '0 0 28px rgba(0,242,254,0.35)',
          }}
        >
          Weiter üben
        </button>
      </main>
      <BottomNav />
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <GlassCard className="p-4">
      <p className="text-[10px] uppercase tracking-wide text-[#64748B]">{label}</p>
      <p className="text-[20px] font-bold text-white mt-1 tabular-nums">{value}</p>
    </GlassCard>
  );
}
