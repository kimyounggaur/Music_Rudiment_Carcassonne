/* 룰북 삽화 — 11·12장: 앱 화면과 조작 · 자주 묻는 질문 */
import * as R from '../engine/engine';
import type { KindId } from '../engine/engine';
import * as ART from './tiles';
import { COLORS } from '../game/colors';
import { Canvas, newScene, put, drawState, placeOnly, measureInfo, CARD, VG, P1, P2, type Fig } from './rulebook';
import { fb, stack, sideRows, type Row } from './rulebookKit';
import { sampleRun } from './figsPlay';

const f1 = (n: number) => Math.round(n * 10) / 10;

/** 앱 아이콘 모양 (24×24 선 그림 — ui/common.tsx의 Icon과 같은 모양) */
export const IC = {
  list: 'M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01',
  sound: 'M4 9v6h4l5 4V5L8 9H4zM16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12',
  menu: 'M4 7h16M4 12h16M4 17h16',
  book: 'M12 6.6C10.3 5.3 7.7 4.7 4 4.9v12.4c3.7-.2 6.3.4 8 1.7 1.7-1.3 4.3-1.9 8-1.7V4.9c-3.7-.2-6.3.4-8 1.7zM12 6.6V19',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  fit: 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5',
};

function icon(c: Canvas, d: string, cx: number, cy: number, size: number, tone: '' | 'inv' = '') {
  const s = Math.round((size / 24) * 1000) / 1000;
  c.raw(`<g transform="translate(${f1(cx - size / 2)} ${f1(cy - size / 2)}) scale(${s})"><path class="fg-ic${tone ? ` ${tone}` : ''}" style="stroke-width:${f1(2 / s)}px" d="${d}"/></g>`);
  return c.grow(cx - size / 2, cy - size / 2, cx + size / 2, cy + size / 2);
}

// ═════════ 11장 · 앱 사용법 ═════════
export function appScreen(): Fig {
  const c = new Canvas();
  c.rect(0, 0, 460, 308, 'fg-surf', 18);
  // ── 위 막대
  c.text(16, 34, '리듬마을', { size: 16, anchor: 'start', display: true });
  c.raw(`<circle cx="106" cy="29" r="5" fill="${COLORS[P1].hex}"/>`);
  c.text(116, 34, '빨강 차례', { size: 12.5, anchor: 'start', bold: true });
  c.text(196, 34, '타일 21 · 마디줄 24', { size: 12, anchor: 'start', tone: 'mut' });
  // 넓은 화면의 위 막대: 소리 · 룰북 · 메뉴 (기록은 오른쪽 카드로 보이고, 좁은 화면에서만 목록 버튼이 생긴다)
  [IC.sound, IC.book, IC.menu].forEach((d, i) => {
    const x = 354 + i * 32, hot = i === 1;
    c.rect(x, 16, 28, 28, hot ? 'fg-pill acc' : 'fg-key', 9);
    icon(c, d, x + 14, 30, 17, hot ? 'inv' : '');
  });
  // ── 보드
  c.rect(12, 54, 292, 186, 'fg-felt', 14);
  (['start', 'q-s', 'h-s'] as KindId[]).forEach((k, i) => c.tilePx(40 + i * 62, 116, k, 0, { s: 0.6 }));
  c.raw('<rect class="fg-cand" x="228" y="119" width="54" height="54" rx="8"/>');
  c.pawn(102 + 18, 116 + 38, P1, 0.62);
  c.pill(158, 86, '이 마디 지금 3박 / 목표 4박', { size: 11.5, tone: 'plain', padX: 10 });
  [IC.plus, IC.minus, IC.fit].forEach((d, i) => {
    const cx = 226 + i * 28;
    c.raw(`<circle class="fg-key" cx="${cx}" cy="222" r="11"/>`);
    icon(c, d, cx, 222, 13);
  });
  // ── 오른쪽: 점수 카드 · 기록
  [P1, P2].forEach((p, i) => {
    const y = 54 + i * 68;
    c.rect(312, y, 136, 62, 'fg-surf2', 12);
    if (i === 0) c.raw(`<rect class="fg-ring acc" style="stroke-width:2.5px" x="313" y="${y + 1}" width="134" height="60" rx="11"/>`);
    c.raw(`<circle cx="327" cy="${y + 18}" r="5" fill="${COLORS[p].hex}"/>`);
    c.text(337, y + 22, COLORS[p].name, { size: 12.5, anchor: 'start', bold: true });
    c.text(440, y + 30, i === 0 ? '6' : '0', { size: 24, anchor: 'end', display: true });
    for (let j = 0; j < 6; j++) c.pawn(325 + j * 13, y + 56, p, 0.36, i === 0 && j === 5 ? false : false);
  });
  c.rect(312, 190, 136, 50, 'fg-surf2', 12);
  c.text(322, 207, '기록', { size: 11.5, anchor: 'start', bold: true });
  c.rect(322, 214, 100, 5, 'fg-surf', 2.5);
  c.rect(322, 226, 76, 5, 'fg-surf', 2.5);
  // ── 아래: 손패 막대
  c.rect(12, 250, 436, 46, 'fg-surf2', 14);
  c.raw(`<circle cx="26" cy="267" r="5" fill="${COLORS[P1].hex}"/>`);
  c.text(36, 271, '빨강', { size: 12.5, anchor: 'start', bold: true });
  c.text(24, 288, '손패 3장', { size: 11.5, anchor: 'start', tone: 'mut' });
  (['q-s', 'h-s', 'w-s'] as KindId[]).forEach((k, i) => {
    const x = 118 + i * 46, sel = i === 1;
    c.tilePx(x, sel ? 250 : 254, k, 0, { s: 0.4 });
    if (sel) c.raw(`<rect class="fg-ring acc" style="stroke-width:2.5px" x="${x}" y="250" width="40" height="40" rx="6"/>`);
  });
  c.rect(272, 258, 70, 30, 'fg-key', 10);
  c.text(307, 278, '돌리기', { size: 12.5, bold: true });
  c.rect(350, 258, 90, 30, 'fg-pill acc', 10);
  c.text(395, 278, '여기에 놓기', { size: 12.5, bold: true, tone: 'inv' });
  // ── 번호표
  c.num(400, 2, 1, 11); c.num(24, 66, 2, 11); c.num(314, 56, 3, 11); c.num(314, 192, 4, 11);
  c.num(110, 262, 5, 11); c.num(272, 258, 6, 11); c.num(432, 2, 7, 11);
  const legend = [
    '룰북 — 규칙을 그림으로 다시 보기',
    '보드 — 끌어서 옮기고 확대·축소',
    '점수 카드 — 점수 · 남은 지휘자',
    '기록 — 닫힌 마디와 점수 (좁은 화면은 목록 버튼)',
    '손패 — 눌러서 고르기',
    '돌리기 · 여기에 놓기',
    '메뉴 — 소리 · 검산 퀴즈 · 힌트 · 테마',
  ];
  legend.forEach((s, i) => {
    c.num(13, 346 + i * 30, i + 1, 11);
    c.text(34, 352 + i * 30, s, { size: 15, anchor: 'start' });
  });
  return c.done('게임 화면: 위쪽 막대에 소리·룰북·메뉴 버튼, 가운데 보드와 확대 버튼, 오른쪽 점수 카드와 기록, 아래쪽에 손패와 돌리기·놓기 버튼이 있다');
}

function key(c: Canvas, x: number, y: number, label: string, w = 42) {
  c.rect(x, y + 4, w, 40, 'fg-key-sh', 10);
  c.rect(x, y, w, 40, 'fg-key', 10);
  c.text(x + w / 2, y + (label.length > 2 ? 26 : 28), label, { size: label.length > 2 ? 15 : 20, display: true });
}

export function appKeys(): Fig {
  const c = new Canvas();
  const groups: Array<{ title: string; rows: Array<{ keys: string[]; cap: string }> }> = [
    { title: '타일을 놓을 때', rows: [
      { keys: ['1', '2', '3'], cap: '손패 고르기' },
      { keys: ['←', '↑', '↓', '→'], cap: '놓을 수 있는 칸을 차례로 옮기기' },
      { keys: ['R'], cap: '돌리기 (Shift+R은 거꾸로)' },
      { keys: ['Enter'], cap: '여기에 놓기' },
      { keys: ['Esc'], cap: '고른 칸 취소' },
    ] },
    { title: '타일을 놓은 다음', rows: [
      { keys: ['M'], cap: '지휘자 올리기 · 내리기' },
      { keys: ['B'], cap: '마디줄 꽂기 (누를 때마다 다음 자리)' },
      { keys: ['Enter'], cap: '차례 끝내기' },
    ] },
    { title: '보드 보기 (언제든)', rows: [
      { keys: ['+', '−', 'F'], cap: '확대 · 축소 · 전체 보기' },
    ] },
  ];
  const capX = 4 * 50 + 14;
  let y = 0;
  groups.forEach((g) => {
    c.text(0, y + 14, g.title, { size: 16, anchor: 'start', bold: true, tone: 'acc' });
    c.line(0, y + 26, capX + 300, y + 26, { dash: true });
    y += 40;
    g.rows.forEach((r) => {
      let x = 0;
      r.keys.forEach((k) => {
        const w = k === 'Enter' ? 76 : k === 'Esc' ? 58 : 42;
        key(c, x, y, k, w);
        x += w + 8;
      });
      c.text(capX, y + 28, r.cap, { size: 15.5, anchor: 'start', bold: true });
      y += 56;
    });
    y += 8;
  });
  return c.done('키보드 단축키: 1·2·3 손패 고르기, 방향키 칸 옮기기, R 돌리기, Enter 놓기와 차례 끝내기, Esc 취소, M 지휘자, B 마디줄, +·−·F 보드 확대 축소 전체 보기');
}

export function appBoard(): Fig {
  const A = new Canvas();
  A.rect(0, 0, 160, 104, 'fg-felt', 14);
  (['start', 'q-s', 'h-s'] as KindId[]).forEach((k, i) => A.tilePx(8 + i * 48, 12, k, 0, { s: 0.46 }));
  A.raw('<circle class="fg-num" cx="60" cy="76" r="10"/>');
  A.arrow(76, 76, 134, 76, { tone: 'inv' });
  const B = new Canvas();
  B.raw('<circle class="fg-num" cx="62" cy="40" r="10"/><circle class="fg-num" cx="98" cy="40" r="10"/>');
  B.grow(52, 30, 108, 50);
  B.arrow(50, 40, 10, 40, { tone: 'acc' }); B.arrow(110, 40, 150, 40, { tone: 'acc' });
  const C = new Canvas();
  [IC.plus, IC.minus, IC.fit].forEach((d, i) => {
    const cx = 18 + i * 46;
    C.raw(`<circle class="fg-key" cx="${cx}" cy="18" r="17"/>`);
    C.grow(cx - 17, 1, cx + 17, 35);
    icon(C, d, cx, 18, 18);
  });
  const rows: Row[] = [
    { c: A, cap: ['끌어서 옮겨요', '손가락이나 마우스로 보드를 잡고 끌어요'] },
    { c: B, cap: ['두 손가락으로 확대·축소', '벌리면 크게, 모으면 작게 (마우스는 휠)'] },
    { c: C, cap: ['버튼과 키보드', '+ − 로 확대·축소, F는 전체 보기'] },
  ];
  return sideRows(rows).done('보드는 끌어서 옮기고, 두 손가락을 벌리거나 마우스 휠로 확대하며, 오른쪽 아래의 더하기·빼기·전체 보기 버튼으로도 조절한다');
}

/** 검산 퀴즈 보기 숫자 (controller.makeChoices(4,4)와 같은 값 — 테스트가 확인) */
export const QUIZ_DEMO = { sum: 4, choices: [3, 4, 5, 6] };

export function appQuiz(): Fig {
  const { ev } = sampleRun()[3];
  const m = ev.find((e): e is R.MeasureEvent => e.type === 'measure')!;
  const terms = m.order.filter((o) => o.note || o.rest);
  const W = 392;
  const sheet = (answered: boolean) => {
    const c = new Canvas();
    c.rect(0, 0, W, answered ? 276 : 262, 'fg-surf', 20);
    c.text(22, 32, '빨강 · 마디가 닫혔어요', { size: 13, anchor: 'start', tone: 'mut' });
    c.text(22, 62, '이 마디는 모두 몇 박일까요?', { size: 19, anchor: 'start', bold: true });
    let y = 80;
    if (!answered) {
      terms.forEach((o, i) => {
        const x = 22 + i * 108;
        c.tilePx(x, y, o.k.replace('-c', '-s') as KindId, 0, { s: 0.66 });
        c.text(x + 33, y + 84, R.kindOf(o.k).name, { size: 12.5, tone: 'mut' });
        if (i < terms.length - 1) c.text(x + 86, y + 42, '+', { size: 22, display: true, tone: 'mut' });
      });
      y += 108;
    }
    QUIZ_DEMO.choices.forEach((b, i) => {
      const x = 22 + i * 90;
      const right = answered && b === QUIZ_DEMO.sum;
      c.rect(x, y, 80, 48, right ? 'fg-pill ok' : 'fg-key', 14);
      c.text(x + 40, y + 33, `${b}박`, { size: 22, display: true, tone: right ? 'ok' : 'ink' });
    });
    if (answered) {
      c.text(22, y + 84, '정답이에요!', { size: 18, anchor: 'start', bold: true, tone: 'ok' });
      c.eqn(W / 2, y + 120, terms.map((o) => ({ b: o.beats, k: o.k, rest: o.rest })), { sum: m.sum, ok: true });
      c.text(22, y + 168, `음표 ${m.notes}장 × 2점 = ${m.points}점`, { size: 15, anchor: 'start', tone: 'mut', bold: true });
    }
    return c;
  };
  return stack([
    { c: sheet(false), title: '① 마디를 닫으면 먼저 물어봐요' },
    { c: sheet(true), title: '② 답하면 식과 점수를 보여줘요' },
  ]).done('내가 마디를 닫으면 이 마디가 모두 몇 박인지 네 개의 보기 중에서 먼저 고르고, 답하면 1+2+1=4박 식과 6점을 보여 준다');
}

function skinTile(c: Canvas, skin: 'village' | 'card', X: number, Y: number, k: KindId, r: number, s: number) {
  const M = skin === 'village' ? VG : CARD;
  c.raw(`<rect class="fg-sh" x="${f1(X + 3 * s)}" y="${f1(Y + 6 * s)}" width="${f1(96 * s)}" height="${f1(96 * s)}" rx="${f1(12 * s)}"/>`
    + `<g transform="translate(${f1(X)} ${f1(Y)}) scale(${s})">${M.tile(k, r, { beats: true })}</g>`);
  return c.grow(X, Y, X + 100 * s, Y + 100 * s);
}

export function appSkins(): Fig {
  const c = new Canvas();
  const skins: Array<{ id: 'village' | 'card'; name: string; sub: string }> = [
    { id: 'village', name: '음악 마을', sub: '기본 · 그림책 같은 마을' },
    { id: 'card', name: '카드', sub: '인쇄용 카드와 같은 그림' },
  ];
  skins.forEach((s, i) => {
    const X = i * 262;
    c.rect(X, 0, 244, 232, 'fg-surf2', 18);
    c.text(X + 20, 36, s.name, { size: 19, anchor: 'start', bold: true });
    c.text(X + 20, 58, s.sub, { size: 14, anchor: 'start', tone: 'mut' });
    (['q-s', 'h-c', 'stand'] as KindId[]).forEach((k, j) => skinTile(c, s.id, X + 14 + j * 76, 76, k, 0, 0.7));
    const M = s.id === 'village' ? VG : CARD;
    COLORS.forEach((col, j) => {
      const px = X + 40 + j * 54;
      c.raw(`<g transform="translate(${px} 206) scale(1.15)">${s.id === 'village' ? (M as typeof VG).meeple(0, 0, col.hex, '') : (M as typeof CARD).meepleFigure(0, 0, col.hex, '')}</g>`);
      c.grow(px - 16, 166, px + 16, 210);
    });
  });
  c.pill(250, 262, '메뉴 → 그림 테마에서 바꿔요', { size: 14.5, tone: 'soft' });
  return c.done('그림 테마는 두 가지: 그림책 같은 기본 테마 음악 마을과 인쇄용 카드와 같은 그림의 카드 테마. 타일과 지휘자 모양이 달라진다');
}

// ═════════ 12장 · 자주 묻는 질문 ═════════
export function faqBarNo(): Fig {
  // ① 리듬선이 닿지 않는 변
  const a = newScene();
  put(a, 1, 0, 'q-s'); placeOnly(a, 'h-s', 1, 1, 0);
  const A = new Canvas();
  drawState(A, a);
  A.ring(1, 1, 'acc');
  A.barGhost('h1,1', 'no');
  A.text(260, 168, '리듬선이 닿지 않는 변', { size: 15, anchor: 'start', tone: 'no', bold: true });
  A.text(260, 190, '(위아래는 배경끼리 맞닿은 곳)', { size: 14, anchor: 'start', tone: 'mut' });
  // ② 음표 없는 빈 마디
  const b = newScene();
  placeOnly(b, 'q-s', 1, 0, 0);
  const B = new Canvas();
  drawState(B, b);
  B.ring(1, 0, 'acc');
  B.barGhost('v1,0', 'no');
  B.text(50, 142, '여기 왼쪽은 음표가 없는 마디', { size: 15, anchor: 'start', tone: 'no', bold: true });
  // ③ 이미 계산이 끝난 마디 안
  const { st } = sampleRun()[3];
  const d = R.clone(st);
  placeOnly(d, 'q-c', 4, 0, 0);
  const C = new Canvas();
  C.band(50, 400, 0, 'ok');
  drawState(C, d);
  C.ring(4, 0, 'acc');
  C.barGhost('v3,0', 'no');
  C.text(225, 142, '이미 점수를 받은 마디', { size: 15, tone: 'ok', bold: true });
  return stack([
    { c: A, mark: 'no', title: '배경 변 사이에는 못 꽂아요' },
    { c: B, mark: 'no', title: '음표가 하나도 없는 마디는 못 만들어요' },
    { c: C, mark: 'no', title: '계산이 끝난 마디 안에는 못 꽂아요' },
  ]).done('마디줄을 꽂을 수 없는 경우: 리듬선이 닿지 않는 배경 변 사이, 시작 타일 바로 옆처럼 음표가 없는 마디가 생기는 이음새, 이미 점수를 받은 마디 안쪽 이음새');
}

export function faqBarUnder(): Fig {
  const a = newScene();
  a.cfg.noUnderClose = true;
  placeOnly(a, 'q-s', 1, 0, 0);
  const okA = R.barSpots(a).some((s) => s.seam === 'v2,0');
  const ia = measureInfo(a, 1, 0);
  const A = new Canvas();
  drawState(A, a);
  A.ring(1, 0, 'acc');
  if (!okA) A.barGhost('v2,0', 'no');
  A.eqn(125, 168, ia.terms, { sum: ia.sum, ok: false });
  A.text(125, 214, `목표 ${fb(ia.target)}박에 못 미쳐서 닫을 수 없어요`, { size: 15, tone: 'no', bold: true });
  const b = newScene();
  b.cfg.noUnderClose = true;
  put(b, 1, 0, 'q-s'); put(b, 2, 0, 'h-s');
  placeOnly(b, 'h-s', 3, 0, 0);
  const okB = R.barSpots(b).some((s) => s.seam === 'v4,0');
  const ib = measureInfo(b, 3, 0);
  const B = new Canvas();
  drawState(B, b);
  B.ring(3, 0, 'acc');
  if (okB) B.barGhost('v4,0');
  B.eqn(225, 168, ib.terms, { sum: ib.sum, ok: false });
  B.text(225, 214, '넘친 마디는 닫을 수 있어요 (0점 — 막기용)', { size: 15, tone: 'mut', bold: true });
  return stack([
    { c: A, mark: 'no', title: '덜 찬 마디는 닫을 수 없어요', sub: '옵션 「덜 찬 마디 닫기 금지」가 켜져 있을 때' },
    { c: B, mark: 'ok', title: '넘친 마디로는 닫을 수 있어요', sub: '남의 마디를 넘치게 만들어 막는 수예요' },
  ]).done('덜 찬 마디 닫기 금지 옵션이 켜져 있으면 1박짜리 마디는 마디줄로 닫을 수 없지만 5박으로 넘친 마디는 닫을 수 있어 상대 마디를 막을 수 있다');
}

void ART;
