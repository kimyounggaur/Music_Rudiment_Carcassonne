/* 타일 그림 (SVG 문자열). 리마스터 컬러 카드 팔레트 + 흰 리듬선 띠 + 진한 잉크 음표.
 * 타일은 100×100 단위. 타일을 돌려도 음표·숫자는 항상 똑바로 선다. */
import { GEOM, KINDS, SYMBOLS, kindOf } from '../engine/engine';
import type { KindId, SymId } from '../engine/engine';

export const INK = '#231F33';
export const RIBBON = '#FFFDF7';

/** 리마스터 팔레트 (generate_remastered_svgs.py) */
const SYM_COLOR: Record<SymId, string> = {
  q: '#F06292', h: '#FFB74D', dh: '#FFD54F', w: '#4FC3F7',
  e: '#6DBF67', dq: '#FF8A65',
  qr: '#90CAF9', er: '#90CAF9', hr: '#90CAF9',
};
const SYM_INK: Record<SymId, string> = {
  q: '#8A1747', h: '#8A4A00', dh: '#7A5C00', w: '#035A86',
  e: '#1E5A1A', dq: '#8A2E0F', qr: '#0D4A80', er: '#0D4A80', hr: '#0D4A80',
};
const KIND_COLOR: Partial<Record<KindId, string>> = { stand: '#CE93D8', 'stand-thru': '#B39DDB', start: '#80CBC4', ts34: '#A5D6A7', ts24: '#80DEEA' };
const KIND_INK: Partial<Record<KindId, string>> = { stand: '#5B2470', 'stand-thru': '#40287A', start: '#0D5A50', ts34: '#1B5E20', ts24: '#006064' };

export const tileColor = (k: KindId) => { const K = kindOf(k); return K.sym ? SYM_COLOR[K.sym] : KIND_COLOR[k]!; };
export const labelInk = (k: KindId) => { const K = kindOf(k); return K.sym ? SYM_INK[K.sym] : KIND_INK[k]!; };
export const symColor = (s: SymId) => SYM_COLOR[s];

/** 박 수 표기: 0.5 → ½, 1.5 → 1½ */
export function fmtBeats(b: number): string {
  const whole = Math.floor(b + 1e-9);
  const frac = b - whole;
  if (Math.abs(frac) < 1e-9) return String(whole);
  if (Math.abs(frac - 0.5) < 1e-9) return whole ? `${whole}½` : '½';
  return String(b);
}

export const MID: [number, number][] = [[50, 0], [100, 50], [50, 100], [0, 50]];
export const r1 = (v: number) => Math.round(v * 10) / 10;
export type Box = [number, number, number, number];

export interface PieceGeom { d: string; at: (t: number) => [number, number]; head: [number, number] | null }
export function pieceGeom(ends: (number | 'bar')[]): PieceGeom {
  const es = ends.filter((e) => e !== 'bar') as number[];
  if (ends.includes('bar')) {
    const [ex, ey] = MID[es[0]];
    return { d: `M${ex} ${ey}L50 50`, at: (t) => [ex + (50 - ex) * t, ey + (50 - ey) * t], head: null };
  }
  const [a, b] = es;
  const [ax, ay] = MID[a];
  const [bx, by] = MID[b];
  if (((a + 2) & 3) === b) {
    return { d: `M${ax} ${ay}L${bx} ${by}`, at: (t) => [ax + (bx - ax) * t, ay + (by - ay) * t], head: [50, 50] };
  }
  const set = new Set([a, b]);
  const cx = set.has(1) ? 100 : 0;
  const cy = set.has(2) ? 100 : 0;
  const a0 = Math.atan2(ay - cy, ax - cx);
  let da = Math.atan2(by - cy, bx - cx) - a0;
  if (da > Math.PI) da -= 2 * Math.PI;
  if (da < -Math.PI) da += 2 * Math.PI;
  const at = (t: number): [number, number] => [cx + 50 * Math.cos(a0 + da * t), cy + 50 * Math.sin(a0 + da * t)];
  return { d: `M${ax} ${ay}A50 50 0 0 ${da > 0 ? 1 : 0} ${bx} ${by}`, at, head: at(0.5) };
}

/** 기호가 차지하는 영역 (머리·점·쉼표 몸통). 기둥은 따로 */
export function symBox(sym: SymId, [hx, hy]: [number, number]): Box {
  switch (sym) {
    case 'w': return [hx - 13.5, hy - 9, hx + 13.5, hy + 9];
    case 'dh': case 'dq': return [hx - 11, hy - 9, hx + 22, hy + 9];
    case 'qr': return [hx - 8, hy - 17, hx + 8, hy + 17];
    case 'er': return [hx - 9, hy - 13, hx + 9, hy + 14];
    case 'hr': return [hx - 12, hy - 9, hx + 12, hy + 6];
    default: return [hx - 11, hy - 9, hx + 11, hy + 9];
  }
}
export const hasStem = (sym: SymId) => ['q', 'h', 'dh', 'e', 'dq'].includes(sym);
export const hit = (a: Box, b: Box) => a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1];
export function distToRect(px: number, py: number, r: Box) {
  const dx = Math.max(r[0] - px, 0, px - r[2]);
  const dy = Math.max(r[1] - py, 0, py - r[3]);
  return Math.hypot(dx, dy);
}

/** 음표·쉼표 기호 (항상 똑바로) */
export function symGlyph(sym: SymId, hx: number, hy: number): string {
  const tr = `translate(${r1(hx)} ${r1(hy)})`;
  if (sym === 'w') return `<g transform="${tr}"><ellipse rx="12.6" ry="8.4" fill="${INK}"/><ellipse rx="6.4" ry="4.3" transform="rotate(-40)" fill="${RIBBON}"/></g>`;
  if (sym === 'qr') {
    return `<g transform="${tr}"><path d="M-3.5 -16L4.5 -7.5L-1.5 -0.5L5 7C-1 4.5 -6.5 8.5 -0.5 15.5" fill="none" stroke="${INK}" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/></g>`;
  }
  if (sym === 'er') {
    return `<g transform="${tr}"><circle cx="-4.5" cy="-8" r="4" fill="${INK}"/><path d="M-4.5 -5.5C-1 -3.5 3.5 -5 6.5 -10L-1.5 13" fill="none" stroke="${INK}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></g>`;
  }
  if (sym === 'hr') {
    return `<g transform="${tr}"><path d="M-12 3H12" stroke="${INK}" stroke-width="2.2" stroke-linecap="round"/><rect x="-7.5" y="-6" width="15" height="9" rx="1" fill="${INK}"/></g>`;
  }
  const filled = sym === 'q' || sym === 'e' || sym === 'dq';
  const head = filled
    ? `<ellipse rx="10" ry="7.1" transform="rotate(-22)" fill="${INK}"/>`
    : `<ellipse rx="9" ry="6.2" transform="rotate(-22)" fill="${RIBBON}" stroke="${INK}" stroke-width="3.1"/>`;
  const stem = `<path d="M9.1 -2.6V-32" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>`;
  const dot = sym === 'dh' || sym === 'dq' ? `<circle cx="18" cy="-5.5" r="3.4" fill="${INK}"/>` : '';
  const flag = sym === 'e' ? `<path d="M9.1 -32C10.5 -25 19.5 -23 17 -12.5" fill="none" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>` : '';
  return `<g transform="${tr}">${head}${stem}${flag}${dot}</g>`;
}

/** 지휘자 말: 발끝 (x,y) 기준 */
export function meepleFigure(x: number, y: number, color: string, cls = ''): string {
  return `<g class="meeple ${cls}" transform="translate(${r1(x)} ${r1(y)})">`
    + `<path d="M-9.5 0L-6.6 -15.5Q0 -20 6.6 -15.5L9.5 0Z" fill="${INK}" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/>`
    + `<circle cy="-22.5" r="6.4" fill="${INK}" stroke="${INK}" stroke-width="5"/>`
    + `<path d="M-9.5 0L-6.6 -15.5Q0 -20 6.6 -15.5L9.5 0Z" fill="${color}" stroke="#fff" stroke-width="2.2" stroke-linejoin="round"/>`
    + `<circle cy="-22.5" r="6.4" fill="${color}" stroke="#fff" stroke-width="2.2"/>`
    + '<path d="M5.5 -13L13.5 -24.5" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/>'
    + '</g>';
}

function standIcon(cx: number, cy: number, s = 1): string {
  return `<g transform="translate(${cx} ${cy}) scale(${s})">`
    + `<g transform="rotate(-9)"><rect x="-18" y="-24" width="36" height="22" rx="3.5" fill="${INK}"/>`
    + `<path d="M-12 -18H12M-12 -13H12M-12 -8H12" stroke="${RIBBON}" stroke-width="1.6" stroke-linecap="round"/></g>`
    + `<path d="M0 -3V17M0 17L-10 27M0 17L10 27M0 17V27" stroke="${INK}" stroke-width="3.2" stroke-linecap="round" fill="none"/>`
    + '</g>';
}

/** 지휘대(통과) 타일 배치 */
export const THRU = (r: number) => (r % 2 === 0
  ? { icon: [30, 27], spot: [30, 43] as [number, number], line: [80, 50] as [number, number], label: [52, 88] }
  : { icon: [25, 30], spot: [25, 46] as [number, number], line: [50, 93] as [number, number], label: [79, 89] });

const anchorCache = new Map<string, [number, number]>();
/** 지휘자를 세울 자리 (타일 안 좌표, 발끝). f = 조각 번호 또는 's'(지휘대) */
export function meepleAnchor(k: KindId, r: number, f: number | 's'): [number, number] {
  const ck = `${k}|${r}|${f}`;
  const hitc = anchorCache.get(ck);
  if (hitc) return hitc;
  const K = kindOf(k);
  let res: [number, number] | null = null;
  if (K.thru) res = f === 's' ? THRU(r).spot : THRU(r).line;
  else if (f === 's') res = [80, 74];
  else {
    const g = pieceGeom(GEOM[k][r].pieces[f as number].ends);
    const blocks: Box[] = [];
    if (g.head && K.sym) {
      blocks.push(symBox(K.sym, g.head));
      if (hasStem(K.sym)) blocks.push([g.head[0] + 6, g.head[1] - 34, g.head[0] + (K.sym === 'e' ? 20 : 12), g.head[1]]);
    }
    const inside = (b: Box) => b[0] >= 2 && b[1] >= 2 && b[2] <= 98 && b[3] <= 98;
    for (const t of [0.2, 0.8, 0.92, 0.08, 0.3, 0.7]) {
      const [ax, ay] = g.at(t);
      const box: Box = [ax - 11, ay - 30, ax + 11, ay + 2];
      if (inside(box) && !blocks.some((b) => hit(box, b))) { res = [ax, ay]; break; }
    }
    if (!res) {
      const samples: [number, number][] = [];
      for (let t = 0; t <= 1.0001; t += 0.05) samples.push(g.at(t));
      let best = -Infinity;
      for (let x = 14; x <= 86; x += 2) {
        for (let y = 32; y <= 96; y += 2) {
          const box: Box = [x - 11, y - 30, x + 11, y + 2];
          if (!inside(box) || blocks.some((b) => hit(box, b))) continue;
          if (samples.some(([px, py]) => distToRect(px, py, box) < 2)) continue;
          const d = Math.min(...samples.map(([px, py]) => Math.hypot(px - x, py - y)));
          if (-d > best) { best = -d; res = [x, y]; }
        }
      }
    }
    if (!res) res = g.at(0.5);
  }
  anchorCache.set(ck, res);
  return res;
}

function chooseLabelSpot(samples: [number, number][], boxes: Box[], w: number, h: number): [number, number] {
  const cands: [number, number][] = [[8, 8], [92 - w, 8], [8, 92 - h], [92 - w, 92 - h]];
  for (const [lx, ly] of cands) {
    const rect: Box = [lx - 1, ly - 1, lx + w + 1, ly + h + 1];
    if (boxes.some((b) => hit(rect, b))) continue;
    if (samples.some(([px, py]) => distToRect(px, py, rect) < 10)) continue;
    return [lx, ly];
  }
  return cands[0];
}

/** 박자표 숫자 위치: 숫자가 적힌 쪽(face) 반쪽 */
function tsDigits(num: number, face: number): string {
  const big = face === 1 || face === 3 ? 0 : 1; // 가로 줄이면 위·아래, 세로 줄이면 옆에 세로로
  const pos: Record<number, [number, number, number]> = big
    ? { 0: [76, 25, 46], 2: [76, 72, 93] }
    : { 1: [73, 38, 78], 3: [27, 38, 78] };
  const [x, y1, y2] = pos[face];
  const cls = big ? 'tsig sm' : 'tsig';
  return `<text x="${x}" y="${y1}" class="${cls}" text-anchor="middle" fill="${INK}">${num}</text><text x="${x}" y="${y2}" class="${cls}" text-anchor="middle" fill="${INK}">4</text>`;
}

const tileCache = new Map<string, string>();
/** 타일 한 장의 SVG 요소들 (바깥 <svg> 없이) */
export function tile(k: KindId, r: number, opts: { beats?: boolean } = {}): string {
  const beats = opts.beats !== false;
  const ck = `${k}|${r}|${beats ? 1 : 0}`;
  const cached = tileCache.get(ck);
  if (cached) return cached;
  const K = kindOf(k);
  const g = GEOM[k][r];
  let s = `<rect x="2" y="2" width="96" height="96" rx="12" fill="${tileColor(k)}"/>`
    + '<rect x="6.5" y="6.5" width="87" height="87" rx="9" fill="none" stroke="#fff" stroke-opacity=".42" stroke-width="1.3"/>';
  const samples: [number, number][] = [];
  const geoms = g.pieces.map((pc) => pieceGeom(pc.ends));
  for (const pg of geoms) {
    s += `<path d="${pg.d}" fill="none" stroke="#1d1530" stroke-opacity=".17" stroke-width="20"/>`;
    s += `<path d="${pg.d}" fill="none" stroke="${RIBBON}" stroke-width="15"/>`;
    for (let t = 0; t <= 1.0001; t += 0.05) samples.push(pg.at(t));
  }
  if (K.start || K.shape === 'timesig') {
    const vertBar = g.face === -1 || g.face === 1 || g.face === 3; // 리듬선이 가로면 마디줄은 세로
    const bar = vertBar ? 'M50 27V73' : 'M27 50H73';
    s += `<path d="${bar}" stroke="#fff" stroke-width="11" stroke-linecap="round"/><path d="${bar}" stroke="${INK}" stroke-width="6.5" stroke-linecap="round"/>`;
    if (K.start) {
      s += `<text x="27" y="38" class="tsig" text-anchor="middle" fill="${INK}">4</text><text x="27" y="78" class="tsig" text-anchor="middle" fill="${INK}">4</text>`;
      s += `<text x="76" y="88" class="tlabel" text-anchor="middle" fill="${labelInk(k)}">시작</text>`;
    } else {
      s += tsDigits(K.ts!, g.face!);
    }
  } else if (K.sym) {
    const head = geoms[0].head!;
    s += symGlyph(K.sym, head[0], head[1]);
    const boxes: Box[] = [symBox(K.sym, head)];
    if (hasStem(K.sym)) boxes.push([head[0] + 6, head[1] - 34, head[0] + (K.sym === 'e' ? 20 : 12), head[1]]);
    const ma = meepleAnchor(k, r, 0);
    boxes.push([ma[0] - 11, ma[1] - 30, ma[0] + 11, ma[1] + 2]);
    if (beats) {
      const label = `${fmtBeats(SYMBOLS[K.sym].beats)}박`;
      const w = 12 + label.length * 8.2;
      const [lx, ly] = chooseLabelSpot(samples, boxes, w, 18);
      s += `<g transform="translate(${r1(lx)} ${ly})"><rect width="${r1(w)}" height="18" rx="9" fill="#fff" fill-opacity=".92"/>`
        + `<text x="${r1(w / 2)}" y="13.3" class="tlabel" text-anchor="middle" fill="${labelInk(k)}">${label}</text></g>`;
    }
  } else if (K.stand) {
    if (K.thru) {
      const L = THRU(r);
      s += standIcon(L.icon[0], L.icon[1], 0.62);
      s += `<text x="${L.label[0]}" y="${L.label[1]}" class="tlabel small" text-anchor="middle" fill="${labelInk(k)}">지휘대</text>`;
    } else {
      s += standIcon(46, 46, 1);
      s += `<text x="38" y="89" class="tlabel" text-anchor="middle" fill="${labelInk(k)}">지휘대</text>`;
    }
  }
  tileCache.set(ck, s);
  return s;
}

export function tileSVG(k: KindId, r = 0, opts: { beats?: boolean; cls?: string } = {}): string {
  const cls = opts.cls ? ` class="${opts.cls}"` : '';
  return `<svg viewBox="0 0 100 100"${cls} aria-hidden="true" focusable="false">${tile(k, r, opts)}</svg>`;
}

/** 이음새 위 마디줄 막대 (월드 좌표) */
export function barShape(sk: string) {
  const [x, y] = sk.slice(1).split(',').map(Number);
  if (sk[0] === 'v') {
    const X = x * 100, Y = y * 100 + 50;
    return { x1: X, y1: Y - 23, x2: X, y2: Y + 23, cx: X, cy: Y };
  }
  const X = x * 100 + 50, Y = y * 100;
  return { x1: X - 23, y1: Y, x2: X + 23, y2: Y, cx: X, cy: Y };
}

export const ALL_KINDS = Object.keys(KINDS) as KindId[];
