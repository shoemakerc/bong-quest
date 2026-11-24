import Phaser from 'phaser';

/**
 * Apparel: cosmetic items the player wears. One random item drops per day (see `save.dailyDrop`),
 * and each is one of a kind: its style and colors are rolled when it appears.
 */
export type Slot = 'hat' | 'shirt' | 'necklace' | 'shoes';
/** Also the order they are drawn in, so a hat or necklace sits on top of a shirt. */
export const SLOTS: Slot[] = ['shoes', 'shirt', 'necklace', 'hat'];
export const SLOT_NAMES: Record<Slot, string> = { hat: 'Hat', shirt: 'Shirt', necklace: 'Necklace', shoes: 'Shoes' };

export interface ApparelItem {
  id: string;
  slot: Slot;
  style: string;
  /** Main color, accent, and a third for the busier designs. */
  colors: [number, number, number];
  name: string;
  /** The day it dropped, as YYYY-MM-DD. */
  day: string;
}

const STYLES: Record<Slot, Record<string, string>> = {
  hat: { cap: 'Cap', beanie: 'Beanie', topHat: 'Top Hat', crown: 'Crown', bucket: 'Bucket Hat' },
  shirt: { tee: 'Tee', striped: 'Striped Tee', hoodie: 'Hoodie', flannel: 'Flannel', tieDye: 'Tie-Dye' },
  necklace: { chain: 'Chain', beads: 'Beads', medallion: 'Medallion', bowTie: 'Bow Tie' },
  shoes: { kicks: 'Kicks', boots: 'Boots', slides: 'Slides', highTops: 'High-Tops' },
};

const ADJECTIVES = [
  'Fresh', 'Loud', 'Crispy', 'Vintage', 'Limited', 'Sticky', 'Dank', 'Mellow',
  'Fuzzy', 'Electric', 'Lucky', 'Cosmic', 'Lowkey', 'Deluxe',
];
/** One name per 30° of hue, starting at red. */
const HUES = ['Red', 'Orange', 'Gold', 'Lime', 'Green', 'Mint', 'Teal', 'Sky', 'Blue', 'Violet', 'Magenta', 'Pink'];

const pick = <T>(list: T[]): T => list[Math.floor(Math.random() * list.length)];
const between = (lo: number, hi: number) => lo + Math.random() * (hi - lo);
const hueName = (hue: number) => HUES[Math.round((((hue % 360) + 360) % 360) / 30) % 12];
const hsl = (hue: number, s: number, l: number) =>
  Phaser.Display.Color.HSLToColor((((hue % 360) + 360) % 360) / 360, s, l).color;

/** The player is orange (hue ≈ 33°), so anything near that would vanish on him: nudge it round to red or lime. */
function visibleHue(hue: number) {
  const h = ((hue % 360) + 360) % 360;
  if (h < 12 || h > 56) return h;
  return h < 34 ? h - 24 : h + 24;
}

/** Rolls a brand-new item: random slot, style, and a random color scheme. */
export function rollApparel(day: string): ApparelItem {
  const slot = pick<Slot>(['hat', 'shirt', 'necklace', 'shoes']);
  const style = pick(Object.keys(STYLES[slot]));

  // A random main hue, an accent some way around the color wheel, and a third further round still.
  const hue = visibleHue(Math.random() * 360);
  const offset = pick([180, 150, 210, 120, 240, 90, 30]);
  const accentHue = visibleHue(hue + offset);
  let accentName = hueName(accentHue);
  let accent = hsl(accentHue, between(0.6, 0.95), between(0.5, 0.68));
  // Now and then the accent is plain gold or white instead.
  const special = Math.random();
  if (special < 0.12) [accentName, accent] = ['Gold', 0xf6e05e];
  else if (special < 0.2) [accentName, accent] = ['White', 0xf7fafc];
  const colors: ApparelItem['colors'] = [
    hsl(hue, between(0.6, 0.95), between(0.5, 0.68)),
    accent,
    hsl(visibleHue(hue + offset * 2), between(0.6, 0.95), between(0.55, 0.7)),
  ];

  const mainName = hueName(hue);
  const colorName = mainName === accentName ? mainName : `${mainName} & ${accentName}`;
  return {
    id: `${day}-${Math.random().toString(36).slice(2, 8)}`,
    slot,
    style,
    colors,
    name: `${pick(ADJECTIVES)} ${colorName} ${STYLES[slot][style]}`,
    day,
  };
}

// ---------------------------------------------------------------- drawing

/**
 * Draws one item in placeholder rectangles. Coordinates are relative to the player's 24×40 body,
 * whose top-left corner is at (ox, oy); hats and shoe toes poke a few pixels outside it.
 * The player faces right, with his eye at (15, 10).
 */
export function drawApparel(g: Phaser.GameObjects.Graphics, item: ApparelItem, ox: number, oy: number) {
  const [main, accent, third] = item.colors;
  const r = (x: number, y: number, w: number, h: number, color: number) =>
    g.fillStyle(color).fillRect(ox + x, oy + y, w, h);
  const tri = (x1: number, y1: number, x2: number, y2: number, x3: number, y3: number, color: number) =>
    g.fillStyle(color).fillTriangle(ox + x1, oy + y1, ox + x2, oy + y2, ox + x3, oy + y3);

  switch (`${item.slot}:${item.style}`) {
    case 'hat:cap':
      r(1, -5, 22, 7, main);
      r(15, 0, 12, 3, accent); // brim, out past his face
      r(10, -7, 4, 2, accent);
      break;
    case 'hat:beanie':
      r(0, -6, 24, 8, main);
      r(0, -1, 24, 4, accent);
      r(9, -8, 6, 3, accent);
      break;
    case 'hat:topHat':
      r(4, -8, 16, 8, main);
      r(4, -3, 16, 2, accent);
      r(-2, 0, 28, 3, main);
      break;
    case 'hat:crown':
      for (const x of [2, 9, 16]) tri(x, -3, x + 3, -8, x + 6, -3, main);
      r(2, -3, 20, 5, main);
      r(4, -1, 3, 2, accent);
      r(11, -1, 3, 2, third);
      r(18, -1, 3, 2, accent);
      break;
    case 'hat:bucket':
      r(3, -6, 18, 6, main);
      r(3, -2, 18, 2, accent);
      r(-2, 0, 28, 3, main);
      break;

    case 'shirt:tee':
      r(0, 17, 24, 13, main);
      r(8, 17, 8, 2, accent);
      break;
    case 'shirt:striped':
      for (let y = 17, i = 0; y < 30; y += 3, i++) r(0, y, 24, Math.min(3, 30 - y), i % 2 ? accent : main);
      break;
    case 'shirt:hoodie':
      r(0, 16, 24, 15, main);
      r(0, 16, 24, 2, accent);
      r(6, 25, 12, 4, accent);
      r(9, 18, 1, 5, 0xf7fafc);
      r(14, 18, 1, 5, 0xf7fafc);
      break;
    case 'shirt:flannel':
      r(0, 17, 24, 13, main);
      for (let x = 2; x < 24; x += 6) r(x, 17, 2, 13, accent);
      r(0, 20, 24, 2, third);
      r(0, 26, 24, 2, third);
      break;
    case 'shirt:tieDye':
      for (let y = 0; y < 3; y++) {
        for (let x = 0; x < 6; x++) r(x * 4, 17 + y * 4, 4, y === 2 ? 5 : 4, item.colors[(x + y * 2) % 3]);
      }
      break;

    case 'necklace:chain':
      r(1, 16, 22, 2, main);
      r(10, 18, 4, 5, accent);
      break;
    case 'necklace:beads':
      for (let x = 1, i = 0; x < 23; x += 3, i++) r(x, 16, 2, 2, i % 2 ? accent : main);
      r(10, 17, 4, 4, third);
      break;
    case 'necklace:medallion':
      r(2, 15, 3, 2, main);
      r(5, 17, 3, 2, main);
      r(16, 17, 3, 2, main);
      r(19, 15, 3, 2, main);
      r(8, 18, 8, 7, accent);
      r(10, 20, 4, 3, third);
      break;
    case 'necklace:bowTie':
      tri(5, 15, 5, 22, 12, 18.5, main);
      tri(19, 15, 19, 22, 12, 18.5, main);
      r(10, 16, 4, 5, accent);
      break;

    case 'shoes:kicks':
      r(0, 35, 10, 5, main);
      r(13, 35, 13, 5, main);
      r(0, 38, 10, 2, accent);
      r(13, 38, 13, 2, accent);
      break;
    case 'shoes:boots':
      r(0, 30, 10, 10, main);
      r(13, 30, 12, 10, main);
      r(0, 30, 10, 2, accent);
      r(13, 30, 11, 2, accent);
      break;
    case 'shoes:slides':
      r(0, 37, 11, 3, main);
      r(13, 37, 13, 3, main);
      r(2, 34, 6, 3, accent);
      r(16, 34, 6, 3, accent);
      break;
    case 'shoes:highTops':
      r(0, 32, 10, 8, main);
      r(13, 32, 13, 8, main);
      r(0, 34, 10, 2, accent);
      r(13, 34, 11, 2, accent);
      r(0, 38, 10, 2, 0xf7fafc);
      r(13, 38, 13, 2, 0xf7fafc);
      break;
  }
}

/** The outfit layer is bigger than the player so hats and shoe toes fit; this is where his body sits in it. */
const OUTFIT = { w: 32, h: 48, bodyX: 4, bodyY: 8 };
/** Origin that puts the outfit layer's body area exactly over a 24×40 player image with the same x/y. */
export const OUTFIT_ORIGIN = { x: 0.5, y: (OUTFIT.bodyY + 20) / OUTFIT.h };

function texture(scene: Phaser.Scene, key: string, w: number, h: number, draw: (g: Phaser.GameObjects.Graphics) => void) {
  if (!scene.textures.exists(key)) {
    const g = scene.make.graphics({ x: 0, y: 0 }, false);
    draw(g);
    g.generateTexture(key, w, h).destroy();
  }
  return key;
}

/** Texture with everything being worn, to lay over the player. Undefined if he's wearing nothing. */
export function outfitTexture(scene: Phaser.Scene, wearing: ApparelItem[]) {
  if (wearing.length === 0) return undefined;
  const key = `outfit:${wearing.map((i) => i.id).join('+')}`;
  return texture(scene, key, OUTFIT.w, OUTFIT.h, (g) =>
    wearing.forEach((item) => drawApparel(g, item, OUTFIT.bodyX, OUTFIT.bodyY)),
  );
}

/** A 32×32 texture of one item on its own, for the pickup in a level. */
export function itemTexture(scene: Phaser.Scene, item: ApparelItem) {
  // Each slot sits at a different height on the body; shift it to the middle of the icon.
  const oy = { hat: 16, shirt: -8, necklace: -4, shoes: -20 }[item.slot];
  return texture(scene, `apparel:${item.id}`, 32, 32, (g) => drawApparel(g, item, 4, oy));
}

/** Adds the outfit layer over a player image at (x, y). Returns undefined if nothing is worn. */
export function addOutfit(scene: Phaser.Scene, x: number, y: number, wearing: ApparelItem[]) {
  const key = outfitTexture(scene, wearing);
  return key ? scene.add.image(x, y, key).setOrigin(OUTFIT_ORIGIN.x, OUTFIT_ORIGIN.y) : undefined;
}
