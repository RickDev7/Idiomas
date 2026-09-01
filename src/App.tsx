import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ChunkTrackerProvider } from '@/context/ChunkTrackerContext';
import { UserMetricsProvider } from '@/context/UserMetricsContext';
import { HomePage } from '@/pages/HomePage';
import { OnboardingPage } from '@/pages/OnboardingPage';
import { ConversationPage } from '@/pages/ConversationPage';
import { TalkPage } from '@/pages/TalkPage';
import { ReviewPage } from '@/pages/ReviewPage';
import { ProgressPage } from '@/pages/ProgressPage';
import { CoursePage } from '@/pages/CoursePage';
import { SettingsPage } from '@/pages/SettingsPage';
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
          <Route path="/sessao" element={<ConversationPage />} />
          <Route path="/revisar" element={<ReviewPage />} />
          <Route path="/progresso" element={<ProgressPage />} />
          <Route path="/jornada" element={<CoursePage />} />
          <Route path="/configuracoes" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
      </UserMetricsProvider>
    </ChunkTrackerProvider>
  );
}
