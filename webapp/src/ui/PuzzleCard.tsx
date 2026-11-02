import * as React from 'react';
import { game } from '../game/controller';
import * as PZ from '../game/puzzle';
import { Icon } from './common';

export const TYPE_LABEL: Record<PZ.PuzzleType, string> = { count: '박 세기', fill: '채우기', divide: '마디줄 긋기' };

/** 보드 위 문제 카드 (튜토리얼 코치 자리) */
export function PuzzleCard() {
  const g = game;
  const P = g.puz!;
  const d = P.def;
  const S = g.S!;
  const status: string[] = [];
  if (!P.solved) {
    const left = PZ.placeOf(d) - P.placed;
    if (d.type === 'fill' && left > 0) status.push(`놓을 타일 ${left}장`);
    if (PZ.barsOf(d) > 0) status.push(`마디줄 ${S.barsLeft}개 남음`);
  }
  return (
    <div className={`puz-card${P.solved ? ' solved' : ''}`} role="status" aria-live="polite">
      <div className="pc-top"><span className="pc-type">{TYPE_LABEL[d.type]}</span><b>{d.title}</b></div>
      <p className="pc-ask">{d.ask}</p>
      {status.length > 0 && <div className="pc-status">{status.map((s) => <span key={s}>{s}</span>)}</div>}
      {P.hints > 0 && (
        <ul className="pc-hints">
          {d.hints.slice(0, P.hints).map((h) => <li key={h}><Icon.bulb />{h}</li>)}
        </ul>
      )}
      {P.msg && <p className={`pc-msg ${P.msg.tone}`}>{P.msg.text}</p>}
      {P.solved && <p className="pc-msg ok">정답이에요!</p>}
      {!P.solved && P.hints < d.hints.length && (
        <button type="button" className="btn small ghost pc-hint" onClick={() => g.puzHint()}><Icon.bulb />힌트 보기{d.hints.length > 1 ? ` ${P.hints + 1}/${d.hints.length}` : ''}</button>
      )}
    </div>
  );
}

