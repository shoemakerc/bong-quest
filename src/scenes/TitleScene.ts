import Phaser from 'phaser';
import { addOutfit } from '../apparel';
import { COLORS, GAME_HEIGHT, GAME_WIDTH, TEXTURES } from '../constants';
import { POWERS, POWER_ORDER } from '../powers';
import { isTouch } from '../systems/input';
import { save } from '../systems/save';
import { sfx } from '../systems/sfx';
import { bindGlobalKeys, muteLabel, textStyle, toggleMute } from '../systems/ui';

export class TitleScene extends Phaser.Scene {
  constructor() {
    super('Title');
  }

  create() {
    const cx = GAME_WIDTH / 2;

    this.add.text(cx, 130, 'BONG QUEST', textStyle(72, '#f6ad55')).setOrigin(0.5);
    this.add.text(cx, 195, 'one man. many bongs. ever-higher jumps.', textStyle(18, COLORS.textDim)).setOrigin(0.5);

    // A little parade of every bong, bobbing out of sync.
    POWER_ORDER.forEach((id, i) => {
      const x = cx - 135 + i * 90;
      const bong = this.add.image(x, 300, TEXTURES.bong).setTint(POWERS[id].color).setScale(2);
      this.tweens.add({ targets: bong, y: 288, duration: 700, delay: i * 150, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    });

    // Our hero, hopping in place in whatever he's wearing.
    const hero = [this.add.image(cx, 380, TEXTURES.player), addOutfit(this, cx, 380, save.outfit())]
      .filter((part) => part !== undefined)
      .map((part) => part.setScale(1.5));
    this.tweens.add({ targets: hero, y: 350, duration: 320, yoyo: true, repeat: -1, ease: 'Quad.out', repeatDelay: 300 });
    this.add.rectangle(cx, 412, 140, 4, COLORS.tileEdge);

    const promptText = () => (isTouch() ? 'Tap to start' : 'Press Enter or Space');
    const prompt = this.add.text(cx, 460, promptText(), textStyle(22)).setOrigin(0.5);
    this.tweens.add({ targets: prompt, alpha: 0.2, duration: 600, yoyo: true, repeat: -1 });

    const mute = this.add
      .text(GAME_WIDTH - 12, GAME_HEIGHT - 10, muteLabel(), { ...textStyle(13, COLORS.textDim), padding: { x: 12, y: 10 } })
      .setOrigin(1, 1)
      .setInteractive({ useHandCursor: true });
    bindGlobalKeys(this, () => mute.setText(muteLabel()));
    mute.on('pointerup', () => {
      toggleMute();
      mute.setText(muteLabel());
    });

    let started = false;
    const start = () => {
      if (started) return;
      started = true;
      sfx('confirm');
      this.scene.start('LevelSelect');
    };
    this.input.keyboard!.once('keydown-ENTER', start);
    this.input.keyboard!.once('keydown-SPACE', start);
    // Tap (or click) anywhere except the sound toggle.
    this.input.on('pointerup', (_p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
      if (over.includes(mute)) return;
      // The first tap is a touch? Swap the hints over before leaving (pointerdown flipped touch mode).
      prompt.setText(promptText());
      mute.setText(muteLabel());
      start();
      enterFullscreen();
    });
  }
}

let triedFullscreen = false;

/**
 * On phones and tablets that allow it (Android, iPad), go fullscreen and hold landscape, once per
 * visit. iPhone Safari has no fullscreen API; there, Add to Home Screen gives a fullscreen web app.
 * Uses the page element rather than Phaser's startFullscreen, whose wrapper div breaks on a retry.
 */
function enterFullscreen() {
  if (triedFullscreen || !isTouch() || document.fullscreenElement || !document.fullscreenEnabled) return;
  triedFullscreen = true;
  const orientation = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> };
  document.documentElement
    .requestFullscreen({ navigationUI: 'hide' })
    .then(() => orientation?.lock?.('landscape'))
    .catch(() => {});
}
