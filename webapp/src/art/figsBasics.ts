/* 룰북 삽화 — 0~3장: 소개·구성물·박자값·타일 붙이기 */
import * as R from '../engine/engine';
import type { KindId } from '../engine/engine';
import * as ART from './tiles';
import { COLORS } from '../game/colors';
import { Canvas, newScene, put, putBar, putConductor, drawState, tw, type Fig } from './rulebook';
import { fb, KIND_OF_BEATS, sideRows, lineScene, settleNote, ruler, type Row } from './rulebookKit';

// ═════════ 0장 · 소개 ═════════
export function introLoop(): Fig {
  const st = lineScene(['q-s', 'h-s', 'q-s'], {});
  // 시작 타일(0,0)을 앞에 붙인 한 줄: start | 1박 | 2박 | 1박 ‖
  const s2 = newScene();
  put(s2, 1, 0, 'q-s'); put(s2, 2, 0, 'h-s'); put(s2, 3, 0, 'q-s');
  putConductor(s2, 0, 1, 0, 0);
  putBar(s2, 'v4,0');
  void st;
  const c = new Canvas();
  c.band(50, 400, 0);
  drawState(c, s2);
  c.text(50, -30, '시작 타일 · 4/4', { size: 15, tone: 'mut' });
  c.lead(50, -20, 50, 4);
  const [ax, ay] = ART.meepleAnchor('q-s', 0, 0);
  c.text(150, -30, '지휘자', { size: 15, tone: 'mut' });
  c.lead(150, -20, 100 + ax, ay - 34);
  c.text(392, -30, '마디줄 막대', { size: 15, tone: 'mut' });
  c.lead(400, -20, 400, 22);
  settleNote(c, s2, [1, 0], [50, 400]);
  return c.done('시작 타일 오른쪽에 4분음표, 2분음표, 4분음표를 이어 놓고 마디줄 막대로 닫으면 1+2+1=4박이라 음표 3장 × 2점 = 6점을 받는 한 마디');
}

// ═════════ 1장 · 구성물 ═════════
export function partsAnatomy(): Fig {
  const c = new Canvas();
  const s = 1.8;
  c.tilePx(0, 0, 'q-s', 0, { s });
  // 번호 표시: 바깥에서 가리킴선
  c.num(-30, 90, 1); c.lead(-18, 90, 6, 90, 'acc');
  c.num(90, 232, 2); c.lead(90, 220, 90, 112, 'acc');
  c.num(90, -30, 3); c.lead(90, -18, 90, 6, 'acc');
  c.num(210, 90, 1); c.lead(198, 90, 174, 90, 'acc');
  const L = (y: number, n: number, t: string, sub: string) => {
    c.num(250, y, n);
    c.text(274, y + 6, t, { size: 18, anchor: 'start', bold: true });
    c.text(274, y + 30, sub, { size: 15, anchor: 'start', tone: 'mut' });
  };
  L(40, 1, '리듬선 변', '길(리듬선)이 닿는 변');
  L(112, 2, '음표 · 박자값', '모서리 숫자는 몇 박인지');
  L(184, 3, '배경 변', '길이 닿지 않는 변');
  return c.done('4분음표 직선 타일: 마주 보는 두 변은 리듬선 변, 나머지 두 변은 배경 변이고 가운데에 음표가 있다');
}

export function partsKinds(): Fig {
  const c = new Canvas();
  const pitch = 136;
  const items: Array<{ k: KindId; r: number; cap: [string, string] }> = [
    { k: 'q-s', r: 0, cap: ['직선', '마주 보는 두 변'] },
    { k: 'q-c', r: 0, cap: ['곡선', '이웃한 두 변'] },
    { k: 'stand', r: 0, cap: ['지휘대', '네 변 모두 배경'] },
    { k: 'stand-thru', r: 0, cap: ['지휘대(통과)', '리듬선이 지나가요'] },
    { k: 'start', r: 0, cap: ['시작 타일', '4/4 · 가운데 마디줄'] },
    { k: 'qr', r: 0, cap: ['쉼표 · Lv2', '쉬는 박도 세어요'] },
    { k: 'ts34', r: 0, cap: ['3/4 박자표 · Lv2', '가운데가 마디줄'] },
    { k: 'ts24', r: 0, cap: ['2/4 박자표 · Lv2', '숫자 쪽이 2박'] },
  ];
  items.forEach((it, i) => {
    const col = i % 4, row = Math.floor(i / 4);
    const x = col * pitch, y = row * 176;
    c.tilePx(x, y, it.k, it.r);
    c.text(x + 50, y + 128, it.cap[0], { size: 15.5, bold: true });
    c.text(x + 50, y + 148, it.cap[1], { size: 13.5, tone: 'mut' });
  });
  return c.done('타일 종류: 음표 직선·곡선, 지휘대(독립·통과), 시작 타일, Lv2에서 더해지는 쉼표와 박자표 타일');
}

export function partsTokens(): Fig {
  const c = new Canvas();
  c.text(0, -8, '지휘자 — 사람마다 6개, 내 색', { size: 17, anchor: 'start', bold: true });
  COLORS.forEach((col, i) => {
    const x = 46 + i * 92;
    c.pawn(x, 82, i, 2.1);
    c.text(x, 112, col.name, { size: 15, tone: 'mut' });
  });
  c.text(0, 170, '마디줄 막대 — 모두가 같이 쓰는 공용 부품', { size: 17, anchor: 'start', bold: true });
  [0, 1, 2].forEach((i) => c.barAt(40 + i * 30, 238, true, 1.6));
  c.text(150, 232, '정해진 주인이 없어요', { size: 16, anchor: 'start' });
  c.text(150, 256, '꽂은 뒤에도 보드에 남아 다음 마디의 경계가 돼요', { size: 14, anchor: 'start', tone: 'mut' });
  return c.done('지휘자는 빨강·파랑·초록·검정 네 가지 색이고, 마디줄 막대는 색 없이 모두가 함께 쓴다');
}

export function partsCounts(): Fig {
  const c = new Canvas();
  const sets: R.SetId[] = ['mvp', 'full'];
  let y = 0;
  sets.forEach((sid) => {
    const S = R.SETS[sid];
    const tiles = Object.entries(S.tiles) as [KindId, number][];
    const total = 1 + tiles.reduce((a, [, n]) => a + n, 0);
    c.text(0, y + 6, `${S.label.replace(/\s*\d+장$/, '')} ${total}장`, { size: 19, anchor: 'start', bold: true });
    c.pill(tw(`${S.label.replace(/\s*\d+장$/, '')} ${total}장`, 19) + 78, y, `마디줄 막대 ${S.bars}개`, { size: 14, tone: 'soft' });
    const items: Array<[KindId, number]> = [...tiles, ['start', 1]];
    items.forEach(([k, n], i) => {
      const col = i % 5, row = Math.floor(i / 5);
      const x = col * 92, ty = y + 26 + row * 108;
      c.tilePx(x, ty, k, 0, { s: 0.68 });
      c.text(x + 34, ty + 90, `×${n}`, { size: 17, display: true });
    });
    y += 26 + Math.ceil(items.length / 5) * 108 + 36;
  });
  return c.done('타일 수량: MVP 40장 세트와 완전판 72장 세트의 종류별 장수와 마디줄 막대 수');
}

// ═════════ 2장 · 박자값 ═════════
export function beatsRuler(): Fig {
  const c = ruler(['w-s', 'dh-s', 'h-s', 'q-s'], 4);
  return c.done('박자 자: 온음표 4박, 점2분음표 3박, 2분음표 2박, 4분음표 1박을 박 눈금 위에 막대로 나란히 그린 그림');
}

export function beatsMake4(): Fig {
  const c = new Canvas();
  const combos = [[1, 1, 1, 1], [1, 1, 2], [1, 2, 1], [2, 1, 1], [2, 2], [1, 3], [3, 1], [4]];
  const u = 52, rowH = 46;
  c.text(0, -14, '4박을 만드는 여덟 가지', { size: 17, anchor: 'start', bold: true });
  c.text(262, -14, '음표 수 → 점수', { size: 15, anchor: 'start', tone: 'mut' });
  combos.forEach((cb, i) => {
    const y = 14 + i * rowH;
    let x = 0;
    cb.forEach((b) => {
      const k = KIND_OF_BEATS[b];
      c.raw(`<rect class="fg-chip" x="${x}" y="${y}" width="${b * u - 5}" height="34" rx="9" fill="${ART.tileColor(k)}"/><text class="fg-t d" x="${x + (b * u - 5) / 2}" y="${y + 24}" font-size="19" text-anchor="middle" fill="${ART.labelInk(k)}">${b}</text>`);
      c.grow(x, y, x + b * u - 5, y + 34);
      x += b * u;
    });
    c.text(262, y + 24, `${cb.length}장 → ${cb.length * 2}점`, { size: 17, anchor: 'start', tone: cb.length >= 3 ? 'acc' : 'ink', bold: cb.length >= 3 });
  });
  c.line(0, 4, 4 * u - 5, 4, { dash: true, w: 1.4 });
  return c.done('합이 4박이 되는 여덟 가지 조합. 음표 장수가 많을수록 장당 2점이 곱해져 점수가 커진다');
}

// ═════════ 3장 · 타일 붙이기 ═════════
export function edgeRule(): Fig {
  const mk = (a: [KindId, number], b: [KindId, number], good: boolean) => {
    const c = new Canvas();
    c.tile(0, 0, a[0], a[1]); c.tile(1, 0, b[0], b[1]);
    c.line(100, 12, 100, 88, { tone: good ? 'ok' : 'no', w: 6 });
    return c;
  };
  const rows: Row[] = [
    { c: mk(['q-s', 0], ['h-s', 0], true), mark: 'ok', cap: ['리듬선 변 ↔ 리듬선 변', '길이 끊김 없이 이어져요'] },
    { c: mk(['q-s', 1], ['h-s', 1], true), mark: 'ok', cap: ['배경 변 ↔ 배경 변', '그림이 안 맞아도 돼요'] },
    { c: mk(['q-s', 0], ['h-s', 1], false), mark: 'no', cap: ['리듬선 변 ↔ 배경 변', '길을 막아 버려서 안 돼요'] },
  ];
  return sideRows(rows).done('타일 두 장이 맞닿는 세 경우: 리듬선끼리와 배경끼리는 허용, 리듬선과 배경이 맞닿는 것은 금지');
}

export function edgeCorner(): Fig {
  const c = new Canvas();
  const A = new Canvas();
  A.tile(0, 0, 'h-s', 0); A.tile(1, 1, 'q-s', 0, { dim: true }); A.ring(1, 1, 'no', true);
  A.raw('<circle class="fg-dot no" cx="100" cy="100" r="7"/>');
  const B = new Canvas();
  B.tile(0, 0, 'h-s', 0); B.tile(1, 0, 'q-s', 0); B.line(100, 12, 100, 88, { tone: 'ok', w: 6 });
  c.place(A, 0, 0); c.place(B, 290, 0);
  c.mark(104, 232, 'no'); c.text(128, 238, '꼭짓점만 닿으면 안 돼요', { size: 16, anchor: 'start', bold: true, tone: 'no' });
  c.mark(394, 232, 'ok'); c.text(418, 238, '한 변 이상 맞닿기', { size: 16, anchor: 'start', bold: true });
  return c.done('새 타일은 기존 타일과 꼭짓점만 닿으면 안 되고 최소 한 변이 맞닿아야 한다');
}

export function edgeRotate(): Fig {
  const c = new Canvas();
  const curves = R.ROTATIONS['q-c'];
  const straights = R.ROTATIONS['q-s'];
  c.text(0, -12, `곡선 타일 — ${curves.length}가지 방향`, { size: 17, anchor: 'start', bold: true });
  curves.forEach((r, i) => {
    const x = i * 140;
    c.tilePx(x, 6, 'q-c', r);
    c.text(x + 50, 136, `${r * 90}°`, { size: 15, tone: 'mut', display: true });
    if (i < curves.length - 1) c.arrow(x + 108, 56, x + 132, 56, { bend: -9, tone: 'acc' });
  });
  c.text(0, 200, `직선 타일 — ${straights.length}가지 방향`, { size: 17, anchor: 'start', bold: true });
  straights.forEach((r, i) => {
    const x = i * 140;
    c.tilePx(x, 218, 'q-s', r);
    c.text(x + 50, 348, `${r * 90}°`, { size: 15, tone: 'mut', display: true });
    if (i < straights.length - 1) c.arrow(x + 108, 268, x + 132, 268, { bend: -9, tone: 'acc' });
  });
  c.pill(404, 268, 'R 키 · [돌리기] 버튼', { size: 15, tone: 'soft' });
  c.text(404, 304, '직선은 180°가 같은 모양이라', { size: 14, tone: 'mut' });
  c.text(404, 324, '두 방향만 보여요', { size: 14, tone: 'mut' });
  return c.done('곡선 타일은 0도 90도 180도 270도 네 방향, 직선 타일은 0도와 90도 두 방향으로 놓을 수 있다');
}

export function edgeFit(): Fig {
  const mk = (r: number) => {
    const c = new Canvas();
    c.tile(0, 1, 'q-s', 1);
    c.tile(0, 0, 'h-s', r, { dim: r === 0 });
    c.line(12, 100, 88, 100, { tone: r === 0 ? 'no' : 'ok', w: 6 });
    if (r === 0) c.ring(0, 0, 'no', true); else c.ring(0, 0, 'ok');
    return c;
  };
  const c = new Canvas();
  c.place(mk(0), 0, 0); c.place(mk(1), 250, 0);
  c.arrow(128, 100, 214, 100, { tone: 'acc', bend: -14 });
  c.pill(171, 66, '돌리기', { size: 15, tone: 'soft' });
  c.mark(50, 236, 'no'); c.text(50, 270, '길이 막혀요', { size: 15, tone: 'no', bold: true });
  c.mark(300, 236, 'ok'); c.text(300, 270, '돌리니까 이어져요', { size: 15, tone: 'ok', bold: true });
  return c.done('위쪽으로 리듬선이 열린 타일 위에 직선 타일을 가로로 놓으면 길이 막히지만, 90도 돌려 세로로 놓으면 이어진다');
}

export function edgeOpen(): Fig {
  const st = newScene();
  put(st, 1, 0, 'q-s'); put(st, 2, 0, 'h-s');
  const c = new Canvas();
  drawState(c, st);
  c.ghost(3, 0);
  c.arrow(354, 130, 354, 108, { tone: 'acc' });
  c.text(354, 154, '열린 끝', { size: 17, tone: 'acc', bold: true });
  c.text(354, 176, '나중에 누군가', { size: 14, tone: 'mut' });
  c.text(354, 194, '이어 붙여요', { size: 14, tone: 'mut' });
  c.bracket(50, 300, 126, '아직 열려 있는 마디 (지금 3박)', { tone: 'mut', size: 16 });
  return c.done('시작 타일 오른쪽으로 4분음표와 2분음표가 이어져 있고 그 오른쪽 끝은 빈 칸을 향해 열려 있다');
}

export function edgeNoFork(): Fig {
  const c = new Canvas();
  // 사거리 타일 그림 (없는 타일)
  c.raw('<g><rect class="fg-sh" x="3" y="6" width="96" height="96" rx="12"/><rect class="fg-nofork" x="2" y="2" width="96" height="96" rx="12"/>'
    + '<path d="M50 6V94M6 50H94" stroke="#FFFDF7" stroke-width="15" stroke-linecap="butt"/></g>');
  c.grow(0, 0, 100, 100);
  c.tile(2, 0, 'q-s', 0); c.tile(3, 0, 'q-c', 0);
  c.mark(50, 138, 'no'); c.mark(298, 138, 'ok');
  c.text(50, 176, '사거리·갈림길', { size: 15, tone: 'no', bold: true });
  c.text(50, 196, '타일은 없어요', { size: 15, tone: 'no', bold: true });
  c.text(298, 176, '리듬선 변은 딱 2개', { size: 15, bold: true });
  c.text(298, 196, '한 마디는 늘 한 줄', { size: 14, tone: 'mut' });
  return c.done('리듬선이 네 방향으로 갈라지는 사거리 타일은 없고, 모든 음표 타일은 리듬선 변이 정확히 두 개다');
}

