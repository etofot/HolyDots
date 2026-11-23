/**
 * Procedural SFX via Web Audio API — no asset pipeline required.
 * All failures are silent (muted / autoplay policy); never throws into game loop.
 */

type SfxId =
  | 'spawn'
  | 'recolor'
  | 'heat'
  | 'commit'
  | 'lock'
  | 'detonate'
  | 'cascade'
  | 'danger'
  | 'gameover'
  | 'ui'
  | 'armed'
  | 'hot';

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let unlocked = false;
let muted = false;

const MUTE_LS = 'heat-rush-mute-v1';

try {
  muted = localStorage.getItem(MUTE_LS) === '1';
} catch {
  muted = false;
}

export function isMuted(): boolean {
  return muted;
}

export function setMuted(next: boolean): void {
  muted = next;
  try {
    localStorage.setItem(MUTE_LS, next ? '1' : '0');
  } catch {
    // private mode
  }
  if (master) {
    master.gain.value = muted ? 0 : 0.32;
  }
}

export function toggleMute(): boolean {
  setMuted(!muted);
  return muted;
}

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  try {
    if (!ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.32;
      master.connect(ctx.destination);
    }
    return ctx;
  } catch {
    return null;
  }
}

/** Call from first user gesture so browsers allow audio. */
export function unlockAudio(): void {
  const c = getCtx();
  if (!c) return;
  void c.resume().then(() => {
    unlocked = c.state === 'running';
  });
  unlocked = c.state === 'running';
}

function tone(
  freq: number,
  dur: number,
  type: OscillatorType,
  gain = 0.18,
  when = 0,
  freqEnd?: number
): void {
  const c = getCtx();
  if (!c || !master) return;
  if (c.state === 'suspended') void c.resume();
  try {
    const t0 = c.currentTime + when;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (freqEnd !== undefined) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), t0 + dur);
    }
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    g.connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  } catch {
    // Audio graph errors must not crash the sim
  }
}

function noiseBurst(dur: number, gain = 0.12, when = 0, hp = 400): void {
  const c = getCtx();
  if (!c || !master) return;
  if (c.state === 'suspended') void c.resume();
  try {
    const n = Math.floor(c.sampleRate * dur);
    const buf = c.createBuffer(1, n, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < n; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = c.createBufferSource();
    src.buffer = buf;
    const filter = c.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = hp;
    const g = c.createGain();
    const t0 = c.currentTime + when;
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filter);
    filter.connect(g);
    g.connect(master);
    src.start(t0);
    src.stop(t0 + dur + 0.02);
  } catch {
    // ignore
  }
}

export function playSfx(id: SfxId, intensity = 1): void {
  if (muted) return;
  const i = Math.max(0.4, Math.min(1.6, intensity));
  switch (id) {
    case 'spawn':
      tone(220, 0.06, 'triangle', 0.1 * i);
      tone(330, 0.08, 'sine', 0.06 * i, 0.03);
      break;
    case 'recolor':
      tone(480 + Math.random() * 40, 0.05, 'square', 0.07 * i);
      tone(720, 0.04, 'sine', 0.05 * i, 0.02);
      break;
    case 'heat':
      tone(90, 0.18, 'sawtooth', 0.14 * i, 0, 180);
      noiseBurst(0.12, 0.1 * i, 0, 200);
      tone(520, 0.1, 'triangle', 0.08 * i, 0.04);
      break;
    case 'commit':
      tone(140, 0.1, 'square', 0.12 * i);
      tone(70, 0.16, 'sine', 0.16 * i, 0.02);
      noiseBurst(0.08, 0.08 * i, 0, 100);
      break;
    case 'lock':
      tone(60, 0.2, 'sine', 0.2 * i);
      tone(180, 0.12, 'triangle', 0.1 * i, 0.02);
      noiseBurst(0.1, 0.12 * i, 0, 80);
      break;
    case 'detonate':
      noiseBurst(0.18, 0.16 * i, 0, 120);
      tone(200, 0.14, 'sawtooth', 0.12 * i, 0, 60);
      tone(400, 0.1, 'square', 0.08 * i, 0.03, 120);
      break;
    case 'cascade':
      tone(300 + 80 * i, 0.09, 'triangle', 0.1 * i);
      tone(500 + 100 * i, 0.08, 'sine', 0.08 * i, 0.03);
      noiseBurst(0.1, 0.1 * i, 0.01, 300);
      break;
    case 'danger':
      tone(180, 0.08, 'square', 0.05 * i);
      tone(160, 0.08, 'square', 0.05 * i, 0.09);
      break;
    case 'gameover':
      tone(200, 0.25, 'sawtooth', 0.14 * i, 0, 60);
      tone(120, 0.35, 'sine', 0.16 * i, 0.08, 40);
      noiseBurst(0.3, 0.1 * i, 0.05, 60);
      break;
    case 'ui':
      tone(640, 0.04, 'sine', 0.06 * i);
      break;
    case 'armed':
      // Ascending chime — "you authored the boom"
      tone(440, 0.07, 'triangle', 0.1 * i);
      tone(660, 0.09, 'sine', 0.12 * i, 0.04);
      tone(880, 0.12, 'sine', 0.1 * i, 0.08);
      break;
    case 'hot':
      // Soft tick — one recolor from armed
      tone(520, 0.05, 'sine', 0.07 * i);
      tone(640, 0.06, 'triangle', 0.05 * i, 0.03);
      break;
    default:
      break;
  }
}

export function isAudioUnlocked(): boolean {
  return unlocked;
}
