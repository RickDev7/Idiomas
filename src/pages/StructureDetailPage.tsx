/**
 * Detalhe da Estrutura — Fase 3.
 * Rota: /estrutura/:baseId
 * Dados: L0_CHUNK_GRAPH + Learning State + l0NextChunkAdvance.
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { BottomNav } from '@/components/layout/BottomNav';
import { GlassCard, glassStyle } from '@/components/ui/GlassCard';
import { ProgressRing } from '@/components/ui/ProgressRing';
import { IconBack } from '@/components/ui/Icons';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { useProfile } from '@/hooks/useProfile';
import { MemoryService } from '@/services/learning/MemoryService';
import { readAutomationScore } from '@/services/learning/AutomationScoreEngine';
import { getNextBestLearningActionForProfile } from '@/services/learning/NextBestActivityEngine';
import type { UserLearningProfile } from '@/services/learning/ConfidenceService';
import {
  L0_CHUNK_GRAPH,
  l0NextChunkAdvance,
  zeroLanguageSeedPhrases,
  l0ChunkBaseForPhraseId,
} from '@/services/teacher/ZeroLanguageMode';
import { UNIFIED_SIMULATOR_SCENARIOS } from '@/services/teacher/ProfessorCore/SituationCatalog';

const TOPIC_FOR_BASE: Record<string, string> = {
  'survival-arbeite': 'work',
  'l0-hook-ich-moechte': 'food',
  'l0-hook-ich-brauche': 'needs',
  'l0-hook-ich-muss': 'routine',
  'l0-hook-kannst-du': 'requests',
  'l0-ich-wohne': 'places',
  'l0-ich-komme': 'identity',
  'l0-ich-heisse': 'identity',
  'l0-ich-bin': 'identity',
  'l0-hilfe': 'help',
};

const ACTION_LABEL: Record<string, string> = {
  guided: 'Geführte Produktion',
  transfer: 'Transfer üben',
  spontaneous: 'Spontanes Sprechen',
  independent: 'Unabhängige Produktion',
  introduce: 'Einführen',
  practice: 'Üben',
  recall: 'Abrufen',
  converse: 'Konversation',
  maintenance: 'Festigen',
};

export function StructureDetailPage() {
  const { baseId: rawId } = useParams<{ baseId: string }>();
  const navigate = useNavigate();
  const { profile, loading } = useProfile();
  const [learning, setLearning] = useState<UserLearningProfile | null>(null);

  const baseId = useMemo(() => {
    if (!rawId) return null;
    const decoded = decodeURIComponent(rawId);
    if (L0_CHUNK_GRAPH[decoded]) return decoded;
    return l0ChunkBaseForPhraseId(decoded) || decoded;
  }, [rawId]);

  useEffect(() => {
    if (!profile) return;
    void MemoryService.loadProfile(profile).then(setLearning);
  }, [profile]);

  const seeds = useMemo(() => new Map(zeroLanguageSeedPhrases().map((p) => [p.id, p])), []);

  const view = useMemo(() => {
    if (!learning || !baseId || !L0_CHUNK_GRAPH[baseId]) return null;
    const node = L0_CHUNK_GRAPH[baseId];
    const conf = learning.phrases[baseId];
    const seed = seeds.get(baseId);
    const auto =
      conf != null
        ? Math.round(
            typeof readAutomationScore(conf) === 'number' && readAutomationScore(conf) > 0
              ? readAutomationScore(conf)
              : conf.confidence || 0,
          )
        : 0;

    const variations = [...node.simpleVars, ...node.questions]
      .map((id) => {
        const c = learning.phrases[id];
        const studied =
          c && (c.timesSeen > 0 || c.timesCorrect > 0 || c.confidence > 0 || c.state !== 'new');
        return {
          id,
          german: seeds.get(id)?.german || id,
          studied: !!studied,
          pct: c ? Math.round(readAutomationScore(c) || c.confidence || 0) : 0,
        };
      })
      .filter((v) => v.studied);

    const topic = TOPIC_FOR_BASE[baseId];
    const situations = topic
      ? UNIFIED_SIMULATOR_SCENARIOS.filter((s) => s.topic === topic || (topic === 'places' && s.topic === 'home') || (topic === 'help' && s.topic === 'requests'))
      : [];

    const history =
      conf?.reviewHistory
        ?.slice()
        .sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp))
        .slice(0, 5)
        .map((h) => ({
          at: h.timestamp,
          result: h.result,
        })) ?? [];

    const advance = l0NextChunkAdvance(learning, baseId);
    let nextLabel = '—';
    if (advance?.kind === 'converse') {
      nextLabel = 'Konversation in Situation';
    } else if (advance?.phraseId) {
      nextLabel = seeds.get(advance.phraseId)?.german || advance.phraseId;
    } else {
      const action = getNextBestLearningActionForProfile(learning, baseId);
      nextLabel = ACTION_LABEL[action] || action;
    }

    return {
      german: seed?.german || baseId,
      portuguese: seed?.portuguese || '',
      auto,
      variations,
      situations,
      history,
      nextLabel,
    };
  }, [learning, baseId, seeds]);

  if (loading || !profile || !learning) return <LoadingScreen />;

  if (!baseId || !view) {
    return (
      <div className="flex flex-col h-full max-w-md mx-auto items-center justify-center px-6 dt-page">
        <p className="text-[#94A3B8] text-center">Struktur nicht gefunden.</p>
        <button
          type="button"
          onClick={() => navigate('/chunks')}
          className="mt-4 px-5 py-3 rounded-[14px] text-white font-semibold"
          style={glassStyle}
        >
          Meus Chunks
        </button>
      </div>
    );
  }

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
          <h1 className="text-[16px] font-bold text-white truncate font-[family-name:var(--font-display)]">
            {view.german}
          </h1>
          <p className="text-[12px] text-[#CBD5E1] truncate">{view.portuguese || '—'}</p>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto scrollbar-hide px-5 pt-4 pb-28 space-y-5">
        <GlassCard variant="violet" className="p-6 flex flex-col items-center relative overflow-hidden">
          <span
            className="absolute -top-16 w-48 h-48 rounded-full pointer-events-none"
            style={{ background: 'radial-gradient(circle, rgba(139,92,246,0.4), transparent 70%)' }}
          />
          <ProgressRing value={view.auto} size={120} stroke={10} color="#8B5CF6" label={`${view.auto}%`} />
          <p className="relative mt-3 dt-label">Automatisierung</p>
        </GlassCard>

        <section>
          <p className="dt-label mb-2">Deine Variationen</p>
          {view.variations.length === 0 ? (
            <GlassCard className="p-4">
              <p className="text-[13px] text-[#64748B]">Noch keine Variationen praktiziert.</p>
            </GlassCard>
          ) : (
            <div className="space-y-2">
              {view.variations.map((v) => (
                <GlassCard key={v.id} className="px-4 py-3 flex items-center justify-between gap-2">
                  <p className="text-[14px] font-semibold text-white truncate">{v.german}</p>
                  <span className="text-[12px] font-bold text-[#00F2FE] tabular-nums shrink-0">{v.pct}%</span>
                </GlassCard>
              ))}
            </div>
          )}
        </section>

        <section>
          <p className="dt-label mb-2">Situationen</p>
          {view.situations.length === 0 ? (
            <GlassCard className="p-4">
              <p className="text-[13px] text-[#64748B]">—</p>
            </GlassCard>
          ) : (
            <div className="flex flex-wrap gap-2">
              {view.situations.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => navigate('/situacoes')}
                  className="px-3.5 py-2 rounded-full text-[12px] font-semibold text-white"
                  style={{
                    ...glassStyle,
                    border: '1px solid rgba(0,242,254,0.35)',
                  }}
                >
                  {s.emoji} {s.titleDe}
                </button>
              ))}
            </div>
          )}
        </section>

        <section>
          <p className="dt-label mb-2">Historisch</p>
          {view.history.length === 0 ? (
            <GlassCard className="p-4">
              <p className="text-[13px] text-[#64748B]">Kein Review-Verlauf für diese Struktur.</p>
            </GlassCard>
          ) : (
            <GlassCard className="p-4 space-y-2">
              {view.history.map((h, i) => (
                <p key={`${h.at}-${i}`} className="text-[13px] text-white flex justify-between gap-2">
                  <span className="text-[#94A3B8] truncate">
                    {new Date(h.at).toLocaleDateString(undefined, {
                      day: '2-digit',
                      month: 'short',
                    })}
                  </span>
                  <span
                    className="font-semibold"
                    style={{
                      color:
                        h.result === 'SUCCESS'
                          ? '#22C55E'
                          : h.result === 'FAILED'
                            ? '#EF4444'
                            : '#F59E0B',
                    }}
                  >
                    {h.result}
                  </span>
                </p>
              ))}
            </GlassCard>
          )}
        </section>

        <section>
          <p className="dt-label mb-2">Nächster Schritt</p>
          <GlassCard className="p-4">
            <p className="text-[15px] font-semibold text-white">{view.nextLabel}</p>
          </GlassCard>
        </section>

        <button
          type="button"
          onClick={() => navigate('/sessao?type=lesson')}
          className="w-full py-4 rounded-[20px] text-[15px] font-bold text-white active:scale-[0.98] transition-transform duration-200"
          style={{
            background: 'linear-gradient(135deg, #8B5CF6, #EC4899)',
            boxShadow: '0 0 28px rgba(139,92,246,0.4)',
          }}
        >
          Jetzt üben
        </button>
      </main>
      <BottomNav />
    </div>
  );
}
