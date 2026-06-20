// Procedural sound. We have no vendored audio binaries, so SFX are synthesized
// with the Web Audio API — tiny, cohesive, and dependency-free. The manager
// handles the iOS audio-unlock-on-first-gesture quirk (the same reason the
// brief recommends Howler) and respects the user's sound setting.

import { useGameStore } from '../store/useGameStore';

type Sfx =
  | 'chip' | 'chipStack' | 'cardDeal' | 'cardFlip' | 'check' | 'fold'
  | 'button' | 'reelSpin' | 'reelStop' | 'winSmall' | 'winBig' | 'jackpot'
  | 'coin' | 'anticipation' | 'lose' | 'deal';

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let unlocked = false;

function ensure(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
  }
  return ctx;
}

export function unlockAudio() {
  const c = ensure();
  if (!c) return;
  if (c.state === 'suspended') void c.resume();
  unlocked = true;
}

function soundOn() {
  return useGameStore.getState().settings.sound;
}

function tone(
  freq: number,
  dur: number,
  type: OscillatorType,
  gain: number,
  when = 0,
  slideTo?: number,
) {
  const c = ensure();
  if (!c || !master) return;
  const t = c.currentTime + when;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g);
  g.connect(master);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

function noise(dur: number, gain: number, when = 0, hp = 800) {
  const c = ensure();
  if (!c || !master) return;
  const t = c.currentTime + when;
  const buf = c.createBuffer(1, c.sampleRate * dur, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  const src = c.createBufferSource();
  src.buffer = buf;
  const filt = c.createBiquadFilter();
  filt.type = 'highpass';
  filt.frequency.value = hp;
  const g = c.createGain();
  g.gain.value = gain;
  src.connect(filt);
  filt.connect(g);
  g.connect(master);
  src.start(t);
}

const players: Record<Sfx, () => void> = {
  button: () => tone(420, 0.06, 'triangle', 0.18),
  chip: () => { noise(0.06, 0.12, 0, 2500); tone(180, 0.05, 'sine', 0.12); },
  chipStack: () => { for (let i = 0; i < 4; i++) { noise(0.05, 0.09, i * 0.05, 2500); } },
  cardDeal: () => noise(0.09, 0.1, 0, 1800),
  deal: () => noise(0.09, 0.1, 0, 1800),
  cardFlip: () => { noise(0.05, 0.08, 0, 2200); tone(600, 0.04, 'sine', 0.06); },
  check: () => tone(300, 0.08, 'sine', 0.14),
  fold: () => noise(0.12, 0.08, 0, 1200),
  reelSpin: () => tone(120, 0.18, 'sawtooth', 0.05, 0, 90),
  reelStop: () => { tone(220, 0.07, 'square', 0.1); noise(0.05, 0.08, 0, 1500); },
  anticipation: () => tone(300, 0.6, 'sine', 0.12, 0, 900),
  coin: () => tone(880, 0.07, 'triangle', 0.12, 0, 1320),
  winSmall: () => { tone(660, 0.1, 'triangle', 0.16); tone(880, 0.12, 'triangle', 0.14, 0.08); },
  winBig: () => {
    [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.18, 'triangle', 0.17, i * 0.09));
  },
  jackpot: () => {
    [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => tone(f, 0.25, 'sawtooth', 0.16, i * 0.08));
    [523, 659, 784].forEach((f, i) => tone(f * 2, 0.4, 'triangle', 0.12, 0.5 + i * 0.06));
  },
  lose: () => tone(200, 0.25, 'sine', 0.12, 0, 120),
};

export function play(sfx: Sfx) {
  if (!unlocked || !soundOn()) return;
  try {
    players[sfx]?.();
  } catch {
    /* audio is best-effort */
  }
}

/** Light haptic feedback where supported (iOS PWA, Android). No-op elsewhere. */
export function haptic(pattern: number | number[] = 12) {
  if (!useGameStore.getState().settings.haptics) return;
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* not supported */
  }
}
