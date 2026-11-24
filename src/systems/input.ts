import Phaser from 'phaser';

/** The four things the player can do. Keyboard keys and on-screen buttons both feed these. */
export type Action = 'left' | 'right' | 'jump' | 'dash';
export const ACTIONS: Action[] = ['left', 'right', 'jump', 'dash'];

export interface ActionState {
  held: boolean;
  pressed: boolean;
  released: boolean;
}
export type InputFrame = Record<Action, ActionState>;

// ---------------------------------------------------------------- touch mode

const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
let touchMode = coarse;

/**
 * True on phones/tablets: on-screen controls and tap menus show instead of key hints.
 * Starts true for coarse-pointer devices and flips on at the first real touch anywhere.
 */
export function isTouch() {
  return touchMode;
}

function enableTouch() {
  touchMode = true;
  // index.html shows the "rotate your phone" overlay for html.touch in portrait.
  document.documentElement.classList.add('touch');
}

if (typeof window !== 'undefined') {
  if (touchMode) enableTouch();
  window.addEventListener(
    'pointerdown',
    (e) => {
      if (e.pointerType === 'touch' && !touchMode) enableTouch();
    },
    { capture: true },
  );
}

const portrait = typeof matchMedia === 'function' ? matchMedia('(orientation: portrait)') : undefined;
/** Touch device held upright: the "rotate your phone" overlay is covering the game. */
export function isPortraitTouch() {
  return touchMode && !!portrait?.matches;
}

// ---------------------------------------------------------------- touch buttons

export interface TouchZone {
  action: Action;
  /** Hit area in screen (= game) coordinates; usually a bit bigger than the drawn button. */
  rect: Phaser.Geom.Rectangle;
}

/**
 * Reads every pointer each frame, so a thumb can slide from ← to → without lifting, and several
 * fingers (move + jump + dash) work at once. A pointerdown latch catches taps shorter than a frame.
 */
class TouchButtons {
  zones: TouchZone[] = [];
  enabled = false;
  private latch = new Set<Action>();

  constructor(private scene: Phaser.Scene) {
    scene.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (!this.enabled) return;
      for (const z of this.zones) if (z.rect.contains(p.x, p.y)) this.latch.add(z.action);
    });
  }

  /** Which actions have a finger on them right now. */
  heldNow(): Set<Action> {
    const held = new Set<Action>();
    if (!this.enabled) return held;
    for (const p of this.scene.input.manager.pointers) {
      if (!p.isDown) continue;
      for (const z of this.zones) if (z.rect.contains(p.x, p.y)) held.add(z.action);
    }
    return held;
  }

  takeLatched(action: Action) {
    return this.latch.delete(action);
  }

  clearLatch() {
    this.latch.clear();
  }
}

// ---------------------------------------------------------------- merged input

const K = Phaser.Input.Keyboard.KeyCodes;
const KEYMAP: Record<Action, number[]> = {
  left: [K.LEFT, K.A],
  right: [K.RIGHT, K.D],
  jump: [K.UP, K.W, K.SPACE],
  dash: [K.SHIFT, K.X],
};

/**
 * Keyboard + on-screen buttons merged into held/pressed/released per action.
 * Call `sample()` exactly once per frame; like Phaser's JustDown/JustUp, it consumes the edges.
 */
export class GameInput {
  readonly touch: TouchButtons;
  private keys: Record<Action, Phaser.Input.Keyboard.Key[]>;
  private touchPrev = new Set<Action>();

  constructor(scene: Phaser.Scene) {
    const kb = scene.input.keyboard!;
    this.keys = Object.fromEntries(
      ACTIONS.map((a) => [a, KEYMAP[a].map((code) => kb.addKey(code))]),
    ) as Record<Action, Phaser.Input.Keyboard.Key[]>;
    this.touch = new TouchButtons(scene);
  }

  sample(): InputFrame {
    const touchHeld = this.touch.heldNow();
    const frame = {} as InputFrame;
    for (const a of ACTIONS) {
      const keys = this.keys[a];
      // Same short-circuiting `some` the player always used, so keyboard edges behave exactly as before.
      const kbPressed = keys.some((k) => Phaser.Input.Keyboard.JustDown(k));
      const kbReleased = keys.some((k) => Phaser.Input.Keyboard.JustUp(k));
      const kbHeld = keys.some((k) => k.isDown);

      const tHeld = touchHeld.has(a);
      const tWas = this.touchPrev.has(a);
      const tLatched = this.touch.takeLatched(a);
      const tPressed = (tHeld && !tWas) || tLatched;
      // A tap that started and ended between frames counts as press + release, like a quick key tap.
      const tReleased = (tWas && !tHeld) || (tLatched && !tHeld);

      frame[a] = { held: kbHeld || tHeld, pressed: kbPressed || tPressed, released: kbReleased || tReleased };
    }
    this.touchPrev = touchHeld;
    return frame;
  }

  /** Actions under a finger as of the last `sample()`, for button highlights. */
  get touchHeld(): ReadonlySet<Action> {
    return this.touchPrev;
  }

  /** Forget touch edges, e.g. after a pause menu, so a stale tap doesn't fire on resume. */
  resetTouch() {
    this.touch.clearLatch();
    this.touchPrev = this.touch.heldNow();
  }
}
