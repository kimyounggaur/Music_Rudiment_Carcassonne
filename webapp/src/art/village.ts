/* '음악 마을' 테마: 테이블 위 타일 보드게임 느낌의 독창적인 그림.
 *  - 타일 = 두께가 보이는 풀밭 판, 리듬선 = 흙길, 음표는 길 위에 칠한 표시
 *  - 마디줄 = 나무 차단목, 지휘대 = 작은 음악 정자, 지휘자 = 칠한 나무 말
 * 카드 테마(tiles.ts)와 같은 100×100 좌표·같은 기하(GEOM)·같은 지휘자 자리를 쓰고 그림만 다르다.
 * 풀·꽃·나무 장식은 타일 종류와 회전으로 정해지는 의사난수라, 같은 타일은 늘 같은 모습이다. */
import { GEOM, SYMBOLS, kindOf, mulberry32 } from '../engine/engine';
import type { KindId } from '../engine/engine';
import { pieceGeom, symGlyph, fmtBeats, tileColor, labelInk, meepleAnchor, symBox, hasStem, hit, distToRect, r1, THRU, type Box } from './tiles';

export const V = {
  table: '#B98352', tableDk: '#9C6A3E', tableLt: '#C9965F',
  grass: '#9BC766', grassHi: '#B3D77E', grassDk: '#77A54A', edge: '#5C8638',
  path: '#EED9A6', pathEdge: '#C5A066', pebble: '#D3B47B',
  wood: '#B98654', woodDk: '#5E3C1F', woodLt: '#D7A86F',
  stone: '#E3DCCB', stoneDk: '#A79C86',
  leaf: '#5D9B45', leafHi: '#7DB85A', leafDk: '#3F7530',
  ink: '#2A2118', cream: '#FFF8E6',
};

const hash = (s: string) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };

/** 나무 차단목 (마디줄). 중심 (cx,cy), vertical이면 세로로 길게 */
export function fence(cx: number, cy: number, vertical: boolean, len = 54): string {
  const w = 10.5;
  const [x, y, rw, rh] = vertical ? [cx - w / 2, cy - len / 2, w, len] : [cx - len / 2, cy - w / 2, len, w];
  const [p1, p2] = vertical ? [[cx, cy - len / 2], [cx, cy + len / 2]] : [[cx - len / 2, cy], [cx + len / 2, cy]];
  const grain = vertical
    ? `M${r1(cx - 1.6)} ${r1(y + 7)}V${r1(y + rh - 7)}M${r1(cx + 2)} ${r1(y + 10)}V${r1(y + rh * 0.55)}`
    : `M${r1(x + 7)} ${r1(cy - 1.6)}H${r1(x + rw - 7)}M${r1(x + 10)} ${r1(cy + 2)}H${r1(x + rw * 0.55)}`;
  return `<g class="v-fence">`
    + `<rect x="${r1(x + 1.5)}" y="${r1(y + 2.5)}" width="${rw}" height="${rh}" rx="3" fill="rgba(40,24,10,.28)"/>`
    + `<rect x="${r1(x)}" y="${r1(y)}" width="${rw}" height="${rh}" rx="3" fill="${V.woodLt}" stroke="${V.woodDk}" stroke-width="1.8"/>`
    + `<path d="${grain}" stroke="${V.wood}" stroke-width="1.2" stroke-linecap="round"/>`
    + [p1, p2].map(([px, py]) => `<circle cx="${r1(px)}" cy="${r1(py)}" r="5.4" fill="${V.woodDk}"/><circle cx="${r1(px - 1.4)}" cy="${r1(py - 1.4)}" r="1.8" fill="${V.wood}"/>`).join('')
    + '</g>';
}

/** 칠한 나무 말 (지휘자): 발끝 (x,y) 기준 — 카드 테마와 같은 실루엣 */
export function meeple(x: number, y: number, color: string, cls = ''): string {
  return `<g class="meeple ${cls}" transform="translate(${r1(x)} ${r1(y)})">`
    + '<ellipse cx="1.5" cy="0.8" rx="12" ry="3.6" fill="rgba(30,18,6,.32)"/>'
    + `<path d="M-9.5 0L-6.6 -15.5Q0 -20 6.6 -15.5L9.5 0Z" fill="${color}" stroke="#2E1F12" stroke-width="1.9" stroke-linejoin="round"/>`
    + '<path d="M1.2 -18.2Q4.6 -17.8 6.6 -15.5L9.5 0H2.2Z" fill="rgba(0,0,0,.2)"/>'
    + `<circle cy="-22.5" r="6.4" fill="${color}" stroke="#2E1F12" stroke-width="1.9"/>`
    + '<path d="M2.2 -28.4A6.4 6.4 0 0 1 2.2 -16.6A5 5 0 0 0 2.2 -28.4Z" fill="rgba(0,0,0,.2)"/>'
    + '<ellipse cx="-2.6" cy="-25" rx="2" ry="1.4" fill="rgba(255,255,255,.55)"/>'
    + '<path d="M-5.6 -11.5L-4.6 -4" stroke="rgba(255,255,255,.4)" stroke-width="1.8" stroke-linecap="round"/>'
    + '<path d="M5.5 -13L13.5 -24.5" stroke="#2E1F12" stroke-width="3.6" stroke-linecap="round"/>'
    + '<path d="M5.5 -13L13.5 -24.5" stroke="#F8EEDA" stroke-width="1.8" stroke-linecap="round"/>'
    + '</g>';
}

function tree(x: number, y: number, s: number): string {
  return `<g transform="translate(${r1(x)} ${r1(y)}) scale(${s})">`
    + '<ellipse cx="2.5" cy="4.5" rx="9" ry="6" fill="rgba(30,50,10,.22)"/>'
    + `<circle r="8.5" fill="${V.leaf}"/><circle cx="-2.6" cy="-2.8" r="5.4" fill="${V.leafHi}"/><circle cx="-3.6" cy="-4" r="2" fill="#A6D57E"/>`
    + '</g>';
}
function bush(x: number, y: number): string {
  return `<g transform="translate(${r1(x)} ${r1(y)})"><ellipse cx="1.4" cy="2.6" rx="6.4" ry="3.4" fill="rgba(30,50,10,.25)"/>`
    + `<circle cx="-2.6" r="4" fill="${V.leaf}"/><circle cx="2.4" cy="-.6" r="4.4" fill="${V.leaf}"/><circle cx="-.6" cy="-2" r="2.6" fill="${V.leafHi}"/></g>`;
}
function tuft(x: number, y: number): string {
  return `<path d="M${r1(x - 2.6)} ${r1(y)}l1 -3.8M${r1(x)} ${r1(y)}v-4.6M${r1(x + 2.6)} ${r1(y)}l-1 -3.8" stroke="${V.grassDk}" stroke-width="1.3" stroke-linecap="round"/>`;
}
function flower(x: number, y: number, c: string): string {
  return `<circle cx="${r1(x)}" cy="${r1(y)}" r="1.9" fill="${c}"/><circle cx="${r1(x)}" cy="${r1(y)}" r=".8" fill="#E9A92B"/>`;
}

/** 돌판 위 박자표 숫자 (흰 테두리로 풀밭 위에서도 잘 보이게) */
function digit(x: number, y: number, t: string, cls: string): string {
  return `<text x="${x}" y="${y}" class="${cls}" text-anchor="middle" fill="${V.ink}" stroke="${V.cream}" stroke-width="4.5" stroke-linejoin="round" paint-order="stroke">${t}</text>`;
}

function plank(x: number, y: number, w: number, text: string, fill: string, ink: string, cls = 'tlabel'): string {
  return `<g transform="translate(${r1(x)} ${r1(y)})"><rect x="1" y="2" width="${r1(w)}" height="18" rx="4" fill="rgba(40,24,10,.25)"/>`
    + `<rect width="${r1(w)}" height="18" rx="4" fill="${fill}" stroke="${V.woodDk}" stroke-width="1.5"/>`
    + `<text x="${r1(w / 2)}" y="13.3" class="${cls}" text-anchor="middle" fill="${ink}">${text}</text></g>`;
}

function labelSpot(samples: [number, number][], boxes: Box[], w: number, h: number): [number, number] {
  const cands: [number, number][] = [[7, 7], [93 - w, 7], [7, 89 - h], [93 - w, 89 - h]];
  for (const [lx, ly] of cands) {
    const rect: Box = [lx - 1, ly - 1, lx + w + 1, ly + h + 2];
    if (boxes.some((b) => hit(rect, b))) continue;
    if (samples.some(([px, py]) => distToRect(px, py, rect) < 13.5)) continue;
    return [lx, ly];
  }
  return cands[0];
}

const cache = new Map<string, string>();
/** 타일 한 장 (바깥 <svg> 없이, 100×100) */
export function tile(k: KindId, r: number, opts: { beats?: boolean } = {}): string {
  const beats = opts.beats !== false;
  const ck = `${k}|${r}|${beats ? 1 : 0}`;
  const hitc = cache.get(ck);
  if (hitc) return hitc;
  const K = kindOf(k);
  const g = GEOM[k][r];
  const rnd = mulberry32(hash(`${k}:${r}`));
  // 판 두께 + 풀밭 윗면 + 윗가장자리 빛
  let s = `<rect x="2" y="4.6" width="96" height="94.6" rx="10" fill="${V.edge}"/>`
    + `<rect x="2" y="2" width="96" height="94" rx="10" fill="${V.grass}"/>`
    + `<path d="M10 3.4H90" stroke="${V.grassHi}" stroke-width="2" stroke-linecap="round" opacity=".8"/>`;
  const geoms = g.pieces.map((pc) => pieceGeom(pc.ends));
  const samples: [number, number][] = [];
  for (const pg of geoms) for (let t = 0; t <= 1.0001; t += 0.05) samples.push(pg.at(t));
  // 피해야 할 자리: 음표·기둥, 지휘자, 이름표
  const boxes: Box[] = [];
  let deco = '';
  let under = '';
  let fg = '';
  if (K.sym) {
    const head = geoms[0].head!;
    boxes.push(symBox(K.sym, head));
    if (hasStem(K.sym)) boxes.push([head[0] + 6, head[1] - 34, head[0] + (K.sym === 'e' ? 20 : 12), head[1]]);
  }
  for (let pi = 0; pi < g.pieces.length; pi++) {
    if (g.pieces[pi].beats === 0 && !K.thru) continue;
    const [ax, ay] = meepleAnchor(k, r, pi);
    boxes.push([ax - 11, ay - 30, ax + 11, ay + 2]);
  }
  if (K.stand) { const [ax, ay] = meepleAnchor(k, r, 's'); boxes.push([ax - 11, ay - 30, ax + 11, ay + 2]); }

  // 흙길
  let path = '';
  for (const pg of geoms) path += `<path d="${pg.d}" fill="none" stroke="${V.pathEdge}" stroke-width="25"/>`;
  for (const pg of geoms) path += `<path d="${pg.d}" fill="none" stroke="${V.path}" stroke-width="19.5"/>`;
  for (const pg of geoms) {
    for (const t of [0.12, 0.3, 0.7, 0.88]) {
      const [px, py] = pg.at(t);
      const [qx, qy] = pg.at(Math.min(1, t + 0.02));
      const len = Math.hypot(qx - px, qy - py) || 1;
      const nx = -(qy - py) / len, ny = (qx - px) / len;
      const off = (rnd() - 0.5) * 11;
      const x = px + nx * off, y = py + ny * off;
      if (boxes.some((b) => x > b[0] - 2 && x < b[2] + 2 && y > b[1] - 2 && y < b[3] + 2)) continue;
      path += `<ellipse cx="${r1(x)}" cy="${r1(y)}" rx="1.8" ry="1.2" fill="${V.pebble}"/>`;
    }
  }

  // 그림 요소
  if (K.start || K.shape === 'timesig') {
    const vertBar = g.face === -1 || g.face === 1 || g.face === 3;
    if (K.start) {
      fg += fence(50, 50, vertBar, 50);
      // 시작을 알리는 깃발 (시작 타일 색)
      fg += `<g transform="translate(74 14)"><path d="M0 0V24" stroke="${V.woodDk}" stroke-width="2.2" stroke-linecap="round"/>`
        + `<path d="M1 1.5H16L12 6.5L16 11.5H1Z" fill="${tileColor(k)}" stroke="${V.woodDk}" stroke-width="1.3" stroke-linejoin="round"/>`
        + `<ellipse cx="1" cy="24" rx="4" ry="1.6" fill="rgba(30,40,10,.3)"/></g>`;
      boxes.push([70, 10, 94, 40]);
      fg += digit(27, 38, '4', 'tsig') + digit(27, 78, '4', 'tsig');
      boxes.push([14, 14, 40, 86]);
      fg += plank(64, 75, 30, '시작', V.stone, '#4A4030');
      boxes.push([62, 73, 96, 95]);
    } else {
      fg += fence(50, 50, vertBar, 50);
      const big = g.face === 1 || g.face === 3 ? 0 : 1;
      const pos: Record<number, [number, number, number]> = big ? { 0: [76, 25, 46], 2: [76, 68, 89] } : { 1: [73, 38, 78], 3: [27, 38, 78] };
      const [x, y1, y2] = pos[g.face!];
      const cls = big ? 'tsig sm' : 'tsig';
      fg += digit(x, y1, String(K.ts), cls) + digit(x, y2, '4', cls);
      boxes.push([x - 14, y1 - 26, x + 14, y2 + 4]);
    }
  } else if (K.sym) {
    const head = geoms[0].head!;
    fg += symGlyph(K.sym, head[0], head[1]);
    if (beats) {
      const label = `${fmtBeats(SYMBOLS[K.sym].beats)}박`;
      const w = 12 + label.length * 8.2;
      const [lx, ly] = labelSpot(samples, boxes, w, 18);
      fg += plank(lx, ly, w, label, tileColor(k), labelInk(k));
      boxes.push([lx - 2, ly - 2, lx + w + 2, ly + 21]);
    } else {
      // 박자 숫자를 숨겨도 음표 종류 색은 남긴다 (작은 깃발)
      const w = 14;
      const [lx, ly] = labelSpot(samples, boxes, w, 18);
      fg += `<g transform="translate(${r1(lx + 4)} ${r1(ly)})"><path d="M0 0V19" stroke="${V.woodDk}" stroke-width="1.8" stroke-linecap="round"/><path d="M1 1H12L9 5L12 9H1Z" fill="${tileColor(k)}" stroke="${V.woodDk}" stroke-width="1.2" stroke-linejoin="round"/></g>`;
      boxes.push([lx - 2, ly - 2, lx + w + 2, ly + 21]);
    }
  } else if (K.stand) {
    const roof = tileColor(k);
    const pav = (cx: number, cy: number, sc: number) => `<g transform="translate(${cx} ${cy}) scale(${sc})">`
      + '<ellipse cx="2" cy="17" rx="27" ry="8" fill="rgba(30,40,10,.28)"/>'
      + `<path d="M-24 10h48v7h-48z" fill="${V.stone}" stroke="${V.stoneDk}" stroke-width="1.5"/>`
      + `<path d="M-19 -2v12M-6.5 -2v12M6.5 -2v12M19 -2v12" stroke="${V.cream}" stroke-width="3.4" stroke-linecap="round"/>`
      + `<path d="M-19 -2v12M-6.5 -2v12M6.5 -2v12M19 -2v12" stroke="${V.woodDk}" stroke-width="1" opacity=".5"/>`
      + `<path d="M-28 -1L0 -24L28 -1Z" fill="${roof}" stroke="#4A2A5C" stroke-width="1.8" stroke-linejoin="round"/>`
      + '<path d="M-14 -12.6L0 -24L6 -19" fill="none" stroke="rgba(255,255,255,.5)" stroke-width="1.6" stroke-linecap="round"/>'
      + `<circle cy="-26" r="2.6" fill="#F2C14E" stroke="#4A2A5C" stroke-width="1"/>`
      + `<path d="M-6 5.5q3 -4 6 0q3 -4 6 0" fill="none" stroke="${V.ink}" stroke-width="1.4" opacity=".7"/>`
      + '</g>';
    if (K.thru) {
      const L = THRU(r);
      const [px, py, sc] = r % 2 === 0 ? [30, 31, 0.62] : [21, 34, 0.55];
      fg += pav(px, py, sc);
      boxes.push([px - 19, py - 17, px + 19, py + 14]);
      // 가로 길: 길 아래에 이름표. 세로 길: 지휘자가 길 아래쪽에 서므로 오른쪽 위에 작은 이름표
      const [lx, ly, lw, cls] = r % 2 === 0 ? [L.label[0] - 21, 75, 42, 'tlabel small'] : [62, 7, 34, 'tlabel tiny'];
      fg += plank(lx, ly, lw, '지휘대', V.stone, '#4A3060', cls);
      boxes.push([lx - 2, ly - 2, lx + lw + 2, ly + 21]);
    } else {
      fg += pav(46, 44, 1);
      boxes.push([16, 14, 78, 66]);
      fg += plank(19, 75, 42, '지휘대', V.stone, '#4A3060');
      boxes.push([17, 73, 63, 96]);
    }
  }

  // 풀밭 장식: 밝은 풀빛 얼룩 → 나무 → 덤불 → 꽃 → 풀포기 (길·글자·지휘자 자리를 피해서)
  for (let i = 0; i < 3; i++) {
    const x = 12 + rnd() * 76, y = 12 + rnd() * 72;
    under += `<ellipse cx="${r1(x)}" cy="${r1(y)}" rx="${r1(9 + rnd() * 8)}" ry="${r1(5 + rnd() * 4)}" fill="${V.grassHi}" opacity=".45"/>`;
  }
  const free = (x: number, y: number, rad: number) => x > 6 + rad && x < 94 - rad && y > 6 + rad && y < 92 - rad
    && samples.every(([px, py]) => Math.hypot(px - x, py - y) > 13 + rad)
    && boxes.every((b) => distToRect(x, y, b) > rad);
  const corners: [number, number][] = [[17, 17], [83, 17], [17, 81], [83, 81], [50, 14], [50, 84], [14, 50], [86, 50]];
  for (let i = corners.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [corners[i], corners[j]] = [corners[j], corners[i]]; }
  let trees = 0;
  const maxTrees = rnd() < 0.55 ? 1 : 0;
  for (const [x, y] of corners) {
    if (trees >= maxTrees) break;
    if (!free(x, y, 10)) continue;
    deco += tree(x, y, 0.82 + rnd() * 0.3);
    boxes.push([x - 11, y - 11, x + 11, y + 11]);
    trees++;
  }
  for (let i = 0, n = 0; i < 30 && n < (trees ? 0 : 1); i++) {
    const x = 10 + rnd() * 80, y = 10 + rnd() * 78;
    if (!free(x, y, 6)) continue;
    deco += bush(x, y);
    boxes.push([x - 7, y - 6, x + 7, y + 6]);
    n++;
  }
  const fl = ['#FFFFFF', '#FFE27A', '#F7A8C4'];
  for (let i = 0, n = 0; i < 60 && n < 6; i++) {
    const x = 8 + rnd() * 84, y = 8 + rnd() * 82;
    if (!free(x, y, 2.5)) continue;
    deco += flower(x, y, fl[Math.floor(rnd() * fl.length)]);
    n++;
  }
  for (let i = 0, n = 0; i < 80 && n < 9; i++) {
    const x = 8 + rnd() * 84, y = 10 + rnd() * 80;
    if (!free(x, y, 3)) continue;
    deco += tuft(x, y);
    n++;
  }
  s += under + path + deco + fg;
  cache.set(ck, s);
  return s;
}

/** 이음새 위 마디줄 (월드 좌표, 'v' 세로 이음새면 세로 차단목) */
export function bar(sk: string): string {
  const [x, y] = sk.slice(1).split(',').map(Number);
  return sk[0] === 'v' ? fence(x * 100, y * 100 + 50, true) : fence(x * 100 + 50, y * 100, false);
}

/** 보드 바탕: 나무 테이블 무늬 (<defs> 안에 넣을 pattern, id="vgWood"). 색은 CSS 변수(--table…)라 밝음·어두움을 따라간다 */
export const WOOD_PATTERN = `<pattern id="vgWood" width="420" height="140" patternUnits="userSpaceOnUse">`
  + '<rect width="420" height="140" style="fill:var(--table)"/>'
  + '<path d="M0 18C80 10 160 26 250 16S380 22 420 14M0 52C100 44 190 62 300 50S390 56 420 50M0 88C70 82 170 98 260 86S370 92 420 86M0 122C110 114 200 130 290 120S380 126 420 120" fill="none" style="stroke:var(--table-dk)" stroke-width="2.2" opacity=".55"/>'
  + '<path d="M0 34C90 28 170 40 260 32S370 36 420 30M0 104C90 98 180 112 270 102S380 108 420 102" fill="none" style="stroke:var(--table-lt)" stroke-width="1.6" opacity=".6"/>'
  + '<ellipse cx="318" cy="70" rx="14" ry="5" fill="none" style="stroke:var(--table-dk)" stroke-width="1.8" opacity=".5"/>'
  + '</pattern>';
