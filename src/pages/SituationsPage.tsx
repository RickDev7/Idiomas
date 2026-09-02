/**
 * Situações — redesign visual Fase 2.
 * Fonte: SituationCatalog (+ SITUATIONS legado para consolidação).
 * Progresso derivado do Learning State (sem métricas inventadas).
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BottomNav } from '@/components/layout/BottomNav';
import { GlassCard, glassStyle } from '@/components/ui/GlassCard';
import { IconBack, IconBriefcase, IconHouse, IconDrop, IconWave } from '@/components/ui/Icons';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { ProgressRing } from '@/components/ui/ProgressRing';
import { useProfile } from '@/hooks/useProfile';
import { MemoryService } from '@/services/learning/MemoryService';
import { readAutomationScore } from '@/services/learning/AutomationScoreEngine';
import type { UserLearningProfile } from '@/services/learning/ConfidenceService';
import { StorageService } from '@/services/storage/StorageService';
import { SITUATIONS } from '@/data/content';
import {
  UNIFIED_SIMULATOR_SCENARIOS,
  getNormalizedSituations,
} from '@/services/teacher/ProfessorCore/SituationCatalog';
import {
  buildSimulatorContext,
  listCompatibleScenarios,
} from '@/services/teacher/SimulatorEngine';
import { storeSimulatorContext } from '@/services/teacher/SimulatorIntent';
import { zeroLanguageSeedPhrases } from '@/services/teacher/ZeroLanguageMode';

type MapNode = {
  key: string;
  titleDe: string;
  domain: string;
  scenarioId?: string;
  angle: number;
  tint: string;
  Icon: typeof IconBriefcase;
};

const MAP_NODES: MapNode[] = [
  { key: 'arbeit', titleDe: 'Arbeit', domain: 'arbeit', scenarioId: 'work', angle: -90, tint: '#F97316', Icon: IconBriefcase },
  { key: 'zuhause', titleDe: 'Zuhause', domain: 'zuhause', scenarioId: 'home', angle: -30, tint: '#8B5CF6', Icon: IconHouse },
  { key: 'einkaufen', titleDe: 'Einkaufen', domain: 'supermarkt', scenarioId: 'needs', angle: 30, tint: '#00F2FE', Icon: IconDrop },
  { key: 'restaurant', titleDe: 'Restaurant', domain: 'restaurant', scenarioId: 'food', angle: 90, tint: '#EC4899', Icon: IconDrop },
  { key: 'transport', titleDe: 'Transport', domain: 'transport', angle: 150, tint: '#22D3EE', Icon: IconWave },
  { key: 'gesundheit', titleDe: 'Gesundheit', domain: 'gesundheit', angle: 210, tint: '#22C55E', Icon: IconWave },
];

const TOPIC_HINTS: Record<string, string[]> = {
  work: ['arbeit'],
  home: ['wohn', 'hause'],
  needs: ['brauch'],
  food: ['moecht', 'essen'],
  places: ['wohn'],
  identity: ['heiss', 'komm'],
  routine: ['muss'],
  requests: ['kannst', 'hilfe'],
  help: ['hilfe'],
};

type SituationStats = {
  chunkCount: number;
  progressPct: number | null;
  relatedChunks: string[];
  settingDe: string;
  state: 'dominada' | 'aprendendo' | 'nova';
};

function isStudied(learning: UserLearningProfile, phraseId: string): boolean {
  const c = learning.phrases[phraseId];
  if (!c) return false;
  return c.timesSeen > 0 || c.timesCorrect > 0 || c.confidence > 0 || c.state !== 'new';
}

function computeStats(learning: UserLearningProfile, domain: string, scenarioId?: string): SituationStats {
  const sit = getNormalizedSituations().find((s) => s.domain === domain);
  const seeds = zeroLanguageSeedPhrases();
  const seedById = new Map(seeds.map((p) => [p.id, p]));
  const related: Array<{ german: string; score: number }> = [];
  const seen = new Set<string>();

  const pushConf = (phraseId: string) => {
    if (seen.has(phraseId) || !isStudied(learning, phraseId)) return;
    const conf = learning.phrases[phraseId];
    if (!conf) return;
    seen.add(phraseId);
    related.push({
      german: seedById.get(phraseId)?.german || phraseId,
      score: readAutomationScore(conf),
    });
  };

  const patterns = sit?.requiredPatterns || [];
  for (const conf of Object.values(learning.phrases)) {
    if (!isStudied(learning, conf.phraseId)) continue;
    const id = conf.phraseId.toLowerCase();
    const german = (seedById.get(conf.phraseId)?.german || '').toLowerCase();
    const matched = patterns.some((p) => {
      const stem = p.toLowerCase().replace(/[.…]/g, '').trim();
      if (stem.length < 3) return false;
      return german.includes(stem.toLowerCase()) || id.includes(stem.slice(0, 6).replace(/\s/g, ''));
    });
    if (matched) pushConf(conf.phraseId);
  }

  const scenario = scenarioId
    ? UNIFIED_SIMULATOR_SCENARIOS.find((s) => s.id === scenarioId)
    : undefined;
  if (related.length === 0 && scenario) {
    const hints = TOPIC_HINTS[scenario.topic] || [];
    for (const conf of Object.values(learning.phrases)) {
      const id = conf.phraseId.toLowerCase();
      if (hints.some((h) => id.includes(h))) pushConf(conf.phraseId);
    }
  }

  const chunkCount = related.length;
  const progressPct =
    chunkCount > 0
      ? Math.round(related.reduce((s, r) => s + r.score, 0) / chunkCount)
      : null;

  let state: SituationStats['state'] = 'nova';
  if (progressPct != null && progressPct >= 70 && chunkCount >= 2) state = 'dominada';
  else if (chunkCount > 0) state = 'aprendendo';

  const legacy = SITUATIONS.find((s) => {
    const map: Record<string, string> = {
      arbeit: 'work',
      zuhause: 'home',
      restaurant: 'restaurant',
      transport: 'transport',
      gesundheit: 'doctor',
      supermarkt: 'supermarket',
    };
    return s.id === map[domain] || s.category === map[domain];
  });

  return {
    chunkCount,
    progressPct,
    relatedChunks: related.slice(0, 6).map((r) => r.german),
    settingDe: sit?.settingDe || legacy?.description || '—',
    state,
  };
}

function polar(angleDeg: number, radius: number) {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: Math.cos(rad) * radius, y: Math.sin(rad) * radius };
}

export function SituationsPage() {
  const navigate = useNavigate();
  const { profile, loading } = useProfile();
  const [learning, setLearning] = useState<UserLearningProfile | null>(null);
  const [selected, setSelected] = useState<MapNode | null>(null);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    if (!profile) return;
    void MemoryService.loadProfile(profile).then(setLearning);
  }, [profile]);

  const statsByKey = useMemo(() => {
    if (!learning) return {} as Record<string, SituationStats>;
    const out: Record<string, SituationStats> = {};
    for (const node of MAP_NODES) {
      out[node.key] = computeStats(learning, node.domain, node.scenarioId);
    }
    return out;
  }, [learning]);

  if (loading || !profile || !learning) return <LoadingScreen />;

  const startSituation = async (node: MapNode) => {
    if (starting) return;
    setStarting(true);
    try {
      if (!node.scenarioId) {
        navigate('/simulador');
        return;
      }
      const phrases = await StorageService.getAllPhrases();
      const compatible = listCompatibleScenarios(learning);
      if (!compatible.some((s) => s.id === node.scenarioId)) {
        navigate('/simulador');
        return;
      }
      const ctx = buildSimulatorContext({
        learning,
        phrases,
        mode: 'learned',
        durationMinutes: 10,
        trainingStyle: 'training',
        preferredScenarioId: node.scenarioId,
      });
      if (!ctx) {
        navigate('/simulador');
        return;
      }
      storeSimulatorContext(ctx);
      navigate('/sessao?type=simulator');
    } finally {
      setStarting(false);
    }
  };

  const selectedStats = selected ? statsByKey[selected.key] : null;
  const size = 300;
  const radius = 112;

  return (
    <div className="flex flex-col h-full max-w-md mx-auto dt-page">
      <header className="px-5 pt-4 safe-top shrink-0 flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate(-1)}
          aria-label="Voltar"
          className="w-10 h-10 rounded-full flex items-center justify-center text-white"
          style={glassStyle}
        >
          <IconBack size={18} />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="text-[18px] font-bold text-white font-[family-name:var(--font-display)]">
            Situações
          </h1>
          <p className="text-[12px] text-[#CBD5E1]">Mapa da vida real</p>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto scrollbar-hide px-5 pt-2 pb-28">
        <div className="relative mx-auto" style={{ width: size, height: size }}>
          <svg className="absolute inset-0 w-full h-full" viewBox={`0 0 ${size} ${size}`} aria-hidden>
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke="rgba(139,92,246,0.25)"
              strokeWidth="1"
              strokeDasharray="4 6"
            />
            {MAP_NODES.map((node) => {
              const p = polar(node.angle, radius);
              return (
                <line
                  key={`line-${node.key}`}
                  x1={size / 2}
                  y1={size / 2}
                  x2={size / 2 + p.x}
                  y2={size / 2 + p.y}
                  stroke={`${node.tint}44`}
                  strokeWidth="1.5"
                />
              );
            })}
          </svg>

          <div
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[88px] h-[88px] rounded-full flex flex-col items-center justify-center text-center z-10"
            style={{
              ...glassStyle,
              border: '1px solid rgba(168,85,247,0.55)',
              boxShadow: '0 0 28px rgba(139,92,246,0.45)',
            }}
          >
            <span className="text-[10px] uppercase tracking-[0.12em] font-bold text-[#c4b5fd]">Situações</span>
            <span className="text-[11px] text-[#64748B] mt-0.5">{MAP_NODES.length} nós</span>
          </div>

          {MAP_NODES.map((node) => {
            const p = polar(node.angle, radius);
            const st = statsByKey[node.key];
            const glow =
              st?.state === 'dominada'
                ? `0 0 24px ${node.tint}99`
                : st?.state === 'aprendendo'
                  ? `0 0 16px ${node.tint}55`
                  : `0 0 8px ${node.tint}22`;
            const opacity = st?.state === 'nova' ? 0.55 : 1;
            return (
              <button
                key={node.key}
                type="button"
                onClick={() => setSelected(node)}
                className="absolute z-20 flex flex-col items-center gap-1 active:scale-95 transition-transform duration-200"
                style={{
                  left: size / 2 + p.x,
                  top: size / 2 + p.y,
                  transform: 'translate(-50%, -50%)',
                  opacity,
                }}
                aria-label={node.titleDe}
              >
                <span
                  className="w-14 h-14 rounded-full flex items-center justify-center text-white"
                  style={{
                    background: `linear-gradient(145deg, ${node.tint}55, rgba(15,23,42,0.9))`,
                    border: `1px solid ${node.tint}88`,
                    boxShadow: glow,
                  }}
                >
                  <node.Icon size={20} />
                </span>
                <span className="text-[10px] font-bold text-white">{node.titleDe}</span>
                <span className="text-[9px] tabular-nums text-[#64748B]">
                  {st?.progressPct != null ? `${st.progressPct}%` : '—'}
                </span>
              </button>
            );
          })}
        </div>

        <p className="mt-4 text-center text-[12px] text-[#64748B]">
          Toque em um nó para ver progresso real
        </p>
      </main>

      {selected && selectedStats && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 backdrop-blur-sm"
          onClick={() => setSelected(null)}
          role="presentation"
        >
          <div
            className="w-full max-w-md rounded-t-[28px] p-5 pb-10 animate-slide-up"
            style={{ ...glassStyle, borderBottom: 'none' }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-label={selected.titleDe}
          >
            <div className="flex items-start gap-4">
              {selectedStats.progressPct != null ? (
                <ProgressRing
                  value={selectedStats.progressPct}
                  size={84}
                  stroke={8}
                  color={selected.tint}
                  label={`${selectedStats.progressPct}%`}
                />
              ) : (
                <span
                  className="w-[84px] h-[84px] rounded-full flex items-center justify-center"
                  style={{ background: `${selected.tint}22`, color: selected.tint }}
                >
                  <selected.Icon size={28} />
                </span>
              )}
              <div className="min-w-0 flex-1 pt-1">
                <p className="dt-label mb-1">{selected.titleDe}</p>
                <h2 className="text-[18px] font-bold text-white leading-snug">
                  {selectedStats.settingDe}
                </h2>
                <p className="text-[12px] text-[#64748B] mt-2 capitalize">
                  Estado: {selectedStats.state}
                </p>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2">
              <GlassCard className="p-3 text-center">
                <p className="text-[16px] font-bold text-white tabular-nums">{selectedStats.chunkCount}</p>
                <p className="text-[10px] text-[#64748B]">Chunks</p>
              </GlassCard>
              <GlassCard className="p-3 text-center">
                <p className="text-[16px] font-bold text-white">—</p>
                <p className="text-[10px] text-[#64748B]">Gespräche</p>
              </GlassCard>
              <GlassCard className="p-3 text-center">
                <p className="text-[16px] font-bold text-white tabular-nums">
                  {selectedStats.progressPct != null ? `${selectedStats.progressPct}%` : '—'}
                </p>
                <p className="text-[10px] text-[#64748B]">Progresso</p>
              </GlassCard>
            </div>

            {selectedStats.relatedChunks.length > 0 && (
              <div className="mt-4">
                <p className="dt-label mb-2">Chunks relacionados</p>
                <ul className="space-y-1.5">
                  {selectedStats.relatedChunks.map((g) => (
                    <li
                      key={g}
                      className="text-[12px] text-white px-3 py-2 rounded-xl truncate"
                      style={{ background: 'rgba(139,92,246,0.12)' }}
                    >
                      {g}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <button
              type="button"
              disabled={starting}
              onClick={() => void startSituation(selected)}
              className="mt-5 w-full py-3.5 rounded-2xl text-[14px] font-bold text-white disabled:opacity-60"
              style={{
                background: `linear-gradient(135deg, ${selected.tint}, #8B5CF6)`,
                boxShadow: `0 0 24px ${selected.tint}55`,
              }}
            >
              {starting ? 'Vorbereiten…' : 'Situation starten'}
            </button>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  );
}
