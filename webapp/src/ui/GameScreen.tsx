import * as React from 'react';
import { game, kindName } from '../game/controller';
import * as R from '../engine/engine';
import { Board } from './Board';
import { AI_LABEL } from '../engine/ai';
import { Icon, LogItem, MeepleIcon, TileSvg, fmtBeats, useGame, visibleLog } from './common';

function shownScores() {
  const g = game;
  const S = g.S!;
  const shown = S.players.map((ps) => ({ score: ps.score, won: ps.stats.measuresWon }));
  for (const e of g.hiddenEv) {
    if (!g.hidden.has(e.id)) continue;
    e.winners.forEach((w) => { shown[w].score -= e.points; if (e.ok) shown[w].won--; });
  }
  return shown;
}

function TopBar() {
  const g = game;
  const S = g.S!;
  const p = g.cur();
  return (
    <header className="topbar">
      <div className="brand">
        <span className="logo-sm">리듬마을</span>
        <span className="chip">{g.tut ? '튜토리얼' : `${R.LEVELS[S.cfg.level].label} · ${R.SETS[S.cfg.set].label}`}</span>
      </div>
      <div className="turn">
        {S.over ? <span className="who">게임 끝</span> : (
          <>
            <span className="dot" style={{ background: g.uiColor(p) }} />
            <span className="who">{g.pname(p)}<span className="cha"> 차례</span></span>
            <span className="tno">{S.turnNo}번째</span>
          </>
        )}
      </div>
      <div className="counters">
        <span className="ctr" title="주머니에 남은 타일"><Icon.tiles /><span className="lbl">타일</span><b className="num">{S.bag.length}</b></span>
        <span className="ctr" title="남은 마디줄 막대"><Icon.bar /><span className="lbl">마디줄</span><b className="num">{S.barsLeft}</b></span>
      </div>
      <div className="tools">
        <button className="icon-btn" id="logBtn" type="button" aria-label="기록 보기" onClick={() => g.open({ type: 'log' })}><Icon.list /></button>
        <button className="icon-btn" id="soundBtn" type="button" aria-pressed={g.O.sound} aria-label={g.O.sound ? '소리 끄기' : '소리 켜기'} onClick={() => g.setOpt('sound', !g.O.sound)}>{g.O.sound ? <Icon.soundOn /> : <Icon.soundOff />}</button>
        <button className="icon-btn" id="rulesBtn" type="button" aria-label="규칙 보기" onClick={() => g.open({ type: 'rules' })}><Icon.help /></button>
        <button className="icon-btn" id="menuBtn" type="button" aria-label="메뉴" onClick={() => g.open({ type: 'menu' })}><Icon.menu /></button>
      </div>
    </header>
  );
}

function Strip() {
  const g = game;
  const S = g.S!;
  const shown = shownScores();
  return (
    <div className="strip">
      {S.cfg.players.map((pl, i) => (
        <div key={i} className={`schip${!S.over && S.turn.p === i ? ' cur' : ''}`} style={{ ['--pc' as any]: g.uiColor(i) }}>
          <span className="sdot" /><span>{pl.name}</span><span className="sm">지휘자 {S.players[i].meeples}</span><b className="num">{shown[i].score}</b>
        </div>
      ))}
    </div>
  );
}

function Players() {
  const g = game;
  const S = g.S!;
  const shown = shownScores();
  return (
    <div className="players">
      {S.cfg.players.map((pl, i) => {
        const ps = S.players[i];
        const st = ps.stats;
        const cur = !S.over && S.turn.p === i;
        return (
          <div key={i} className={`pcard${cur ? ' cur' : ''}`} style={{ ['--pc' as any]: g.uiColor(i) }}>
            <div className="pname"><span className="pdot" /><span>{pl.name}</span><span className="ptype">{pl.type === 'ai' ? `컴퓨터 · ${AI_LABEL[g.O.ai] ?? '보통'}` : '사람'}</span></div>
            <div className="pscore num">{shown[i].score}<small>점</small></div>
            <div className="pm" role="img" aria-label={`남은 지휘자 ${ps.meeples}개`}>
              {Array.from({ length: S.cfg.meeples }, (_, j) => <MeepleIcon key={j} hex={g.colorHex(i)} dim={j >= ps.meeples} />)}
            </div>
            <div className="pstats">완성 마디 {shown[i].won}{pl.type === 'human' && st.quizTotal ? ` · 검산 ${st.quizOk}/${st.quizTotal}` : ''}</div>
          </div>
        );
      })}
    </div>
  );
}

function HandBar() {
  const g = game;
  const S = g.S!;
  const ph = g.phase();
  const p = g.cur();
  const hand = S.over ? [] : S.hands[p];
  const st = g.tutStep();
  const pulse = (id: string) => (st?.target === id ? ' coach-pulse' : '');
  let acts: React.ReactNode = null;
  if (ph === 'place') {
    acts = (
      <>
        <button type="button" className="btn" id="aRot" disabled={!g.pv || g.pv.rots.length < 2} onClick={() => g.rotate(1)}><Icon.rotate />돌리기</button>
        <button type="button" className={`btn primary${pulse('aPlace')}`} id="aPlace" disabled={!g.pv || (!!st && st.expect.kind !== 'place')} onClick={() => g.confirmPlace()}><Icon.check />여기에 놓기</button>
      </>
    );
  } else if (ph === 'act') {
    acts = (
      <>
        {!g.tut && <button type="button" className="btn" id="aUndo" onClick={() => g.undoTurn()}><Icon.undo />다시 하기</button>}
        <button type="button" className={`btn primary${pulse('aEnd')}`} id="aEnd" disabled={g.busy || (!!st && st.expect.kind !== 'end')} onClick={() => g.endTurnByUser()}>차례 끝내기<Icon.next /></button>
      </>
    );
  } else if (ph === 'cover') {
    acts = <><span className="note cover-note">다른 사람은 잠깐 눈을 감아 주세요</span><button type="button" className="btn primary" id="aReveal" onClick={() => g.reveal()}><Icon.eye />손패 보기</button></>;
  } else if (ph === 'nomove') {
    acts = <span className="note">빨간 점선 타일 중 하나를 누르면 빼 두고 새로 뽑아요</span>;
  } else if (ph === 'ai') {
    acts = <span className="note">컴퓨터 차례 · 놓는 자리를 보여 드려요</span>;
  } else if (ph === 'over') {
    acts = <><button type="button" className="btn" id="aResult" onClick={() => g.open({ type: 'end' })}>결과 보기</button><button type="button" className="btn primary" id="aNew" onClick={() => g.toSetup()}>새 게임</button></>;
  }
  return (
    <footer className="handbar">
      <div className="hand-owner">
        {S.over ? <b>게임 끝</b> : <><b style={{ ['--pc' as any]: g.uiColor(p) }}><i />{g.pname(p)}</b><span>손패 {hand.length}장</span></>}
      </div>
      <div className="hand">
        {(ph === 'ai' || ph === 'cover')
          ? hand.map((_, i) => <div key={i} className="hback" aria-hidden="true">리듬</div>)
          : ph !== 'over' && hand.map((k, i) => {
            const sel = ph === 'place' && i === g.sel;
            const r = sel && g.pv ? g.pv.r : 0;
            const K = R.kindOf(k);
            const beats = K.sym ? ` ${fmtBeats(R.SYMBOLS[K.sym].beats)}박` : '';
            const cls = ['htile', sel ? 'sel' : '', ph === 'act' ? 'dim' : '', ph === 'nomove' ? 'discard' : '', g.tut && !sel ? 'locked' : ''].join(' ');
            return (
              <button key={`${i}-${k}`} type="button" className={cls} disabled={ph === 'act'}
                aria-label={ph === 'nomove' ? `${kindName(k)} 버리기` : `${kindName(k)}${beats}${sel ? ' (선택됨)' : ''}`}
                onClick={() => (ph === 'nomove' ? g.discard(i) : g.selectHand(i))}>
                <TileSvg k={k} r={r} beats={g.O.beats} />
                <span className="hname">{K.name}</span>
              </button>
            );
          })}
      </div>
      <div className="acts">{acts}</div>
    </footer>
  );
}

export function GameScreen() {
  const g = useGame();
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (g.modal || g.screen !== 'game' || !g.S) return;
      const t = e.target as HTMLElement;
      if (t && t.matches && t.matches('input, textarea, select')) return;
      const ph = g.phase();
      if (e.key === 'r' || e.key === 'R') { if (ph === 'place') g.rotate(e.shiftKey ? -1 : 1); }
      else if (e.key === 'Enter') {
        if (t && t.closest && t.closest('button')) return;
        if (ph === 'place' && g.pv) g.confirmPlace();
        else if (ph === 'act') g.endTurnByUser();
      } else if (['1', '2', '3'].includes(e.key) && ph === 'place') g.selectHand(+e.key - 1);
      else if (e.key.startsWith('Arrow') && ph === 'place') { e.preventDefault(); g.cycleCand(e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : -1); }
      else if ((e.key === 'm' || e.key === 'M') && ph === 'act') g.toggleMeepleKey();
      else if ((e.key === 'b' || e.key === 'B') && ph === 'act') g.cycleBarKey();
      else if (e.key === 'Escape' && ph === 'place') g.clearPreview();
      else if (e.key === '+' || e.key === '=') g.view?.zoomBy(1.2);
      else if (e.key === '-') g.view?.zoomBy(1 / 1.2);
      else if (e.key === 'f' || e.key === 'F') g.view?.fit(true);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);
  if (!g.S) return null;
  return (
    <div className={`game${g.tut ? ' is-tut' : ''}`}>
      <TopBar />
      <Strip />
      <div className="stage">
        <Board />
        <aside className="side" aria-label="점수와 기록">
          <Players />
          <section className="logbox"><h3>기록</h3><ol className="log">{visibleLog().map((e, i) => <LogItem key={`${e.t}-${e.type}-${i}`} e={e} />)}</ol></section>
        </aside>
      </div>
      <HandBar />
    </div>
  );
}
