/**
 * Meus Chunks — coleção com DTChunkCard + filtros.
 * Dados: Learning State + L0_CHUNK_GRAPH (sem métricas fake).
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BottomNav } from '@/components/layout/BottomNav';
import {
  DTPage,
  DTMain,
  DTTopBar,
  DTSectionLabel,
  DTChunkCard,
  DTGlassCard,
  DTEmptyState,
  DTNeonButton,
  glassStyle,
} from '@/components/dt';
import { IconDrop, IconBriefcase, IconHouse } from '@/components/ui/Icons';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { useProfile } from '@/hooks/useProfile';
import { MemoryService } from '@/services/learning/MemoryService';
import { readAutomationScore } from '@/services/learning/AutomationScoreEngine';
import type { PhraseConfidence, UserLearningProfile } from '@/services/learning/ConfidenceService';
import {
  L0_CHUNK_GRAPH,
  isZeroLanguagePhraseAccepted,
  zeroLanguageSeedPhrases,
} from '@/services/teacher/ZeroLanguageMode';
import { DT_ASSETS } from '@/assets/deutsch-turbo';
import { beginSelectedLearningSession } from '@/services/teacher/LessonStartIntent';
import { SoundService } from '@/services/ui/SoundService';
import { APP_ROUTES, goAprender, navigateBack } from '@/services/ui/AppRoutes';

type ChunkRow = {
  id: string;
  german: string;
  portuguese: string;
  pct: number;
  status: 'dominando' | 'aprendendo' | 'revisao' | 'novo';
};

function pctFromConf(c: PhraseConfidence | undefined): number {
  if (!c) return 0;
  const auto = readAutomationScore(c);
  if (typeof auto === 'number' && auto > 0) return Math.round(auto);
  return Math.round(c.confidence || 0);
}

function statusFromConf(c: PhraseConfidence | undefined): ChunkRow['status'] {
  if (!c || c.state === 'new') return 'novo';
  if (c.needsHelp || (c.confidence > 0 && c.confidence < 40)) return 'revisao';
  if (isZeroLanguagePhraseAccepted(c) || c.confidence >= 70) return 'dominando';
  return 'aprendendo';
}

const TINTS = ['#F97316', '#00F2FE', '#8B5CF6', '#EC4899', '#22C55E', '#22D3EE'];
const FILTERS = [
  ['todos', 'Todos'],
  ['dominando', 'Dominando'],
  ['aprendendo', 'Aprendendo'],
  ['revisao', 'Revisão'],
] as const;

export function MyGermanPage() {
  const { profile, loading } = useProfile();
  const navigate = useNavigate();
  const [learning, setLearning] = useState<UserLearningProfile | null>(null);
  const [filter, setFilter] = useState<'todos' | 'dominando' | 'aprendendo' | 'revisao'>('todos');

  useEffect(() => {
    if (!profile) return;
    void MemoryService.loadProfile(profile).then(setLearning);
  }, [profile]);

  const rows = useMemo(() => {
    if (!learning) return [];
    const seeds = new Map(zeroLanguageSeedPhrases().map((p) => [p.id, p]));
    const out: ChunkRow[] = [];
    for (const [baseId] of Object.entries(L0_CHUNK_GRAPH)) {
      const conf = learning.phrases[baseId];
      const seed = seeds.get(baseId);
      out.push({
        id: baseId,
        german: seed?.german || baseId,
        portuguese: seed?.portuguese || '',
        pct: pctFromConf(conf),
        status: statusFromConf(conf),
      });
    }
    out.sort((a, b) => b.pct - a.pct);
    return out;
  }, [learning]);

  const filtered = rows.filter((r) => (filter === 'todos' ? true : r.status === filter));
  const featured = filtered[0] ?? null;

  const startChunk = (row: ChunkRow) => {
    SoundService.play('start');
    beginSelectedLearningSession(navigate, {
      source: 'chunks',
      targetId: row.id,
      baseId: row.id,
      targetPhrase: row.german,
    });
  };

  if (loading || !profile) return <LoadingScreen />;

  return (
    <DTPage>
      <DTTopBar
        title="Meus Chunks"
        subtitle="Suas estruturas"
        onBack={() => navigateBack(navigate, APP_ROUTES.home)}
      />

      <div className="px-4 pt-3 flex gap-2 overflow-x-auto scrollbar-hide">
        {FILTERS.map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setFilter(id)}
            className="shrink-0 px-3.5 py-1.5 rounded-full text-[11px] font-semibold"
            style={
              filter === id
                ? {
                    background: 'linear-gradient(135deg, rgba(139,92,246,0.45), rgba(236,72,153,0.35))',
                    border: '1px solid rgba(168,85,247,0.55)',
                    color: '#fff',
                  }
                : { ...glassStyle, color: '#64748B' }
            }
          >
            {label}
          </button>
        ))}
      </div>

      <DTMain withNav className="pt-3 space-y-3">
        {filtered.length === 0 && (
          <DTEmptyState
            imageSrc={DT_ASSETS.mascot}
            imageAlt=""
            title="Ainda sem chunks"
            subtitle="Comece uma sessão para montar sua coleção."
            footer={
              <DTNeonButton onClick={() => goAprender(navigate)}>
                Ir para Aprender
              </DTNeonButton>
            }
          />
        )}

        {featured && (
          <DTGlassCard
            variant="violet"
            className="p-5 relative overflow-hidden rounded-[28px]"
            style={{
              border: '1px solid rgba(139,92,246,0.45)',
              boxShadow: '0 0 28px rgba(139,92,246,0.22)',
            }}
            onClick={() => startChunk(featured)}
          >
            <span
              className="absolute -top-16 -right-8 w-40 h-40 rounded-full pointer-events-none"
              style={{ background: 'radial-gradient(circle, rgba(139,92,246,0.4), transparent 70%)' }}
            />
            <DTSectionLabel className="relative">Em destaque</DTSectionLabel>
            <p className="relative mt-2 text-[26px] font-extrabold text-white leading-tight font-[family-name:var(--font-display)]">
              {featured.german}
            </p>
            <p className="relative mt-1 text-[13px] text-[#CBD5E1]">{featured.portuguese || '—'}</p>
            <div className="relative mt-4 flex items-center gap-3">
              <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.max(4, featured.pct)}%`,
                    background: 'linear-gradient(90deg, #8B5CF6, #00F2FE)',
                  }}
                />
              </div>
              <span className="text-[16px] font-bold text-white tabular-nums">{featured.pct}%</span>
            </div>
          </DTGlassCard>
        )}

        {filtered.slice(1).map((row, i) => {
          const tint = TINTS[i % TINTS.length];
          const Icon = i % 3 === 0 ? IconDrop : i % 3 === 1 ? IconBriefcase : IconHouse;
          return (
            <DTChunkCard
              key={row.id}
              german={row.german}
              portuguese={row.portuguese || undefined}
              pct={row.pct}
              tint={tint}
              icon={<Icon size={16} />}
              onClick={() => startChunk(row)}
            />
          );
        })}
      </DTMain>

      <BottomNav />
    </DTPage>
  );
}
