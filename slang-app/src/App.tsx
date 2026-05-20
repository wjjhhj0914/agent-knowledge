import { useState, useEffect } from 'react';
import type { Screen, Situation, Theme } from './types';
import Navbar from './components/Navbar';
import MainLanding from './components/MainLanding';
import CoachingRoom from './components/CoachingRoom';
import SlangTab from './components/slang/SlangTab';

export default function App() {
  const [screen, setScreen]           = useState<Screen>('landing');
  const [theme, setTheme]             = useState<Theme>('dark');   // dark-first for coaching
  const [xp, setXp]                   = useState(120);
  const [streak]                      = useState(7);
  const [hearts, setHearts]           = useState(5);
  const [activeSituation, setActive]  = useState<Situation | null>(null);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  function enterSession(situation: Situation) {
    setActive(situation);
    setScreen('session');
  }

  function exitSession() {
    setActive(null);
    setScreen('landing');
  }

  function addXP(n: number)   { setXp(v => Math.min(v + n, 9999)); }
  function addHeart(n: number) { setHearts(v => Math.max(0, Math.min(5, v + n))); }

  const inSession = screen === 'session';

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--sl-bg)', transition: 'background 0.2s' }}>
      <Navbar
        screen={screen}
        theme={theme}
        streak={streak}
        xp={xp}
        hearts={hearts}
        inSession={inSession}
        onNav={setScreen}
        onTheme={() => setTheme(t => t === 'light' ? 'dark' : 'light')}
      />

      <main>
        {screen === 'landing' && (
          <MainLanding
            streak={streak}
            xp={xp}
            onEnterSession={enterSession}
            onNav={setScreen}
          />
        )}

        {screen === 'session' && activeSituation && (
          <CoachingRoom
            situation={activeSituation}
            onExit={exitSession}
          />
        )}

        {screen === 'slang' && (
          <SlangTab onXP={addXP} onHeart={addHeart} />
        )}
      </main>
    </div>
  );
}
