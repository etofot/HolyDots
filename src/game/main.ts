import Phaser from 'phaser';
import { Boot } from './scenes/Boot';
import { MainGame } from './scenes/MainGame';
import { GAME_WIDTH, GAME_HEIGHT } from './constants';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game-container',
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  scene: [Boot, MainGame],
  backgroundColor: '#0A0A1A',
  // Stable frame pacing for rise/timer juice
  fps: { target: 60, forceSetTimeOut: false },
  input: {
    // RMB reverse-recolor must not open browser menu
    mouse: { preventDefaultDown: false },
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
};

export const StartGame = (parent: string) => {
  return new Phaser.Game({ ...config, parent });
};