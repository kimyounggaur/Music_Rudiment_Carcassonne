/* 완성된 마디의 리듬을 소리로 (Web Audio, 외부 파일 없음).
 * 박마다 작은 메트로놈 + 음표는 칼림바풍 음, 쉼표는 소리 없이 박만 센다. */
let ctx: AudioContext | null = null;

export function unlock(): boolean {
  try {
    if (!ctx) {
      const AC = window.AudioContext || (window as any).webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') ctx.resume();
    return true;
  } catch {
    ctx = null;
    return false;
  }
}

function tick(at: number, accent: boolean) {
  const c = ctx!;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = 'sine';
  o.frequency.value = accent ? 1760 : 1320;
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(accent ? 0.09 : 0.06, at + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, at + 0.05);
  o.connect(g).connect(c.destination);
  o.start(at);
  o.stop(at + 0.06);
}

function tone(at: number, dur: number, freq: number) {
  const c = ctx!;
  const g = c.createGain();
  const o1 = c.createOscillator();
  const o2 = c.createOscillator();
  const g2 = c.createGain();
  o1.type = 'triangle';
  o1.frequency.value = freq;
  o2.type = 'sine';
  o2.frequency.value = freq * 4.01;
  g2.gain.value = 0.12;
  o1.connect(g);
  o2.connect(g2).connect(g);
  g.connect(c.destination);
  const end = at + Math.max(0.12, dur - 0.03);
  const decayTo = at + Math.min(0.22, dur * 0.45);
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(0.32, at + 0.01);
  g.gain.exponentialRampToValueAtTime(0.13, decayTo);
  g.gain.setValueAtTime(0.13, Math.max(decayTo, end - 0.07));
  g.gain.exponentialRampToValueAtTime(0.0001, end);
  o1.start(at);
  o2.start(at);
  o1.stop(end + 0.02);
  o2.stop(end + 0.02);
}

export interface Beat { beats: number; rest: boolean }

/** 연주하고 길이(ms)를 돌려준다. onNote(i)는 i번째 음표·쉼표가 시작될 때.
 * measure: 한 마디 박 수 — 마디 첫 박마다 메트로놈에 강세 (여러 마디를 이어 들려줄 때) */
export function playRhythm(items: Beat[], opts: { bpm?: number; onNote?: (i: number) => void; measure?: number } = {}): number {
  if (!unlock()) return 0;
  const c = ctx!;
  const spb = 60 / (opts.bpm ?? 96);
  const lead = 0.12;
  const t0 = c.currentTime + lead;
  const total = items.reduce((a, b) => a + b.beats, 0);
  const nBeats = Math.ceil(total - 1e-9);
  const per = opts.measure && opts.measure > 0 ? opts.measure : Infinity;
  for (let i = 0; i < nBeats; i++) tick(t0 + i * spb, i === 0 || (per !== Infinity && i % per === 0));
  let t = 0;
  items.forEach((it, i) => {
    if (!it.rest) tone(t0 + t * spb, it.beats * spb, 523.25);
    if (opts.onNote) setTimeout(() => opts.onNote!(i), (lead + t * spb) * 1000);
    t += it.beats;
  });
  return (lead + total * spb) * 1000;
}

export function blip(ok = true) {
  if (!unlock()) return;
  const at = ctx!.currentTime + 0.02;
  if (ok) { tone(at, 0.16, 659.25); tone(at + 0.09, 0.22, 987.77); }
  else tone(at, 0.28, 220);
}
