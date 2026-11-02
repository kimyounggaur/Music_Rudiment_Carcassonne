/* 컴퓨터 계산 전용 워커 (설치형 웹 빌드에서만 쓴다). 화면 스레드는 그동안 애니메이션·입력을 그대로 처리한다. */
import { planMove, type AiLevel, type HardParams } from './ai';
import type { State } from './engine';

interface Job { id: number; st: State; level: AiLevel; prm: HardParams }
const scope = self as unknown as { onmessage: ((e: MessageEvent<Job>) => void) | null; postMessage(m: unknown): void };

scope.onmessage = (e) => {
  const { id, st, level, prm } = e.data;
  try {
    scope.postMessage({ id, plan: planMove(st, level, prm) });
  } catch (err) {
    scope.postMessage({ id, error: String(err) });
  }
};
