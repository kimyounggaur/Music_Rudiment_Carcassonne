/* 학습 퍼즐: 실제 게임 규칙(룰 엔진) 위에서 도는 한 수 문제.
 *  - count  : "이 음표(마디)는 몇 박?" 고르기
 *  - fill   : 손패에서 맞는 타일을 골라 놓고(필요하면 마디줄로 닫아) 목표 박을 채우기
 *  - divide : 이어진 리듬에 마디줄을 꽂아 목표 박 마디로 나누기 (악보의 '마디줄 긋기')
 * 보드는 왼쪽에서 오른쪽으로 한 줄(y=0). 줄 표기:
 *   S 시작 타일(4/4) · T3 3/4 박자표 · T2 2/4 박자표 (숫자가 오른쪽)
 *   q h dh w e dq 음표 · qr er hr 쉼표 · _ 빈칸(놓을 자리) · | 미리 꽂힌 마디줄(앞 칸과 뒤 칸 사이)
 */
import * as R from '../engine/engine';
import type { State, KindId, LevelId, Segment, OrderItem } from '../engine/engine';
import { fmtBeats } from '../art/tiles';

export type PuzzleType = 'count' | 'fill' | 'divide';
export interface PuzzleDef {
  id: string;
  type: PuzzleType;
  title: string;
  ask: string;
  line: string;
  level: LevelId;
  /** fill: 고를 타일 */
  hand?: KindId[];
  /** fill: 놓을 수 있는 타일 수 (기본 1) */
  place?: number;
  /** 꽂을 수 있는 마디줄 수 (fill 기본 1, divide는 필요한 수) */
  bars?: number;
  /** fill: 목표 마디를 정하는 칸 (그 칸 타일의 오른쪽 리듬선이 속한 마디). 기본 0 */
  goal?: number;
  /** count */
  choices?: number[];
  answer?: number;
  hints: string[];
  explain: string;
}
export interface Chapter { no: number; title: string; sub: string; level: LevelId; icons: KindId[]; puzzles: PuzzleDef[] }

const CODE: Record<string, KindId> = {
  S: 'start', T3: 'ts34', T2: 'ts24',
  q: 'q-s', h: 'h-s', dh: 'dh-s', w: 'w-s', e: 'e-s', dq: 'dq-s', qr: 'qr', er: 'er', hr: 'hr',
};
const CODE_OF: Partial<Record<KindId, string>> = Object.fromEntries(Object.entries(CODE).map(([c, k]) => [k, c]));
export const EPS = 1e-9;
export const beatsOf = (k: KindId) => { const K = R.kindOf(k); return K.sym ? R.SYMBOLS[K.sym].beats : 0; };

export interface ParsedLine { tiles: { x: number; k: KindId }[]; gaps: number[]; bars: string[]; width: number }
export function parseLine(line: string): ParsedLine {
  const out: ParsedLine = { tiles: [], gaps: [], bars: [], width: 0 };
  let x = 0;
  for (const tok of line.trim().split(/\s+/)) {
    if (tok === '|') { out.bars.push(`v${x},0`); continue; }
    if (tok === '_') { out.gaps.push(x++); continue; }
    const k = CODE[tok];
    if (!k) throw new Error(`퍼즐 줄 표기 오류: ${tok}`);
    out.tiles.push({ x: x++, k });
  }
  out.width = x;
  return out;
}

export const barsOf = (def: PuzzleDef) => def.bars ?? (def.type === 'fill' ? 1 : 0);
export const placeOf = (def: PuzzleDef) => (def.type === 'fill' ? def.place ?? 1 : 0);

/** 퍼즐 판 (1인용 엔진 상태). 지휘자·점수는 쓰지 않는다 */
export function buildState(def: PuzzleDef): State {
  const L = parseLine(def.line);
  const st: State = {
    v: 2,
    // Lv0의 '틀린 마디는 아예 못 만듦'은 끈다: 퍼즐은 틀려 보고 고치는 연습이므로
    cfg: { players: [{ name: '나', type: 'human', color: 0 }], level: def.level === 0 ? 1 : def.level, set: 'mvp', handSize: 3, meeples: 0, target: 4, softEnd: false, noUnderClose: false, seed: 0 },
    board: {}, bars: {}, meeples: [], scored: {}, standDone: {}, bag: [], discards: [],
    hands: [def.hand ? def.hand.slice() : []],
    players: [{ score: 0, meeples: 0, stats: R.newStats() }],
    barsLeft: barsOf(def), serial: 0, mid: 0, ts: 0, turnNo: 1,
    turn: { p: 0, placed: null, meeple: null, bar: null, resolved: false },
    over: false, final: null, measures: [], log: [],
  };
  for (const t of L.tiles) {
    st.board[R.cellKey(t.x, 0)] = { k: t.k, r: 0, n: 0, p: null };
    if (R.kindOf(t.k).shape === 'timesig') st.ts++;
  }
  for (const sk of L.bars) st.bars[sk] = { p: -1, t: 0 };
  return st;
}

/** 목표 마디 (fill) */
export function goalSegment(st: State, def: PuzzleDef): Segment | null {
  const gx = def.goal ?? 0;
  const t = R.tileAt(st, gx, 0);
  if (!t) return null;
  const pi = R.geomOf(t).pieceAt[R.E];
  return pi >= 0 ? R.segmentOf(st, gx, 0, pi) : null;
}

/** fill: 타일을 놓을 수 있는 칸 = 목표 마디의 열린 끝 바로 옆 빈칸 */
export function allowedCells(st: State, def: PuzzleDef): Set<string> {
  const out = new Set<string>();
  const seg = goalSegment(st, def);
  if (!seg) return out;
  for (const e of seg.ends) {
    if (e.kind !== 'open' || e.d == null) continue;
    out.add(R.cellKey(e.x + R.DXY[e.d][0], e.y + R.DXY[e.d][1]));
  }
  return out;
}

export function candidates(st: State, def: PuzzleDef, k: KindId): R.Placement[] {
  const ok = allowedCells(st, def);
  return R.placements(st, k).filter((c) => ok.has(R.cellKey(c.x, c.y)));
}

/** 마디줄을 꽂을 수 있는 이음새: 리듬선이 이어지는 곳이나 열린 끝. 빈 마디(음표 없는 마디)를 만드는 곳은 제외 */
export function puzzleSeams(st: State): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const [ck, t] of Object.entries(st.board)) {
    const [x, y] = ck.split(',').map(Number);
    const g = R.geomOf(t);
    for (let d = 0; d < 4; d++) {
      if (!g.edges[d]) continue;
      const sk = R.seamKey(x, y, d);
      if (seen.has(sk) || st.bars[sk]) continue;
      seen.add(sk);
      const nt = R.tileAt(st, x + R.DXY[d][0], y + R.DXY[d][1]);
      if (nt && !R.geomOf(nt).edges[R.opp(d)]) continue;
      let empty = false;
      for (const s of R.seamSides(st, sk)) {
        const seg = R.segmentOf(st, s.x, s.y, s.pi, { extraSeam: sk });
        if (seg.closed && seg.notes + seg.rests === 0) empty = true;
      }
      if (!empty) out.push(sk);
    }
  }
  return out.sort((a, b) => seamX(a) - seamX(b));
}
const seamX = (sk: string) => Number(sk.slice(1).split(',')[0]);

// ── 검사 ─────────────────────────────────────────────────────────────
export interface MeasureView { cells: [number, number][]; terms: OrderItem[]; sum: number; targets: number[]; ok: boolean; closed: boolean }
export interface CheckResult { ok: boolean; msg: string; measures: MeasureView[] }

export function viewOf(st: State, seg: Segment): MeasureView {
  const order = R.orderPieces(st, seg);
  const terms = order.filter((o) => o.note || o.rest);
  const cells: [number, number][] = [];
  const seen = new Set<string>();
  for (const o of order) { const k = R.cellKey(o.x, o.y); if (!seen.has(k)) { seen.add(k); cells.push([o.x, o.y]); } }
  const targets = R.targetsOf(st, seg);
  return { cells, terms, sum: seg.sum, targets, ok: seg.closed && targets.some((t) => Math.abs(t - seg.sum) < EPS), closed: seg.closed };
}

/** 음표나 쉼표가 있는 마디 전부 (왼쪽부터) */
export function noteMeasures(st: State): MeasureView[] {
  return R.allSegments(st).filter((s) => s.notes + s.rests > 0).map((s) => viewOf(st, s))
    .sort((a, b) => Math.min(...a.cells.map((c) => c[0])) - Math.min(...b.cells.map((c) => c[0])));
}

export const fmt = fmtBeats;

function diffMsg(v: MeasureView): string {
  const t = v.targets.length > 1 ? v.targets.find((x) => x >= v.sum) ?? v.targets[0] : v.targets[0];
  const d = Math.abs(v.sum - t);
  return `${fmt(v.sum)}박이에요. 목표 ${fmt(t)}박보다 ${fmt(d)}박 ${v.sum > t ? '많아요' : '모자라요'}.`;
}

export function check(def: PuzzleDef, st: State, placed: number, picked: number | null = null): CheckResult {
  if (def.type === 'count') {
    const ok = picked != null && Math.abs(picked - (def.answer ?? -1)) < EPS;
    return { ok, msg: ok ? '' : '다시 세어 볼까요?', measures: [] };
  }
  if (def.type === 'fill') {
    const seg = goalSegment(st, def);
    if (!seg) return { ok: false, msg: '목표 마디를 찾을 수 없어요', measures: [] };
    const v = viewOf(st, seg);
    if (!seg.closed) {
      const msg = placed < 1 ? '손패에서 타일을 골라 점선 칸에 놓으세요.'
        : st.barsLeft > 0 ? '마디가 아직 열려 있어요. 점선 동그라미에 마디줄을 꽂아 닫으세요.'
          : '마디가 아직 열려 있어요.';
      return { ok: false, msg, measures: [v] };
    }
    return { ok: v.ok, msg: v.ok ? '' : diffMsg(v), measures: [v] };
  }
  const ms = noteMeasures(st);
  const bad = ms.findIndex((m) => !m.ok);
  if (bad < 0) return { ok: true, msg: '', measures: ms };
  const m = ms[bad];
  return { ok: false, msg: ms.length > 1 ? `${bad + 1}번째 마디가 ${diffMsg(m)}` : diffMsg(m), measures: ms };
}

/** 정답 리듬 (소리용): 마디마다 박 수 */
export function rhythmOf(r: CheckResult): { beats: number; rest: boolean }[][] {
  return r.measures.map((m) => m.terms.map((o) => ({ beats: o.beats, rest: o.rest })));
}

// ── 풀이 탐색 (테스트·생성 검증용) ─────────────────────────────────────
function combos<T>(arr: T[], k: number): T[][] {
  if (k === 0) return [[]];
  const out: T[][] = [];
  arr.forEach((v, i) => combos(arr.slice(i + 1), k - 1).forEach((c) => out.push([v, ...c])));
  return out;
}

/** 가능한 풀이를 모두 시도해 정답·오답 수를 센다 (fill은 타일 1장 + 마디줄 0~1개, divide는 마디줄 조합) */
export function explore(def: PuzzleDef): { solutions: number; attempts: number; sample: string | null } {
  let solutions = 0, attempts = 0;
  let sample: string | null = null;
  if (def.type === 'count') return { solutions: 1, attempts: (def.choices ?? []).length, sample: String(def.answer) };
  if (def.type === 'divide') {
    const st = buildState(def);
    for (const set of combos(puzzleSeams(st), barsOf(def))) {
      const s = R.clone(st);
      set.forEach((sk) => { s.bars[sk] = { p: 0, t: 1 }; });
      attempts++;
      if (check(def, s, 0).ok) { solutions++; sample ??= set.join(' '); }
    }
    return { solutions, attempts, sample };
  }
  const st0 = buildState(def);
  const kinds = [...new Set(st0.hands[0])];
  for (const k of kinds) {
    for (const c of candidates(st0, def, k)) {
      for (const r of c.rots) {
        const s1 = R.clone(st0);
        R.applyPlace(s1, s1.hands[0].indexOf(k), c.x, c.y, r);
        s1.turn = { p: 0, placed: null, meeple: null, bar: null, resolved: false };
        const opts: (string | null)[] = [null];
        if (barsOf(def) > 0) opts.push(...puzzleSeams(s1));
        for (const b of opts) {
          const s = R.clone(s1);
          if (b) { s.bars[b] = { p: 0, t: 1 }; s.barsLeft--; }
          attempts++;
          if (check(def, s, 1).ok) { solutions++; sample ??= `${k}@${c.x},${c.y}${b ? ` ${b}` : ''}`; }
        }
      }
    }
  }
  return { solutions, attempts, sample };
}

// ── 단원 문제 ─────────────────────────────────────────────────────────
const cnt = (id: string, title: string, ask: string, line: string, level: LevelId, choices: number[], answer: number, hints: string[], explain: string): PuzzleDef =>
  ({ id, type: 'count', title, ask, line, level, choices, answer, hints, explain });
const fill = (id: string, title: string, ask: string, line: string, level: LevelId, hand: KindId[], hints: string[], explain: string, extra: Partial<PuzzleDef> = {}): PuzzleDef =>
  ({ id, type: 'fill', title, ask, line, level, hand, bars: line.trim().endsWith('|') ? 0 : 1, hints, explain, ...extra });
const div = (id: string, title: string, ask: string, line: string, level: LevelId, bars: number, hints: string[], explain: string): PuzzleDef =>
  ({ id, type: 'divide', title, ask, line, level, bars, hints, explain });

const ASK_FILL = '4박이 되도록 타일 한 장을 놓고, 마디줄로 닫으세요.';
const ASK_GAP = '빈칸에 맞는 타일을 놓으면 마디가 바로 닫혀요.';

export const CHAPTERS: Chapter[] = [
  {
    no: 1, title: '1박 · 2박 · 4박', sub: '4분음표·2분음표·온음표로 4박 만들기', level: 0, icons: ['q-s', 'h-s', 'w-s'],
    puzzles: [
      cnt('1-1', '4분음표', '4분음표는 몇 박일까요?', 'q', 0, [1, 2, 3, 4], 1,
        ['손뼉 한 번이 1박이에요.', '검은 머리에 기둥 하나 — 손뼉 한 번만큼.'], '4분음표는 1박. "하나" 하고 손뼉 한 번이에요.'),
      cnt('1-2', '2분음표', '2분음표는 몇 박일까요?', 'h', 0, [1, 2, 3, 4], 2,
        ['머리가 하얀 음표예요.', '4분음표 두 개만큼 길어요.'], '2분음표는 2박. "하나, 둘" 동안 소리를 길게 이어요.'),
      cnt('1-3', '온음표', '온음표는 몇 박일까요?', 'w', 0, [1, 2, 3, 4], 4,
        ['기둥이 없는 동그란 음표예요.', '2분음표 두 개만큼 길어요.'], '온음표는 4박. 4/4박자에서는 혼자서 한 마디를 꽉 채워요.'),
      cnt('1-4', '마디 세기', '이 마디는 모두 몇 박일까요?', 'S q h q |', 0, [3, 4, 5, 6], 4,
        ['음표마다 박을 세어 더해요.', '1 + 2 + 1을 계산해 보세요.'], '1 + 2 + 1 = 4박. 4/4박자의 한 마디가 딱 찼어요.'),
      fill('1-5', '1박 채우기', ASK_FILL, 'S q h', 0, ['w-s', 'q-s', 'h-s'],
        ['지금 1 + 2 = 3박이에요.', '1박이 모자라요. 1박짜리 음표는 무엇일까요?'], '1 + 2 + 1 = 4박! 마디줄로 닫아 한 마디가 완성됐어요.'),
      fill('1-6', '2박 채우기', ASK_FILL, 'S h', 0, ['q-s', 'w-s', 'h-s'],
        ['지금 2박이에요.', '2박이 더 필요해요.'], '2 + 2 = 4박!'),
      fill('1-7', '가운데 빈칸', ASK_GAP, 'S q _ q |', 0, ['w-s', 'q-s', 'h-s'],
        ['양쪽 음표만 더하면 1 + 1 = 2박.', '빈칸에는 2박이 들어가야 해요.'], '1 + 2 + 1 = 4박. 빈칸을 채우자 마디가 바로 닫혔어요.'),
      fill('1-8', '한 장으로 꽉', '음표 한 장으로 빈 마디를 꽉 채우세요.', 'S _ |', 0, ['h-s', 'q-s', 'w-s'],
        ['한 장으로 4박을 채워야 해요.'], '온음표 하나 = 4박. 한 장으로 한 마디가 꽉 찼어요.'),
      div('1-9', '마디줄 긋기', '마디줄 2개를 꽂아 4박 마디 3개로 나누세요.', 'S q q h h h w |', 0, 2,
        ['처음부터 박을 더해 4박이 되는 곳을 찾아요: 1 + 1 + 2 = 4.', '두 번째 마디는 2 + 2 = 4박.'], '1+1+2 | 2+2 | 4 — 세 마디 모두 4박이에요.'),
      div('1-10', '마디줄 긋기 2', '마디줄 2개를 꽂아 4박 마디 3개로 나누세요.', 'S h q q q q h w |', 0, 2,
        ['2 + 1 + 1 = 4박에서 첫 마디가 끝나요.', '두 번째 마디는 1 + 1 + 2 = 4박.'], '2+1+1 | 1+1+2 | 4 — 마디줄은 4박마다 와요.'),
    ],
  },
  {
    no: 2, title: '3박 · 점2분음표', sub: '점이 붙으면 절반만큼 길어져요', level: 1, icons: ['dh-s'],
    puzzles: [
      cnt('2-1', '점2분음표', '점2분음표는 몇 박일까요?', 'dh', 1, [2, 3, 4, 5], 3,
        ['2분음표(2박)에 점이 붙었어요.', '점은 "절반만큼 더" → 2 + 1.'], '점2분음표 = 2박 + 점(1박) = 3박.'),
      cnt('2-2', '마디 세기', '이 마디는 몇 박일까요?', 'S dh q |', 1, [3, 4, 5, 6], 4,
        ['점2분음표는 3박이에요.'], '3 + 1 = 4박.'),
      fill('2-3', '1박 채우기', ASK_FILL, 'S dh', 1, ['h-s', 'dh-s', 'q-s'],
        ['지금 3박이에요.', '1박이 모자라요.'], '3 + 1 = 4박!'),
      fill('2-4', '3박 채우기', ASK_FILL, 'S q', 1, ['dh-s', 'h-s', 'w-s'],
        ['지금 1박. 3박이 더 필요해요.', '3박짜리 음표는 점이 붙은 2분음표!'], '1 + 3 = 4박!'),
      fill('2-5', '앞 빈칸', ASK_GAP, 'S _ q |', 1, ['h-s', 'w-s', 'dh-s'],
        ['뒤에 1박이 있어요.', '빈칸에는 3박이 들어가야 해요.'], '3 + 1 = 4박.'),
      div('2-6', '마디줄 긋기', '마디줄 2개를 꽂아 4박 마디 3개로 나누세요.', 'S dh q q dh h h |', 1, 2,
        ['3 + 1 = 4박에서 첫 마디가 끝나요.', '두 번째 마디는 1 + 3 = 4박.'], '3+1 | 1+3 | 2+2 — 세 마디 모두 4박.'),
    ],
  },
  {
    no: 3, title: '쉼표도 박을 세요', sub: '소리는 쉬어도 박은 그대로', level: 2, icons: ['qr', 'hr', 'er'],
    puzzles: [
      cnt('3-1', '4분쉼표', '4분쉼표는 몇 박 동안 쉴까요?', 'qr', 2, [1, 2, 3, 4], 1,
        ['쉼표는 소리를 쉬는 시간이에요.', '4분음표만큼 쉬어요.'], '4분쉼표 = 1박 쉬기. 소리는 안 나도 박은 세요.'),
      cnt('3-2', '2분쉼표', '2분쉼표는 몇 박 동안 쉴까요?', 'hr', 2, [1, 2, 3, 4], 2,
        ['줄 위에 모자처럼 얹힌 쉼표예요.', '2분음표만큼 쉬어요.'], '2분쉼표 = 2박 쉬기.'),
      cnt('3-3', '쉼표까지 세기', '쉼표까지 세면 이 마디는 몇 박일까요?', 'S q qr h |', 2, [2, 3, 4, 5], 4,
        ['쉼표도 박에 넣어요.', '1 + 1(쉼) + 2를 계산해 보세요.'], '1 + 1(쉼) + 2 = 4박. 쉼표를 빼고 세면 틀려요!'),
      fill('3-4', '쉼표로 채우기', '쉼표로 4박을 채우고 마디줄로 닫으세요.', 'S h q', 2, ['hr', 'w-s', 'qr'],
        ['지금 2 + 1 = 3박.', '1박 쉬는 쉼표를 찾아보세요.'], '2 + 1 + 1(쉼) = 4박.'),
      fill('3-5', '가운데 쉼표', ASK_GAP, 'S q _ q |', 2, ['qr', 'hr', 'w-s'],
        ['양쪽을 더하면 2박.', '2박 쉬는 쉼표가 들어가요.'], '1 + 2(쉼) + 1 = 4박.'),
      div('3-6', '마디줄 긋기', '마디줄 2개를 꽂아 4박 마디 3개로 나누세요.', 'S q qr h hr h q qr hr |', 2, 2,
        ['쉼표도 박에 넣어 4박이 되는 곳을 찾아요.', '첫 마디: 1 + 1(쉼) + 2 = 4박.'], '1+(1)+2 | (2)+2 | 1+(1)+(2) — 괄호는 쉼표예요.'),
    ],
  },
  {
    no: 4, title: '반 박 · 8분음표와 점4분음표', sub: '½박을 모아 4박 만들기', level: 2, icons: ['e-s', 'dq-s'],
    puzzles: [
      cnt('4-1', '8분음표', '8분음표는 몇 박일까요?', 'e', 2, [0.5, 1, 1.5, 2], 0.5,
        ['깃발이 하나 달린 음표예요.', '4분음표의 절반!'], '8분음표 = ½박. 두 개가 모이면 1박이에요.'),
      cnt('4-2', '점4분음표', '점4분음표는 몇 박일까요?', 'dq', 2, [1, 1.5, 2, 2.5], 1.5,
        ['4분음표(1박)에 점이 붙었어요.', '점은 "절반만큼 더" → 1 + ½.'], '점4분음표 = 1 + ½ = 1½박.'),
      cnt('4-3', '마디 세기', '이 마디는 몇 박일까요?', 'S dq e h |', 2, [3, 3.5, 4, 4.5], 4,
        ['1½ + ½를 먼저 묶으면 2박이에요.'], '1½ + ½ + 2 = 4박.'),
      fill('4-4', '1박 채우기', ASK_FILL, 'S e e h', 2, ['e-s', 'h-s', 'q-s'],
        ['½ + ½ = 1박, 거기에 2박을 더하면 3박.', '1박이 모자라요.'], '½ + ½ + 2 + 1 = 4박.'),
      fill('4-5', '반 박 빈칸', ASK_GAP, 'S dq _ h |', 2, ['q-s', 'e-s', 'dq-s'],
        ['1½ + 2 = 3½박.', '½박이 모자라요.'], '1½ + ½ + 2 = 4박.'),
      fill('4-6', '점4분음표 둘', ASK_FILL, 'S dq dq', 2, ['h-s', 'e-s', 'q-s'],
        ['1½ + 1½ = 3박.', '1박이 모자라요.'], '1½ + 1½ + 1 = 4박.'),
      div('4-7', '마디줄 긋기', '마디줄 1개를 꽂아 4박 마디 2개로 나누세요.', 'S dq e h e e q h |', 2, 1,
        ['1½ + ½ + 2 = 4박에서 첫 마디가 끝나요.'], '1½+½+2 | ½+½+1+2 — 두 마디 모두 4박.'),
    ],
  },
  {
    no: 5, title: '박자표 3/4 · 2/4', sub: '위 숫자가 한 마디의 박 수', level: 2, icons: ['ts34', 'ts24'],
    puzzles: [
      cnt('5-1', '3/4 박자', '3/4 박자표 뒤의 마디는 몇 박이면 꽉 찰까요?', 'T3 q q q |', 2, [2, 3, 4, 5], 3,
        ['박자표의 위 숫자를 보세요.', '위 숫자 3 = 한 마디에 4분음표 3개만큼.'], '3/4박자는 한 마디가 3박. 박자표의 위 숫자는 한 마디의 박 수, 아래 숫자 4는 4분음표를 1박으로 센다는 뜻이에요.'),
      fill('5-2', '3박 채우기', '3/4박자예요. 3박이 되도록 채우고 마디줄로 닫으세요.', 'T3 h', 2, ['dh-s', 'q-s', 'h-s'],
        ['3/4박자 마디는 3박이면 꽉 차요.', '지금 2박. 1박이 더 필요해요.'], '2 + 1 = 3박. 3/4박자 한 마디 완성!'),
      fill('5-3', '2박 채우기', '2/4박자예요. 2박이 되도록 채우고 마디줄로 닫으세요.', 'T2 q', 2, ['h-s', 'q-s', 'w-s'],
        ['2/4박자 마디는 2박이면 꽉 차요.', '지금 1박이에요.'], '1 + 1 = 2박. 2/4박자 한 마디 완성!'),
      fill('5-4', '한 장으로 3박', '음표 한 장으로 3/4박자 마디를 꽉 채우세요.', 'T3 _ |', 2, ['w-s', 'h-s', 'dh-s'],
        ['3박짜리 음표가 필요해요.'], '점2분음표 하나 = 3박. 3/4박자 한 마디를 꽉 채워요.'),
      div('5-5', '3/4 마디줄 긋기', '3/4박자예요. 마디줄 2개로 3박 마디 3개를 만드세요.', 'T3 q q q h q dh |', 2, 2,
        ['3박마다 마디줄이 와요.', '첫 마디: 1 + 1 + 1 = 3박.'], '1+1+1 | 2+1 | 3 — 세 마디 모두 3박.'),
      div('5-6', '2/4 마디줄 긋기', '2/4박자예요. 마디줄 2개로 2박 마디 3개를 만드세요.', 'T2 q q h e e q |', 2, 2,
        ['2박마다 마디줄이 와요.', '첫 마디: 1 + 1 = 2박.'], '1+1 | 2 | ½+½+1 — 세 마디 모두 2박.'),
      fill('5-7', '박자가 바뀌어요', '중간에 3/4 박자표가 나왔어요. 박자표 뒤 마디를 완성하세요.', 'S q q h T3 h', 2, ['h-s', 'dh-s', 'q-s'],
        ['박자표 앞은 4/4, 뒤는 3/4예요.', '뒤 마디는 지금 2박. 3박이 되려면?'], '박자표가 나오면 그 뒤 마디부터 목표 박 수가 바뀌어요: 2 + 1 = 3박.', { goal: 4 }),
    ],
  },
];

export const ALL_PUZZLES: PuzzleDef[] = CHAPTERS.flatMap((c) => c.puzzles);
export const puzzleById = (id: string) => ALL_PUZZLES.find((p) => p.id === id) ?? null;
export const chapterOf = (id: string) => CHAPTERS.find((c) => c.puzzles.some((p) => p.id === id))!;

// ── 무한 연습: 자동으로 만드는 문제 ────────────────────────────────────
const PALETTE: Record<LevelId, KindId[]> = {
  0: ['q-s', 'h-s', 'w-s'],
  1: ['q-s', 'h-s', 'dh-s', 'w-s'],
  2: ['q-s', 'h-s', 'dh-s', 'w-s', 'e-s', 'dq-s', 'qr', 'er', 'hr'],
};
const WEIGHT: Partial<Record<KindId, number>> = { 'q-s': 5, 'h-s': 4, 'dh-s': 2.5, 'w-s': 1, 'e-s': 3, 'dq-s': 2, qr: 1.6, er: 1.2, hr: 1.2 };

function pick<T>(arr: T[], rnd: () => number, w?: (v: T) => number): T {
  if (!w) return arr[Math.floor(rnd() * arr.length)];
  const tot = arr.reduce((a, v) => a + w(v), 0);
  let r = rnd() * tot;
  for (const v of arr) { r -= w(v); if (r <= 0) return v; }
  return arr[arr.length - 1];
}

/** 목표 T박을 채우는 무작위 마디 (minLen~maxLen장, 쉼표는 1장까지) */
function randMeasure(T: number, level: LevelId, rnd: () => number, minLen: number, maxLen: number): KindId[] {
  for (let tries = 0; tries < 200; tries++) {
    const seq: KindId[] = [];
    let rem = T;
    let rests = 0;
    while (rem > EPS && seq.length < maxLen) {
      const opts = PALETTE[level].filter((k) => beatsOf(k) <= rem + EPS && !(R.kindOf(k).sym && R.SYMBOLS[R.kindOf(k).sym!].rest && rests >= 1));
      // 남은 박이 ½로 끝나면 언젠가는 ½짜리가 필요하므로 그대로 두고, 마지막 칸이면 딱 맞는 것만
      const last = seq.length === maxLen - 1;
      const pool = last ? opts.filter((k) => Math.abs(beatsOf(k) - rem) < EPS) : opts;
      if (!pool.length) break;
      const k = pick(pool, rnd, (v) => WEIGHT[v] ?? 1);
      if (R.SYMBOLS[R.kindOf(k).sym!].rest) rests++;
      seq.push(k);
      rem -= beatsOf(k);
    }
    if (rem < EPS && seq.length >= minLen) return seq;
  }
  return T === 4 ? ['q-s', 'q-s', 'h-s'] : T === 3 ? ['h-s', 'q-s'] : ['q-s', 'q-s'];
}

const terms = (ks: KindId[]) => ks.map((k) => (R.SYMBOLS[R.kindOf(k).sym!].rest ? `${fmt(beatsOf(k))}(쉼)` : fmt(beatsOf(k)))).join(' + ');
const tsCode = (T: number) => (T === 3 ? 'T3' : T === 2 ? 'T2' : 'S');
const tsName = (T: number) => (T === 4 ? '4/4' : `${T}/4`);

/** 무한 연습 문제 하나 (같은 seed면 같은 문제) */
export function genDrill(level: LevelId, seed: number): PuzzleDef {
  const rnd = R.mulberry32(seed);
  const T = level === 2 && rnd() < 0.35 ? (rnd() < 0.55 ? 3 : 2) : 4;
  const kind: PuzzleType = rnd() < 0.6 ? 'fill' : 'divide';
  const head = tsCode(T);
  const id = `drill-${level}-${seed}`;
  if (kind === 'fill') {
    const seq = randMeasure(T, level, rnd, 2, T === 2 ? 3 : 4);
    const j = Math.floor(rnd() * seq.length);
    const miss = seq[j];
    const m = beatsOf(miss);
    const open = j === seq.length - 1 && rnd() < 0.7;
    const others = PALETTE[level].filter((k) => Math.abs(beatsOf(k) - m) > EPS);
    const near = others.sort((a, b) => Math.abs(beatsOf(a) - m) - Math.abs(beatsOf(b) - m) || (rnd() - 0.5));
    const distract: KindId[] = [];
    for (const k of near) {
      if (distract.length >= 2) break;
      if (!distract.some((d) => Math.abs(beatsOf(d) - beatsOf(k)) < EPS)) distract.push(k);
    }
    const hand = [miss, ...distract];
    for (let i = hand.length - 1; i > 0; i--) { const r = Math.floor(rnd() * (i + 1)); [hand[i], hand[r]] = [hand[r], hand[i]]; }
    const toks = seq.map((k, i) => (i === j ? '_' : CODE_OF[k]!));
    const line = open ? `${head} ${toks.slice(0, j).join(' ')}` : `${head} ${toks.join(' ')} |`;
    const have = seq.filter((_, i) => i !== j);
    const sumHave = have.reduce((a, k) => a + beatsOf(k), 0);
    return {
      id, type: 'fill', title: open ? `${fmt(T)}박 채우기` : '빈칸 채우기', level,
      ask: open ? `${T === 4 ? '' : `${tsName(T)}박자예요. `}${fmt(T)}박이 되도록 타일 한 장을 놓고, 마디줄로 닫으세요.` : `${T === 4 ? '' : `${tsName(T)}박자예요. `}빈칸에 맞는 타일을 놓으면 마디가 바로 닫혀요.`,
      line: line.replace(/\s+/g, ' ').trim(), hand, bars: open ? 1 : 0,
      hints: [have.length > 1 ? `지금 ${terms(have)} = ${fmt(sumHave)}박이에요.` : have.length ? `지금 ${fmt(sumHave)}박이에요.` : '아직 빈 마디예요.', `${fmt(T)}박이 되려면 ${fmt(m)}박이 더 필요해요.`],
      explain: `${terms(seq)} = ${fmt(T)}박!`,
    };
  }
  const M = rnd() < 0.5 ? 2 : 3;
  let ms: KindId[][] = [];
  for (let tries = 0; tries < 50; tries++) {
    ms = Array.from({ length: M }, () => randMeasure(T, level, rnd, 1, M === 2 ? 4 : 3));
    const n = ms.reduce((a, m) => a + m.length, 0);
    if (n <= 8 && n >= M + 2) break;
  }
  const line = `${head} ${ms.flat().map((k) => CODE_OF[k]!).join(' ')} |`;
  return {
    id, type: 'divide', title: `${tsName(T)} 마디줄 긋기`, level,
    ask: `${T === 4 ? '' : `${tsName(T)}박자예요. `}마디줄 ${M - 1}개를 꽂아 ${fmt(T)}박 마디 ${M}개로 나누세요.`,
    line, bars: M - 1,
    hints: [`처음부터 박을 더해 ${fmt(T)}박이 되는 곳을 찾아요.`, `첫 마디는 ${terms(ms[0])} = ${fmt(T)}박이에요.`],
    explain: ms.map((m) => terms(m)).join('  |  '),
  };
}
