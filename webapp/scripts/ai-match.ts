// 컴퓨터끼리 맞붙여 실력 비교 — 실행: npx vite-node scripts/ai-match.ts -- --a hard --b normal --games 100
// 옵션: --players 2 --level 1 --set mvp --under 1 --params '{"block":0.6}' (어려움 값 덮어쓰기)
import * as R from '../src/engine/engine';
import * as AI from '../src/engine/ai';
import type { AiLevel, HardParams } from '../src/engine/ai';

const argv = process.argv.slice(2);
const arg = (k: string, d: string) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : d; };
const A = arg('a', 'hard') as AiLevel;
const B = arg('b', 'normal') as AiLevel;
const games = +arg('games', '100');
const nP = +arg('players', '2');
const level = +arg('level', '1') as R.LevelId;
const set = arg('set', 'mvp') as R.SetId;
const under = arg('under', '1') === '1';
const seed0 = +arg('seed', '1000');
const prm: HardParams = { ...AI.HARD, ...JSON.parse(arg('params', '{}')) };

let winsA = 0, winsB = 0, ties = 0, sumA = 0, sumB = 0;
const ms: Record<string, { t: number; n: number; max: number }> = { [A]: { t: 0, n: 0, max: 0 }, [B]: { t: 0, n: 0, max: 0 } };
const t0 = Date.now();
for (let g = 0; g < games; g++) {
  // 자리 바꿔 가며: A가 0번 자리인 판과 1번 자리인 판을 번갈아
  const seed = seed0 + Math.floor(g / 2);
  const seats: AiLevel[] = Array.from({ length: nP }, (_, i) => ((i + g) % 2 === 0 ? A : B));
  const st = R.newGame({ players: seats.map((lv, i) => ({ name: `${lv}${i}`, type: 'ai' as const })), seed, level, set, noUnderClose: under });
  let guard = 0;
  while (!st.over && guard++ < 600) {
    const lv = seats[st.turn.p];
    const t1 = performance.now();
    const plan = AI.planMove(st, lv, prm);
    const dt = performance.now() - t1;
    ms[lv].t += dt; ms[lv].n++; ms[lv].max = Math.max(ms[lv].max, dt);
    if (!plan) { R.discardForNoMove(st, AI.pickDiscard(st)); continue; }
    R.applyPlace(st, plan.hi, plan.x, plan.y, plan.r);
    if (plan.meeple) R.applyConductor(st, plan.meeple);
    if (plan.bar) R.applyBar(st, plan.bar);
    R.endTurn(st);
  }
  // 자리별 평균 대신 레벨별 평균 점수
  const scA = seats.map((lv, i) => (lv === A ? st.players[i].score : null)).filter((v): v is number => v != null);
  const scB = seats.map((lv, i) => (lv === B ? st.players[i].score : null)).filter((v): v is number => v != null);
  const bestA = Math.max(...scA), bestB = Math.max(...scB);
  sumA += scA.reduce((a, b) => a + b, 0) / scA.length;
  sumB += scB.reduce((a, b) => a + b, 0) / scB.length;
  if (bestA > bestB) winsA++; else if (bestB > bestA) winsB++; else ties++;
}
const pct = (v: number) => `${((v / games) * 100).toFixed(1)}%`;
console.log(JSON.stringify({
  setup: { A, B, games, players: nP, level, set, under },
  wins: { [A]: pct(winsA), [B]: pct(winsB), ties: pct(ties) },
  avgScore: { [A]: +(sumA / games).toFixed(1), [B]: +(sumB / games).toFixed(1) },
  msPerMove: Object.fromEntries(Object.entries(ms).map(([k, v]) => [k, { avg: +(v.t / Math.max(1, v.n)).toFixed(1), max: +v.max.toFixed(0) }])),
  seconds: +((Date.now() - t0) / 1000).toFixed(1),
}));
