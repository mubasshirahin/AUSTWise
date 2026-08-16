import React from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from './src/context/AuthContext';
import { ThemeProvider } from './src/context/ThemeContext';
import { RoutineProvider } from './src/context/RoutineContext';
import { StalkProvider, useStalk } from './src/features/stalk-road/StalkContext';
import StalkRoadOverlay from './src/features/stalk-road/StalkRoadOverlay';
import './src/features/stalk-road/StalkRoad.css';
import './src/features/stalk-road/StalkPortfolio.css';

const STOPS = [
  { key: 'cp-01', label: 'User Details', fields: { name: 'Sadia', dept: 'CSE' } },
  { key: 'cp-02', label: 'Favourites', fields: { movies_tv: ['Inception'] } },
];

function Triggers() {
  const { stalk } = useStalk();
  return (
    <div style={{ position: 'fixed', zIndex: 99999, top: 8, left: 8, display: 'flex', gap: 8 }}>
      <button id="orbit" onClick={() => stalk({ id: 'u-x', name: 'Sadia' }, STOPS, '#22c55e')}>Orbit Green</button>
      <button id="orbitNone" onClick={() => stalk({ id: 'u-x', name: 'Sadia' }, STOPS, '')}>Orbit NoColor</button>
    </div>
  );
}

function App() {
  return (
    <MemoryRouter initialEntries={['/']}>
      <ThemeProvider>
        <RoutineProvider>
          <AuthProvider>
            <StalkProvider>
              <Triggers />
              <StalkRoadOverlay />
            </StalkProvider>
          </AuthProvider>
        </RoutineProvider>
      </ThemeProvider>
    </MemoryRouter>
  );
}

createRoot(document.getElementById('root')).render(<App />);