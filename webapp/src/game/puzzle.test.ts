import { describe, test, expect } from 'vitest';
import * as P from './puzzle';
import * as R from '../engine/engine';

describe('학습 퍼즐', () => {
  test('단원 문제 36개: id가 겹치지 않고 줄 표기가 맞다', () => {
    expect(P.ALL_PUZZLES).toHaveLength(36);
    expect(new Set(P.ALL_PUZZLES.map((p) => p.id)).size).toBe(36);
    for (const def of P.ALL_PUZZLES) {
      const st = P.buildState(def);
      expect(Object.keys(st.board).length).toBeGreaterThan(0);
      expect(st.ts).toBe(Object.values(st.board).filter((t) => R.kindOf(t.k).shape === 'timesig').length);
    }
  });

  test('모든 문제가 풀리고, 틀릴 수 있는 선택지도 있다 (마디줄 긋기는 정답이 하나)', () => {
    for (const def of P.ALL_PUZZLES) {
      const r = P.explore(def);
      if (def.type === 'count') {
        expect(def.choices).toContain(def.answer);
        expect(def.choices!.length).toBeGreaterThanOrEqual(3);
      } else if (def.type === 'divide') {
        expect(r.solutions, def.id).toBe(1);
        expect(r.attempts, def.id).toBeGreaterThan(1);
      } else {
        expect(r.solutions, def.id).toBeGreaterThanOrEqual(1);
        expect(r.attempts, def.id).toBeGreaterThan(r.solutions);
      }
      expect(def.hints.length, def.id).toBeGreaterThanOrEqual(1);
    }
  });

  test('채우기 검사: 넘침·모자람·열린 마디를 구별해 알려 준다', () => {
    const def = P.puzzleById('1-5')!; // S q h → 1박 모자람
    const st = P.buildState(def);
    expect(P.check(def, st, 0).msg).toContain('타일');
    R.applyPlace(st, st.hands[0].indexOf('h-s'), 3, 0, 0); // 1+2+2 = 5
    st.turn = { p: 0, placed: null, meeple: null, bar: null, resolved: false };
    expect(P.check(def, st, 1).msg).toContain('마디줄');
    st.bars['v4,0'] = { p: 0, t: 1 }; st.barsLeft--;
    const r = P.check(def, st, 1);
    expect(r.ok).toBe(false);
    expect(r.msg).toBe('5박이에요. 목표 4박보다 1박 많아요.');
  });

  test('박자표 문제는 3/4·2/4 목표로 검사한다', () => {
    const def = P.puzzleById('5-7')!;
    const st = P.buildState(def);
    expect(R.targetsOf(st, P.goalSegment(st, def)!)).toEqual([3]);
    const r = P.explore(def);
    expect(r.sample).toBe('q-s@6,0 v7,0');
  });

  test('마디줄 후보: 빈 마디를 만드는 자리(시작 타일 바로 옆)는 빠진다', () => {
    const st = P.buildState(P.puzzleById('1-9')!);
    const seams = P.puzzleSeams(st);
    expect(seams).not.toContain('v1,0');
    expect(seams).not.toContain('v0,0');
    expect(seams).toEqual(['v2,0', 'v3,0', 'v4,0', 'v5,0', 'v6,0']);
  });

  test('무한 연습: 난이도별 300문제가 모두 풀리고(마디줄은 정답 하나), 보드가 너무 길지 않다', () => {
    for (const lv of [0, 1, 2] as const) {
      const types = new Set<string>();
      for (let seed = 1; seed <= 300; seed++) {
        const d = P.genDrill(lv, seed);
        types.add(d.type);
        const r = P.explore(d);
        if (d.type === 'divide') expect(r.solutions, `${lv}/${seed} ${d.line}`).toBe(1);
        else {
          expect(r.solutions, `${lv}/${seed} ${d.line}`).toBeGreaterThanOrEqual(1);
          expect(r.attempts).toBeGreaterThan(r.solutions);
          expect(new Set(d.hand!.map(P.beatsOf)).size).toBe(d.hand!.length); // 손패 박 수가 서로 다름
        }
        expect(P.parseLine(d.line).width).toBeLessThanOrEqual(9);
        if (lv < 2) expect(d.line).not.toMatch(/T[23]|qr|er|hr|\be\b|dq/);
        expect(P.genDrill(lv, seed)).toEqual(d); // 같은 seed = 같은 문제
      }
      expect(types).toEqual(new Set(['fill', 'divide']));
    }
  }, 60000);
});
