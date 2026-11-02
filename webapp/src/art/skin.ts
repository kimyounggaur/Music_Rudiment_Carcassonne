/* 화면 그림 테마 고르기: '음악 마을'(기본) 또는 '카드'(인쇄용 리마스터 카드와 같은 그림).
 * 타일·지휘자·마디줄을 그리는 곳은 이 모듈을 거치므로, 테마를 바꾸면 보드·손패·퀴즈·규칙 화면이 함께 바뀐다. */
import type { KindId } from '../engine/engine';
import * as CARD from './tiles';
import * as VG from './village';

export type Skin = 'village' | 'card';
export const SKINS: Skin[] = ['village', 'card'];
export const SKIN_LABEL: Record<Skin, string> = { village: '음악 마을', card: '카드' };
let current: Skin = 'village';
export const getSkin = () => current;
export function setSkin(s: Skin) { current = s === 'card' ? 'card' : 'village'; }

export function tile(k: KindId, r: number, opts: { beats?: boolean } = {}): string {
  return current === 'village' ? VG.tile(k, r, opts) : CARD.tile(k, r, opts);
}
export function meepleFigure(x: number, y: number, color: string, cls = ''): string {
  return current === 'village' ? VG.meeple(x, y, color, cls) : CARD.meepleFigure(x, y, color, cls);
}
/** 이음새 위 마디줄 막대 (월드 좌표) */
export function bar(sk: string): string {
  if (current === 'village') return VG.bar(sk);
  const b = CARD.barShape(sk);
  return `<line x1="${b.x1}" y1="${b.y1}" x2="${b.x2}" y2="${b.y2}" stroke="#fff" stroke-width="12" stroke-linecap="round"/>`
    + `<line x1="${b.x1}" y1="${b.y1}" x2="${b.x2}" y2="${b.y2}" stroke="${CARD.INK}" stroke-width="7.5" stroke-linecap="round"/>`;
}
/** 보드 바탕 무늬 (<defs> 안 패턴과 채우기) */
export function boardPattern(): { defs: string; fill: string } {
  if (current === 'village') return { defs: VG.WOOD_PATTERN, fill: 'url(#vgWood)' };
  return { defs: '<pattern id="dots" width="100" height="100" x="-50" y="-50" patternUnits="userSpaceOnUse"><circle class="felt-dot" cx="50" cy="50" r="2.4" /></pattern>', fill: 'url(#dots)' };
}
