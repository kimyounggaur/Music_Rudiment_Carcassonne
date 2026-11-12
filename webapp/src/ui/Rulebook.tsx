/* 룰북 — 그림으로 보는 규칙. 위쪽 막대의 룰북 버튼(어느 화면에서든)으로 열린다.
 * 글과 그림 자리는 rulebookContent.ts, 그림은 art/rulebookFigs.ts. 여기는 읽기 화면만 맡는다:
 * 목차(스크롤 따라 표시) · 진행 막대 · 그림 크게 보기 · 장 링크 · 이번 판 설정 · 키보드/초점 처리. */
import * as React from 'react';
import { game } from '../game/controller';
import * as R from '../engine/engine';
import { buildFig, type FigId } from '../art/rulebookFigs';
import { CHAPTERS, FIG_CAP, FIG_NO, FIG_ORDER, parseInline, type Block, type Chapter, type NoteTone } from './rulebookContent';
import { Icon, useGame } from './common';
import { SkinPicker } from './SkinPicker';

interface Ctx {
  jump: (id: string) => void;
  openFig: (id: FigId, opener: HTMLElement) => void;
  root: React.RefObject<HTMLDivElement>;
}
const RbCtx = React.createContext<Ctx>(null as unknown as Ctx);

// ── 글 안의 표시 ─────────────────────────────────────────────────────
function Inline({ s }: { s: string }) {
  const { jump } = React.useContext(RbCtx);
  return (
    <>
      {parseInline(s).map((p, i) => {
        if (p.k === 'b') return <b key={i}>{p.s}</b>;
        if (p.k === 'mark') return <mark key={i}>{p.s}</mark>;
        if (p.k === 'ref') return <button key={i} type="button" className="rb-xref" onClick={() => jump(p.id)}>{p.s}</button>;
        return <React.Fragment key={i}>{p.s}</React.Fragment>;
      })}
    </>
  );
}

// ── 그림 ─────────────────────────────────────────────────────────────
/** 그림 한 장. 화면 근처에 오기 전에는 빈 틀(크기만)만 두고, 가까워지면 그림을 채운다 */
function Figure({ id, cap }: { id: FigId; cap: string }) {
  const { root, openFig } = React.useContext(RbCtx);
  const fig = buildFig(id);
  const [near, setNear] = React.useState(false);
  const btn = React.useRef<HTMLButtonElement>(null);
  React.useEffect(() => {
    const el = btn.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') { setNear(true); return; }
    const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { setNear(true); io.disconnect(); } }, { root: root.current, rootMargin: '900px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  const [x, y, w, h] = fig.vb;
  const no = FIG_NO[id];
  return (
    <figure className="rb-fig" id={`rb-fig-${id}`}>
      <button type="button" ref={btn} className="fig-box" aria-label={`그림 ${no} 크게 보기 — ${fig.alt}`} onClick={() => openFig(id, btn.current!)}>
        <svg className="fig-svg" viewBox={`${x} ${y} ${w} ${h}`} style={{ ['--w' as string]: w }} aria-hidden="true" focusable="false" dangerouslySetInnerHTML={{ __html: near ? fig.body : '' }} />
        <span className="fig-zoom" aria-hidden="true"><Icon.zoom /></span>
      </button>
      <figcaption><b>그림 {no}</b><span><Inline s={cap} /></span></figcaption>
    </figure>
  );
}

const ZOOMS = [1, 1.5, 2, 3];
/** 그림 크게 보기 — 화면에 맞춰 키우고, 더 키우면 밀어서 봐요. 앞뒤 그림으로 넘길 수 있어요 */
function Lightbox({ at, onGo, onClose }: { at: number; onGo: (i: number) => void; onClose: () => void }) {
  const id = FIG_ORDER[at];
  useGame();
  const fig = buildFig(id);
  const [x, y, w, h] = fig.vb;
  const body = React.useRef<HTMLDivElement>(null);
  const [box, setBox] = React.useState({ w: 0, h: 0 });
  const [zi, setZi] = React.useState(0);
  React.useEffect(() => { setZi(0); body.current?.scrollTo(0, 0); }, [at]);
  React.useLayoutEffect(() => {
    const el = body.current;
    if (!el) return;
    const measure = () => setBox({ w: el.clientWidth, h: el.clientHeight });
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const padX = 24 + 28, padY = 24 + 28; // 바깥 여백 + 카드 안쪽 여백
  const fit = box.w ? Math.max(0.2, Math.min((box.w - padX) / w, (box.h - padY) / h, 1.6)) : 1;
  const s = fit * ZOOMS[zi];
  const last = FIG_ORDER.length - 1;
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); }
      else if (e.key === 'ArrowLeft' && at > 0) { e.preventDefault(); onGo(at - 1); }
      else if (e.key === 'ArrowRight' && at < last) { e.preventDefault(); onGo(at + 1); }
      else if (e.key === '+' || e.key === '=') setZi((z) => Math.min(ZOOMS.length - 1, z + 1));
      else if (e.key === '-' || e.key === '_') setZi((z) => Math.max(0, z - 1));
      else if (e.key === '0') setZi(0);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [at, last]);
  const closeRef = React.useRef<HTMLButtonElement>(null);
  React.useEffect(() => { closeRef.current?.focus({ preventScroll: true }); }, []);
  return (
    <div className="rb-lb" role="dialog" aria-modal="true" aria-label={`그림 ${FIG_NO[id]} 크게 보기`}>
      <div className="rb-lb-bar">
        <div className="rb-lb-t"><b>그림 {FIG_NO[id]} <small>/ {FIG_ORDER.length}</small></b><span>{FIG_CAP[id].replace(/\*\*|==|\[\[\w+ |\]\]/g, '')}</span></div>
        <div className="rb-lb-ctl">
          <button type="button" className="icon-btn" aria-label="이전 그림" disabled={at <= 0} onClick={() => onGo(at - 1)}><Icon.back /></button>
          <button type="button" className="icon-btn" aria-label="다음 그림" disabled={at >= last} onClick={() => onGo(at + 1)}><Icon.fwd /></button>
          <button type="button" className="icon-btn" aria-label="줄이기" disabled={zi <= 0} onClick={() => setZi(zi - 1)}><Icon.minus /></button>
          <span className="z" aria-live="polite">{zi === 0 ? '맞춤' : `×${ZOOMS[zi]}`}</span>
          <button type="button" className="icon-btn" aria-label="키우기" disabled={zi >= ZOOMS.length - 1} onClick={() => setZi(zi + 1)}><Icon.plus /></button>
          <button type="button" className="icon-btn" ref={closeRef} aria-label="그림 닫기" onClick={onClose}><Icon.x /></button>
        </div>
      </div>
      <div className="rb-lb-body" ref={body} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
        <div className="rb-lb-card">
          <svg width={Math.round(w * s)} height={Math.round(h * s)} viewBox={`${x} ${y} ${w} ${h}`} role="img" aria-label={fig.alt} dangerouslySetInnerHTML={{ __html: fig.body }} />
        </div>
      </div>
    </div>
  );
}

// ── 블록 ─────────────────────────────────────────────────────────────
const NOTE_ICON: Record<NoteTone, React.ReactNode> = {
  tip: <Icon.bulb />, warn: <Icon.alert />, rule: <Icon.check />, why: <Icon.help />,
};

/** 지금 하는 판의 설정 (게임 중에만) */
function CfgCard() {
  const g = useGame();
  const S = g.S;
  if (!S || g.screen !== 'game') return null;
  const c = S.cfg;
  const chips = [
    R.LEVELS[c.level].label,
    R.SETS[c.set].label,
    `타일 ${R.tileCount(c)}장 · 마디줄 ${R.barCount(c)}개`,
    `지휘자 ${c.meeples}개 · 손패 ${c.handSize}장`,
    `덜 찬 마디 닫기 금지 ${c.noUnderClose ? '켜짐' : '꺼짐'}`,
    `열린 마디 부분 점수 ${c.softEnd ? '켜짐' : '꺼짐'}`,
  ];
  return (
    <aside className="rb-cfg" aria-label="지금 하는 판의 설정">
      <b>{g.tut ? '튜토리얼은 이 설정이에요' : '지금 하는 판은 이 설정이에요'}</b>
      <div className="chips">{chips.map((t) => <span key={t}>{t}</span>)}</div>
    </aside>
  );
}

/** 이 장 규칙이 어느 난이도 것인지, 지금 판에 쓰이는지 */
function LvBadge({ lv }: { lv: R.LevelId }) {
  const g = useGame();
  const cur = g.screen === 'game' && g.S ? g.S.cfg.level : null;
  const name = R.LEVELS[lv].label.split(' ')[0];
  let txt = `${R.LEVELS[lv].label} 규칙`;
  let cls = '';
  if (cur != null) {
    if (cur >= lv) { txt += ' · 지금 판에 쓰여요'; cls = ' on'; } else { txt += ` · 지금 판은 ${R.LEVELS[cur].label.split(' ')[0]}이라 쓰이지 않아요`; cls = ' off'; }
  }
  return <span className={`rb-lv${cls}`} title={`${name} 난이도의 규칙이에요`}>{txt}</span>;
}

function Actions({ items }: { items: Array<'tutorial' | 'puzzles'> }) {
  const g = useGame();
  const inGame = g.screen === 'game' && !!g.S && !g.tut && !g.S.over;
  const startTutorial = () => {
    if (g.screen === 'game') g.toSetup(); // 하던 게임은 이어하기로 저장하고 처음 화면을 거쳐서
    g.startTutorial();
  };
  const showTut = items.includes('tutorial') && g.screen !== 'puzzle';
  const showPuz = items.includes('puzzles') && g.screen !== 'puzzles';
  if (!showTut && !showPuz) return null;
  return (
    <div className="rb-actions">
      {showTut && <button type="button" className="btn primary" onClick={startTutorial}><Icon.cap />2분 튜토리얼 시작</button>}
      {showPuz && <button type="button" className="btn" onClick={() => g.openPuzzles()}><Icon.puzzle />{g.screen === 'puzzle' ? '퍼즐 목록으로' : '학습 퍼즐 풀어 보기'}</button>}
      {inGame && <small>지금 하던 게임은 자동으로 저장돼요. 처음 화면의 “이어하기”로 돌아올 수 있어요.</small>}
    </div>
  );
}

function Table({ b }: { b: Extract<Block, { t: 'table' }> }) {
  return (
    <div className="rb-tbl" role="region" aria-label={b.label} tabIndex={0}>
      <table>
        <caption className="sr-only">{b.label}</caption>
        <thead><tr>{b.head.map((h, i) => <th key={i} scope="col">{h}</th>)}</tr></thead>
        <tbody>
          {b.rows.map((r, i) => (
            <tr key={i}>{r.map((c, j) => (j === 0 ? <th key={j} scope="row"><Inline s={c} /></th> : <td key={j}><Inline s={c} /></td>))}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BlockView({ b }: { b: Block }) {
  switch (b.t) {
    case 'p': return <p className="rb-p"><Inline s={b.s} /></p>;
    case 'h': return <h3 className="rb-h">{b.s}</h3>;
    case 'ul': return <ul className="rb-ul">{b.items.map((s, i) => <li key={i}><Inline s={s} /></li>)}</ul>;
    case 'ol': return <ol className="rb-ol">{b.items.map((s, i) => <li key={i}><Inline s={s} /></li>)}</ol>;
    case 'steps': return (
      <ol className="rb-steps">
        {b.items.map((it, i) => <li key={i}><span className="n" aria-hidden="true">{i + 1}</span><div><b>{it.title}</b><span className="s">{it.s}</span></div></li>)}
      </ol>
    );
    case 'fig': return <Figure id={b.id} cap={b.cap} />;
    case 'note': return (
      <aside className={`rb-note ${b.tone}`}>
        <span className="ic" aria-hidden="true">{NOTE_ICON[b.tone]}</span>
        <div>{b.title && <b className="t">{b.title}</b>}<p><Inline s={b.s} /></p></div>
      </aside>
    );
    case 'table': return <Table b={b} />;
    case 'facts': return (
      <dl className="rb-facts">
        {b.items.map((f) => <div key={f.k}><dt>{f.k}</dt><dd>{f.v}</dd></div>)}
      </dl>
    );
    case 'cfg': return <CfgCard />;
    case 'skin': return <div className="rb-skin"><SkinPicker /></div>;
    case 'actions': return <Actions items={b.items} />;
    case 'faq': return (
      <div className="rb-faq">
        {b.items.map((it, i) => (
          <details key={i} className="rb-qa" open={i === 0}>
            <summary><span className="q" aria-hidden="true">Q</span>{it.q}</summary>
            <div className="rb-qa-body">{it.body.map((x, k) => <BlockView key={k} b={x} />)}</div>
          </details>
        ))}
      </div>
    );
  }
}

// ── 장 ───────────────────────────────────────────────────────────────
const ChapterView = React.memo(function ChapterView({ c, i, sk, reg }: { c: Chapter; i: number; sk: string; reg: (i: number, el: HTMLElement | null) => void }) {
  const { jump } = React.useContext(RbCtx);
  const prev = CHAPTERS[i - 1];
  const next = CHAPTERS[i + 1];
  return (
    <article className="rb-ch" id={`rb-ch-${c.id}`} data-sk={sk} aria-labelledby={`rb-h-${c.id}`} ref={(el) => reg(i, el)}>
      <header className="rb-chh">
        <span className="rb-no" aria-hidden="true">{c.no}</span>
        <div>
          <h2 id={`rb-h-${c.id}`}>{c.title}</h2>
          {c.lv != null && <LvBadge lv={c.lv} />}
          <p className="rb-lead"><Inline s={c.lead} /></p>
        </div>
      </header>
      {c.blocks.map((b, k) => <BlockView key={k} b={b} />)}
      <nav className="rb-pn" aria-label="장 이동">
        {prev ? <button type="button" className="prev" onClick={() => jump(prev.id)}><small><Icon.back />이전 장</small><b>{prev.title}</b></button> : <span />}
        {next
          ? <button type="button" className="next" onClick={() => jump(next.id)}><small>다음 장<Icon.fwd /></small><b>{next.title}</b></button>
          : <button type="button" className="next" onClick={() => game.close()}><small>끝까지 읽었어요</small><b>룰북 닫기</b></button>}
      </nav>
    </article>
  );
});

/** 초점이 룰북 밖으로 나가지 않게 Tab을 돌려 준다 */
function trapTab(e: React.KeyboardEvent, container: HTMLElement | null) {
  if (e.key !== 'Tab' || !container) return;
  const items = Array.from(container.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input:not([disabled]), summary, [tabindex]:not([tabindex="-1"])'))
    .filter((el) => el.offsetParent !== null && !el.closest('[inert]'));
  if (!items.length) return;
  const first = items[0];
  const last = items[items.length - 1];
  const act = document.activeElement;
  if (e.shiftKey && (act === first || !container.contains(act))) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && (act === last || !container.contains(act))) { e.preventDefault(); first.focus(); }
}

// ── 룰북 ─────────────────────────────────────────────────────────────
export function Rulebook() {
  const g = useGame();
  const m = g.modal as Extract<typeof g.modal, { type: 'rulebook' }>;
  const wrap = React.useRef<HTMLDivElement>(null);
  const main = React.useRef<HTMLDivElement>(null);
  const lb = React.useRef<HTMLDivElement>(null);
  const root = React.useRef<HTMLDivElement>(null);
  const chEls = React.useRef<Array<HTMLElement | null>>([]);
  const chipEls = React.useRef<Array<HTMLButtonElement | null>>([]);
  const chipBar = React.useRef<HTMLElement>(null);
  const raf = React.useRef(0);
  const opener = React.useRef<HTMLElement | null>(null);
  const figOpener = React.useRef<HTMLElement | null>(null);
  const [cur, setCur] = React.useState(0);
  const [prog, setProg] = React.useState(0);
  const [zoom, setZoom] = React.useState<number | null>(null);
  const zoomRef = React.useRef<number | null>(null);
  zoomRef.current = zoom;
  const reduce = React.useMemo(() => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches, []);

  const reg = React.useCallback((i: number, el: HTMLElement | null) => { chEls.current[i] = el; }, []);

  const jump = React.useCallback((id: string, instant = false) => {
    const i = CHAPTERS.findIndex((c) => c.id === id);
    const sc = root.current;
    const el = chEls.current[i];
    if (!sc || !el) return;
    const top = el.getBoundingClientRect().top - sc.getBoundingClientRect().top + sc.scrollTop;
    sc.scrollTo({ top: Math.max(0, top - 2), behavior: instant || reduce ? 'auto' : 'smooth' });
    setCur(i);
  }, [reduce]);

  const sync = React.useCallback(() => {
    const sc = root.current;
    if (!sc) return;
    const top = sc.getBoundingClientRect().top;
    let idx = 0;
    chEls.current.forEach((el, i) => { if (el && el.getBoundingClientRect().top - top <= 120) idx = i; });
    const max = sc.scrollHeight - sc.clientHeight;
    if (max > 0 && sc.scrollTop >= max - 4) idx = CHAPTERS.length - 1;
    setCur(idx);
    setProg(max > 0 ? Math.min(1, sc.scrollTop / max) : 0);
  }, []);
  const onScroll = React.useCallback(() => {
    if (raf.current) return;
    raf.current = requestAnimationFrame(() => { raf.current = 0; sync(); });
  }, [sync]);

  // 열릴 때: 열어 준 곳 기억 · 지정한 장으로 · 본문에 초점 / 닫힐 때: 되돌려 놓기
  React.useEffect(() => {
    opener.current = document.activeElement as HTMLElement | null;
    if (m.ch) jump(m.ch, true);
    sync();
    root.current?.focus({ preventScroll: true });
    return () => {
      cancelAnimationFrame(raf.current);
      const el = opener.current;
      if (el && el.isConnected) el.focus({ preventScroll: true });
    };
  }, []);

  // 목차 칩(작은 화면)이 현재 장을 따라가게
  React.useEffect(() => {
    const bar = chipBar.current;
    const chip = chipEls.current[cur];
    if (!bar || !chip || bar.offsetParent === null) return;
    bar.scrollTo({ left: chip.offsetLeft - (bar.clientWidth - chip.offsetWidth) / 2, behavior: reduce ? 'auto' : 'smooth' });
  }, [cur]);

  // Esc: 그림 크게 보기가 열려 있으면 그것만 닫고, 아니면 룰북을 닫는다
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && zoomRef.current == null) { e.preventDefault(); game.close(); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  // 그림 크게 보기 동안 뒤쪽은 비활성(초점·읽어 주기에서 빠진다)
  React.useEffect(() => {
    main.current?.toggleAttribute('inert', zoom != null);
  }, [zoom]);

  const openFig = React.useCallback((id: FigId, el: HTMLElement) => {
    figOpener.current = el;
    setZoom(FIG_ORDER.indexOf(id));
  }, []);
  const closeFig = React.useCallback(() => {
    setZoom(null);
    const el = figOpener.current;
    requestAnimationFrame(() => { if (el && el.isConnected) el.focus({ preventScroll: true }); });
  }, []);

  const ctx = React.useMemo<Ctx>(() => ({ jump: (id) => jump(id), openFig, root }), [jump, openFig]);

  return (
    <RbCtx.Provider value={ctx}>
      <div className="rb-wrap" ref={wrap} onKeyDown={(e) => trapTab(e, zoom != null ? lb.current : wrap.current)}>
        <div className="rb-main" ref={main}>
          <header className="rb-head">
            <span className="rb-hic" aria-hidden="true"><Icon.book /></span>
            <div className="rb-ht">
              <h2>룰북</h2>
              <span className="rb-sub">그림 {FIG_ORDER.length}장으로 보는 리듬마을</span>
            </div>
            <span className="rb-cnt" aria-hidden="true">{cur + 1} / {CHAPTERS.length}</span>
            <button type="button" className="btn small rb-x" onClick={() => game.close()} aria-label="룰북 닫기"><Icon.x /><span>닫기</span></button>
          </header>
          <div className="rb-prog" aria-hidden="true"><i style={{ transform: `scaleX(${prog})` }} /></div>
          <nav className="rb-chips" aria-label="장 목차" ref={chipBar}>
            {CHAPTERS.map((c, i) => (
              <button key={c.id} type="button" ref={(el) => { chipEls.current[i] = el; }} className={i === cur ? 'on' : ''} aria-current={i === cur ? 'true' : undefined} onClick={() => jump(c.id)}>{c.no}. {c.short}</button>
            ))}
          </nav>
          <div className="rb-body">
            <nav className="rb-toc" aria-label="장 목차">
              {CHAPTERS.map((c, i) => (
                <button key={c.id} type="button" className={i === cur ? 'on' : ''} aria-current={i === cur ? 'true' : undefined} onClick={() => jump(c.id)}>
                  <span className="n" aria-hidden="true">{c.no}</span>{c.title}
                </button>
              ))}
              <p className="rb-toc-foot">그림을 누르면 크게 볼 수 있어요.</p>
            </nav>
            <div className="rb-scroll" ref={root} onScroll={onScroll} tabIndex={0} role="region" aria-label="룰북 본문">
              <div className="rb-col">
                {CHAPTERS.map((c, i) => <ChapterView key={c.id} c={c} i={i} sk={g.skin} reg={reg} />)}
              </div>
            </div>
          </div>
        </div>
        {zoom != null && (
          <div ref={lb} className="rb-lb-host">
            <Lightbox at={zoom} onGo={setZoom} onClose={closeFig} />
          </div>
        )}
      </div>
    </RbCtx.Provider>
  );
}
