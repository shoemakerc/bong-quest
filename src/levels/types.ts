import type { PowerId } from '../powers';

export interface LevelData {
  id: string;
  name: string;
  /** One-liner shown on the level-select screen. */
  tagline: string;
  /** Powers the player already has when the level starts (earned in earlier levels). */
  startingPowers: PowerId[];
  /** Optional tip shown under the level's name when it starts (used to introduce something new). */
  hint?: string;
  /** Rows of tiles, top to bottom. Every row must be the same width; any number of rows. See LEVEL_LEGEND. */
  map: string[];
}

export type TileKind = 'solid' | 'spike' | 'spawn' | 'goal' | 'checkpoint' | 'bong' | 'lighter' | 'enemy';

/** See src/entities/enemies.ts for how each one moves. */
export type EnemyKind = 'buzzkill' | 'badVibe' | 'ember';

/** Which way a spike points. Its base sits on the opposite side of the tile. */
export type SpikeDir = 'up' | 'down' | 'left' | 'right';

export interface LegendEntry {
  kind: TileKind;
  power?: PowerId;
  dir?: SpikeDir;
  enemy?: EnemyKind;
  /** Which way a Bad Vibe patrols. */
  axis?: 'x' | 'y';
}

/** Map characters → what they place. Bong characters also name the power they grant. */
export const LEVEL_LEGEND: Record<string, LegendEntry> = {
  '#': { kind: 'solid' },
  '^': { kind: 'spike', dir: 'up' },
  v: { kind: 'spike', dir: 'down' },
  '<': { kind: 'spike', dir: 'left' },
  '>': { kind: 'spike', dir: 'right' },
  P: { kind: 'spawn' },
  G: { kind: 'goal' },
  C: { kind: 'checkpoint' },
  J: { kind: 'bong', power: 'doubleJump' },
  S: { kind: 'bong', power: 'dash' },
  W: { kind: 'bong', power: 'wallJump' },
  F: { kind: 'bong', power: 'glide' },
  L: { kind: 'lighter' },
  B: { kind: 'enemy', enemy: 'buzzkill' },
  H: { kind: 'enemy', enemy: 'badVibe', axis: 'x' },
  U: { kind: 'enemy', enemy: 'badVibe', axis: 'y' },
  E: { kind: 'enemy', enemy: 'ember' },
};
