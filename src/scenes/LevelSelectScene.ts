import Phaser from 'phaser';
import { COLORS, GAME_HEIGHT, GAME_WIDTH, TEXTURES } from '../constants';
import { LEVELS, LEVEL_IDS } from '../levels';
import { LEVEL_LEGEND } from '../levels/types';
import { POWERS } from '../powers';
import { formatTime, save } from '../systems/save';
import { sfx } from '../systems/sfx';
import { bindGlobalKeys, muteLabel, textStyle } from '../systems/ui';

interface LevelSelectData {
  focus?: number;
}

const ROW_H = 72;
const TOP = 110;

export class LevelSelectScene extends Phaser.Scene {
  private selected = 0;
  private rows: { bg: Phaser.GameObjects.Rectangle; unlocked: boolean }[] = [];

  constructor() {
    super('LevelSelect');
  }

  init(data: LevelSelectData) {
    // Default to the first unbeaten level that's unlocked.
    const firstOpen = LEVELS.findIndex((l, i) => save.isUnlocked(LEVEL_IDS, i) && !save.isBeaten(l.id));
    this.selected = data.focus ?? (firstOpen === -1 ? 0 : firstOpen);
    this.rows = [];
  }

  create() {
    const cx = GAME_WIDTH / 2;
    this.add.text(cx, 50, 'Choose a level', textStyle(32)).setOrigin(0.5);

    LEVELS.forEach((level, i) => {
      const y = TOP + i * ROW_H;
      const unlocked = save.isUnlocked(LEVEL_IDS, i);
      const best = save.best(level.id);
      const bg = this.add.rectangle(cx, y + 24, 760, ROW_H - 10, 0x2d3748).setStrokeStyle(2, 0x2d3748);
      this.rows.push({ bg, unlocked });

      // The bong this level hands out, as an icon.
      const bongChar = level.map.join('').split('').find((ch) => LEVEL_LEGEND[ch]?.kind === 'bong');
      const power = bongChar ? LEVEL_LEGEND[bongChar].power : undefined;
      if (power) {
        this.add.image(cx - 345, y + 24, TEXTURES.bong).setTint(unlocked ? POWERS[power].color : 0x4a5568);
      }

      const titleColor = unlocked ? COLORS.text : '#4a5568';
      this.add.text(cx - 320, y + 6, `${i + 1}. ${unlocked ? level.name : '???'}`, textStyle(20, titleColor));
      this.add.text(cx - 320, y + 32, unlocked ? level.tagline : 'Beat the previous level to unlock.', textStyle(13, COLORS.textDim));

      const deaths = best && `${best.deaths} ${best.deaths === 1 ? 'death' : 'deaths'}`;
      const status = !unlocked ? 'LOCKED' : best ? `✓ ${formatTime(best.timeMs)}  (${deaths})` : 'new';
      const statusColor = !unlocked ? '#4a5568' : best ? '#9ae6b4' : COLORS.textDim;
      this.add.text(cx + 365, y + 24, status, textStyle(14, statusColor)).setOrigin(1, 0.5);
    });

    this.add
      .text(cx, GAME_HEIGHT - 24, `↑↓ choose   Enter play   Esc title   ${muteLabel()}`, textStyle(14, COLORS.textDim))
      .setOrigin(0.5)
      .setName('help');
    bindGlobalKeys(this, () =>
      (this.children.getByName('help') as Phaser.GameObjects.Text).setText(
        `↑↓ choose   Enter play   Esc title   ${muteLabel()}`,
      ),
    );

    const kb = this.input.keyboard!;
    const move = (delta: number) => {
      this.selected = Phaser.Math.Wrap(this.selected + delta, 0, LEVELS.length);
      sfx('select');
      this.highlight();
    };
    kb.on('keydown-UP', () => move(-1));
    kb.on('keydown-W', () => move(-1));
    kb.on('keydown-DOWN', () => move(1));
    kb.on('keydown-S', () => move(1));
    kb.on('keydown-ENTER', () => this.play());
    kb.on('keydown-SPACE', () => this.play());
    kb.on('keydown-ESC', () => this.scene.start('Title'));

    this.highlight();
  }

  private play() {
    if (!this.rows[this.selected].unlocked) {
      sfx('locked');
      this.cameras.main.shake(100, 0.004);
      return;
    }
    sfx('confirm');
    this.scene.start('Game', { levelIndex: this.selected });
  }

  private highlight() {
    this.rows.forEach(({ bg }, i) => {
      const on = i === this.selected;
      bg.setFillStyle(on ? 0x3c4a5e : 0x232a36).setStrokeStyle(2, on ? COLORS.player : 0x2d3748);
    });
  }
}
