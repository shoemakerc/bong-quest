import Phaser from 'phaser';
import { COLORS, TEXTURES, TILE } from '../constants';

/** Generates placeholder rectangle textures so the game runs with zero art assets. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create() {
    const g = this.add.graphics();

    g.fillStyle(COLORS.tile).fillRect(0, 0, TILE, TILE);
    g.fillStyle(COLORS.tileEdge).fillRect(0, 0, TILE, 4);
    g.generateTexture(TEXTURES.tile, TILE, TILE).clear();

    g.fillStyle(COLORS.player).fillRect(0, 0, 24, 40);
    g.fillStyle(0x000000).fillRect(15, 10, 4, 4); // eye, so you can tell which way he faces
    g.generateTexture(TEXTURES.player, 24, 40).clear();

    g.fillStyle(COLORS.spike);
    for (let x = 0; x < TILE; x += 8) g.fillTriangle(x, TILE, x + 4, TILE - 14, x + 8, TILE);
    g.generateTexture(TEXTURES.spike, TILE, TILE).clear();

    g.fillStyle(0xcbd5e0).fillRect(4, 0, 3, 40);
    g.fillStyle(COLORS.goal).fillRect(7, 2, 18, 12);
    g.generateTexture(TEXTURES.goal, 28, 40).clear();

    // Bong silhouette in white so it can be tinted per power: base, tube, stem, bowl.
    g.fillStyle(0xffffff);
    g.fillRect(2, 18, 16, 10);
    g.fillRect(6, 0, 8, 20);
    g.fillRect(14, 16, 6, 3);
    g.fillRect(18, 13, 5, 4);
    g.generateTexture(TEXTURES.bong, 24, 28).destroy();

    this.scene.start('Game');
  }
}
