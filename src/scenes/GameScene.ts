import Phaser from 'phaser';
import { itemTexture, outfitTexture, type ApparelItem } from '../apparel';
import { COLORS, GAME_HEIGHT, GAME_WIDTH, PHYSICS, TEXTURES, TILE } from '../constants';
import { Enemy, type CellAt } from '../entities/enemies';
import { Player, type PlayerEvent } from '../entities/Player';
import { LEVELS, LEVEL_IDS } from '../levels';
import { LEVEL_LEGEND, type LevelData, type SpikeDir } from '../levels/types';
import { POWERS, POWER_ORDER, type PowerId } from '../powers';
import { GameInput, isPortraitTouch, isTouch, type Action } from '../systems/input';
import { formatTime, save, today } from '../systems/save';
import { sfx } from '../systems/sfx';
import { bindGlobalKeys, muteLabel, tapButton, textStyle, toggleMute, type TapButton } from '../systems/ui';

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

type Visible = Phaser.GameObjects.Components.Visible & Phaser.GameObjects.Components.AlphaSingle;
type Groups = Record<
  'solids' | 'spikes' | 'bongs' | 'lighters' | 'goals' | 'checkpoints',
  Phaser.Physics.Arcade.StaticGroup
>;
interface Cell {
  col: number;
  row: number;
}

/**
 * On-screen buttons, in screen coordinates: [action, x, y, w, h, label]. Movement sits under the
 * left thumb, jump and dash under the right. Hit areas extend to the screen edges (see touchZoneRect).
 */
const TOUCH_BUTTONS: [Action, number, number, number, number, string][] = [
  ['left', 64, 470, 104, 96, ''],
  ['right', 188, 470, 104, 96, ''],
  ['dash', 746, 482, 112, 84, 'DASH'],
  ['jump', 886, 466, 124, 112, 'JUMP'],
];
/** Thumbs are imprecise: each hit area grows this much past its button (half the gap between buttons). */
const TOUCH_PAD = 10;

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

  private enemies: Enemy[] = [];
  private lighters: Phaser.Physics.Arcade.Sprite[] = [];
  /** Where the player starts and each checkpoint: the places today's apparel drop can turn up. */
  private anchors: Cell[] = [];

  private controls!: GameInput;
  private paused = false;
  private pauseMenu: Phaser.GameObjects.GameObject[] = [];
  private touchUi: { action: Action; bg: Phaser.GameObjects.Rectangle; parts: Phaser.GameObjects.GameObject[] }[] = [];
  private pauseButton!: TapButton;
  private touchUiShown: boolean | undefined;

  private lastToast?: Phaser.GameObjects.Text;
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
    this.enemies = [];
    this.lighters = [];
    this.anchors = [];
    this.lastToast = undefined;
    this.powerIcons.clear();
    this.paused = false;
    this.pauseMenu = [];
    this.touchUi = [];
    this.touchUiShown = undefined;
  }

  create() {
    const groups: Groups = {
      solids: this.physics.add.staticGroup(),
      spikes: this.physics.add.staticGroup(),
      bongs: this.physics.add.staticGroup(),
      lighters: this.physics.add.staticGroup(),
      goals: this.physics.add.staticGroup(),
      checkpoints: this.physics.add.staticGroup(),
    };
    this.buildLevel(this.level, groups);

    this.controls = new GameInput(this);
    this.player = new Player(this, this.spawn.x, this.spawn.y, this.controls);
    this.level.startingPowers.forEach((p) => this.player.grantPower(p));
    this.player.setOutfit(outfitTexture(this, save.outfit()));
    const events: PlayerEvent[] = ['jump', 'airJump', 'wallJump', 'dash'];
    events.forEach((e) => this.player.on(e, () => sfx(e)));

    this.physics.add.collider(this.player, groups.solids);
    this.physics.add.overlap(this.player, groups.spikes, () => this.die());
    this.physics.add.overlap(this.player, groups.bongs, (_p, b) => this.collectBong(b as Phaser.Physics.Arcade.Sprite));
    this.physics.add.overlap(this.player, groups.lighters, (_p, l) => this.useLighter(l as Phaser.Physics.Arcade.Sprite));
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
    this.createTouchControls();

    const drop = save.dailyDrop(this.level.id);
    if (drop) this.placeDailyDrop(drop);
    const intro = [`${this.levelIndex + 1}. ${this.level.name}`];
    if (this.level.hint) intro.push(this.level.hint);
    if (drop) intro.push("Today's apparel drop is somewhere in this level!");
    this.toast(intro.join('\n'), intro.length > 1 ? 3600 : 1400);

    const kb = this.input.keyboard!;
    kb.on('keydown-R', () => this.restartLevel());
    kb.on('keydown-H', () => this.showControls());
    kb.on('keydown-ESC', () => this.goToLevelSelect());
    kb.on('keydown-ENTER', () => {
      if (this.won) this.goToNextLevel();
    });
    bindGlobalKeys(this, () => this.updateHud());

  }

  update(time: number, delta: number) {
    this.syncTouchUi();
    if (this.won || this.paused) return;
    // Turned upright mid-level: the rotate overlay hides the game, so stop the clock.
    if (isPortraitTouch()) return this.pause();
    this.elapsedMs += delta;
    this.updateLighters();
    this.updateEnemies();
    this.player.update(time);
    if (this.player.y > this.worldHeight + 64) this.die();
    this.updateHud();
  }

  private buildLevel(level: LevelData, groups: Groups) {
    const width = level.map[0].length;
    // What enemies see of the map. Off the edge counts as solid, so nothing wanders out of the level.
    const cellAt: CellAt = (col, row) => {
      const ch = level.map[row]?.[col];
      if (ch === undefined) return 'solid';
      const kind = LEVEL_LEGEND[ch]?.kind;
      return kind === 'solid' || kind === 'spike' ? kind : 'open';
    };
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
            this.anchors.unshift({ col: x, row: y });
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
            // Tall like the goal's pole, so hopping onto its ledge or over the flag still counts.
            c.body!.setSize(22, 40 + TILE * 3).setOffset(0, -TILE * 3);
            this.anchors.push({ col: x, row: y });
            break;
          }
          case 'lighter': {
            const l = groups.lighters.create(cx, cy, TEXTURES.lighter) as Phaser.Physics.Arcade.Sprite;
            this.tweens.add({ targets: l, y: cy - 4, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
            this.lighters.push(l);
            break;
          }
          case 'enemy':
            this.enemies.push(new Enemy(this, entry.enemy!, entry.axis, x, y, cellAt));
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
    const hint = isTouch() ? (def.touchHint ?? def.hint) : def.hint;
    this.toast(`Got the ${def.name} bong!\n${hint}`, 3000);
    this.showControls();
  }

  // ---------------------------------------------------------------- lighters and enemies

  /** A lighter relights the double jump and dash in midair. Touching one with both in hand leaves it be. */
  private useLighter(lighter: Phaser.Physics.Arcade.Sprite) {
    if (!lighter.body!.enable || !this.player.needsRefill) return;
    this.player.refill();
    lighter.body!.enable = false;
    lighter.setAlpha(0.2).setData('readyAt', this.elapsedMs + PHYSICS.lighterRespawnMs);
    this.burst(lighter.x, lighter.y, COLORS.flame, 10);
    sfx('lighter');
    this.player.setTintFill(COLORS.flame);
    this.time.delayedCall(120, () => this.player.clearTint());
  }

  /** Spent lighters come back on the level clock, so they wait out a pause too. */
  private updateLighters() {
    for (const l of this.lighters) {
      if (l.body!.enable || this.elapsedMs < (l.getData('readyAt') as number)) continue;
      this.relight(l);
    }
  }

  private relight(lighter: Phaser.Physics.Arcade.Sprite) {
    lighter.body!.enable = true;
    lighter.setAlpha(1);
  }

  /** Moves the enemies, then checks each against the player: a landing from above squishes, anything else hurts. */
  private updateEnemies() {
    const b = this.player.body;
    for (const e of this.enemies) {
      if (!e.alive) continue;
      e.update(this.elapsedMs);
      const hit = e.hitbox;
      if (b.right <= hit.left || b.left >= hit.right || b.bottom <= hit.top || b.top >= hit.bottom) continue;
      const fromAbove = b.velocity.y >= 0 && b.bottom - hit.top <= PHYSICS.stompTolerance;
      if (e.def.stompable && fromAbove) {
        e.squish();
        this.player.stomp();
        this.burst(e.sprite.x, e.sprite.y, e.def.color, 12);
        sfx('stomp');
      } else {
        this.die();
        return;
      }
    }
  }

  // ---------------------------------------------------------------- daily apparel drop

  /** Puts today's item beside the player's start or one of the checkpoints, the same spot all day. */
  private placeDailyDrop(item: ApparelItem) {
    const map = this.level.map;
    const empty = (col: number, row: number) => map[row]?.[col] === '.';
    const solid = (col: number, row: number) => LEVEL_LEGEND[map[row]?.[col]]?.kind === 'solid';
    // Stand-on-able, with headroom, and nothing else in the cell.
    const fits = (col: number, row: number) => empty(col, row) && empty(col, row - 1) && solid(col, row + 1);

    const seed = [...today()].reduce((sum, ch) => sum * 31 + ch.charCodeAt(0), 7) >>> 0;
    const anchor = this.anchors[seed % this.anchors.length];
    const col = [3, 4, 2, 5, 1, -1, -2, 6, -3].map((d) => anchor.col + d).find((c) => fits(c, anchor.row)) ?? anchor.col;

    // Low enough that walking through it picks it up.
    const x = col * TILE + TILE / 2;
    const y = anchor.row * TILE + 6;
    const halo = this.add.rectangle(x, y, 34, 34).setStrokeStyle(2, 0xffffff, 0.5);
    this.tweens.add({ targets: halo, angle: 360, duration: 4000, repeat: -1 });
    const drop = this.physics.add.staticImage(x, y, itemTexture(this, item));
    this.tweens.add({ targets: [drop, halo], y: y - 5, duration: 800, yoyo: true, repeat: -1, ease: 'Sine.inOut' });

    const pickup = this.physics.add.overlap(this.player, drop, () => {
      pickup.destroy();
      drop.destroy();
      halo.destroy();
      save.collectDaily();
      this.player.setOutfit(outfitTexture(this, save.outfit()));
      item.colors.forEach((color) => this.burst(x, y, color, 12));
      sfx('apparel');
      this.toast(`Today's drop: ${item.name}!\nYou put it on. Another one drops tomorrow.`, 3600);
    });
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
    // Squished enemies and spent lighters come back, so every attempt starts the same.
    this.enemies.forEach((e) => e.revive());
    this.lighters.forEach((l) => this.relight(l));
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
    ];
    if (!isTouch()) {
      lines.push('', isLast ? 'Enter: level select' : 'Enter: next level', 'R: retry   Esc: level select');
      this.panel(lines.join('\n'));
      return;
    }

    // Touch: the same panel, with tap targets where the key hints would be.
    const cy = GAME_HEIGHT / 2;
    this.add.rectangle(GAME_WIDTH / 2, cy, 520, 260, 0x000000, 0.8).setScrollFactor(0).setDepth(30);
    this.add
      .text(GAME_WIDTH / 2, cy - 50, lines.join('\n'), { ...textStyle(22, '#ffffff'), align: 'center' })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(31);
    const buttons: [string, () => void][] = [
      [isLast ? 'Levels' : 'Next', () => this.goToNextLevel()],
      ['Retry', () => this.restartLevel()],
      ...(isLast ? [] : ([['Levels', () => this.goToLevelSelect()]] as [string, () => void][])),
    ];
    const w = 140;
    const gap = 16;
    const x0 = GAME_WIDTH / 2 - ((buttons.length - 1) * (w + gap)) / 2;
    buttons.forEach(([label, onTap], i) => tapButton(this, x0 + i * (w + gap), cy + 72, w, 52, label, onTap));
  }

  private restartLevel() {
    this.scene.restart({ levelIndex: this.levelIndex });
  }

  private goToLevelSelect() {
    this.scene.start('LevelSelect', { focus: this.levelIndex });
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

    const owned = POWER_ORDER.filter((id) => this.player.powers.has(id));
    if (isTouch()) {
      // Sits between the two button clusters, so pack the hints into short lines.
      const items = ['Move: ← →', 'Jump: JUMP (hold = higher)', ...owned.map((id) => POWERS[id].touchControls)];
      const lines: string[] = [];
      for (const item of items) {
        const last = lines.length - 1;
        if (last >= 0 && lines[last].length + item.length + 5 <= 54) lines[last] += `  ·  ${item}`;
        else lines.push(item);
      }
      lines.push('II: pause, restart, levels, sound');
      this.controlsText.setText(lines.join('\n')).setAlign('center').setOrigin(0.5, 1).setX(GAME_WIDTH / 2);
      return;
    }
    const powerControls = owned.map((id) => POWERS[id].controls);
    this.controlsText.setText(
      [['Move: ←→/AD', 'Jump: ↑/W/Space', ...powerControls].join('  ·  '), `R: restart   Esc: levels   H: show controls   ${muteLabel()}`].join(
        '\n',
      ),
    );
    this.controlsText.setAlign('left').setOrigin(0, 1).setX(8);
  }

  // ---------------------------------------------------------------- touch

  /** Button art is always built; it only shows (and only takes input) on touch devices. */
  private createTouchControls() {
    for (const [action, x, y, w, h, label] of TOUCH_BUTTONS) {
      const bg = this.add
        .rectangle(x, y, w, h, COLORS.tile, 0.35)
        .setStrokeStyle(2, COLORS.tileEdge, 0.7)
        .setScrollFactor(0)
        .setDepth(50);
      const parts: Phaser.GameObjects.GameObject[] = [bg];
      if (label) {
        parts.push(this.add.text(x, y, label, textStyle(18)).setOrigin(0.5).setAlpha(0.8).setScrollFactor(0).setDepth(51));
      } else {
        // Plain triangles rather than ◀ ▶, which some phones draw as emoji.
        const s = action === 'left' ? -1 : 1;
        parts.push(
          this.add
            .triangle(x, y, s * 14, 0, -s * 10, -16, -s * 10, 16, 0xe2e8f0, 0.8)
            .setOrigin(0, 0)
            .setScrollFactor(0)
            .setDepth(51),
        );
      }
      this.touchUi.push({ action, bg, parts });
      this.controls.touch.zones.push({ action, rect: touchZoneRect(x, y, w, h) });
    }

    this.pauseButton = tapButton(this, GAME_WIDTH / 2, 28, 60, 40, 'II', () => this.pause(), { depth: 50, size: 18 });
    this.pauseButton.bg.setAlpha(0.6);
  }

  /** Show/hide the on-screen controls and highlight the ones being pressed. */
  private syncTouchUi() {
    const show = isTouch() && !this.won && !this.paused;
    if (show !== this.touchUiShown) {
      this.touchUiShown = show;
      this.controls.touch.enabled = show;
      this.pauseButton.setVisible(show);
      if (show) this.controls.resetTouch();
    }
    if (!show) {
      for (const { parts } of this.touchUi) for (const p of parts) (p as unknown as Visible).setVisible(false);
      return;
    }
    // Floors sit at the bottom of the screen, so near a level's ends the player can be behind a button.
    const cam = this.cameras.main;
    const me = this.player.getBounds();
    me.x -= cam.scrollX;
    me.y -= cam.scrollY;
    for (const { action, bg, parts } of this.touchUi) {
      // Dash appears once you have the Rip Dash bong.
      const visible = action !== 'dash' || this.player.powers.has('dash');
      const behind = Phaser.Geom.Intersects.RectangleToRectangle(me, bg.getBounds());
      for (const p of parts) (p as unknown as Visible).setVisible(visible).setAlpha(behind ? 0.35 : 1);
      const held = this.controls.touchHeld.has(action);
      bg.setFillStyle(held ? COLORS.tileEdge : COLORS.tile, held ? 0.6 : 0.35);
      bg.setStrokeStyle(2, held ? COLORS.player : COLORS.tileEdge, held ? 1 : 0.7);
    }
  }

  private pause() {
    if (this.paused || this.won) return;
    this.paused = true;
    this.physics.pause();
    sfx('select');
    this.syncTouchUi();

    const cx = GAME_WIDTH / 2;
    // Full-screen backdrop that swallows taps meant for the level underneath.
    const backdrop = this.add
      .rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.6)
      .setOrigin(0)
      .setScrollFactor(0)
      .setDepth(60)
      .setInteractive();
    const title = this.add.text(cx, 172, 'Paused', textStyle(32, '#ffffff')).setOrigin(0.5).setScrollFactor(0).setDepth(61);
    const items: [string, () => void][] = [
      ['Resume', () => this.resume()],
      ['Restart level', () => this.restartLevel()],
      ['Level select', () => this.goToLevelSelect()],
      [muteLabel(), () => {
        toggleMute();
        sound.setText(muteLabel());
      }],
    ];
    const buttons = items.map(([label, onTap], i) => tapButton(this, cx, 232 + i * 58, 280, 48, label, onTap, { depth: 62 }));
    const sound = buttons[buttons.length - 1];
    this.pauseMenu = [backdrop, title, ...buttons.flatMap((b) => [b.bg, b.label])];
  }

  private resume() {
    if (isPortraitTouch()) return; // still upright; the overlay would hide the game
    this.pauseMenu.forEach((o) => o.destroy());
    this.pauseMenu = [];
    this.paused = false;
    this.physics.resume();
    this.syncTouchUi();
    this.showControls();
  }

  /** Centered message; fades after `holdMs`. A new one replaces whatever is still showing. */
  private toast(message: string, holdMs: number) {
    this.lastToast?.destroy();
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
    this.lastToast = text;
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

/** A button's hit area: padded, and stretched to the nearest screen edges so thumbs can't slip off. */
function touchZoneRect(x: number, y: number, w: number, h: number) {
  let left = x - w / 2 - TOUCH_PAD;
  let right = x + w / 2 + TOUCH_PAD;
  const top = y - h / 2 - TOUCH_PAD;
  if (left < 40) left = 0;
  if (right > GAME_WIDTH - 40) right = GAME_WIDTH;
  return new Phaser.Geom.Rectangle(left, top, right - left, GAME_HEIGHT - top);
}
