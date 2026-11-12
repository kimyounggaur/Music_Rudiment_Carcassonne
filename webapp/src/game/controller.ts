/* 게임 진행 관리: 엔진 상태 + 화면 상태 + 비동기 흐름(컴퓨터 차례, 정산 연출, 검산 퀴즈).
 * React는 version이 바뀔 때마다 다시 그린다 (useSyncExternalStore). */
import * as R from '../engine/engine';
import * as AI from '../engine/ai';
import type { State, Config, GameEvent, MeasureEvent, Placement, Spot, KindId, LevelId, SetId, PlayerCfg } from '../engine/engine';
import type { AiLevel } from '../engine/ai';
import { planAsync } from './aiRunner';
import * as SND from './audio';
import { TUT_STEPS, TUT_HANDS, TUT_PLAYERS, TUT_AI_MOVE, type TutStep } from './tutorial';
import * as PZ from './puzzle';
import * as SKIN from '../art/skin';
import { COLORS } from './colors';
import type { Skin } from '../art/skin';

export { COLORS };

export interface Opts { quiz: boolean; beats: boolean; hint: boolean; cover: boolean; sound: boolean; fast: boolean; ai: AiLevel }
export const DEFAULT_OPTS: Opts = { quiz: true, beats: true, hint: false, cover: true, sound: true, fast: false, ai: 'normal' };

export type Phase = 'none' | 'over' | 'ai' | 'cover' | 'nomove' | 'place' | 'act' | 'puzzle';
export interface Preview { x: number; y: number; r: number; rots: number[] }
export type Modal =
  | { type: 'quiz'; ev: MeasureEvent; closer: number; choices: number[]; picked: number | null; hl: number; resolve: () => void; onAnswer: () => void }
  | { type: 'end' } | { type: 'rulebook'; ch?: string } | { type: 'menu'; confirm?: boolean } | { type: 'log' } | { type: 'tutorialDone' } | { type: 'puzzleDone' };
export interface Toast { id: number; head: string; tone: 'ok' | 'bad' | 'plain'; ev?: MeasureEvent; sub: string }
export interface Fx { id: number; x: number; y: number; text: string; color: string }
export interface ViewApi { fit(animate: boolean): void; ensureVisible(x: number, y: number): void; cellVisible(x: number, y: number): boolean; zoomBy(k: number): void }
export interface SetupPrefs { players: PlayerCfg[]; level: LevelId; set: SetId; opts: Opts; noUnderClose: boolean; softEnd: boolean }

// ── 학습 퍼즐 ──
export type PuzzleRef = { kind: 'course'; id: string } | { kind: 'drill'; level: LevelId; seed: number; streak: number };
export interface PuzzleRun {
  def: PZ.PuzzleDef;
  ref: PuzzleRef;
  placed: number;
  myBars: string[];
  stack: { S: string; placed: number; myBars: string[] }[];
  /** 틀리게 닫은 횟수(별이 줄어든다) */
  tries: number;
  /** 보이는 힌트 수 */
  hints: number;
  /** 직접 눌러서 본 힌트 수 (틀려서 저절로 보인 힌트는 별을 깎지 않는다) */
  asked: number;
  msg: { tone: 'bad' | 'info'; text: string } | null;
  marks: { cells: [number, number][]; ok: boolean }[] | null;
  wrong: number[];
  solved: boolean;
  stars: number;
  result: PZ.CheckResult | null;
}
export interface PuzzleProgress { v: 1; stars: Record<string, number>; best: Record<string, number> }
const PUZ_KEY = 'rhythm-village-puzzles-v1';
const UI_KEY = 'rhythm-village-ui-v1';

const SAVE_KEY = 'rhythm-village-save-v1';
const SETUP_KEY = 'rhythm-village-setup-v1';
export const store = {
  get<T>(k: string): T | null { try { const v = localStorage.getItem(k); return v ? (JSON.parse(v) as T) : null; } catch { return null; } },
  set(k: string, v: unknown) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* 저장 불가 환경 */ } },
  del(k: string) { try { localStorage.removeItem(k); } catch { /* 무시 */ } },
};
const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export function makeChoices(sum: number, target: number): number[] {
  const step = Number.isInteger(sum) && Number.isInteger(target) ? 1 : 0.5;
  const out = [sum];
  if (sum !== target) out.push(target);
  for (const k of [1, -1, 2, -2, 3]) {
    if (out.length >= 4) break;
    const v = sum + k * step;
    if (v > 0 && !out.includes(v)) out.push(v);
  }
  return out.sort((a, b) => a - b);
}

export class Game {
  S: State | null = null;
  O: Opts = { ...DEFAULT_OPTS };
  screen: 'setup' | 'game' | 'puzzles' | 'puzzle' = 'setup';
  puz: PuzzleRun | null = null;
  private progress: PuzzleProgress | null = null;
  /** 화면 그림 테마 (기기에 저장) */
  skin: Skin = 'village';
  gid = 0;
  sel = 0;
  pv: Preview | null = null;
  cands: Placement[] = [];
  candMap = new Map<string, Placement>();
  revealed = true;
  busy = false;
  noMove = false;
  snapshot: string | null = null;
  turnStart = 0;
  flash: { cells: [number, number][]; ok: boolean | null } | null = null;
  fx: Fx[] = [];
  private fxId = 0;
  hidden = new Set<number>();
  hiddenEv: MeasureEvent[] = [];
  modal: Modal | null = null;
  toasts: Toast[] = [];
  private toastId = 0;
  tut: { step: number; msg: string | null } | null = null;
  /** 컴퓨터가 수를 계산하는 중 */
  thinking = false;
  private begunKey = '';
  view: ViewApi | null = null;
  animSerial = 0;
  installPrompt: any = null;
  target: 'artifact' | 'web' = 'artifact';
  version = 0;
  private listeners = new Set<() => void>();

  subscribe = (fn: () => void) => { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; };
  getVersion = () => this.version;
  emit() { this.version++; this.listeners.forEach((f) => f()); }

  // ── 조회 ──────────────────────────────────────────────────────────
  cur = () => (this.S ? this.S.turn.p : 0);
  pl = (i: number) => this.S!.cfg.players[i];
  isHuman = (i: number) => this.pl(i).type === 'human';
  humans = () => this.S!.cfg.players.filter((p) => p.type === 'human').length;
  colorHex = (i: number) => COLORS[this.pl(i).color ?? i].hex;
  uiColor = (i: number) => COLORS[this.pl(i).color ?? i].ui;
  pname = (i: number) => this.pl(i).name;
  tutStep = (): TutStep | null => (this.tut ? TUT_STEPS[this.tut.step] : null);

  phase(): Phase {
    const S = this.S;
    if (!S) return 'none';
    if (this.puz) return 'puzzle';
    if (S.over) return 'over';
    if (!this.isHuman(this.cur())) return 'ai';
    if (!this.revealed) return 'cover';
    if (this.noMove) return 'nomove';
    if (!S.turn.placed) return 'place';
    return 'act';
  }

  /** 튜토리얼에서 이 행동이 지금 허용되는가 */
  private tutAllows(kind: string, arg?: { x?: number; y?: number; seam?: string }): boolean {
    const st = this.tutStep();
    if (!st) return true;
    const e = st.expect;
    if (e.kind !== kind) return false;
    if (e.kind === 'cell') return arg?.x === e.x && arg?.y === e.y;
    if (e.kind === 'bar') return arg?.seam === e.seam;
    return true;
  }
  private tutAdvance() {
    if (!this.tut) return;
    this.tut.step = Math.min(this.tut.step + 1, TUT_STEPS.length - 1);
    this.tut.msg = null;
    const st = this.tutStep()!;
    if (st.select && this.S) {
      const i = this.S.hands[this.cur()].indexOf(st.select);
      if (i >= 0 && this.sel !== i && !this.S.turn.placed) { this.sel = i; this.pv = null; this.computeCands(); }
    }
  }
  tutNext() {
    const st = this.tutStep();
    if (!st || st.expect.kind !== 'next') return;
    this.tutAdvance();
    this.emit();
  }
  tutChoose(i: number) {
    const st = this.tutStep();
    if (!st || st.expect.kind !== 'choice') return;
    if (i === st.expect.answer) this.tutAdvance();
    else this.tut!.msg = st.expect.wrong;
    this.emit();
  }

  /** 지금 보여 줄 후보 칸 (튜토리얼이면 정해진 칸만) */
  visibleCands(): Placement[] {
    const st = this.tutStep();
    if (!st) return this.cands;
    if (st.expect.kind !== 'cell') return [];
    const e = st.expect;
    return this.cands.filter((c) => c.x === e.x && c.y === e.y);
  }
  visibleSeams(): string[] {
    if (this.puz) {
      const P = this.puz;
      if (P.solved || !this.S || this.S.barsLeft <= 0) return [];
      if (P.def.type === 'fill' && P.placed < PZ.placeOf(P.def)) return []; // 채우기: 타일을 놓은 다음에 마디줄 (게임 순서와 같게)
      return PZ.puzzleSeams(this.S);
    }
    if (this.phase() !== 'act' || !this.S || this.S.turn.bar) return [];
    const all = R.barSpots(this.S).map((b) => b.seam);
    const st = this.tutStep();
    if (!st) return all;
    return st.expect.kind === 'bar' ? all.filter((s) => s === (st.expect as { seam: string }).seam) : [];
  }
  visibleSpots(): Spot[] {
    if (this.puz) return [];
    if (this.phase() !== 'act' || !this.S || this.S.turn.meeple) return [];
    const st = this.tutStep();
    if (st && st.expect.kind !== 'meeple') return [];
    return R.conductorSpots(this.S);
  }

  // ── 화면 그림 테마 ─────────────────────────────────────────────────
  loadSkin() {
    const d = store.get<{ skin?: Skin }>(UI_KEY);
    this.applySkin(d?.skin === 'card' ? 'card' : 'village');
  }
  setSkin(s: Skin) {
    this.applySkin(s);
    store.set(UI_KEY, { skin: this.skin });
    this.emit();
  }
  private applySkin(s: Skin) {
    this.skin = s === 'card' ? 'card' : 'village';
    SKIN.setSkin(this.skin);
    try { document.documentElement.dataset.skin = this.skin; } catch { /* 문서 없음 (테스트) */ }
  }

  // ── 시작 · 저장 ───────────────────────────────────────────────────
  loadPrefs(): SetupPrefs | null { return store.get<SetupPrefs>(SETUP_KEY); }
  savePrefs(p: SetupPrefs) { store.set(SETUP_KEY, p); }

  startGame(cfg: Partial<Config> & { players: PlayerCfg[] }, opts: Opts, tutorial = false) {
    this.gid++;
    this.S = R.newGame(cfg);
    this.S.meta = { startedAt: Date.now() };
    this.O = { ...DEFAULT_OPTS, ...opts };
    this.animSerial = 0;
    this.modal = null;
    this.toasts = [];
    this.flash = null;
    this.fx = [];
    this.tut = tutorial ? { step: 0, msg: null } : null;
    if (tutorial) {
      this.S.hands = TUT_HANDS.map((h) => h.slice());
    }
    this.screen = 'game';
    this.emit();
    requestAnimationFrame(() => { this.view?.fit(false); this.beginTurn(); });
  }

  startTutorial() {
    SND.unlock();
    this.startGame({ players: TUT_PLAYERS, level: 1, set: 'mvp', seed: 2026, noUnderClose: true },
      { ...this.O, quiz: true, hint: false, cover: false, fast: false, beats: true }, true);
  }

  resumeGame(st: State, opts: Partial<Opts>) {
    this.gid++;
    this.S = R.migrate(st);
    if (this.S.turn.resolved && !this.S.over) R.advance(this.S);
    this.O = { ...DEFAULT_OPTS, ...opts };
    if (!this.S.meta) this.S.meta = { startedAt: Date.now() };
    this.animSerial = this.S.serial;
    this.modal = null;
    this.tut = null;
    this.screen = 'game';
    this.emit();
    requestAnimationFrame(() => { this.view?.fit(false); this.beginTurn(); });
  }

  /** 저장용 상태: 차례 도중이면 차례 시작 시점(또는 정산이 끝난 다음 차례)으로 */
  stableState(): State | null {
    const S = this.S;
    if (!S || S.over) return S;
    const T = S.turn;
    if (T.resolved) { const c = R.clone(S); R.advance(c); return c; }
    if (T.placed && this.snapshot) return JSON.parse(this.snapshot);
    return S;
  }
  save() {
    if (!this.S || this.tut || this.puz) return;
    const st = this.stableState();
    if (!st || st.over) { store.del(SAVE_KEY); return; }
    store.set(SAVE_KEY, { v: 1, S: st, O: this.O, savedAt: Date.now() });
  }
  loadSave(): { S: State; O: Opts } | null {
    const d = store.get<{ v: number; S: State; O: Opts }>(SAVE_KEY);
    if (!d || d.v !== 1 || !d.S || d.S.over || !d.S.turn) return null;
    return d;
  }

  toSetup() {
    if (!this.tut) this.save();
    this.gid++;
    this.busy = false;
    this.modal = null;
    this.tut = null;
    if (this.puz) { this.puz = null; this.S = null; }
    this.screen = 'setup';
    this.emit();
  }

  // ── 차례 흐름 ─────────────────────────────────────────────────────
  beginTurn() {
    const S = this.S;
    if (!S) return;
    // 같은 차례를 두 번 시작하지 않게 (게임 시작 직후 프레임 콜백과 차례 끝이 겹쳐도 컴퓨터가 두 번 두지 않도록)
    const key = `${this.gid}:${S.turnNo}`;
    if (!S.over && this.begunKey === key) return;
    this.begunKey = key;
    if (S.over) { this.busy = false; this.modal = { type: 'end' }; this.emit(); return; }
    const p = this.cur();
    this.sel = 0;
    this.pv = null;
    this.noMove = false;
    this.turnStart = Date.now();
    this.revealed = !(this.O.cover && this.isHuman(p) && this.humans() >= 2);
    this.save();
    this.snapshot = JSON.stringify(S);
    if (!this.isHuman(p)) {
      this.busy = true;
      this.emit();
      this.runAI(this.gid);
      return;
    }
    this.busy = false;
    if (this.revealed) this.prepareHuman();
    if (this.tut) {
      const st = this.tutStep()!;
      if (st.expect.kind === 'auto') this.tutAdvance();
    }
    this.emit();
  }

  private prepareHuman() {
    this.noMove = !R.hasAnyPlacement(this.S!, this.cur());
    const st = this.tutStep();
    if (st?.select) {
      const i = this.S!.hands[this.cur()].indexOf(st.select);
      if (i >= 0) this.sel = i;
    }
    this.computeCands();
    if (!this.tut && !this.noMove && this.cands.length && this.view && !this.cands.some((c) => this.view!.cellVisible(c.x, c.y))) this.view.fit(true);
  }

  private computeCands() {
    this.cands = [];
    this.candMap = new Map();
    const S = this.S;
    if (!S || S.turn.placed) return;
    const k = S.hands[this.cur()][this.sel];
    if (!k) return;
    if (this.puz) {
      const P = this.puz;
      if (P.solved || P.def.type !== 'fill' || P.placed >= PZ.placeOf(P.def)) return;
      this.cands = PZ.candidates(S, P.def, k);
    } else this.cands = R.placements(S, k);
    this.cands.forEach((c) => this.candMap.set(`${c.x},${c.y}`, c));
  }

  selectHand(i: number) {
    const ph = this.phase();
    if ((ph !== 'place' && ph !== 'puzzle') || this.busy || i >= this.S!.hands[this.cur()].length) return;
    if (this.puz && (this.puz.solved || this.puz.placed >= PZ.placeOf(this.puz.def))) return;
    if (this.tut) return; // 튜토리얼은 타일을 정해 둔다
    const keep = this.pv;
    this.sel = i;
    this.pv = null;
    this.computeCands();
    if (keep) {
      const c = this.candMap.get(`${keep.x},${keep.y}`);
      if (c) this.pv = { x: keep.x, y: keep.y, rots: c.rots, r: c.rots.includes(keep.r) ? keep.r : c.rots[0] };
    }
    this.emit();
  }

  tapCell(x: number, y: number) {
    const ph = this.phase();
    if ((ph !== 'place' && ph !== 'puzzle') || this.busy) return;
    const c = this.candMap.get(`${x},${y}`);
    if (!c) return;
    if (this.pv && this.pv.x === x && this.pv.y === y) { this.rotate(1); return; }
    if (!this.tutAllows('cell', { x, y })) return;
    const prefer = this.pv ? this.pv.r : 0;
    this.pv = { x, y, rots: c.rots, r: c.rots.includes(prefer) ? prefer : c.rots[0] };
    if (this.tut) this.tutAdvance();
    this.emit();
  }

  /** 키보드: 후보 칸을 차례로 고르기 */
  cycleCand(dir: number) {
    const ph = this.phase();
    if ((ph !== 'place' && ph !== 'puzzle') || this.busy) return;
    const list = this.visibleCands();
    if (!list.length) return;
    const i = this.pv ? list.findIndex((c) => c.x === this.pv!.x && c.y === this.pv!.y) : -1;
    const c = list[(i + dir + list.length) % list.length];
    const prefer = this.pv ? this.pv.r : 0;
    this.pv = { x: c.x, y: c.y, rots: c.rots, r: c.rots.includes(prefer) ? prefer : c.rots[0] };
    this.view?.ensureVisible(c.x, c.y);
    if (this.tut && this.tutAllows('cell', c)) this.tutAdvance();
    this.emit();
  }

  rotate(dir: number) {
    if (!this.pv || this.pv.rots.length < 2) return;
    const i = this.pv.rots.indexOf(this.pv.r);
    this.pv.r = this.pv.rots[(i + dir + this.pv.rots.length) % this.pv.rots.length];
    this.emit();
  }

  clearPreview() { if (this.pv && !this.tut) { this.pv = null; this.emit(); } }

  /** 보드·손패 타일에 박자 숫자를 보일지 (몇 박 맞히기 퍼즐은 풀기 전까지 숨김) */
  showBeats(): boolean {
    const P = this.puz;
    if (P && P.def.type === 'count' && !P.solved) return false;
    return this.O.beats;
  }

  confirmPlace() {
    if (this.puz) { this.puzPlace(); return; }
    if (this.phase() !== 'place' || !this.pv || this.busy) return;
    if (this.tut && !this.tutAllows('place')) return;
    R.applyPlace(this.S!, this.sel, this.pv.x, this.pv.y, this.pv.r);
    this.pv = null;
    this.cands = [];
    this.candMap = new Map();
    if (this.tut) this.tutAdvance();
    this.emit();
  }

  placeMeeple(f: number | 's') {
    if (this.phase() !== 'act' || this.busy) return;
    if (this.tut && !this.tutAllows('meeple')) return;
    const spot = R.conductorSpots(this.S!).find((s) => String(s.f) === String(f));
    if (!spot) return;
    R.applyConductor(this.S!, spot);
    if (this.tut) this.tutAdvance();
    this.emit();
  }
  removeMeeple() { if (this.phase() === 'act' && !this.tut) { R.removeConductor(this.S!); this.emit(); } }

  placeBar(sk: string) {
    if (this.puz) { this.puzBar(sk); return; }
    if (this.phase() !== 'act' || this.busy) return;
    if (this.tut && !this.tutAllows('bar', { seam: sk })) return;
    if (!R.barSpots(this.S!).some((b) => b.seam === sk)) return;
    R.applyBar(this.S!, sk);
    if (this.tut) this.tutAdvance();
    this.emit();
  }
  removeBar(sk?: string) {
    if (this.puz) { if (sk) this.puzUnbar(sk); return; }
    if (this.phase() === 'act' && !this.tut) { R.removeBar(this.S!); this.emit(); }
  }

  /** 키보드 M / B */
  toggleMeepleKey() {
    if (this.phase() !== 'act' || this.tut) return;
    const T = this.S!.turn;
    if (T.meeple) R.removeConductor(this.S!);
    else { const sp = R.conductorSpots(this.S!); if (sp.length) R.applyConductor(this.S!, sp[0]); }
    this.emit();
  }
  cycleBarKey() {
    if (this.phase() !== 'act' || this.tut) return;
    const T = this.S!.turn;
    const prev = T.bar;
    if (prev) R.removeBar(this.S!);
    const list = R.barSpots(this.S!).map((x) => x.seam);
    const i = prev ? list.indexOf(prev) + 1 : 0;
    if (i < list.length) R.applyBar(this.S!, list[i]);
    this.emit();
  }

  undoTurn() {
    if (!this.snapshot || this.tut || !['act', 'place'].includes(this.phase())) return;
    this.S = JSON.parse(this.snapshot);
    this.animSerial = Math.min(this.animSerial, this.S!.serial);
    this.pv = null;
    this.sel = 0;
    this.prepareHuman();
    this.emit();
  }

  reveal() {
    this.revealed = true;
    this.turnStart = Date.now();
    this.prepareHuman();
    this.emit();
  }

  async endTurnByUser() {
    if (this.phase() !== 'act' || this.busy) return;
    if (this.tut && !this.tutAllows('end')) return;
    if (this.tut) this.tutAdvance();
    await this.finishTurn();
  }

  private willQuiz(e: GameEvent, closer: number): boolean {
    return e.type === 'measure' && this.O.quiz && this.isHuman(closer) && e.order.some((o) => o.note || o.rest);
  }

  async finishTurn() {
    const S = this.S!;
    const gid = this.gid;
    const p = this.cur();
    if (this.isHuman(p)) R.addTurnTime(S, p, Date.now() - this.turnStart);
    this.busy = true;
    const events = R.resolveTurn(S);
    this.hiddenEv = events.filter((e) => this.willQuiz(e, p)) as MeasureEvent[];
    this.hidden = new Set(this.hiddenEv.map((e) => e.id));
    this.emit();
    await this.showEvents(events, p, gid);
    this.hidden = new Set();
    this.hiddenEv = [];
    if (gid !== this.gid) return;
    if (this.tut && this.tutStep()!.expect.kind === 'quiz') {
      this.modal = { type: 'tutorialDone' };
      this.emit();
      return;
    }
    const fin = R.advance(S);
    this.busy = false;
    if (S.over) {
      await this.showFinalEvents(fin);
      if (gid !== this.gid) return;
    }
    this.beginTurn();
  }

  async discard(i: number) {
    if (this.phase() !== 'nomove') return;
    const S = this.S!;
    const k = S.hands[this.cur()][i];
    const res = R.discardForNoMove(S, i);
    this.toast({ head: `${this.pname(this.cur())}: ${kindName(k)}를 버렸어요`, tone: 'plain', sub: '놓을 자리가 없어서 한 장을 빼 두고 새로 뽑았어요' }, 2200);
    if (res.ended) {
      this.busy = false;
      if (S.over) await this.showFinalEvents(res.events);
      this.beginTurn();
      return;
    }
    this.sel = 0;
    this.prepareHuman();
    this.emit();
  }

  // ── 컴퓨터 차례 ───────────────────────────────────────────────────
  private async runAI(gid: number) {
    const fast = this.O.fast;
    const d = fast ? 140 : 520;
    const S = this.S;
    if (gid !== this.gid || !S || S.over) return;
    if (S.turn.placed) { await wait(fast ? 120 : 450); if (gid === this.gid) await this.finishTurn(); return; }
    const t0 = Date.now();
    const think = async (): Promise<AI.Plan | null> => {
      this.thinking = true;
      this.emit();
      try { return await planAsync(S, this.O.ai); } finally { this.thinking = false; }
    };
    let plan: AI.Plan | null;
    if (this.tut) {
      const hi = S.hands[this.cur()].indexOf(TUT_AI_MOVE.k);
      plan = { value: 0, hi, k: TUT_AI_MOVE.k, x: TUT_AI_MOVE.x, y: TUT_AI_MOVE.y, r: TUT_AI_MOVE.r, meeple: null, bar: null };
    } else plan = await think();
    // 계산이 빨리 끝나도 사람이 따라볼 수 있게 최소한 잠깐은 기다린다
    const left = (fast ? 120 : 450) - (Date.now() - t0);
    if (left > 0) await wait(left);
    if (gid !== this.gid || this.S !== S || S.over) return;
    while (!plan) {
      const res = R.discardForNoMove(S, AI.pickDiscard(S));
      this.emit();
      if (res.ended) {
        this.busy = false;
        if (S.over) await this.showFinalEvents(res.events);
        if (gid === this.gid) this.beginTurn();
        return;
      }
      plan = await think();
      if (gid !== this.gid || this.S !== S) return;
    }
    this.sel = plan.hi;
    this.pv = { x: plan.x, y: plan.y, r: plan.r, rots: [plan.r] };
    this.view?.ensureVisible(plan.x, plan.y);
    this.emit();
    await wait(d * 1.25);
    if (gid !== this.gid) return;
    R.applyPlace(S, plan.hi, plan.x, plan.y, plan.r);
    this.pv = null;
    this.emit();
    if (plan.meeple) {
      await wait(d);
      if (gid !== this.gid) return;
      R.applyConductor(S, plan.meeple);
      this.emit();
    }
    if (plan.bar) {
      await wait(d);
      if (gid !== this.gid) return;
      R.applyBar(S, plan.bar);
      this.emit();
    }
    await wait(d);
    if (gid !== this.gid) return;
    await this.finishTurn();
  }

  // ── 정산 연출 ─────────────────────────────────────────────────────
  private flashCells(cells: [number, number][], ok: boolean | null, ms: number) {
    const token = { cells, ok };
    this.flash = token;
    this.emit();
    setTimeout(() => { if (this.flash === token) { this.flash = null; this.emit(); } }, ms);
  }
  private floatText(cells: [number, number][], text: string, color: string) {
    if (!cells.length) return;
    const xs = cells.map((c) => c[0]);
    const ys = cells.map((c) => c[1]);
    const id = ++this.fxId;
    this.fx.push({ id, x: ((Math.min(...xs) + Math.max(...xs) + 1) / 2) * 100, y: Math.min(...ys) * 100 - 6, text, color });
    this.emit();
    setTimeout(() => { this.fx = this.fx.filter((f) => f.id !== id); this.emit(); }, 1600);
  }
  toast(t: Omit<Toast, 'id'>, ms = 2600) {
    const id = ++this.toastId;
    this.toasts = [{ ...t, id }, ...this.toasts].slice(0, 3);
    this.emit();
    setTimeout(() => { this.toasts = this.toasts.filter((x) => x.id !== id); this.emit(); }, ms);
  }

  private revealMeasure(e: MeasureEvent) {
    const cells = cellsOf(e);
    this.hidden.delete(e.id);
    this.flashCells(cells, e.ok, 2600);
    if (e.points > 0) e.winners.forEach((w, i) => setTimeout(() => this.floatText(cells, `+${e.points}`, this.uiColor(w)), 150 + i * 220));
    this.emit();
  }

  playMeasure(e: MeasureEvent, onNote?: (i: number) => void) {
    if (!this.O.sound) return 0;
    const items = e.order.filter((o) => o.note || o.rest).map((o) => ({ beats: o.beats, rest: o.rest }));
    return SND.playRhythm(items, { onNote });
  }

  private async showEvents(events: GameEvent[], closer: number, gid: number) {
    for (const e of events) {
      if (gid !== this.gid) return;
      if (e.type === 'measure') {
        const cells = cellsOf(e);
        if (this.willQuiz(e, closer)) {
          this.flashCells(cells, null, 120000);
          await this.quiz(e, closer);
        } else {
          this.flashCells(cells, e.ok, 2400);
          if (e.points > 0) e.winners.forEach((w, i) => setTimeout(() => this.floatText(cells, `+${e.points}`, this.uiColor(w)), i * 220));
          this.toast({ head: e.ok ? '마디 완성!' : '틀린 마디', tone: e.ok ? 'ok' : 'bad', ev: e, sub: pointsLine(this, e) }, this.O.fast ? 1800 : 2800);
          if (e.ok) this.playMeasure(e); else if (this.O.sound) SND.blip(false);
          await wait(this.O.fast ? 700 : 1500);
        }
      } else if (e.type === 'stand') {
        const cells: [number, number][] = [];
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) cells.push([e.x + dx, e.y + dy]);
        this.flashCells(cells, true, 2000);
        if (e.points && e.owner != null) this.floatText([[e.x, e.y]], `+${e.points}`, this.uiColor(e.owner));
        this.toast({ head: '지휘대 완성!', tone: 'ok', sub: `둘레 8칸이 다 찼어요 → ${e.owner != null ? `${this.pname(e.owner)} +9점` : '지휘자가 없어 아무도 받지 않아요'}` });
        if (this.O.sound) SND.blip(true);
        await wait(this.O.fast ? 600 : 1300);
      }
    }
  }

  private async showFinalEvents(events: GameEvent[]) {
    this.emit();
    const scored = events.filter((e) => e.points > 0);
    if (scored.length) {
      this.toast({
        head: '게임 끝 정산', tone: 'plain',
        sub: scored.map((e) => (e.type === 'openStand'
          ? `${this.pname((e as R.StandEvent).owner!)}: 미완성 지휘대 ${(e as R.StandEvent).filled}칸 +${e.points}`
          : `${(e as MeasureEvent).winners.map((w) => this.pname(w)).join(', ')}: 열린 마디 +${e.points}`)).join(' · '),
      }, 3200);
      await wait(900);
    }
  }

  // ── 검산 퀴즈 ─────────────────────────────────────────────────────
  private quiz(e: MeasureEvent, closer: number): Promise<void> {
    return new Promise((resolve) => {
      this.modal = { type: 'quiz', ev: e, closer, choices: makeChoices(e.sum, e.target), picked: null, hl: -1, resolve, onAnswer: () => this.revealMeasure(e) };
      this.emit();
    });
  }
  answerQuiz(v: number) {
    const m = this.modal;
    if (!m || m.type !== 'quiz' || m.picked != null) return;
    m.picked = v;
    R.recordQuiz(this.S!, m.closer, v === m.ev.sum);
    m.onAnswer();
    if (this.O.sound) {
      if (m.ev.ok) this.playMeasure(m.ev, (i) => this.quizHighlight(i));
      else SND.blip(false);
    }
    this.emit();
  }
  replayQuiz() {
    const m = this.modal;
    if (!m || m.type !== 'quiz') return;
    SND.unlock();
    const items = m.ev.order.filter((o) => o.note || o.rest).map((o) => ({ beats: o.beats, rest: o.rest }));
    SND.playRhythm(items, { onNote: (i) => this.quizHighlight(i) });
  }
  private quizHighlight(i: number) {
    const m = this.modal;
    if (!m || m.type !== 'quiz') return;
    m.hl = i;
    this.emit();
    const n = m.ev.order.filter((o) => o.note || o.rest).length;
    if (i === n - 1) setTimeout(() => { if (this.modal === m) { m.hl = -1; this.emit(); } }, 650);
  }
  quizContinue() {
    const m = this.modal;
    if (!m || m.type !== 'quiz' || m.picked == null) return;
    this.modal = null;
    this.emit();
    m.resolve();
  }

  // ── 모달 · 옵션 ───────────────────────────────────────────────────
  open(m: Modal) { this.modal = m; this.emit(); }
  close() {
    if (this.modal && this.modal.type === 'quiz') return;
    this.modal = null;
    this.emit();
  }
  setOpt<K extends keyof Opts>(k: K, v: Opts[K]) {
    this.O[k] = v;
    if (k === 'sound' && v) SND.unlock();
    this.save();
    this.emit();
  }
  restartSame() {
    const cfg = { ...this.S!.cfg, seed: Math.floor(Math.random() * 1e9) };
    this.startGame(cfg, this.O);
  }

  // ── 학습 퍼즐 ─────────────────────────────────────────────────────
  puzProgress(): PuzzleProgress {
    if (!this.progress) {
      const d = store.get<PuzzleProgress>(PUZ_KEY);
      this.progress = d && d.v === 1 && d.stars ? { v: 1, stars: { ...d.stars }, best: { ...(d.best || {}) } } : { v: 1, stars: {}, best: {} };
    }
    return this.progress;
  }
  private saveProgress() { if (this.progress) store.set(PUZ_KEY, this.progress); }

  /** 퍼즐 목록 화면으로 (진행 중인 게임은 이어하기로 저장) */
  openPuzzles() {
    if (this.S && !this.tut && !this.puz) this.save();
    this.gid++;
    this.busy = false;
    this.thinking = false;
    this.modal = null;
    this.tut = null;
    this.puz = null;
    this.S = null;
    this.pv = null;
    this.flash = null;
    this.screen = 'puzzles';
    this.emit();
  }

  /** 아직 별을 받지 못한 첫 문제 */
  nextUnsolved(): PZ.PuzzleDef {
    const st = this.puzProgress().stars;
    return PZ.ALL_PUZZLES.find((p) => !st[p.id]) ?? PZ.ALL_PUZZLES[0];
  }

  startPuzzle(ref: PuzzleRef) {
    SND.unlock();
    const def = ref.kind === 'course' ? PZ.puzzleById(ref.id) : PZ.genDrill(ref.level, ref.seed);
    if (!def) return;
    if (!this.puz) this.O = { ...DEFAULT_OPTS, ...(this.loadPrefs()?.opts || {}) }; // 처음 화면에서 고른 소리·박자 숫자 설정
    this.gid++;
    this.busy = false;
    this.modal = null;
    this.tut = null;
    this.toasts = [];
    this.flash = null;
    this.fx = [];
    this.S = PZ.buildState(def);
    this.animSerial = 0;
    this.puz = { def, ref, placed: 0, myBars: [], stack: [], tries: 0, hints: 0, asked: 0, msg: null, marks: null, wrong: [], solved: false, stars: 0, result: null };
    this.sel = 0;
    this.pv = null;
    this.computeCands();
    this.screen = 'puzzle';
    this.emit();
    requestAnimationFrame(() => this.view?.fit(false));
  }

  private puzSnap() {
    const P = this.puz!;
    P.stack.push({ S: JSON.stringify(this.S), placed: P.placed, myBars: P.myBars.slice() });
    if (P.stack.length > 40) P.stack.shift();
    P.marks = null;
    P.msg = null;
  }

  private puzPlace() {
    const P = this.puz;
    if (!P || P.solved || !this.pv) return;
    this.puzSnap();
    R.applyPlace(this.S!, this.sel, this.pv.x, this.pv.y, this.pv.r);
    this.S!.turn = { p: 0, placed: null, meeple: null, bar: null, resolved: false };
    P.placed++;
    this.pv = null;
    this.sel = 0;
    this.computeCands();
    this.emit();
    this.puzAuto();
  }

  private puzBar(sk: string) {
    const P = this.puz;
    const S = this.S;
    if (!P || !S || P.solved || !this.visibleSeams().includes(sk)) return;
    this.puzSnap();
    S.bars[sk] = { p: 0, t: 1 };
    S.barsLeft--;
    P.myBars.push(sk);
    this.computeCands();
    this.emit();
    this.puzAuto();
  }

  private puzUnbar(sk: string) {
    const P = this.puz;
    const S = this.S;
    if (!P || !S || P.solved || !P.myBars.includes(sk)) return;
    this.puzSnap();
    delete S.bars[sk];
    S.barsLeft++;
    P.myBars = P.myBars.filter((b) => b !== sk);
    this.computeCands();
    this.emit();
  }

  puzUndo() {
    const P = this.puz;
    if (!P || P.solved) return;
    const last = P.stack.pop();
    if (!last) return;
    this.S = JSON.parse(last.S);
    P.placed = last.placed;
    P.myBars = last.myBars;
    P.marks = null;
    P.msg = null;
    this.pv = null;
    this.sel = 0;
    this.computeCands();
    this.emit();
  }

  puzReset() {
    const P = this.puz;
    if (!P || P.solved) return;
    this.S = PZ.buildState(P.def);
    P.placed = 0;
    P.myBars = [];
    P.stack = [];
    P.marks = null;
    P.msg = null;
    this.pv = null;
    this.sel = 0;
    this.computeCands();
    this.emit();
  }

  puzHint() {
    const P = this.puz;
    if (!P || P.solved || P.hints >= P.def.hints.length) return;
    P.hints++;
    P.asked++;
    this.emit();
  }

  /** 마디가 닫히면(채우기) 또는 마디줄을 다 꽂으면(긋기) 저절로 검사 */
  private puzAuto() {
    const P = this.puz!;
    const S = this.S!;
    if (P.def.type === 'fill') {
      const seg = PZ.goalSegment(S, P.def);
      if (seg && seg.closed) this.puzCheck();
    } else if (P.def.type === 'divide' && S.barsLeft <= 0) this.puzCheck();
  }

  puzCheck() {
    const P = this.puz;
    if (!P || P.solved || P.def.type === 'count') return;
    const res = PZ.check(P.def, this.S!, P.placed);
    if (res.ok) { this.puzSolved(res); return; }
    const incomplete = res.measures.some((m) => !m.closed) || (P.def.type === 'fill' && P.placed < 1);
    P.msg = { tone: incomplete ? 'info' : 'bad', text: incomplete ? res.msg : `${res.msg} ‘되돌리기’로 고쳐 보세요.` };
    P.marks = res.measures.filter((m) => m.closed).map((m) => ({ cells: m.cells, ok: m.ok }));
    if (!incomplete) {
      P.tries++;
      if (this.O.sound) SND.blip(false);
      if (P.tries >= 2 && P.hints < P.def.hints.length) P.hints++; // 두 번 틀리면 힌트를 하나 더 보여 준다
    }
    this.emit();
  }

  puzAnswer(v: number) {
    const P = this.puz;
    if (!P || P.solved || P.def.type !== 'count' || P.wrong.includes(v)) return;
    const res = PZ.check(P.def, this.S!, 0, v);
    if (res.ok) {
      const ms = PZ.noteMeasures(this.S!);
      this.puzSolved({ ok: true, msg: '', measures: ms });
      return;
    }
    P.wrong.push(v);
    P.tries++;
    P.msg = { tone: 'bad', text: `${PZ.fmt(v)}박이 아니에요. 다시 세어 볼까요?` };
    if (P.hints < P.def.hints.length) P.hints++;
    if (this.O.sound) SND.blip(false);
    this.emit();
  }

  private puzSolved(res: PZ.CheckResult) {
    const P = this.puz!;
    const gid = this.gid;
    P.solved = true;
    P.result = res;
    P.msg = null;
    P.marks = res.measures.map((m) => ({ cells: m.cells, ok: true }));
    P.stars = Math.max(1, 3 - P.tries - (P.asked > 0 ? 1 : 0));
    const prog = this.puzProgress();
    if (P.ref.kind === 'course') {
      prog.stars[P.def.id] = Math.max(prog.stars[P.def.id] || 0, P.stars);
    } else {
      P.ref.streak = P.tries === 0 ? P.ref.streak + 1 : 0;
      prog.best[P.ref.level] = Math.max(prog.best[P.ref.level] || 0, P.ref.streak);
    }
    this.saveProgress();
    this.pv = null;
    this.cands = [];
    this.candMap = new Map();
    this.emit();
    if (this.O.sound) setTimeout(() => { if (gid === this.gid) this.puzPlay(); }, 250);
    setTimeout(() => { if (gid === this.gid && this.puz === P) this.open({ type: 'puzzleDone' }); }, 700);
  }

  /** 정답 리듬 들려주기 (여러 마디면 마디 첫 박에 강세) */
  puzPlay() {
    const P = this.puz;
    if (!P || !P.result) return;
    SND.unlock();
    const ms = P.result.measures;
    const items = ms.flatMap((m) => m.terms.map((o) => ({ beats: o.beats, rest: o.rest })));
    if (!items.length) return;
    SND.playRhythm(items, { measure: ms.length > 1 ? ms[0].targets[0] : undefined });
  }

  /** 다음 문제: 단원 문제는 순서대로, 무한 연습은 새로 만든다 */
  puzNext() {
    const P = this.puz;
    if (!P) return;
    if (P.ref.kind === 'drill') {
      this.startPuzzle({ kind: 'drill', level: P.ref.level, seed: (Math.random() * 2 ** 31) >>> 0, streak: P.ref.streak });
      return;
    }
    const i = PZ.ALL_PUZZLES.findIndex((p) => p.id === P.def.id);
    const nx = PZ.ALL_PUZZLES[i + 1];
    if (nx) this.startPuzzle({ kind: 'course', id: nx.id });
    else this.openPuzzles();
  }

  // ── 플레이테스트 기록 ─────────────────────────────────────────────
  playtestRecord(): string {
    const S = this.S!;
    const d = new Date();
    const p2 = (n: number) => String(n).padStart(2, '0');
    const humansN = this.humans();
    const ms = Date.now() - (S.meta?.startedAt || Date.now());
    let hTurns = 0, hMs = 0, qOk = 0, qAll = 0;
    S.cfg.players.forEach((pl, i) => {
      if (pl.type !== 'human') return;
      hTurns += S.players[i].stats.turns;
      hMs += S.players[i].stats.turnMs;
      qOk += S.players[i].stats.quizOk;
      qAll += S.players[i].stats.quizTotal;
    });
    const ok = S.measures.filter((m) => m.ok).length;
    const wrong = S.measures.length - ok;
    const under = S.measures.filter((m) => !m.ok && m.sum < Math.min(...(m.targets ?? [m.target]))).length;
    return [
      '[리듬마을 플레이테스트 기록]',
      `날짜 ${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())} · 인원 ${S.players.length}명 (사람 ${humansN}, 컴퓨터 ${S.players.length - humansN}) · ${R.LEVELS[S.cfg.level].label} · ${R.SETS[S.cfg.set].label}${S.cfg.level === 2 ? ' + 심화 20장' : ''}`,
      `규칙 옵션: 덜 찬 마디 닫기 금지 ${S.cfg.noUnderClose ? '켬' : '끔'} · 열린 마디 부분 점수 ${S.cfg.softEnd ? '켬' : '끔'} · 검산 퀴즈 ${this.O.quiz ? '켬' : '끔'} · 컴퓨터 ${AI.AI_LABEL[this.O.ai] ?? '보통'}`,
      `총 시간 ${Math.max(1, Math.round(ms / 60000))}분 · 전체 ${S.turnNo}차례${hTurns ? ` · 사람 평균 차례 ${Math.round(hMs / hTurns / 1000)}초` : ''}`,
      `닫힌 마디 ${S.measures.length}개 (맞음 ${ok} · 틀림 ${wrong}${wrong ? `, 그중 덜 찬 마디 ${under}` : ''})`,
      qAll ? `검산 퀴즈 정답 ${qOk}/${qAll}` : '검산 퀴즈 기록 없음',
      `최종 점수: ${S.cfg.players.map((p, i) => `${p.name} ${S.players[i].score}점`).join(', ')}`,
      `시드 ${S.cfg.seed}`,
    ].join('\n');
  }
}

export function kindName(k: KindId): string {
  const K = R.kindOf(k);
  return `${K.name}${K.shapeName ? `(${K.shapeName})` : ''}`;
}

export function cellsOf(e: MeasureEvent): [number, number][] {
  const seen = new Set<string>();
  const out: [number, number][] = [];
  e.order.forEach((o) => { const k = `${o.x},${o.y}`; if (!seen.has(k)) { seen.add(k); out.push([o.x, o.y]); } });
  return out;
}

export function pointsLine(g: Game, e: MeasureEvent): string {
  const who = e.winners.length ? `${e.winners.map((w) => g.pname(w)).join(', ')} +${e.points}점` : '지휘자가 없어 아무도 받지 않아요';
  const tsNote = e.target !== 4 ? `${e.target}/4박자 · ` : '';
  if (e.ok) {
    const rest = e.rests ? ` + 쉼표 ${e.rests}장 × 1점` : '';
    return `${tsNote}${e.target}박 완성 · 음표 ${e.notes}장 × 2점${rest} = ${e.points}점 → ${who}`;
  }
  const tg = e.targets ?? [e.target];
  const lo = Math.min(...tg);
  const why = e.sum > lo ? `${tg.join('·')}박을 넘쳤어요` : `${lo}박이 안 됐어요`;
  return `${tsNote}${why} · 틀린 마디라 0점${e.returned.length ? ' · 지휘자는 돌려받아요' : ''}`;
}

export const game = new Game();
