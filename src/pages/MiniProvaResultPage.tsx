/**
 * Mini Prova Result — redesign premium Fase 3.
 * Alinhado visualmente ao SimulatorResultPage.
 */
import { useNavigate } from 'react-router-dom';
import { BottomNav } from '@/components/layout/BottomNav';
import { GlassCard, glassStyle } from '@/components/ui/GlassCard';
import { ProgressRing } from '@/components/ui/ProgressRing';
import { readMiniProvaResult } from '@/services/teacher/MiniProvaIntent';

export function MiniProvaResultPage() {
  const navigate = useNavigate();
  const result = readMiniProvaResult();

  if (!result) {
    return (
      <div className="flex flex-col h-full max-w-md mx-auto items-center justify-center px-6 dt-page">
        <p className="text-[#94A3B8] text-center">Kein Prüfungsergebnis gefunden.</p>
        <button
          type="button"
          onClick={() => navigate('/mini-prova')}
          className="mt-4 px-5 py-3 rounded-[14px] text-white font-semibold"
          style={glassStyle}
        >
          Zurück
        </button>
      </div>
    );
  }

  const overallPct =
    result.totalQuestions > 0
      ? Math.round((result.correctCount / result.totalQuestions) * 100)
      : 0;

  const metrics = [
    { label: 'Autonomie', value: result.autonomyPercent },
    { label: 'Verstehen', value: result.comprehensionPercent },
    { label: 'Produktion', value: result.speakingPercent },
    { label: 'Satzbildung', value: result.sentencePercent },
    { label: 'Variationen', value: result.variationPercent },
  ];

  const nochUeben = [...result.needsPractice, ...result.difficult].filter(
    (v, i, arr) => arr.indexOf(v) === i,
  );

  return (
    <div className="flex flex-col h-full max-w-md mx-auto dt-page">
      <header className="px-5 pt-4 safe-top shrink-0">
        <h1 className="text-[18px] font-bold text-white font-[family-name:var(--font-display)]">
          ERGEBNIS
        </h1>
        <p className="text-[12px] text-[#CBD5E1] mt-0.5">MINI-PRÜFUNG abgeschlossen</p>
      </header>

      <main className="flex-1 overflow-y-auto scrollbar-hide px-5 pt-5 pb-28 space-y-5">
        <GlassCard variant="violet" className="p-6 flex flex-col items-center relative overflow-hidden">
          <span
            className="absolute -top-16 w-52 h-52 rounded-full pointer-events-none"
            style={{ background: 'radial-gradient(circle, rgba(139,92,246,0.4), transparent 70%)' }}
          />
          <ProgressRing
            value={overallPct}
            size={128}
            stroke={10}
            color="#8B5CF6"
            label={`${overallPct}%`}
          />
          <p className="relative mt-3 dt-label">Gesamt</p>
          <p className="relative text-[13px] text-[#CBD5E1] tabular-nums mt-1">
            {result.correctCount} / {result.totalQuestions} richtig
          </p>
        </GlassCard>

        <div className="grid grid-cols-2 gap-2.5">
          {metrics.map((m) => (
            <GlassCard key={m.label} className="p-4">
              <p className="text-[10px] uppercase tracking-wide text-[#64748B]">{m.label}</p>
              <p className="text-[22px] font-bold text-white mt-1 tabular-nums">
                {Math.round(m.value)}%
              </p>
              <div
                className="mt-2 h-[4px] rounded-full overflow-hidden"
                style={{ background: 'rgba(255,255,255,0.08)' }}
              >
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${Math.min(100, Math.max(0, m.value))}%`,
                    background: 'linear-gradient(90deg, #00F2FE, #8B5CF6)',
                  }}
                />
              </div>
            </GlassCard>
          ))}
          <GlassCard className="p-4">
            <p className="text-[10px] uppercase tracking-wide text-[#64748B]">Geprüft</p>
            <p className="text-[22px] font-bold text-white mt-1 tabular-nums">
              {result.contentsChecked}
            </p>
          </GlassCard>
        </div>

        {result.strengths.length > 0 && (
          <section>
            <p className="dt-label mb-2">Stärken</p>
            <GlassCard className="p-4 space-y-2">
              {result.strengths.map((g) => (
                <p key={g} className="text-[14px] text-white flex gap-2">
                  <span className="text-[#22C55E]">✓</span>
                  <span className="truncate">{g}</span>
                </p>
              ))}
            </GlassCard>
          </section>
        )}

        {nochUeben.length > 0 && (
          <section>
            <p className="dt-label mb-2">Noch üben</p>
            <GlassCard className="p-4 space-y-2">
              {nochUeben.slice(0, 8).map((g) => (
                <p key={g} className="text-[14px] text-white flex gap-2">
                  <span className="text-[#EC4899]">↻</span>
                  <span className="truncate">{g}</span>
                </p>
              ))}
            </GlassCard>
          </section>
        )}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => navigate('/revisar')}
            className="flex-1 py-3.5 rounded-[16px] text-[14px] font-semibold text-white"
            style={glassStyle}
          >
            Üben
          </button>
          <button
            type="button"
            onClick={() => navigate('/aprender')}
            className="flex-1 py-3.5 rounded-[16px] text-[14px] font-bold text-white"
            style={{
              background: 'linear-gradient(90deg, #8B5CF6, #00F2FE)',
              boxShadow: '0 0 20px rgba(139,92,246,0.35)',
            }}
          >
            Weiterlernen
          </button>
        </div>
      </main>
      <BottomNav />
    </div>
  );
}
