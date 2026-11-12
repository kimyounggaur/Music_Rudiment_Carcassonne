import * as React from 'react';
import { game } from '../game/controller';
import * as R from '../engine/engine';
import * as PZ from '../game/puzzle';
import type { LevelId } from '../engine/engine';
import { Board } from './Board';
import { Eqn, Icon, RulebookButton, TileSvg, fmtBeats, useGame } from './common';

import { TYPE_LABEL } from './PuzzleCard';
const DRILL_HELP: Record<LevelId, string> = {
  0: '1·2·4박 음표',
  1: '+ 점2분음표(3박)',
  2: '+ 쉼표 · ½박 · 3/4 · 2/4',
};
const newSeed = () => (Math.random() * 2 ** 31) >>> 0;

function Stars({ n, of = 3, className = '' }: { n: number; of?: number; className?: string }) {
  return (
    <span className={`stars ${className}`} aria-hidden="true">
      {Array.from({ length: of }, (_, i) => <i key={i} className={i < n ? 'on' : ''}>★</i>)}
    </span>
  );
}

function where(id: string) {
  const ch = PZ.chapterOf(id);
  const i = ch.puzzles.findIndex((p) => p.id === id);
  return { ch, i, n: ch.puzzles.length };
}

// ── 목록 ─────────────────────────────────────────────────────────────
export function PuzzleList() {
  const g = useGame();
  const prog = g.puzProgress();
  const got = PZ.ALL_PUZZLES.reduce((a, p) => a + (prog.stars[p.id] || 0), 0);
  const max = PZ.ALL_PUZZLES.length * 3;
  const next = g.nextUnsolved();
  const started = got > 0;
  const allDone = PZ.ALL_PUZZLES.every((p) => prog.stars[p.id]);
  const firstRef = React.useRef<HTMLButtonElement>(null);
  React.useEffect(() => { firstRef.current?.focus({ preventScroll: true }); window.scrollTo(0, 0); }, []);
  return (
    <main className="plist">
      <header className="pl-head">
        <div className="pl-nav">
          <button type="button" className="btn small ghost pl-back" onClick={() => g.toSetup()}><Icon.back />처음 화면</button>
          <RulebookButton id="rulebookBtn" labeled />
        </div>
        <div className="pl-title">
          <p className="eyebrow">혼자 연습 · 실제 게임 규칙 그대로</p>
          <h1>학습 퍼즐</h1>
          <p className="lede">박 세기 → 빈 박 채우기 → 마디줄 긋기 순서로, 한 수씩 풀며 박자를 익혀요.</p>
        </div>
        <div className="pl-total">
          <div className="pl-score" aria-label={`모은 별 ${got}개, 전체 ${max}개`}>
            <span className="star-ic"><Icon.star /></span><b className="num">{got}</b><small>/ {max}</small>
          </div>
          <div className="pl-bar" aria-hidden="true"><i style={{ width: `${(got / max) * 100}%` }} /></div>
          <button type="button" ref={firstRef} className="btn primary" onClick={() => g.startPuzzle({ kind: 'course', id: next.id })}>
            {allDone ? '처음부터 다시' : started ? `이어서 풀기 · ${where(next.id).ch.no}장 ${where(next.id).i + 1}번` : '1장부터 시작'}<Icon.next />
          </button>
        </div>
      </header>

      <section className="chapters" aria-label="단원">
        {PZ.CHAPTERS.map((ch) => {
          const cgot = ch.puzzles.reduce((a, p) => a + (prog.stars[p.id] || 0), 0);
          const solved = ch.puzzles.filter((p) => prog.stars[p.id]).length;
          return (
            <article className="chap" key={ch.no} aria-labelledby={`ch${ch.no}`}>
              <div className="chap-top">
                <div className="chap-icons" aria-hidden="true">{ch.icons.map((k) => <TileSvg key={k} k={k} />)}</div>
                <div className="chap-txt">
                  <p className="chap-no">{ch.no}장 · {R.LEVELS[ch.level].label}</p>
                  <h2 id={`ch${ch.no}`}>{ch.title}</h2>
                  <p className="chap-sub">{ch.sub}</p>
                </div>
                <div className="chap-prog" aria-label={`${ch.puzzles.length}문제 중 ${solved}문제 풀이, 별 ${cgot}개`}>
                  <span className="num">{solved}/{ch.puzzles.length}</span>
                  <small>★ {cgot}</small>
                </div>
              </div>
              <ol className="pz-grid">
                {ch.puzzles.map((p, i) => {
                  const s = prog.stars[p.id] || 0;
                  return (
                    <li key={p.id}>
                      <button type="button" className={`pz-btn${s ? ' done' : ''}${p.id === next.id && !allDone ? ' next' : ''}`}
                        aria-label={`${ch.no}장 ${i + 1}번 ${p.title} (${TYPE_LABEL[p.type]})${s ? `, 별 ${s}개` : ''}`}
                        onClick={() => g.startPuzzle({ kind: 'course', id: p.id })}>
                        <span className="pz-n num">{i + 1}</span>
                        <span className="pz-t">{p.title}</span>
                        <span className="pz-k">{TYPE_LABEL[p.type]}</span>
                        <Stars n={s} />
                      </button>
                    </li>
                  );
                })}
              </ol>
            </article>
          );
        })}
      </section>

      <section className="drill" aria-labelledby="drillTitle">
        <div className="drill-txt">
          <h2 id="drillTitle">무한 연습</h2>
          <p>문제가 끝없이 새로 만들어져요. 한 번에 맞히면 연속 정답이 이어져요.</p>
        </div>
        <div className="drill-lv">
          {([0, 1, 2] as LevelId[]).map((lv) => (
            <button key={lv} type="button" className="drill-btn" onClick={() => g.startPuzzle({ kind: 'drill', level: lv, seed: newSeed(), streak: 0 })}>
              <b>{R.LEVELS[lv].label}</b>
              <small>{DRILL_HELP[lv]}</small>
              <span className="drill-best">최고 연속 <b className="num">{prog.best[lv] || 0}</b></span>
            </button>
          ))}
        </div>
      </section>
    </main>
  );
}

// ── 풀이 화면 ─────────────────────────────────────────────────────────
function PuzzleBar() {
  const g = game;
  const P = g.puz!;
  const d = P.def;
  const S = g.S!;
  if (d.type === 'count') {
    return (
      <footer className="handbar puz-bar">
        <div className="hand-owner"><b>몇 박일까요?</b><span>하나를 고르세요</span></div>
        <div className="choices" role="group" aria-label="답 고르기">
          {d.choices!.map((c) => {
            const wrong = P.wrong.includes(c);
            const right = P.solved && Math.abs(c - (d.answer ?? -1)) < 1e-9;
            return (
              <button key={c} type="button" className={`choice${wrong ? ' wrong' : ''}${right ? ' right' : ''}`} disabled={P.solved || wrong}
                aria-label={`${fmtBeats(c)}박`} onClick={() => g.puzAnswer(c)}>
                {fmtBeats(c)}<small>박</small>
              </button>
            );
          })}
        </div>
      </footer>
    );
  }
  const hand = S.hands[0];
  const placing = d.type === 'fill' && P.placed < PZ.placeOf(d) && !P.solved;
  const busy = !!g.pv && placing;
  return (
    <footer className="handbar puz-bar">
      <div className="hand-owner">
        {d.type === 'fill' ? <><b>손패</b><span>{placing ? '타일을 골라요' : `${hand.length}장 남음`}</span></> : <><b>마디줄</b><span>{S.barsLeft}개 남음</span></>}
      </div>
      {d.type === 'fill' && (
        <div className="hand">
          {hand.map((k, i) => {
            const sel = placing && i === g.sel;
            const K = R.kindOf(k);
            const r = sel && g.pv ? g.pv.r : 0;
            const beats = K.sym ? `${fmtBeats(R.SYMBOLS[K.sym].beats)}박` : '';
            return (
              <button key={`${i}-${k}`} type="button" className={`htile${sel ? ' sel' : ''}${placing ? '' : ' dim'}`} disabled={!placing}
                aria-label={`${K.name}${g.showBeats() ? ` ${beats}` : ''}${sel ? ' (선택됨)' : ''}`} onClick={() => g.selectHand(i)}>
                <TileSvg k={k} r={r} beats={g.showBeats()} />
                <span className="hname">{K.name}</span>
              </button>
            );
          })}
        </div>
      )}
      {d.type === 'divide' && (
        <div className="bar-stock" aria-hidden="true">
          {Array.from({ length: PZ.barsOf(d) }, (_, i) => <i key={i} className={i < S.barsLeft ? 'on' : ''} />)}
        </div>
      )}
      <div className="acts">
        {busy ? (
          <>
            <button type="button" className="btn" disabled={g.pv!.rots.length < 2} onClick={() => g.rotate(1)}><Icon.rotate />돌리기</button>
            <button type="button" className="btn primary" id="pzPlace" onClick={() => g.confirmPlace()}><Icon.check />여기에 놓기</button>
          </>
        ) : (
          <>
            <button type="button" className="btn" disabled={!P.stack.length || P.solved} onClick={() => g.puzUndo()}><Icon.undo />되돌리기</button>
            <button type="button" className="btn" disabled={!P.stack.length || P.solved} onClick={() => g.puzReset()}><Icon.reset />처음부터</button>
            <button type="button" className="btn primary" id="pzCheck" disabled={P.solved} onClick={() => g.puzCheck()}><Icon.check />확인</button>
          </>
        )}
      </div>
    </footer>
  );
}

export function PuzzleScreen() {
  const g = useGame();
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (g.modal || g.screen !== 'puzzle' || !g.puz) return;
      const t = e.target as HTMLElement;
      if (t && t.matches && t.matches('input, textarea, select')) return;
      const P = g.puz;
      if (P.def.type === 'count') {
        const i = ['1', '2', '3', '4'].indexOf(e.key);
        if (i >= 0 && P.def.choices![i] != null) g.puzAnswer(P.def.choices![i]);
        return;
      }
      if (e.key === 'r' || e.key === 'R') g.rotate(e.shiftKey ? -1 : 1);
      else if (e.key === 'Enter') {
        if (t && t.closest && t.closest('button')) return;
        if (g.pv) g.confirmPlace(); else g.puzCheck();
      } else if (['1', '2', '3'].includes(e.key)) g.selectHand(+e.key - 1);
      else if (e.key.startsWith('Arrow')) { e.preventDefault(); g.cycleCand(e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : -1); }
      else if (e.key === 'Escape') g.clearPreview();
      else if (e.key === 'Backspace' || ((e.metaKey || e.ctrlKey) && e.key === 'z')) { e.preventDefault(); g.puzUndo(); }
      else if (e.key === 'h' || e.key === 'H') g.puzHint();
      else if (e.key === '+' || e.key === '=') g.view?.zoomBy(1.2);
      else if (e.key === '-') g.view?.zoomBy(1 / 1.2);
      else if (e.key === 'f' || e.key === 'F') g.view?.fit(true);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);
  const P = g.puz;
  if (!P || !g.S) return null;
  let label: string;
  if (P.ref.kind === 'course') { const w = where(P.def.id); label = `${w.ch.no}장 · ${w.i + 1}/${w.n}`; } else label = `무한 연습 · ${R.LEVELS[P.ref.level].label}`;
  return (
    <div className="game puz-mode">
      <header className="topbar">
        <button type="button" className="btn small ghost back-btn" onClick={() => g.openPuzzles()}><Icon.back /><span>목록</span></button>
        <div className="brand"><span className="chip">{label}</span></div>
        <div className="turn puz-title">
          <span className="who">{P.def.title}</span>
          {P.ref.kind === 'drill' && <span className="tno">연속 정답 {P.ref.streak}</span>}
        </div>
        <div className="tools">
          {P.def.type !== 'count' && (
            <button type="button" className="icon-btn txt" aria-pressed={g.O.beats} aria-label={g.O.beats ? '타일 박자 숫자 숨기기' : '타일 박자 숫자 보기'} title="타일 박자 숫자" onClick={() => g.setOpt('beats', !g.O.beats)}>1½</button>
          )}
          <button type="button" className="icon-btn" aria-pressed={g.O.sound} aria-label={g.O.sound ? '소리 끄기' : '소리 켜기'} onClick={() => g.setOpt('sound', !g.O.sound)}>{g.O.sound ? <Icon.soundOn /> : <Icon.soundOff />}</button>
          <RulebookButton id="rulebookBtn" />
        </div>
      </header>
      <div className="stage solo"><Board /></div>
      <PuzzleBar />
    </div>
  );
}

// ── 정답 시트 ─────────────────────────────────────────────────────────
export function PuzzleDone() {
  const g = game;
  const P = g.puz!;
  const d = P.def;
  const res = P.result!;
  const ref = React.useRef<HTMLButtonElement>(null);
  React.useEffect(() => { ref.current?.focus(); }, []);
  let kicker: string;
  let nextLabel = '다음 문제';
  if (P.ref.kind === 'course') {
    const w = where(d.id);
    kicker = `${w.ch.no}장 · ${w.i + 1}/${w.n} · ${TYPE_LABEL[d.type]}`;
    if (w.i === w.n - 1) {
      const all = PZ.ALL_PUZZLES;
      nextLabel = all[all.length - 1].id === d.id ? '목록으로' : `${w.ch.no + 1}장으로`;
    }
  } else kicker = `무한 연습 · ${R.LEVELS[P.ref.level].label}`;
  const best = P.ref.kind === 'drill' ? g.puzProgress().best[P.ref.level] || 0 : 0;
  const multi = res.measures.length > 1;
  return (
    <>
      <p className="kicker">{kicker}</p>
      <h2>{P.tries === 0 && P.asked === 0 ? '한 번에 정답!' : '정답이에요!'}</h2>
      <div className="pd-stars" role="img" aria-label={`별 ${P.stars}개`}>
        {[1, 2, 3].map((n) => <span key={n} className={n <= P.stars ? 'on' : ''} style={{ animationDelay: `${n * 120}ms` }}><Icon.star /></span>)}
      </div>
      <div className="pd-eqs">
        {res.measures.map((m, i) => (
          <div key={i} className="pd-eq">
            {multi && <span className="pd-m">{i + 1}마디</span>}
            <Eqn ev={{ order: m.terms, sum: m.sum }} />
          </div>
        ))}
      </div>
      <p className="pd-explain">{d.explain}</p>
      {P.ref.kind === 'drill' && <p className="pd-streak">연속 정답 <b className="num">{P.ref.streak}</b> · 최고 {best}{P.tries > 0 ? ' — 한 번에 맞히면 이어져요' : ''}</p>}
      {P.ref.kind === 'course' && P.stars < 3 && <p className="pd-note">{P.asked > 0 && P.tries === 0 ? '힌트 없이 풀면 별 3개!' : '틀리지 않고 풀면 별 3개! 다시 풀어도 돼요.'}</p>}
      <div className="row">
        <button type="button" className="btn" onClick={() => g.puzPlay()}><Icon.play />들어보기</button>
        <button type="button" className="btn" onClick={() => g.openPuzzles()}>목록</button>
        <button type="button" ref={ref} className="btn primary" onClick={() => g.puzNext()}>{nextLabel}<Icon.next /></button>
      </div>
    </>
  );
}
