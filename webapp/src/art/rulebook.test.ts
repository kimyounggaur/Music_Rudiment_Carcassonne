import { describe, test, expect, afterEach } from 'vitest';
import * as R from '../engine/engine';
import * as SKIN from './skin';
import { FIG_IDS, buildFig } from './rulebookFigs';
import { newScene, put, putBar, putConductor, placeOnly, play, clearBoard, edgesConsistent, measureInfo, P1, P2 } from './rulebook';
import { sampleRun, standScene, STAND_RING, STAND_LAST } from './figsPlay';
import { QUIZ_DEMO } from './figsApp';
import { makeChoices } from '../game/controller';

const seams = (st: R.State) => R.barSpots(st).map((b) => b.seam).sort();
const measureOf = (ev: R.GameEvent[]) => ev.find((e): e is R.MeasureEvent => e.type === 'measure');

/* 룰북 삽화는 엔진 상태에서 그려진다. 여기서는 "그림이 말하는 숫자가 엔진 규칙과 같은지"를 같은 장면으로 확인한다. */

describe('룰북 삽화: 모든 그림이 만들어진다', () => {
  afterEach(() => SKIN.setSkin('village'));

  test.each(['village', 'card'] as const)('%s 테마에서 53장 모두 비어 있지 않다', (skin) => {
    SKIN.setSkin(skin);
    expect(FIG_IDS.length).toBeGreaterThan(40);
    for (const id of FIG_IDS) {
      const f = buildFig(id);
      const [, , w, h] = f.vb;
      expect(f.body.length, `${id} 본문`).toBeGreaterThan(200);
      expect(f.alt.length, `${id} 대체 글`).toBeGreaterThan(15);
      expect(w, `${id} 폭`).toBeGreaterThan(60);
      expect(h, `${id} 높이`).toBeGreaterThan(30);
      expect(f.body, `${id}에 NaN/undefined가 섞임`).not.toMatch(/NaN|undefined|Infinity/);
      expect(f.alt, `${id} 대체 글에 상표명`).not.toContain('카르카손');
    }
  });

  test('테마를 바꾸면 같은 그림도 다시 그려진다 (캐시가 테마별)', () => {
    SKIN.setSkin('village');
    const a = buildFig('edge-rule').body;
    SKIN.setSkin('card');
    const b = buildFig('edge-rule').body;
    expect(a).not.toBe(b);
    SKIN.setSkin('village');
    expect(buildFig('edge-rule').body).toBe(a);
  });
});

describe('샘플 플레이 (설계서 13장): 빨강·파랑이 한 마디를 완성한다', () => {
  test('4단계: 1+2+1=4박 → 음표 3장 × 2점 = 6점, 빨강이 지휘자를 돌려받는다', () => {
    const steps = sampleRun();
    expect(steps.length).toBe(4);
    const m = measureOf(steps[3].ev)!;
    expect(m.ok).toBe(true);
    expect(m.sum).toBe(4);
    expect(m.notes).toBe(3);
    expect(m.points).toBe(6);
    expect(m.winners).toEqual([P1]);
    expect(m.returned.map((r) => r.p)).toEqual([P1]);
    expect(steps[3].st.players[P1].score).toBe(6);
    expect(steps[3].st.players[P1].meeples).toBe(R.DEFAULT_CFG.meeples);
  });

  test('1·2단계: 지휘자는 올라가 있고, 정산 전 3단계에는 마디줄이 이미 꽂혀 있다', () => {
    const steps = sampleRun();
    expect(steps[0].st.meeples.length).toBe(1);
    expect(steps[0].st.players[P1].meeples).toBe(R.DEFAULT_CFG.meeples - 1);
    expect(steps[1].st.turn.p).toBe(P1); // 파랑이 놓고 나면 다시 빨강 차례
    expect(steps[2].ev).toEqual([]);
    expect(Object.keys(steps[2].st.bars)).toContain('v4,0');
    expect(steps[2].st.players[P1].score).toBe(0);
  });

  test('틀린 마디 변형: 1+2+2=5박 → 0점 (지휘자는 돌아오지만 점수는 없다)', () => {
    const steps = sampleRun(true);
    const m = measureOf(steps[3].ev)!;
    expect(m.ok).toBe(false);
    expect(m.sum).toBe(5);
    expect(m.points).toBe(0);
    expect(steps[3].st.players[P1].score).toBe(0);
    expect(steps[3].st.players[P2].score).toBe(0);
  });
});

describe('난이도 장', () => {
  test('Lv0: 3박에서는 마디줄을 꽂을 수 없고, 4박이 되면 그 자리에만 꽂을 수 있다', () => {
    const base = newScene(0);
    put(base, 1, 0, 'q-s');
    const a = R.clone(base);
    placeOnly(a, 'h-s', 2, 0, 0);
    expect(measureInfo(a, 2, 0).sum).toBe(3);
    expect(seams(a)).toEqual([]);
    const b = R.clone(a);
    put(b, 3, 0, 'q-s');
    expect(measureInfo(b, 3, 0).sum).toBe(4);
    expect(seams(b)).toEqual(['v4,0']);
  });

  test('Lv2 박자표: 4/4 마디는 4박, 3/4 구간은 3박, 두 박자표가 마주 보면 3박 또는 2박', () => {
    const st = newScene(2);
    put(st, 1, 0, 'w-s'); put(st, 2, 0, 'ts34', 0); put(st, 3, 0, 'q-s'); put(st, 4, 0, 'h-s');
    putBar(st, 'v5,0');
    expect(measureInfo(st, 1, 0).targets).toEqual([4]);
    expect(measureInfo(st, 1, 0).ok).toBe(true);
    expect(measureInfo(st, 3, 0).targets).toEqual([3]);
    expect(measureInfo(st, 3, 0).ok).toBe(true);

    const meet = (kinds: R.KindId[]) => {
      const s = newScene(2);
      clearBoard(s);
      put(s, 0, 0, 'ts34', 0);
      kinds.forEach((k, i) => put(s, 1 + i, 0, k));
      put(s, 1 + kinds.length, 0, 'ts24', 2);
      return measureInfo(s, 1, 0);
    };
    const a = meet(['q-s', 'h-s']);
    const b = meet(['h-s']);
    expect([...a.targets].sort()).toEqual([2, 3]);
    expect(a.ok).toBe(true);
    expect(a.sum).toBe(3);
    expect(b.ok).toBe(true);
    expect(b.sum).toBe(2);
  });

  test('Lv2 심화: 8분 두 장 = 1박, 쉼표는 박자는 세고 점수는 1점', () => {
    const st = newScene(2);
    put(st, 1, 0, 'e-s'); put(st, 2, 0, 'e-s'); put(st, 3, 0, 'q-s'); put(st, 4, 0, 'h-s');
    putBar(st, 'v5,0');
    const a = measureInfo(st, 1, 0);
    expect(a.sum).toBe(4);
    expect(a.ok).toBe(true);
    expect(a.points).toBe(8); // 음표 4장 × 2점

    const r = newScene(2);
    put(r, 1, 0, 'q-s'); put(r, 2, 0, 'qr'); put(r, 3, 0, 'h-s');
    putBar(r, 'v4,0');
    const rr = measureInfo(r, 1, 0);
    expect(rr.sum).toBe(4);
    expect(rr.notes).toBe(2);
    expect(rr.rests).toBe(1);
    expect(rr.points).toBe(5); // 음표 2장 × 2점 + 쉼표 1장 × 1점
  });

  test('난이도 사다리 그림의 숫자는 엔진의 타일·마디줄 수', () => {
    const body = buildFig('levels-ladder').body;
    for (const lv of [0, 1, 2] as const) {
      expect(body).toContain(`타일 ${R.tileCount({ set: 'mvp', level: lv })}장 · 마디줄 ${R.barCount({ set: 'mvp', level: lv })}개`);
    }
    expect(R.tileCount({ set: 'mvp', level: 0 })).toBe(35);
    expect(R.tileCount({ set: 'mvp', level: 1 })).toBe(40);
    expect(R.tileCount({ set: 'mvp', level: 2 })).toBe(60);
    expect(R.barCount({ set: 'mvp', level: 0 })).toBe(24);
    expect(R.barCount({ set: 'mvp', level: 2 })).toBe(32);
  });
});

describe('점수·게임 끝 장', () => {
  test('지휘대 둘레 8칸이 모두 맞게 이어지고, 마지막 칸을 채우면 바로 9점', () => {
    expect(STAND_RING.length).toBe(STAND_LAST + 1);
    expect(edgesConsistent(standScene(STAND_RING.length))).toBe(true);
    const st = standScene(STAND_LAST);
    expect(st.players[P1].score).toBe(0);
    const [x, y, k, r] = STAND_RING[STAND_LAST];
    const ev = play(st, k, x, y, r);
    const s = ev.find((e): e is R.StandEvent => e.type === 'stand')!;
    expect(s.owner).toBe(P1);
    expect(s.points).toBe(9);
    expect(st.players[P1].score).toBe(9);
    expect(st.players[P1].meeples).toBe(R.DEFAULT_CFG.meeples); // 지휘자는 돌아온다
  });

  test('게임 끝: 열린 마디는 0점 + 지휘자 회수, 덜 둘러싼 지휘대는 채운 칸 수만큼', () => {
    const sa = newScene();
    put(sa, 1, 0, 'q-s'); put(sa, 2, 0, 'h-s');
    putConductor(sa, P1, 1, 0, 0);
    const open = R.finalScoring(sa).find((e): e is R.MeasureEvent => e.type === 'openMeasure')!;
    expect(open.sum).toBe(3);
    expect(open.points).toBe(0);
    expect(open.returned.length).toBe(1);
    expect(sa.players[P1].score).toBe(0);

    const sb = newScene();
    clearBoard(sb);
    put(sb, 0, 0, 'stand'); put(sb, 0, -1, 'h-s', 0); put(sb, 0, 1, 'h-s', 0); put(sb, -1, 0, 'q-s', 1); put(sb, 1, 0, 'q-s', 1);
    putConductor(sb, P1, 0, 0, 's');
    expect(R.standFilled(sb, 0, 0)).toBe(5);
    const st = R.finalScoring(sb).find((e): e is R.StandEvent => e.type === 'openStand')!;
    expect(st.owner).toBe(P1);
    expect(st.filled).toBe(5);
    expect(st.points).toBe(5);
  });

  test('순위: 점수 → 완성한 마디 수 → 공동 순위 (그림의 세 예시)', () => {
    const rank = (a: [number, number], b: [number, number]) => {
      const st = newScene();
      st.players[0].score = a[0]; st.players[0].stats.measuresWon = a[1];
      st.players[1].score = b[0]; st.players[1].stats.measuresWon = b[1];
      return R.ranking(st).map((r) => [r.p, r.rank]);
    };
    expect(rank([30, 4], [24, 6])).toEqual([[0, 1], [1, 2]]);
    expect(rank([24, 5], [24, 3])).toEqual([[0, 1], [1, 2]]);
    expect(rank([24, 4], [24, 4])).toEqual([[0, 1], [1, 1]]);
  });
});

describe('자주 묻는 질문 장', () => {
  test('마디줄을 꽂을 수 없는 세 자리: 배경 변 사이 · 음표 없는 마디 · 이미 계산된 마디 안', () => {
    const a = newScene();
    put(a, 1, 0, 'q-s'); placeOnly(a, 'h-s', 1, 1, 0);
    expect(seams(a)).not.toContain('h1,1');

    const b = newScene();
    placeOnly(b, 'q-s', 1, 0, 0);
    expect(seams(b)).not.toContain('v1,0');

    const { st } = sampleRun()[3];
    const d = R.clone(st);
    placeOnly(d, 'q-c', 4, 0, 0);
    expect(seams(d)).not.toContain('v3,0');
  });

  test('덜 찬 마디는 닫을 수 없지만(옵션) 넘친 마디로는 닫을 수 있다', () => {
    const a = newScene();
    a.cfg.noUnderClose = true;
    placeOnly(a, 'q-s', 1, 0, 0);
    expect(measureInfo(a, 1, 0).sum).toBe(1);
    expect(seams(a)).not.toContain('v2,0');

    const b = newScene();
    b.cfg.noUnderClose = true;
    put(b, 1, 0, 'q-s'); put(b, 2, 0, 'h-s');
    placeOnly(b, 'h-s', 3, 0, 0);
    expect(measureInfo(b, 3, 0).sum).toBe(5);
    expect(seams(b)).toContain('v4,0');
  });
});

describe('앱 사용법 장', () => {
  test('검산 퀴즈 그림의 보기 숫자는 앱의 makeChoices와 같다', () => {
    expect(QUIZ_DEMO.choices).toEqual(makeChoices(QUIZ_DEMO.sum, 4));
    expect(QUIZ_DEMO.choices).toContain(QUIZ_DEMO.sum);
  });
});
