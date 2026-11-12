/* 룰북 삽화 — 4~7장: 게임 준비 · 한 차례 · 점수 · 게임 끝 */
import * as R from '../engine/engine';
import type { KindId } from '../engine/engine';
import * as ART from './tiles';
import { COLORS } from '../game/colors';
import { Canvas, newScene, put, putBar, putConductor, play, placeOnly, clearBoard, drawState, tw, P1, P2, type Fig } from './rulebook';
import { fb, T, sideRows, stack, lineScene, settleNote, type Row } from './rulebookKit';
import { measureInfo } from './rulebook';

/** 지휘대 둘레를 8칸으로 두른 모양 (모든 맞닿는 변이 맞는 실제 배치). 마지막 칸은 SCORE_LAST */
export const STAND_RING: Array<[number, number, KindId, number]> = [
  [-1, -1, 'q-s', 0], [0, -1, 'h-s', 0], [1, -1, 'q-s', 0],
  [-1, 0, 'q-c', 0], [1, 0, 'q-c', 3],
  [-1, 1, 'q-c', 2], [0, 1, 'h-s', 0], [1, 1, 'q-c', 1],
];
export const STAND_LAST = 7;

/** 지휘대 둘레 장면 (마지막 칸 전까지 놓인 상태, 지휘대 위 지휘자 포함) */
export function standScene(upTo = STAND_LAST): R.State {
  const st = newScene();
  clearBoard(st);
  put(st, 0, 0, 'stand');
  STAND_RING.slice(0, upTo).forEach(([x, y, k, r]) => put(st, x, y, k, r));
  putConductor(st, P1, 0, 0, 's');
  return st;
}

/** 샘플 플레이 첫 단계들 (설계서 13장): 상태 + 사건 */
export function sampleRun(wrong = false) {
  const st = newScene();
  const steps: { st: R.State; ev: R.GameEvent[] }[] = [];
  const snap = () => R.clone(st);
  // ① 빨강: 4분음표 + 지휘자
  let ev = play(st, 'q-s', 1, 0, 0, { conductor: 0 });
  steps.push({ st: snap(), ev });
  // ② 파랑: 2분음표
  ev = play(st, 'h-s', 2, 0, 0);
  steps.push({ st: snap(), ev });
  // ③ 빨강: 마지막 음표 + 마디줄 (정산 전)
  const pre = R.clone(st);
  placeOnly(pre, wrong ? 'h-s' : 'q-s', 3, 0, 0);
  R.applyBar(pre, 'v4,0');
  steps.push({ st: pre, ev: [] });
  // ④ 정산 뒤
  ev = play(st, wrong ? 'h-s' : 'q-s', 3, 0, 0, { bar: 'v4,0' });
  steps.push({ st: snap(), ev });
  return steps;
}

// ═════════ 4장 · 게임 준비 ═════════
export function setupTable(): Fig {
  const c = new Canvas();
  c.rect(0, 0, 620, 440, 'fg-felt', 26);
  // 점수판: 눈금 숫자 아래 줄에 두 사람의 점수 말(0점에서 출발)
  c.rect(112, 14, 420, 62, 'fg-surf', 12);
  ['0', '1', '2', '3', '4', '5', '6', '7', '…', '50'].forEach((s, i) => c.text(140 + i * 40, 38, s, { size: 15, tone: 'mut', display: true }));
  c.line(124, 47, 520, 47, { tone: 'mut', w: 1.4 });
  [0, 1].forEach((p) => c.raw(`<circle cx="${133 + p * 15}" cy="62" r="6.5" fill="${COLORS[p].hex}" stroke="#fff" stroke-width="1.5"/>`));
  c.text(62, 51, '점수판', { size: 15, tone: 'inv', bold: true });
  // 시작 타일
  c.tilePx(260, 100, 'start');
  c.num(250, 100, 1);
  c.pill(310, 232, '시작 타일을 한가운데', { size: 14.5 });
  // 주머니
  c.raw('<g transform="translate(58 96)"><path d="M32 18Q50 6 68 18L65 32Q94 50 90 80Q86 98 50 98Q14 98 10 80Q6 50 35 32Z" fill="#C99A63" stroke="#6B4424" stroke-width="3"/><path d="M34 30Q50 42 66 30" fill="none" stroke="#6B4424" stroke-width="4.5" stroke-linecap="round"/></g>');
  c.text(108, 160, '타일', { size: 20, display: true, tone: 'inv' });
  c.grow(58, 96, 158, 196);
  c.num(60, 106, 2);
  c.pill(108, 232, '나머지는 섞어 주머니에', { size: 14.5 });
  // 마디줄 막대 더미
  [0, 1, 2, 3, 4].forEach((i) => c.barAt(448 + i * 24, 150, true, 1.15));
  c.num(430, 106, 3);
  c.pill(500, 232, '마디줄 막대 더미', { size: 14.5 });
  // 플레이어 구역
  [0, 1].forEach((p) => {
    const x0 = 16 + p * 304;
    c.rect(x0, 268, 288, 154, 'fg-surf', 18);
    c.num(x0 + 26, 294, 4, 13);
    c.raw(`<circle cx="${x0 + 54}" cy="294" r="8" fill="${COLORS[p].hex}" stroke="#fff" stroke-width="1.5"/>`);
    c.text(x0 + 70, 300, `${COLORS[p].name} 플레이어`, { size: 16, anchor: 'start', bold: true });
    // 지휘자 6개 (왼쪽) · 손패 3장 (오른쪽)
    [0, 1, 2, 3, 4, 5].forEach((j) => c.pawn(x0 + 30 + j * 25, 366, p, 0.78));
    c.text(x0 + 92, 396, '지휘자 6개', { size: 14.5, tone: 'mut' });
    [0, 1, 2].forEach((j) => c.back(x0 + 180 + j * 28, 322, 0.4));
    c.text(x0 + 228, 396, '손패 3장', { size: 14.5, tone: 'mut' });
  });
  return c.done('탁자 가운데에 시작 타일을 놓고, 나머지 타일은 주머니에, 마디줄 막대는 한쪽에 모아 둔다. 사람마다 지휘자 6개와 손패 3장을 가진다');
}

export function setupStart(): Fig {
  const c = new Canvas();
  c.ghost(0, 0); c.tile(1, 0, 'start'); c.ghost(2, 0);
  c.bracket(8, 148, -12, '왼쪽 마디', { up: true, tone: 'acc', size: 16 });
  c.bracket(152, 292, -12, '오른쪽 마디', { up: true, tone: 'acc', size: 16 });
  c.arrow(120, -48, 14, -48, { tone: 'acc' }); c.arrow(180, -48, 286, -48, { tone: 'acc' });
  c.lead(150, 134, 150, 76, 'acc');
  c.text(150, 156, '가운데 마디줄', { size: 16, bold: true });
  c.text(150, 176, '두 마디가 시작되는 경계', { size: 14, tone: 'mut' });
  c.lead(60, 196, 126, 84, 'acc');
  c.text(60, 214, '4/4 박자표', { size: 16, bold: true });
  c.text(60, 234, '한 마디는 4박', { size: 14, tone: 'mut' });
  return c.done('시작 타일은 가운데 마디줄이 왼쪽 마디와 오른쪽 마디, 두 마디의 시작 경계가 되고 4/4 박자표가 적혀 있다');
}

// ═════════ 5장 · 한 차례 ═════════
export function turnFlow(): Fig {
  const c = new Canvas();
  const steps = [
    { t: '타일 놓기', tag: '필수' }, { t: '지휘자 올리기', tag: '선택' }, { t: '마디줄 꽂기', tag: '선택' },
    { t: '정산', tag: '자동' }, { t: '손 채우기', tag: '자동' },
  ];
  const pitch = 118;
  steps.forEach((s, i) => {
    const cx = 52 + i * pitch;
    c.num(cx - 42, 8, i + 1, 14);
    if (i === 0) c.tilePx(cx - 36, 28, 'h-s', 0, { s: 0.72 });
    if (i === 1) c.pawn(cx, 104, 0, 1.95);
    if (i === 2) c.barAt(cx, 64, true, 1.4);
    if (i === 3) { c.pop(cx, 52, '+6점', 'acc', 21); c.text(cx, 96, '1+2+1 = 4', { size: 17, display: true, tone: 'ok' }); }
    if (i === 4) [0, 1, 2].forEach((j) => c.back(cx - 46 + j * 30, 34, 0.52));
    c.text(cx, 142, s.t, { size: 16, bold: true });
    c.pill(cx, 168, s.tag, { size: 13, tone: s.tag === '필수' ? 'acc' : 'soft' });
    if (i < steps.length - 1) c.arrow(cx + 44, 66, cx + pitch - 44, 66, { tone: 'mut' });
  });
  return c.done('한 차례의 순서: 타일 놓기(필수), 지휘자 올리기(선택), 마디줄 꽂기(선택), 정산(자동), 손 채우기(자동)');
}

export function turnPlace(): Fig {
  const st = newScene();
  put(st, 1, 0, 'q-s');
  const spots = R.placements(st, 'h-s');
  const c = new Canvas();
  for (const sp of spots) c.ghost(sp.x, sp.y);
  drawState(c, st);
  c.tile(2, 0, 'h-s', 0);
  c.ring(2, 0, 'acc');
  c.text(100, -126, '점선 칸 = 놓을 수 있는 칸', { size: 16, tone: 'acc', bold: true });
  c.lead(100, -114, 50, -92, 'acc');
  // 손패
  const hand: KindId[] = ['q-s', 'h-s', 'w-s'];
  hand.forEach((k, i) => {
    const x = -48 + i * 104, sel = i === 1;
    c.tilePx(x, sel ? 232 : 242, k, 0, { s: 0.88 });
    if (sel) c.raw(`<rect class="fg-ring acc" x="${x - 2}" y="230" width="92" height="92" rx="13"/>`);
  });
  c.text(100, 350, '손패에서 한 장 고르고', { size: 15, tone: 'mut' });
  c.text(100, 372, '점선 칸에 놓아요', { size: 15, tone: 'mut' });
  return c.done('시작 타일과 4분음표가 놓인 판에서 2분음표를 고르면 놓을 수 있는 칸이 점선으로 표시되고, 그중 한 칸에 놓는다');
}

export function turnChoose(): Fig {
  const st = newScene();
  put(st, 1, 0, 'q-s'); put(st, 2, 0, 'h-s');
  const c = new Canvas();
  c.band(50, 300, 0);
  drawState(c, st);
  c.ghost(3, 0);
  c.text(350, 62, '?', { size: 42, tone: 'mut', display: true });
  c.bracket(50, 300, -14, '지금 3박 → 1박이 모자라요', { up: true, tone: 'acc', size: 16 });
  const sim = (k: KindId) => { const s = R.clone(st); placeOnly(s, k, 3, 0, 0); putBar(s, 'v4,0'); return measureInfo(s, 3, 0); };
  const hand: KindId[] = ['q-s', 'h-s', 'w-s'];
  hand.forEach((k, i) => {
    const x = 20 + i * 140, info = sim(k);
    const add = R.SYMBOLS[R.kindOf(k).sym!].beats;
    c.tilePx(x, 196, k, 0, { s: 0.9 });
    c.text(x + 45, 322, `3 + ${fb(add)} = ${fb(info.sum)}박`, { size: 19, display: true, tone: info.ok ? 'ok' : 'no' });
    c.mark(x + 45, 352, info.ok ? 'ok' : 'no', 12);
    c.text(x + 45, 388, info.ok ? `딱 맞아요 · ${info.points}점` : info.sum > 4 ? '넘쳐요 · 0점' : '틀려요 · 0점', { size: 15, bold: true, tone: info.ok ? 'ok' : 'no' });
  });
  c.text(0, 178, '손패', { size: 15, anchor: 'start', tone: 'mut', bold: true });
  return c.done('3박까지 만든 마디에서 손패 4분음표를 놓으면 합이 4박이라 6점이고, 2분음표나 온음표는 5박 7박으로 넘쳐 0점이 된다');
}

export function turnConductor(): Fig {
  const A = new Canvas();
  A.tile(0, 0, 'start'); A.tile(1, 0, 'q-s'); A.ring(1, 0, 'acc'); A.meeple(1, 0, 'q-s', 0, 0, P1, { ghost: true });
  const B = new Canvas();
  B.tile(0, 0, 'stand'); B.meeple(0, 0, 'stand', 0, 's', P1, { ghost: true });
  const C = new Canvas();
  C.tile(0, 0, 'start'); C.tile(1, 0, 'q-s'); C.tile(2, 0, 'h-s');
  C.meeple(1, 0, 'q-s', 0, 0, P1);
  C.ring(2, 0, 'no');
  C.meeple(2, 0, 'h-s', 0, 0, P2, { ghost: true });
  const [ax, ay] = ART.meepleAnchor('h-s', 0, 0);
  C.mark(200 + ax + 26, ay - 36, 'no', 13);
  const rows: Row[] = [
    { c: A, mark: 'ok', cap: ['빈 마디에는 올릴 수 있어요', '방금 놓은 타일 위에'] },
    { c: B, mark: 'ok', cap: ['지휘대에도 올릴 수 있어요', '그 지휘대가 비어 있을 때'] },
    { c: C, mark: 'no', cap: ['지휘자가 있는 마디는 안 돼요', '이어진 한 줄 전체에서 따져요'] },
  ];
  return sideRows(rows).done('지휘자는 방금 놓은 타일의 빈 마디 또는 비어 있는 지휘대 위에 올릴 수 있고, 이미 다른 지휘자가 있는 마디에는 올릴 수 없다');
}

export function turnBar(): Fig {
  const st = newScene();
  put(st, 1, 0, 'q-s'); put(st, 2, 0, 'h-s');
  placeOnly(st, 'q-s', 3, 0, 0);
  const spots = R.barSpots(st).map((b) => b.seam);
  const c = new Canvas();
  drawState(c, st);
  c.ring(3, 0, 'acc');
  for (const sk of spots) c.barGhost(sk);
  c.barGhost('v1,0', 'no');
  c.text(350, -34, '방금 놓은 타일', { size: 15.5, tone: 'acc', bold: true });
  c.lead(350, -22, 350, 2, 'acc');
  c.text(300, 166, `마디줄을 꽂을 수 있는 이음새 ${spots.length}곳`, { size: 16, tone: 'acc', bold: true });
  c.text(300, 188, '방금 놓은 타일과 바로 옆 타일의 리듬선 이음새', { size: 14, tone: 'mut' });
  c.text(100, 154, '너무 멀어요', { size: 14.5, tone: 'no', bold: true });
  return c.done('방금 놓은 4분음표 둘레와 그 옆 타일의 리듬선 이음새 세 곳에 마디줄을 꽂을 수 있고, 두 칸 이상 떨어진 이음새에는 꽂을 수 없다');
}

export function turnBarKeep(): Fig {
  const st = newScene();
  clearBoard(st);
  put(st, 0, 0, 'h-s'); put(st, 1, 0, 'h-s'); put(st, 2, 0, 'q-s'); put(st, 3, 0, 'h-s');
  putBar(st, 'v0,0'); putBar(st, 'v2,0');
  const info = measureInfo(st, 0, 0);
  const c = new Canvas();
  c.band(0, 200, 0, 'ok');
  drawState(c, st);
  c.bracket(0, 200, -14, `정산 끝 · ${info.terms.map((t) => fb(t.b)).join('+')} = ${fb(info.sum)}박`, { up: true, tone: 'ok', size: 16 });
  c.bracket(200, 400, -14, '다음 마디 (진행 중)', { up: true, tone: 'mut', size: 16 });
  c.lead(200, 146, 200, 82, 'acc');
  c.text(200, 168, '막대는 그대로 남아요', { size: 16, bold: true, tone: 'acc' });
  c.text(200, 190, '왼쪽 마디는 끝, 오른쪽 마디는 여기서 시작', { size: 14, tone: 'mut' });
  return c.done('정산이 끝난 뒤에도 마디줄 막대는 보드에 남아 오른쪽 다음 마디의 왼쪽 경계가 된다');
}

export function turnSettle(): Fig {
  const st = newScene();
  clearBoard(st);
  put(st, 0, 0, 'h-s'); put(st, 1, 0, 'h-s');
  putBar(st, 'v0,0'); putBar(st, 'v2,0');
  putConductor(st, P2, 0, 0, 0);
  const c = new Canvas();
  c.band(0, 200, 0);
  drawState(c, st);
  const info = settleNote(c, st, [0, 0], [0, 200]);
  // 지휘자 창고 (위쪽)
  [0, 1, 2, 3, 4].forEach((j) => c.pawn(18 + j * 28, -44, P2, 0.74));
  c.pawn(18 + 5 * 28, -44, P2, 0.74, true);
  const [ax, ay] = ART.meepleAnchor('h-s', 0, 0);
  c.arrow(ax + 4, ay - 44, 18 + 5 * 28 - 4, -52, { tone: 'acc', bend: -34 });
  c.text(212, -36, '지휘자는 주인(파랑)에게 돌아와요', { size: 15, anchor: 'start', tone: 'mut', bold: true });
  void info;
  return c.done('마디가 닫히면 2+2=4박으로 음표 두 장 × 2점 = 4점을 지휘자 주인이 받고, 지휘자는 주인의 창고로 돌아온다');
}

export function turnNomove(): Fig {
  const c = new Canvas();
  (['w-s', 'dh-c', 'h-c'] as KindId[]).forEach((k, i) => {
    c.tilePx(i * 104, 20, k, 0, { s: 0.88 });
    c.raw(`<rect class="fg-cand no" x="${i * 104 + 2}" y="22" width="84" height="84" rx="11"/>`);
  });
  c.text(150, 0, '손패 — 놓을 곳이 하나도 없어요', { size: 16, tone: 'no', bold: true });
  c.arrow(332, 62, 376, 62, { tone: 'mut' });
  c.tilePx(392, 20, 'dh-c', 0, { s: 0.88 });
  c.text(436, 132, '한 장을 공개해서', { size: 15, bold: true });
  c.text(436, 152, '따로 빼 두고', { size: 15, bold: true });
  c.arrow(436, 166, 436, 196, { tone: 'mut' });
  c.back(392, 206, 0.88);
  c.text(436, 318, '주머니에서 새로 한 장', { size: 15, bold: true });
  c.text(436, 338, '뽑아 다시 시도해요', { size: 15, tone: 'mut' });
  return c.done('손패 세 장 모두 놓을 곳이 없으면 한 장을 공개해 따로 빼 두고 주머니에서 새로 한 장을 뽑는다');
}

// ═════════ 6장 · 점수 ═════════
export function scoreOverview(): Fig {
  const c = new Canvas();
  const W = 520, H = 114, gap = 14;
  const cards: Array<{ thumb: Canvas; s: number; title: string; sub: string[]; pop: string; tone: 'acc' | 'soft' }> = [];
  // ① 마디 완성 (엔진 점수)
  const st1 = lineScene(['q-s', 'h-s', 'q-s'], { barL: true, barR: true, conductors: [[0, P1]] });
  const t1 = new Canvas(); drawState(t1, st1);
  cards.push({ thumb: t1, s: 0.44, title: '마디 완성', sub: ['음표 1장당 2점', '(쉼표는 1점 · Lv2)'], pop: `+${measureInfo(st1, 0, 0).points}점`, tone: 'acc' });
  // ② 지휘대
  const t2 = new Canvas(); drawState(t2, standScene(8));
  cards.push({ thumb: t2, s: 0.3, title: '지휘대 둘러싸기', sub: ['둘레 8칸이 모두', '채워지면 바로'], pop: '+9점', tone: 'acc' });
  // ③ 게임 끝
  const sa = newScene();
  put(sa, 1, 0, 'q-s'); put(sa, 2, 0, 'h-s'); putConductor(sa, P1, 1, 0, 0);
  const t3 = new Canvas(); drawState(t3, sa); t3.ghost(3, 0);
  cards.push({ thumb: t3, s: 0.38, title: '게임 끝 정산', sub: ['열린 마디는 0점', '미완성 지휘대는 칸당 1점'], pop: '칸당 1점', tone: 'soft' });
  cards.forEach((cd, i) => {
    const y = i * (H + gap);
    c.rect(0, y, W, H, 'fg-surf2', 18);
    const w = cd.thumb.w * cd.s, h = cd.thumb.h * cd.s;
    c.scaled(cd.thumb, 16 + (160 - w) / 2, y + (H - h) / 2, cd.s);
    c.text(192, y + 40, cd.title, { size: 19, anchor: 'start', bold: true });
    cd.sub.forEach((s, j) => c.text(192, y + 66 + j * 21, s, { size: 14.5, anchor: 'start', tone: 'mut' }));
    c.pop(W - 62, y + H / 2, cd.pop, cd.tone, 24);
  });
  return c.done('점수를 얻는 세 가지: 합이 맞는 마디를 닫으면 음표 한 장당 2점, 지휘대 둘레 여덟 칸을 모두 채우면 9점, 게임이 끝날 때 열린 마디는 0점이고 미완성 지휘대는 채워진 칸당 1점');
}

export function scoreOk(): Fig {
  const mk = (kinds: KindId[]) => {
    const st = lineScene(kinds, { barL: true, barR: true });
    const c = new Canvas();
    c.band(0, kinds.length * 100, 0);
    drawState(c, st);
    settleNote(c, st, [0, 0], [0, kinds.length * 100]);
    return c;
  };
  return stack([
    { c: mk(['q-s', 'q-s', 'q-s', 'q-s']), title: '작은 음표를 여러 장 → 점수가 커요' },
    { c: mk(['h-s', 'h-s']), title: '큰 음표 두 장 → 점수가 작아요' },
  ]).done('같은 4박 마디라도 1박 음표 네 장이면 8점, 2박 음표 두 장이면 4점으로 음표 장수 × 2점이다');
}

export function scoreWrong(): Fig {
  const mk = (kinds: KindId[]) => {
    const st = lineScene(kinds, { barL: true, barR: true, conductors: [[0, P1]] });
    const c = new Canvas();
    c.band(0, kinds.length * 100, 0, 'no');
    drawState(c, st);
    settleNote(c, st, [0, 0], [0, kinds.length * 100]);
    return c;
  };
  return stack([
    { c: mk(['q-s', 'h-s', 'h-s']), mark: 'no', title: '넘치게 닫으면 틀린 마디', sub: '1 + 2 + 2 = 5박' },
    { c: mk(['q-s', 'h-s']), mark: 'no', title: '모자라게 닫아도 틀린 마디', sub: '1 + 2 = 3박' },
  ]).done('합이 목표 4박이 아닌 채로 닫힌 마디는 틀린 마디라 점수가 0점이고 지휘자만 주인에게 돌아온다');
}

export function scoreBlock(): Fig {
  const base = newScene();
  put(base, 1, 0, 'q-s'); put(base, 2, 0, 'h-s');
  putConductor(base, P1, 1, 0, 0);
  // ① 빨강이 찜한 3박 마디
  const A = new Canvas();
  A.band(50, 300, 0);
  drawState(A, base);
  A.bracket(50, 300, 120, '지금 3박 (빨강이 찜했어요)', { tone: 'acc', size: 16 });
  // ② 파랑이 2박 타일 + 마디줄
  const s2 = R.clone(base);
  s2.turn.p = P2;
  play(s2, 'h-s', 3, 0, 0, { bar: 'v4,0', resolve: false });
  const B = new Canvas();
  B.band(50, 400, 0, 'no');
  drawState(B, s2);
  B.ring(3, 0, 'no');
  const i2 = measureInfo(s2, 3, 0);
  B.eqn(225, 150, i2.terms, { sum: i2.sum, ok: i2.ok });
  // ③ 정산
  const s3 = R.clone(s2);
  R.endTurn(s3);
  const C = new Canvas();
  C.band(50, 400, 0, 'no');
  drawState(C, s3);
  C.pop(225, 144, '0점', 'no');
  C.text(225, 186, '빨강은 지휘자만 돌려받아요', { size: 15.5, tone: 'mut', bold: true });
  C.pawn(468, 26, P1, 1);
  return stack([
    { c: A, title: '① 빨강이 3박까지 만들었어요', sub: '한 박만 더하면 6점!' },
    { c: B, title: '② 파랑이 2박 타일을 붙이고 마디줄로 닫아요' },
    { c: C, mark: 'no', title: '③ 5박이라 틀린 마디 → 아무도 점수가 없어요' },
  ]).done('빨강이 3박까지 만든 마디에 파랑이 2분음표를 붙이고 마디줄로 닫으면 5박이라 0점이 되어 빨강의 점수를 막을 수 있다');
}

export function scoreMajority(): Fig {
  const c = new Canvas();
  const rows: Array<{ who: number[]; count: string; res: string; tone: 'acc' | 'soft' }> = [
    { who: [P1, P1, P2], count: '빨강 2 : 파랑 1', res: '빨강 혼자 +6점', tone: 'acc' },
    { who: [P1, P2], count: '빨강 1 : 파랑 1', res: '둘 다 +6점', tone: 'soft' },
    { who: [P2], count: '파랑 1 : 빨강 0', res: '파랑 +6점', tone: 'acc' },
  ];
  rows.forEach((r, i) => {
    const y = i * 74;
    c.rect(0, y, 470, 62, 'fg-surf2', 14);
    r.who.forEach((p, j) => c.pawn(32 + j * 34, y + 50, p, 0.95));
    c.text(132, y + 38, r.count, { size: 17, anchor: 'start', bold: true });
    c.arrow(262, y + 31, 296, y + 31, { tone: 'mut' });
    c.pill(388, y + 31, r.res, { size: 16, tone: r.tone, display: false, padX: 16 });
  });
  c.text(0, -12, '마디가 닫힐 때 그 마디의 지휘자를 세어요', { size: 16, anchor: 'start', bold: true });
  return c.done('마디가 닫힐 때 그 마디의 지휘자를 세어 더 많은 사람이 점수를 모두 받고, 같으면 모두가 점수를 받는다');
}

export function scoreMerge(): Fig {
  const base = newScene();
  put(base, 1, 0, 'q-s'); put(base, 1, 1, 'stand'); put(base, 2, 1, 'h-c', 2);
  putConductor(base, P1, 1, 0, 0); putConductor(base, P2, 2, 1, 0);
  const A = new Canvas();
  drawState(A, base);
  A.ghost(2, 0);
  A.text(250, 62, '?', { size: 40, tone: 'mut', display: true });
  A.text(330, 184, '떨어진 두 줄에', { size: 15, anchor: 'start', tone: 'mut' });
  A.text(330, 204, '지휘자가 따로 있어요', { size: 15, anchor: 'start', tone: 'mut' });
  const s2 = R.clone(base);
  placeOnly(s2, 'q-c', 2, 0, 0);
  R.applyBar(s2, 'v3,1');
  const info = measureInfo(s2, 2, 0);
  const B = new Canvas();
  drawState(B, s2);
  B.ring(2, 0, 'acc');
  B.eqn(150, 262, info.terms, { sum: info.sum, ok: info.ok });
  B.pill(66, 318, '빨강 +6점', { size: 16, tone: 'acc', padX: 16 });
  B.pill(234, 318, '파랑 +6점', { size: 16, tone: 'acc', padX: 16 });
  B.text(150, 360, '한 줄로 이어져 1 : 1 → 둘 다 점수를 받아요', { size: 15, tone: 'mut', bold: true });
  return stack([
    { c: A, title: '① 사이가 비어 있어서 두 줄은 따로예요' },
    { c: B, title: '② 사이를 타일로 이어 한 마디가 되면' },
  ]).done('빨강 지휘자가 있는 줄과 파랑 지휘자가 있는 줄 사이 빈 칸에 타일을 놓아 한 마디로 이은 뒤 닫으면 1대 1 동수라 둘 다 6점을 받는다');
}

export function scoreStand(): Fig {
  const st = standScene(STAND_LAST);
  const c = new Canvas();
  drawState(c, st);
  const [lx, ly, lk, lr] = STAND_RING[STAND_LAST];
  c.ghost(lx, ly);
  void [lk, lr];
  c.num(lx * 100 + 50, ly * 100 + 50, '!', 18);
  c.pill(150, 340, '둘레 8칸 = 지휘대 둘러싸기', { size: 15, tone: 'soft' });
  c.text(370, 90, '마지막 한 칸을', { size: 17, anchor: 'start', bold: true });
  c.text(370, 114, '채우면 바로', { size: 17, anchor: 'start', bold: true });
  c.pop(420, 168, '+9점', 'acc', 28);
  c.text(370, 214, '지휘대에 올린', { size: 14.5, anchor: 'start', tone: 'mut' });
  c.text(370, 234, '지휘자의 주인이 받고', { size: 14.5, anchor: 'start', tone: 'mut' });
  c.text(370, 254, '지휘자는 돌아와요', { size: 14.5, anchor: 'start', tone: 'mut' });
  return c.done('지휘대 둘레 여덟 칸 중 일곱 칸이 채워져 있고 마지막 한 칸을 채우면 지휘대에 지휘자를 올린 사람이 9점을 받는다');
}

// ═════════ 7장 · 게임 끝 ═════════
export function endTrigger(): Fig {
  const c = new Canvas();
  const dashed = (x: number, y: number, s = 0.8) => c.raw(`<rect class="fg-cand no" x="${x + 2}" y="${y + 2}" width="${96 * s}" height="${96 * s}" rx="${12 * s}"/>`);
  dashed(0, 6); c.grow(0, 6, 80, 86);
  c.text(40, 118, '주머니', { size: 16, bold: true }); c.text(40, 140, '타일 0장', { size: 15, tone: 'no', bold: true });
  c.text(106, 52, '+', { size: 26, tone: 'mut', display: true });
  [0, 1, 2].forEach((i) => { dashed(140 + i * 66, 6, 0.6); });
  c.grow(140, 6, 140 + 2 * 66 + 60, 66);
  c.text(236, 118, '모두의 손패', { size: 16, bold: true }); c.text(236, 140, '0장', { size: 15, tone: 'no', bold: true });
  c.arrow(346, 40, 386, 40, { tone: 'acc' });
  c.pill(468, 40, '끝 정산', { size: 19, tone: 'acc', padX: 22, display: true });
  c.text(468, 92, '마지막 타일을 놓은', { size: 14.5, tone: 'mut' });
  c.text(468, 112, '차례가 끝나면 게임 끝', { size: 14.5, tone: 'mut' });
  return c.done('주머니의 타일이 다 떨어지고 모두의 손패도 비면 마지막 타일을 놓은 차례가 끝난 뒤 끝 정산을 하고 게임이 끝난다');
}

export function endScore(): Fig {
  // ① 열린 마디
  const sa = newScene();
  put(sa, 1, 0, 'q-s'); put(sa, 2, 0, 'h-s');
  putConductor(sa, P1, 1, 0, 0);
  const A = new Canvas();
  A.band(50, 300, 0, 'no');
  drawState(A, sa);
  A.ghost(3, 0);
  A.text(350, 62, '열림', { size: 18, tone: 'no', bold: true });
  const ia = measureInfo(sa, 1, 0);
  A.eqn(175, 150, ia.terms, { sum: ia.sum, ok: false });
  A.pop(112, 206, '0점', 'no');
  A.text(168, 212, '열린 마디는 0점 · 지휘자는 회수', { size: 15, anchor: 'start', tone: 'mut' });
  // ② 미완성 지휘대
  const sb = newScene();
  clearBoard(sb);
  put(sb, 0, 0, 'stand'); put(sb, 0, -1, 'h-s', 0); put(sb, 0, 1, 'h-s', 0); put(sb, -1, 0, 'q-s', 1); put(sb, 1, 0, 'q-s', 1);
  putConductor(sb, P1, 0, 0, 's');
  const B = new Canvas();
  drawState(B, sb, { beats: false });
  const cells: Array<[number, number]> = [[0, 0], [0, -1], [1, 0], [0, 1], [-1, 0]];
  cells.forEach(([x, y], i) => B.num(x * 100 + 18, y * 100 + 20, i + 1, 13));
  const filled = R.standFilled(sb, 0, 0);
  B.pop(372, 98, `+${filled}점`, 'acc', 28);
  B.text(236, 154, '채워진 칸(지휘대 포함) 1장당 1점', { size: 15, anchor: 'start', tone: 'mut' });
  B.text(236, 176, '둘레 8칸을 못 채워도 받아요', { size: 15, anchor: 'start', tone: 'mut' });
  return stack([
    { c: A, title: '아직 닫히지 않은 마디', mark: 'no' },
    { c: B, title: '다 못 둘러싼 지휘대' },
  ]).done('게임이 끝날 때 열려 있는 마디는 0점이고 지휘자만 회수하며, 다 둘러싸지 못한 지휘대는 채워진 칸 한 장당 1점을 지휘자 주인이 받는다');
}

export function endRank(): Fig {
  const c = new Canvas();
  const rows = [
    { rule: '① 점수가 높은 사람이 1등', a: [P1, 30, 4], b: [P2, 24, 6], res: '빨강 1등', tone: 'acc' as const },
    { rule: '② 점수가 같으면 완성한 마디가 많은 사람', a: [P1, 24, 5], b: [P2, 24, 3], res: '빨강 1등', tone: 'acc' as const },
    { rule: '③ 그것도 같으면 공동 1등', a: [P1, 24, 4], b: [P2, 24, 4], res: '공동 1등', tone: 'soft' as const },
  ];
  rows.forEach((r, i) => {
    const y = i * 112;
    c.rect(0, y, 500, 98, 'fg-surf2', 16);
    c.text(18, y + 28, r.rule, { size: 16.5, anchor: 'start', bold: true });
    [r.a, r.b].forEach((pl, j) => {
      const x = 18 + j * 176;
      c.raw(`<circle cx="${x + 8}" cy="${y + 68}" r="8" fill="${COLORS[pl[0]].hex}" stroke="#fff" stroke-width="1.5"/>`);
      c.text(x + 24, y + 74, `${COLORS[pl[0]].name} ${pl[1]}점`, { size: 16, anchor: 'start', bold: true });
      c.text(x + 24, y + 74 + 0, '', {});
      c.text(x + 100, y + 74, `마디 ${pl[2]}개`, { size: 13.5, anchor: 'start', tone: 'mut' });
    });
    c.pill(442, y + 66, r.res, { size: 15, tone: r.tone, padX: 14 });
  });
  void [T, ART];
  return c.done('순위는 점수가 높은 순이고 점수가 같으면 완성한 마디가 많은 사람이 앞서며 그것도 같으면 공동 순위이다');
}
