import { useEffect, useRef } from 'react';
import { StartGame } from '../game/main';

export function PhaserGame() {
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    const game = StartGame('game-container');
    const el = document.getElementById('game-container');
    const blockMenu = (e: Event) => e.preventDefault();
    el?.addEventListener('contextmenu', blockMenu);

    return () => {
      el?.removeEventListener('contextmenu', blockMenu);
      game.destroy(true);
      initialized.current = false;
    };
  }, []);

  return (
    <div
      id="game-container"
      className="w-full h-full overflow-hidden"
      onContextMenu={(e) => e.preventDefault()}
    />
  );
}