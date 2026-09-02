import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ChunkTrackerProvider } from '@/context/ChunkTrackerContext';
import { UserMetricsProvider } from '@/context/UserMetricsContext';
import { HomePage } from '@/pages/HomePage';
import { OnboardingPage } from '@/pages/OnboardingPage';
import { ConversationPage } from '@/pages/ConversationPage';
import { TalkPage } from '@/pages/TalkPage';
import { TrainingPage } from '@/pages/TrainingPage';
import { MyGermanPage } from '@/pages/MyGermanPage';
import { ReviewPage } from '@/pages/ReviewPage';
import { ProgressPage } from '@/pages/ProgressPage';
import { CoursePage } from '@/pages/CoursePage';
import { SettingsPage } from '@/pages/SettingsPage';
import { SimulatorPage } from '@/pages/SimulatorPage';
import { SimulatorResultPage } from '@/pages/SimulatorResultPage';
import { MiniProvaPage } from '@/pages/MiniProvaPage';
import { MiniProvaResultPage } from '@/pages/MiniProvaResultPage';
import { SituationsPage } from '@/pages/SituationsPage';
import { DomainMapPage } from '@/pages/DomainMapPage';
import { StructureDetailPage } from '@/pages/StructureDetailPage';
import { AchievementsPage } from '@/pages/AchievementsPage';
import { ProfilePage } from '@/pages/ProfilePage';
import { SessionCompletePage } from '@/pages/SessionCompletePage';
import { ToastHost } from '@/components/ui/Toast';

export default function App() {
  return (
    <ChunkTrackerProvider>
      <UserMetricsProvider>
      <BrowserRouter>
        <ToastHost />
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/onboarding" element={<OnboardingPage />} />
          <Route path="/conversar" element={<TalkPage />} />
          <Route path="/aprender" element={<TrainingPage />} />
          <Route path="/chunks" element={<MyGermanPage />} />
          <Route path="/meu-alemao" element={<Navigate to="/chunks" replace />} />
          <Route path="/treinar" element={<Navigate to="/aprender" replace />} />
          <Route path="/situacoes" element={<SituationsPage />} />
          <Route path="/lernweg" element={<DomainMapPage />} />
          <Route path="/estrutura/:baseId" element={<StructureDetailPage />} />
          <Route path="/simulador" element={<SimulatorPage />} />
          <Route path="/simulador/resultado" element={<SimulatorResultPage />} />
          <Route path="/mini-prova" element={<MiniProvaPage />} />
          <Route path="/mini-prova/resultado" element={<MiniProvaResultPage />} />
          <Route path="/sessao" element={<ConversationPage />} />
          <Route path="/sessao/concluida" element={<SessionCompletePage />} />
          <Route path="/revisar" element={<ReviewPage />} />
          <Route path="/progresso" element={<ProgressPage />} />
          <Route path="/jornada" element={<CoursePage />} />
          <Route path="/conquistas" element={<AchievementsPage />} />
          <Route path="/perfil" element={<ProfilePage />} />
          <Route path="/configuracoes" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </UserMetricsProvider>
    </ChunkTrackerProvider>
  );
}
