/** Local progress: which levels are beaten (with best time) plus settings. Survives reloads. */
interface SaveData {
  best: Record<string, { timeMs: number; deaths: number }>;
  muted: boolean;
}

const KEY = 'bong-quest:save:v1';
const unlockAll = new URLSearchParams(location.search).has('unlockAll');

function load(): SaveData {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { best: {}, muted: false, ...JSON.parse(raw) };
  } catch {
    // Storage blocked or corrupt; fall back to a fresh save.
  }
  return { best: {}, muted: false };
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
