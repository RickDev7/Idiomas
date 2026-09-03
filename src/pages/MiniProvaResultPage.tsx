/**
 * Resultado da Mini Prova — UI premium (DT).
 * Alinhado visualmente ao SimulatorResultPage. Dados reais de MiniProvaResult.
 */
import { useNavigate } from 'react-router-dom';
import { BottomNav } from '@/components/layout/BottomNav';
import {
  DTPage,
  DTMain,
  DTTopBar,
  DTSectionLabel,
  DTGlassCard,
  DTProgressRing,
  DTMetricCard,
  DTBadge,
  DTProgressBar,
  glassStyle,
} from '@/components/dt';
import {
  IconBolt,
  IconCheck,
  IconMic,
  IconRefresh,
  IconTarget,
  IconWave,
} from '@/components/ui/Icons';
import { readMiniProvaResult } from '@/services/teacher/MiniProvaIntent';

export function MiniProvaResultPage() {
  const navigate = useNavigate();
  const result = readMiniProvaResult();

  if (!result) {
    return (
      <DTPage>
        <DTMain withNav={false} className="flex flex-col items-center justify-center px-6">
          <p className="text-[#94A3B8] text-center">Nenhum resultado de prova encontrado.</p>
          <button
            type="button"
            onClick={() => navigate('/mini-prova')}
            className="mt-4 px-5 py-3 rounded-[14px] text-white font-semibold"
            style={glassStyle}
          >
            Voltar
          </button>
        </DTMain>
      </DTPage>
    );
  }

  const overallPct =
    result.totalQuestions > 0
      ? Math.round((result.correctCount / result.totalQuestions) * 100)
      : 0;

  const metrics = [
    { label: 'Autonomia', value: result.autonomyPercent, color: '#00F2FE', icon: <IconBolt size={14} /> },
    { label: 'Compreensão', value: result.comprehensionPercent, color: '#8B5CF6', icon: <IconWave size={14} /> },
    { label: 'Produção', value: result.speakingPercent, color: '#EC4899', icon: <IconMic size={14} /> },
    { label: 'Formação de frases', value: result.sentencePercent, color: '#F97316', icon: <IconTarget size={14} /> },
    { label: 'Variações', value: result.variationPercent, color: '#22C55E', icon: <IconRefresh size={14} /> },
  ];

  const nochUeben = [...result.needsPractice, ...result.difficult].filter(
    (v, i, arr) => arr.indexOf(v) === i,
  );

  return (
    <DTPage>
      <DTTopBar
        title="Resultado"
        subtitle="Mini Prova concluída"
        right={<DTBadge color="#A855F7">Prova</DTBadge>}
      />

      <DTMain className="pt-5 space-y-5">
        <DTGlassCard variant="violet" className="p-6 flex flex-col items-center relative overflow-hidden">
          <span
            className="absolute -top-16 w-56 h-56 rounded-full pointer-events-none"
            style={{ background: 'radial-gradient(circle, rgba(139,92,246,0.42), transparent 70%)' }}
          />
          <DTProgressRing
            value={overallPct}
            size={148}
            stroke={11}
            color="#8B5CF6"
            label={`${overallPct}%`}
          />
          <p className="relative mt-4 dt-label">Desempenho</p>
          <p className="relative text-[13px] text-[#CBD5E1] tabular-nums mt-1">
            {result.correctCount} / {result.totalQuestions} corretas
          </p>
        </DTGlassCard>

        <div className="grid grid-cols-2 gap-2.5">
          {metrics.map((m) => (
            <div key={m.label} className="rounded-[18px] p-3 min-h-[92px] flex flex-col justify-between" style={glassStyle}>
              <span
                className="w-8 h-8 rounded-lg flex items-center justify-center mb-2"
                style={{ background: `${m.color}22`, color: m.color }}
              >
                {m.icon}
              </span>
              <div>
                <p className="text-[20px] font-extrabold text-white tabular-nums leading-none">
                  {Math.round(m.value)}%
                </p>
                <p className="text-[10px] text-[#94A3B8] mt-1.5 leading-snug">{m.label}</p>
                <DTProgressBar value={m.value} color={m.color} className="mt-2" />
              </div>
            </div>
          ))}
          <DTMetricCard
            label="Avaliados"
            value={result.contentsChecked}
            color="#A855F7"
            icon={<IconCheck size={14} />}
          />
        </div>

        {result.strengths.length > 0 && (
          <section>
            <DTSectionLabel className="mb-2">Pontos fortes</DTSectionLabel>
            <DTGlassCard className="p-4 space-y-2.5">
              {result.strengths.map((g) => (
                <p key={g} className="text-[14px] text-white flex gap-2">
                  <span className="text-[#22C55E] shrink-0">
                    <IconCheck size={16} />
                  </span>
                  <span className="truncate">{g}</span>
                </p>
              ))}
            </DTGlassCard>
          </section>
        )}

        {nochUeben.length > 0 && (
          <section>
            <DTSectionLabel className="mb-2">O que treinar</DTSectionLabel>
            <DTGlassCard className="p-4 space-y-2.5">
              {nochUeben.slice(0, 8).map((g) => (
                <p key={g} className="text-[14px] text-white flex gap-2">
                  <span className="text-[#EC4899] shrink-0">
                    <IconRefresh size={16} />
                  </span>
                  <span className="truncate">{g}</span>
                </p>
              ))}
            </DTGlassCard>
          </section>
        )}

        <div className="flex gap-2 items-stretch">
          <button
            type="button"
            onClick={() => navigate('/revisar')}
            className="flex-1 py-3.5 rounded-[16px] text-[14px] font-semibold text-white"
            style={glassStyle}
          >
            Revisar
          </button>
          <button
            type="button"
            onClick={() => navigate('/aprender')}
            className="flex-[1.4] py-3.5 rounded-[16px] text-[14px] font-bold text-[#050816] active:scale-[0.98] transition-transform"
            style={{
              background: 'linear-gradient(135deg, #00F2FE, #8B5CF6)',
              boxShadow: '0 0 24px rgba(139,92,246,0.35)',
            }}
          >
            Continuar treino
          </button>
        </div>
      </DTMain>
      <BottomNav />
    </DTPage>
  );
}
