/* 룰북 삽화 — 앱이 실제로 쓰는 타일·지휘자·마디줄 그림(SKIN)과 룰 엔진으로 장면을 그린다.
 *  - 삽화 속 타일은 게임 화면과 같은 그림이라 테마(음악 마을/카드)를 바꾸면 삽화도 함께 바뀐다.
 *  - 점수·박자합·'놓을 수 있는 자리'는 숫자를 손으로 적지 않고 엔진을 돌려 얻은 값을 쓴다
 *    (rulebook.test.ts가 글에 적힌 숫자와 엔진 결과가 같은지 확인).
 *  - 글자·선·색은 CSS 클래스(fg-*)로만 칠해서 밝은/어두운 화면을 따라간다.
 * 좌표: 타일 한 칸 = 100×100 (게임 보드와 같음). 칸 (x,y)의 왼쪽 위 = (x*100, y*100). */
import * as R from '../engine/engine';
import type { KindId } from '../engine/engine';
import * as ART from './tiles';
import * as SKIN from './skin';
import * as CARD from './tiles';
import * as VG from './village';
import { COLORS } from '../game/colors';

export type Tone = 'ink' | 'mut' | 'acc' | 'ok' | 'no' | 'inv';
export type Box4 = [number, number, number, number];
export interface Fig { vb: Box4; body: string; alt: string }

const f1 = (n: number) => Math.round(n * 10) / 10;
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const fb = ART.fmtBeats;

/** 글자 폭 어림 (한글·전각 1em, 숫자·영문 약 .56em) — 말풍선·화면 경계 계산용 */
export function tw(s: string, size: number): number {
  let w = 0;
  for (const ch of s) {
    const c = ch.codePointAt(0)!;
    if (c > 0x2e80) w += 1;
    else if (c === 32) w += 0.32;
    else if (/[A-Z]/.test(ch)) w += 0.68;
    else if (/[iltj.,:;'|!()]/.test(ch)) w += 0.32;
    else w += 0.58;
  }
  return w * size;
}

export interface Term { b: number; k: KindId; rest?: boolean }

/** 그림판: 요소를 쌓고 경계를 자동으로 넓힌다 */
export class Canvas {
  parts: string[] = [];
  x0 = Infinity; y0 = Infinity; x1 = -Infinity; y1 = -Infinity;
  get w() { return this.x1 - this.x0; }
  get h() { return this.y1 - this.y0; }
  grow(ax: number, ay: number, bx: number, by: number) {
    if (ax < this.x0) this.x0 = ax;
    if (ay < this.y0) this.y0 = ay;
    if (bx > this.x1) this.x1 = bx;
    if (by > this.y1) this.y1 = by;
    return this;
  }
  raw(s: string) { this.parts.push(s); return this; }

  /** 다른 그림판을 (dx,dy)에 왼쪽 위를 맞춰 붙인다 */
  place(sub: Canvas, dx: number, dy: number) {
    this.parts.push(`<g transform="translate(${f1(dx - sub.x0)} ${f1(dy - sub.y0)})">${sub.parts.join('')}</g>`);
    return this.grow(dx, dy, dx + sub.w, dy + sub.h);
  }
  /** 다른 그림판을 s배로 줄여(늘려) (dx,dy)에 왼쪽 위를 맞춰 붙인다 — 작은 그림(섬네일)용 */
  scaled(sub: Canvas, dx: number, dy: number, s: number) {
    this.parts.push(`<g transform="translate(${f1(dx - sub.x0 * s)} ${f1(dy - sub.y0 * s)}) scale(${s})">${sub.parts.join('')}</g>`);
    return this.grow(dx, dy, dx + sub.w * s, dy + sub.h * s);
  }

  // ── 게임 그림 ───────────────────────────────────────────────────
  /** 타일 한 칸 (실제 타일 그림) — 칸 좌표. s = 확대 배율 */
  tile(x: number, y: number, k: KindId, r = 0, o: { beats?: boolean; dim?: boolean; s?: number; shadow?: boolean } = {}) {
    return this.tilePx(x * 100, y * 100, k, r, o);
  }
  /** 타일 한 장을 화면 좌표(px) 위치에 */
  tilePx(X: number, Y: number, k: KindId, r = 0, o: { beats?: boolean; dim?: boolean; s?: number; shadow?: boolean } = {}) {
    const s = o.s ?? 1;
    const sh = o.shadow === false ? '' : `<rect class="fg-sh" x="${f1(X + 3 * s)}" y="${f1(Y + 6 * s)}" width="${f1(96 * s)}" height="${f1(96 * s)}" rx="${f1(12 * s)}"/>`;
    this.raw(`${sh}<g transform="translate(${f1(X)} ${f1(Y)})${s !== 1 ? ` scale(${s})` : ''}"${o.dim ? ' opacity=".38"' : ''}>${SKIN.tile(k, r, { beats: o.beats !== false })}</g>`);
    return this.grow(X, Y, X + 100 * s, Y + 100 * s);
  }
  /** 타일 뒷면 (주머니·손패 가리기) */
  back(X: number, Y: number, s = 1) {
    this.raw(`<g transform="translate(${f1(X)} ${f1(Y)}) scale(${s})"><rect class="fg-sh" x="3" y="6" width="96" height="96" rx="12"/><rect class="fg-back" x="2" y="2" width="96" height="96" rx="12"/><rect class="fg-back-in" x="12" y="12" width="76" height="76" rx="8"/><text class="fg-t d inv" x="50" y="59" font-size="19" text-anchor="middle">리듬</text></g>`);
    return this.grow(X, Y, X + 100 * s, Y + 100 * s);
  }
  /** 점선 후보 칸 (앱의 '놓을 수 있는 칸') */
  ghost(x: number, y: number, o: { tone?: 'acc' | 'no'; fill?: boolean } = {}) {
    this.raw(`<rect class="fg-cand${o.tone === 'no' ? ' no' : ''}" x="${x * 100 + 3}" y="${y * 100 + 3}" width="94" height="94" rx="12"/>`);
    return this.grow(x * 100, y * 100, x * 100 + 100, y * 100 + 100);
  }
  /** 칸 둘레 굵은 고리 (방금 놓은 타일 · 강조) */
  ring(x: number, y: number, tone: 'acc' | 'ok' | 'no' = 'acc', dash = false) {
    this.raw(`<rect class="fg-ring ${tone}${dash ? ' dash' : ''}" x="${x * 100 + 1}" y="${y * 100 + 1}" width="98" height="98" rx="13"/>`);
    return this.grow(x * 100 - 2, y * 100 - 2, x * 100 + 102, y * 100 + 102);
  }
  /** 이음새 위 마디줄 막대 (실제 그림) */
  bar(sk: string) {
    const b = ART.barShape(sk);
    this.raw(SKIN.bar(sk));
    return this.grow(b.cx - 14, b.cy - 30, b.cx + 14, b.cy + 30);
  }
  /** 마디줄을 꽂을 수 있는 자리 (반투명 막대 + 점선 동그라미) */
  barGhost(sk: string, tone: 'acc' | 'no' = 'acc') {
    const b = ART.barShape(sk);
    this.raw(`<g opacity="${tone === 'no' ? 0.32 : 0.55}">${SKIN.bar(sk)}</g><circle class="fg-cand${tone === 'no' ? ' no' : ''}" cx="${b.cx}" cy="${b.cy}" r="27"/>`);
    return this.grow(b.cx - 30, b.cy - 32, b.cx + 30, b.cy + 32);
  }
  /** 칸 안 지휘자 (f = 조각 번호, 's' = 지휘대) */
  meeple(x: number, y: number, k: KindId, r: number, f: number | 's', who: number | string, o: { ghost?: boolean } = {}) {
    const [ax, ay] = ART.meepleAnchor(k, r, f);
    const hex = typeof who === 'number' ? COLORS[who].hex : who;
    const fig = SKIN.meepleFigure(x * 100 + ax, y * 100 + ay, hex);
    this.raw(o.ghost ? `<g opacity=".55">${fig}</g><circle class="fg-cand" cx="${f1(x * 100 + ax)}" cy="${f1(y * 100 + ay - 14)}" r="25"/>` : fig);
    return this.grow(x * 100 + ax - 22, y * 100 + ay - 40, x * 100 + ax + 22, y * 100 + ay + 4);
  }
  /** 칸과 상관없이 아무 데나 지휘자 (발끝 위치) */
  pawn(wx: number, wy: number, who: number | string, s = 1, dim = false) {
    const hex = typeof who === 'number' ? COLORS[who].hex : who;
    this.raw(`<g transform="translate(${f1(wx)} ${f1(wy)}) scale(${s})"${dim ? ' opacity=".28"' : ''}>${SKIN.meepleFigure(0, 0, hex)}</g>`);
    return this.grow(wx - 14 * s, wy - 34 * s, wx + 14 * s, wy + 4 * s);
  }
  /** 마디줄 막대를 월드 아무 데나 (세로/가로) */
  barAt(cx: number, cy: number, vertical = true, s = 1) {
    const sk = vertical ? 'v0,0' : 'h0,0';
    const [ox, oy] = vertical ? [0, 50] : [50, 0];
    this.raw(`<g transform="translate(${f1(cx)} ${f1(cy)}) scale(${s}) translate(${-ox} ${-oy})">${SKIN.bar(sk)}</g>`);
    const hw = vertical ? 12 : 30, hh = vertical ? 30 : 12;
    return this.grow(cx - hw * s, cy - hh * s, cx + hw * s, cy + hh * s);
  }

  // ── 글자·도형 ───────────────────────────────────────────────────
  text(x: number, y: number, s: string, o: { size?: number; tone?: Tone; anchor?: 'start' | 'middle' | 'end'; display?: boolean; bold?: boolean } = {}) {
    const size = o.size ?? 17;
    const anchor = o.anchor ?? 'middle';
    const w = tw(s, size);
    const left = anchor === 'middle' ? x - w / 2 : anchor === 'start' ? x : x - w;
    this.grow(left, y - size * 0.95, left + w, y + size * 0.3);
    this.raw(`<text class="fg-t ${o.tone ?? 'ink'}${o.display ? ' d' : ''}${o.bold ? ' b' : ''}" x="${f1(x)}" y="${f1(y)}" font-size="${size}" text-anchor="${anchor}">${esc(s)}</text>`);
    return this;
  }
  /** 여러 줄 글 (줄 사이 1.35배) */
  lines(x: number, y: number, rows: string[], o: { size?: number; tone?: Tone; anchor?: 'start' | 'middle' | 'end'; display?: boolean } = {}) {
    const size = o.size ?? 17;
    rows.forEach((s, i) => this.text(x, y + i * size * 1.38, s, o));
    return this;
  }
  /** 알약 말풍선 — (x,y)는 가운데 */
  pill(x: number, y: number, s: string, o: { size?: number; tone?: 'plain' | 'acc' | 'ok' | 'no' | 'soft'; padX?: number; display?: boolean } = {}) {
    const size = o.size ?? 15;
    const w = tw(s, size) + (o.padX ?? 14) * 2;
    const h = size + 13;
    const tone = o.tone ?? 'plain';
    this.raw(`<rect class="fg-pill ${tone}" x="${f1(x - w / 2)}" y="${f1(y - h / 2)}" width="${f1(w)}" height="${f1(h)}" rx="${f1(h / 2)}"/>`
      + `<text class="fg-t pl-${tone}${o.display ? ' d' : ''}" x="${f1(x)}" y="${f1(y + size * 0.36)}" font-size="${size}" text-anchor="middle">${esc(s)}</text>`);
    this.grow(x - w / 2, y - h / 2, x + w / 2, y + h / 2);
    return w;
  }
  /** 동그라미 ✓ / ✗ / 숫자 */
  mark(x: number, y: number, kind: 'ok' | 'no', r = 13) {
    const g = kind === 'ok'
      ? '<path d="M-5.2 .4L-1.6 4.2L5.4 -3.8" fill="none" stroke="#fff" stroke-width="2.9" stroke-linecap="round" stroke-linejoin="round"/>'
      : '<path d="M-4.2 -4.2L4.2 4.2M4.2 -4.2L-4.2 4.2" fill="none" stroke="#fff" stroke-width="2.9" stroke-linecap="round"/>';
    this.raw(`<g transform="translate(${f1(x)} ${f1(y)}) scale(${r / 13})"><circle r="13" class="fg-mk ${kind}"/>${g}</g>`);
    return this.grow(x - r, y - r, x + r, y + r);
  }
  num(x: number, y: number, n: number | string, r = 13) {
    this.raw(`<circle class="fg-num" cx="${f1(x)}" cy="${f1(y)}" r="${r}"/><text class="fg-t inv d" x="${f1(x)}" y="${f1(y + r * 0.36)}" font-size="${f1(r * 1.15)}" text-anchor="middle">${n}</text>`);
    return this.grow(x - r, y - r, x + r, y + r);
  }
  /** 선 (tone·점선) */
  line(x1: number, y1: number, x2: number, y2: number, o: { tone?: Tone; dash?: boolean; w?: number } = {}) {
    this.raw(`<line class="fg-ln ${o.tone ?? 'mut'}${o.dash ? ' dash' : ''}" x1="${f1(x1)}" y1="${f1(y1)}" x2="${f1(x2)}" y2="${f1(y2)}"${o.w ? ` style="stroke-width:${o.w}px"` : ''}/>`);
    return this.grow(Math.min(x1, x2) - 2, Math.min(y1, y2) - 2, Math.max(x1, x2) + 2, Math.max(y1, y2) + 2);
  }
  /** 화살표 (곧은 선 또는 bend만큼 휜 선) */
  arrow(x1: number, y1: number, x2: number, y2: number, o: { tone?: Tone; dash?: boolean; bend?: number; head?: number } = {}) {
    const head = o.head ?? 9;
    const dx = x2 - x1, dy = y2 - y1;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len, ny = dx / len;
    const bend = o.bend ?? 0;
    const cx = (x1 + x2) / 2 + nx * bend, cy = (y1 + y2) / 2 + ny * bend;
    // 끝 방향 = 제어점 → 끝점
    const tx = bend ? x2 - cx : dx, ty = bend ? y2 - cy : dy;
    const tl = Math.hypot(tx, ty) || 1;
    const ux = tx / tl, uy = ty / tl;
    const bx = x2 - ux * head, by = y2 - uy * head;
    const d = bend ? `M${f1(x1)} ${f1(y1)}Q${f1(cx)} ${f1(cy)} ${f1(bx)} ${f1(by)}` : `M${f1(x1)} ${f1(y1)}L${f1(bx)} ${f1(by)}`;
    const tone = o.tone ?? 'mut';
    this.raw(`<path class="fg-ln ${tone}${o.dash ? ' dash' : ''}" d="${d}"/>`
      + `<path class="fg-hd ${tone}" d="M${f1(x2)} ${f1(y2)}L${f1(bx - uy * head * 0.62)} ${f1(by + ux * head * 0.62)}L${f1(bx + uy * head * 0.62)} ${f1(by - ux * head * 0.62)}Z"/>`);
    return this.grow(Math.min(x1, x2, cx) - 4, Math.min(y1, y2, cy) - 4, Math.max(x1, x2, cx) + 4, Math.max(y1, y2, cy) + 4);
  }
  /** 가리킴선 (끝에 점) */
  lead(x1: number, y1: number, x2: number, y2: number, tone: Tone = 'mut') {
    this.raw(`<line class="fg-ln ${tone}" x1="${f1(x1)}" y1="${f1(y1)}" x2="${f1(x2)}" y2="${f1(y2)}"/><circle class="fg-dot ${tone}" cx="${f1(x2)}" cy="${f1(y2)}" r="4.2"/>`);
    return this.grow(Math.min(x1, x2) - 5, Math.min(y1, y2) - 5, Math.max(x1, x2) + 5, Math.max(y1, y2) + 5);
  }
  /** 가로 괄호 (한 마디를 묶는 표시). up이면 위쪽에 */
  bracket(xa: number, xb: number, y: number, label: string, o: { up?: boolean; tone?: Tone; size?: number } = {}) {
    const d = o.up ? -1 : 1;
    const tone = o.tone ?? 'acc';
    this.raw(`<path class="fg-br ${tone}" d="M${f1(xa)} ${f1(y - 8 * d)}V${f1(y)}H${f1(xb)}V${f1(y - 8 * d)}"/>`);
    this.grow(xa, Math.min(y, y - 8 * d), xb, Math.max(y, y - 8 * d));
    const size = o.size ?? 17;
    if (label) this.text((xa + xb) / 2, o.up ? y - 11 : y + size + 6, label, { size, tone, bold: true });
    return this;
  }
  /** 직사각형 */
  rect(x: number, y: number, w: number, h: number, cls: string, rx = 12) {
    this.raw(`<rect class="${cls}" x="${f1(x)}" y="${f1(y)}" width="${f1(w)}" height="${f1(h)}" rx="${rx}"/>`);
    return this.grow(x, y, x + w, y + h);
  }
  /** 한 마디 영역 띠 (타일 뒤에 먼저 깔기) */
  band(xa: number, xb: number, y: number, tone: 'acc' | 'ok' | 'no' = 'acc') {
    return this.rect(xa, y * 100 - 4, xb - xa, 108, `fg-band ${tone}`, 16);
  }
  /** 1 + 2 + 1 = 4박 식 (색 칩). (cx,y)는 가운데·세로 중심 */
  eqn(cx: number, y: number, terms: Term[], o: { sum: number; target?: number; ok?: boolean; size?: number; noRes?: boolean } = { sum: 0 }) {
    const h = 34;
    const chip = (t: Term) => {
      const lab = t.rest ? `(${fb(t.b)})` : fb(t.b);
      return { lab, w: Math.max(36, tw(lab, 19) + 18) };
    };
    const chips = terms.map(chip);
    const opW = 24;
    const ok = o.ok ?? (o.target == null ? true : o.sum === o.target);
    const resLab = `= ${fb(o.sum)}박`;
    const resW = o.noRes ? 0 : tw(resLab, 24) + 40;
    const total = chips.reduce((a, c) => a + c.w, 0) + (chips.length - 1) * opW + (o.noRes ? 0 : 10 + resW);
    let x = cx - total / 2;
    chips.forEach((c, i) => {
      const t = terms[i];
      if (i > 0) { this.text(x + opW / 2, y + 7, t.rest ? '+' : '+', { size: 20, tone: 'mut', display: true }); x += opW; }
      this.raw(`<rect class="fg-chip${t.rest ? ' rest' : ''}" x="${f1(x)}" y="${f1(y - h / 2)}" width="${f1(c.w)}" height="${h}" rx="9" fill="${ART.tileColor(t.k)}"/>`
        + `<text class="fg-t d" x="${f1(x + c.w / 2)}" y="${f1(y + 7)}" font-size="19" text-anchor="middle" fill="${ART.labelInk(t.k)}">${c.lab}</text>`);
      this.grow(x, y - h / 2, x + c.w, y + h / 2);
      x += c.w;
    });
    if (!o.noRes) {
      x += 10;
      this.text(x, y + 8, resLab, { size: 24, tone: ok ? 'ok' : 'no', anchor: 'start', display: true });
      this.mark(x + tw(resLab, 24) + 20, y, ok ? 'ok' : 'no', 12);
    }
    return this;
  }
  /** 점수 팝업 (+6점) */
  pop(x: number, y: number, s: string, tone: 'acc' | 'no' | 'soft' = 'acc', size = 22) {
    return this.pill(x, y, s, { size, tone, display: true, padX: 16 });
  }

  done(alt: string, pad = 16): Fig {
    return { vb: [f1(this.x0 - pad), f1(this.y0 - pad), f1(this.w + pad * 2), f1(this.h + pad * 2)], body: this.parts.join(''), alt };
  }
}

// ═════════ 엔진 장면 도우미 (삽화를 엔진 상태에서 그리고 테스트가 같은 상태로 숫자를 검증) ═════════
export const P1 = 0, P2 = 1;
/** 빈 2인 게임 (시작 타일만 놓인 상태). 손패 1장씩만 두어 차례가 이어지게 한다 */
export function newScene(level: R.LevelId = 1): R.State {
  const st = R.newGame({ players: [{ name: '빨강', type: 'human', color: 0 }, { name: '파랑', type: 'human', color: 1 }], level, set: 'mvp', seed: 11 });
  st.bag = [];
  st.hands = [['q-s'], ['q-s']];
  return st;
}
export function put(st: R.State, x: number, y: number, k: KindId, r = 0) {
  st.serial++;
  st.board[R.cellKey(x, y)] = { k, r, n: st.serial, p: null };
  if (R.kindOf(k).shape === 'timesig') st.ts++;
}
export function putBar(st: R.State, sk: string) {
  st.bars[sk] = { p: 0, t: 0 };
  st.barsLeft--;
}
export function putConductor(st: R.State, p: number, x: number, y: number, f: number | 's') {
  st.meeples.push({ p, x, y, f, t: 0 });
  st.players[p].meeples--;
}
/** 한 차례 진행: 타일 놓기 → (지휘자) → (마디줄) → 정산. 이번 차례 엔진 사건을 돌려준다 */
export function play(st: R.State, k: KindId, x: number, y: number, r: number, o: { conductor?: number | 's'; bar?: string; resolve?: boolean } = {}): R.GameEvent[] {
  const p = st.turn.p;
  st.hands[p] = [k, 'q-s'];
  R.applyPlace(st, 0, x, y, r);
  if (o.conductor != null) R.applyConductor(st, { x, y, f: o.conductor });
  if (o.bar) R.applyBar(st, o.bar);
  return o.resolve === false ? [] : R.endTurn(st);
}
/** 놓는 순간까지만 (정산 전) — 후보 자리를 계산할 때 */
export function placeOnly(st: R.State, k: KindId, x: number, y: number, r: number) {
  const p = st.turn.p;
  st.hands[p] = [k, 'q-s'];
  R.applyPlace(st, 0, x, y, r);
}
/** 맞닿은 모든 변이 규칙에 맞는지 (장면 설계 검사용) */
export function edgesConsistent(st: R.State): boolean {
  for (const [ck, t] of Object.entries(st.board)) {
    const [x, y] = ck.split(',').map(Number);
    for (let d = 0; d < 4; d++) {
      const nt = R.tileAt(st, x + R.DXY[d][0], y + R.DXY[d][1]);
      if (nt && R.geomOf(nt).edges[R.opp(d)] !== R.geomOf(t).edges[d]) return false;
    }
  }
  return true;
}

/** 엔진 상태의 타일·마디줄·지휘자를 그림판에 */
export function drawState(c: Canvas, st: R.State, o: { beats?: boolean; hideMeeples?: boolean } = {}) {
  for (const [ck, t] of Object.entries(st.board)) {
    const [x, y] = ck.split(',').map(Number);
    c.tile(x, y, t.k, t.r, { beats: o.beats });
  }
  for (const sk of Object.keys(st.bars)) c.bar(sk);
  if (!o.hideMeeples) {
    for (const m of st.meeples) {
      const t = st.board[R.cellKey(m.x, m.y)];
      if (t) c.meeple(m.x, m.y, t.k, t.r, m.f, st.cfg.players[m.p].color ?? m.p);
    }
  }
}
/** 시작 타일을 치우고 빈 판으로 (시작 타일이 필요 없는 장면용) */
export function clearBoard(st: R.State) { st.board = {}; st.serial = 0; st.ts = 0; }

/** (x,y)의 pi번 조각이 속한 마디의 식·점수 (엔진 값) */
export function measureInfo(st: R.State, x: number, y: number, pi = 0) {
  const seg = R.segmentOf(st, x, y, pi);
  const order = R.orderPieces(st, seg).filter((o) => o.note || o.rest);
  const targets = R.targetsOf(st, seg);
  const ok = targets.includes(seg.sum);
  return {
    seg, targets, ok,
    terms: order.map((o) => ({ b: o.beats, k: o.k, rest: o.rest })) as Term[],
    sum: seg.sum, notes: seg.notes, rests: seg.rests,
    points: ok ? seg.notes * 2 + seg.rests : 0,
    target: ok ? seg.sum : targets[0],
  };
}

export { CARD, VG };
