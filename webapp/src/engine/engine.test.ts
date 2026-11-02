import { describe, test, expect } from 'vitest';
import * as R from './engine';
import * as AI from './ai';
import type { State, KindId, GameEvent } from './engine';

const P2 = [{ name: 'P1', type: 'human' as const }, { name: 'P2', type: 'human' as const }];
const game = (extra: Partial<R.Config> = {}) => R.newGame({ players: P2, seed: 42, ...extra });
const seams = (st: State) => R.barSpots(st).map((b) => b.seam).sort();
const put = (st: State, x: number, y: number, k: KindId, r = 0) => { st.board[`${x},${y}`] = { k, r, n: ++st.serial, p: 0 }; if (R.kindOf(k).shape === 'timesig') st.ts++; };

describe('0단계에서 옮겨 온 규칙', () => {
  test('타일 기하: 회전과 변', () => {
    expect(R.GEOM['q-s'][0].edges).toEqual([false, true, false, true]);
    expect(R.GEOM['q-s'][1].edges).toEqual([true, false, true, false]);
    expect(R.GEOM['q-c'][0].edges).toEqual([false, false, true, true]);
    expect(R.GEOM['q-c'][1].edges).toEqual([true, false, false, true]);
    expect(R.ROTATIONS['q-s']).toEqual([0, 1]);
    expect(R.ROTATIONS['q-c']).toEqual([0, 1, 2, 3]);
    expect(R.ROTATIONS.stand).toEqual([0]);
    expect(R.ROTATIONS.ts34).toEqual([0, 1, 2, 3]); // 숫자 쪽 방향이 달라 4가지
    expect(R.ROTATIONS.qr).toEqual([0, 1]);
  });

  test('세트 수량 = 카드 마스터 데이터', () => {
    expect(R.tileCount({ set: 'mvp', level: 1 })).toBe(40);
    expect(R.tileCount({ set: 'full', level: 1 })).toBe(72);
    expect(R.tileCount({ set: 'mvp', level: 0 })).toBe(35);
    expect(R.tileCount({ set: 'mvp', level: 2 })).toBe(60); // MVP 40 + 심화 20
    expect(R.tileCount({ set: 'full', level: 2 })).toBe(92); // 카드 마스터 데이터 합계 92장
    expect(R.barCount({ set: 'mvp', level: 2 })).toBe(32);
  });

  test('설계서 13장 샘플: 1+2+1=4박 → 6점', () => {
    const st = game();
    st.hands[0] = ['q-s', 'q-s', 'h-s'];
    st.hands[1] = ['h-s', 'q-s', 'q-s'];
    R.applyPlace(st, 0, 1, 0, 0);
    expect(R.conductorSpots(st)).toEqual([{ x: 1, y: 0, f: 0 }]);
    R.applyConductor(st, { x: 1, y: 0, f: 0 });
    expect(seams(st)).toEqual(['v2,0']);
    expect(R.endTurn(st)).toEqual([]);
    R.applyPlace(st, 0, 2, 0, 0);
    expect(R.conductorSpots(st)).toEqual([]);
    R.endTurn(st);
    R.applyPlace(st, st.hands[0].indexOf('q-s'), 3, 0, 0);
    R.applyBar(st, 'v4,0');
    const ev = R.endTurn(st) as R.MeasureEvent[];
    expect(ev).toHaveLength(1);
    expect(ev[0]).toMatchObject({ ok: true, sum: 4, notes: 3, points: 6, winners: [0], target: 4 });
    expect(ev[0].order.filter((o) => o.note).map((o) => o.beats)).toEqual([1, 2, 1]);
    expect(st.players[0].score).toBe(6);
    expect(st.players[0].meeples).toBe(6);
  });

  test('틀린 마디 1+2+2=5박 → 0점, 지휘자 회수', () => {
    const st = game();
    st.hands[0] = ['q-s', 'h-s', 'q-s'];
    st.hands[1] = ['h-s', 'q-s', 'q-s'];
    R.applyPlace(st, 0, 1, 0, 0);
    R.applyConductor(st, { x: 1, y: 0, f: 0 });
    R.endTurn(st);
    R.applyPlace(st, 0, 2, 0, 0);
    R.endTurn(st);
    R.applyPlace(st, st.hands[0].indexOf('h-s'), 3, 0, 0);
    R.applyBar(st, 'v4,0');
    const ev = R.endTurn(st) as R.MeasureEvent[];
    expect(ev[0]).toMatchObject({ ok: false, sum: 5, points: 0 });
    expect(st.players[0].meeples).toBe(6);
  });

  test('마디 합치기 + 타일로 닫기 + 지휘자 동수', () => {
    const st = game();
    st.hands[0] = ['q-c', 'q-c', 'q-s'];
    st.hands[1] = ['h-s', 'q-s', 'q-s'];
    R.applyPlace(st, 0, 1, 0, 0);
    R.applyConductor(st, { x: 1, y: 0, f: 0 });
    R.endTurn(st);
    R.applyPlace(st, 0, 0, 1, 0);
    R.applyConductor(st, { x: 0, y: 1, f: 0 });
    R.applyBar(st, 'v0,1');
    R.endTurn(st);
    R.applyPlace(st, st.hands[0].indexOf('q-c'), 1, 1, 1);
    expect(R.conductorSpots(st)).toEqual([]);
    const ev = R.endTurn(st) as R.MeasureEvent[];
    expect(ev[0]).toMatchObject({ sum: 4, points: 6, winners: [0, 1] });
    R.applyPlace(st, st.hands[1].indexOf('q-s'), 2, 1, 1);
    expect(seams(st)).toEqual(['h2,1', 'h2,2']);
  });

  test('Lv0: 정확히 4박일 때만 닫기', () => {
    const st = game({ level: 0 });
    st.hands[0] = ['q-s', 'w-s', 'h-s'];
    st.hands[1] = ['w-s', 'q-s', 'q-s'];
    R.applyPlace(st, 0, 1, 0, 0);
    expect(seams(st)).toEqual([]);
    R.endTurn(st);
    R.applyPlace(st, 0, -1, 0, 0);
    expect(seams(st)).toEqual(['v-1,0']);
  });

  test('덜 찬 마디 닫기 금지 옵션', () => {
    const st = game({ noUnderClose: true });
    st.hands[0] = ['q-s', 'w-s', 'h-s'];
    st.hands[1] = ['w-s', 'q-s', 'q-s'];
    R.applyPlace(st, 0, 1, 0, 0);
    expect(seams(st)).toEqual([]);
    R.endTurn(st);
    R.applyPlace(st, 0, 2, 0, 0);
    expect(seams(st)).toEqual(['v3,0']); // 1+4=5박, 넘친 마디로 막기는 가능
  });

  test('지휘대 9점, 게임 끝 미완성 1점/장, 열린 마디 0점', () => {
    const st = game();
    st.hands[0] = ['stand', 'q-s', 'q-s'];
    R.applyPlace(st, 0, 0, 1, 0);
    R.applyConductor(st, { x: 0, y: 1, f: 's' });
    R.resolveTurn(st);
    const fe = R.finalScoring(st);
    expect(fe[0]).toMatchObject({ type: 'openStand', points: 2 });
  });
});

describe('Lv2 심화', () => {
  test('쉼표는 박자합에 더하고 점수는 1점/장', () => {
    const st = game({ level: 2 });
    st.hands[0] = ['q-s', 'qr', 'h-s'];
    st.hands[1] = ['q-s', 'q-s', 'q-s'];
    R.applyPlace(st, 0, 1, 0, 0); // 1
    R.applyConductor(st, { x: 1, y: 0, f: 0 });
    R.endTurn(st);
    st.hands[1] = ['qr', 'q-s', 'q-s'];
    R.applyPlace(st, 0, 2, 0, 0); // 쉼 1
    R.endTurn(st);
    R.applyPlace(st, st.hands[0].indexOf('h-s'), 3, 0, 0); // 2
    R.applyBar(st, 'v4,0');
    const ev = R.endTurn(st) as R.MeasureEvent[];
    expect(ev[0]).toMatchObject({ ok: true, sum: 4, notes: 2, rests: 1, points: 5 });
  });

  test('8분음표·점4분음표 분수 합: 0.5 + 0.5 + 1.5 + 1.5 = 4', () => {
    const st = game({ level: 2 });
    put(st, 1, 0, 'e-s'); put(st, 2, 0, 'e-s'); put(st, 3, 0, 'dq-s'); put(st, 4, 0, 'dq-s');
    st.bars['v5,0'] = { p: 0, t: 1 };
    const seg = R.segmentOf(st, 1, 0, 0);
    expect(seg.closed).toBe(true);
    expect(seg.sum).toBe(4);
  });

  test('박자표: 숫자 쪽 마디는 3박, 반대쪽은 4/4', () => {
    const st = game({ level: 2 });
    // 시작(4/4) … (1,0) 4분 … (2,0) 3/4 박자표(숫자가 오른쪽) … (3,0) 2분 (4,0) 4분
    put(st, 1, 0, 'q-s');
    put(st, 2, 0, 'ts34', 0);
    put(st, 3, 0, 'h-s');
    put(st, 4, 0, 'q-s');
    const left = R.segmentOf(st, 1, 0, 0);
    expect(R.targetsOf(st, left)).toEqual([4]);
    const right = R.segmentOf(st, 3, 0, 0);
    expect(R.targetsOf(st, right)).toEqual([3]);
    // 박자표를 반대로 돌리면(숫자가 왼쪽) 왼쪽 마디가 3박
    st.board['2,0'].r = 2;
    expect(R.targetsOf(st, R.segmentOf(st, 1, 0, 0))).toEqual([3, 4]); // 시작 타일 4/4와 같은 거리에서 마주 봄 → 둘 다 인정
    expect(R.targetsOf(st, R.segmentOf(st, 3, 0, 0))).toEqual([4]); // 박자표 뒤쪽 + 열린 끝 → 기본 4/4
  });

  test('박자표는 마디줄을 건너 다음 박자표까지 이어진다', () => {
    const st = game({ level: 2 });
    put(st, 1, 0, 'ts24', 0); // 2/4, 숫자가 오른쪽
    put(st, 2, 0, 'h-s');
    st.bars['v3,0'] = { p: 0, t: 1 };
    put(st, 3, 0, 'q-s');
    put(st, 4, 0, 'q-s');
    expect(R.targetsOf(st, R.segmentOf(st, 2, 0, 0))).toEqual([2]);
    expect(R.targetsOf(st, R.segmentOf(st, 3, 0, 0))).toEqual([2]); // 마디줄 하나 건너도 2/4
  });

  test('2/4 마디를 2박으로 닫으면 정답(덜 찬 마디 금지여도 가능)', () => {
    const st = game({ level: 2, noUnderClose: true });
    st.hands[0] = ['ts24', 'h-s', 'q-s'];
    st.hands[1] = ['h-s', 'q-s', 'q-s'];
    // 시작 타일 아래(배경 변)로 새 줄을 열 수 있게 박자표를 (0,1)에 → 리듬선은 좌우, 숫자는 오른쪽
    R.applyPlace(st, 0, 0, 1, 0);
    expect(R.conductorSpots(st)).toEqual([]); // 박자표 타일에는 지휘자 없음
    R.endTurn(st);
    R.applyPlace(st, 0, 1, 1, 0); // 2분음표
    R.applyConductor(st, { x: 1, y: 1, f: 0 });
    expect(seams(st)).toContain('v2,1');
    R.applyBar(st, 'v2,1');
    const ev = R.endTurn(st) as R.MeasureEvent[];
    expect(ev[0]).toMatchObject({ ok: true, sum: 2, target: 2, points: 2, winners: [1] });
  });

  test('박자표 타일을 놓아 덜 찬 4/4 마디를 닫는 수는 금지 옵션에서 막힌다', () => {
    const st = game({ level: 2, noUnderClose: true });
    put(st, 1, 0, 'q-s');
    expect(R.canPlace(st, 'ts34', 0, 2, 0)).toBe(false); // 4/4 마디가 1박에서 닫힘
    st.cfg.noUnderClose = false;
    expect(R.canPlace(st, 'ts34', 0, 2, 0)).toBe(true);
  });
});

// ── 무작위 대국: 불변식 ──────────────────────────────────────────────
function randomTurn(st: State, rnd: () => number): GameEvent[] {
  const p = st.turn.p;
  const opts: [number, number, number, number][] = [];
  st.hands[p].forEach((k, hi) => { for (const pl of R.placements(st, k)) for (const r of pl.rots) opts.push([hi, pl.x, pl.y, r]); });
  if (!opts.length) return R.discardForNoMove(st, 0).events;
  const [hi, x, y, r] = opts[Math.floor(rnd() * opts.length)];
  R.applyPlace(st, hi, x, y, r);
  const ms = R.conductorSpots(st);
  if (ms.length && rnd() < 0.5) R.applyConductor(st, ms[Math.floor(rnd() * ms.length)]);
  const bs = R.barSpots(st);
  if (bs.length && rnd() < 0.6) R.applyBar(st, bs[Math.floor(rnd() * bs.length)].seam);
  return R.endTurn(st);
}

function check(st: State, total: number, initBars: number) {
  st.players.forEach((pl, i) => expect(pl.meeples + st.meeples.filter((m) => m.p === i).length).toBe(st.cfg.meeples));
  expect(st.barsLeft + Object.keys(st.bars).length).toBe(initBars);
  const inHands = st.hands.reduce((a, h) => a + h.length, 0);
  expect(Object.keys(st.board).length + st.discards.length + st.bag.length + inHands).toBe(total);
  for (const seg of R.allSegments(st)) if (seg.closed) for (const p of seg.pieces) expect(st.scored[R.pieceKey(p.x, p.y, p.pi)]).toBeTruthy();
  expect(st.ts).toBe(Object.values(st.board).filter((t) => R.kindOf(t.k).shape === 'timesig').length);
}

test('무작위 대국 360판 (세트·난이도 0~2·인원 전 조합): 보존 법칙', () => {
  let games = 0;
  for (let seed = 1; seed <= 20; seed++) {
    for (const set of ['mvp', 'full'] as const) {
      for (const level of [0, 1, 2] as const) {
        for (const n of [2, 3, 4]) {
          const players = Array.from({ length: n }, (_, i) => ({ name: `P${i}`, type: 'ai' as const }));
          const st = R.newGame({ players, seed, set, level, softEnd: seed % 2 === 0, noUnderClose: seed % 3 !== 0 });
          const total = R.tileCount(st.cfg);
          const initBars = st.barsLeft;
          const rnd = R.mulberry32(seed * 977 + n + level * 31);
          let sumPoints = 0, guard = 0;
          while (!st.over) {
            const ev = randomTurn(st, rnd);
            ev.forEach((e) => { sumPoints += e.points * ('winners' in e ? e.winners.length : e.owner != null ? 1 : 0); });
            check(st, total, initBars);
            expect(++guard).toBeLessThan(500);
          }
          expect(st.players.reduce((a, pl) => a + pl.score, 0)).toBeCloseTo(sumPoints, 6);
          expect(st.meeples).toHaveLength(0);
          games++;
        }
      }
    }
  }
  expect(games).toBe(360);
}, 120000);

test('컴퓨터끼리 Lv2 대국이 끝까지 진행되고, 보통 AI가 무작위를 이긴다', () => {
  for (let seed = 1; seed <= 4; seed++) {
    const st = R.newGame({ players: [{ name: 'A', type: 'ai' }, { name: 'B', type: 'ai' }], seed, level: 2, noUnderClose: true });
    const total = R.tileCount(st.cfg);
    const initBars = st.barsLeft;
    while (!st.over) {
      const plan = AI.planMove(st, seed % 2 ? 'easy' : 'normal');
      if (!plan) { R.discardForNoMove(st, AI.pickDiscard(st)); continue; }
      R.applyPlace(st, plan.hi, plan.x, plan.y, plan.r);
      if (plan.meeple) R.applyConductor(st, plan.meeple);
      if (plan.bar) R.applyBar(st, plan.bar);
      R.endTurn(st);
      check(st, total, initBars);
    }
    expect(st.players.some((p) => p.score > 0)).toBe(true);
  }
  let wins = 0;
  for (let seed = 200; seed < 216; seed++) {
    const st = R.newGame({ players: [{ name: 'AI', type: 'ai' }, { name: 'RND', type: 'ai' }], seed, noUnderClose: true });
    const rnd = R.mulberry32(seed);
    const seat = seed % 2;
    while (!st.over) {
      if (st.turn.p === seat) {
        const plan = AI.planMove(st);
        if (!plan) { R.discardForNoMove(st, 0); continue; }
        R.applyPlace(st, plan.hi, plan.x, plan.y, plan.r);
        if (plan.meeple) R.applyConductor(st, plan.meeple);
        if (plan.bar) R.applyBar(st, plan.bar);
        R.endTurn(st);
      } else randomTurn(st, rnd);
    }
    if (st.players[seat].score > st.players[1 - seat].score) wins++;
  }
  expect(wins).toBeGreaterThanOrEqual(14);
}, 240000);

test('어려움: 끝까지 합법적인 수만 두고, 시간 한도가 0이어도 수를 고른다', () => {
  const st = R.newGame({ players: [{ name: 'H', type: 'ai' }, { name: 'N', type: 'ai' }], seed: 77, level: 2, noUnderClose: true });
  const total = R.tileCount(st.cfg);
  const initBars = st.barsLeft;
  let turns = 0;
  while (!st.over) {
    const lv = st.turn.p === 0 ? 'hard' : 'normal';
    const plan = AI.planMove(st, lv, { ...AI.HARD, budgetMs: turns % 3 === 0 ? 0 : Infinity });
    if (!plan) { R.discardForNoMove(st, AI.pickDiscard(st)); continue; }
    expect(R.canPlace(st, plan.k, plan.r, plan.x, plan.y)).toBe(true);
    expect(st.hands[st.turn.p][plan.hi]).toBe(plan.k);
    R.applyPlace(st, plan.hi, plan.x, plan.y, plan.r);
    if (plan.meeple) R.applyConductor(st, plan.meeple);
    if (plan.bar) R.applyBar(st, plan.bar);
    R.endTurn(st);
    check(st, total, initBars);
    turns++;
  }
  expect(turns).toBeGreaterThan(20);
}, 120000);

test('빠른 복사·제자리 되돌리기로 바꾼 뒤에도 보통 AI의 수는 그대로 (같은 시드 같은 결과)', () => {
  const st = R.newGame({ players: [{ name: 'A', type: 'ai' }, { name: 'B', type: 'ai' }], seed: 5, noUnderClose: true });
  const before = JSON.stringify(st);
  const a = AI.planMove(st, 'normal');
  expect(JSON.stringify(st)).toBe(before); // 계산이 원래 상태를 건드리지 않음
  expect(AI.planMove(st, 'normal')).toEqual(a);
});
