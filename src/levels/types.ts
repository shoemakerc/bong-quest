import type { PowerId } from '../powers';

export interface LevelData {
  id: string;
  name: string;
  /** One-liner shown on the level-select screen. */
  tagline: string;
  /** Powers the player already has when the level starts (earned in earlier levels). */
  startingPowers: PowerId[];
  /** Rows of tiles, top to bottom. Every row must be the same width; any number of rows. See LEVEL_LEGEND. */
  map: string[];
}

export type TileKind = 'solid' | 'spike' | 'spawn' | 'goal' | 'checkpoint' | 'bong';

/** Which way a spike points. Its base sits on the opposite side of the tile. */
export type SpikeDir = 'up' | 'down' | 'left' | 'right';

/** Map characters → what they place. Bong characters also name the power they grant. */
export const LEVEL_LEGEND: Record<string, { kind: TileKind; power?: PowerId; dir?: SpikeDir }> = {
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
};
