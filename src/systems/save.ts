import { SLOTS, rollApparel, type ApparelItem, type Slot } from '../apparel';

/** Local progress: which levels are beaten (with best time), apparel, plus settings. Survives reloads. */
interface SaveData {
  best: Record<string, { timeMs: number; deaths: number }>;
  muted: boolean;
  /** Every apparel item picked up so far. */
  closet: ApparelItem[];
  /** The id of the item worn in each slot. */
  wearing: Partial<Record<Slot, string>>;
  /** The current daily drop: rolled when the first level of a day starts, and tied to that level. */
  daily?: { day: string; levelId: string; item: ApparelItem; collected: boolean };
}

export type DailyStatus =
  | { state: 'unrolled' }
  | { state: 'waiting'; levelId: string; item: ApparelItem }
  | { state: 'collected'; item: ApparelItem };

const KEY = 'bong-quest:save:v1';
const unlockAll = new URLSearchParams(location.search).has('unlockAll');

function load(): SaveData {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...fresh(), ...JSON.parse(raw) };
  } catch {
    // Storage blocked or corrupt; fall back to a fresh save.
  }
  return fresh();
}

function fresh(): SaveData {
  return { best: {}, muted: false, closet: [], wearing: {} };
}

let dayOverride: string | undefined;
/** Dev only: pretend it's another day (YYYY-MM-DD), to test the daily drop. */
export function setDayForTesting(day: string | undefined) {
  dayOverride = day;
}

/** Today's date on the player's own clock, as YYYY-MM-DD: the daily drop renews at local midnight. */
export function today() {
  if (dayOverride) return dayOverride;
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const data = load();

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    // Not fatal: progress just won't survive a reload.
  }
}

export const save = {
  best(levelId: string) {
    return data.best[levelId];
  },

  isBeaten(levelId: string) {
    return levelId in data.best;
  },

  /** A level is unlocked if it's the first one or the previous one is beaten. */
  isUnlocked(levelIds: string[], index: number) {
    return unlockAll || index === 0 || this.isBeaten(levelIds[index - 1]);
  },

  /** Records a finish; returns true if it's a new best time. */
  recordFinish(levelId: string, timeMs: number, deaths: number) {
    const prev = data.best[levelId];
    const isBest = !prev || timeMs < prev.timeMs;
    if (isBest) data.best[levelId] = { timeMs, deaths };
    persist();
    return isBest;
  },

  /**
   * Today's apparel drop, if it is waiting in this level. The first level started each day gets a
   * freshly rolled item; it stays in that level until picked up, and then nothing drops until tomorrow.
   */
  dailyDrop(levelId: string): ApparelItem | undefined {
    const day = today();
    if (data.daily?.day !== day) {
      data.daily = { day, levelId, item: rollApparel(day), collected: false };
      persist();
    }
    const { daily } = data;
    return daily.levelId === levelId && !daily.collected ? daily.item : undefined;
  },

  dailyStatus(): DailyStatus {
    const { daily } = data;
    if (!daily || daily.day !== today()) return { state: 'unrolled' };
    if (daily.collected) return { state: 'collected', item: daily.item };
    return { state: 'waiting', levelId: daily.levelId, item: daily.item };
  },

  /** Picks up today's drop: it goes in the closet and straight onto the player. */
  collectDaily() {
    const { daily } = data;
    if (!daily || daily.collected) return;
    daily.collected = true;
    data.closet.push(daily.item);
    data.wearing[daily.item.slot] = daily.item.id;
    persist();
  },

  closet(slot: Slot) {
    return data.closet.filter((item) => item.slot === slot);
  },

  worn(slot: Slot) {
    return data.closet.find((item) => item.slot === slot && item.id === data.wearing[slot]);
  },

  /** Everything being worn, in the order it should be drawn. */
  outfit(): ApparelItem[] {
    return SLOTS.map((slot) => this.worn(slot)).filter((item) => item !== undefined);
  },

  /** Wear an item from the closet, or pass undefined to take that slot off. */
  wear(slot: Slot, itemId: string | undefined) {
    if (itemId) data.wearing[slot] = itemId;
    else delete data.wearing[slot];
    persist();
  },

  get muted() {
    return data.muted;
  },

  set muted(value: boolean) {
    data.muted = value;
    persist();
  },
};

export function formatTime(ms: number) {
  const s = ms / 1000;
  const m = Math.floor(s / 60);
  return `${m}:${(s % 60).toFixed(2).padStart(5, '0')}`;
}
