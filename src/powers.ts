export type PowerId = 'doubleJump';

export interface PowerDef {
  id: PowerId;
  name: string;
  /** Shown when the player picks up the bong. */
  hint: string;
  /** Placeholder tint for the bong and the player's glow. */
  color: number;
}

export const POWERS: Record<PowerId, PowerDef> = {
  doubleJump: {
    id: 'doubleJump',
    name: 'Cloud Hopper',
    hint: 'Press jump again in midair to double jump.',
    color: 0x6be675,
  },
};
