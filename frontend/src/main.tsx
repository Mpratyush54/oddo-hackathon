import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { StoreProvider } from './app/state/StoreProvider';
import { SessionProvider } from './features/auth/session';
import App from './app/App';
import './shared/styles/base.css';
import './shared/styles/polish.css';
import './shared/styles/readability.css';
import { applyTheme, getInitialTheme } from './shared/theme/theme';

applyTheme(getInitialTheme());

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <StoreProvider>
        <SessionProvider>
          <App />
        </SessionProvider>
      </StoreProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
