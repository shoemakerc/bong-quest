import type Phaser from 'phaser';
import { TILE } from '../constants';
import type { GameScene } from '../scenes/GameScene';
import type { PowerId } from '../powers';

/**
 * Dev-only scripted playtesting. Steps the game manually (works even when the tab is hidden)
 * and fakes key presses, so you can check that a jump/climb/glide is possible from the console:
 *
 *   playtest.load(2); playtest.tp(14, 14); playtest.climb(1, 9)
 */
const KEYS = { left: 37, right: 39, jump: 32, dash: 88 } as const;
type KeyName = keyof typeof KEYS;

interface Result {
  died: boolean;
  col: number;
  row: number;
}

export function installPlaytest(game: Phaser.Game) {
  let t = performance.now() + 1e7;
  let scene: GameScene;

  const step = (frames = 1) => {
    for (let i = 0; i < frames; i++) {
      t += 1000 / 60;
      game.step(t, 1000 / 60);
    }
  };
  const key = (name: KeyName, down: boolean) => {
    const e = new KeyboardEvent(down ? 'keydown' : 'keyup', { bubbles: true, cancelable: true });
    Object.defineProperty(e, 'keyCode', { get: () => KEYS[name] });
    Object.defineProperty(e, 'which', { get: () => KEYS[name] });
    window.dispatchEvent(e);
  };
  const releaseAll = () => (Object.keys(KEYS) as KeyName[]).forEach((k) => key(k, false));
  const player = () => scene['player'];
  const deaths = () => scene['deaths'] as number;
  const where = (d0: number): Result => {
    const b = player().body;
    return { died: deaths() > d0, col: Math.floor(player().x / TILE), row: Math.floor(b.bottom / TILE) - 1 };
  };

  const api = {
    step,
    key,
    load(levelIndex: number, powers?: PowerId[]) {
      releaseAll();
      step(5); // settle any real frames that ran in between calls
      game.scene.getScenes(true)[0].scene.start('Game', { levelIndex });
      step(10);
      scene = game.scene.getScene('Game') as GameScene;
      if (powers) {
        player().powers.clear();
        powers.forEach((p) => player().grantPower(p));
      }
      return scene;
    },
    /** Teleport so the player stands in tile (col,row). */
    tp(col: number, row: number) {
      player().respawn(col * TILE + TILE / 2, (row + 1) * TILE - 20);
      step(3);
    },
    /**
     * Run toward the gap at `edgeCol`, jump at the last moment, then call `script(frame)` every frame
     * until landing or dying. Frame 0 is the takeoff frame.
     */
    gap(edgeCol: number, script: (f: number) => void = () => {}, dir: 1 | -1 = 1): Result {
      const d0 = deaths();
      key(dir > 0 ? 'right' : 'left', true);
      let f0 = -1;
      for (let f = 0; f < 900; f++) {
        step();
        const b = player().body;
        const atEdge = dir > 0 ? b.left >= edgeCol * TILE - 3 : b.right <= (edgeCol + 1) * TILE + 3;
        if (f0 < 0 && atEdge) {
          key('jump', true);
          f0 = f;
        }
        if (f0 >= 0) {
          script(f - f0);
          if (f - f0 > 8 && b.blocked.down) break;
        }
        if (deaths() > d0) break;
      }
      releaseAll();
      step(2);
      return where(d0);
    },
    /** Common in-air scripts for `gap`. */
    moves: {
      double: (f: number) => {
        if (f === 20) key('jump', false);
        if (f === 22) key('jump', true);
      },
      doubleDash: (f: number) => {
        if (f === 20) key('jump', false);
        if (f === 22) key('jump', true);
        if (f === 50) key('dash', true);
      },
      dash: (f: number) => {
        if (f === 3) key('dash', true);
      },
    },
    /**
     * Wall-jump up a chimney: start on its floor, bounce between the walls until within two tiles
     * of `exitRow` while heading `exitDir`, then double jump over the lip and hold until landing.
     */
    climb(firstDir: 1 | -1, exitRow: number, exitDir: 1 | -1 = 1): Result & { hops: number } {
      const d0 = deaths();
      let dir = firstDir;
      let hops = 0;
      let exiting = false;
      // Hold jump ~14 frames like a person would (a 1-frame tap triggers the short-hop cut).
      let releaseJumpAt = 20;
      key('jump', true);
      for (let f = 0; f < 1800; f++) {
        step();
        if (f === releaseJumpAt) key('jump', false);
        const b = player().body;
        if (deaths() > d0) break;
        // Near the top and heading the right way: double jump over the lip.
        if (!exiting && hops > 0 && dir === exitDir && b.bottom < (exitRow + 2) * TILE) {
          exiting = true;
          key('jump', false);
          step();
          key('jump', true);
          releaseJumpAt = Infinity;
        }
        if (exiting) {
          if (b.blocked.down) break;
          continue;
        }
        // Opening move: jump straight up and double jump to get above the chimney's entrance,
        // then drift toward the first wall.
        if (f === 24) key('jump', true);
        if (f === 26) key(dir > 0 ? 'right' : 'left', true);
        if (f === 38) key('jump', false);
        const touching = dir > 0 ? b.blocked.right : b.blocked.left;
        if (f > 24 && touching && !b.blocked.down) {
          key(dir > 0 ? 'right' : 'left', false);
          dir = dir > 0 ? -1 : 1;
          key(dir > 0 ? 'right' : 'left', true);
          key('jump', false);
          step();
          key('jump', true);
          releaseJumpAt = f + 14;
          hops++;
        }
      }
      releaseAll();
      step(20);
      return { ...where(d0), hops };
    },
    /** Run toward the gap at `edgeCol` and dash across without jumping (for spiked ceilings). */
    dashOff(edgeCol: number, dir: 1 | -1 = 1): Result {
      const d0 = deaths();
      key(dir > 0 ? 'right' : 'left', true);
      let dashedAt = -1;
      for (let f = 0; f < 900; f++) {
        step();
        const b = player().body;
        const atEdge = dir > 0 ? b.right >= edgeCol * TILE + 8 : b.left <= (edgeCol + 1) * TILE - 8;
        if (dashedAt < 0 && atEdge) {
          key('dash', true);
          dashedAt = f;
        }
        if (dashedAt >= 0 && f > dashedAt + 15 && b.blocked.down) break;
        if (deaths() > d0) break;
      }
      releaseAll();
      step(2);
      return where(d0);
    },
    /**
     * Glide down a shaft, steering toward a target column per band of rows.
     * `bands` is [untilRow, targetCol][]: while the player's feet are above `untilRow`, aim for `targetCol`.
     */
    glideDown(bands: [number, number][]): Result {
      const d0 = deaths();
      key('jump', true);
      let held: KeyName | null = null;
      for (let f = 0; f < 3000; f++) {
        step();
        const b = player().body;
        if (deaths() > d0) break;
        const row = b.bottom / TILE;
        const band = bands.find(([untilRow]) => row < untilRow);
        const target = band ? band[1] * TILE + TILE / 2 : player().x;
        const want: KeyName | null =
          Math.abs(target - player().x) < 8 ? null : target > player().x ? 'right' : 'left';
        if (want !== held) {
          if (held) key(held, false);
          if (want) key(want, true);
          held = want;
        }
        if (f > 30 && b.blocked.down && !band) break;
      }
      releaseAll();
      step(2);
      return where(d0);
    },
    /** Walk in a direction for some frames. */
    walk(dir: 1 | -1, frames: number) {
      key(dir > 0 ? 'right' : 'left', true);
      step(frames);
      releaseAll();
      step(2);
      return where(deaths());
    },
    get scene() {
      return scene;
    },
    get won() {
      return scene['won'] as boolean;
    },
  };

  Object.assign(window, { playtest: api });
}
