export const TILE = 32;
export const GAME_WIDTH = 960;
export const GAME_HEIGHT = 544;

export const PHYSICS = {
  gravity: 1400,
  runSpeed: 230,
  acceleration: 1800,
  drag: 2200,
  jumpVelocity: 520,
  /** Multiplier applied to upward velocity when jump is released early. */
  jumpCutoff: 0.45,
  coyoteMs: 100,
  jumpBufferMs: 120,
  maxFallSpeed: 900,
};

export const COLORS = {
  background: 0x1b1f2a,
  tile: 0x4a5568,
  tileEdge: 0x718096,
  player: 0xf6ad55,
  spike: 0xe53e3e,
  goal: 0xf6e05e,
};

export const TEXTURES = {
  tile: 'tile',
  player: 'player',
  spike: 'spike',
  goal: 'goal',
  bong: 'bong',
} as const;
