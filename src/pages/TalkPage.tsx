import { useNavigate } from 'react-router-dom';
import { BottomNav } from '@/components/layout/BottomNav';
import { AppHeader, SectionLabel, PageTitle, PageSubtitle } from '@/components/ui/PageHeader';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { TopicCard } from '@/components/ui/TopicCard';
import {
  IconMic, IconBriefcase, IconPlane, IconUtensils, IconBook,
} from '@/components/ui/Icons';
import { DeutschTurboMascot } from '@/components/ui/Mascot';
import { useProfile } from '@/hooks/useProfile';
import { suggestConversationTopic } from '@/services/teacher/TeacherEngine';

const TOPICS = [
  { id: 'trabalho', label: 'Trabalho', color: '#3b82f6', icon: <IconBriefcase size={22} /> },
  { id: 'viagem', label: 'Viagem', color: '#10b981', icon: <IconPlane size={22} /> },
  { id: 'comida', label: 'Comida', color: '#f59e0b', icon: <IconUtensils size={22} /> },
  { id: 'estudos', label: 'Estudos', color: '#8b5cf6', icon: <IconBook size={22} /> },
];

export function TalkPage() {
  const { profile, loading } = useProfile();
  const navigate = useNavigate();

  if (loading || !profile) return <LoadingScreen />;

  const topic = suggestConversationTopic(profile);
  const startFree = (t?: string) => navigate(`/sessao?type=free&topic=${encodeURIComponent(t ?? topic)}`);

  return (
    <div className="flex flex-col h-full bg-background max-w-md mx-auto">
      <AppHeader />
      <main className="flex-1 overflow-y-auto scrollbar-hide px-5 pt-3 pb-28">
        <SectionLabel tone="blue">Conversar</SectionLabel>
        <PageTitle className="mt-1.5">
          Vamos praticar! <span aria-hidden>🚀</span>
        </PageTitle>
        <PageSubtitle>
          Seu professor escolhe o assunto:{' '}
          <span className="text-text font-medium">{topic}</span>.
        </PageSubtitle>

        {/* Card do professor — composição da referência */}
        <div
          className="mt-6 rounded-[28px] px-5 pt-5 pb-5 relative overflow-hidden animate-slide-up"
          style={{
            background:
              'linear-gradient(165deg, rgba(59,130,246,0.18) 0%, rgba(139,92,246,0.14) 55%, var(--surface) 100%)',
            border: '1px solid var(--border)',
            boxShadow: 'var(--shadow-md), var(--shadow-glow)',
          }}
        >
          <span
            className="absolute -top-10 -left-8 w-40 h-40 rounded-full pointer-events-none"
            style={{ background: 'radial-gradient(circle, rgba(59,130,246,0.28) 0%, transparent 70%)' }}
            aria-hidden
          />
          <span
            className="absolute -bottom-12 -right-6 w-44 h-44 rounded-full pointer-events-none"
            style={{ background: 'radial-gradient(circle, rgba(139,92,246,0.22) 0%, transparent 70%)' }}
            aria-hidden
          />

          {/* Balão — canto superior direito do robô */}
          <div
            className="absolute top-4 right-4 z-10 max-w-[52%] px-3.5 py-2.5 rounded-[18px] rounded-br-[6px]"
            style={{
              background: '#ffffff',
              border: '1px solid rgba(148,163,184,0.2)',
              boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
            }}
          >
            <p className="text-[13px] font-semibold text-[#101828] leading-snug">
              Pronto para conversar? Eu estou!
            </p>
          </div>

          <div className="relative flex flex-col items-center pt-8 pb-1">
            <DeutschTurboMascot size="onboarding" state="teacher" />
          </div>

          <button
            type="button"
            onClick={() => startFree()}
            className="relative mt-4 w-full min-h-[56px] rounded-full text-white text-[16px] font-semibold active:scale-[0.98] transition-transform inline-flex items-center justify-center gap-2.5"
            style={{
              background: 'linear-gradient(180deg, #3b82f6 0%, #2563eb 100%)',
              boxShadow: '0 8px 28px rgba(59,130,246,0.45)',
            }}
          >
            <IconMic size={20} /> Começar conversa
          </button>
          <p className="relative text-caption text-text-faint mt-2.5 text-center">
            Fale com seu professor de IA
          </p>
        </div>

        <div className="mt-6 flex items-center gap-3">
          <span className="flex-1 h-px bg-border" />
          <span className="text-caption font-semibold text-text-faint uppercase tracking-[0.14em]">ou</span>
          <span className="flex-1 h-px bg-border" />
        </div>

        <p className="mt-5 text-eyebrow text-text-faint tracking-[0.16em] font-semibold uppercase">
          Escolha um tema para conversar
        </p>
        <div className="mt-3 grid grid-cols-4 gap-2.5">
          {TOPICS.map((t) => (
            <TopicCard key={t.id} label={t.label} color={t.color} icon={t.icon} onClick={() => startFree(t.id)} />
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  );
}
