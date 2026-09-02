/**
 * Meus Chunks — redesenho visual de MyGermanPage.
 * Dados: Learning State + L0_CHUNK_GRAPH (sem métricas fake).
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BottomNav } from '@/components/layout/BottomNav';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { GlassCard, glassStyle } from '@/components/ui/GlassCard';
import { IconBack, IconDrop, IconBriefcase, IconHouse } from '@/components/ui/Icons';
import { useProfile } from '@/hooks/useProfile';
import { MemoryService } from '@/services/learning/MemoryService';
import { readAutomationScore } from '@/services/learning/AutomationScoreEngine';
import type { PhraseConfidence, UserLearningProfile } from '@/services/learning/ConfidenceService';
import {
  L0_CHUNK_GRAPH,
  isZeroLanguagePhraseAccepted,
  zeroLanguageSeedPhrases,
} from '@/services/teacher/ZeroLanguageMode';

type ChunkRow = {
  id: string;
  german: string;
  portuguese: string;
  pct: number;
  status: 'dominando' | 'aprendendo' | 'revisao' | 'novo';
  variations: string[];
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
    for (const [baseId, node] of Object.entries(L0_CHUNK_GRAPH)) {
      const conf = learning.phrases[baseId];
      const seed = seeds.get(baseId);
      const vars = [...node.simpleVars, ...node.questions]
        .map((id) => seeds.get(id)?.german)
        .filter((g): g is string => !!g)
        .slice(0, 6);
      out.push({
        id: baseId,
        german: seed?.german || baseId,
        portuguese: seed?.portuguese || '',
        pct: pctFromConf(conf),
        status: statusFromConf(conf),
        variations: vars,
      });
    }
    out.sort((a, b) => b.pct - a.pct);
    return out;
  }, [learning]);

  const filtered = rows.filter((r) => (filter === 'todos' ? true : r.status === filter));

  if (loading || !profile) return <LoadingScreen />;

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
          <h1 className="text-[18px] font-bold text-white font-[family-name:var(--font-display)]">Meus Chunks</h1>
          <p className="text-[12px] text-[#CBD5E1]">Biblioteca do Learning State</p>
        </div>
      </header>

      <div className="px-5 pt-4 flex gap-2 overflow-x-auto scrollbar-hide">
        {([
          ['todos', 'Todos'],
          ['dominando', 'Dominando'],
          ['aprendendo', 'Aprendendo'],
          ['revisao', 'Revisão'],
        ] as const).map(([id, label]) => (
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
                    boxShadow: '0 0 16px rgba(139,92,246,0.35)',
                  }
                : { ...glassStyle, color: '#64748B' }
            }
          >
            {label}
          </button>
        ))}
      </div>

      <main className="flex-1 overflow-y-auto scrollbar-hide px-5 pt-4 pb-28 space-y-2.5">
        {filtered.length === 0 && (
          <GlassCard className="p-5 text-center">
            <p className="text-[14px] text-[#CBD5E1]">
              Ainda não há chunks estudados. Pratique uma sessão para começar.
            </p>
            <button
              type="button"
              onClick={() => navigate('/aprender')}
              className="mt-4 px-5 py-2.5 rounded-full text-[13px] font-bold text-white"
              style={{
                background: 'linear-gradient(135deg, #8B5CF6, #EC4899)',
                boxShadow: '0 0 20px rgba(139,92,246,0.4)',
              }}
            >
              Ir para Aprender
            </button>
          </GlassCard>
        )}

        {filtered.map((row, i) => {
          const tint = TINTS[i % TINTS.length];
          const Icon = i % 3 === 0 ? IconDrop : i % 3 === 1 ? IconBriefcase : IconHouse;
          return (
            <button
              key={row.id}
              type="button"
              onClick={() => navigate(`/estrutura/${encodeURIComponent(row.id)}`)}
              className="w-full text-left rounded-[20px] p-3.5 active:scale-[0.98] transition-transform"
              style={glassStyle}
            >
              <div className="flex items-center gap-3">
                <span
                  className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0"
                  style={{
                    background: `${tint}22`,
                    color: tint,
                    boxShadow: `0 0 16px ${tint}40`,
                  }}
                >
                  <Icon size={18} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-bold text-white truncate">{row.german}</p>
                  <p className="text-[11px] text-[#64748B] truncate">{row.portuguese || '—'}</p>
                  <div className="mt-2 h-[5px] rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.max(4, row.pct)}%`,
                        background: `linear-gradient(90deg, ${tint}, #A855F7)`,
                        boxShadow: `0 0 10px ${tint}66`,
                      }}
                    />
                  </div>
                </div>
                <span className="text-[16px] font-bold text-white shrink-0">{row.pct}%</span>
              </div>
            </button>
          );
        })}
      </main>

      <BottomNav />
    </div>
  );
}
