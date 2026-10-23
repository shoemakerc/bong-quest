# Bong Quest

A keyboard-only 2D platformer about a guy who collects bongs, each of which grants a new power.

Built with [Phaser 3](https://phaser.io/) + TypeScript + [Vite](https://vite.dev/). All visuals are
placeholder rectangles generated at runtime (`src/scenes/BootScene.ts`) until real art lands.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
```

`npm run build` type-checks and outputs a static site to `dist/`.

## Controls

| Action  | Keys              |
|---------|-------------------|
| Move    | ← → or A D        |
| Jump    | ↑, W or Space (hold for higher) |
| Restart | R                 |

## Project layout

```
src/
  main.ts              Phaser game config
  constants.ts         Tile size, physics tuning, placeholder colors
  powers.ts            Power registry: every bong's power is defined here
  entities/Player.ts   Movement, jumping (coyote time, jump buffer, variable height), powers
  levels/types.ts      ASCII legend for level maps
  levels/level1.ts     First level as an ASCII map
  scenes/BootScene.ts  Generates placeholder textures
  scenes/GameScene.ts  Builds the level, collisions, pickups, HUD
```

## Adding things

- **A new level tile:** add a character to `LEVEL_LEGEND` in `src/levels/types.ts`.
- **A new bong power:** add it to `PowerId` / `POWERS` in `src/powers.ts`, give it a map character in
  `LEVEL_LEGEND`, then implement the behavior in `Player.ts`.
- **Tweak game feel:** everything lives in `PHYSICS` in `src/constants.ts`.

In dev builds the game instance is available as `window.game` in the browser console.
