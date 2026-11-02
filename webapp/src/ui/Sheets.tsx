import * as React from 'react';
import { game, pointsLine, type Opts } from '../game/controller';
import * as R from '../engine/engine';
import type { KindId } from '../engine/engine';
import { Eqn, Icon, LogItem, TileSvg, fmtBeats, useGame, visibleLog } from './common';
import { PuzzleDone } from './Puzzles';
import { AiPicker } from './AiPicker';
import { SkinPicker } from './SkinPicker';

function Quiz() {
  const g = game;
  const m = g.modal as Extract<typeof g.modal, { type: 'quiz' }>;
  const e = m.ev;
  const terms = e.order.filter((o) => o.note || o.rest);
  const right = m.picked != null && m.picked === e.sum;
  const nextRef = React.useRef<HTMLButtonElement>(null);
  const firstRef = React.useRef<HTMLButtonElement>(null);
  React.useEffect(() => { firstRef.current?.focus(); }, []);
  React.useEffect(() => { if (m.picked != null) nextRef.current?.focus(); }, [m.picked]);
  const ts = e.targets.length > 1 || e.target !== 4;
  return (
    <>
      <p className="kicker">{g.pname(m.closer)} · 마디가 닫혔어요{ts ? ` · 목표 ${e.targets.map((t) => `${t}박`).join('·')}` : ''}</p>
      <h2>이 마디는 모두 몇 박일까요?</h2>
      <div className="q-row">
        {terms.map((o, i) => (
          <React.Fragment key={i}>
            {i > 0 && <span className="q-plus" aria-hidden="true">+</span>}
            <div className={`q-mini${m.hl === i ? ' on' : ''}`}>
              <TileSvg k={o.k.replace('-c', '-s') as KindId} beats={g.O.beats} />
              <span>{R.kindOf(o.k).name}</span>
            </div>
          </React.Fragment>
        ))}
      </div>
      <div className="q-choices">
        {m.choices.map((c, i) => {
          const cls = m.picked == null ? '' : c === e.sum ? 'right' : c === m.picked ? 'wrong' : '';
          return (
            <button key={c} ref={i === 0 ? firstRef : undefined} type="button" className={cls} disabled={m.picked != null} onClick={() => g.answerQuiz(c)}>
              {fmtBeats(c)}<small>박</small>
            </button>
          );
        })}
      </div>
      {m.picked != null && (
        <>
          <div className="q-result">
            <div className={`verdict ${right ? 'ok' : 'bad'}`}>{right ? '정답이에요!' : `아쉬워요. 정답은 ${fmtBeats(e.sum)}박`}</div>
            <Eqn ev={e} />
            <div className="pts">{pointsLine(g, e)}</div>
          </div>
          <div className="row">
            <button type="button" className="btn" onClick={() => g.replayQuiz()}><Icon.play />들어보기</button>
            <button type="button" className="btn primary" ref={nextRef} onClick={() => g.quizContinue()}>계속<Icon.next /></button>
          </div>
        </>
      )}
    </>
  );
}

function End() {
  const g = game;
  const S = g.S!;
  const [note, setNote] = React.useState('');
  const recRef = React.useRef<HTMLDivElement>(null);
  if (!S.final) return null;
  const top = S.final.filter((r) => r.rank === 1);
  const title = top.length > 1 ? `${top.map((r) => g.pname(r.p)).join(', ')} 공동 우승!` : `${g.pname(top[0].p)} 승리!`;
  const rec = g.playtestRecord();
  const copy = () => {
    const fail = () => {
      setNote('복사가 막혀 있어요. 위 기록을 길게 눌러 직접 복사해 주세요.');
      const range = document.createRange();
      range.selectNodeContents(recRef.current!);
      const sel = window.getSelection()!;
      sel.removeAllRanges();
      sel.addRange(range);
    };
    try { navigator.clipboard.writeText(rec).then(() => setNote('기록을 복사했어요. 플레이테스트 기록표에 붙여 넣으세요.'), fail); } catch { fail(); }
  };
  return (
    <>
      <p className="kicker">게임 끝 · {S.turnNo}차례</p>
      <h2>{title}</h2>
      <div className="rank">
        {S.final.map((r) => {
          const st = S.players[r.p].stats;
          return (
            <div key={r.p} className={`rr${r.rank === 1 ? ' win' : ''}`} style={{ ['--pc' as any]: g.uiColor(r.p) }}>
              <div className="rk">{r.rank}</div>
              <div className="nm"><i />{g.pname(r.p)}</div>
              <div className="sc num">{S.players[r.p].score}</div>
              <div className="br">마디 {st.measurePts}점({st.measuresWon}개) · 지휘대 {st.standPts}점 · 끝 정산 {st.endPts}점{g.isHuman(r.p) && st.quizTotal ? ` · 검산 ${st.quizOk}/${st.quizTotal}` : ''}</div>
            </div>
          );
        })}
      </div>
      <div className="record" ref={recRef}>{rec}</div>
      <div className="row">
        <button type="button" className="btn" onClick={copy}><Icon.copy />기록 복사</button>
        <button type="button" className="btn" onClick={() => g.restartSame()}>같은 설정으로 다시</button>
        <button type="button" className="btn primary" onClick={() => g.toSetup()}>처음 화면</button>
      </div>
      {note && <p className="copy-note">{note}</p>}
    </>
  );
}

function Rules() {
  const g = game;
  const S = g.S;
  const lv = S ? S.cfg.level : 1;
  const under = S ? S.cfg.noUnderClose : true;
  const ref = React.useRef<HTMLButtonElement>(null);
  const beats: KindId[] = ['q-s', 'h-s', 'dh-s', 'w-s'];
  const lv2: KindId[] = ['e-s', 'dq-s', 'qr', 'er', 'hr'];
  return (
    <>
      <p className="kicker">규칙 요약 · {R.LEVELS[lv].label}</p>
      <h2>음표를 이어 4박 마디 만들기</h2>
      <div className="rules">
        <h3>한 차례</h3>
        <ol>
          <li><b>타일 1장 놓기</b> — 리듬선은 리듬선끼리, 배경은 배경끼리 맞닿게. 앱이 놓을 수 있는 칸만 점선으로 보여줘요.</li>
          <li><b>지휘자 올리기(선택)</b> — 방금 놓은 타일의 마디에 아무 지휘자도 없을 때, 또는 지휘대에.</li>
          <li><b>마디줄 꽂기(선택)</b> — 방금 놓은 타일이나 바로 옆 타일의 리듬선 이음새에. 대각선은 안 돼요.</li>
          <li><b>정산</b> — 양쪽 끝이 마디줄로 막힌 마디는 바로 계산해요.</li>
        </ol>
        <h3>점수</h3>
        <ul>
          <li>마디 합 = 목표(4/4는 4박) → 음표 1장당 2점{lv === 2 ? ', 쉼표 1장당 1점' : ''}. 지휘자가 가장 많은 사람이 받아요(동수면 모두).</li>
          <li>마디 합 ≠ 목표 → 틀린 마디, 0점. 지휘자는 돌려받아요.</li>
          <li>지휘대 + 둘레 8칸이 다 차면 9점.</li>
          <li>게임 끝: 열린 마디 0점{S?.cfg.softEnd ? '(부드러운 변형: 목표 이하면 음표 1장당 1점)' : ''}, 미완성 지휘대는 채워진 칸 1장당 1점.</li>
        </ul>
        <h3>박자값 (4분음표 = 1박)</h3>
        <div className="beats">{beats.map((k) => <div key={k}><TileSvg k={k} /><span><b>{R.kindOf(k).name}</b><br />{fmtBeats(R.SYMBOLS[R.kindOf(k).sym!].beats)}박</span></div>)}</div>
        {lv === 2 && (
          <>
            <h3>Lv2 심화</h3>
            <div className="beats b5">{lv2.map((k) => <div key={k}><TileSvg k={k} /><span><b>{R.kindOf(k).name}</b><br />{fmtBeats(R.SYMBOLS[R.kindOf(k).sym!].beats)}박</span></div>)}</div>
            <ul>
              <li>쉼표도 박자합에 그대로 더해요. 쉬어도 박자는 채워야 해요. 점수는 1장당 1점.</li>
              <li>박자표 타일(3/4, 2/4)은 가운데가 마디줄이에요. <b>숫자가 적힌 쪽</b> 마디부터 그 박자가 되고, 다음 박자표가 나올 때까지 마디줄을 건너 계속 이어져요.</li>
              <li>숫자가 없는 쪽이나 박자표가 없는 줄은 시작 타일의 4/4를 따라요. 두 박자표가 같은 거리에서 한 마디를 마주 보면 둘 중 하나만 맞아도 완성.</li>
              <li>박자표 타일에는 지휘자를 올릴 수 없어요.</li>
            </ul>
          </>
        )}
        <h3>이 앱에서 정한 규칙 해석</h3>
        <div className="interp"><ul>
          {lv === 0 && <li>Lv0: 마디줄은 그 마디가 딱 목표 박일 때만, 틀린 마디로 닫히는 타일도 놓을 수 없어요.</li>}
          <li>마디줄은 빈 칸을 향한 열린 끝에도 꽂을 수 있어요. 배경 변에는 못 꽂아요.</li>
          <li>같은 이음새에 마디줄 두 개, 이미 정산된 마디 안, 음표가 하나도 없는 빈 마디는 안 돼요.</li>
          <li>덜 찬 마디 닫기 금지: {under ? <><b>켜짐</b> — 목표 박이 안 된 마디는 닫을 수 없고, 넘친 마디로 막기만 가능해요.</> : '꺼짐 — 설계서 원안대로 덜 찬 마디도 닫을 수 있어요.'}</li>
          <li>지휘자 자격은 마디줄을 꽂기 전 기준으로 봐요(지휘자 → 마디줄 순서).</li>
          <li>지휘대(통과)는 0박이고 마디 점수의 음표 장수에서 빠져요.</li>
          <li>동점이면 완성한 마디가 많은 사람, 그래도 같으면 공동 우승.</li>
        </ul></div>
        <h3>조작</h3>
        <ul>
          <li>보드는 끌어서 옮기고, 휠·두 손가락·+/− 버튼으로 확대해요.</li>
          <li>키보드: 1~3 손패 · 방향키 놓을 칸 · R 돌리기 · Enter 놓기/차례 끝 · M 지휘자 · B 마디줄 · F 전체 보기</li>
        </ul>
      </div>
      <div className="row"><button type="button" ref={ref} className="btn primary" onClick={() => g.close()}>닫기</button></div>
    </>
  );
}

function OptToggle({ k, title, sub }: { k: Exclude<keyof Opts, 'ai'>; title: string; sub: string }) {
  const g = game;
  const on = !!g.O[k];
  return (
    <label className="tog">
      <input type="checkbox" checked={on} onChange={(e) => g.setOpt(k, e.target.checked as never)} />
      <span className="sw" /><span><b>{title}</b><small>{sub}</small></span>
    </label>
  );
}

function Menu() {
  const g = game;
  const m = g.modal as Extract<typeof g.modal, { type: 'menu' }>;
  return (
    <>
      <p className="kicker">메뉴</p>
      <h2>게임 옵션</h2>
      {g.S && g.S.cfg.players.some((p) => p.type === 'ai') && !g.tut && (
        <div className="menu-ai"><AiPicker value={g.O.ai} onChange={(v) => g.setOpt('ai', v)} /></div>
      )}
      <div className="menu-opts">
        <OptToggle k="sound" title="소리" sub="완성한 마디의 리듬을 들려줘요" />
        <OptToggle k="quiz" title="검산 퀴즈" sub="내가 닫은 마디는 몇 박인지 먼저 맞혀요" />
        <OptToggle k="beats" title="타일에 박자 숫자" sub="끄면 음표 모양만 보고 읽어요" />
        <OptToggle k="hint" title="마디 합 힌트" sub="놓기 전에 이 마디가 몇 박이 되는지 보여줘요" />
        <OptToggle k="fast" title="컴퓨터 빠르게" sub="컴퓨터 차례를 빨리 넘겨요" />
        <OptToggle k="cover" title="사람끼리 손패 가리기" sub="다음 차례부터 적용돼요" />
      </div>
      <SkinPicker />
      <div className="menu-list">
        <button type="button" className="btn" onClick={() => g.open({ type: 'rules' })}><Icon.help />규칙 보기</button>
        {!g.tut && (
          <button type="button" className="btn" onClick={() => (m.confirm ? g.restartSame() : g.open({ type: 'menu', confirm: true }))}>
            {m.confirm ? '정말 새로 시작할까요? 한 번 더 누르세요' : '같은 설정으로 새 게임'}
          </button>
        )}
        <button type="button" className="btn" onClick={() => g.toSetup()}>{g.tut ? '튜토리얼 그만하고 처음 화면' : '처음 화면 (지금 게임은 이어하기로 저장)'}</button>
      </div>
      <div className="row"><button type="button" className="btn primary" onClick={() => g.close()}>닫기</button></div>
    </>
  );
}

function LogSheet() {
  const g = game;
  return (
    <>
      <p className="kicker">기록</p>
      <h2>지금까지</h2>
      <ol className="log sheet-log">{visibleLog().map((e, i) => <LogItem key={i} e={e} />)}</ol>
      <div className="row"><button type="button" className="btn primary" onClick={() => g.close()}>닫기</button></div>
    </>
  );
}

function TutorialDone() {
  const g = game;
  const ref = React.useRef<HTMLButtonElement>(null);
  React.useEffect(() => { ref.current?.focus(); }, []);
  return (
    <>
      <p className="kicker">튜토리얼 완료</p>
      <h2>첫 마디를 완성했어요!</h2>
      <p>1 + 2 + 1 = 4박. 음표 3장 × 2점 = 6점을 받았어요. 진짜 게임에서 알아 두면 좋은 것:</p>
      <ul className="tips">
        <li><b>틀린 마디는 0점</b> — 4박을 넘치거나 모자라게 닫으면 점수가 없어요. 상대 마디를 넘치게 만들어 막을 수도 있어요.</li>
        <li><b>손패는 3장</b> — 모자란 박을 채울 타일을 고르는 게 핵심이에요.</li>
        <li><b>지휘대</b> — 보라색 지휘대를 둘레 8칸으로 둘러싸면 9점.</li>
        <li><b>곡선 타일</b> — 리듬선을 꺾어 마디를 이리저리 이어 갈 수 있어요.</li>
      </ul>
      <div className="row">
        <button type="button" className="btn" onClick={() => g.toSetup()}>처음 화면</button>
        <button type="button" className="btn" onClick={() => g.openPuzzles()}><Icon.puzzle />학습 퍼즐</button>
        <button type="button" ref={ref} className="btn primary" onClick={() => g.startGame({ players: [{ name: '나', type: 'human', color: 0 }, { name: '컴퓨터', type: 'ai', color: 1 }], level: 1, set: 'mvp', noUnderClose: true }, { ...g.O, ai: 'easy', cover: true })}>컴퓨터(쉬움)와 한 판<Icon.next /></button>
      </div>
    </>
  );
}

export function Overlay() {
  const g = useGame();
  const m = g.modal;
  const sheetRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (!m) return;
    sheetRef.current?.scrollTo(0, 0);
    if (m.type === 'rules' || m.type === 'log' || m.type === 'end' || m.type === 'menu') sheetRef.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && m.type !== 'quiz' && m.type !== 'tutorialDone' && m.type !== 'puzzleDone') g.close(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [m?.type]);
  if (!m) return null;
  const wide = m.type === 'end' || m.type === 'rules';
  const label = { quiz: '검산 퀴즈', end: '게임 결과', rules: '규칙', menu: '메뉴', log: '기록', tutorialDone: '튜토리얼 완료', puzzleDone: '퍼즐 정답' }[m.type];
  const dismissible = m.type !== 'quiz' && m.type !== 'tutorialDone' && m.type !== 'puzzleDone';
  return (
    <div className="overlay" onClick={(e) => { if (e.target === e.currentTarget && dismissible) g.close(); }}>
      <div className={`sheet${wide ? ' wide' : ''}`} role="dialog" aria-modal="true" aria-label={label} tabIndex={-1} ref={sheetRef}>
        {m.type === 'quiz' && <Quiz key={m.ev.id} />}
        {m.type === 'end' && <End />}
        {m.type === 'rules' && <Rules />}
        {m.type === 'menu' && <Menu />}
        {m.type === 'log' && <LogSheet />}
        {m.type === 'tutorialDone' && <TutorialDone />}
        {m.type === 'puzzleDone' && g.puz && <PuzzleDone key={g.puz.def.id} />}
      </div>
    </div>
  );
}

export function Toasts() {
  const g = useGame();
  return (
    <div className="toasts" aria-live="polite">
      {g.toasts.map((t) => (
        <div key={t.id} className="toast">
          <div className={`t-head ${t.tone === 'plain' ? '' : t.tone}`}>{t.head}</div>
          {t.ev && <Eqn ev={t.ev} />}
          <div className="t-sub">{t.sub}</div>
        </div>
      ))}
    </div>
  );
}
