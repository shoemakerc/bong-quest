import Phaser from 'phaser';
import { COLORS, TEXTURES, TILE } from '../constants';
import { initSfx } from '../systems/sfx';

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

    g.fillStyle(COLORS.tile).fillRect(0, 0, TILE, TILE);
    g.generateTexture(TEXTURES.tileInner, TILE, TILE).clear();

    g.fillStyle(COLORS.player).fillRect(0, 0, 24, 40);
    g.fillStyle(0x000000).fillRect(15, 10, 4, 4); // eye, so you can tell which way he faces
    g.generateTexture(TEXTURES.player, 24, 40).clear();

    g.fillStyle(COLORS.spike);
    for (let x = 0; x < TILE; x += 8) g.fillTriangle(x, TILE, x + 4, TILE - 14, x + 8, TILE);
    g.generateTexture(TEXTURES.spike, TILE, TILE).clear();

    g.fillStyle(0xcbd5e0).fillRect(4, 0, 3, 40);
    g.fillStyle(COLORS.goal).fillRect(7, 2, 18, 12);
    g.generateTexture(TEXTURES.goal, 28, 40).clear();

    // White so it can be tinted on/off.
    g.fillStyle(0xffffff).fillRect(4, 8, 3, 32).fillTriangle(7, 8, 20, 13, 7, 18);
    g.generateTexture(TEXTURES.checkpoint, 22, 40).clear();

    g.fillStyle(0xffffff).fillRect(0, 0, 4, 4);
    g.generateTexture(TEXTURES.pixel, 4, 4).clear();

    // Lighter: a flame over a metal cap and a pale body.
    g.fillStyle(COLORS.flame).fillTriangle(8, 0, 3, 10, 13, 10);
    g.fillStyle(COLORS.goal).fillTriangle(8, 4, 5, 10, 11, 10);
    g.fillStyle(0xa0aec0).fillRect(3, 10, 10, 4);
    g.fillStyle(COLORS.lighter).fillRect(3, 14, 10, 14);
    g.generateTexture(TEXTURES.lighter, 16, 28).clear();

    // Buzzkill: a block on two feet with a flat, unimpressed brow. Faces left.
    g.fillStyle(COLORS.buzzkill).fillRect(0, 0, 28, 18);
    g.fillStyle(0x234e52).fillRect(3, 18, 8, 4).fillRect(17, 18, 8, 4);
    g.fillStyle(0xffffff).fillRect(3, 6, 7, 6).fillRect(14, 6, 7, 6);
    g.fillStyle(0x000000).fillRect(3, 8, 3, 4).fillRect(14, 8, 3, 4);
    g.fillRect(2, 3, 9, 2).fillRect(13, 3, 9, 2);
    g.generateTexture(TEXTURES.buzzkill, 28, 22).clear();

    // Bad Vibe: a little storm cloud with a frown. Faces left.
    g.fillStyle(COLORS.badVibe).fillRect(0, 9, 30, 9).fillRect(4, 4, 22, 16).fillRect(9, 0, 11, 6);
    g.fillStyle(0xffffff).fillRect(7, 8, 5, 5).fillRect(16, 8, 5, 5);
    g.fillStyle(0x000000).fillRect(7, 10, 2, 3).fillRect(16, 10, 2, 3);
    g.fillRect(10, 16, 8, 2);
    g.generateTexture(TEXTURES.badVibe, 30, 20).clear();

    // Ember: spiky all the way round, in spike red, so it reads as "don't touch".
    g.fillStyle(COLORS.ember);
    g.fillTriangle(12, 0, 8, 6, 16, 6).fillTriangle(12, 24, 8, 18, 16, 18);
    g.fillTriangle(0, 12, 6, 8, 6, 16).fillTriangle(24, 12, 18, 8, 18, 16);
    g.fillTriangle(3, 3, 9, 5, 5, 9).fillTriangle(21, 3, 15, 5, 19, 9);
    g.fillTriangle(3, 21, 5, 15, 9, 19).fillTriangle(21, 21, 19, 15, 15, 19);
    g.fillRect(5, 5, 14, 14);
    g.fillStyle(COLORS.flame).fillRect(8, 8, 8, 8);
    g.fillStyle(COLORS.goal).fillRect(10, 10, 4, 4);
    g.generateTexture(TEXTURES.ember, 24, 24).clear();

    // Bong silhouette in white so it can be tinted per power: base, tube, stem, bowl.
    g.fillStyle(0xffffff);
    g.fillRect(2, 18, 16, 10);
    g.fillRect(6, 0, 8, 20);
    g.fillRect(14, 16, 6, 3);
    g.fillRect(18, 13, 5, 4);
    g.generateTexture(TEXTURES.bong, 24, 28).destroy();

    initSfx(this.game);
    this.scene.start('Title');
  }
}
