import { useNavigate } from 'react-router-dom';
import { BottomNav } from '@/components/layout/BottomNav';
import { readSimulatorResult } from '@/services/teacher/SimulatorIntent';
import type { CSSProperties } from 'react';

const GLASS: CSSProperties = {
  background: 'rgba(15, 23, 42, 0.65)',
  border: '1px solid rgba(255, 255, 255, 0.08)',
  backdropFilter: 'blur(16px)',
  WebkitBackdropFilter: 'blur(16px)',
};

export function SimulatorResultPage() {
  const navigate = useNavigate();
  const result = readSimulatorResult();

  if (!result) {
    return (
      <div className="flex flex-col h-full max-w-md mx-auto items-center justify-center px-6" style={{ background: '#070A12' }}>
        <p className="text-[#94A3B8] text-center">Nenhum resultado de simulação encontrado.</p>
        <button
          type="button"
          onClick={() => navigate('/simulador')}
          className="mt-4 px-5 py-3 rounded-[14px] text-white font-semibold"
          style={GLASS}
        >
          Voltar ao simulador
        </button>
      </div>
    );
  }

  const autonomousPct =
    result.responsesProduced > 0
      ? Math.round((result.autonomousCount / result.responsesProduced) * 100)
      : 0;

  return (
    <div className="flex flex-col h-full max-w-md mx-auto" style={{ background: '#070A12' }}>
      <header className="px-5 pt-4 safe-top shrink-0">
        <h1 className="text-[17px] font-bold text-white font-[family-name:var(--font-display)]">
          🎯 SIMULAÇÃO CONCLUÍDA
        </h1>
        <p className="text-[12px] text-[#94A3B8] mt-0.5">
          {result.scenario.emoji} {result.scenario.titlePt}
        </p>
      </header>

      <main className="flex-1 overflow-y-auto scrollbar-hide px-5 pt-5 pb-28 space-y-5">
        <div className="rounded-[22px] p-5 grid grid-cols-2 gap-3" style={GLASS}>
          <Stat label="Tempo" value={`${result.elapsedMinutes} min`} />
          <Stat label="Oportunidades" value={String(result.speechOpportunities)} />
          <Stat label="Produções" value={String(result.responsesProduced)} />
          <Stat label="Autonomia" value={`${autonomousPct}%`} />
          <Stat label="Precisou de ajuda" value={String(result.helpCount)} />
          <Stat label="Correções" value={String(result.correctionCount)} />
          <Stat label="Conteúdos usados" value={String(result.contentsUsed.length)} />
        </div>

        {result.contentsUsed.length > 0 && (
          <section>
            <p className="text-[11px] uppercase tracking-[0.16em] font-semibold text-[#64748b] mb-2">
              O que você conseguiu usar
            </p>
            <div className="rounded-[20px] p-4 space-y-2" style={GLASS}>
              {result.contentsUsed.slice(0, 8).map((g) => (
                <p key={g} className="text-[14px] text-white flex gap-2">
                  <span className="text-[#10B981]">✓</span>
                  <span className="truncate">{g}</span>
                </p>
              ))}
            </div>
          </section>
        )}

        {result.needsPractice.length > 0 && (
          <section>
            <p className="text-[11px] uppercase tracking-[0.16em] font-semibold text-[#64748b] mb-2">
              Precisa de mais prática
            </p>
            <div className="rounded-[20px] p-4 space-y-2" style={GLASS}>
              {result.needsPractice.map((w) => (
                <p key={w.phraseId} className="text-[14px] text-white flex gap-2">
                  <span className="text-[#FBBF24]">⚠</span>
                  <span className="truncate">{w.german}</span>
                </p>
              ))}
            </div>
          </section>
        )}

        {result.deferredToReview.length > 0 && (
          <section>
            <p className="text-[11px] uppercase tracking-[0.16em] font-semibold text-[#64748b] mb-2">
              Enviados para revisão futura
            </p>
            <div className="rounded-[20px] p-4 space-y-2" style={GLASS}>
              {result.deferredToReview.map((w) => (
                <p key={w.phraseId} className="text-[14px] text-[#94A3B8]">
                  {w.german}
                </p>
              ))}
            </div>
          </section>
        )}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => navigate('/revisar')}
            className="flex-1 py-3 rounded-[14px] text-[14px] font-semibold text-white"
            style={GLASS}
          >
            Revisar
          </button>
          <button
            type="button"
            onClick={() => navigate('/simulador')}
            className="flex-1 py-3 rounded-[14px] text-[14px] font-bold text-[#070A12]"
            style={{ background: 'linear-gradient(90deg, #00F2FE, #8B5CF6)' }}
          >
            Nova simulação
          </button>
        </div>
      </main>
      <BottomNav />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-[#64748b]">{label}</p>
      <p className="text-[18px] font-bold text-white mt-0.5">{value}</p>
    </div>
  );
}
