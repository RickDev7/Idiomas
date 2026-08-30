import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App';
import { ThemeService } from '@/services/ui/ThemeService';
import { LocaleService } from '@/services/ui/LocaleService';
import { NotificationService } from '@/services/ui/NotificationService';
import { UiPrefsService } from '@/services/ui/UiPrefsService';
import './index.css';

ThemeService.init();
LocaleService.applyDocumentLang();
if (UiPrefsService.get().notifications) {
  NotificationService.startLocalReminders();
}
registerSW({ immediate: true });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
