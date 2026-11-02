import * as React from 'react';
import { SKINS, SKIN_LABEL } from '../art/skin';
import { useGame } from './common';

/** 화면 그림: 음악 마을 / 카드 */
export function SkinPicker() {
  const g = useGame();
  return (
    <div className="skin-row" role="radiogroup" aria-label="화면 그림">
      <span>화면 그림</span>
      <div className="pill-seg">
        {SKINS.map((s) => (
          <button key={s} type="button" role="radio" aria-checked={g.skin === s} aria-pressed={g.skin === s} onClick={() => g.setSkin(s)}>{SKIN_LABEL[s]}</button>
        ))}
      </div>
      <small className="skin-help">{g.skin === 'village' ? '풀밭 타일 · 흙길 · 나무 테이블' : '인쇄용 카드와 같은 색 타일'}</small>
    </div>
  );
}
