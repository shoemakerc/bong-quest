import Phaser from 'phaser';
import { COLORS, GAME_HEIGHT, GAME_WIDTH, TEXTURES } from '../constants';
import { LEVELS, LEVEL_IDS } from '../levels';
import { LEVEL_LEGEND } from '../levels/types';
import { POWERS } from '../powers';
import { isTouch } from '../systems/input';
import { formatTime, save } from '../systems/save';
import { sfx } from '../systems/sfx';
import { bindGlobalKeys, muteLabel, tapButton, textStyle, toggleMute } from '../systems/ui';

interface LevelSelectData {
  focus?: number;
}

const ROW_H = 68;
const TOP = 96;
/** Rows scroll between the fixed header and footer bands. */
const HEADER_H = 86;
const FOOTER_H = 48;
/** A touch that moves less than this is a tap; more is a drag-scroll. */
const TAP_SLOP = 12;

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
    this.add.rectangle(0, 0, GAME_WIDTH, HEADER_H, COLORS.background).setOrigin(0).setScrollFactor(0).setDepth(5);
    this.add.rectangle(0, GAME_HEIGHT - FOOTER_H, GAME_WIDTH, FOOTER_H, COLORS.background).setOrigin(0).setScrollFactor(0).setDepth(5);
    this.add.text(cx, 40, 'Choose a level', textStyle(32)).setOrigin(0.5).setScrollFactor(0).setDepth(6);
    this.add.text(cx, 72, this.dailyLine(), textStyle(12, '#9ae6b4')).setOrigin(0.5).setScrollFactor(0).setDepth(6);

    LEVELS.forEach((level, i) => {
      const y = TOP + i * ROW_H;
      const unlocked = save.isUnlocked(LEVEL_IDS, i);
      const best = save.best(level.id);
      const bg = this.add.rectangle(cx, y + 24, 760, ROW_H - 8, 0x2d3748).setStrokeStyle(2, 0x2d3748);
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

    const helpText = () =>
      isTouch() ? 'Tap a level to play   Drag to scroll' : `↑↓ choose   Enter play   C closet   Esc title   ${muteLabel()}`;
    const help = this.add
      .text(cx, GAME_HEIGHT - 24, helpText(), textStyle(14, COLORS.textDim))
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(6);
    bindGlobalKeys(this, () => help.setText(helpText()));

    // Tap targets for what Esc and M do on a keyboard. They also work with a mouse.
    tapButton(this, 66, 46, 100, 40, '‹ Title', () => this.scene.start('Title'), { depth: 7, size: 16 });
    tapButton(this, 174, 46, 96, 40, 'Closet', () => this.openCloset(), { depth: 7, size: 16 });
    const sound = tapButton(this, GAME_WIDTH - 86, 46, 140, 40, muteLabel(), () => {
      toggleMute();
      sound.setText(muteLabel());
      help.setText(helpText());
    }, { depth: 7, size: 14 });
    this.input.on('pointerdown', () => {
      // First touch on a device that didn't look like one: swap the hints over.
      help.setText(helpText());
      sound.setText(muteLabel());
    });
    this.bindPointer();

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
    kb.on('keydown-C', () => this.openCloset());

    this.highlight(true);
  }

  /** Drag to scroll the list; a tap on a row selects and plays it. Mouse wheel scrolls too. */
  private bindPointer() {
    const cam = this.cameras.main;
    let downY = 0;
    let downScroll = 0;
    let dragging = false;
    let tracking = false;
    const maxScroll = () => Math.max(0, TOP + LEVELS.length * ROW_H - 6 - (GAME_HEIGHT - FOOTER_H));

    this.input.on('pointerdown', (p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
      // Header/footer buttons handle themselves; the bands above and below the list aren't rows.
      tracking = over.length === 0 && p.y > HEADER_H && p.y < GAME_HEIGHT - FOOTER_H;
      if (!tracking) return;
      downY = p.y;
      downScroll = cam.scrollY;
      dragging = false;
      this.tweens.killTweensOf(cam);
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!tracking || !p.isDown) return;
      if (Math.abs(p.y - downY) > TAP_SLOP) dragging = true;
      if (dragging) cam.setScroll(0, Phaser.Math.Clamp(downScroll - (p.y - downY), 0, maxScroll()));
    });
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => {
      if (!tracking) return;
      tracking = false;
      if (dragging) return;
      const worldY = p.y + cam.scrollY;
      const i = Math.floor((worldY - (TOP - 6)) / ROW_H);
      const row = this.rows[i]?.bg;
      if (!row || Math.abs(p.x - row.x) > row.width / 2 || Math.abs(worldY - row.y) > row.height / 2) return;
      this.selected = i;
      this.highlight();
      this.play();
    });
    this.input.on('wheel', (_p: Phaser.Input.Pointer, _over: unknown, _dx: number, dy: number) => {
      this.tweens.killTweensOf(cam);
      cam.setScroll(0, Phaser.Math.Clamp(cam.scrollY + dy, 0, maxScroll()));
    });
  }

  private openCloset() {
    sfx('confirm');
    this.scene.start('Closet', { focus: this.selected });
  }

  /** Where today's apparel drop stands, for the header. */
  private dailyLine() {
    const daily = save.dailyStatus();
    if (daily.state === 'collected') return "Today's apparel drop: picked up. Another one drops tomorrow.";
    if (daily.state === 'waiting') {
      const n = LEVEL_IDS.indexOf(daily.levelId);
      return `Today's apparel drop is waiting in level ${n + 1}, ${LEVELS[n]?.name ?? '?'}.`;
    }
    return "Today's apparel drop will be in the first level you play.";
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

  private highlight(instant = false) {
    this.rows.forEach(({ bg }, i) => {
      const on = i === this.selected;
      bg.setFillStyle(on ? 0x3c4a5e : 0x232a36).setStrokeStyle(2, on ? COLORS.player : 0x2d3748);
    });

    // Scroll so the selected row sits inside the visible band.
    const cam = this.cameras.main;
    const rowTop = TOP + this.selected * ROW_H - 6;
    const rowBottom = rowTop + ROW_H;
    const visibleTop = cam.scrollY + HEADER_H;
    const visibleBottom = cam.scrollY + GAME_HEIGHT - FOOTER_H;
    let target = cam.scrollY;
    if (rowTop < visibleTop) target = rowTop - HEADER_H;
    else if (rowBottom > visibleBottom) target = rowBottom - (GAME_HEIGHT - FOOTER_H);
    target = Math.max(0, target);
    this.tweens.killTweensOf(cam);
    if (instant) cam.setScroll(0, target);
    else this.tweens.add({ targets: cam, scrollY: target, duration: 150, ease: 'Quad.out' });
  }
}
