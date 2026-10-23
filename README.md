# Bong Quest

A keyboard-only 2D platformer about a guy who collects bongs, each of which grants a new power.

Built with [Phaser 3](https://phaser.io/) + TypeScript + [Vite](https://vite.dev/). All visuals are
placeholder rectangles and all sounds are synthesized at runtime, so there are no asset files (yet).

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
```

`npm run build` type-checks and outputs a static site to `dist/`. Every push to `main` deploys to
GitHub Pages via `.github/workflows/deploy.yml`.

Add `?unlockAll` to the URL to unlock every level.

## Controls

| Action        | Keys                                   |
|---------------|----------------------------------------|
| Move          | ← → or A D                             |
| Jump          | ↑, W or Space (hold for higher)        |
| Dash          | Shift or X (after the Rip Dash bong)   |
| Restart level | R                                      |
| Level select  | Esc                                    |
| Mute          | M                                      |

## Bongs and powers

| Level | Bong          | Power                                                        |
|-------|---------------|--------------------------------------------------------------|
| 1     | Cloud Hopper  | Double jump                                                  |
| 2     | Rip Dash      | Horizontal dash, once per jump (refills on ground or walls)  |
| 3     | Sticky Resin  | Wall slide and wall jump (also refills air jump and dash)    |
| 4     | Cloud Nine    | Glide: hold jump while falling                               |
| 5     | -             | Finale: everything at once                                   |

Each level starts with the powers from the levels before it. Progress and best times are saved in
the browser's localStorage.

## Project layout

```
src/
  main.ts                    Phaser game config
  constants.ts               Tile size, physics tuning, colors
  powers.ts                  Power registry: every bong's power is defined here
  entities/Player.ts         Movement, jumping (coyote time, buffering, variable height), all powers
  levels/types.ts            ASCII legend for level maps
  levels/level1..5.ts        Levels as ASCII maps
  levels/index.ts            Level order
  scenes/BootScene.ts        Generates placeholder textures
  scenes/TitleScene.ts       Title screen
  scenes/LevelSelectScene.ts Level select with locks and best times
  scenes/GameScene.ts        Builds the level, collisions, pickups, checkpoints, HUD
  systems/save.ts            Progress and settings in localStorage
  systems/sfx.ts             Synthesized sound effects
  dev/playtest.ts            Dev-only scripted playtesting from the browser console
```

## Level legend

| Char | Meaning            |
|------|--------------------|
| `#`  | Solid              |
| `^`  | Spikes             |
| `P`  | Player spawn       |
| `C`  | Checkpoint         |
| `G`  | Goal flag          |
| `J`  | Cloud Hopper bong  |
| `S`  | Rip Dash bong      |
| `W`  | Sticky Resin bong  |
| `F`  | Cloud Nine bong    |

Reachability reference (horizontal reach in pixels, same height; tiles are 32px):
jump ≈ 197 (max height ≈ 91, so 2-tile steps), double jump ≈ 332 (height ≈ 180), jump + dash ≈ 316,
double jump + dash ≈ 450, double jump + glide ≈ 650. In a 2-tile-tall tunnel, only dash gets you
much past 4 tiles.

## Adding things

- **A new level:** add `src/levels/levelN.ts` and list it in `src/levels/index.ts`.
- **A new bong power:** add it to `PowerId` / `POWERS` / `POWER_ORDER` in `src/powers.ts`, give it a
  map character in `LEVEL_LEGEND`, then implement the behavior in `Player.ts`.
- **Tweak game feel:** everything lives in `PHYSICS` in `src/constants.ts`.

## Playtesting from the console (dev only)

In `npm run dev`, the browser console has `window.game` and `window.playtest`, which steps the game
and fakes key presses so you can check that a section is beatable:

```js
playtest.load(2)               // level index (0-based), optionally a powers list
playtest.tp(15, 14)            // stand in tile (col, row)
playtest.climb(1, 4)           // wall-jump up a chimney, exit over row 4
playtest.gap(37, playtest.moves.doubleDash)  // run + jump over the gap starting at col 37
```

Note that playtest runs record finishes in your save like normal play.
