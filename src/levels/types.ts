import type { PowerId } from '../powers';

export interface LevelData {
  name: string;
  /** Rows of tiles, top to bottom. Every row must be the same width. */
  map: string[];
}

export type TileKind = 'solid' | 'spike' | 'spawn' | 'goal' | 'bong';

/** Map characters → what they place. Bong characters also name the power they grant. */
export const LEVEL_LEGEND: Record<string, { kind: TileKind; power?: PowerId }> = {
  '#': { kind: 'solid' },
  '^': { kind: 'spike' },
  P: { kind: 'spawn' },
  G: { kind: 'goal' },
  D: { kind: 'bong', power: 'doubleJump' },
};
