import Phaser from 'phaser';
import { LEVELS } from './levels';
import { COLORS, GAME_HEIGHT, GAME_WIDTH, PHYSICS } from './constants';
import { BootScene } from './scenes/BootScene';
import { GameScene } from './scenes/GameScene';
import { LevelSelectScene } from './scenes/LevelSelectScene';
import { TitleScene } from './scenes/TitleScene';

// iOS Safari mutes Web Audio when the ring/silent switch is on unless the page says it plays media.
const nav = navigator as Navigator & { audioSession?: { type: string } };
if (nav.audioSession) nav.audioSession.type = 'playback';

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
  // Three touch pointers, so a thumb can hold a direction while the other holds jump and taps dash.
  input: { activePointers: 3 },
  scene: [BootScene, TitleScene, LevelSelectScene, GameScene],
});

// Handy for poking at the game from the browser console during development.
if (import.meta.env.DEV) {
  Object.assign(window, { game, LEVELS });
  import('./dev/playtest').then((m) => m.installPlaytest(game));
}
