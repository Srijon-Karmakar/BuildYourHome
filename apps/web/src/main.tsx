import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { buildDemoScene } from './plan/demo';
import { editor } from './plan/session';
import '@fontsource-variable/outfit';
import './styles.css';

// `?demo=1` opens a sample home (handy for demos and screenshots).
if (new URLSearchParams(window.location.search).has('demo')) editor.loadScene(buildDemoScene());

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
