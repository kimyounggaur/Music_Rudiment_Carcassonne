/* 룰북 삽화 — 10장: 샘플 플레이 (설계서 13장 · 튜토리얼과 같은 판: 1 + 2 + 1 = 4박 → 6점) */
import * as R from '../engine/engine';
import { COLORS } from '../game/colors';
import * as ART from './tiles';
import { Canvas, drawState, measureInfo, tw, P1, P2, type Fig } from './rulebook';
import { fb, settleNote } from './rulebookKit';
import { sampleRun } from './figsPlay';

/** 그림 맨 위: 누구 차례인지 (색 점 + 제목 + 보충) */
function header(c: Canvas, who: number, title: string, sub: string) {
  c.raw(`<circle cx="9" cy="-68" r="8.5" fill="${COLORS[who].hex}" stroke="#fff" stroke-width="1.6"/>`);
  c.grow(0, -78, 18, -58);
  c.text(26, -62, title, { size: 18, anchor: 'start', bold: true });
  c.text(26, -38, sub, { size: 15, anchor: 'start', tone: 'mut' });
}
/** 왼쪽부터 알약 말풍선을 나란히 */
function pillRow(c: Canvas, x0: number, y: number, items: Array<{ s: string; tone?: 'plain' | 'acc' | 'ok' | 'no' | 'soft' }>, size = 15) {
  let x = x0;
  for (const it of items) {
    const w = tw(it.s, size) + 28;
    c.pill(x + w / 2, y, it.s, { size, tone: it.tone ?? 'soft' });
    x += w + 10;
  }
}

export function sample1(): Fig {
  const { st } = sampleRun()[0];
  const info = measureInfo(st, 1, 0);
  const c = new Canvas();
  header(c, P1, '① 빨강 차례', '손패에서 4분음표를 골라요');
  c.band(50, 200, 0);
  drawState(c, st);
  c.ring(1, 0, 'acc');
  c.bracket(50, 200, 122, `지금 ${fb(info.sum)}박`, { tone: 'acc', size: 16 });
  pillRow(c, 0, 192, [{ s: '① 4분음표 놓기' }, { s: '② 지휘자 올리기' }]);
  return c.done('빨강이 4분음표를 시작 타일 오른쪽에 놓고 지휘자를 올려 이 마디를 찜한다. 마디는 지금 1박이다');
}

export function sample2(): Fig {
  const { st } = sampleRun()[1];
  const info = measureInfo(st, 2, 0);
  const c = new Canvas();
  header(c, P2, '② 파랑 차례', '손패에서 2분음표를 골라 이어 붙여요');
  c.band(50, 300, 0);
  drawState(c, st);
  c.ring(2, 0, 'acc');
  c.meeple(2, 0, 'h-s', 0, 0, P2, { ghost: true });
  const [ax, ay] = ART.meepleAnchor('h-s', 0, 0);
  c.mark(200 + ax + 26, ay - 36, 'no', 13);
  c.bracket(50, 300, 122, `지금 ${fb(info.sum)}박`, { tone: 'acc', size: 16 });
  pillRow(c, 0, 192, [{ s: '① 2분음표 놓기' }, { s: '② 지휘자는 못 올려요', tone: 'no' }]);
  c.text(0, 236, '이 마디는 빨강이 이미 찜해서 파랑은 올릴 수 없어요', { size: 14.5, anchor: 'start', tone: 'mut' });
  return c.done('파랑이 2분음표를 이어 붙이면 마디는 3박이 되고, 이 마디에는 이미 빨강 지휘자가 있어 파랑은 지휘자를 올리지 못한다');
}

export function sample3(): Fig {
  const { st } = sampleRun()[2];
  const info = measureInfo(st, 3, 0);
  const c = new Canvas();
  header(c, P1, '③ 다시 빨강 차례', '마지막 1박을 채워요');
  c.band(50, 400, 0);
  drawState(c, st);
  c.ring(3, 0, 'acc');
  c.bracket(50, 400, 122, '한 마디', { tone: info.ok ? 'ok' : 'no', size: 16 });
  c.eqn(225, 196, info.terms, { sum: info.sum, ok: info.ok });
  pillRow(c, 0, 250, [{ s: '① 4분음표 놓기' }, { s: '③ 오른쪽 끝에 마디줄' }]);
  return c.done('빨강이 4분음표를 마지막에 놓고 오른쪽 끝에 마디줄을 꽂으면 1+2+1로 마디가 정확히 4박이 된다');
}

export function sample4(): Fig {
  const { st, ev } = sampleRun()[3];
  const m = ev.find((e): e is R.MeasureEvent => e.type === 'measure')!;
  const c = new Canvas();
  header(c, P1, '④ 정산', '마디가 닫혔으니 바로 계산해요');
  c.band(50, 400, 0, 'ok');
  drawState(c, st);
  settleNote(c, st, [1, 0], [50, 400], { label: '닫힌 마디' });
  // 지휘자는 주인에게 돌아오고, 점수판은 엔진 값
  const y = 318;
  const n = st.cfg.meeples;
  for (let j = 0; j < n; j++) c.pawn(16 + j * 26, y, P1, 0.8, false);
  c.text(16 + n * 26 + 8, y - 6, `빨강 지휘자 ${st.players[P1].meeples}개가 돌아왔어요`, { size: 15, anchor: 'start', tone: 'mut', bold: true });
  pillRow(c, 0, y + 42, [
    { s: `빨강 ${st.players[P1].score}점`, tone: 'acc' },
    { s: `파랑 ${st.players[P2].score}점`, tone: 'plain' },
  ], 16);
  void m;
  return c.done('마디가 닫히면 바로 정산한다. 1+2+1=4박이라 음표 세 장 × 2점 = 6점을 빨강이 받고 빨강의 지휘자는 돌아온다');
}

export function sampleWrong(): Fig {
  const { st } = sampleRun(true)[3];
  const c = new Canvas();
  header(c, P1, '만약 ③에서 2분음표를 놓았다면?', '1 + 2 + 2 = 5박 — 넘쳐서 틀린 마디예요');
  c.band(50, 400, 0, 'no');
  drawState(c, st);
  settleNote(c, st, [1, 0], [50, 400], { label: '닫힌 마디' });
  c.text(0, 316, '지휘자만 돌아오고, 점수는 아무도 받지 못해요', { size: 15, anchor: 'start', tone: 'mut', bold: true });
  pillRow(c, 0, 352, [
    { s: `빨강 ${st.players[P1].score}점`, tone: 'plain' },
    { s: `파랑 ${st.players[P2].score}점`, tone: 'plain' },
  ], 16);
  return c.done('같은 판에서 마지막에 4분음표 대신 2분음표를 놓고 닫았다면 1+2+2=5박이라 틀린 마디가 되어 0점이고 지휘자만 돌아온다');
}
