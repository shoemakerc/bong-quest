import Phaser from 'phaser';
import { COLORS, GAME_HEIGHT, GAME_WIDTH, TEXTURES, TILE } from '../constants';
import { Player, type PlayerEvent } from '../entities/Player';
import { LEVELS, LEVEL_IDS } from '../levels';
import { LEVEL_LEGEND, type LevelData, type SpikeDir } from '../levels/types';
import { POWERS, POWER_ORDER, type PowerId } from '../powers';
import { formatTime, save } from '../systems/save';
import { sfx } from '../systems/sfx';
import { bindGlobalKeys, muteLabel, textStyle } from '../systems/ui';

export interface GameSceneData {
  levelIndex: number;
}

/** Per spike direction: [sprite angle, hitbox w, h, offsetX, offsetY]. The texture points up. */
const SPIKE_SHAPES: Record<SpikeDir, [number, number, number, number, number]> = {
  up: [0, TILE - 8, 12, 4, TILE - 12],
  down: [180, TILE - 8, 12, 4, 0],
  right: [90, 12, TILE - 8, 0, 4],
  left: [-90, 12, TILE - 8, TILE - 12, 4],
};

type Groups = Record<'solids' | 'spikes' | 'bongs' | 'goals' | 'checkpoints', Phaser.Physics.Arcade.StaticGroup>;

export class GameScene extends Phaser.Scene {
  private levelIndex = 0;
  private level!: LevelData;
  private player!: Player;
  private spawn = new Phaser.Math.Vector2();
  private worldHeight = 0;
  private won = false;
  /** Play time; accumulated from frame deltas so it only counts while the level is running. */
  private elapsedMs = 0;
  private deaths = 0;
  private lastDeathAt = -Infinity;

  private hudText!: Phaser.GameObjects.Text;
  private controlsText!: Phaser.GameObjects.Text;
  private powerIcons = new Map<PowerId, Phaser.GameObjects.Image>();

  constructor() {
    super('Game');
  }

  init(data: GameSceneData) {
    this.levelIndex = data.levelIndex ?? 0;
    this.level = LEVELS[this.levelIndex];
    this.won = false;
    this.deaths = 0;
    this.elapsedMs = 0;
    this.lastDeathAt = -Infinity;
    this.powerIcons.clear();
  }

  create() {
    const groups: Groups = {
      solids: this.physics.add.staticGroup(),
      spikes: this.physics.add.staticGroup(),
      bongs: this.physics.add.staticGroup(),
      goals: this.physics.add.staticGroup(),
      checkpoints: this.physics.add.staticGroup(),
    };
    this.buildLevel(this.level, groups);

    this.player = new Player(this, this.spawn.x, this.spawn.y);
    this.level.startingPowers.forEach((p) => this.player.grantPower(p));
    const events: PlayerEvent[] = ['jump', 'airJump', 'wallJump', 'dash'];
    events.forEach((e) => this.player.on(e, () => sfx(e)));

    this.physics.add.collider(this.player, groups.solids);
    this.physics.add.overlap(this.player, groups.spikes, () => this.die());
    this.physics.add.overlap(this.player, groups.bongs, (_p, b) => this.collectBong(b as Phaser.Physics.Arcade.Sprite));
    this.physics.add.overlap(this.player, groups.checkpoints, (_p, c) =>
      this.reachCheckpoint(c as Phaser.Physics.Arcade.Sprite),
    );
    this.physics.add.overlap(this.player, groups.goals, () => this.win());

    const worldWidth = this.level.map[0].length * TILE;
    // Levels narrower/shorter than the screen get centered instead of hugging the top-left.
    const padX = Math.max(0, GAME_WIDTH - worldWidth) / 2;
    const padY = Math.max(0, GAME_HEIGHT - this.worldHeight) / 2;
    this.cameras.main.setBounds(-padX, -padY, worldWidth + padX * 2, this.worldHeight + padY * 2);
    this.cameras.main.startFollow(this.player, true, 0.15, 0.15);
    this.physics.world.setBounds(0, 0, worldWidth, this.worldHeight + 200);

    this.createHud();
    this.toast(`${this.levelIndex + 1}. ${this.level.name}`, 1400);

    const kb = this.input.keyboard!;
    kb.on('keydown-R', () => this.scene.restart({ levelIndex: this.levelIndex }));
    kb.on('keydown-H', () => this.showControls());
    kb.on('keydown-ESC', () => this.scene.start('LevelSelect', { focus: this.levelIndex }));
    kb.on('keydown-ENTER', () => {
      if (this.won) this.goToNextLevel();
    });
    bindGlobalKeys(this, () => this.updateHud());

  }

  update(time: number, delta: number) {
    if (this.won) return;
    this.elapsedMs += delta;
    this.player.update(time);
    if (this.player.y > this.worldHeight + 64) this.die();
    this.updateHud();
  }

  private buildLevel(level: LevelData, groups: Groups) {
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
          case 'solid': {
            // Visual only; collision comes from the merged rectangles below.
            // Only tiles with open air above get the light top edge.
            const exposed = y === 0 || LEVEL_LEGEND[level.map[y - 1][x]]?.kind !== 'solid';
            this.add.image(cx, cy, exposed ? TEXTURES.tile : TEXTURES.tileInner);
            break;
          }
          case 'spike': {
            const s = groups.spikes.create(cx, cy, TEXTURES.spike) as Phaser.Physics.Arcade.Sprite;
            // Forgiving hitbox: only the 12px strip along the spike's base hurts.
            const [angle, w, h, ox, oy] = SPIKE_SHAPES[entry.dir ?? 'up'];
            s.setAngle(angle);
            s.body!.setSize(w, h).setOffset(ox, oy);
            break;
          }
          case 'spawn':
            this.spawn.set(cx, bottom - 20);
            break;
          case 'goal': {
            const goal = groups.goals.create(cx, bottom - 20, TEXTURES.goal) as Phaser.Physics.Arcade.Sprite;
            // Tall invisible pole so gliding over the flag still counts.
            goal.body!.setSize(28, 40 + TILE * 3).setOffset(0, -TILE * 3);
            break;
          }
          case 'checkpoint': {
            const c = groups.checkpoints.create(cx, bottom - 20, TEXTURES.checkpoint) as Phaser.Physics.Arcade.Sprite;
            c.setTint(COLORS.checkpointOff);
            break;
          }
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

    for (const r of mergeSolids(level.map)) {
      const zone = this.add.zone(r.x * TILE, r.y * TILE, r.w * TILE, r.h * TILE).setOrigin(0);
      groups.solids.add(zone);
    }
  }

  private collectBong(bong: Phaser.Physics.Arcade.Sprite) {
    const power = bong.getData('power') as PowerId;
    const def = POWERS[power];
    this.burst(bong.x, bong.y, def.color, 24);
    bong.destroy();
    this.player.grantPower(power);
    sfx('pickup');

    this.player.setTintFill(def.color);
    this.time.delayedCall(250, () => this.player.clearTint());
    this.toast(`Got the ${def.name} bong!\n${def.hint}`, 3000);
    this.showControls();
  }

  private reachCheckpoint(flag: Phaser.Physics.Arcade.Sprite) {
    if (flag.getData('active')) return;
    flag.setData('active', true).setTint(COLORS.checkpoint);
    this.spawn.set(flag.x, flag.y);
    this.burst(flag.x, flag.y - 10, COLORS.checkpoint, 10);
    sfx('checkpoint');
  }

  private die() {
    // Overlapping several spikes in one frame should only count once.
    if (this.won || this.time.now - this.lastDeathAt < 200) return;
    this.lastDeathAt = this.time.now;
    this.deaths++;
    this.burst(this.player.x, this.player.y, COLORS.player, 16);
    this.cameras.main.shake(120, 0.006);
    sfx('death');
    this.player.respawn(this.spawn.x, this.spawn.y);
  }

  private win() {
    if (this.won) return;
    this.won = true;
    this.physics.pause();
    this.player.setVelocity(0, 0);
    sfx('win');
    this.updateHud();

    const prevBest = save.best(this.level.id);
    const isBest = save.recordFinish(this.level.id, this.elapsedMs, this.deaths);
    const isLast = this.levelIndex === LEVELS.length - 1;

    const lines = [
      isLast ? 'You beat Bong Quest!' : 'Level complete!',
      '',
      `Time   ${formatTime(this.elapsedMs)}${isBest && prevBest ? '  NEW BEST!' : ''}`,
      `Deaths ${this.deaths}`,
      '',
      isLast ? 'Enter: level select' : 'Enter: next level',
      'R: retry   Esc: level select',
    ];
    this.panel(lines.join('\n'));
  }

  private goToNextLevel() {
    sfx('confirm');
    const next = this.levelIndex + 1;
    if (next < LEVELS.length && save.isUnlocked(LEVEL_IDS, next)) {
      this.scene.restart({ levelIndex: next });
    } else {
      this.scene.start('LevelSelect', { focus: this.levelIndex });
    }
  }

  // ---------------------------------------------------------------- HUD

  private createHud() {
    this.hudText = this.add.text(12, 10, '', textStyle(16)).setScrollFactor(0).setDepth(10);

    POWER_ORDER.forEach((id, i) => {
      const icon = this.add
        .image(GAME_WIDTH - 24 - (POWER_ORDER.length - 1 - i) * 30, 26, TEXTURES.bong)
        .setScrollFactor(0)
        .setDepth(10);
      this.powerIcons.set(id, icon);
    });

    this.controlsText = this.add
      .text(8, GAME_HEIGHT - 6, '', {
        ...textStyle(13, COLORS.textDim),
        backgroundColor: '#1b1f2acc',
        padding: { x: 4, y: 3 },
      })
      .setOrigin(0, 1)
      .setScrollFactor(0)
      .setDepth(10);
    this.updateHud();
    this.showControls();
  }

  /** The controls bar covers the bottom row of the level, so it only shows for a few seconds. */
  private showControls(holdMs = 5000) {
    this.tweens.killTweensOf(this.controlsText);
    this.controlsText.setAlpha(1);
    this.tweens.add({ targets: this.controlsText, alpha: 0, delay: holdMs, duration: 600 });
  }

  private updateHud() {
    this.hudText.setText(
      `${this.levelIndex + 1}. ${this.level.name}\n${formatTime(this.elapsedMs)}   Deaths: ${this.deaths}`,
    );

    for (const [id, icon] of this.powerIcons) {
      if (this.player.powers.has(id)) icon.setTint(POWERS[id].color).setAlpha(1);
      else icon.setTint(0x2d3748).setAlpha(0.8);
    }

    const powerControls = POWER_ORDER.filter((id) => this.player.powers.has(id)).map((id) => POWERS[id].controls);
    this.controlsText.setText(
      [['Move: ←→/AD', 'Jump: ↑/W/Space', ...powerControls].join('  ·  '), `R: restart   Esc: levels   H: show controls   ${muteLabel()}`].join(
        '\n',
      ),
    );
  }

  /** Centered message; fades after `holdMs`. */
  private toast(message: string, holdMs: number) {
    const text = this.add
      .text(GAME_WIDTH / 2, 120, message, {
        ...textStyle(20, '#ffffff'),
        align: 'center',
        backgroundColor: '#000000aa',
        padding: { x: 14, y: 10 },
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(20);
    this.tweens.add({ targets: text, alpha: 0, delay: holdMs, duration: 500, onComplete: () => text.destroy() });
  }

  private panel(message: string) {
    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2, message, {
        ...textStyle(22, '#ffffff'),
        align: 'center',
        backgroundColor: '#000000cc',
        padding: { x: 28, y: 20 },
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(30);
  }

  private burst(x: number, y: number, tint: number, quantity: number) {
    const emitter = this.add.particles(x, y, TEXTURES.pixel, {
      speed: { min: 60, max: 220 },
      lifespan: 450,
      scale: { start: 1.2, end: 0 },
      gravityY: 400,
      tint,
      emitting: false,
    });
    emitter.explode(quantity);
    this.time.delayedCall(600, () => emitter.destroy());
  }
}

/**
 * Merges solid tiles into as few rectangles as possible (horizontal runs, then stacked runs).
 * One body per tile leaves seams that the player snags on when sliding along walls.
 */
function mergeSolids(map: string[]) {
  const isSolid = (ch: string) => LEVEL_LEGEND[ch]?.kind === 'solid';
  const rects: { x: number; y: number; w: number; h: number }[] = [];
  let open = new Map<string, (typeof rects)[number]>(); // runs from the row above, keyed by "x,w"

  map.forEach((row, y) => {
    const next = new Map<string, (typeof rects)[number]>();
    for (let x = 0; x < row.length; x++) {
      if (!isSolid(row[x])) continue;
      const start = x;
      while (x + 1 < row.length && isSolid(row[x + 1])) x++;
      const key = `${start},${x - start + 1}`;
      const above = open.get(key);
      if (above) {
        above.h++;
        next.set(key, above);
      } else {
        const rect = { x: start, y, w: x - start + 1, h: 1 };
        rects.push(rect);
        next.set(key, rect);
      }
    }
    open = next;
  });
  return rects;
}
