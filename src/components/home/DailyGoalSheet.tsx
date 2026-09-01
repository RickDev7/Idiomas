import { useEffect, useState, type CSSProperties } from 'react';
import { GOAL_PRESETS } from '@/services/learning/DailyGoalStore';

const GLASS: CSSProperties = {
  background: 'rgba(15, 23, 42, 0.92)',
  border: '1px solid rgba(255, 255, 255, 0.08)',
  backdropFilter: 'blur(16px)',
  WebkitBackdropFilter: 'blur(16px)',
};

export interface DailyGoalSheetProps {
  open: boolean;
  mode: 'edit' | 'morning';
  currentGoal: number;
  onSelect: (minutes: number) => void;
  onClose: () => void;
}

export function DailyGoalSheet({
  open,
  mode,
  currentGoal,
  onSelect,
  onClose,
}: DailyGoalSheetProps) {
  const [custom, setCustom] = useState(false);
  const [customValue, setCustomValue] = useState(String(currentGoal));

  useEffect(() => {
    if (open) {
      setCustom(false);
      setCustomValue(String(currentGoal));
    }
  }, [open, currentGoal]);

  if (!open) return null;

  const title =
    mode === 'morning'
      ? 'Quanto tempo temos para hoje?'
      : 'Ajustar meta do dia';

  const pick = (minutes: number) => {
    onSelect(minutes);
    onClose();
  };

  const applyCustom = () => {
    const n = parseInt(customValue, 10);
    if (!Number.isFinite(n) || n < 5 || n > 120) return;
    pick(n);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <button
        type="button"
        aria-label="Fechar"
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
      />
      <div
        className="relative w-full max-w-md mx-auto rounded-t-[28px] px-5 pt-5 pb-8 safe-bottom animate-slide-up"
        style={GLASS}
        role="dialog"
        aria-modal="true"
        aria-labelledby="daily-goal-title"
      >
        <div className="w-10 h-1 rounded-full bg-white/20 mx-auto mb-5" />
        <h2
          id="daily-goal-title"
          className="text-[18px] font-bold text-white text-center mb-1 font-[family-name:var(--font-display)]"
        >
          {title}
        </h2>
        {mode === 'morning' && (
          <p className="text-[13px] text-[#94A3B8] text-center mb-5">
            Escolha o tempo disponível — você pode mudar a qualquer momento.
          </p>
        )}

        {!custom ? (
          <div className="grid grid-cols-2 gap-2.5 mb-3">
            {GOAL_PRESETS.map((min) => (
              <button
                key={min}
                type="button"
                onClick={() => pick(min)}
                className="py-3.5 rounded-[16px] text-[15px] font-semibold text-white active:scale-[0.98] transition-transform"
                style={{
                  background:
                    min === currentGoal
                      ? 'linear-gradient(135deg, rgba(0,242,254,0.35), rgba(16,185,129,0.35))'
                      : 'rgba(255,255,255,0.06)',
                  border:
                    min === currentGoal
                      ? '1px solid rgba(0,242,254,0.5)'
                      : '1px solid rgba(255,255,255,0.1)',
                  boxShadow:
                    min === currentGoal ? '0 0 20px rgba(0,242,254,0.25)' : undefined,
                }}
              >
                {min} min
              </button>
            ))}
            <button
              type="button"
              onClick={() => setCustom(true)}
              className="col-span-2 py-3.5 rounded-[16px] text-[14px] font-semibold text-[#94A3B8] border border-white/10 active:scale-[0.98] transition-transform"
              style={{ background: 'rgba(255,255,255,0.04)' }}
            >
              Personalizado
            </button>
          </div>
        ) : (
          <div className="mb-3">
            <label className="block text-[12px] text-[#94A3B8] mb-2" htmlFor="custom-goal">
              Minutos (5–120)
            </label>
            <div className="flex gap-2">
              <input
                id="custom-goal"
                type="number"
                min={5}
                max={120}
                value={customValue}
                onChange={(e) => setCustomValue(e.target.value)}
                className="flex-1 rounded-[14px] px-4 py-3 text-white text-[16px] outline-none"
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.12)',
                }}
              />
              <button
                type="button"
                onClick={applyCustom}
                className="px-5 rounded-[14px] font-semibold text-[#070A12]"
                style={{
                  background: 'linear-gradient(135deg, #00F2FE, #10B981)',
                  boxShadow: '0 0 16px rgba(0,242,254,0.35)',
                }}
              >
                OK
              </button>
            </div>
            <button
              type="button"
              onClick={() => setCustom(false)}
              className="mt-3 text-[13px] text-[#64748b]"
            >
              ← Voltar às opções rápidas
            </button>
          </div>
        )}

        {mode === 'edit' && (
          <button
            type="button"
            onClick={onClose}
            className="w-full py-3 text-[14px] text-[#64748b] mt-1"
          >
            Cancelar
          </button>
        )}
      </div>
    </div>
  );
}
