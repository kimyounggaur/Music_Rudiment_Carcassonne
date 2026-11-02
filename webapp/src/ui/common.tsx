import * as React from 'react';
import { game, COLORS, kindName } from '../game/controller';
import * as ART from '../art/tiles';
import * as SKIN from '../art/skin';
import * as R from '../engine/engine';
import type { LogEntry, OrderItem } from '../engine/engine';

/** 컨트롤러가 바뀔 때마다 다시 그리기 */
export function useGame() {
  React.useSyncExternalStore(game.subscribe, game.getVersion, game.getVersion);
  return game;
}

/** 신뢰할 수 있는 내부 SVG 문자열(타일 그림)을 그리는 작은 도우미 */
export function Svg({ html, className, viewBox = '0 0 100 100', label }: { html: string; className?: string; viewBox?: string; label?: string }) {
  return (
    <svg viewBox={viewBox} className={className} role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true} focusable="false"
      dangerouslySetInnerHTML={{ __html: html }} />
  );
}

export function TileSvg({ k, r = 0, beats = true, className }: { k: R.KindId; r?: number; beats?: boolean; className?: string }) {
  return <Svg html={SKIN.tile(k, r, { beats })} className={className} />;
}

export function MeepleIcon({ hex, dim = false }: { hex: string; dim?: boolean }) {
  return <svg viewBox="-14 -34 28 40" aria-hidden="true" style={dim ? { opacity: 0.22 } : undefined} dangerouslySetInnerHTML={{ __html: SKIN.meepleFigure(0, 0, hex) }} />;
}

const I = ({ d, fill = false }: { d: React.ReactNode; fill?: boolean }) => (
  <svg viewBox="0 0 24 24" fill={fill ? 'currentColor' : 'none'} stroke={fill ? 'none' : 'currentColor'} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{d}</svg>
);
export const Icon = {
  rotate: () => <I d={<><path d="M20 12a8 8 0 1 1-2.34-5.66" /><path d="M20 4v5h-5" /></>} />,
  check: () => <I d={<path d="M5 12.5l4.5 4.5L19 7.5" />} />,
  undo: () => <I d={<><path d="M9 14L4 9l5-5" /><path d="M4 9h10a6 6 0 0 1 0 12h-3" /></>} />,
  next: () => <I d={<><path d="M5 12h14" /><path d="M13 6l6 6-6 6" /></>} />,
  soundOn: () => <I d={<><path d="M4 9v6h4l5 4V5L8 9H4z" /><path d="M16.5 8.5a5 5 0 0 1 0 7" /><path d="M19 6a8.5 8.5 0 0 1 0 12" /></>} />,
  soundOff: () => <I d={<><path d="M4 9v6h4l5 4V5L8 9H4z" /><path d="M17 9.5l5 5M22 9.5l-5 5" /></>} />,
  help: () => <I d={<><circle cx="12" cy="12" r="9" /><path d="M9.6 9.4a2.5 2.5 0 1 1 3.4 2.4c-.7.3-1 .8-1 1.5v.4" /><path d="M12 17v.2" /></>} />,
  menu: () => <I d={<path d="M4 7h16M4 12h16M4 17h16" />} />,
  list: () => <I d={<><path d="M9 6h11M9 12h11M9 18h11" /><path d="M4.5 6h.01M4.5 12h.01M4.5 18h.01" /></>} />,
  plus: () => <I d={<path d="M12 5v14M5 12h14" />} />,
  minus: () => <I d={<path d="M5 12h14" />} />,
  fit: () => <I d={<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />} />,
  play: () => <I fill d={<path d="M8 5.5v13l11-6.5z" />} />,
  x: () => <I d={<path d="M6 6l12 12M18 6L6 18" />} />,
  eye: () => <I d={<><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></>} />,
  copy: () => <I d={<><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3" /></>} />,
  cap: () => <I d={<><path d="M3 9l9-5 9 5-9 5-9-5z" /><path d="M7 11v5c0 1.5 2.5 3 5 3s5-1.5 5-3v-5" /></>} />,
  download: () => <I d={<><path d="M12 4v11" /><path d="M7 10l5 5 5-5" /><path d="M5 20h14" /></>} />,
  tiles: () => <I d={<><rect x="4" y="4" width="16" height="16" rx="4" /><path d="M4 12h16" /></>} />,
  bar: () => <I d={<><path d="M12 4v16" strokeWidth={2.6} /><path d="M5 12h4M15 12h4" /></>} />,
  back: () => <I d={<path d="M15 5l-7 7 7 7" />} />,
  reset: () => <I d={<><path d="M4 5v5h5" /><path d="M5 15a8 8 0 1 0 1.2-8.4L4 10" /></>} />,
  bulb: () => <I d={<><path d="M9.5 18h5M10.5 21h3" /><path d="M12 3a6 6 0 0 0-3.6 10.8c.7.6 1.1 1.3 1.1 2.1v.1h5v-.1c0-.8.4-1.5 1.1-2.1A6 6 0 0 0 12 3z" /></>} />,
  puzzle: () => <I d={<path d="M5 8h3.2a2.3 2.3 0 1 1 4.6 0H16v3.2a2.3 2.3 0 1 1 0 4.6V19H12.8a2.3 2.3 0 1 0-4.6 0H5v-3.2a2.3 2.3 0 1 0 0-4.6z" />} />,
  star: () => <I fill d={<path d="M12 3.2l2.6 5.5 6 .8-4.4 4.1 1.1 5.9L12 16.6l-5.3 2.9 1.1-5.9-4.4-4.1 6-.8z" />} />,
};

export const fmtBeats = ART.fmtBeats;

/** 1 + 2 + 1 = 4박 (색깔 칩) */
export function Eqn({ ev }: { ev: { order: OrderItem[]; sum: number } }) {
  const terms = ev.order.filter((o) => o.note || o.rest);
  return (
    <div className="eqn">
      {terms.map((o, i) => (
        <React.Fragment key={i}>
          {i > 0 && <span className="op">+</span>}
          <span className={`term${o.rest ? ' rest' : ''}`} style={{ background: ART.tileColor(o.k) }} title={o.rest ? '쉼표' : '음표'}>{fmtBeats(o.beats)}</span>
        </React.Fragment>
      ))}
      <span className="op">=</span>
      <span className="res">{fmtBeats(ev.sum)}박</span>
    </div>
  );
}

const termsText = (terms: number[] = []) => terms.map((b) => (b < 0 ? `(${fmtBeats(-b)})` : fmtBeats(b))).join('+');

export function LogItem({ e }: { e: LogEntry }) {
  const g = game;
  const pn = (i: number) => <span className="pn" style={{ color: g.uiColor(i) }}>{g.pname(i)}</span>;
  const names = (ws: number[]) => ws.map((w, i) => <React.Fragment key={w}>{i > 0 && ', '}{pn(w)}</React.Fragment>);
  const t = <span className="lt">{e.t}</span>;
  const ts = e.target && e.target !== 4 ? ` (${e.target}/4)` : '';
  switch (e.type) {
    case 'start': return <li><span className="lt">시작</span>타일을 섞었어요 · 시드 {e.seed}</li>;
    case 'turn': return <li>{t}{pn(e.p)} {kindName(e.k)}{e.meeple ? ` · 지휘자${e.meeple === 'stand' ? '(지휘대)' : ''}` : ''}{e.bar ? ' · 마디줄' : ''}</li>;
    case 'measure':
      return e.ok
        ? <li>{t}<span className="ok">마디 완성</span> {termsText(e.terms)} = {fmtBeats(e.sum)}박{ts} → {e.winners.length ? <>{names(e.winners)} +{e.points}</> : '주인 없음'}</li>
        : <li>{t}<span className="bad">틀린 마디</span> {termsText(e.terms)} = {fmtBeats(e.sum)}박{ts} → 0점</li>;
    case 'stand': return <li>{t}<span className="ok">지휘대 완성</span> → {e.owner != null ? <>{pn(e.owner)} +9</> : '주인 없음'}</li>;
    case 'discard': return <li>{t}{pn(e.p)} 놓을 곳이 없어 {kindName(e.k)}를 버림</li>;
    case 'openMeasure': return <li><span className="lt">끝</span>열린 마디 {e.terms?.length ? `${termsText(e.terms)} = ` : ''}{fmtBeats(e.sum)}박 → {e.points > 0 ? <>{names(e.winners)} +{e.points}</> : '0점, 지휘자 회수'}</li>;
    case 'openStand': return <li><span className="lt">끝</span>미완성 지휘대 {e.filled}칸 → {e.owner != null ? <>{pn(e.owner)} +{e.points}</> : '0점'}</li>;
    case 'final': return <li><span className="lt">끝</span><b>게임 끝</b></li>;
    default: return null;
  }
}

export function visibleLog(): LogEntry[] {
  const S = game.S;
  if (!S || !S.log) return [];
  return S.log.slice(-150).filter((e) => !(e.type === 'measure' && game.hidden.has(e.id))).reverse();
}

export { COLORS };
