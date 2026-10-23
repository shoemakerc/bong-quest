import Phaser from 'phaser';
import { GAME_WIDTH, TEXTURES, TILE } from '../constants';
import { Player } from '../entities/Player';
import { level1 } from '../levels/level1';
import { LEVEL_LEGEND, type LevelData } from '../levels/types';
import { POWERS, type PowerId } from '../powers';

export class GameScene extends Phaser.Scene {
  private player!: Player;
  private spawn = new Phaser.Math.Vector2();
  private worldHeight = 0;
  private hud!: Phaser.GameObjects.Text;
  private won = false;

  constructor() {
    super('Game');
  }

  create() {
    this.won = false;
    const level = level1;

    const solids = this.physics.add.staticGroup();
    const spikes = this.physics.add.staticGroup();
    const bongs = this.physics.add.staticGroup();
    const goals = this.physics.add.staticGroup();

    this.buildLevel(level, { solids, spikes, bongs, goals });

    this.player = new Player(this, this.spawn.x, this.spawn.y);

    this.physics.add.collider(this.player, solids);
    this.physics.add.overlap(this.player, spikes, () => this.die());
    this.physics.add.overlap(this.player, bongs, (_p, bong) =>
      this.collectBong(bong as Phaser.Physics.Arcade.Sprite),
    );
    this.physics.add.overlap(this.player, goals, () => this.win());

    const worldWidth = level.map[0].length * TILE;
    this.cameras.main.setBounds(0, 0, worldWidth, this.worldHeight);
    this.cameras.main.startFollow(this.player, true, 0.15, 0.15);
    this.physics.world.setBounds(0, 0, worldWidth, this.worldHeight + 200);

    this.hud = this.add
      .text(12, 10, '', { fontFamily: 'monospace', fontSize: '16px', color: '#e2e8f0' })
      .setScrollFactor(0)
      .setDepth(10);
    this.updateHud(level.name);

    this.input.keyboard!.on('keydown-R', () => this.scene.restart());
  }

  update(time: number) {
    if (this.won) return;
    this.player.update(time);
    if (this.player.y > this.worldHeight + 64) this.die();
  }

  private buildLevel(
    level: LevelData,
    groups: Record<'solids' | 'spikes' | 'bongs' | 'goals', Phaser.Physics.Arcade.StaticGroup>,
  ) {
    const width = level.map[0].length;
    level.map.forEach((row, y) => {
      if (row.length !== width) {
        throw new Error(`${level.name}: row ${y} is ${row.length} wide, expected ${width}`);
      }
      [...row].forEach((ch, x) => {
        const entry = LEVEL_LEGEND[ch];
        if (!entry) return;
        const cx = x * TILE + TILE / 2;
        const cy = y * TILE + TILE / 2;
        const bottom = (y + 1) * TILE;

        switch (entry.kind) {
          case 'solid':
            groups.solids.create(cx, cy, TEXTURES.tile);
            break;
          case 'spike': {
            const s = groups.spikes.create(cx, cy, TEXTURES.spike) as Phaser.Physics.Arcade.Sprite;
            // Forgiving hitbox: only the lower part of the tile hurts.
            s.body!.setSize(TILE - 8, 12).setOffset(4, TILE - 12);
            break;
          }
          case 'spawn':
            this.spawn.set(cx, bottom - 20);
            break;
          case 'goal':
            groups.goals.create(cx, bottom - 20, TEXTURES.goal);
            break;
          case 'bong': {
            const power = entry.power!;
            const b = groups.bongs.create(cx, cy, TEXTURES.bong) as Phaser.Physics.Arcade.Sprite;
            b.setTint(POWERS[power].color).setData('power', power);
            this.tweens.add({ targets: b, y: cy - 6, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
            break;
          }
        }
      });
    });
    this.worldHeight = level.map.length * TILE;
  }

  private collectBong(bong: Phaser.Physics.Arcade.Sprite) {
    const power = bong.getData('power') as PowerId;
    bong.destroy();
    this.player.grantPower(power);
    this.player.setTint(POWERS[power].color);
    this.updateHud(level1.name);
    this.toast(`Got the ${POWERS[power].name} bong!\n${POWERS[power].hint}`);
  }

  private die() {
    this.cameras.main.shake(120, 0.006);
    this.player.respawn(this.spawn.x, this.spawn.y);
  }

  private win() {
    if (this.won) return;
    this.won = true;
    this.physics.pause();
    this.toast('Level complete!\nPress R to play again.', 0);
  }

  private updateHud(levelName: string) {
    const powers = [...this.player.powers].map((id) => POWERS[id].name);
    this.hud.setText(
      `${levelName}\nPowers: ${powers.length ? powers.join(', ') : 'none yet'}\n` +
        `Move: ←/→ or A/D   Jump: ↑/W/Space   Restart: R`,
    );
  }

  /** Centered message; fades after `holdMs` (0 = stays forever). */
  private toast(message: string, holdMs = 2500) {
    const text = this.add
      .text(GAME_WIDTH / 2, 120, message, {
        fontFamily: 'monospace',
        fontSize: '20px',
        color: '#ffffff',
        align: 'center',
        backgroundColor: '#000000aa',
        padding: { x: 14, y: 10 },
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(20);
    if (holdMs > 0) {
      this.tweens.add({ targets: text, alpha: 0, delay: holdMs, duration: 500, onComplete: () => text.destroy() });
    }
  }
}
