import Phaser from 'phaser';
import { LEVELS } from './levels';
import { COLORS, GAME_HEIGHT, GAME_WIDTH, PHYSICS } from './constants';
import { BootScene } from './scenes/BootScene';
import { GameScene } from './scenes/GameScene';
import { LevelSelectScene } from './scenes/LevelSelectScene';
import { TitleScene } from './scenes/TitleScene';

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: COLORS.background,
  pixelArt: true,
  physics: {
    default: 'arcade',
    arcade: { gravity: { x: 0, y: PHYSICS.gravity }, debug: false },
  },
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: [BootScene, TitleScene, LevelSelectScene, GameScene],
});

// Handy for poking at the game from the browser console during development.
if (import.meta.env.DEV) {
  Object.assign(window, { game, LEVELS });
  import('./dev/playtest').then((m) => m.installPlaytest(game));
}
