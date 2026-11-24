import Phaser from 'phaser';
import { COLORS, TEXTURES, TILE } from '../constants';
import type { EnemyKind } from '../levels/types';

export interface EnemyDef {
  name: string;
  texture: string;
  color: number;
  /** Landing on it from above squishes it. If false, every touch hurts. */
  stompable: boolean;
  /** Hitbox, centered on the sprite. A little smaller than the art, like the spikes'. */
  hitW: number;
  hitH: number;
}

export const ENEMIES: Record<EnemyKind, EnemyDef> = {
  /** Walks its platform end to end, turning at walls, spikes and ledges. */
  buzzkill: { name: 'Buzzkill', texture: TEXTURES.buzzkill, color: COLORS.buzzkill, stompable: true, hitW: 24, hitH: 20 },
  /** Floats back and forth (or up and down) around where the map puts it. */
  badVibe: { name: 'Bad Vibe', texture: TEXTURES.badVibe, color: COLORS.badVibe, stompable: true, hitW: 26, hitH: 16 },
  /** Leaps straight up from where the map puts it, over and over. Too hot to land on. */
  ember: { name: 'Ember', texture: TEXTURES.ember, color: COLORS.ember, stompable: false, hitW: 16, hitH: 16 },
};

const BUZZKILL_SPEED = 55;
const BAD_VIBE_SPEED = { x: 80, y: 70 };
/** How far a Bad Vibe strays from its map tile, in tiles, unless something solid is closer. */
const BAD_VIBE_RANGE = { x: 3, y: 2 };
const EMBER = { leap: TILE * 5, airMs: 1300, restMs: 900 };

/** What an enemy can move through: `cell(col, row)` says what is at a map position. */
export type CellKind = 'solid' | 'spike' | 'open';
export type CellAt = (col: number, row: number) => CellKind;

interface Pose {
  x: number;
  y: number;
  /** -1 or 1: which way it is heading along its path. */
  dir: number;
}

/**
 * Every enemy's position is a pure function of level time, so they keep their rhythm when the
 * player dies and the dev playtest scripts replay exactly. They never touch the physics engine:
 * the scene compares `hitbox` with the player's body each frame.
 */
export class Enemy {
  readonly def: EnemyDef;
  readonly sprite: Phaser.GameObjects.Image;
  alive = true;
  private readonly pose: (tMs: number) => Pose;
  private readonly box = new Phaser.Geom.Rectangle();

  constructor(
    private scene: Phaser.Scene,
    readonly kind: EnemyKind,
    axis: 'x' | 'y' | undefined,
    col: number,
    row: number,
    cell: CellAt,
  ) {
    this.def = ENEMIES[kind];
    const cx = col * TILE + TILE / 2;
    const cy = row * TILE + TILE / 2;
    this.sprite = scene.add.image(cx, cy, this.def.texture);

    if (kind === 'buzzkill') {
      const walkable = (c: number) => cell(c, row) === 'open' && cell(c, row + 1) === 'solid';
      const [lo, hi] = reach(col, 1000, walkable);
      const walk = patrol(cx, lo * TILE + TILE / 2, hi * TILE + TILE / 2, BUZZKILL_SPEED);
      const y = (row + 1) * TILE - this.sprite.height / 2;
      this.pose = (t) => {
        const p = walk(t);
        return { x: p.pos, y, dir: p.dir };
      };
    } else if (kind === 'badVibe' && axis === 'y') {
      const [lo, hi] = reach(row, BAD_VIBE_RANGE.y, (r) => cell(col, r) === 'open');
      const fly = patrol(cy, lo * TILE + TILE / 2, hi * TILE + TILE / 2, BAD_VIBE_SPEED.y);
      this.pose = (t) => {
        const p = fly(t);
        return { x: cx, y: p.pos, dir: -1 };
      };
    } else if (kind === 'badVibe') {
      const [lo, hi] = reach(col, BAD_VIBE_RANGE.x, (c) => cell(c, row) === 'open');
      const fly = patrol(cx, lo * TILE + TILE / 2, hi * TILE + TILE / 2, BAD_VIBE_SPEED.x);
      this.pose = (t) => {
        const p = fly(t);
        return { x: p.pos, y: cy, dir: p.dir };
      };
    } else {
      // Leap as high as the room above allows, so it never pokes into a ceiling.
      let open = 0;
      while (open < 5 && cell(col, row - open - 1) === 'open') open++;
      const leap = Math.min(EMBER.leap, open * TILE + 4);
      const period = EMBER.airMs + EMBER.restMs;
      // Neighbours go off one after another rather than all at once.
      const phase = ((col % 5) * period) / 5;
      this.pose = (t) => {
        const u = ((t + phase) % period) / EMBER.airMs;
        return { x: cx, y: u < 1 ? cy - leap * 4 * u * (1 - u) : cy, dir: u < 1 ? 1 : 0 };
      };
    }
    this.update(0);
  }

  update(tMs: number) {
    if (!this.alive) return;
    const p = this.pose(tMs);
    this.sprite.setPosition(p.x, p.y);
    if (this.kind === 'ember') this.sprite.setAngle(p.dir ? tMs * 0.5 : 0);
    else this.sprite.setFlipX(p.dir > 0); // the art faces left
  }

  get hitbox() {
    const { hitW, hitH } = this.def;
    return this.box.setTo(this.sprite.x - hitW / 2, this.sprite.y - hitH / 2, hitW, hitH);
  }

  /** Flatten and vanish. It comes back when the player next respawns. */
  squish() {
    this.alive = false;
    const s = this.sprite;
    this.scene.tweens.add({
      targets: s,
      scaleY: 0.15,
      scaleX: 1.3,
      y: s.y + s.height * 0.4,
      alpha: 0,
      duration: 160,
      onComplete: () => s.setVisible(false),
    });
  }

  revive() {
    if (this.alive) return;
    this.alive = true;
    this.scene.tweens.killTweensOf(this.sprite);
    this.sprite.setScale(1).setAlpha(1).setVisible(true);
  }
}

/** The run of cells around `from` that pass `ok`, at most `max` cells each way: [first, last]. */
function reach(from: number, max: number, ok: (i: number) => boolean): [number, number] {
  let lo = from;
  let hi = from;
  while (from - lo < max && ok(lo - 1)) lo--;
  while (hi - from < max && ok(hi + 1)) hi++;
  return [lo, hi];
}

/** Back and forth between `lo` and `hi` at a steady speed, starting at `from` and heading for `lo`. */
function patrol(from: number, lo: number, hi: number, speed: number) {
  const span = hi - lo;
  return (tMs: number) => {
    if (span <= 0) return { pos: from, dir: -1 };
    const u = Phaser.Math.Wrap(from - lo - (speed * tMs) / 1000, 0, span * 2);
    return u <= span ? { pos: lo + u, dir: -1 } : { pos: lo + span * 2 - u, dir: 1 };
  };
}
