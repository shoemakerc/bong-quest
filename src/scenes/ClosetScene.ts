import Phaser from 'phaser';
import { SLOT_NAMES, addOutfit, itemTexture, type ApparelItem, type Slot } from '../apparel';
import { COLORS, GAME_HEIGHT, GAME_WIDTH, TEXTURES } from '../constants';
import { LEVELS } from '../levels';
import { isTouch } from '../systems/input';
import { save } from '../systems/save';
import { sfx } from '../systems/sfx';
import { bindGlobalKeys, tapButton, textStyle, type TapButton } from '../systems/ui';

interface ClosetData {
  /** Level-select row to return to. */
  focus?: number;
}

/** Top to bottom on the screen, which is also head to toe. */
const ROWS: Slot[] = ['hat', 'shirt', 'necklace', 'shoes'];
const ROW_TOP = 138;
const ROW_H = 80;
const PANEL = { x: 630, w: 580 };
const HERO = { x: 190, y: 290, scale: 5 };

interface Row {
  slot: Slot;
  bg: Phaser.GameObjects.Rectangle;
  name: Phaser.GameObjects.Text;
  count: Phaser.GameObjects.Text;
  icon?: Phaser.GameObjects.Image;
  arrows: TapButton[];
}

/** Try on the apparel picked up from daily drops: one item (or nothing) per slot. */
export class ClosetScene extends Phaser.Scene {
  private focus?: number;
  private selected = 0;
  private rows: Row[] = [];
  private outfit?: Phaser.GameObjects.Image;

  constructor() {
    super('Closet');
  }

  init(data: ClosetData) {
    this.focus = data.focus;
    this.selected = 0;
    this.rows = [];
    this.outfit = undefined;
  }

  create() {
    const cx = GAME_WIDTH / 2;
    this.add.text(cx, 46, 'Closet', textStyle(32)).setOrigin(0.5);
    tapButton(this, 76, 46, 120, 40, '‹ Levels', () => this.back(), { size: 16 });

    // Our hero, big enough to see what he's wearing.
    this.add.image(HERO.x, HERO.y, TEXTURES.player).setScale(HERO.scale);
    this.add.rectangle(HERO.x, HERO.y + 20 * HERO.scale + 4, 200, 6, COLORS.tileEdge);

    ROWS.forEach((slot, i) => {
      const y = ROW_TOP + i * ROW_H;
      const left = PANEL.x - PANEL.w / 2;
      const bg = this.add.rectangle(PANEL.x, y, PANEL.w, ROW_H - 10, 0x232a36).setStrokeStyle(2, 0x2d3748);
      this.add.text(left + 74, y - 24, SLOT_NAMES[slot].toUpperCase(), textStyle(12, COLORS.textDim));
      const name = this.add.text(left + 74, y - 6, '', textStyle(17));
      const count = this.add.text(left + PANEL.w - 74, y - 24, '', textStyle(12, COLORS.textDim)).setOrigin(1, 0);
      const arrows = [
        tapButton(this, left + 36, y, 48, 48, '‹', () => this.cycle(i, -1), { size: 24 }),
        tapButton(this, left + PANEL.w - 36, y, 48, 48, '›', () => this.cycle(i, 1), { size: 24 }),
      ];
      this.rows.push({ slot, bg, name, count, arrows });
    });

    this.add.text(cx, GAME_HEIGHT - 62, this.dailyLine(), textStyle(14, '#9ae6b4')).setOrigin(0.5);
    const helpText = () =>
      isTouch() ? 'Tap the arrows to change what he wears' : '↑↓ choose   ←→ change   Esc back';
    const help = this.add.text(cx, GAME_HEIGHT - 24, helpText(), textStyle(14, COLORS.textDim)).setOrigin(0.5);
    this.input.on('pointerdown', () => help.setText(helpText()));

    const kb = this.input.keyboard!;
    const move = (delta: number) => {
      this.selected = Phaser.Math.Wrap(this.selected + delta, 0, ROWS.length);
      sfx('select');
      this.refresh();
    };
    kb.on('keydown-UP', () => move(-1));
    kb.on('keydown-W', () => move(-1));
    kb.on('keydown-DOWN', () => move(1));
    kb.on('keydown-S', () => move(1));
    kb.on('keydown-LEFT', () => this.cycle(this.selected, -1));
    kb.on('keydown-A', () => this.cycle(this.selected, -1));
    kb.on('keydown-RIGHT', () => this.cycle(this.selected, 1));
    kb.on('keydown-D', () => this.cycle(this.selected, 1));
    kb.on('keydown-ESC', () => this.back());
    kb.on('keydown-ENTER', () => this.back());
    bindGlobalKeys(this);

    this.refresh();
  }

  /** Step a slot through "nothing" and then each item owned for it. */
  private cycle(rowIndex: number, delta: number) {
    const { slot } = this.rows[rowIndex];
    const choices: (ApparelItem | undefined)[] = [undefined, ...save.closet(slot)];
    this.selected = rowIndex;
    if (choices.length > 1) {
      const next = Phaser.Math.Wrap(choices.indexOf(save.worn(slot)) + delta, 0, choices.length);
      save.wear(slot, choices[next]?.id);
      sfx('select');
    } else {
      sfx('locked');
    }
    this.refresh();
  }

  private refresh() {
    this.rows.forEach((row, i) => {
      const owned = save.closet(row.slot);
      const worn = save.worn(row.slot);
      const on = i === this.selected;
      row.bg.setFillStyle(on ? 0x3c4a5e : 0x232a36).setStrokeStyle(2, on ? COLORS.player : 0x2d3748);
      row.name
        .setText(worn ? worn.name : owned.length ? 'Nothing' : 'Nothing yet')
        .setColor(worn ? COLORS.text : COLORS.textDim);
      row.count.setText(owned.length === 0 ? '' : worn ? `${owned.indexOf(worn) + 1} of ${owned.length}` : `${owned.length} owned`);
      row.arrows.forEach((a) => a.setVisible(owned.length > 0));
      row.icon?.destroy();
      row.icon = worn
        ? this.add.image(row.bg.x + PANEL.w / 2 - 96, row.bg.y + 8, itemTexture(this, worn)).setScale(1.5)
        : undefined;
    });

    this.outfit?.destroy();
    this.outfit = addOutfit(this, HERO.x, HERO.y, save.outfit())?.setScale(HERO.scale);
  }

  private dailyLine() {
    const daily = save.dailyStatus();
    if (daily.state === 'collected') return `Today's drop: ${daily.item.name}. The next one drops tomorrow.`;
    if (daily.state === 'waiting') {
      const n = LEVELS.findIndex((l) => l.id === daily.levelId);
      return `Today's drop is waiting in level ${n + 1}, ${LEVELS[n]?.name ?? '?'}.`;
    }
    return "Today's drop will be in the first level you play.";
  }

  private back() {
    sfx('confirm');
    this.scene.start('LevelSelect', { focus: this.focus });
  }
}
