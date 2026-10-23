import Phaser from 'phaser';
import { COLORS, FONT } from '../constants';
import { save } from './save';
import { sfx } from './sfx';

export function textStyle(size: number, color = COLORS.text): Phaser.Types.GameObjects.Text.TextStyle {
  return { fontFamily: FONT, fontSize: `${size}px`, color };
}

/** Keys that work on every screen. */
export function bindGlobalKeys(scene: Phaser.Scene, onMuteChange?: () => void) {
  scene.input.keyboard!.on('keydown-M', () => {
    save.muted = !save.muted;
    sfx('select');
    onMuteChange?.();
  });
}

export function muteLabel() {
  return save.muted ? 'M: sound off' : 'M: sound on';
}
