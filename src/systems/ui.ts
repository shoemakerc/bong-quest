import Phaser from 'phaser';
import { COLORS, FONT } from '../constants';
import { isTouch } from './input';
import { save } from './save';
import { sfx } from './sfx';

export function textStyle(size: number, color = COLORS.text): Phaser.Types.GameObjects.Text.TextStyle {
  return { fontFamily: FONT, fontSize: `${size}px`, color };
}

export function toggleMute() {
  save.muted = !save.muted;
  sfx('select');
}

/** Keys that work on every screen. */
export function bindGlobalKeys(scene: Phaser.Scene, onMuteChange?: () => void) {
  scene.input.keyboard!.on('keydown-M', () => {
    toggleMute();
    onMuteChange?.();
  });
}

export function muteLabel() {
  if (isTouch()) return save.muted ? '♪ sound off' : '♪ sound on';
  return save.muted ? 'M: sound off' : 'M: sound on';
}

export interface TapButton {
  bg: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.Text;
  setText(text: string): void;
  setVisible(visible: boolean): void;
  destroy(): void;
}

/**
 * A placeholder-rectangle button that fires on tap/click release. Pinned to the screen
 * (scroll factor 0) because every caller is HUD or menu chrome.
 */
export function tapButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  w: number,
  h: number,
  text: string,
  onTap: () => void,
  { depth = 40, size = 20 }: { depth?: number; size?: number } = {},
): TapButton {
  const bg = scene.add
    .rectangle(x, y, w, h, 0x2d3748, 0.92)
    .setStrokeStyle(2, COLORS.tileEdge)
    .setScrollFactor(0)
    .setDepth(depth)
    .setInteractive({ useHandCursor: true });
  const label = scene.add
    .text(x, y, text, textStyle(size))
    .setOrigin(0.5)
    .setScrollFactor(0)
    .setDepth(depth + 1);
  // Only a press that started on this button counts, so a finger sliding in from elsewhere doesn't fire it.
  let armed = false;
  const idle = () => bg.setFillStyle(0x2d3748, 0.92).setStrokeStyle(2, COLORS.tileEdge);
  bg.on('pointerdown', () => {
    armed = true;
    bg.setFillStyle(0x3c4a5e, 1).setStrokeStyle(2, COLORS.player);
  });
  bg.on('pointerout', () => {
    armed = false;
    idle();
  });
  bg.on('pointerup', () => {
    idle();
    if (!armed) return;
    armed = false;
    onTap();
  });
  return {
    bg,
    label,
    setText: (t) => label.setText(t),
    setVisible(v) {
      bg.setVisible(v);
      label.setVisible(v);
      if (v) bg.setInteractive();
      else bg.disableInteractive();
    },
    destroy() {
      bg.destroy();
      label.destroy();
    },
  };
}
