import { describe, test, expect } from 'vitest';
import * as R from '../engine/engine';
import { fmtBeats } from '../art/tiles';
import { FIG_IDS } from '../art/rulebookFigs';
import { CHAPTERS, BEAT_KINDS, FIG_CAP, FIG_NO, FIG_ORDER, chapterById, firstLevel, parseInline, walkBlocks, type Block } from './rulebookContent';

/** 블록 안에서 **굵게** · ==형광펜== · [[링크]] 표시가 들어갈 수 있는 모든 글 */
function texts(b: Block): string[] {
  switch (b.t) {
    case 'p': case 'h': return [b.s];
    case 'ul': case 'ol': return b.items;
    case 'steps': return b.items.flatMap((i) => [i.title, i.s]);
    case 'fig': return [b.cap];
    case 'note': return [b.title ?? '', b.s];
    case 'table': return [...b.head, ...b.rows.flat()];
    case 'facts': return b.items.flatMap((i) => [i.k, i.v]);
    case 'faq': return b.items.map((i) => i.q);
    default: return [];
  }
}

const blocks = CHAPTERS.flatMap((c) => [...walkBlocks(c.blocks)]);
const allTexts = [...CHAPTERS.flatMap((c) => [c.title, c.short, c.lead]), ...blocks.flatMap(texts)];
const count = (s: string, sub: string) => s.split(sub).length - 1;

describe('룰북 내용: 장 구성', () => {
  test('장 번호는 1부터 차례대로, id·제목·칩 이름은 겹치지 않는다', () => {
    expect(CHAPTERS.length).toBeGreaterThanOrEqual(10);
    CHAPTERS.forEach((c, i) => {
      expect(c.no).toBe(i + 1);
      expect(c.title.trim().length, `${c.id} 제목`).toBeGreaterThan(0);
      expect(c.short.trim().length, `${c.id} 칩 이름`).toBeGreaterThan(0);
      expect(c.short.length, `${c.id} 칩 이름이 너무 길다`).toBeLessThanOrEqual(8);
      expect(c.lead.trim().length, `${c.id} 한 줄 설명`).toBeGreaterThan(0);
      expect(c.blocks.length, `${c.id} 내용`).toBeGreaterThan(0);
      expect(chapterById(c.id)).toBe(c);
    });
    expect(new Set(CHAPTERS.map((c) => c.id)).size).toBe(CHAPTERS.length);
    expect(new Set(CHAPTERS.map((c) => c.title)).size).toBe(CHAPTERS.length);
    expect(new Set(CHAPTERS.map((c) => c.short)).size).toBe(CHAPTERS.length);
  });

  test('난이도 표시(lv)는 있는 난이도만', () => {
    for (const c of CHAPTERS) if (c.lv != null) expect(R.LEVELS[c.lv], c.id).toBeTruthy();
    expect(chapterById('lv2')?.lv).toBe(2);
  });

  test('불러오기: 없는 장 id는 undefined', () => {
    expect(chapterById('nope')).toBeUndefined();
  });
});

describe('룰북 내용: 그림 배치', () => {
  test('모든 그림이 정확히 한 번씩, 없는 그림은 쓰지 않는다', () => {
    const used = new Map<string, number>();
    for (const id of FIG_ORDER) used.set(id, (used.get(id) ?? 0) + 1);
    for (const id of FIG_IDS) expect(used.get(id), `${id} 사용 횟수`).toBe(1);
    expect(FIG_ORDER.length).toBe(FIG_IDS.length);
    for (const id of used.keys()) expect(FIG_IDS as string[], `${id}는 없는 그림`).toContain(id);
  });

  test('그림 번호는 1부터 빈틈없이 이어지고 설명이 모두 있다', () => {
    FIG_ORDER.forEach((id, i) => {
      expect(FIG_NO[id]).toBe(i + 1);
      expect(FIG_CAP[id]?.trim().length, `${id} 설명`).toBeGreaterThan(5);
    });
  });

  test('각 장에는 그림이 최소 한 장 이상 (룰북은 그림으로 읽는다) — 요약 장은 예외', () => {
    for (const c of CHAPTERS) {
      if (c.id === 'cheat') continue;
      const n = [...walkBlocks(c.blocks)].filter((b) => b.t === 'fig').length;
      expect(n, `${c.id} 그림 수`).toBeGreaterThan(0);
    }
  });
});

describe('룰북 내용: 글 표시', () => {
  test('굵게(**)·형광펜(==)·링크([[ ]]) 표시의 짝이 맞는다', () => {
    for (const s of allTexts) {
      expect(count(s, '**') % 2, `** 짝이 안 맞음: ${s}`).toBe(0);
      expect(count(s, '==') % 2, `== 짝이 안 맞음: ${s}`).toBe(0);
      expect(count(s, '[['), `[[ ]] 짝이 안 맞음: ${s}`).toBe(count(s, ']]'));
    }
  });

  test('장 링크가 가리키는 장은 모두 있다', () => {
    let refs = 0;
    for (const s of allTexts) {
      for (const part of parseInline(s)) {
        if (part.k === 'ref') {
          refs++;
          expect(chapterById(part.id), `없는 장으로 가는 링크: ${part.id}`).toBeTruthy();
          expect(part.s.trim().length).toBeGreaterThan(0);
        }
      }
    }
    expect(refs).toBeGreaterThan(0);
  });

  test('parseInline: 굵게 · 형광펜 · 링크 · 보통 글을 나눈다', () => {
    expect(parseInline('가 **나** 다 ==라== [[turn 한 차례]] 마')).toEqual([
      { k: 'text', s: '가 ' }, { k: 'b', s: '나' }, { k: 'text', s: ' 다 ' }, { k: 'mark', s: '라' }, { k: 'text', s: ' ' },
      { k: 'ref', id: 'turn', s: '한 차례' }, { k: 'text', s: ' 마' },
    ]);
    expect(parseInline('표시 없음')).toEqual([{ k: 'text', s: '표시 없음' }]);
    expect(parseInline('')).toEqual([]);
  });

  test('룰북 안 글에는 원작 상표명을 쓰지 않는다', () => {
    expect(JSON.stringify(CHAPTERS)).not.toContain('카르카손');
  });
});

describe('룰북 내용: 표와 블록', () => {
  test('표의 모든 줄이 머리글과 칸 수가 같고, 접근성 이름이 있다', () => {
    const tables = blocks.filter((b): b is Extract<Block, { t: 'table' }> => b.t === 'table');
    expect(tables.length).toBeGreaterThan(0);
    for (const t of tables) {
      expect(t.label.trim().length, '표 이름').toBeGreaterThan(0);
      for (const row of t.rows) expect(row.length, `${t.label}: ${row[0]}`).toBe(t.head.length);
    }
  });

  test('FAQ는 질문마다 답이 있고, 답 안의 그림도 번호가 매겨진다', () => {
    const faqs = blocks.filter((b): b is Extract<Block, { t: 'faq' }> => b.t === 'faq');
    expect(faqs.length).toBeGreaterThan(0);
    for (const f of faqs) {
      expect(f.items.length).toBeGreaterThanOrEqual(5);
      for (const it of f.items) {
        expect(it.q.trim().length).toBeGreaterThan(0);
        expect(it.body.length, it.q).toBeGreaterThan(0);
      }
    }
    for (const it of faqs.flatMap((f) => f.items)) for (const b of walkBlocks(it.body)) if (b.t === 'fig') expect(FIG_NO[b.id]).toBeGreaterThan(0);
  });

  test('바로가기 버튼은 튜토리얼과 퍼즐만', () => {
    const acts = blocks.filter((b): b is Extract<Block, { t: 'actions' }> => b.t === 'actions').flatMap((b) => b.items);
    expect(acts.length).toBeGreaterThan(0);
    for (const a of acts) expect(['tutorial', 'puzzles']).toContain(a);
  });
});

describe('룰북 내용: 숫자는 엔진에서 가져온다', () => {
  const json = JSON.stringify(CHAPTERS);

  test('난이도별 타일·마디줄 수가 글에 그대로 나온다', () => {
    for (const lv of [0, 1, 2] as const) {
      const cell = `${R.tileCount({ set: 'mvp', level: lv })}장 · ${R.barCount({ set: 'mvp', level: lv })}개`;
      expect(json, `요약표의 ${cell}`).toContain(cell);
    }
  });

  test('박자값 표: 엔진의 음표·쉼표 이름과 박자값 · 처음 나오는 난이도', () => {
    const beats = chapterById('beats')!;
    const tbl = [...walkBlocks(beats.blocks)].find((b): b is Extract<Block, { t: 'table' }> => b.t === 'table')!;
    expect(tbl.rows.length).toBe(BEAT_KINDS.length);
    BEAT_KINDS.forEach((k, i) => {
      const sym = R.SYMBOLS[R.kindOf(k).sym!];
      expect(tbl.rows[i][0]).toContain(R.kindOf(k).name);
      expect(tbl.rows[i][1]).toContain(`${fmtBeats(sym.beats)}박`);
    });
  });

  test('처음 나오는 난이도: 온음표 Lv0 · 점2분음표 Lv1 · 8분음표·쉼표·박자표 Lv2', () => {
    expect(firstLevel('w-s')).toBe(0);
    expect(firstLevel('h-s')).toBe(0);
    expect(firstLevel('dh-s')).toBe(1);
    expect(firstLevel('stand')).toBe(1);
    for (const k of Object.keys(R.LV2_ADD) as R.KindId[]) expect(firstLevel(k), k).toBe(2);
  });

  test('손패·지휘자 수는 기본 설정과 같다', () => {
    expect(json).toContain(`지휘자 ${R.DEFAULT_CFG.meeples}개`);
    expect(json).toContain(`손패 ${R.DEFAULT_CFG.handSize}장`);
  });
});
