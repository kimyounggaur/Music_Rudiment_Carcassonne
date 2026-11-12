import * as React from 'react';
import { game, COLORS, DEFAULT_OPTS, type Opts } from '../game/controller';
import * as R from '../engine/engine';
import type { LevelId, SetId, PlayerCfg } from '../engine/engine';
import * as ART from '../art/tiles';
import * as SKIN from '../art/skin';
import * as SND from '../game/audio';
import { Icon, MeepleIcon, RulebookButton, Svg, TileSvg, useGame } from './common';
import { AiPicker } from './AiPicker';
import { SkinPicker } from './SkinPicker';
import * as VG from '../art/village';
import * as PZ from '../game/puzzle';

const isDefaultName = (n: string) => /^(플레이어 \d|컴퓨터\s?\d?)$/.test(n.trim()) || !n.trim();
function renameDefaults(ps: PlayerCfg[]): PlayerCfg[] {
  const nAi = ps.filter((p) => p.type === 'ai').length;
  let aiSeen = 0;
  return ps.map((p, i) => {
    if (p.type === 'ai') aiSeen++;
    if (!isDefaultName(p.name)) return p;
    return { ...p, name: p.type === 'human' ? `플레이어 ${i + 1}` : nAi > 1 ? `컴퓨터 ${aiSeen}` : '컴퓨터' };
  });
}

function demoSvg(): string {
  const seq: [R.KindId, number][] = [['start', 0], ['q-s', 0], ['h-s', 0], ['q-s', 0]];
  let s = '';
  seq.forEach(([k, r], i) => { s += `<g transform="translate(${i * 104} 0)"><g class="d-tile" style="animation-delay:${i * 90}ms">${SKIN.tile(k, r)}</g></g>`; });
  const [ax, ay] = ART.meepleAnchor('q-s', 0, 0);
  s += `<g class="d-late" style="animation-delay:400ms">${SKIN.meepleFigure(104 + ax, ay, COLORS[0].hex)}</g>`;
  s += SKIN.getSkin() === 'village'
    ? `<g class="d-late" style="animation-delay:500ms">${VG.fence(414, 50, true, 50)}</g>`
    : '<g class="d-late" style="animation-delay:500ms"><path d="M414 27V73" stroke="#fff" stroke-width="11" stroke-linecap="round"/>'
      + `<path d="M414 27V73" stroke="${ART.INK}" stroke-width="7" stroke-linecap="round"/></g>`;
  s += '<g class="d-late" style="animation-delay:600ms"><path d="M108 114v8h302v-8" fill="none" stroke="var(--muted)" stroke-width="2" stroke-linejoin="round"/>'
    + '<text class="eq" x="259" y="152" text-anchor="middle">1 + 2 + 1 = 4박</text>'
    + '<text class="eq-sub" x="259" y="176" text-anchor="middle">한 마디 완성 · 음표 3장 × 2점 = 6점</text></g>';
  return s;
}

function Toggle({ id, checked, onChange, title, sub, rec }: { id: string; checked: boolean; onChange: (v: boolean) => void; title: string; sub: string; rec?: boolean }) {
  return (
    <label className="tog" htmlFor={id}>
      <input type="checkbox" id={id} checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="sw" />
      <span><b>{title}{rec && <span className="rec">추천</span>}</b><small>{sub}</small></span>
    </label>
  );
}

const LEVEL_HELP: Record<LevelId, string> = {
  0: '1·2·4박만, 4박일 때만 마디줄',
  1: '1·2·3·4박, 지휘대, 틀린 마디 0점',
  2: '+ 8분·점4분·쉼표·3/4·2/4 박자표',
};

export function Setup() {
  const g = useGame();
  const prefs = React.useMemo(() => g.loadPrefs(), []);
  const [players, setPlayers] = React.useState<PlayerCfg[]>(() => (prefs?.players?.length && prefs.players.length >= 2
    ? prefs.players.slice(0, 4).map((p, i) => ({ name: String(p.name || ''), type: p.type === 'ai' ? 'ai' : 'human', color: COLORS[p.color ?? -1] ? p.color : i }))
    : [{ name: '플레이어 1', type: 'human', color: 0 }, { name: '컴퓨터', type: 'ai', color: 1 }]));
  const [level, setLevel] = React.useState<LevelId>(prefs?.level ?? 1);
  const [set, setSet] = React.useState<SetId>(prefs?.set ?? 'mvp');
  const [opts, setOpts] = React.useState<Opts>(() => {
    const o = { ...DEFAULT_OPTS, ...(prefs?.opts || {}) };
    if (!['easy', 'normal', 'hard'].includes(o.ai)) o.ai = 'normal';
    return o;
  });
  const [under, setUnder] = React.useState<boolean>(prefs?.noUnderClose ?? true);
  const [soft, setSoft] = React.useState<boolean>(prefs?.softEnd ?? false);
  const [seed, setSeed] = React.useState('');
  const save = React.useMemo(() => g.loadSave(), [g.screen]);
  const swatchRefs = React.useRef<(HTMLButtonElement | null)[]>([]);

  const setOpt = <K extends keyof Opts>(k: K, v: Opts[K]) => setOpts((o) => ({ ...o, [k]: v }));
  const cycleColor = (i: number) => {
    const used = new Set(players.map((p) => p.color));
    let c = players[i].color ?? i;
    for (let k = 1; k <= COLORS.length; k++) {
      const n = (c + k) % COLORS.length;
      if (!used.has(n)) { c = n; break; }
    }
    setPlayers(players.map((p, j) => (j === i ? { ...p, color: c } : p)));
  };

  const start = (e: React.FormEvent) => {
    e.preventDefault();
    const finalPlayers = players.map((p, i) => ({ ...p, name: p.name.trim() || (p.type === 'human' ? `플레이어 ${i + 1}` : '컴퓨터') }));
    const sd = /^\d{1,12}$/.test(seed.trim()) ? Number(seed.trim()) % 2147483647 : Math.floor(Math.random() * 1e9);
    g.savePrefs({ players, level, set, opts, noUnderClose: under, softEnd: soft });
    SND.unlock();
    g.startGame({ players: finalPlayers, level, set, seed: sd, softEnd: soft, noUnderClose: under }, opts);
  };

  const prog = g.puzProgress();
  const starsGot = Object.values(prog.stars).reduce((a, b) => a + b, 0);
  const anyAi = players.some((p) => p.type === 'ai');

  const iOS = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);

  return (
    <main className="setup">
      <header className="setup-top">
        <RulebookButton id="rulebookBtn" labeled />
      </header>
      <section className="hero" aria-labelledby="heroTitle">
        <p className="eyebrow">카르카손 응용 음악 보드게임 · 웹앱 2단계</p>
        <h1 className="logo" id="heroTitle">리듬마을</h1>
        <p className="lede">음표 타일을 이어 붙여 리듬선을 만들고, 마디줄로 끊어 박자의 합이 딱 4박인 마디를 완성하면 점수를 얻어요.</p>
        <div className="demo">
          <Svg key={g.skin} viewBox="-4 -4 424 190" html={demoSvg()} label="시작 타일 뒤에 4분음표, 2분음표, 4분음표를 잇고 마디줄로 닫아 1+2+1=4박, 6점을 얻는 예" />
        </div>
        <ol className="loop" aria-label="한 차례 순서">
          <li><b>1</b>타일 놓기</li>
          <li><b>2</b>지휘자 올리기</li>
          <li><b>3</b>마디줄 꽂기</li>
          <li><b>4</b>4박이면 점수</li>
        </ol>
        <div className="callouts">
          <button type="button" className="tut-callout" onClick={() => g.startTutorial()}>
            <span className="tut-ic"><Icon.cap /></span>
            <span><b>처음이라면 2분 튜토리얼</b><small>컴퓨터와 함께 1 + 2 + 1 = 4박 마디를 직접 완성해 봐요</small></span>
            <span className="tut-go"><Icon.next /></span>
          </button>
          <button type="button" className="tut-callout puz-callout" id="puzzlesBtn" onClick={() => g.openPuzzles()}>
            <span className="tut-ic"><Icon.puzzle /></span>
            <span><b>학습 퍼즐 {PZ.ALL_PUZZLES.length}문제 + 무한 연습</b><small>박 세기 · 빈 박 채우기 · 마디줄 긋기를 한 수씩{starsGot ? ` · 모은 별 ${starsGot}개` : ''}</small></span>
            <span className="tut-go"><Icon.next /></span>
          </button>
        </div>
      </section>

      <form className="setup-card" onSubmit={start} noValidate>
        <div className="sc-head">
          <h2>새 게임</h2>
          <p>한 기기로 사람끼리, 또는 컴퓨터와 연습할 수 있어요.</p>
        </div>
        <fieldset className="field">
          <legend>플레이어 (2~4명)</legend>
          <div className="prow-list">
            {players.map((p, i) => (
              <div className="prow" key={i}>
                <button type="button" className="swatch" ref={(el) => { swatchRefs.current[i] = el; }} onClick={() => cycleColor(i)} aria-label={`${i + 1}번 플레이어 색 ${COLORS[p.color ?? i].name}, 눌러서 바꾸기`}>
                  <MeepleIcon hex={COLORS[p.color ?? i].hex} />
                </button>
                <input type="text" id={`pname${i}`} value={p.name} maxLength={10} autoComplete="off" aria-label={`${i + 1}번 플레이어 이름`}
                  onChange={(e) => setPlayers(players.map((q, j) => (j === i ? { ...q, name: e.target.value } : q)))} />
                <div className="pill-seg" role="group" aria-label={`${i + 1}번 플레이어 종류`}>
                  {(['human', 'ai'] as const).map((ty) => (
                    <button key={ty} type="button" aria-pressed={p.type === ty}
                      onClick={() => setPlayers(renameDefaults(players.map((q, j) => (j === i ? { ...q, type: ty } : q))))}>
                      {ty === 'human' ? '사람' : '컴퓨터'}
                    </button>
                  ))}
                </div>
                {players.length > 2
                  ? <button type="button" className="rm" aria-label={`${i + 1}번 플레이어 빼기`} onClick={() => setPlayers(renameDefaults(players.filter((_, j) => j !== i)))}><Icon.x /></button>
                  : <span />}
              </div>
            ))}
          </div>
          {anyAi && <AiPicker value={opts.ai} onChange={(v) => setOpt('ai', v)} id="setupAi" />}
          {players.length < 4 && (
            <div>
              <button type="button" className="btn small ghost" onClick={() => {
                const used = new Set(players.map((p) => p.color));
                const color = [0, 1, 2, 3].find((c) => !used.has(c));
                setPlayers(renameDefaults([...players, { name: `플레이어 ${players.length + 1}`, type: 'human', color }]));
              }}>플레이어 추가</button>
            </div>
          )}
        </fieldset>

        <fieldset className="field">
          <legend>난이도</legend>
          <div className="seg seg3">
            {([1, 0, 2] as LevelId[]).map((lv) => (
              <label key={lv}>
                <input type="radio" name="level" id={`lv${lv}`} checked={level === lv} onChange={() => setLevel(lv)} />
                <span><b>{R.LEVELS[lv].label}</b><small>{LEVEL_HELP[lv]}</small></span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="field">
          <legend>타일 세트</legend>
          <div className="seg">
            <label><input type="radio" name="set" id="setMvp" checked={set === 'mvp'} onChange={() => setSet('mvp')} />
              <span><b>MVP 40장</b><small>마디줄 24개{level === 2 ? ' · 심화 20장 + 마디줄 8개 추가' : ' · 2인 20분 안팎'}</small></span></label>
            <label><input type="radio" name="set" id="setFull" checked={set === 'full'} onChange={() => setSet('full')} />
              <span><b>완전판 72장</b><small>마디줄 40개 · 지휘대(통과) 포함{level === 2 ? ' · 심화 20장 추가' : ''}</small></span></label>
          </div>
          {level === 2 && (
            <div className="lv2-strip" aria-label="Lv2에서 더해지는 타일">
              {(['e-s', 'dq-s', 'qr', 'er', 'hr', 'ts34', 'ts24'] as R.KindId[]).map((k) => <TileSvg key={k} k={k} />)}
            </div>
          )}
        </fieldset>

        <details className="opts">
          <summary>학습 · 규칙 옵션</summary>
          <div className="opt-grid">
            <Toggle id="optQuiz" checked={opts.quiz} onChange={(v) => setOpt('quiz', v)} title="검산 퀴즈" sub="마디가 닫히면 몇 박인지 먼저 맞혀요" />
            <Toggle id="optBeats" checked={opts.beats} onChange={(v) => setOpt('beats', v)} title="타일에 박자 숫자" sub="끄면 음표 모양만 보고 읽어요" />
            <Toggle id="optHint" checked={opts.hint} onChange={(v) => setOpt('hint', v)} title="마디 합 힌트" sub="놓기 전에 이 마디가 몇 박이 되는지 보여줘요" />
            <Toggle id="optUnder" checked={under} onChange={setUnder} rec title="덜 찬 마디 닫기 금지" sub="목표 박이 안 된 마디는 마디줄로 닫을 수 없어요. 넘친 마디로 막기는 그대로 가능" />
            <Toggle id="optSoft" checked={soft} onChange={setSoft} title="열린 마디 부분 점수" sub="게임 끝에 목표 이하로 열린 마디는 음표 1장당 1점" />
            <Toggle id="optCover" checked={opts.cover} onChange={(v) => setOpt('cover', v)} title="사람끼리 손패 가리기" sub="차례가 바뀌면 손패를 덮어 둬요" />
            <Toggle id="optSound" checked={opts.sound} onChange={(v) => setOpt('sound', v)} title="소리" sub="완성한 마디의 리듬을 들려줘요" />
            <Toggle id="optFast" checked={opts.fast} onChange={(v) => setOpt('fast', v)} title="컴퓨터 빠르게" sub="컴퓨터 차례를 빨리 넘겨요" />
          </div>
          <SkinPicker />
          <div className="seed-row">
            <label htmlFor="optSeed">시드</label>
            <input type="text" id="optSeed" inputMode="numeric" placeholder="비우면 무작위" value={seed} onChange={(e) => setSeed(e.target.value)} />
            <span>같은 시드 = 같은 타일 순서</span>
          </div>
        </details>

        <div className="sc-actions">
          <button className="btn primary big" type="submit" id="startBtn">게임 시작</button>
          {save && <button className="btn big" type="button" id="resumeBtn" onClick={() => { SND.unlock(); g.resumeGame(save.S, save.O); }}>이어하기</button>}
        </div>
        {save && <p className="resume-note">저장된 게임: {save.S.turnNo}번째 차례 · {save.S.cfg.players.map((p, i) => `${p.name} ${save.S.players[i].score}점`).join(', ')}</p>}
        {g.target === 'web' && (g.installPrompt || iOS) && (
          <div className="install">
            {g.installPrompt
              ? <button type="button" className="btn" onClick={async () => { const p = g.installPrompt; g.installPrompt = null; g.emit(); try { await p.prompt(); } catch { /* 취소 */ } }}><Icon.download />앱으로 설치</button>
              : <p className="install-note">아이패드·아이폰: Safari 공유 버튼 → ‘홈 화면에 추가’로 설치하면 인터넷 없이도 열려요.</p>}
          </div>
        )}
      </form>
    </main>
  );
}
