import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { BottomNav } from '@/components/layout/BottomNav';
import { LevelRing } from '@/components/ui/LevelRing';
import { IconCube, IconPuzzle, IconWave, IconTarget, IconClock } from '@/components/ui/Icons';
import { useProfile } from '@/hooks/useProfile';
import { MemoryService } from '@/services/learning/MemoryService';
import {
  getCurrentLevel,
  getLevelPresentation,
  getStoredCourseProgress,
  type CourseLevelId,
} from '@/services/course';
import { getRealProgress, type RealProgress } from '@/services/learning/RealProgress';
import { getLevelAvailability } from '@/services/course/CourseUnlockService';

const GLASS: CSSProperties = {
  background: 'rgba(15, 23, 42, 0.65)',
  border: '1px solid rgba(255, 255, 255, 0.08)',
  backdropFilter: 'blur(16px)',
  WebkitBackdropFilter: 'blur(16px)',
};

const MAP_TOP: CourseLevelId[] = ['L0', 'A1', 'A2', 'B1', 'B2'];
const MAP_BOTTOM: CourseLevelId[] = ['C1', 'C2'];

const METRIC_HELP = {
  dominio:
    'Percentual médio de confiança dos itens L0 que você já estudou (produziu ou acertou). Itens não estudados não entram no cálculo.',
  chunks:
    'Ganchos L0 com pelo menos uma produção correta registrada (critério isZeroLanguagePhraseAccepted: timesCorrect ≥ 1).',
  variacoes:
    'Variações e perguntas do currículo L0 que você praticou e o sistema aceitou — não conta o que só foi apresentado.',
  autonomia:
    'Produções corretas sem ajuda imediata ÷ total de oportunidades de fala. Se não houver dados de fala, usa produções independentes do perfil.',
  revisao: 'Mesma fila usada pela tela Revisar (getReviewQueue).',
} as const;

export function ProgressPage() {
  const navigate = useNavigate();
  const { profile } = useProfile();
  const [progress, setProgress] = useState<RealProgress | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const course = getStoredCourseProgress();
  const currentLevel = profile ? getCurrentLevel(profile, course) : 'L0';
  const levelView = getLevelPresentation(currentLevel);

  useEffect(() => {
    if (!profile) return;
    let cancelled = false;
    MemoryService.loadProfile(profile)
      .then((learning) => getRealProgress(learning, currentLevel))
      .then((p) => { if (!cancelled) setProgress(p); })
      .catch(() => { if (!cancelled) setProgress(null); });
    return () => { cancelled = true; };
  }, [profile, currentLevel]);

  const domainPct = progress?.masteryPercent ?? 0;
  const domainDisplay = progress?.masteryPercent != null ? `${domainPct}` : '—';
  const autonomyDisplay =
    progress?.autonomousSpeechPercent != null
      ? `${progress.autonomousSpeechPercent}%`
      : '—';

  const shareProgress = async () => {
    const text =
      progress?.masteryPercent != null
        ? `Meu domínio no Deutsch Turbo: ${domainPct}% · Nível ${currentLevel}`
        : `Deutsch Turbo · Nível ${currentLevel}`;
    try {
      if (navigator.share) await navigator.share({ title: 'Deutsch Turbo', text });
      else await navigator.clipboard?.writeText(text);
    } catch {
      /* ignore cancel */
    }
  };

  const dailyGoalPct = progress
    ? Math.min(
        100,
        Math.round(
          (progress.studyMinutesToday / Math.max(1, progress.dailyGoalMinutes)) * 100,
        ),
      )
    : 0;

  return (
    <div className="flex flex-col h-full max-w-md mx-auto" style={{ background: '#070A12' }}>
      <header className="px-5 pt-4 safe-top shrink-0 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[17px] font-bold text-white leading-tight font-[family-name:var(--font-display)]">
            PROGRESSO
          </h1>
          <p className="text-[12px] text-[#94A3B8] mt-0.5">Seu mapa de domínio</p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setHelpOpen((v) => !v)}
            aria-label="Explicar métricas"
            className="w-10 h-10 rounded-full flex items-center justify-center text-[#94A3B8] text-[15px] font-bold"
            style={GLASS}
          >
            ?
          </button>
          <button
            type="button"
            onClick={shareProgress}
            aria-label="Compartilhar"
            className="w-10 h-10 rounded-full flex items-center justify-center text-[#94A3B8]"
            style={GLASS}
          >
            <ShareIcon />
          </button>
        </div>
      </header>

      {helpOpen && (
        <div className="px-5 pb-2 animate-slide-up">
          <div className="rounded-[18px] p-4 text-[12px] text-[#94A3B8] leading-relaxed space-y-2" style={GLASS}>
            <p><strong className="text-white">Domínio:</strong> {METRIC_HELP.dominio}</p>
            <p><strong className="text-white">Chunks aprendidos:</strong> {METRIC_HELP.chunks}</p>
            <p><strong className="text-white">Variações praticadas:</strong> {METRIC_HELP.variacoes}</p>
            <p><strong className="text-white">Fala autônoma:</strong> {METRIC_HELP.autonomia}</p>
            <p><strong className="text-white">Revisão:</strong> {METRIC_HELP.revisao}</p>
          </div>
        </div>
      )}

      <main className="flex-1 overflow-y-auto scrollbar-hide px-5 pt-5 pb-28">
        <div className="rounded-[28px] p-6 flex flex-col items-center animate-slide-up" style={GLASS}>
          <LevelRing
            value={progress?.masteryPercent ?? 0}
            levelDisplay={currentLevel === 'L0' ? 'L0' : currentLevel}
            areaLabel="de domínio"
            badge={levelView.label || 'Iniciante'}
            badgeClass="bg-success/15 text-success"
            gradientFrom="#00F2FE"
            gradientMid="#3B82F6"
            gradientTo="#8B5CF6"
            centerIcon={<span aria-hidden>🌱</span>}
          />
          <p className="mt-3 text-center text-[12px] text-[#94A3B8] leading-snug px-2">
            {progress?.masteryPercent != null ? (
              <>
                <span className="text-[22px] font-bold text-white">{domainDisplay}%</span>
                {' · '}
                {progress.masteryDetail}
              </>
            ) : (
              <span className="text-[#64748b]">Em construção — comece a praticar para ver seu domínio</span>
            )}
          </p>
        </div>

        <section className="mt-5 space-y-2.5">
          <p className="text-[11px] uppercase tracking-[0.16em] font-semibold text-[#64748b] mb-1">Resumo geral</p>
          <SummaryRow
            icon={<IconCube size={20} />}
            color="#8B5CF6"
            value={progress ? String(progress.learnedChunks) : '—'}
            label={
              progress
                ? `Chunks aprendidos (${progress.learnedChunks}/${progress.learnedChunksTotal})`
                : 'Chunks aprendidos'
            }
          />
          <SummaryRow
            icon={<IconPuzzle size={20} />}
            color="#10B981"
            value={progress ? String(progress.variationsPracticed) : '—'}
            label={
              progress
                ? `Variações praticadas (${progress.variationsPracticed}/${progress.variationsTotal})`
                : 'Variações praticadas'
            }
          />
          <SummaryRow
            icon={<IconWave size={20} />}
            color="#FF512F"
            value={autonomyDisplay}
            label={
              progress?.autonomousSpeechPercent == null
                ? 'Fala autônoma — dados insuficientes'
                : 'Fala autônoma'
            }
            sub={progress?.autonomousSpeechDetail}
          />
          {progress && progress.reviewQueueCount > 0 && (
            <button
              type="button"
              onClick={() => navigate('/revisao')}
              className="w-full text-left"
            >
              <SummaryRow
                icon={<IconTarget size={20} />}
                color="#FBBF24"
                value={String(progress.reviewQueueCount)}
                label="itens precisam de revisão"
                interactive
              />
            </button>
          )}
          {progress && (
            <SummaryRow
              icon={<IconClock size={20} />}
              color="#38bdf8"
              value={`${progress.studyMinutesToday} min`}
              label={`Estudados hoje · total ${progress.studyMinutesTotal} min`}
            />
          )}
        </section>

        {progress && progress.recentAdvances.length > 0 && (
          <section className="mt-6">
            <p className="text-[11px] uppercase tracking-[0.16em] font-semibold text-[#64748b] mb-3">
              Seus últimos avanços
            </p>
            <div className="rounded-[22px] p-4 space-y-2" style={GLASS}>
              {progress.recentAdvances.map((a) => (
                <p key={a.phraseId} className="text-[14px] text-white flex items-center gap-2">
                  <span className="text-[#10B981]">✓</span>
                  <span className="truncate">{a.german}</span>
                </p>
              ))}
              {progress.newChunksThisWeek != null && progress.newChunksThisWeek > 0 && (
                <p className="text-[12px] text-[#94A3B8] pt-1">
                  Você aprendeu {progress.newChunksThisWeek} novo{progress.newChunksThisWeek > 1 ? 's' : ''} chunk{progress.newChunksThisWeek > 1 ? 's' : ''} esta semana.
                </p>
              )}
            </div>
          </section>
        )}

        {progress && progress.weakAreas.length > 0 && (
          <section className="mt-6">
            <p className="text-[11px] uppercase tracking-[0.16em] font-semibold text-[#64748b] mb-3">
              Precisa de mais prática
            </p>
            <div className="rounded-[22px] p-4 space-y-2" style={GLASS}>
              {progress.weakAreas.map((w) => (
                <button
                  key={w.phraseId}
                  type="button"
                  onClick={() => navigate('/revisao')}
                  className="w-full text-left text-[14px] text-white flex items-center gap-2 active:opacity-80"
                >
                  <span className="text-[#FBBF24]">⚠</span>
                  <span className="truncate flex-1">{w.german}</span>
                  <span className="text-[10px] text-[#64748b] shrink-0">{w.reason}</span>
                </button>
              ))}
            </div>
          </section>
        )}

        <section className="mt-6">
          <p className="text-[11px] uppercase tracking-[0.16em] font-semibold text-[#64748b] mb-3">Mapa de níveis</p>
          <div className="rounded-[24px] p-5" style={GLASS}>
            <div className="flex items-center justify-between">
              {MAP_TOP.map((lvl, i) => {
                const entry = progress?.levelProgress.find((l) => l.level === lvl);
                const availability = entry?.availability ?? getLevelAvailability(lvl, currentLevel);
                const isActive = availability === 'current';
                const isDone = availability === 'completed';
                const locked = availability === 'locked';
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
                            : isDone
                              ? {
                                  background: 'rgba(16,185,129,0.2)',
                                  color: '#10B981',
                                  border: '1px solid rgba(16,185,129,0.45)',
                                }
                              : {
                                  background: 'rgba(255,255,255,0.04)',
                                  color: '#64748b',
                                  border: '1px solid rgba(255,255,255,0.1)',
                                }
                        }
                      >
                        {locked ? '🔒' : isDone ? '✓' : lvl}
                      </span>
                      <span className={`text-[9px] mt-1.5 font-semibold ${isActive ? 'text-[#c4b5fd]' : 'text-[#64748b]'}`}>
                        {lvl}
                      </span>
                      {isActive && entry?.progressPercent != null && (
                        <span className="text-[8px] text-[#94A3B8] mt-0.5">{entry.progressPercent}%</span>
                      )}
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
              {MAP_BOTTOM.map((lvl) => {
                const availability = getLevelAvailability(lvl, currentLevel);
                const locked = availability === 'locked';
                return (
                  <div key={lvl} className="flex flex-col items-center">
                    <span
                      className="w-9 h-9 rounded-full flex items-center justify-center text-[10px] font-bold"
                      style={{
                        background: locked ? 'rgba(255,255,255,0.04)' : 'rgba(16,185,129,0.15)',
                        color: locked ? '#64748b' : '#10B981',
                        border: `1px solid ${locked ? 'rgba(255,255,255,0.1)' : 'rgba(16,185,129,0.35)'}`,
                      }}
                    >
                      {locked ? '🔒' : '✓'}
                    </span>
                    <span className="text-[9px] mt-1.5 font-semibold text-[#64748b]">{lvl}</span>
                  </div>
                );
              })}
            </div>
            {progress && (
              <p className="mt-4 text-[11px] text-[#64748b] text-center leading-snug">
                {progress.levelProgress.find((l) => l.level === 'L0')?.detail}
              </p>
            )}
          </div>
        </section>

        {progress && progress.activityDays.length > 0 && (
          <section className="mt-6">
            <p className="text-[11px] uppercase tracking-[0.16em] font-semibold text-[#64748b] mb-3">
              Atividade recente
            </p>
            <div className="rounded-[22px] p-4 space-y-3" style={GLASS}>
              {progress.activityDays.map((day) => (
                <div key={day.date}>
                  <p className="text-[13px] font-semibold text-white">{day.label}</p>
                  <p className="text-[12px] text-[#94A3B8] mt-0.5">
                    {[
                      day.chunksGained > 0 && `+${day.chunksGained} chunk${day.chunksGained > 1 ? 's' : ''}`,
                      day.productions > 0 && `+${day.productions} produç${day.productions > 1 ? 'ões' : 'ão'}`,
                      day.reviews > 0 && `${day.reviews} revis${day.reviews > 1 ? 'ões' : 'ão'}`,
                    ]
                      .filter(Boolean)
                      .join(' · ') || '—'}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}

        {progress && (
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
                <p className="text-[11px] uppercase tracking-[0.12em] font-semibold text-[#64748b]">Tempo de estudo hoje</p>
                <p className="text-[14px] font-bold text-white mt-0.5">
                  {progress.studyMinutesToday} min estudados
                </p>
              </div>
              {progress.streak > 0 && (
                <span className="text-[13px] font-bold text-[#FF512F]">
                  🔥 {progress.streak}d
                </span>
              )}
            </div>
            <div className="h-2.5 rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${dailyGoalPct}%`,
                  background: 'linear-gradient(90deg, #8B5CF6, #A855F7)',
                  boxShadow: '0 0 10px rgba(139,92,246,0.5)',
                }}
              />
            </div>
            {progress.variationsToday > 0 && (
              <p className="text-[12px] text-[#94A3B8] mt-2">
                {progress.variationsToday} variação{progress.variationsToday > 1 ? 'ões' : ''} praticada{progress.variationsToday > 1 ? 's' : ''} hoje
              </p>
            )}
          </section>
        )}
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
  icon, color, value, label, sub, interactive,
}: {
  icon: ReactNode;
  color: string;
  value: string;
  label: string;
  sub?: string;
  interactive?: boolean;
}) {
  return (
    <div
      className={`rounded-[18px] px-4 py-3.5 flex items-center gap-3 ${interactive ? 'active:scale-[0.98] transition-transform' : ''}`}
      style={GLASS}
    >
      <span
        className="w-11 h-11 rounded-[14px] flex items-center justify-center shrink-0"
        style={{ background: `${color}22`, color, boxShadow: `0 0 16px ${color}33` }}
      >
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[18px] font-bold text-white leading-none">{value}</p>
        <p className="text-[12px] text-[#94A3B8] mt-1">{label}</p>
        {sub && <p className="text-[10px] text-[#64748b] mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}
