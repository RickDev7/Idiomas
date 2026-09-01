import { useNavigate } from 'react-router-dom';
import { BottomNav } from '@/components/layout/BottomNav';
import { readMiniProvaResult } from '@/services/teacher/MiniProvaIntent';
import type { CSSProperties } from 'react';

const GLASS: CSSProperties = {
  background: 'rgba(15, 23, 42, 0.65)',
  border: '1px solid rgba(255, 255, 255, 0.08)',
  backdropFilter: 'blur(16px)',
  WebkitBackdropFilter: 'blur(16px)',
};

export function MiniProvaResultPage() {
  const navigate = useNavigate();
  const result = readMiniProvaResult();

  if (!result) {
    return (
      <div className="flex flex-col h-full max-w-md mx-auto items-center justify-center px-6" style={{ background: '#070A12' }}>
        <p className="text-[#94A3B8] text-center">Kein Prüfungsergebnis gefunden.</p>
        <button
          type="button"
          onClick={() => navigate('/mini-prova')}
          className="mt-4 px-5 py-3 rounded-[14px] text-white font-semibold"
          style={GLASS}
        >
          Zurück
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full max-w-md mx-auto" style={{ background: '#070A12' }}>
      <header className="px-5 pt-4 safe-top shrink-0">
        <h1 className="text-[17px] font-bold text-white font-[family-name:var(--font-display)]">
          MINI PROVA ABGESCHLOSSEN
        </h1>
        <p className="text-[12px] text-[#94A3B8] mt-0.5">Dein Ergebnis</p>
      </header>

      <main className="flex-1 overflow-y-auto scrollbar-hide px-5 pt-5 pb-28 space-y-5">
        <div className="rounded-[22px] p-5 text-center" style={GLASS}>
          <p className="text-[11px] uppercase tracking-[0.16em] text-[#64748b]">Gesamt</p>
          <p className="text-[32px] font-bold text-white mt-1">
            {result.correctCount} / {result.totalQuestions}
          </p>
        </div>

        <div className="rounded-[22px] p-5 grid grid-cols-2 gap-3" style={GLASS}>
          <Stat label="Verstehen" value={`${result.comprehensionPercent}%`} />
          <Stat label="Sprechen" value={`${result.speakingPercent}%`} />
          <Stat label="Satzbildung" value={`${result.sentencePercent}%`} />
          <Stat label="Variationen" value={`${result.variationPercent}%`} />
          <Stat label="Autonomie" value={`${result.autonomyPercent}%`} />
          <Stat label="Geprüfte Inhalte" value={String(result.contentsChecked)} />
        </div>

        {result.strengths.length > 0 && (
          <section>
            <p className="text-[11px] uppercase tracking-[0.16em] font-semibold text-[#64748b] mb-2">
              Stärken
            </p>
            <div className="rounded-[20px] p-4 space-y-2" style={GLASS}>
              {result.strengths.map((g) => (
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
              Noch üben
            </p>
            <div className="rounded-[20px] p-4 space-y-2" style={GLASS}>
              {result.needsPractice.map((g) => (
                <p key={g} className="text-[14px] text-white flex gap-2">
                  <span className="text-[#FBBF24]">↻</span>
                  <span className="truncate">{g}</span>
                </p>
              ))}
            </div>
          </section>
        )}

        {result.difficult.length > 0 && (
          <section>
            <p className="text-[11px] uppercase tracking-[0.16em] font-semibold text-[#64748b] mb-2">
              Schwierig
            </p>
            <div className="rounded-[20px] p-4 space-y-2" style={GLASS}>
              {result.difficult.map((g) => (
                <p key={g} className="text-[14px] text-[#94A3B8]">{g}</p>
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
            Üben
          </button>
          <button
            type="button"
            onClick={() => navigate('/mini-prova')}
            className="flex-1 py-3 rounded-[14px] text-[14px] font-bold text-[#070A12]"
            style={{ background: 'linear-gradient(90deg, #A855F7, #00F2FE)' }}
          >
            Nochmal
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
