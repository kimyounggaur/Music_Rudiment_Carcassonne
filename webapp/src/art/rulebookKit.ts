/* 룰북 삽화 공통 도구: 장면을 쌓고 나란히 놓는 레이아웃, 한 줄 장면, 마디 정산 표기, 박자 자 */
import * as R from '../engine/engine';
import type { KindId } from '../engine/engine';
import * as ART from './tiles';
import { Canvas, newScene, put, putBar, putConductor, clearBoard, measureInfo, tw, type Term } from './rulebook';

export const fb = ART.fmtBeats;
export const T = (b: number, k: KindId, rest = false): Term => ({ b, k, rest });
/** 박자값 → 대표 타일 (식의 색 칩용) */
export const KIND_OF_BEATS: Record<number, KindId> = { 4: 'w-s', 3: 'dh-s', 2: 'h-s', 1: 'q-s', 0.5: 'e-s', 1.5: 'dq-s' };

// ═════════ 레이아웃 도우미 ═════════
export interface Panel { c: Canvas; title?: string; sub?: string; mark?: 'ok' | 'no' }
/** 장면을 위에서 아래로 쌓고, 각 장면 위에 제목줄(✓/✗ + 제목 + 보충) */
export function stack(panels: Panel[], o: { gap?: number } = {}): Canvas {
  const out = new Canvas();
  const gap = o.gap ?? 40;
  const W = Math.max(...panels.map((p) => p.c.w));
  let y = 0;
  panels.forEach((p, i) => {
    let hy = y;
    if (p.title || p.mark) {
      const x = p.mark ? 32 : 0;
      if (p.mark) out.mark(13, y + 10, p.mark, 13);
      out.text(x, y + 16, p.title ?? '', { size: 18, anchor: 'start', bold: true, tone: p.mark === 'no' ? 'no' : 'ink' });
      if (p.sub) out.text(x, y + 40, p.sub, { size: 15, anchor: 'start', tone: 'mut' });
      hy = y + (p.sub ? 62 : 40);
    }
    out.place(p.c, 0, hy);
    y = hy + p.c.h + gap;
    if (i < panels.length - 1) out.line(0, y - gap / 2, W, y - gap / 2, { dash: true });
  });
  return out;
}

export interface Row { c: Canvas; cap: string[]; mark?: 'ok' | 'no' }
/** 왼쪽 장면 + 오른쪽 설명 줄들 */
export function sideRows(rows: Row[], o: { size?: number; gap?: number } = {}): Canvas {
  const out = new Canvas();
  const size = o.size ?? 16, gap = o.gap ?? 30, lh = size * 1.42;
  const wMax = Math.max(...rows.map((r) => r.c.w));
  const capW = Math.max(...rows.flatMap((r) => r.cap.map((s) => tw(s, size))));
  const W = wMax + 66 + capW;
  let y = 0;
  rows.forEach((r, i) => {
    const h = Math.max(r.c.h, r.cap.length * lh + 6);
    out.place(r.c, 0, y + (h - r.c.h) / 2);
    const cy = y + h / 2;
    const tx = wMax + 32 + (r.mark ? 30 : 0);
    if (r.mark) out.mark(wMax + 45, cy, r.mark, 13);
    r.cap.forEach((s, j) => out.text(tx, cy - ((r.cap.length - 1) * lh) / 2 + j * lh + size * 0.35, s, {
      size: j === 0 ? size + 1 : size - 1, anchor: 'start', bold: j === 0, tone: j === 0 ? (r.mark === 'no' ? 'no' : 'ink') : 'mut',
    }));
    y += h + gap;
    if (i < rows.length - 1) out.line(0, y - gap / 2, W, y - gap / 2, { dash: true });
  });
  return out;
}

/** 한 줄 장면: 타일을 x=0.. 가로로 놓고 양끝에 마디줄(선택). 엔진 상태를 돌려준다 */
export function lineScene(kinds: Array<KindId | [KindId, number]>, o: { barL?: boolean; barR?: boolean; conductors?: Array<[number, number]> } = {}) {
  const st = newScene();
  clearBoard(st);
  kinds.forEach((k, i) => { const [kk, r] = Array.isArray(k) ? k : [k, 0]; put(st, i, 0, kk, r); });
  if (o.barL) putBar(st, 'v0,0');
  if (o.barR) putBar(st, `v${kinds.length},0`);
  (o.conductors ?? []).forEach(([i, p]) => putConductor(st, p, i, 0, 0));
  return st;
}

/** 마디 아래 괄호·식·점수 (엔진이 계산한 값). 타일 줄 위치 y(칸), 구간 span(월드 x) */
export function settleNote(c: Canvas, st: R.State, cell: [number, number], span: [number, number], o: { row?: number; label?: string; hideBracket?: boolean; pop?: boolean } = {}) {
  const info = measureInfo(st, cell[0], cell[1]);
  const base = (o.row ?? 0) * 100 + 100;
  const cx = (span[0] + span[1]) / 2;
  if (!o.hideBracket) c.bracket(span[0], span[1], base + 20, o.label ?? '한 마디', { tone: info.ok ? 'acc' : 'no' });
  c.eqn(cx, base + 88, info.terms, { sum: info.sum, ok: info.ok });
  let y = base + 134;
  if (!info.ok) { c.text(cx, y, `목표 ${fb(info.target)}박이 아니라서`, { size: 15, tone: 'mut' }); y += 30; }
  if (o.pop !== false) {
    const why = info.ok
      ? `음표 ${info.notes}장 × 2점${info.rests ? ` + 쉼표 ${info.rests}장 × 1점` : ''}`
      : '틀린 마디';
    const popLabel = info.ok ? `+${info.points}점` : '0점';
    const w = c.pop(cx, y + 6, popLabel, info.ok ? 'acc' : 'no');
    c.text(cx + w / 2 + 14, y + 12, why, { size: 15, tone: 'mut', anchor: 'start' });
  }
  return info;
}

/** 박자 자: 칸 눈금 위에 음표 길이를 막대로 */
export function ruler(kinds: KindId[], units: number, o: { u?: number; names?: string[] } = {}): Canvas {
  const c = new Canvas();
  const u = o.u ?? 72, x0 = 168, rowH = 98, ts = 0.82;
  for (let i = 1; i <= units; i++) c.text(x0 + (i - 0.5) * u, -14, String(i), { size: 18, tone: 'mut', display: true });
  // 눈금선은 막대 뒤에 깔아서, 긴 박자 막대 글자를 가로지르지 않게 한다
  const H = (kinds.length - 1) * rowH + ts * 100;
  for (let i = 0; i <= units; i++) c.line(x0 + i * u, -2, x0 + i * u, H + 4, { dash: true, w: 1.6 });
  kinds.forEach((k, i) => {
    const y = i * rowH;
    const K = R.kindOf(k);
    const sym = R.SYMBOLS[K.sym!];
    c.tilePx(0, y, k, 0, { s: ts });
    c.text(98, y + 38, sym.name, { size: 15, anchor: 'start', bold: true });
    c.text(98, y + 60, sym.rest ? '쉼표' : '음표', { size: 14, anchor: 'start', tone: 'mut' });
    const w = sym.beats * u;
    const bh = 56, by = y + (ts * 100 - bh) / 2 + 2;
    c.raw(`<rect class="fg-bar${sym.rest ? ' rest' : ''}" x="${x0}" y="${by}" width="${w}" height="${bh}" rx="12" fill="${ART.tileColor(k)}"/>`);
    c.grow(x0, by, x0 + w, by + bh);
    for (let b = 1; b < sym.beats - 1e-9; b++) {
      if (b % 1 === 0) { c.line(x0 + b * u, by + 3, x0 + b * u, by + 14, { tone: 'mut', w: 2 }); c.line(x0 + b * u, by + bh - 14, x0 + b * u, by + bh - 3, { tone: 'mut', w: 2 }); }
    }
    const lab = `${fb(sym.beats)}박`;
    c.raw(`<text class="fg-t d" x="${x0 + w / 2}" y="${by + bh / 2 + 8}" font-size="${sym.beats < 1 ? 18 : 24}" text-anchor="middle" fill="${ART.labelInk(k)}">${lab}</text>`);
  });
  return c;
}

