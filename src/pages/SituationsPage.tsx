/**
 * Situações — composição radial/mapa.
 * Fonte: SituationCatalog + Learning State. Simulator via storeSimulatorContext.
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BottomNav } from '@/components/layout/BottomNav';
import {
  DTPage,
  DTMain,
  DTTopBar,
  DTSectionLabel,
  DTSituationNode,
  DTProgressRing,
  DTNeonButton,
  DTGlassCard,
  glassStyle,
} from '@/components/dt';
import {
  IconBriefcase,
  IconHouse,
  IconDrop,
  IconWave,
  IconUtensils,
  IconBag,
} from '@/components/ui/Icons';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
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
  titlePt: string;
  domain: string;
  scenarioId?: string;
  angle: number;
  tint: string;
  Icon: typeof IconBriefcase;
};

const MAP_NODES: MapNode[] = [
  { key: 'arbeit', titlePt: 'Trabalho', domain: 'arbeit', scenarioId: 'work', angle: -90, tint: '#F97316', Icon: IconBriefcase },
  { key: 'zuhause', titlePt: 'Casa', domain: 'zuhause', scenarioId: 'home', angle: -30, tint: '#8B5CF6', Icon: IconHouse },
  { key: 'einkaufen', titlePt: 'Compras', domain: 'supermarkt', scenarioId: 'needs', angle: 30, tint: '#00F2FE', Icon: IconDrop },
  { key: 'restaurant', titlePt: 'Restaurante', domain: 'restaurant', scenarioId: 'food', angle: 90, tint: '#EC4899', Icon: IconUtensils },
  { key: 'transport', titlePt: 'Transporte', domain: 'transport', angle: 150, tint: '#22D3EE', Icon: IconBag },
  { key: 'gesundheit', titlePt: 'Saúde', domain: 'gesundheit', angle: 210, tint: '#22C55E', Icon: IconWave },
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

const STATE_LABEL: Record<'dominada' | 'aprendendo' | 'nova', string> = {
  dominada: 'Dominada',
  aprendendo: 'Aprendendo',
  nova: 'Nova',
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

function nodePosition(angleDeg: number, radiusPct: number) {
  const rad = (angleDeg * Math.PI) / 180;
  const x = 50 + radiusPct * Math.cos(rad);
  const y = 50 + radiusPct * Math.sin(rad);
  return { left: `${x}%`, top: `${y}%` };
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

  const active =
    selected ?? MAP_NODES.find((n) => (statsByKey[n.key]?.progressPct ?? 0) > 0) ?? MAP_NODES[0];
  const activeStats = statsByKey[active.key];

  return (
    <DTPage>
      <DTTopBar
        title="Situações"
        subtitle="Cenários reais"
        onBack={() => navigate(-1)}
      />

      <DTMain withNav className="pt-2 flex flex-col">
        {/* Mapa radial */}
        <div className="relative w-full aspect-square max-h-[340px] mx-auto shrink-0">
          {/* Anéis guia */}
          <span
            className="absolute inset-[8%] rounded-full pointer-events-none"
            style={{ border: '1px solid rgba(139,92,246,0.18)' }}
          />
          <span
            className="absolute inset-[22%] rounded-full pointer-events-none"
            style={{ border: '1px dashed rgba(0,242,254,0.15)' }}
          />

          {/* Centro brilhante */}
          <div
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[42%] aspect-square rounded-full flex flex-col items-center justify-center text-center px-3"
            style={{
              ...glassStyle,
              border: `1px solid ${active.tint}88`,
              boxShadow: `0 0 40px ${active.tint}55, inset 0 0 28px ${active.tint}22`,
              background: `radial-gradient(circle at 40% 35%, ${active.tint}33, rgba(5,8,22,0.92) 70%)`,
            }}
          >
            <span
              className="absolute inset-0 rounded-full pointer-events-none animate-pulse"
              style={{ boxShadow: `0 0 32px ${active.tint}44` }}
            />
            {activeStats.progressPct != null ? (
              <DTProgressRing
                value={activeStats.progressPct}
                size={72}
                stroke={7}
                color={active.tint}
                label={`${activeStats.progressPct}%`}
              />
            ) : (
              <span
                className="w-14 h-14 rounded-full flex items-center justify-center"
                style={{ background: `${active.tint}28`, color: active.tint }}
              >
                <active.Icon size={24} />
              </span>
            )}
            <p className="relative mt-2 text-[12px] font-extrabold text-white leading-tight">
              {active.titlePt}
            </p>
            <p className="relative text-[9px] text-[#94A3B8] mt-0.5">
              {STATE_LABEL[activeStats.state]}
            </p>
          </div>

          {/* Nós orbitais */}
          {MAP_NODES.map((node) => {
            const st = statsByKey[node.key];
            const pos = nodePosition(node.angle, 38);
            const detail =
              st?.progressPct != null ? `${st.progressPct}%` : st?.state === 'nova' ? 'Nova' : undefined;
            return (
              <div
                key={node.key}
                className="absolute -translate-x-1/2 -translate-y-1/2 z-10"
                style={{ left: pos.left, top: pos.top }}
              >
                <DTSituationNode
                  label={node.titlePt}
                  detail={detail}
                  tint={node.tint}
                  icon={<node.Icon size={18} />}
                  active={active.key === node.key}
                  onClick={() => setSelected(node)}
                />
              </div>
            );
          })}
        </div>

        {/* Painel da situação ativa */}
        <DTGlassCard
          className="mt-2 p-4 rounded-[24px] flex-1 min-h-0 flex flex-col"
          style={{
            border: `1px solid ${active.tint}55`,
            boxShadow: `0 0 22px ${active.tint}18`,
          }}
        >
          <p className="dt-label mb-1" style={{ color: active.tint }}>
            {active.titlePt}
          </p>
          <h2 className="text-[18px] font-extrabold text-white leading-snug font-[family-name:var(--font-display)]">
            {activeStats.settingDe}
          </h2>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="rounded-[14px] p-3" style={{ background: 'rgba(255,255,255,0.04)' }}>
              <p className="text-[18px] font-bold text-white tabular-nums">{activeStats.chunkCount}</p>
              <p className="text-[10px] text-[#64748B]">Chunks</p>
            </div>
            <div className="rounded-[14px] p-3" style={{ background: 'rgba(255,255,255,0.04)' }}>
              <p className="text-[18px] font-bold text-white tabular-nums">
                {activeStats.progressPct != null ? `${activeStats.progressPct}%` : '—'}
              </p>
              <p className="text-[10px] text-[#64748B]">Progresso</p>
            </div>
          </div>

          {activeStats.relatedChunks.length > 0 && (
            <div className="mt-3">
              <DTSectionLabel className="mb-2">Estruturas</DTSectionLabel>
              <div className="flex flex-wrap gap-1.5">
                {activeStats.relatedChunks.map((g) => (
                  <span
                    key={g}
                    className="text-[11px] text-white px-2.5 py-1 rounded-full"
                    style={{ background: `${active.tint}22` }}
                  >
                    {g}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="mt-auto pt-4">
            <DTNeonButton
              disabled={starting}
              onClick={() => void startSituation(active)}
              className="min-h-14"
            >
              {starting ? 'Preparando…' : 'Começar situação'}
            </DTNeonButton>
          </div>
        </DTGlassCard>
      </DTMain>

      <BottomNav />
    </DTPage>
  );
}
