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

  dashSpeed: 640,
  dashMs: 190,

  /** Bumping a ledge corner this close to its top in midair pops you up onto it. */
  cornerCorrection: 12,

  wallSlideSpeed: 110,
  wallJumpX: 230,
  wallJumpY: 500,
  /** Grace period after leaving a wall during which a wall jump still works. */
  wallCoyoteMs: 110,
  /** Horizontal input is ignored this long after a wall jump so you actually leave the wall. */
  wallJumpLockMs: 160,

  glideFallSpeed: 75,

  /** Upward speed after landing on an enemy: a small hop, or a big one if jump is held. */
  stompBounce: 380,
  stompBounceHeld: 560,
  /** A falling player whose feet are within this many px of an enemy's top squishes it. */
  stompTolerance: 18,
  /** A used lighter comes back after this long. */
  lighterRespawnMs: 2500,
};

export const COLORS = {
  background: 0x1b1f2a,
  tile: 0x4a5568,
  tileEdge: 0x718096,
  player: 0xf6ad55,
  spike: 0xe53e3e,
  goal: 0xf6e05e,
  checkpoint: 0x9ae6b4,
  checkpointOff: 0x4a5568,
  lighter: 0xedf2f7,
  flame: 0xf6ad55,
  buzzkill: 0x38b2ac,
  badVibe: 0x9f7aea,
  ember: 0xe53e3e,
  text: '#e2e8f0',
  textDim: '#a0aec0',
};

export const FONT = 'monospace';

export const TEXTURES = {
  tile: 'tile',
  tileInner: 'tileInner',
  player: 'player',
  spike: 'spike',
  goal: 'goal',
  bong: 'bong',
  checkpoint: 'checkpoint',
  lighter: 'lighter',
  buzzkill: 'buzzkill',
  badVibe: 'badVibe',
  ember: 'ember',
  pixel: 'pixel',
} as const;
