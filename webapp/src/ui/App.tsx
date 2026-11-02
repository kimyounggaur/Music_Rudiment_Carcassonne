import * as React from 'react';
import { Setup } from './Setup';
import { GameScreen } from './GameScreen';
import { PuzzleList, PuzzleScreen } from './Puzzles';
import { Overlay, Toasts } from './Sheets';
import { useGame } from './common';

export function App() {
  const g = useGame();
  return (
    <>
      {g.screen === 'setup' ? <Setup /> : g.screen === 'puzzles' ? <PuzzleList /> : g.screen === 'puzzle' ? <PuzzleScreen /> : <GameScreen />}
      <Overlay />
      <Toasts />
    </>
  );
}
