/* 컴퓨터 상대
 * 손패 × 놓을 수 있는 모든 자리·회전 × 지휘자/마디줄 선택을 시뮬레이션해 점수를 매긴다(1수 평가).
 *  - 이번 차례에 얻는 점수 (상대가 얻는 점수는 뺌)
 *  - 열린 마디의 잠재 점수 (목표까지 남은 박, 막힌 끝 수, 남은 타일 수로 추정)
 *  - 상대 마디를 넘치게 만드는 막기는 상대 잠재 점수가 줄어드는 것으로 반영
 *  - 손에 남은 지휘자의 가치 (아무 데나 올려 낭비하지 않도록)
 * level
 *  - easy: 상대를 일부러 막지 않는다(어린이용).
 *  - normal: 1수 평가로 가장 좋은 수.
 *  - hard: 1수 평가 상위 몇 수를 골라, 다음 사람이 가장 좋게 받아치는 수까지 둬 본 뒤 다시 평가한다(2수 앞 읽기).
 *          상대 손패는 보지 않는다: 아직 안 나온 타일(주머니 + 상대 손패)을 섞어 '가능한 세계'를 몇 개 만들어 평균한다.
 *          (scripts/ai-match.ts: 2인 MVP 100판에서 어려움 57% · 보통 34% · 무승부 9%)
 *
 * planMoveSteps는 생성기라서 화면을 멈추지 않고 조금씩 나눠 계산할 수 있다(game/aiRunner 참고).
 */
import * as R from './engine';
import type { State, Spot, KindId, Segment } from './engine';

export type AiLevel = 'easy' | 'normal' | 'hard';
export const AI_LEVELS: AiLevel[] = ['easy', 'normal', 'hard'];
export const AI_LABEL: Record<AiLevel, string> = { easy: '쉬움', normal: '보통', hard: '어려움' };
export interface Plan { value: number; hi: number; k: KindId; x: number; y: number; r: number; meeple: Spot | null; bar: string | null }

/** 어려움 설정 */
export interface HardParams {
  /** 1수 평가 상위 몇 수를 2수까지 읽을지 */
  top: number;
  /** 상대 손패·주머니를 몇 가지로 섞어 볼지 */
  samples: number;
  /** 2수 읽기에 쓸 시간 한도(ms). 넘으면 그때까지 읽은 수 중에서 고른다 (최소 2수는 읽음) */
  budgetMs: number;
}
export const HARD: HardParams = { top: 6, samples: 4, budgetMs: Infinity };

interface Ctx { p: number; before: number[]; level: AiLevel; beforePot: number[] | null; after?: boolean }

const EPS = 1e-9;

/** 생성기: 후보 자리 하나를 볼 때마다 한 번씩 멈춘다. 끝나면 가장 좋은 수를 돌려준다 */
export function* planMoveSteps(st: State, level: AiLevel = 'normal', prm: HardParams = HARD): Generator<void, Plan | null, void> {
  const p = st.turn.p;
  const hand = st.hands[p];
  const before = st.players.map((pl) => pl.score);
  const rnd = R.mulberry32((st.cfg.seed ^ Math.imul(st.turnNo + 7, 2654435761)) >>> 0);
  const base = R.fastClone(st);
  const ctx: Ctx = { p, before, level, beforePot: null };
  if (level === 'easy') ctx.beforePot = potentials(base, tilesFactor(base), ctx);
  let best: Plan | null = null;
  const cands: Plan[] = [];
  const tried = new Set<string>();
  for (let hi = 0; hi < hand.length; hi++) {
    const k = hand[hi];
    if (tried.has(k)) continue;
    tried.add(k);
    for (const pl of R.placements(base, k)) {
      for (const r of pl.rots) {
        // 복사하지 않고 base에 잠깐 놓았다가 아래에서 되돌린다
        const turn0 = base.turn;
        base.turn = { ...turn0 };
        R.applyPlace(base, hi, pl.x, pl.y, r);
        const s1 = base;
        const mOpts: (Spot | null)[] = [null, ...R.conductorSpots(s1)];
        const bOpts = R.barSpots(s1).map((b) => b.seam);
        let bestM: Spot | null = null, vM = -Infinity;
        for (const m of mOpts) {
          const v = simulate(s1, m, null, ctx);
          if (v > vM) { vM = v; bestM = m; }
        }
        let bestB: string | null = null, vB = vM;
        for (const b of bOpts) {
          const v = simulate(s1, bestM, b, ctx);
          if (v > vB + EPS) { vB = v; bestB = b; }
        }
        if (bestB) {
          for (const m of mOpts) {
            const v = simulate(s1, m, bestB, ctx);
            if (v > vB + EPS) { vB = v; bestM = m; }
          }
        }
        // 되돌리기 (applyPlace의 반대)
        delete base.board[R.cellKey(pl.x, pl.y)];
        base.hands[p].splice(hi, 0, k);
        base.serial--;
        if (R.kindOf(k).shape === 'timesig') base.ts--;
        base.turn = turn0;
        const total = vB + (rnd() - 0.5) * 0.25;
        const plan: Plan = { value: total, hi, k, x: pl.x, y: pl.y, r, meeple: bestM, bar: bestB };
        if (!best || total > best.value) best = plan;
        if (level === 'hard') cands.push(plan);
        yield;
      }
    }
  }
  if (level !== 'hard' || prm.top < 2 || cands.length < 2) return best;

  // ── 어려움: 2수 앞 읽기 ──
  // 1수 평가 상위 몇 개만, 상대 손패·주머니를 공개 정보와 맞게 섞은 '가능한 세계'에서
  // 다음 사람이 (보통 수준으로) 가장 좋게 받아치는 수까지 둬 보고 다시 평가한다. 실제 손패는 보지 않는다.
  cands.sort((a, b) => b.value - a.value);
  const top = cands.slice(0, prm.top);
  const worlds: State[] = [];
  for (let i = 0; i < prm.samples; i++) worlds.push(sampleWorld(base, p, rnd));
  const ctx2: Ctx = { ...ctx, after: true };
  const t0 = Date.now();
  let pick = top[0], pickV = -Infinity, done = 0;
  for (const c of top) {
    if (done >= 2 && Date.now() - t0 > prm.budgetMs) break;
    done++;
    let sum = 0;
    for (const w of worlds) {
      const s = R.fastClone(w);
      R.applyPlace(s, c.hi, c.x, c.y, c.r);
      if (c.meeple) R.applyConductor(s, c.meeple);
      if (c.bar) R.applyBar(s, c.bar);
      R.endTurn(s);
      if (!s.over && s.turn.p !== p) {
        const reply: Plan | null = yield* planMoveSteps(s, 'normal');
        if (reply) {
          R.applyPlace(s, reply.hi, reply.x, reply.y, reply.r);
          if (reply.meeple) R.applyConductor(s, reply.meeple);
          if (reply.bar) R.applyBar(s, reply.bar);
          R.resolveTurn(s);
        }
      }
      sum += evaluate(s, ctx2);
      yield;
    }
    const v = sum / worlds.length;
    if (v > pickV) { pickV = v; pick = c; }
  }
  return pick;
}

/** 상대 손패와 주머니를 섞어 다시 나눈 '가능한 세계' (나에게 보이지 않는 타일 묶음은 그대로) */
function sampleWorld(base: State, p: number, rnd: () => number): State {
  const s = R.fastClone(base);
  const pool: KindId[] = [...s.bag];
  s.hands.forEach((h, q) => { if (q !== p) pool.push(...h); });
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  let i = 0;
  s.hands = s.hands.map((h, q) => {
    if (q === p) return h.slice();
    const nh = pool.slice(i, i + h.length);
    i += h.length;
    return nh;
  });
  s.bag = pool.slice(i);
  return s;
}

/** 한 번에 끝까지 계산 (테스트·워커용) */
export function planMove(st: State, level: AiLevel = 'normal', prm: HardParams = HARD): Plan | null {
  const g = planMoveSteps(st, level, prm);
  let r = g.next();
  while (!r.done) r = g.next();
  return r.value;
}

/** 시뮬레이션용 복사: 지휘자·마디줄·정산은 보드·손패·주머니를 건드리지 않으므로 그 셋은 함께 쓴다 */
function simClone(s1: State): State {
  return {
    ...s1,
    bars: { ...s1.bars },
    meeples: s1.meeples.slice(),
    scored: { ...s1.scored },
    standDone: { ...s1.standDone },
    players: s1.players.map((pl) => ({ score: pl.score, meeples: pl.meeples, stats: { ...pl.stats } })),
    turn: { ...s1.turn },
    log: null,
    measures: [],
  };
}

function simulate(s1: State, m: Spot | null, b: string | null, ctx: Ctx): number {
  const s = simClone(s1);
  if (m) R.applyConductor(s, m);
  if (b) R.applyBar(s, b);
  R.resolveTurn(s);
  return evaluate(s, ctx);
}

function tilesFactor(s: State) {
  return Math.min(1, R.tilesRemaining(s) / (s.players.length * 4));
}

/** 지휘자가 있는 마디만 (점수 가능성은 지휘자가 있는 마디에만 있으므로 보드 전체를 돌 필요가 없다) */
function claimedSegments(s: State): Segment[] {
  const seen = new Set<string>();
  const out: Segment[] = [];
  for (const m of s.meeples) {
    if (m.f === 's') continue;
    if (seen.has(R.pieceKey(m.x, m.y, m.f))) continue;
    const seg = R.segmentOf(s, m.x, m.y, m.f);
    for (const pc of seg.pieces) seen.add(R.pieceKey(pc.x, pc.y, pc.pi));
    out.push(seg);
  }
  return out;
}

function potentials(s: State, f: number, ctx: Ctx): number[] {
  const pot = new Array(s.players.length).fill(0);
  for (const seg of claimedSegments(s)) {
    if (seg.closed) continue;
    const ms = R.meeplesIn(s, seg);
    if (!ms.length) continue;
    const winners = R.majority(ms);
    const open = seg.ends.filter((e) => e.kind === 'open').length;
    const bars = seg.ends.filter((e) => e.kind === 'bar').length;
    const rem = Math.max(...R.targetsOf(s, seg)) - seg.sum;
    let val = 0;
    if (open > 0 && rem >= 0) {
      if (rem === 0) val = 2 * seg.notes * (bars >= 1 ? 0.85 : 0.6);
      else {
        const pr = rem <= 1 ? 0.62 : rem <= 2 ? 0.58 : rem <= 3 ? 0.46 : 0.4;
        const add = rem <= 1 ? 1 : rem <= 2 ? 1.35 : rem <= 3 ? 1.6 : 1.8;
        val = 2 * (seg.notes + add) * pr * (bars >= 1 ? 1 : 0.8);
      }
      val *= f;
    }
    winners.forEach((w) => { pot[w] += val; });
  }
  standPotentials(s, f, pot);
  return pot;
}

function standPotentials(s: State, f: number, pot: number[]) {
  for (const m of s.meeples) {
    if (m.f !== 's') continue;
    const filled = R.standFilled(s, m.x, m.y);
    pot[m.p] += filled + (9 - filled) * 0.55 * f;
  }
}

function evaluate(s: State, ctx: Ctx): number {
  const { p, before } = ctx;
  const n = s.players.length;
  const f = tilesFactor(s);
  const gain = s.players.map((pl, i) => pl.score - before[i]);
  const pot = potentials(s, f, ctx);
  let v = gain[p] + pot[p] + s.players[p].meeples * (0.35 + 1.1 * f);
  if (!ctx.after && s.turn && s.turn.bar) v -= 0.2;
  if (ctx.level === 'easy') {
    // 쉬움: 상대 마디를 망치는 수에 큰 벌점 → 자기 마디만 열심히 채운다
    for (let i = 0; i < n; i++) if (i !== p && ctx.beforePot && pot[i] + gain[i] < ctx.beforePot[i] - 0.5) v -= 6;
    return v;
  }
  let opp = 0, oppPot = 0;
  for (let i = 0; i < n; i++) {
    if (i === p) continue;
    opp += gain[i];
    oppPot += pot[i];
  }
  const k = 1 / (n - 1);
  const w = n === 2 ? 1 : 0.85;
  return v - opp * k * w - oppPot * k * w * 0.9;
}

/** 놓을 곳이 없을 때 버릴 타일 (흔한 작은 박자는 아끼고 큰 박자부터) */
export function pickDiscard(st: State): number {
  const hand = st.hands[st.turn.p];
  let bi = 0, bv = -1;
  hand.forEach((k, i) => {
    const K = R.kindOf(k);
    const v = K.sym ? R.SYMBOLS[K.sym].beats : 5;
    if (v > bv) { bv = v; bi = i; }
  });
  return bi;
}
