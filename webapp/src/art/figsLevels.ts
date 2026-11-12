/* 룰북 삽화 — 8~9장: 난이도(Lv0·Lv1·Lv2) · 심화 규칙(8분·점4분·쉼표·박자표) */
import * as R from '../engine/engine';
import type { KindId } from '../engine/engine';
import { Canvas, newScene, put, putBar, clearBoard, drawState, placeOnly, measureInfo, tw, P1, type Fig } from './rulebook';
import { fb, stack, lineScene, settleNote, ruler } from './rulebookKit';

// ═════════ 8장 · 난이도 ═════════
export function levelsLadder(): Fig {
  const c = new Canvas();
  const W = 520, H = 156, gap = 38;
  const cards: Array<{ lv: R.LevelId; tiles: KindId[]; plus: boolean }> = [
    { lv: 0, tiles: ['q-s', 'h-s', 'w-s'], plus: false },
    { lv: 1, tiles: ['dh-s', 'stand'], plus: true },
    { lv: 2, tiles: ['e-s', 'dq-s', 'qr', 'er', 'hr', 'ts34', 'ts24'], plus: true },
  ];
  cards.forEach((cd, i) => {
    const y = i * (H + gap);
    const L = R.LEVELS[cd.lv];
    c.rect(0, y, W, H, 'fg-surf2', 18);
    c.text(20, y + 38, L.label, { size: 21, anchor: 'start', bold: true });
    const cnt = `타일 ${R.tileCount({ set: 'mvp', level: cd.lv })}장 · 마디줄 ${R.barCount({ set: 'mvp', level: cd.lv })}개`;
    const pw = tw(cnt, 14) + 28;
    c.pill(W - 18 - pw / 2, y + 32, cnt, { size: 14, tone: 'soft' });
    c.text(20, y + 66, L.short, { size: 14.5, anchor: 'start', tone: 'mut' });
    let x = 20;
    if (cd.plus) { c.text(x + 8, y + 122, '+', { size: 28, display: true, tone: 'acc' }); x += 34; }
    cd.tiles.forEach((k, j) => {
      const tx = x + j * 64;
      c.tilePx(tx, y + 84, k, 0, { s: 0.6 });
      if (cd.plus) c.raw(`<rect class="fg-ring acc" style="stroke-width:3px" x="${tx + 1}" y="${y + 85}" width="58" height="58" rx="8"/>`);
    });
    if (i < cards.length - 1) {
      const next = (cd.lv + 1) as R.LevelId;
      const dt = R.tileCount({ set: 'mvp', level: next }) - R.tileCount({ set: 'mvp', level: cd.lv });
      const db = R.barCount({ set: 'mvp', level: next }) - R.barCount({ set: 'mvp', level: cd.lv });
      c.arrow(W / 2, y + H + 6, W / 2, y + H + gap - 6, { tone: 'acc' });
      c.text(W / 2 + 16, y + H + gap / 2 + 6, `타일 +${dt}장${db ? ` · 마디줄 +${db}개` : ''}`, { size: 14.5, anchor: 'start', tone: 'acc', bold: true });
    }
  });
  return c.done('난이도 세 단계: Lv0 입문은 1·2·4박 음표만, Lv1 기본은 3박 음표와 지휘대가 더해지고, Lv2 심화는 8분음표·점4분음표·쉼표·3/4·2/4 박자표가 더해진다');
}

export function levelsLv0(): Fig {
  const base = newScene(0);
  put(base, 1, 0, 'q-s');
  const a = R.clone(base);
  placeOnly(a, 'h-s', 2, 0, 0);
  const b = R.clone(a);
  put(b, 3, 0, 'q-s');
  const spotsA = R.barSpots(a).map((s) => s.seam);
  const spotsB = R.barSpots(b).map((s) => s.seam);
  const A = new Canvas();
  drawState(A, a);
  A.ring(2, 0, 'acc');
  if (!spotsA.includes('v3,0')) A.barGhost('v3,0', 'no');
  const ia = measureInfo(a, 2, 0);
  A.eqn(150, 168, ia.terms, { sum: ia.sum, ok: false });
  A.text(150, 214, '4박이 아니라서 마디줄을 꽂을 수 없어요', { size: 15, tone: 'no', bold: true });
  const B = new Canvas();
  drawState(B, b);
  B.ring(3, 0, 'acc');
  for (const sk of spotsB) B.barGhost(sk);
  const ib = measureInfo(b, 3, 0);
  B.eqn(200, 168, ib.terms, { sum: ib.sum, ok: ib.ok });
  B.text(200, 214, '딱 4박이면 마디줄을 꽂을 수 있어요', { size: 15, tone: 'ok', bold: true });
  return stack([
    { c: A, mark: 'no', title: '3박에서는 닫을 수 없어요' },
    { c: B, mark: 'ok', title: '4박이 되면 닫을 수 있어요' },
  ]).done('Lv0에서는 마디줄을 마디가 딱 4박일 때만 꽂을 수 있다. 시작 타일 오른쪽의 마디가 3박일 때는 닫을 수 없고 4박이 되면 닫을 수 있다');
}

// ═════════ 9장 · 심화 Lv2 ═════════
export function lv2Values(): Fig {
  return stack([
    { c: ruler(['e-s', 'dq-s'], 2, { u: 104 }), title: '새 음표' },
    { c: ruler(['qr', 'er', 'hr'], 2, { u: 104 }), title: '쉼표 — 소리는 없지만 박자는 세요' },
  ], { gap: 34 }).done('Lv2에서 더해지는 박자값: 8분음표 반 박, 점4분음표 한 박 반, 4분쉼표 1박, 8분쉼표 반 박, 2분쉼표 2박');
}

export function lv2Add(): Fig {
  const st = lineScene(['e-s', 'e-s', 'q-s', 'h-s'], { barL: true, barR: true, conductors: [[0, P1]] });
  const c = new Canvas();
  c.band(0, 400, 0);
  drawState(c, st);
  c.bracket(0, 200, -12, '8분음표 두 장 = 1박', { up: true, tone: 'acc', size: 16 });
  settleNote(c, st, [0, 0], [0, 400]);
  return c.done('8분음표 두 장(반 박씩), 4분음표, 2분음표를 이으면 0.5+0.5+1+2로 4박이 되어 음표 네 장 × 2점 = 8점이다');
}

export function lv2Rest(): Fig {
  const st = lineScene(['q-s', 'qr', 'h-s'], { barL: true, barR: true, conductors: [[0, P1]] });
  const c = new Canvas();
  c.band(0, 300, 0);
  drawState(c, st);
  c.text(150, -28, '쉼표 · 소리 없음, 박자는 1박', { size: 15, tone: 'acc', bold: true });
  c.lead(150, -16, 150, 6, 'acc');
  settleNote(c, st, [0, 0], [0, 300]);
  return c.done('4분음표, 4분쉼표, 2분음표를 이으면 1+(1)+2로 4박이 되고 음표 두 장 × 2점에 쉼표 한 장 × 1점을 더해 5점이다');
}

export function lv2Ts(): Fig {
  const st = newScene(2);
  put(st, 1, 0, 'w-s'); put(st, 2, 0, 'ts34', 0); put(st, 3, 0, 'q-s'); put(st, 4, 0, 'h-s');
  putBar(st, 'v5,0');
  const a = measureInfo(st, 1, 0), b = measureInfo(st, 3, 0);
  const c = new Canvas();
  c.band(50, 250, 0, a.ok ? 'ok' : 'no'); c.band(250, 500, 0, b.ok ? 'ok' : 'no');
  drawState(c, st);
  c.text(250, -30, '3/4 박자표 타일', { size: 15, tone: 'acc', bold: true });
  c.lead(250, -18, 250, 8, 'acc');
  c.bracket(50, 250, 124, `목표 ${fb(a.target)}박 (4/4)`, { tone: a.ok ? 'ok' : 'no', size: 16 });
  c.bracket(250, 500, 124, `목표 ${fb(b.target)}박 (3/4)`, { tone: b.ok ? 'ok' : 'no', size: 16 });
  c.eqn(150, 200, a.terms, { sum: a.sum, ok: a.ok });
  c.eqn(375, 200, b.terms, { sum: b.sum, ok: b.ok });
  return c.done('시작 타일의 4/4를 따르는 왼쪽 마디는 온음표 한 장으로 4박, 3/4 박자표의 숫자가 적힌 오른쪽 마디는 4분음표와 2분음표로 3박이 되어 둘 다 맞는 마디다');
}

export function lv2TsFlow(): Fig {
  const c = new Canvas();
  const zones: Array<{ tile: KindId; ts: number; label: string }> = [
    { tile: 'start', ts: R.kindOf('start').ts!, label: '4/4' },
    { tile: 'ts34', ts: R.kindOf('ts34').ts!, label: '3/4' },
    { tile: 'ts24', ts: R.kindOf('ts24').ts!, label: '2/4' },
  ];
  const u = 28, rowH = 118;
  zones.forEach((z, i) => {
    const y = i * rowH;
    c.tilePx(0, y, z.tile, 0, { s: 0.8 });
    c.text(100, y + 20, `${z.label} 구간 · 마디마다 ${z.ts}박`, { size: 16, anchor: 'start', bold: true, tone: 'acc' });
    let x = 100;
    for (let m = 0; m < 3; m++) {
      const w = z.ts * u;
      c.raw(`<rect class="fg-surf" x="${x}" y="${y + 34}" width="${w}" height="44" rx="9"/>`);
      c.grow(x, y + 34, x + w, y + 78);
      for (let b = 1; b < z.ts; b++) c.line(x + b * u, y + 36, x + b * u, y + 48, { tone: 'mut', w: 2 });
      c.text(x + w / 2, y + 64, `${z.ts}박`, { size: 17, display: true });
      x += w;
      if (m < 2) { c.barAt(x + 6, y + 56, true, 0.62); x += 12; }
    }
    c.text(x + 10, y + 66, '…', { size: 22, anchor: 'start', tone: 'mut', display: true });
    if (i < zones.length - 1) {
      c.arrow(40, y + 86, 40, y + rowH - 6, { tone: 'acc' });
      c.text(54, y + 106, '다음 박자표가 나올 때까지 계속', { size: 14, anchor: 'start', tone: 'mut' });
    }
  });
  return c.done('시작 타일의 4/4 구간은 마디마다 4박, 3/4 박자표를 만나면 그다음 마디부터 3박, 2/4 박자표를 만나면 2박이며 다음 박자표가 나올 때까지 마디줄을 건너도 이어진다');
}

export function lv2TsMeet(): Fig {
  const mk = (kinds: KindId[]) => {
    const st = newScene(2);
    clearBoard(st);
    put(st, 0, 0, 'ts34', 0);
    kinds.forEach((k, i) => put(st, 1 + i, 0, k));
    put(st, 1 + kinds.length, 0, 'ts24', 2);
    const info = measureInfo(st, 1, 0);
    const c = new Canvas();
    c.band(50, 50 + (kinds.length + 1) * 100, 0, info.ok ? 'ok' : 'no');
    drawState(c, st);
    const cx = 50 + ((kinds.length + 1) * 100) / 2;
    c.eqn(cx, 158, info.terms, { sum: info.sum, ok: info.ok });
    c.text(cx, 204, `목표 ${info.targets.map(fb).join(' 또는 ')}박`, { size: 15, tone: 'mut', bold: true });
    return { c, info };
  };
  const A = mk(['q-s', 'h-s']);
  const B = mk(['h-s']);
  return stack([
    { c: A.c, mark: A.info.ok ? 'ok' : 'no', title: '3박으로 닫아도 돼요', sub: '왼쪽 3/4 박자표를 기준으로 본 거예요' },
    { c: B.c, mark: B.info.ok ? 'ok' : 'no', title: '2박으로 닫아도 돼요', sub: '오른쪽 2/4 박자표를 기준으로 본 거예요' },
  ]).done('3/4 박자표와 2/4 박자표가 같은 거리에서 한 마디를 마주 보면 그 마디는 3박이거나 2박이면 맞는 마디다');
}
