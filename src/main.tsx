import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { AppUpdateProvider } from './features/update/appUpdate';
import { ToastProvider } from './ui/Toast';
import { ErrorBoundary } from './ui/ErrorBoundary';
import { applyTheme, watchSystemTheme } from './ui/theme';
import './index.css';

applyTheme();
watchSystemTheme();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <ToastProvider>
        <AppUpdateProvider>
          <App />
        </AppUpdateProvider>
      </ToastProvider>
    </ErrorBoundary>
  </StrictMode>,
);
