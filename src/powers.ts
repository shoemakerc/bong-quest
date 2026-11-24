export type PowerId = 'doubleJump' | 'dash' | 'wallJump' | 'glide';

export interface PowerDef {
  id: PowerId;
  name: string;
  /** Shown when the player picks up the bong. */
  hint: string;
  /** Short control reminder for the HUD. */
  controls: string;
  /** The same reminder in terms of the on-screen buttons. */
  touchControls: string;
  /** Pickup hint for touch, when `hint` mentions keys. */
  touchHint?: string;
  /** Placeholder tint for the bong and the player's flash. */
  color: number;
}

export const POWERS: Record<PowerId, PowerDef> = {
  doubleJump: {
    id: 'doubleJump',
    name: 'Cloud Hopper',
    hint: 'Press jump again in midair to double jump.',
    controls: 'Air jump: jump again',
    touchControls: 'Air jump: JUMP again',
    color: 0x6be675,
  },
  dash: {
    id: 'dash',
    name: 'Rip Dash',
    hint: 'Press Shift or X to dash. One dash per jump.',
    controls: 'Dash: Shift/X',
    touchControls: 'Dash: DASH',
    touchHint: 'Tap DASH to dash. One dash per jump.',
    color: 0x63b3ed,
  },
  wallJump: {
    id: 'wallJump',
    name: 'Sticky Resin',
    hint: 'Hold toward a wall to slide down it, then jump off it.',
    controls: 'Wall jump',
    touchControls: 'Wall jump: JUMP on a wall',
    color: 0xb794f4,
  },
  glide: {
    id: 'glide',
    name: 'Cloud Nine',
    hint: 'Hold jump while falling to drift down slowly.',
    controls: 'Glide: hold jump',
    touchControls: 'Glide: hold JUMP',
    color: 0xf687b3,
  },
};

/** Order powers are introduced in; used for HUD ordering. */
export const POWER_ORDER: PowerId[] = ['doubleJump', 'dash', 'wallJump', 'glide'];
