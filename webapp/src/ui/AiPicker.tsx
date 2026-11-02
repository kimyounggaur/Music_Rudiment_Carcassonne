import * as React from 'react';
import { AI_LEVELS, AI_LABEL, type AiLevel } from '../engine/ai';

const HELP: Record<AiLevel, string> = {
  easy: '자기 마디만 채워요. 상대를 일부러 막지 않아요',
  normal: '점수를 따지며 막기도 해요',
  hard: '상대의 받아치기까지 한 수 더 내다봐요',
};

/** 컴퓨터 실력 3단계 고르기 */
export function AiPicker({ value, onChange, id = 'aiLevel' }: { value: AiLevel; onChange: (v: AiLevel) => void; id?: string }) {
  return (
    <div className="ai-pick" role="radiogroup" aria-labelledby={`${id}Lbl`}>
      <span className="ai-lbl" id={`${id}Lbl`}>컴퓨터 실력</span>
      <div className="pill-seg ai-seg">
        {AI_LEVELS.map((lv) => (
          <button key={lv} type="button" role="radio" aria-checked={value === lv} aria-pressed={value === lv} onClick={() => onChange(lv)}>{AI_LABEL[lv]}</button>
        ))}
      </div>
      <small className="ai-help">{HELP[value]}</small>
    </div>
  );
}
