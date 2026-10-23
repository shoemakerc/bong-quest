import Phaser from 'phaser';
import { save } from './save';

/**
 * Tiny synthesizer for placeholder sound effects: no audio files needed.
 * Uses Phaser's WebAudio context, which Phaser unlocks on the first key press.
 */
export type SfxName =
  | 'jump' | 'airJump' | 'wallJump' | 'dash' | 'pickup' | 'death'
  | 'checkpoint' | 'win' | 'select' | 'confirm' | 'locked';

let ctx: AudioContext | undefined;
let master: GainNode | undefined;

export function initSfx(game: Phaser.Game) {
  const manager = game.sound as Phaser.Sound.WebAudioSoundManager;
  if (!('context' in manager)) return; // audio unavailable
  ctx = manager.context;
  master = ctx.createGain();
  master.gain.value = 0.5;
  master.connect(ctx.destination);
}

interface Tone {
  freq: number;
  to?: number;
  type?: OscillatorType;
  dur: number;
  vol?: number;
  delay?: number;
}

function tone({ freq, to, type = 'square', dur, vol = 0.15, delay = 0 }: Tone) {
  if (!ctx || !master) return;
  const t = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (to) osc.frequency.exponentialRampToValueAtTime(to, t + dur);
  gain.gain.setValueAtTime(vol, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
  osc.connect(gain).connect(master);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

function noise(dur: number, from: number, to: number, vol = 0.2) {
  if (!ctx || !master) return;
  const t = ctx.currentTime;
  const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate);
  const samples = buffer.getChannelData(0);
  for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.Q.value = 2;
  filter.frequency.setValueAtTime(from, t);
  filter.frequency.exponentialRampToValueAtTime(to, t + dur);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(vol, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(filter).connect(gain).connect(master);
  src.start(t);
}

const SOUNDS: Record<SfxName, () => void> = {
  jump: () => tone({ freq: 280, to: 560, dur: 0.1, vol: 0.1 }),
  airJump: () => tone({ freq: 420, to: 900, dur: 0.12, vol: 0.1, type: 'triangle' }),
  wallJump: () => {
    tone({ freq: 330, to: 700, dur: 0.1, vol: 0.1, type: 'triangle' });
    noise(0.06, 3000, 1500, 0.1);
  },
  dash: () => noise(0.2, 2500, 300, 0.3),
  // A bubbly bong rip, then a happy arpeggio.
  pickup: () => {
    for (let i = 0; i < 7; i++) {
      tone({ freq: 250 + Math.random() * 500, dur: 0.05, vol: 0.12, type: 'sine', delay: i * 0.045 });
    }
    [523, 659, 784, 1046].forEach((f, i) => tone({ freq: f, dur: 0.12, vol: 0.08, delay: 0.35 + i * 0.07 }));
  },
  death: () => tone({ freq: 400, to: 70, dur: 0.35, vol: 0.12, type: 'sawtooth' }),
  checkpoint: () => {
    tone({ freq: 660, dur: 0.1, vol: 0.1, type: 'triangle' });
    tone({ freq: 990, dur: 0.15, vol: 0.1, type: 'triangle', delay: 0.08 });
  },
  win: () => [523, 659, 784, 1046, 784, 1046].forEach((f, i) =>
    tone({ freq: f, dur: i === 5 ? 0.4 : 0.12, vol: 0.09, delay: i * 0.1 })),
  select: () => tone({ freq: 880, dur: 0.04, vol: 0.06 }),
  confirm: () => tone({ freq: 660, to: 1320, dur: 0.1, vol: 0.08 }),
  locked: () => tone({ freq: 150, dur: 0.12, vol: 0.1, type: 'sawtooth' }),
};

export function sfx(name: SfxName) {
  if (save.muted || !ctx || ctx.state !== 'running') return;
  SOUNDS[name]();
}
