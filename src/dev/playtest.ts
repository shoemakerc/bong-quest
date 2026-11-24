import type Phaser from 'phaser';
import { TILE } from '../constants';
import type { GameScene } from '../scenes/GameScene';
import type { PowerId } from '../powers';
import { LEVELS } from '../levels';
import { setDayForTesting } from '../systems/save';
import { SOLUTIONS } from './solutions';

/**
 * Dev-only scripted playtesting. Steps the game manually (works even when the tab is hidden)
 * and fakes key presses, so you can check that a jump/climb/glide is possible from the console:
 *
 *   playtest.load(2); playtest.tp(14, 14); playtest.climb(1, 9)
 *
 * Levels with moving enemies are checked with whole-level input scripts instead; see `seq` and
 * `solve`, and ./solutions.ts.
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
    /** Where the player is and what he's doing, for working out a script. */
    state() {
      const p = player();
      const b = p.body;
      return {
        x: Math.round(p.x),
        feet: Math.round(b.bottom),
        col: +(p.x / TILE).toFixed(2),
        row: +(b.bottom / TILE - 1).toFixed(2),
        vy: Math.round(b.velocity.y),
        ground: b.blocked.down,
        deaths: deaths(),
        ms: Math.round(scene['elapsedMs'] as number),
        won: scene['won'] as boolean,
      };
    },
    /** Live enemies: kind and position in tiles. */
    enemies() {
      return scene['enemies']
        .filter((e) => e.alive)
        .map((e) => `${e.kind}@${(e.sprite.x / TILE).toFixed(1)},${(e.sprite.y / TILE).toFixed(1)}`);
    },
    /**
     * Plays a script of inputs, one token per step, and stops at the first death. A token is the keys
     * to hold (R right, L left, J jump, D dash, N nothing) and then how long to hold them:
     *
     *   R30        for 30 frames
     *   R>12.5     until his center is at or past column 12.5 (also `<`)
     *   RJ^9       until his feet are above the top of row 9 (also `v`: below it)
     *   RJ!        until he stops rising (the top of a jump)
     *   RJ~        until he lands
     *   N@300/2200 until the level clock, modulo 2200 ms, reaches 300 (to wait out an enemy's cycle)
     *
     * Keys not named in a token are released, so a second jump needs a gap: `RJ! R1 RJ12`.
     * `each` is called after every token, for tracing where a script goes wrong.
     */
    seq(script: string, each?: (token: string) => void) {
      const d0 = deaths();
      const fail = (why: string, token: string, i: number) => ({ ...api.state(), ok: false, why, token, index: i });
      const tokens = script.trim().split(/\s+/);
      const down = new Set<KeyName>();
      for (let i = 0; i < tokens.length; i++) {
        const m = /^([RLJDN]+)(\d+|[<>^v]-?[\d.]+|[~!]|@\d+\/\d+)$/.exec(tokens[i]);
        if (!m) throw new Error(`playtest.seq: bad token "${tokens[i]}"`);
        const [, keys, how] = m;
        // Only send a key event when a key changes, as a keyboard would: a stray key-up reads as
        // letting go of jump, which cuts a jump or a bounce short.
        for (const [letter, name] of [['R', 'right'], ['L', 'left'], ['J', 'jump'], ['D', 'dash']] as const) {
          const want = keys.includes(letter);
          if (want !== down.has(name)) key(name, want);
          if (want) down.add(name);
          else down.delete(name);
        }
        const n = parseFloat(how.slice(1));
        const [phase, period] = how.slice(1).split('/').map(Number);
        const done = (f: number): boolean => {
          const b = player().body;
          switch (how[0]) {
            case '>': return player().x >= n * TILE;
            case '<': return player().x <= n * TILE;
            case '^': return b.bottom <= n * TILE;
            case 'v': return b.bottom >= n * TILE;
            case '!': return f > 1 && b.velocity.y >= 0;
            case '~': return f > 1 && b.blocked.down;
            case '@': return ((scene['elapsedMs'] as number) - phase + period) % period < 17;
            default: return f >= parseInt(how, 10);
          }
        };
        let f = 0;
        while (!done(f)) {
          step();
          f++;
          if (deaths() > d0) {
            releaseAll();
            return fail('died', tokens[i], i);
          }
          if (api.won) break;
          if (f > 900) {
            releaseAll();
            return fail('stuck', tokens[i], i);
          }
        }
        each?.(tokens[i]);
        if (api.won) break;
      }
      releaseAll();
      step(2);
      return { ...api.state(), ok: true };
    },
    /** Like `seq` from the start of a level, returning a line per token: where he ended up and what's nearby. */
    trace(levelIndex: number, script: string) {
      api.load(levelIndex);
      const lines: string[] = [];
      const note = (token: string, extra = '') => {
        const s = api.state();
        const p = player();
        const near = scene['enemies']
          .filter((e) => e.alive && Math.abs(e.sprite.x - p.x) < 260 && Math.abs(e.sprite.y - p.y) < 300)
          .map((e) => `${e.kind[0]}${Math.round(e.sprite.x - p.x)},${Math.round(e.sprite.y - p.y)}`);
        lines.push(`${token} -> c${s.col} r${s.row} ${s.ground ? 'G' : 'air'} vy${s.vy} ${s.ms}ms [${near.join(' ')}]${extra}`);
      };
      const result = api.seq(script, note);
      if (!result.ok && 'why' in result) note(result.token, ` !!${result.why}`);
      if (result.won) lines.push('WON');
      return lines.join('\n');
    },
    /** Plays a level's recorded solution from ./solutions.ts and says whether it reached the flag. */
    solve(levelIndex: number) {
      const level = LEVELS[levelIndex];
      const script = SOLUTIONS[level.id];
      if (!script) return { level: level.id, ok: false, why: 'no recorded solution' };
      api.load(levelIndex);
      const result = api.seq(script.join(' '));
      return { level: level.id, ...result, ok: result.won && result.deaths === 0 };
    },
    /** Runs every recorded solution. */
    solveAll() {
      return LEVELS.map((l, i) => (SOLUTIONS[l.id] ? api.solve(i) : undefined)).filter(Boolean);
    },
    /** Pretend it's another day (YYYY-MM-DD) for the daily apparel drop; no argument goes back to today. */
    setDay(day?: string) {
      setDayForTesting(day);
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
