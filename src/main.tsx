import {StrictMode, useEffect} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { seedDatabase } from './services/seed';

const AppInitializer = () => {
  useEffect(() => {
    seedDatabase().catch(err => console.error("Seeding failed:", err));
  }, []);

  return <App />;
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppInitializer />
  </StrictMode>,
);
