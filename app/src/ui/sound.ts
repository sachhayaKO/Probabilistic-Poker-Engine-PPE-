// Synthesized WebAudio sound design — no asset files. All effects are silent
// no-ops when sound is toggled off or AudioContext is unavailable (tests).
let enabled = true;
let ctx: AudioContext | null = null;

export function setSoundEnabled(v: boolean): void {
  enabled = v;
}

export function soundEnabled(): boolean {
  return enabled;
}

function audio(): AudioContext | null {
  if (!enabled || typeof AudioContext === 'undefined') return null;
  ctx ??= new AudioContext();
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

function tone(freq: number, dur: number, type: OscillatorType, peak: number, when = 0): void {
  const ac = audio();
  if (!ac) return;
  const t0 = ac.currentTime + when;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0, t0);
  gain.gain.linearRampToValueAtTime(peak, t0 + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(gain).connect(ac.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

function noise(dur: number, peak: number, filterFreq: number): void {
  const ac = audio();
  if (!ac) return;
  const len = Math.floor(ac.sampleRate * dur);
  const buf = ac.createBuffer(1, len, ac.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ac.createBufferSource();
  src.buffer = buf;
  const filter = ac.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = filterFreq;
  const gain = ac.createGain();
  gain.gain.value = peak;
  src.connect(filter).connect(gain).connect(ac.destination);
  src.start();
}

export const cardSlide = (): void => noise(0.12, 0.25, 2400);
export const cardFlip = (): void => noise(0.07, 0.3, 3600);
export const chipClink = (): void => {
  tone(2200, 0.06, 'triangle', 0.12);
  tone(2800, 0.05, 'triangle', 0.08, 0.03);
};
export const potWin = (): void => {
  tone(523, 0.18, 'sine', 0.14);
  tone(659, 0.18, 'sine', 0.14, 0.09);
  tone(784, 0.3, 'sine', 0.14, 0.18);
};
export const bigPotSting = (): void => {
  potWin();
  tone(1047, 0.4, 'sine', 0.1, 0.27);
};
export const mistakeSting = (): void => {
  tone(220, 0.25, 'sawtooth', 0.06);
  tone(208, 0.3, 'sawtooth', 0.05, 0.05);
};
