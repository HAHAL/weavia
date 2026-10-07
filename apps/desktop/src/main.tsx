import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import '@weavia/ui/styles.css';
import './styles.css';
import './auth.css';
import './local-data.css';
import './reference-image.css';
import { App } from './app/App';
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
