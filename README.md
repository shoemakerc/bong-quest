# Bong Quest

A 2D platformer about a guy who collects bongs, each of which grants a new power. Nineteen levels,
three kinds of enemy, lighters that refill your air moves, and a new piece of apparel to pick up
every day. Plays with a keyboard, or with on-screen touch controls on phones and tablets (one build
serves both).

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

| Action        | Keys                                   | Touch                                      |
|---------------|----------------------------------------|--------------------------------------------|
| Move          | ← → or A D                             | ◀ ▶ buttons, bottom left (slide between them) |
| Jump          | ↑, W or Space (hold for higher)        | JUMP, bottom right (hold for higher)       |
| Glide         | Hold jump while falling                | Hold JUMP while falling                    |
| Dash          | Shift or X (after the Rip Dash bong)   | DASH, left of JUMP (appears with the bong) |
| Restart level | R                                      | II (top) → Restart level                   |
| Level select  | Esc                                    | II → Level select                          |
| Mute          | M                                      | II → sound, or the ♪ button on menus       |
| Show controls | H                                      | Shown on level start and after resuming    |
| Closet        | C on the level select                  | Closet button on the level select          |

Menus take taps too: tap the title to start, tap a level row to play it (drag to scroll), and tap
Next / Retry / Levels when you finish a level.

### Phones and tablets

The game is landscape; holding a phone upright shows a "turn your phone" screen and pauses the
level. Touch mode switches on for coarse-pointer devices or at the first touch, so a touchscreen
laptop still gets keyboard hints until it's touched.

- **Android / iPad:** the first tap on the title goes fullscreen and locks landscape where the
  browser allows it.
- **iPhone:** Safari has no fullscreen API for pages. Use Share → Add to Home Screen; the web app
  manifest (`public/manifest.webmanifest`) opens it fullscreen in landscape.
- Sound plays even with the ring/silent switch on (Safari's `navigator.audioSession` set to
  `playback`).

## Bongs and powers

| Level | Bong          | Power                                                        |
|-------|---------------|--------------------------------------------------------------|
| 1     | Cloud Hopper  | Double jump                                                  |
| 2     | Rip Dash      | Horizontal dash, once per jump (refills on ground or walls)  |
| 3     | Sticky Resin  | Wall slide and wall jump (also refills air jump and dash)    |
| 4     | Cloud Nine    | Glide: hold jump while falling                               |
| 5     | -             | Finale: everything at once                                   |
| 6–9   | -             | Bonus levels: spiked ceilings, a vertical climb, a long glide down, and a final gauntlet |
| 10–13 | -             | One new thing each: Buzzkills, lighters, Bad Vibes, Embers   |
| 14–19 | -             | Those mixed together: stomps under spikes, a lighter climb, three long crossings, a descent, tunnels, and a finale |

Each level starts with the powers from the levels before it. Progress, best times and apparel are
saved in the browser's localStorage.

## Lighters and enemies

**Lighters** are a pickup that relights your double jump and dash in midair, so a chain of them
carries you over a pit too wide to glide, or up a wall too spiky to climb. A used lighter comes back
after 2.5 seconds. Touching one with both moves still in hand leaves it alone.

| Enemy     | What it does                                              | Stomp it? |
|-----------|-----------------------------------------------------------|-----------|
| Buzzkill  | Walks its platform end to end, turning at walls, spikes and ledges | Yes |
| Bad Vibe  | A storm cloud that floats back and forth, or up and down  | Yes       |
| Ember     | Leaps straight up from where it sits, over and over       | No: every touch hurts |

Land on a Buzzkill or a Bad Vibe from above and it is squished: you bounce (higher if jump is held)
and get your double jump and dash back, which makes them stepping stones as much as hazards.
Touching one from the side or from below costs a life, the same as spikes. Squished enemies and
spent lighters come back whenever you respawn.

Checkpoints are as tall as the goal's pole, so jumping over the flag still sets it.

## Apparel

Once a day, an apparel item turns up in the first level you start: a hat, shirt, necklace or pair
of shoes, in a randomly rolled style and color scheme, so each one is one of a kind. It sits beside
your start or one of that level's checkpoints (the level-start message and the level select say
when one is waiting, and where). Walk into it and he puts it on; after that nothing drops until the
next day, by your device's clock. An item you leave behind stays in that level for the rest of the
day.

Everything you have picked up lives in the **Closet** (C or the Closet button on the level select),
where each slot can wear any item you own for it, or nothing.

## Project layout

```
src/
  main.ts                    Phaser game config
  constants.ts               Tile size, physics tuning, colors
  powers.ts                  Power registry: every bong's power is defined here
  apparel.ts                 Apparel: rolling a random item, and drawing each style
  entities/Player.ts         Movement, jumping (coyote time, buffering, variable height), all powers, stomp bounce
  entities/enemies.ts        The three enemies: how each moves, and which can be stomped
  levels/types.ts            ASCII legend for level maps
  levels/level1..19.ts       Levels as ASCII maps
  levels/index.ts            Level order
  scenes/BootScene.ts        Generates placeholder textures
  scenes/TitleScene.ts       Title screen
  scenes/LevelSelectScene.ts Level select with locks and best times
  scenes/ClosetScene.ts      Try on collected apparel
  scenes/GameScene.ts        Builds the level, collisions, pickups, enemies, the daily drop, checkpoints, HUD, touch buttons, pause menu
  systems/input.ts           Keyboard + touch buttons merged into held/pressed/released per action
  systems/save.ts            Progress, apparel, the daily drop and settings in localStorage
  systems/sfx.ts             Synthesized sound effects
  systems/ui.ts              Text styles, tap buttons, mute toggle
public/                      Web app manifest and home-screen icons
  dev/playtest.ts            Dev-only scripted playtesting from the browser console
  dev/solutions.ts           Recorded playthroughs of levels 10-19, replayed by playtest.solveAll()
```

## Level legend

| Char | Meaning            |
|------|--------------------|
| `#`  | Solid              |
| `^`  | Spikes (pointing up)    |
| `v`  | Ceiling spikes          |
| `<` `>` | Wall spikes (pointing left / right) |
| `P`  | Player spawn       |
| `C`  | Checkpoint         |
| `G`  | Goal flag          |
| `J`  | Cloud Hopper bong  |
| `S`  | Rip Dash bong      |
| `W`  | Sticky Resin bong  |
| `F`  | Cloud Nine bong    |
| `L`  | Lighter            |
| `B`  | Buzzkill (give it floor to walk on) |
| `H` `U` | Bad Vibe flying side to side (3 tiles each way) / up and down (2 tiles each way) |
| `E`  | Ember (leaps 5 tiles, or as high as the ceiling allows) |

Reachability reference (horizontal reach in pixels, same height; tiles are 32px):
jump ≈ 197 (max height ≈ 91, so 2-tile steps), double jump ≈ 332 (height ≈ 180), jump + dash ≈ 316,
double jump + dash ≈ 450, double jump + glide ≈ 650. In a 2-tile-tall tunnel, only dash gets you
much past 4 tiles. Under a spiked ceiling 3 tiles above the floor, any full jump is fatal. Bumping a
ledge corner within 12px of its top in midair pops you onto it (`PHYSICS.cornerCorrection`).
Double jump + dash + glide ≈ 758, so a pit of 28 tiles or more needs a lighter or a stomp partway.
A stomp bounces you 48px, or 104px with jump held; each lighter is worth another 92px of height.
Under a spiked ceiling 5 tiles above the floor, a jump or a plain stomp is safe but a held bounce or
a double jump is fatal. In a 2-tile-tall tunnel a Buzzkill can't be jumped over, only hopped onto.

Enemies never walk onto a spawn or checkpoint in the built-in levels: those sit on a one-tile ledge
or an enemy-free stretch, because a respawn has no grace period.

## Adding things

- **A new level:** add `src/levels/levelN.ts` and list it in `src/levels/index.ts`. Maps can be any
  width or height; levels smaller than the screen are centered.
- **A new bong power:** add it to `PowerId` / `POWERS` / `POWER_ORDER` in `src/powers.ts`, give it a
  map character in `LEVEL_LEGEND`, then implement the behavior in `Player.ts`.
- **A new enemy:** add it to `EnemyKind` and `LEVEL_LEGEND` in `src/levels/types.ts`, describe it in
  `ENEMIES` in `src/entities/enemies.ts` and give it a path there (a position for any level time),
  and draw its texture in `BootScene.ts`.
- **A new apparel style:** add it to `STYLES` in `src/apparel.ts` and draw it in `drawApparel`.
- **Tweak game feel:** everything lives in `PHYSICS` in `src/constants.ts`.

## Playtesting from the console (dev only)

In `npm run dev`, the browser console has `window.game` and `window.playtest`, which steps the game
and fakes key presses so you can check that a section is beatable:

```js
playtest.load(2)               // level index (0-based), optionally a powers list
playtest.tp(15, 14)            // stand in tile (col, row)
playtest.climb(1, 4)           // wall-jump up a chimney, exit over row 4
playtest.gap(37, playtest.moves.doubleDash)  // run + jump over the gap starting at col 37
playtest.dashOff(17)           // run off the edge at col 17 and dash across without jumping
playtest.glideDown([[13, 16], [21, 3]])      // glide down, aiming for col 16 until row 13, then col 3
```

Levels with moving enemies depend on timing, so levels 10-19 are checked with whole-level input
scripts instead, recorded in `src/dev/solutions.ts`:

```js
playtest.solveAll()            // replay every recorded solution; each should reach its flag with no deaths
playtest.solve(13)             // just one level (0-based index)
playtest.trace(13, 'R>7.6 RJ! R~')  // play a script from the level's start, with a line per step
playtest.setDay('2026-12-01')  // pretend it's another day, to see the next apparel drop
```

A script is a list of steps: the keys to hold (`R` `L` `J` `D`, or `N` for none) and how long, such
as `R30` (30 frames), `R>12.5` (until column 12.5), `RJ!` (to the top of the jump), `RJ~` (until
landing) or `N@300/2200` (until the level clock, modulo 2200 ms, reads 300). Enemies move as a pure
function of level time, so a script replays exactly. Rerun `solveAll()` after changing a level or
the physics.

Note that playtest runs record finishes in your save like normal play, and will pick up the day's
apparel drop if they pass it. `playtest` fakes keyboard events; the player reads keyboard and touch
through the same `GameInput`, so results apply to both.

To try touch controls on a computer, use your browser's device emulation in landscape (for example
Chrome DevTools' device toolbar with a phone rotated sideways).
