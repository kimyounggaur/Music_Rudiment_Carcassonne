/* 설치형(웹) 빌드: 컴퓨터 계산용 워커를 만든다. 아티팩트 빌드에서는 vite.config가 이 파일을 aiWorkerClient.stub.ts로 바꾼다. */
export function makeAiWorker(): Worker | null {
  try {
    return new Worker(new URL('../engine/ai.worker.ts', import.meta.url), { type: 'module' });
  } catch {
    return null;
  }
}
