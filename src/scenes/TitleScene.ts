import Phaser from 'phaser';
import { COLORS, GAME_HEIGHT, GAME_WIDTH, TEXTURES } from '../constants';
import { POWERS, POWER_ORDER } from '../powers';
import { sfx } from '../systems/sfx';
import { bindGlobalKeys, muteLabel, textStyle } from '../systems/ui';

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

    // Our hero, hopping in place.
    const hero = this.add.image(cx, 380, TEXTURES.player).setScale(1.5);
    this.tweens.add({ targets: hero, y: 350, duration: 320, yoyo: true, repeat: -1, ease: 'Quad.out', repeatDelay: 300 });
    this.add.rectangle(cx, 412, 140, 4, COLORS.tileEdge);

    const prompt = this.add.text(cx, 460, 'Press Enter or Space', textStyle(22)).setOrigin(0.5);
    this.tweens.add({ targets: prompt, alpha: 0.2, duration: 600, yoyo: true, repeat: -1 });

    const mute = this.add.text(GAME_WIDTH - 12, GAME_HEIGHT - 10, muteLabel(), textStyle(13, COLORS.textDim)).setOrigin(1, 1);
    bindGlobalKeys(this, () => mute.setText(muteLabel()));

    const start = () => {
      sfx('confirm');
      this.scene.start('LevelSelect');
    };
    this.input.keyboard!.once('keydown-ENTER', start);
    this.input.keyboard!.once('keydown-SPACE', start);
  }
}
