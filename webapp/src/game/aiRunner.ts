/* 컴퓨터 계산을 화면과 분리해서 돌린다.
 *  1) 웹 워커 (설치형 웹 빌드): 다른 스레드에서 계산 → 화면은 전혀 멈추지 않는다.
 *  2) 시간 나눠 계산 (아티팩트, 또는 워커가 안 될 때): 한 프레임에 약 10ms씩만 계산하고 화면에 양보한다.
 * 워커가 만들어지지 않거나, 오류가 나거나, 너무 오래 답이 없으면 자동으로 2)로 바꾼다. */
import * as AI from '../engine/ai';
import * as R from '../engine/engine';
import type { State } from '../engine/engine';
import type { AiLevel, Plan, HardParams } from '../engine/ai';
import { makeAiWorker } from './aiWorkerClient';

/** 어려움이 2수 앞을 읽는 데 쓰는 최대 시간 */
export const HARD_BUDGET_MS = 1200;

let worker: Worker | null = null;
let tried = false;
let seq = 0;
const pending = new Map<number, { ok: (p: Plan | null) => void; fail: (e: Error) => void }>();
export let lastMode: 'worker' | 'sliced' | null = null;

function getWorker(): Worker | null {
  if (tried) return worker;
  tried = true;
  worker = makeAiWorker();
  if (worker) {
    worker.onmessage = (e: MessageEvent<{ id: number; plan?: Plan | null; error?: string }>) => {
      const job = pending.get(e.data.id);
      if (!job) return;
      pending.delete(e.data.id);
      if (e.data.error) job.fail(new Error(e.data.error)); else job.ok(e.data.plan ?? null);
    };
    worker.onerror = () => disableWorker('worker error');
  }
  return worker;
}

function disableWorker(why: string) {
  if (worker) { try { worker.terminate(); } catch { /* 무시 */ } }
  worker = null;
  for (const job of pending.values()) job.fail(new Error(why));
  pending.clear();
}

function viaWorker(w: Worker, st: State, level: AiLevel, prm: HardParams): Promise<Plan | null> {
  return new Promise((ok, fail) => {
    const id = ++seq;
    const timer = setTimeout(() => {
      if (!pending.has(id)) return;
      disableWorker('timeout');
    }, 20000);
    pending.set(id, { ok: (p) => { clearTimeout(timer); ok(p); }, fail: (e) => { clearTimeout(timer); fail(e); } });
    w.postMessage({ id, st, level, prm });
  });
}

const nextFrame = () => new Promise<void>((res) => {
  if (typeof requestAnimationFrame === 'function' && typeof document !== 'undefined' && !document.hidden) requestAnimationFrame(() => res());
  else setTimeout(res, 0);
});

async function sliced(st: State, level: AiLevel, prm: HardParams, sliceMs = 10): Promise<Plan | null> {
  const g = AI.planMoveSteps(st, level, prm);
  let r = g.next();
  let t = performance.now();
  while (!r.done) {
    if (performance.now() - t > sliceMs) { await nextFrame(); t = performance.now(); }
    r = g.next();
  }
  return r.value;
}

/** 컴퓨터의 다음 수. 넘겨준 상태는 복사해서 쓰므로 계산 중에 화면이 상태를 읽어도 안전하다 */
export async function planAsync(st: State, level: AiLevel): Promise<Plan | null> {
  const prm: HardParams = { ...AI.HARD, budgetMs: level === 'hard' ? HARD_BUDGET_MS : Infinity };
  const copy = R.clone(st, false);
  const w = getWorker();
  if (w) {
    try {
      const plan = await viaWorker(w, copy, level, prm);
      lastMode = 'worker';
      return plan;
    } catch { /* 아래로 */ }
  }
  lastMode = 'sliced';
  return sliced(copy, level, prm);
}
