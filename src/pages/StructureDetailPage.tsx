/**
 * Detalhe da Estrutura — foco na estrutura alemã + anel de domínio + variações.
 * Rota: /estrutura/:baseId
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { BottomNav } from '@/components/layout/BottomNav';
import {
  DTPage,
  DTMain,
  DTTopBar,
  DTSectionLabel,
  DTGlassCard,
  DTProgressRing,
  DTProgressBar,
  DTNeonButton,
  DTBadge,
  glassStyle,
} from '@/components/dt';
import { IconCheck, IconSparkle } from '@/components/ui/Icons';
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
import { beginSelectedLearningSession } from '@/services/teacher/LessonStartIntent';
import { SoundService } from '@/services/ui/SoundService';

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
  guided: 'Produção guiada',
  transfer: 'Praticar transferência',
  spontaneous: 'Fala espontânea',
  independent: 'Produção independente',
  introduce: 'Introduzir',
  practice: 'Praticar',
  recall: 'Recuperar',
  converse: 'Conversar',
  maintenance: 'Consolidar',
};

const RESULT_PT: Record<string, string> = {
  SUCCESS: 'Acertou',
  FAILED: 'Errou',
  PARTIAL: 'Parcial',
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
      ? UNIFIED_SIMULATOR_SCENARIOS.filter(
          (s) =>
            s.topic === topic ||
            (topic === 'places' && s.topic === 'home') ||
            (topic === 'help' && s.topic === 'requests'),
        )
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
      nextLabel = 'Conversar em situação';
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
      <DTPage>
        <div className="flex-1 flex flex-col items-center justify-center px-6">
          <p className="text-[#94A3B8] text-center">Estrutura não encontrada.</p>
          <button
            type="button"
            onClick={() => navigate('/chunks')}
            className="mt-4 px-5 py-3 rounded-[14px] text-white font-semibold"
            style={glassStyle}
          >
            Meus Chunks
          </button>
        </div>
      </DTPage>
    );
  }

  return (
    <DTPage>
      <DTTopBar
        title={view.german}
        subtitle={view.portuguese || 'Estrutura'}
        onBack={() => navigate(-1)}
      />

      <DTMain>
        <div className="pt-3 space-y-5">
          <DTGlassCard
            variant="violet"
            className="p-6 flex flex-col items-center relative overflow-hidden"
          >
            <span
              className="absolute -top-16 w-48 h-48 rounded-full pointer-events-none"
              style={{
                background: 'radial-gradient(circle, rgba(139,92,246,0.45), transparent 70%)',
              }}
            />
            <p className="relative text-[22px] font-extrabold text-white text-center font-[family-name:var(--font-display)] leading-tight">
              {view.german}
            </p>
            {view.portuguese ? (
              <p className="relative mt-1 text-[13px] text-[#CBD5E1] text-center">{view.portuguese}</p>
            ) : null}
            <div className="relative mt-5">
              <DTProgressRing
                value={view.auto}
                size={120}
                stroke={10}
                color="#8B5CF6"
                label={`${view.auto}%`}
              />
            </div>
            <p className="relative mt-3">
              <DTSectionLabel>Domínio</DTSectionLabel>
            </p>
          </DTGlassCard>

          <section>
            <DTSectionLabel className="mb-2">Suas variações</DTSectionLabel>
            {view.variations.length === 0 ? (
              <DTGlassCard className="p-4">
                <p className="text-[13px] text-[#64748B]">Ainda sem variações praticadas.</p>
              </DTGlassCard>
            ) : (
              <div className="space-y-2">
                {view.variations.map((v) => (
                  <DTGlassCard key={v.id} className="px-4 py-3">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <p className="text-[14px] font-semibold text-white truncate">{v.german}</p>
                      <span className="text-[12px] font-bold text-[#00F2FE] tabular-nums shrink-0">
                        {v.pct}%
                      </span>
                    </div>
                    <DTProgressBar value={v.pct} color="#00F2FE" />
                  </DTGlassCard>
                ))}
              </div>
            )}
          </section>

          <section>
            <DTSectionLabel className="mb-2">Situações</DTSectionLabel>
            {view.situations.length === 0 ? (
              <DTGlassCard className="p-4">
                <p className="text-[13px] text-[#64748B]">Nenhuma situação vinculada.</p>
              </DTGlassCard>
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
            <DTSectionLabel className="mb-2">Histórico</DTSectionLabel>
            {view.history.length === 0 ? (
              <DTGlassCard className="p-4">
                <p className="text-[13px] text-[#64748B]">
                  Nenhum histórico de revisão para esta estrutura.
                </p>
              </DTGlassCard>
            ) : (
              <DTGlassCard className="p-4 space-y-2.5">
                {view.history.map((h, i) => (
                  <div
                    key={`${h.at}-${i}`}
                    className="flex items-center justify-between gap-2"
                  >
                    <span className="text-[13px] text-[#94A3B8] truncate">
                      {new Date(h.at).toLocaleDateString('pt-BR', {
                        day: '2-digit',
                        month: 'short',
                      })}
                    </span>
                    <DTBadge
                      color={
                        h.result === 'SUCCESS'
                          ? '#22C55E'
                          : h.result === 'FAILED'
                            ? '#EF4444'
                            : '#F59E0B'
                      }
                    >
                      {RESULT_PT[h.result] || h.result}
                    </DTBadge>
                  </div>
                ))}
              </DTGlassCard>
            )}
          </section>

          <section>
            <DTSectionLabel className="mb-2">Próximo passo</DTSectionLabel>
            <DTGlassCard className="p-4 flex items-start gap-3">
              <span
                className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-[#A855F7]"
                style={{ background: 'rgba(168,85,247,0.18)' }}
              >
                <IconSparkle size={16} />
              </span>
              <p className="text-[15px] font-semibold text-white pt-1.5">{view.nextLabel}</p>
            </DTGlassCard>
          </section>

          <DTNeonButton
            onClick={() => {
              if (!baseId) return;
              SoundService.play('start');
              beginSelectedLearningSession(navigate, {
                source: 'structure',
                targetId: baseId,
                baseId,
                targetPhrase: view.german,
              });
            }}
          >
            <span className="inline-flex items-center gap-2">
              <IconCheck size={16} /> Treinar agora
            </span>
          </DTNeonButton>
        </div>
      </DTMain>
      <BottomNav />
    </DTPage>
  );
}
