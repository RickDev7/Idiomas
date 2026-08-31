import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { BottomNav } from '@/components/layout/BottomNav';
import { LevelRing } from '@/components/ui/LevelRing';
import { IconCube, IconPuzzle, IconWave, IconTarget } from '@/components/ui/Icons';
import { useProgress, useProfile } from '@/hooks/useProfile';
import { MemoryService } from '@/services/learning/MemoryService';
import { computeProgress, type ProgressSummary } from '@/services/learning/ProgressEngine';
import {
  getCurrentLevel,
  getLevelPresentation,
  getStoredCourseProgress,
  type CourseLevelId,
} from '@/services/course';

const GLASS: CSSProperties = {
  background: 'rgba(15, 23, 42, 0.65)',
  border: '1px solid rgba(255, 255, 255, 0.08)',
  backdropFilter: 'blur(16px)',
  WebkitBackdropFilter: 'blur(16px)',
};

const MAP_TOP: CourseLevelId[] = ['L0', 'A1', 'A2', 'B1', 'B2'];
const MAP_BOTTOM: CourseLevelId[] = ['C1', 'C2'];

export function ProgressPage() {
  const { progress } = useProgress();
  const { profile } = useProfile();
  const [summary, setSummary] = useState<ProgressSummary | null>(null);
  const course = getStoredCourseProgress();
  const currentLevel = profile ? getCurrentLevel(profile, course) : 'L0';
  const levelView = getLevelPresentation(currentLevel);

  useEffect(() => {
    if (!profile) return;
    MemoryService.loadProfile(profile)
      .then((learning) => setSummary(computeProgress(learning)))
      .catch(() => setSummary(null));
  }, [profile]);

  const communication = summary?.communicationScore ?? progress?.communicationScore ?? 28;
  const autonomy = Math.round(summary?.independenceScore ?? summary?.automationScore ?? 68);
  const known = 12;
  const variations = 48;
  const domainPct = Math.min(100, Math.round(communication || 28));
  const goalDone = 8;
  const goalTarget = 15;

  const shareProgress = async () => {
    const text = `Meu domínio no Deutsch Turbo: ${domainPct}% · Nível ${currentLevel}`;
    try {
      if (navigator.share) await navigator.share({ title: 'Deutsch Turbo', text });
      else await navigator.clipboard?.writeText(text);
    } catch {
      /* ignore cancel */
    }
  };

  return (
    <div className="flex flex-col h-full max-w-md mx-auto" style={{ background: '#070A12' }}>
      <header className="px-5 pt-4 safe-top shrink-0 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[17px] font-bold text-white leading-tight font-[family-name:var(--font-display)]">
            PROGRESSO
          </h1>
          <p className="text-[12px] text-[#94A3B8] mt-0.5">Seu mapa de domínio</p>
        </div>
        <button
          type="button"
          onClick={shareProgress}
          aria-label="Compartilhar"
          className="w-10 h-10 rounded-full flex items-center justify-center text-[#94A3B8] shrink-0"
          style={GLASS}
        >
          <ShareIcon />
        </button>
      </header>

      <main className="flex-1 overflow-y-auto scrollbar-hide px-5 pt-5 pb-28">
        <div className="rounded-[28px] p-6 flex flex-col items-center animate-slide-up" style={GLASS}>
          <LevelRing
            value={domainPct}
            levelDisplay={currentLevel === 'L0' ? 'L0' : currentLevel}
            areaLabel="de domínio"
            badge={levelView.label || 'Iniciante'}
            badgeClass="bg-success/15 text-success"
            gradientFrom="#00F2FE"
            gradientMid="#3B82F6"
            gradientTo="#8B5CF6"
            centerIcon={<span aria-hidden>🌱</span>}
          />
        </div>

        <section className="mt-5 space-y-2.5">
          <p className="text-[11px] uppercase tracking-[0.16em] font-semibold text-[#64748b] mb-1">Resumo geral</p>
          <SummaryRow icon={<IconCube size={20} />} color="#8B5CF6" value="12" label="Chunks aprendidos" />
          <SummaryRow icon={<IconPuzzle size={20} />} color="#10B981" value="48" label="Variações criadas" />
          <SummaryRow icon={<IconWave size={20} />} color="#FF512F" value="68%" label="Fala autônoma" />
        </section>

        <section className="mt-6">
          <p className="text-[11px] uppercase tracking-[0.16em] font-semibold text-[#64748b] mb-3">Mapa de níveis</p>
          <div className="rounded-[24px] p-5" style={GLASS}>
            <div className="flex items-center justify-between">
              {MAP_TOP.map((lvl, i) => {
                const isActive = currentLevel === lvl || (lvl === 'L0' && (!currentLevel || currentLevel === 'L0'));
                return (
                  <div key={lvl} className="flex items-center flex-1 last:flex-none">
                    <div className="flex flex-col items-center min-w-[42px]">
                      <span
                        className="w-10 h-10 rounded-full flex items-center justify-center text-[11px] font-bold"
                        style={
                          isActive
                            ? {
                                background: 'linear-gradient(145deg, #A855F7, #8B5CF6)',
                                color: '#fff',
                                boxShadow: '0 0 20px rgba(139,92,246,0.65)',
                                border: '1px solid rgba(196,181,253,0.55)',
                              }
                            : {
                                background: 'rgba(255,255,255,0.04)',
                                color: '#64748b',
                                border: '1px solid rgba(255,255,255,0.1)',
                              }
                        }
                      >
                        {isActive ? lvl : '🔒'}
                      </span>
                      <span className={`text-[9px] mt-1.5 font-semibold ${isActive ? 'text-[#c4b5fd]' : 'text-[#64748b]'}`}>
                        {lvl}
                      </span>
                    </div>
                    {i < MAP_TOP.length - 1 && (
                      <div
                        className="flex-1 h-0 mx-0.5 mb-4 border-t border-dashed"
                        style={{ borderColor: 'rgba(148,163,184,0.3)' }}
                      />
                    )}
                  </div>
                );
              })}
            </div>
            <div className="mt-5 flex justify-center gap-12">
              {MAP_BOTTOM.map((lvl) => (
                <div key={lvl} className="flex flex-col items-center">
                  <span
                    className="w-9 h-9 rounded-full flex items-center justify-center text-[10px] font-bold"
                    style={{
                      background: 'rgba(255,255,255,0.04)',
                      color: '#64748b',
                      border: '1px solid rgba(255,255,255,0.1)',
                    }}
                  >
                    🔒
                  </span>
                  <span className="text-[9px] mt-1.5 font-semibold text-[#64748b]">{lvl}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mt-6 rounded-[22px] p-4" style={GLASS}>
          <div className="flex items-center gap-3 mb-3">
            <span
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{
                background: 'rgba(139,92,246,0.22)',
                color: '#A855F7',
                boxShadow: '0 0 14px rgba(139,92,246,0.35)',
              }}
            >
              <IconTarget size={18} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] uppercase tracking-[0.12em] font-semibold text-[#64748b]">Próximo objetivo</p>
              <p className="text-[14px] font-bold text-white mt-0.5">Complete {goalTarget} variações hoje</p>
            </div>
            <span className="text-[13px] font-bold text-white">
              {goalDone} / {goalTarget}
            </span>
          </div>
          <div className="h-2.5 rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{
                width: `${(goalDone / goalTarget) * 100}%`,
                background: 'linear-gradient(90deg, #8B5CF6, #A855F7)',
                boxShadow: '0 0 10px rgba(139,92,246,0.5)',
              }}
            />
          </div>
        </section>

        <p className="sr-only">
          {known} chunks, {variations} variações, autonomia {autonomy}%
        </p>
      </main>
      <BottomNav />
    </div>
  );
}

function ShareIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <path d="M8.6 13.5 15.4 17.5M15.4 6.5 8.6 10.5" />
    </svg>
  );
}

function SummaryRow({
  icon, color, value, label,
}: { icon: ReactNode; color: string; value: string; label: string }) {
  return (
    <div className="rounded-[18px] px-4 py-3.5 flex items-center gap-3" style={GLASS}>
      <span
        className="w-11 h-11 rounded-[14px] flex items-center justify-center shrink-0"
        style={{ background: `${color}22`, color, boxShadow: `0 0 16px ${color}33` }}
      >
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[18px] font-bold text-white leading-none">{value}</p>
        <p className="text-[12px] text-[#94A3B8] mt-1">{label}</p>
      </div>
    </div>
  );
}
