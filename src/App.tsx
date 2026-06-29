import { useState, useEffect } from 'react';
import { GameState, GameSettings, HighScore } from './types';
import StartScreen from './components/StartScreen';
import OptionsScreen from './components/OptionsScreen';
import GameCanvas from './components/GameCanvas';
import GameOverScreen from './components/GameOverScreen';
import EndingScreen from './components/EndingScreen';
import { playSound, setAudioSettings } from './components/AudioEngine';

const DEFAULT_SETTINGS: GameSettings = {
  bindings: {
    up: 'ArrowUp',
    down: 'ArrowDown',
    left: 'ArrowLeft',
    right: 'ArrowRight',
    punch: 'p',
    skill: 'o',
  },
  preset: 'arrows',
  soundEnabled: true,
  soundVolume: 0.5,
  difficulty: 'normal',
};

export default function App() {
  const [gameState, setGameState] = useState<GameState>('START');
  const [settings, setSettings] = useState<GameSettings>(DEFAULT_SETTINGS);
  const [highScores, setHighScores] = useState<HighScore[]>([]);
  const [currentScore, setCurrentScore] = useState(0);
  const [currentLevel, setCurrentLevel] = useState(1);

  // Load configuration and high scores on startup
  useEffect(() => {
    // 1. High Scores
    try {
      const storedScores = localStorage.getItem('arcade_adventure_scores');
      if (storedScores) {
        setHighScores(JSON.parse(storedScores));
      } else {
        // Seed default high scores to make the leaderboard look lively on first load
        const initialScores: HighScore[] = [
          { name: 'RetroMaster', score: 5500, date: '2026-06-25' },
          { name: 'VaporRunner', score: 3800, date: '2026-06-27' },
          { name: 'GemSeeker', score: 1200, date: '2026-06-28' },
        ];
        localStorage.setItem('arcade_adventure_scores', JSON.stringify(initialScores));
        setHighScores(initialScores);
      }
    } catch (e) {
      console.warn('Local storage high scores load error:', e);
    }

    // 2. Settings
    try {
      const storedSettings = localStorage.getItem('arcade_adventure_settings');
      if (storedSettings) {
        const parsed = JSON.parse(storedSettings) as GameSettings;
        setSettings(parsed);
        setAudioSettings(parsed.soundEnabled, parsed.soundVolume);
      } else {
        setAudioSettings(DEFAULT_SETTINGS.soundEnabled, DEFAULT_SETTINGS.soundVolume);
      }
    } catch (e) {
      console.warn('Local storage settings load error:', e);
    }
  }, []);

  // Save score helper
  const handleSaveScore = (name: string, score: number) => {
    const newRecord: HighScore = {
      name,
      score,
      date: new Date().toISOString().split('T')[0],
    };

    const updated = [...highScores, newRecord]
      .sort((a, b) => b.score - a.score)
      .slice(0, 8); // Keep top 8 high scores

    setHighScores(updated);
    try {
      localStorage.setItem('arcade_adventure_scores', JSON.stringify(updated));
    } catch (e) {
      console.error('Failed to save high scores:', e);
    }
  };

  // Save configuration settings helper
  const handleSaveSettings = (newSettings: GameSettings) => {
    setSettings(newSettings);
    setAudioSettings(newSettings.soundEnabled, newSettings.soundVolume);
    try {
      localStorage.setItem('arcade_adventure_settings', JSON.stringify(newSettings));
    } catch (e) {
      console.error('Failed to save settings:', e);
    }
  };

  const handleToggleSound = () => {
    const updatedSettings = {
      ...settings,
      soundEnabled: !settings.soundEnabled,
    };
    handleSaveSettings(updatedSettings);
    playSound('select');
  };

  // State Routers
  return (
    <div className="w-full min-h-screen bg-slate-950 text-white select-none relative">
      {gameState === 'START' && (
        <StartScreen
          settings={settings}
          highScores={highScores}
          onStartGame={() => setGameState('PLAYING')}
          onOpenOptions={() => setGameState('OPTIONS')}
          onToggleSound={handleToggleSound}
        />
      )}

      {gameState === 'OPTIONS' && (
        <OptionsScreen
          settings={settings}
          onSaveSettings={handleSaveSettings}
          onBackToMenu={() => setGameState('START')}
        />
      )}

      {gameState === 'PLAYING' && (
        <GameCanvas
          settings={settings}
          onGameOver={(score, lvl) => {
            setCurrentScore(score);
            setCurrentLevel(lvl);
            setGameState('GAMEOVER');
          }}
          onGameComplete={(score, lvl) => {
            setCurrentScore(score);
            setCurrentLevel(lvl);
            setGameState('ENDING');
          }}
          onQuit={() => setGameState('START')}
        />
      )}

      {gameState === 'GAMEOVER' && (
        <GameOverScreen
          score={currentScore}
          level={currentLevel}
          settings={settings}
          onRestart={() => setGameState('PLAYING')}
          onQuit={() => setGameState('START')}
          onSaveScore={handleSaveScore}
        />
      )}

      {gameState === 'ENDING' && (
        <EndingScreen
          score={currentScore}
          level={currentLevel}
          settings={settings}
          onQuit={() => setGameState('START')}
        />
      )}
    </div>
  );
}
