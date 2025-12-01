// OJT Master v2.3.0 - Application Entry Point

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { AuthProvider, DocsProvider, ToastProvider } from './contexts';
import './index.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ToastProvider>
      <AuthProvider>
        <DocsProvider>
          <App />
        </DocsProvider>
      </AuthProvider>
    </ToastProvider>
  </StrictMode>
);
