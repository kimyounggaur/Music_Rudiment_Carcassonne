import * as React from 'react';
import { game, type ViewApi } from '../game/controller';
import * as R from '../engine/engine';
import * as ART from '../art/tiles';
import * as SKIN from '../art/skin';
import { TUT_STEPS } from '../game/tutorial';
import { Icon, fmtBeats, useGame } from './common';
import { PuzzleCard } from './PuzzleCard';
import * as PZ from '../game/puzzle';

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

function tileCells(seg: R.Segment): [number, number][] {
  const seen = new Set<string>();
  const out: [number, number][] = [];
  seg.pieces.forEach((p) => { const k = `${p.x},${p.y}`; if (!seen.has(k)) { seen.add(k); out.push([p.x, p.y]); } });
  return out;
}

/** 보드 레이어별 SVG 문자열 */
function layers() {
  const g = game;
  const S = g.S!;
  const ph = g.phase();
  const T = S.turn;
  const L = { defs: '', tiles: '', cand: '', hl: '', bars: '', seams: '', meeples: '', pv: '', fx: '' };

  // 같은 그림의 타일은 <defs>에 한 번만 그리고 <use>로 재사용 (그림이 자세한 테마에서도 보드를 빨리 다시 그리도록)
  const beatsOn = g.showBeats();
  const used = new Map<string, string>();
  for (const [ck, t] of Object.entries(S.board)) {
    const [x, y] = ck.split(',').map(Number);
    const isNew = t.n > g.animSerial;
    const id = `tk-${SKIN.getSkin()}-${t.k}-${t.r}-${beatsOn ? 1 : 0}`;
    if (!used.has(id)) used.set(id, SKIN.tile(t.k, t.r, { beats: beatsOn }));
    L.tiles += `<g transform="translate(${x * 100} ${y * 100})"><g${isNew ? ' class="t-new"' : ''}><use href="#${id}"/></g></g>`;
  }
  L.defs = [...used.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([id, art]) => `<g id="${id}">${art}</g>`).join('');

  if (ph === 'place' || ph === 'puzzle') {
    for (const c of g.visibleCands()) {
      if (g.pv && g.pv.x === c.x && g.pv.y === c.y) continue;
      L.cand += `<rect class="cand${g.tut || g.puz ? ' cand-coach' : ''}" data-act="cell" data-x="${c.x}" data-y="${c.y}" x="${c.x * 100 + 5}" y="${c.y * 100 + 5}" width="90" height="90" rx="12"/>`;
    }
  }

  // 퍼즐: 목표 마디 둘레를 점선으로
  const P = g.puz;
  if (P && P.def.type === 'fill' && !P.solved && !P.marks) {
    const seg = PZ.goalSegment(S, P.def);
    if (seg) {
      const cs = tileCells(seg);
      const xs = cs.map((c) => c[0]), ys = cs.map((c) => c[1]);
      const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
      L.hl += `<rect class="goal-ring" x="${x0 * 100 - 4}" y="${y0 * 100 - 4}" width="${(x1 - x0 + 1) * 100 + 8}" height="${(y1 - y0 + 1) * 100 + 8}" rx="16"/>`;
    }
  }
  if (P && P.marks) {
    for (const m of P.marks) for (const [cx, cy] of m.cells) {
      if (!R.tileAt(S, cx, cy)) continue;
      L.hl += `<rect class="${m.ok ? 'flash-ok' : 'flash-bad'}" x="${cx * 100 + 2}" y="${cy * 100 + 2}" width="96" height="96" rx="12"/>`;
    }
  }

  if (!P && !S.over && !T.placed && S.serial > 0) {
    const last = Object.entries(S.board).find(([, t]) => t.n === S.serial);
    if (last && last[1].p != null) {
      const [x, y] = last[0].split(',').map(Number);
      L.hl += `<rect class="last-ring" x="${x * 100 + 1}" y="${y * 100 + 1}" width="98" height="98" rx="13" style="stroke:${g.uiColor(last[1].p)}"/>`;
    }
  }
  if (ph === 'act' || (ph === 'ai' && T.placed)) {
    const { x, y } = T.placed!;
    const t = R.tileAt(S, x, y)!;
    const cells = new Map<string, [number, number]>();
    R.geomOf(t).pieces.forEach((_, pi) => tileCells(R.segmentOf(S, x, y, pi)).forEach((c) => cells.set(c.join(','), c)));
    if (!cells.size) cells.set(`${x},${y}`, [x, y]);
    for (const [cx, cy] of cells.values()) L.hl += `<rect class="seg-ring" x="${cx * 100 + 3}" y="${cy * 100 + 3}" width="94" height="94" rx="12"/>`;
  }
  if (g.flash) {
    const fc = g.flash.ok === null ? 'flash-q' : g.flash.ok ? 'flash-ok' : 'flash-bad';
    for (const [cx, cy] of g.flash.cells) {
      if (!R.tileAt(S, cx, cy)) continue;
      L.hl += `<rect class="${fc}" x="${cx * 100 + 2}" y="${cy * 100 + 2}" width="96" height="96" rx="12"/>`;
    }
  }

  for (const sk of Object.keys(S.bars)) {
    const b = ART.barShape(sk);
    const mine = P ? P.myBars.includes(sk) && !P.solved : ph === 'act' && T.bar === sk && !g.tut;
    const fresh = P ? P.myBars[P.myBars.length - 1] === sk : T.bar === sk;
    L.bars += `<g${mine ? ` class="bar-mine" data-act="unbar" data-seam="${sk}"` : ''}><g${fresh ? ' class="pop"' : ''}>`
      + (mine ? (P ? `<rect x="${b.cx - (b.x1 === b.x2 ? 34 : 50)}" y="${b.cy - (b.x1 === b.x2 ? 50 : 34)}" width="${b.x1 === b.x2 ? 68 : 100}" height="${b.x1 === b.x2 ? 100 : 68}" fill="transparent"/>` : `<circle cx="${b.cx}" cy="${b.cy}" r="22" fill="transparent"/>`) : '')
      + SKIN.bar(sk) + '</g></g>';
  }

  for (const seam of g.visibleSeams()) {
    const b = ART.barShape(seam);
    // 퍼즐에서는 이음새 둘레를 넓게 눌러도 되도록 (작은 화면용)
    const wide = g.puz ? `<rect x="${b.cx - (b.x1 === b.x2 ? 34 : 50)}" y="${b.cy - (b.x1 === b.x2 ? 50 : 34)}" width="${b.x1 === b.x2 ? 68 : 100}" height="${b.x1 === b.x2 ? 100 : 68}" fill="transparent"/>` : '';
    L.seams += `<g class="seam-c" data-act="seam" data-seam="${seam}">${wide}<circle class="hitc" cx="${b.cx}" cy="${b.cy}" r="17"/>`
      + `<line class="ghost" x1="${(b.x1 + b.cx) / 2}" y1="${(b.y1 + b.cy) / 2}" x2="${(b.x2 + b.cx) / 2}" y2="${(b.y2 + b.cy) / 2}"/></g>`;
  }

  for (const m of S.meeples) {
    const t = R.tileAt(S, m.x, m.y)!;
    const [ax, ay] = ART.meepleAnchor(t.k, t.r, m.f);
    const mine = ph === 'act' && !!T.meeple && m.t === S.turnNo && m.p === T.p && !g.tut;
    const fresh = m.t === S.turnNo;
    const inner = SKIN.meepleFigure(m.x * 100 + ax, m.y * 100 + ay, g.colorHex(m.p), mine ? 'mine' : '');
    const body = fresh ? `<g class="pop">${inner}</g>` : inner;
    L.meeples += mine ? `<g data-act="unmeeple">${body}</g>` : body;
  }
  for (const s of g.visibleSpots()) {
    const t = R.tileAt(S, s.x, s.y)!;
    const [ax, ay] = ART.meepleAnchor(t.k, t.r, s.f);
    L.meeples += `<g class="spot" data-act="spot" data-f="${s.f}"><rect x="${s.x * 100 + ax - 15}" y="${s.y * 100 + ay - 34}" width="30" height="38" fill="transparent"/>${SKIN.meepleFigure(s.x * 100 + ax, s.y * 100 + ay, g.colorHex(T.p))}</g>`;
  }

  if (g.pv && !T.placed) {
    const k = S.hands[g.cur()][g.sel];
    if (k) {
      const { x, y, r, rots } = g.pv;
      L.pv = `<g class="pv" data-act="pv" transform="translate(${x * 100} ${y * 100})"><g opacity=".96">${SKIN.tile(k, r, { beats: g.showBeats() })}</g>`
        + '<rect class="pv-ring" x="1" y="1" width="98" height="98" rx="13"/>'
        + (rots.length > 1 && (ph === 'place' || ph === 'puzzle')
          ? '<g class="pv-rot" transform="translate(88 12)"><circle r="13"/><path d="M5.5 -1.5A6 6 0 1 1 3.4 -5.6M5.6 -8.4v3.6h-3.6" fill="none" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></g>'
          : '')
        + '</g>';
    }
  }

  L.fx = g.fx.map((f) => `<g transform="translate(${f.x} ${f.y})"><text class="fx-text fx-rise" text-anchor="middle" style="fill:${f.color}">${esc(f.text)}</text></g>`).join('');
  return L;
}

/** 지금 마디의 목표·합 안내 */
function measureInfo(): { hint: string; target: string } {
  const g = game;
  const S = g.S!;
  const ph = g.phase();
  let seg: R.Segment | null = null;
  let sim = false;
  if (ph === 'place' && g.pv) {
    const k = S.hands[g.cur()][g.sel];
    if (k && R.GEOM[k][g.pv.r].pieces.some((p) => p.beats > 0)) {
      const ck = `${g.pv.x},${g.pv.y}`;
      const isTs = R.kindOf(k).shape === 'timesig';
      S.board[ck] = { k, r: g.pv.r, n: -1, p: null };
      if (isTs) S.ts++;
      seg = R.segmentOf(S, g.pv.x, g.pv.y, 0);
      const tg = R.targetsOf(S, seg);
      delete S.board[ck];
      if (isTs) S.ts--;
      sim = true;
      return info(seg, tg, sim);
    }
  } else if ((ph === 'act' || ph === 'ai') && S.turn.placed) {
    const { x, y } = S.turn.placed;
    const t = R.tileAt(S, x, y)!;
    const pi = R.geomOf(t).pieces.findIndex((p) => p.beats > 0);
    if (pi >= 0) { seg = R.segmentOf(S, x, y, pi); return info(seg, R.targetsOf(S, seg), false); }
  }
  return { hint: '', target: '' };
  function info(sg: R.Segment, tg: number[], s: boolean) {
    const tgText = tg.map((v) => `${v}박`).join('·');
    const target = S.cfg.level === 2 && (tg.length > 1 || tg[0] !== 4) ? `이 마디 목표 ${tgText} (${tg.map((v) => `${v}/4`).join('·')})` : '';
    const hint = g.O.hint ? (s ? `놓으면 이 마디 ${fmtBeats(sg.sum)}박${sg.closed ? ' · 바로 닫혀요' : ''}` : `이 마디 지금 ${fmtBeats(sg.sum)}박 / 목표 ${tgText}`) : '';
    return { hint, target };
  }
}

function Step() {
  const g = game;
  const ph = g.phase();
  const p = g.cur();
  let msg: React.ReactNode = '';
  if (ph === 'over') msg = '게임이 끝났어요';
  else if (ph === 'ai') msg = g.thinking ? `${g.pname(p)}가 생각하는 중…` : `${g.pname(p)}가 두는 중…`;
  else if (ph === 'cover') msg = <><b>{g.pname(p)}</b> 차례예요 · 아래 ‘손패 보기’를 누르세요</>;
  else if (ph === 'nomove') msg = '놓을 자리가 없어요 · 버릴 타일을 한 장 고르세요';
  else if (ph === 'place') msg = g.pv ? <><b>1</b> 타일을 누르면 돌아가요 · ‘여기에 놓기’로 확정</> : <><b>1</b> 손패에서 타일을 고르고 점선 칸을 누르세요</>;
  else if (ph === 'act') {
    const T = g.S!.turn;
    const canM = !T.meeple && R.conductorSpots(g.S!).length > 0;
    const canB = !T.bar && R.barSpots(g.S!).length > 0;
    if (canM && canB) msg = <><b>2</b> 지휘자 · <b>3</b> 마디줄은 고를 수 있어요 · 끝나면 ‘차례 끝내기’</>;
    else if (canM) msg = <><b>2</b> 흐린 지휘자를 눌러 올릴 수 있어요 · 끝나면 ‘차례 끝내기’</>;
    else if (canB) msg = <><b>3</b> 점선 동그라미에 마디줄을 꽂을 수 있어요 · 끝나면 ‘차례 끝내기’</>;
    else msg = '‘차례 끝내기’를 누르세요';
  }
  const { hint, target } = measureInfo();
  return (
    <div className="step" aria-live="polite">
      <span className="msg">{msg}</span>
      {target && <span className="hint tgt">{target}</span>}
      {hint && <span className="hint">{hint}</span>}
    </div>
  );
}

function Coach() {
  const g = game;
  const st = g.tutStep()!;
  const n = g.tut!.step + 1;
  const total = TUT_STEPS.length - 1;
  if (st.expect.kind === 'quiz') return null;
  return (
    <div className="coach" role="status" aria-live="polite">
      <div className="coach-top"><span className="coach-n">{Math.min(n, total)}/{total}</span><b>{st.title}</b>
        <button type="button" className="coach-x" aria-label="튜토리얼 그만하기" onClick={() => g.toSetup()}><Icon.x /></button></div>
      <p>{st.text}</p>
      {st.expect.kind === 'next' && <div className="coach-row"><button type="button" className="btn primary small" onClick={() => g.tutNext()}>다음<Icon.next /></button></div>}
      {st.expect.kind === 'choice' && (
        <div className="coach-row">
          {st.expect.options.map((o, i) => <button key={o} type="button" className="btn small" onClick={() => g.tutChoose(i)}>{o}</button>)}
        </div>
      )}
      {g.tut!.msg && <p className="coach-msg">{g.tut!.msg}</p>}
    </div>
  );
}

export function Board() {
  const g = useGame();
  const wrapRef = React.useRef<HTMLDivElement>(null);
  const svgRef = React.useRef<SVGSVGElement>(null);
  const vpRef = React.useRef<SVGGElement>(null);
  const ctl = React.useRef<ViewApi & { apply(): void; v: { x: number; y: number; s: number } } | null>(null);

  if (!ctl.current) {
    const v = { x: 0, y: 0, s: 0.9 };
    let anim = 0;
    const rect = () => svgRef.current!.getBoundingClientRect();
    const apply = () => { vpRef.current?.setAttribute('transform', `translate(${v.x.toFixed(1)} ${v.y.toFixed(1)}) scale(${v.s.toFixed(4)})`); };
    const setView = (nv: { x: number; y: number; s: number }, animate: boolean) => {
      cancelAnimationFrame(anim);
      const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (!animate || reduce) { Object.assign(v, nv); apply(); return; }
      const from = { ...v };
      const t0 = performance.now();
      const stepFn = (now: number) => {
        const t = Math.min(1, (now - t0) / 300);
        const k = 1 - Math.pow(1 - t, 3);
        v.x = from.x + (nv.x - from.x) * k; v.y = from.y + (nv.y - from.y) * k; v.s = from.s + (nv.s - from.s) * k;
        apply();
        if (t < 1) anim = requestAnimationFrame(stepFn);
      };
      anim = requestAnimationFrame(stepFn);
    };
    const fitTarget = () => {
      const r = rect();
      const S = game.S!;
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      const pts: [number, number][] = Object.keys(S.board).map((ck) => ck.split(',').map(Number) as [number, number]);
      if (game.puz) for (const c of game.cands) pts.push([c.x, c.y]); // 퍼즐: 놓을 칸도 화면 안에
      for (const [x, y] of pts) {
        x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
      }
      // 퍼즐은 한 줄짜리라 둘레 여백을 줄여 타일을 크게 (휴대폰에서도 누르기 쉽게)
      const px = game.puz ? 0.3 : 1, py = game.puz ? 0.6 : 1;
      const b = { x0: (x0 - px) * 100, y0: (y0 - py) * 100, x1: (x1 + 1 + px) * 100, y1: (y1 + 1 + py) * 100 };
      const ov = wrapRef.current?.querySelector<HTMLElement>('.coach, .puz-card');
      const top = ov ? ov.offsetTop + ov.offsetHeight + 12 : 56;
      const s = clamp(Math.min((r.width - 24) / (b.x1 - b.x0), (r.height - top - 16) / (b.y1 - b.y0)), 0.3, game.puz ? 1.5 : 1.05);
      return { x: r.width / 2 - ((b.x0 + b.x1) / 2) * s, y: top + (r.height - top) / 2 - ((b.y0 + b.y1) / 2) * s, s };
    };
    const zoomAt = (mx: number, my: number, s: number) => {
      s = clamp(s, 0.25, 2.2);
      const wx = (mx - v.x) / v.s, wy = (my - v.y) / v.s;
      v.x = mx - wx * s; v.y = my - wy * s; v.s = s;
      apply();
    };
    ctl.current = {
      v, apply,
      fit: (animate) => { if (!game.S) return; const r = rect(); if (!r.width || !r.height) return; setView(fitTarget(), animate); },
      zoomBy: (k) => { const r = rect(); zoomAt(r.width / 2, r.height / 2, v.s * k); },
      cellVisible: (x, y) => {
        const r = rect();
        const sx = x * 100 * v.s + v.x, sy = y * 100 * v.s + v.y, w = 100 * v.s;
        return sx + w > 0 && sx < r.width && sy + w > 50 && sy < r.height;
      },
      ensureVisible: (x, y) => {
        const r = rect();
        const w = 100 * v.s;
        const sx = x * 100 * v.s + v.x, sy = y * 100 * v.s + v.y;
        if (sx >= 24 && sx + w <= r.width - 24 && sy >= 60 && sy + w <= r.height - 24) return;
        const fit = fitTarget();
        if (fit.s >= Math.min(v.s, 0.6)) { setView(fit, true); return; }
        setView({ s: v.s, x: r.width / 2 - (x * 100 + 50) * v.s, y: (r.height + 40) / 2 - (y * 100 + 50) * v.s }, true);
      },
    };
    (ctl.current as any).zoomAt = zoomAt;
  }

  React.useEffect(() => {
    const api = ctl.current!;
    g.view = api;
    api.apply();
    requestAnimationFrame(() => { if (g.view === api) api.fit(false); }); // 화면이 새로 열릴 때 보드 전체가 보이게
    const svg = svgRef.current!;
    const ptrs = new Map<number, { x: number; y: number }>();
    let drag: { sx: number; sy: number; vx: number; vy: number; moved: boolean; act: Element | null } | null = null;
    let pinch: { d: number; s: number; mx: number; my: number; vx: number; vy: number } | null = null;
    const local = (e: PointerEvent | WheelEvent) => { const r = svg.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
    const v = api.v;
    const down = (e: PointerEvent) => {
      if (e.button > 0) return;
      const p = local(e);
      ptrs.set(e.pointerId, p);
      try { svg.setPointerCapture(e.pointerId); } catch { /* 무시 */ }
      if (ptrs.size === 1) { drag = { sx: p.x, sy: p.y, vx: v.x, vy: v.y, moved: false, act: (e.target as Element).closest('[data-act]') }; pinch = null; }
      else if (ptrs.size === 2) {
        const [a, b] = [...ptrs.values()];
        pinch = { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, s: v.s, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2, vx: v.x, vy: v.y };
        if (drag) drag.moved = true;
      }
    };
    const move = (e: PointerEvent) => {
      if (!ptrs.has(e.pointerId)) return;
      const p = local(e);
      ptrs.set(e.pointerId, p);
      if (ptrs.size >= 2 && pinch) {
        const [a, b] = [...ptrs.values()];
        const s = clamp(pinch.s * (Math.hypot(a.x - b.x, a.y - b.y) / pinch.d), 0.25, 2.2);
        const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
        const wx = (pinch.mx - pinch.vx) / pinch.s, wy = (pinch.my - pinch.vy) / pinch.s;
        v.x = mx - wx * s; v.y = my - wy * s; v.s = s;
        api.apply();
      } else if (drag) {
        const dx = p.x - drag.sx, dy = p.y - drag.sy;
        if (!drag.moved && Math.hypot(dx, dy) > 7) { drag.moved = true; svg.classList.add('dragging'); }
        if (drag.moved) { v.x = drag.vx + dx; v.y = drag.vy + dy; api.apply(); }
      }
    };
    const end = (e: PointerEvent) => {
      if (!ptrs.has(e.pointerId)) return;
      ptrs.delete(e.pointerId);
      if (e.type === 'pointerup' && ptrs.size === 0 && drag && !drag.moved && drag.act) handleAct(drag.act as HTMLElement);
      if (ptrs.size === 0) { drag = null; pinch = null; svg.classList.remove('dragging'); }
      else if (ptrs.size === 1) { const [only] = [...ptrs.values()]; drag = { sx: only.x, sy: only.y, vx: v.x, vy: v.y, moved: true, act: null }; pinch = null; }
    };
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      const p = local(e);
      (api as any).zoomAt(p.x, p.y, v.s * Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0016)));
    };
    svg.addEventListener('pointerdown', down);
    svg.addEventListener('pointermove', move);
    svg.addEventListener('pointerup', end);
    svg.addEventListener('pointercancel', end);
    svg.addEventListener('wheel', wheel, { passive: false });
    let last: { w: number; h: number } | null = null;
    const ro = new ResizeObserver(() => {
      const r = svg.getBoundingClientRect();
      if (!r.width || !r.height) return;
      if (last) { v.x += (r.width - last.w) / 2; v.y += (r.height - last.h) / 2; api.apply(); }
      last = { w: r.width, h: r.height };
    });
    ro.observe(wrapRef.current!);
    return () => {
      svg.removeEventListener('pointerdown', down);
      svg.removeEventListener('pointermove', move);
      svg.removeEventListener('pointerup', end);
      svg.removeEventListener('pointercancel', end);
      svg.removeEventListener('wheel', wheel);
      ro.disconnect();
      if (g.view === api) g.view = null;
    };
  }, []);

  // 새로 놓인 타일 애니메이션 표시는 잠깐만 유지
  const serial = g.S ? g.S.serial : 0;
  React.useEffect(() => {
    const id = setTimeout(() => { g.animSerial = Math.max(g.animSerial, serial); }, 450);
    return () => clearTimeout(id);
  }, [serial]);

  if (!g.S) return null;
  const L = layers();
  const bgPat = SKIN.boardPattern();
  return (
    <div className="board-wrap" ref={wrapRef}>
      <svg id="board" ref={svgRef} aria-label="게임 보드: 끌어서 옮기고, 휠이나 두 손가락으로 확대">
        <defs dangerouslySetInnerHTML={{ __html: bgPat.defs + L.defs }} />
        <g ref={vpRef}>
          <rect x="-20000" y="-20000" width="40000" height="40000" fill={bgPat.fill} />
          <g id="Lcand" dangerouslySetInnerHTML={{ __html: L.cand }} />
          <g id="Ltiles" dangerouslySetInnerHTML={{ __html: L.tiles }} />
          <g id="Lhl" dangerouslySetInnerHTML={{ __html: L.hl }} />
          <g id="Lbars" dangerouslySetInnerHTML={{ __html: L.bars }} />
          <g id="Lseams" dangerouslySetInnerHTML={{ __html: L.seams }} />
          <g id="Lmeeples" dangerouslySetInnerHTML={{ __html: L.meeples }} />
          <g id="Lpv" dangerouslySetInnerHTML={{ __html: L.pv }} />
          <g id="Lfx" dangerouslySetInnerHTML={{ __html: L.fx }} />
        </g>
      </svg>
      {g.tut ? <Coach /> : g.puz ? <PuzzleCard /> : <Step />}
      <div className="zoom">
        <button type="button" aria-label="확대" onClick={() => ctl.current!.zoomBy(1.25)}><Icon.plus /></button>
        <button type="button" aria-label="축소" onClick={() => ctl.current!.zoomBy(0.8)}><Icon.minus /></button>
        <button type="button" aria-label="보드 전체 보기" onClick={() => ctl.current!.fit(true)}><Icon.fit /></button>
      </div>
    </div>
  );
}

function handleAct(el: HTMLElement) {
  const g = game;
  if (g.busy || !g.S) return;
  const a = el.dataset.act;
  if (a === 'cell') g.tapCell(+el.dataset.x!, +el.dataset.y!);
  else if (a === 'pv') g.rotate(1);
  else if (a === 'spot') g.placeMeeple(el.dataset.f === 's' ? 's' : Number(el.dataset.f));
  else if (a === 'unmeeple') g.removeMeeple();
  else if (a === 'seam') g.placeBar(el.dataset.seam!);
  else if (a === 'unbar') g.removeBar(el.dataset.seam);
}
