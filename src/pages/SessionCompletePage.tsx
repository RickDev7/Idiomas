/**
 * Sessão concluída — tela premium reutilizável (dados via SessionCompleteStore).
 */
import { useNavigate } from 'react-router-dom';
import { BottomNav } from '@/components/layout/BottomNav';
import { GlassCard, glassStyle } from '@/components/ui/GlassCard';
import { ProgressRing } from '@/components/ui/ProgressRing';
import {
  readSessionComplete,
  clearSessionComplete,
} from '@/services/ui/SessionCompleteStore';

export function SessionCompletePage() {
  const navigate = useNavigate();
  const data = readSessionComplete();

  if (!data) {
    return (
      <div className="flex flex-col h-full max-w-md mx-auto items-center justify-center px-6 dt-page">
        <p className="text-[#94A3B8] text-center">Keine Session-Zusammenfassung gefunden.</p>
        <button
          type="button"
          onClick={() => navigate('/')}
          className="mt-4 px-5 py-3 rounded-[14px] text-white font-semibold"
          style={glassStyle}
        >
          Zur Startseite
        </button>
      </div>
    );
  }

  const name = data.name?.trim() || 'Learner';
  const ringValue = data.autonomyPct != null ? data.autonomyPct : null;

  const done = () => {
    clearSessionComplete();
    navigate('/');
  };

  return (
    <div className="flex flex-col h-full max-w-md mx-auto dt-page">
      <header className="px-5 pt-6 safe-top shrink-0 text-center">
        <h1 className="text-[18px] font-bold text-white font-[family-name:var(--font-display)]">
          {data.headline || 'TRAINING ABGESCHLOSSEN'}
        </h1>
        <p className="text-[14px] text-[#CBD5E1] mt-2">Sehr gut, {name}!</p>
      </header>

      <main className="flex-1 overflow-y-auto scrollbar-hide px-5 pt-4 pb-28 space-y-5">
        <GlassCard variant="cyan" className="p-6 flex flex-col items-center relative overflow-hidden">
          <span
            className="absolute -top-16 w-52 h-52 rounded-full pointer-events-none"
            style={{ background: 'radial-gradient(circle, rgba(0,242,254,0.3), transparent 70%)' }}
          />
          <ProgressRing
            value={ringValue ?? 0}
            size={120}
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
          <p className="relative mt-3 dt-label">Session beendet</p>
        </GlassCard>

        <div className="grid grid-cols-2 gap-2.5">
          <Metric label="Zeit" value={data.minutes != null ? `${data.minutes} min` : '—'} />
          <Metric
            label="Strukturen"
            value={data.structures != null ? String(data.structures) : '—'}
          />
          <Metric
            label="Variationen"
            value={data.variations != null ? String(data.variations) : '—'}
          />
          <Metric
            label="Autonomie"
            value={data.autonomyPct != null ? `${data.autonomyPct}%` : '—'}
          />
        </div>

        {data.improved && data.improved.length > 0 && (
          <section>
            <p className="dt-label mb-2">Heute verbessert</p>
            <GlassCard className="p-4 space-y-2">
              {data.improved.slice(0, 8).map((g) => (
                <p key={g} className="text-[14px] text-white flex gap-2">
                  <span className="text-[#22C55E]">+</span>
                  <span className="truncate">{g}</span>
                </p>
              ))}
            </GlassCard>
          </section>
        )}

        {(data.nextStep?.trim() || (data.streak != null && data.streak > 0)) && (
          <section>
            <p className="dt-label mb-2">Nächster Schritt</p>
            <GlassCard className="p-4">
              {data.nextStep?.trim() ? (
                <p className="text-[14px] text-white">{data.nextStep.trim()}</p>
              ) : null}
              {data.streak != null && data.streak > 0 && (
                <p className={`text-[12px] text-[#F97316] ${data.nextStep?.trim() ? 'mt-2' : ''}`}>
                  🔥 {data.streak} Sequenz
                </p>
              )}
            </GlassCard>
          </section>
        )}

        <button
          type="button"
          onClick={() => {
            clearSessionComplete();
            navigate('/aprender');
          }}
          className="w-full py-4 rounded-[20px] text-[15px] font-bold text-[#050816] active:scale-[0.98] transition-transform duration-200"
          style={{
            background: 'linear-gradient(135deg, #00F2FE, #8B5CF6)',
            boxShadow: '0 0 28px rgba(0,242,254,0.35)',
          }}
        >
          Weiter üben
        </button>

        <button
          type="button"
          onClick={done}
          className="w-full py-3.5 rounded-[18px] text-[14px] font-semibold text-white"
          style={glassStyle}
        >
          Fertig
        </button>
      </main>
      <BottomNav />
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <GlassCard className="p-4">
      <p className="text-[10px] uppercase tracking-wide text-[#64748B]">{label}</p>
      <p className="text-[18px] font-bold text-white mt-1 tabular-nums">{value}</p>
    </GlassCard>
  );
}
