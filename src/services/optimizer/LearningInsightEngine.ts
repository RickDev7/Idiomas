import { PreferenceModel } from '@/services/optimizer/PreferenceModel';
import type { ProgressSummary } from '@/services/learning/ProgressEngine';

export interface Insight {
  text: string;
  category: 'strength' | 'challenge' | 'focus' | 'preference';
}

export async function generateInsights(progress: ProgressSummary | null): Promise<Insight[]> {
  const insights: Insight[] = [];
  const prefs = await PreferenceModel.all();

  if (prefs.length >= 3) {
    const sorted = [...prefs].filter((p) => p.confidence >= 0.4).sort((a, b) => b.score - a.score);
    const best = sorted[0];
    const worst = sorted[sorted.length - 1];
    if (best && best.score > 0.7) {
      insights.push({ text: `Você aprende melhor com ${methodLabel(best.method)}.`, category: 'preference' });
    }
    if (worst && worst.score < 0.4 && best && best.method !== worst.method) {
      insights.push({ text: `${methodLabel(worst.method)} está rendendo menos para você.`, category: 'preference' });
    }
  }

  if (progress) {
    if (progress.responseSpeedScore > 70) {
      insights.push({ text: 'Você está respondendo mais rápido.', category: 'strength' });
    } else if (progress.responseSpeedScore < 40 && progress.responseSpeedScore > 0) {
      insights.push({ text: 'Resposta rápida é seu próximo passo.', category: 'challenge' });
    }
    if (progress.independenceScore > 60) {
      insights.push({ text: 'Você está produzindo alemão sem ajuda.', category: 'strength' });
    }
    if (progress.comprehensionScore < progress.communicationScore - 20) {
      insights.push({ text: 'Compreensão auditiva é seu maior desafio.', category: 'challenge' });
    }
    if (progress.spontaneousUses > 0) {
      insights.push({ text: `Você usou alemão espontaneamente ${progress.spontaneousUses} vezes.`, category: 'strength' });
    }
  }

  return insights.slice(0, 3);
}

function methodLabel(method: string): string {
  const labels: Record<string, string> = {
    listen_repeat: 'ouvir e repetir',
    listen_translate_repeat: 'ouvir, traduzir e repetir',
    shadowing: 'shadowing',
    situation_try_teach_repeat: 'situação e correção',
    rapid_response: 'resposta rápida',
    guided_conversation: 'conversa guiada',
    free_conversation: 'conversa livre',
    pattern_practice: 'padrões',
    graded_listening: 'escuta em níveis',
    active_recall: 'recordação ativa',
    transfer_drill: 'transferência',
  };
  return labels[method] ?? method;
}
