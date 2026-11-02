/* 리듬마을 룰 엔진 — 화면과 분리된 순수 로직 (TypeScript)
 * 상태(State)는 JSON으로 그대로 저장되는 평범한 객체만 쓴다 → 저장·되돌리기·리플레이·온라인 동기화가 같은 방식.
 *
 * 좌표: 칸 (x, y), x는 오른쪽, y는 아래쪽이 +.  방향: 0=N(위) 1=E(오른쪽) 2=S(아래) 3=W(왼쪽).
 * 회전 r = 시계방향 90°×r.  '조각(piece)' = 타일 위 리듬선 한 토막.  '이음새(seam)' = 두 칸 사이의 변.
 */

export type Dir = 0 | 1 | 2 | 3;
export type End = Dir | 'bar';
export const N: Dir = 0, E: Dir = 1, S: Dir = 2, W: Dir = 3;
export const DXY: [number, number][] = [[0, -1], [1, 0], [0, 1], [-1, 0]];
export const opp = (d: number): Dir => ((d + 2) & 3) as Dir;
export const cellKey = (x: number, y: number) => `${x},${y}`;
export const pieceKey = (x: number, y: number, pi: number) => `${x},${y}:${pi}`;

// ── 박자값표 (설계서 2장, 카드 마스터 데이터 '박자값 참조') ──────────────
export type SymId = 'q' | 'h' | 'dh' | 'w' | 'e' | 'dq' | 'qr' | 'er' | 'hr';
export const SYMBOLS: Record<SymId, { name: string; beats: number; rest: boolean }> = {
  q: { name: '4분음표', beats: 1, rest: false },
  h: { name: '2분음표', beats: 2, rest: false },
  dh: { name: '점2분음표', beats: 3, rest: false },
  w: { name: '온음표', beats: 4, rest: false },
  e: { name: '8분음표', beats: 0.5, rest: false },
  dq: { name: '점4분음표', beats: 1.5, rest: false },
  qr: { name: '4분쉼표', beats: 1, rest: true },
  er: { name: '8분쉼표', beats: 0.5, rest: true },
  hr: { name: '2분쉼표', beats: 2, rest: true },
};

// ── 타일 종류 (카드 마스터 데이터 A·B·C 세트) ───────────────────────────
export type Shape = 'straight' | 'curve' | 'none' | 'start' | 'timesig';
export interface Kind {
  name: string;
  shapeName: string;
  shape: Shape;
  sym?: SymId;
  stand?: boolean;
  thru?: boolean;
  start?: boolean;
  ts?: number; // 박자표 타일: 한 마디의 박 수 (3/4 → 3)
}
export const KINDS = {
  'q-s': { sym: 'q', shape: 'straight', name: '4분음표', shapeName: '직선' },
  'q-c': { sym: 'q', shape: 'curve', name: '4분음표', shapeName: '곡선' },
  'h-s': { sym: 'h', shape: 'straight', name: '2분음표', shapeName: '직선' },
  'h-c': { sym: 'h', shape: 'curve', name: '2분음표', shapeName: '곡선' },
  'dh-s': { sym: 'dh', shape: 'straight', name: '점2분음표', shapeName: '직선' },
  'dh-c': { sym: 'dh', shape: 'curve', name: '점2분음표', shapeName: '곡선' },
  'w-s': { sym: 'w', shape: 'straight', name: '온음표', shapeName: '직선' },
  'e-s': { sym: 'e', shape: 'straight', name: '8분음표', shapeName: '직선' },
  'e-c': { sym: 'e', shape: 'curve', name: '8분음표', shapeName: '곡선' },
  'dq-s': { sym: 'dq', shape: 'straight', name: '점4분음표', shapeName: '직선' },
  'dq-c': { sym: 'dq', shape: 'curve', name: '점4분음표', shapeName: '곡선' },
  qr: { sym: 'qr', shape: 'straight', name: '4분쉼표', shapeName: '' },
  er: { sym: 'er', shape: 'straight', name: '8분쉼표', shapeName: '' },
  hr: { sym: 'hr', shape: 'straight', name: '2분쉼표', shapeName: '' },
  ts34: { ts: 3, shape: 'timesig', name: '3/4 박자표', shapeName: '' },
  ts24: { ts: 2, shape: 'timesig', name: '2/4 박자표', shapeName: '' },
  stand: { stand: true, shape: 'none', name: '지휘대', shapeName: '독립' },
  'stand-thru': { stand: true, thru: true, shape: 'straight', name: '지휘대', shapeName: '통과' },
  start: { start: true, shape: 'start', name: '시작 타일', shapeName: '', ts: 4 },
} satisfies Record<string, Kind>;
export type KindId = keyof typeof KINDS;
export const kindOf = (k: KindId): Kind => KINDS[k] as Kind;

export interface PieceDef { ends: End[]; beats: number; note: boolean; rest: boolean }
export interface Geom {
  pieces: PieceDef[];
  pieceAt: number[];
  edges: boolean[];
  /** 박자표가 적용되는 쪽(숫자가 적힌 쪽). 시작 타일은 -1(양쪽), 그 밖은 null */
  face: number | null;
  ts: number | null;
}

function basePieces(k: KindId): PieceDef[] {
  const K = kindOf(k);
  if (K.shape === 'none') return [];
  if (K.shape === 'start' || K.shape === 'timesig') {
    return [
      { ends: [W, 'bar'], beats: 0, note: false, rest: false },
      { ends: [E, 'bar'], beats: 0, note: false, rest: false },
    ];
  }
  const ends: End[] = K.shape === 'straight' ? [W, E] : [W, S];
  if (K.thru || !K.sym) return [{ ends, beats: 0, note: false, rest: false }]; // 지휘대(통과) = 0박
  const sym = SYMBOLS[K.sym];
  return [{ ends, beats: sym.beats, note: !sym.rest, rest: sym.rest }];
}

const rotEnd = (e: End, r: number): End => (e === 'bar' ? 'bar' : (((e + r) & 3) as Dir));

export const GEOM = {} as Record<KindId, Geom[]>;
for (const k of Object.keys(KINDS) as KindId[]) {
  const K = kindOf(k);
  GEOM[k] = [0, 1, 2, 3].map((r) => {
    const pieces = basePieces(k).map((p) => ({ ...p, ends: p.ends.map((e) => rotEnd(e, r)) }));
    const pieceAt = [-1, -1, -1, -1];
    pieces.forEach((p, i) => p.ends.forEach((e) => { if (e !== 'bar') pieceAt[e] = i; }));
    const face = K.start ? -1 : K.shape === 'timesig' ? (E + r) & 3 : null;
    return { pieces, pieceAt, edges: pieceAt.map((i) => i >= 0), face, ts: K.ts ?? null };
  });
}

/** 모양이 실제로 달라지는 회전만 (직선 2가지, 곡선·박자표 4가지, 독립 지휘대 1가지) */
export const ROTATIONS = {} as Record<KindId, number[]>;
for (const k of Object.keys(KINDS) as KindId[]) {
  const sig = (r: number) => GEOM[k][r].pieces.map((p) => p.ends.map(String).sort().join('-')).sort().join('|') + `#${GEOM[k][r].face}`;
  const seen = new Set<string>();
  ROTATIONS[k] = [];
  for (const r of [0, 1, 2, 3]) {
    const s = sig(r);
    if (!seen.has(s)) { seen.add(s); ROTATIONS[k].push(r); }
  }
}

// ── 세트·난이도 (설계서 3장·9장 = 카드 마스터 데이터 수량) ────────────────
export type SetId = 'mvp' | 'full';
type Counts = Partial<Record<KindId, number>>;
export const SETS: Record<SetId, { label: string; bars: number; tiles: Counts }> = {
  mvp: { label: 'MVP 40장', bars: 24, tiles: { 'q-s': 12, 'q-c': 6, 'h-s': 8, 'h-c': 4, 'dh-s': 3, 'dh-c': 1, 'w-s': 4, stand: 1 } },
  full: { label: '완전판 72장', bars: 40, tiles: { 'q-s': 22, 'q-c': 10, 'h-s': 13, 'h-c': 7, 'dh-s': 5, 'dh-c': 2, 'w-s': 6, 'stand-thru': 3, stand: 3 } },
};
/** Lv2 심화 봉투 20장 (C-01~C-09) */
export const LV2_ADD: Counts = { 'e-s': 4, 'e-c': 2, 'dq-s': 3, 'dq-c': 1, qr: 3, er: 2, hr: 1, ts34: 2, ts24: 2 };
export type LevelId = 0 | 1 | 2;
export const LEVELS: Record<LevelId, { label: string; short: string; exclude: KindId[]; strict: boolean; add?: Counts; extraBars: number }> = {
  0: { label: 'Lv0 입문', short: '1·2·4박만, 4박일 때만 마디줄', exclude: ['dh-s', 'dh-c', 'stand', 'stand-thru'], strict: true, extraBars: 0 },
  1: { label: 'Lv1 기본', short: '1·2·3·4박, 지휘대, 틀린 마디 0점', exclude: [], strict: false, extraBars: 0 },
  2: { label: 'Lv2 심화', short: '+ 8분·점4분·쉼표·3/4·2/4 박자표', exclude: [], strict: false, add: LV2_ADD, extraBars: 8 },
};

export interface PlayerCfg { name: string; type: 'human' | 'ai'; color?: number }
export interface Config {
  players: PlayerCfg[];
  level: LevelId;
  set: SetId;
  handSize: number;
  meeples: number;
  target: number;
  softEnd: boolean;
  noUnderClose: boolean;
  seed: number;
}
export const DEFAULT_CFG = { level: 1 as LevelId, set: 'mvp' as SetId, handSize: 3, meeples: 6, target: 4, softEnd: false, noUnderClose: false };

// ── 상태 ─────────────────────────────────────────────────────────────
export interface Tile { k: KindId; r: number; n: number; p: number | null }
export interface Meeple { p: number; x: number; y: number; f: number | 's'; t: number }
export interface Stats {
  measuresWon: number; measurePts: number; standPts: number; endPts: number;
  closedOk: number; closedWrong: number; quizOk: number; quizTotal: number; turns: number; turnMs: number;
}
export interface Spot { x: number; y: number; f: number | 's' }
export interface Turn { p: number; placed: { x: number; y: number; k: KindId; r: number } | null; meeple: Spot | null; bar: string | null; resolved: boolean }
export interface OrderItem { x: number; y: number; pi: number; k: KindId; beats: number; note: boolean; rest: boolean }
export interface MeasureEvent {
  type: 'measure' | 'openMeasure';
  id: number; turn: number; closer: number | null; ok: boolean; sum: number;
  target: number; targets: number[]; notes: number; rests: number; points: number; winners: number[];
  returned: { p: number; x: number; y: number; f: number | 's' }[];
  order: OrderItem[];
}
export interface StandEvent { type: 'stand' | 'openStand'; x: number; y: number; owner: number | null; points: number; filled: number }
export type GameEvent = MeasureEvent | StandEvent;
export type LogEntry = { t: number; type: string; [k: string]: any };

export interface State {
  v: number;
  cfg: Config;
  board: Record<string, Tile>;
  bars: Record<string, { p: number; t: number }>;
  meeples: Meeple[];
  scored: Record<string, number>;
  standDone: Record<string, boolean>;
  bag: KindId[];
  discards: KindId[];
  hands: KindId[][];
  players: { score: number; meeples: number; stats: Stats }[];
  barsLeft: number;
  serial: number;
  mid: number;
  ts: number; // 보드 위 박자표 타일 수 (빠른 계산용)
  turnNo: number;
  turn: Turn;
  over: boolean;
  final: { p: number; score: number; won: number; rank: number }[] | null;
  measures: MeasureEvent[];
  log: LogEntry[] | null;
  meta?: { startedAt: number };
}

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const newStats = (): Stats => ({
  measuresWon: 0, measurePts: 0, standPts: 0, endPts: 0, closedOk: 0, closedWrong: 0, quizOk: 0, quizTotal: 0, turns: 0, turnMs: 0,
});

function setCounts(cfg: Pick<Config, 'set' | 'level'>): Counts {
  const lv = LEVELS[cfg.level];
  const out: Counts = {};
  for (const [k, n] of Object.entries(SETS[cfg.set].tiles) as [KindId, number][]) if (!lv.exclude.includes(k)) out[k] = n;
  if (lv.add) for (const [k, n] of Object.entries(lv.add) as [KindId, number][]) out[k] = (out[k] || 0) + n;
  return out;
}
export function tileCount(cfg: Pick<Config, 'set' | 'level'>): number {
  return 1 + Object.values(setCounts(cfg)).reduce((a, b) => a + (b || 0), 0);
}
export const barCount = (cfg: Pick<Config, 'set' | 'level'>) => SETS[cfg.set].bars + LEVELS[cfg.level].extraBars;

// ── 새 게임 ──────────────────────────────────────────────────────────
export function newGame(cfgIn: Partial<Config> & { players: PlayerCfg[] }): State {
  const cfg: Config = { ...DEFAULT_CFG, seed: 0, ...cfgIn } as Config;
  if (!cfg.players || cfg.players.length < 2 || cfg.players.length > 4) throw new Error('플레이어는 2~4명이어야 합니다');
  if (cfgIn.seed == null) cfg.seed = Math.floor(Math.random() * 2 ** 31);
  cfg.seed = cfg.seed >>> 0;
  const bag: KindId[] = [];
  for (const [k, n] of Object.entries(setCounts(cfg)) as [KindId, number][]) for (let i = 0; i < n; i++) bag.push(k);
  const rnd = mulberry32(cfg.seed);
  for (let i = bag.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [bag[i], bag[j]] = [bag[j], bag[i]];
  }
  const st: State = {
    v: 2, cfg,
    board: { '0,0': { k: 'start', r: 0, n: 0, p: null } },
    bars: {}, meeples: [], scored: {}, standDone: {},
    bag, discards: [], hands: cfg.players.map(() => []),
    players: cfg.players.map(() => ({ score: 0, meeples: cfg.meeples, stats: newStats() })),
    barsLeft: barCount(cfg), serial: 0, mid: 0, ts: 0, turnNo: 0,
    turn: { p: 0, placed: null, meeple: null, bar: null, resolved: false },
    over: false, final: null, measures: [], log: [],
  };
  st.turnNo = 0;
  for (let c = 0; c < cfg.handSize; c++) st.hands.forEach((h) => { if (st.bag.length) h.push(st.bag.pop()!); });
  st.log!.push({ t: 0, type: 'start', seed: cfg.seed });
  startTurn(st, 0);
  return st;
}

function startTurn(st: State, p: number) {
  st.turnNo++;
  st.turn = { p, placed: null, meeple: null, bar: null, resolved: false };
  st.players[p].stats.turns++;
}

export const isStrict = (st: State) => !!LEVELS[st.cfg.level].strict;
export const tileAt = (st: State, x: number, y: number): Tile | undefined => st.board[cellKey(x, y)];
export const geomOf = (t: Tile): Geom => GEOM[t.k][t.r];

// ── 이음새 ───────────────────────────────────────────────────────────
/** 칸 (x,y)의 d쪽 변 → 이음새 키. 'v' = 칸의 왼쪽 변(세로), 'h' = 칸의 위쪽 변(가로) */
export function seamKey(x: number, y: number, d: number): string {
  switch (d) {
    case N: return `h${x},${y}`;
    case S: return `h${x},${y + 1}`;
    case W: return `v${x},${y}`;
    default: return `v${x + 1},${y}`;
  }
}
export function seamCells(sk: string): { x: number; y: number; d: Dir }[] {
  const [x, y] = sk.slice(1).split(',').map(Number);
  if (sk[0] === 'h') return [{ x, y: y - 1, d: S }, { x, y, d: N }];
  return [{ x: x - 1, y, d: E }, { x, y, d: W }];
}
export function seamSides(st: State, sk: string): { x: number; y: number; pi: number }[] {
  const out: { x: number; y: number; pi: number }[] = [];
  for (const c of seamCells(sk)) {
    const t = tileAt(st, c.x, c.y);
    if (!t) continue;
    const pi = geomOf(t).pieceAt[c.d];
    if (pi >= 0) out.push({ x: c.x, y: c.y, pi });
  }
  return out;
}

// ── 마디(연결된 리듬선 한 줄) 추적 ──────────────────────────────────────
export interface SegEnd { kind: 'bar' | 'open' | 'dead'; internal?: boolean; seam?: string; x: number; y: number; d?: number; pi?: number }
export interface Segment {
  id: string; pieces: { x: number; y: number; pi: number }[]; ends: SegEnd[];
  closed: boolean; loop: boolean; sum: number; notes: number; rests: number;
}

/**
 * (x,y)의 pi번 조각이 속한 마디. 리듬선은 갈라지지 않으므로 한 줄(또는 고리).
 * skipSeam: 이 이음새의 막대는 없는 것으로 본다(지휘자 자격은 마디줄을 꽂기 전 기준).
 * extraSeam: 이 이음새에 막대가 있다고 가정한다(막대 꽂기 시뮬레이션).
 */
export function segmentOf(st: State, x0: number, y0: number, pi0: number, opts: { skipSeam?: string | null; extraSeam?: string | null } = {}): Segment {
  const skip = opts.skipSeam || null;
  const extra = opts.extraSeam || null;
  const seen = new Set<number>(); // 숫자 키 (문자열보다 빠름)
  const pieces: Segment['pieces'] = [];
  const ends: SegEnd[] = [];
  let sum = 0, notes = 0, rests = 0;
  let minKey = Infinity, minPiece = { x: x0, y: y0, pi: pi0 };
  const stack: [number, number, number][] = [[x0, y0, pi0]];
  while (stack.length) {
    const [x, y, pi] = stack.pop()!;
    const nk = ((x + 2048) * 4096 + (y + 2048)) * 4 + pi;
    if (seen.has(nk)) continue;
    seen.add(nk);
    if (nk < minKey) { minKey = nk; minPiece = { x, y, pi }; }
    const t = tileAt(st, x, y)!;
    const pc = geomOf(t).pieces[pi];
    pieces.push({ x, y, pi });
    sum += pc.beats;
    if (pc.note) notes++;
    if (pc.rest) rests++;
    for (const e of pc.ends) {
      if (e === 'bar') { ends.push({ kind: 'bar', internal: true, x, y, pi }); continue; }
      const sk = seamKey(x, y, e);
      const barred = sk === extra || (!!st.bars[sk] && sk !== skip);
      if (barred) { ends.push({ kind: 'bar', seam: sk, x, y, d: e, pi }); continue; }
      const nx = x + DXY[e][0], ny = y + DXY[e][1];
      const nt = tileAt(st, nx, ny);
      if (!nt) { ends.push({ kind: 'open', seam: sk, x, y, d: e, pi }); continue; }
      const npi = geomOf(nt).pieceAt[opp(e)];
      if (npi < 0) { ends.push({ kind: 'dead', seam: sk, x, y, d: e, pi }); continue; }
      stack.push([nx, ny, npi]);
    }
  }
  const closed = ends.length > 0 && ends.every((e) => e.kind === 'bar');
  const id = pieceKey(minPiece.x, minPiece.y, minPiece.pi); // 같은 마디면 어디서 시작해도 같은 id
  return { id, pieces, ends, closed, loop: ends.length === 0, sum, notes, rests };
}

export function allSegments(st: State): Segment[] {
  const seen = new Set<string>();
  const out: Segment[] = [];
  for (const [ck, t] of Object.entries(st.board)) {
    const [x, y] = ck.split(',').map(Number);
    geomOf(t).pieces.forEach((_, pi) => {
      if (seen.has(pieceKey(x, y, pi))) return;
      const seg = segmentOf(st, x, y, pi);
      seg.pieces.forEach((p) => seen.add(pieceKey(p.x, p.y, p.pi)));
      out.push(seg);
    });
  }
  return out;
}

export function meeplesIn(st: State, seg: Segment): Meeple[] {
  const set = new Set(seg.pieces.map((p) => pieceKey(p.x, p.y, p.pi)));
  return st.meeples.filter((m) => m.f !== 's' && set.has(pieceKey(m.x, m.y, m.f as number)));
}

export function majority(ms: { p: number }[]): number[] {
  const counts: Record<number, number> = {};
  ms.forEach((m) => { counts[m.p] = (counts[m.p] || 0) + 1; });
  const max = Math.max(0, ...Object.values(counts));
  if (max === 0) return [];
  return Object.keys(counts).filter((p) => counts[+p] === max).map(Number).sort((a, b) => a - b);
}

// ── 박자표 (Lv2) ─────────────────────────────────────────────────────
/**
 * 마디 끝에서 리듬선을 따라 뒤로 가며 '이 마디 쪽을 향한' 가장 가까운 박자표를 찾는다.
 * - 박자표 타일은 가운데 마디줄 + 한쪽에 숫자. 숫자가 적힌 쪽 마디부터 적용되고 다음 박자표까지 이어진다.
 * - 시작 타일(4/4)은 양쪽 모두에 적용된다.
 * - 박자표의 뒤쪽(숫자 없는 쪽)이나 열린 끝을 만나면 그 방향에는 박자표가 없다.
 */
function walkTarget(st: State, seg: Segment, end: SegEnd): { dist: number; value: number } | null {
  let dist = 0;
  let cur = seg;
  let curEnd = end;
  const seen = new Set<string>([seg.id]);
  for (let guard = 0; guard < 200; guard++) {
    if (curEnd.kind !== 'bar') return null;
    if (curEnd.internal) {
      const t = tileAt(st, curEnd.x, curEnd.y)!;
      const g = geomOf(t);
      if (g.ts == null) return null;
      if (g.face === -1) return { dist, value: g.ts };
      const edge = g.pieces[curEnd.pi!].ends.find((e) => e !== 'bar');
      return edge === g.face ? { dist, value: g.ts } : null;
    }
    const inCur = new Set(cur.pieces.map((p) => pieceKey(p.x, p.y, p.pi)));
    const other = seamSides(st, curEnd.seam!).find((s) => !inCur.has(pieceKey(s.x, s.y, s.pi)));
    if (!other) return null;
    const next = segmentOf(st, other.x, other.y, other.pi);
    if (seen.has(next.id)) return null;
    seen.add(next.id);
    const far = next.ends.find((e) => !(e.kind === 'bar' && e.seam === curEnd.seam));
    if (!far) return null;
    dist++;
    cur = next;
    curEnd = far;
  }
  return null;
}

/** 이 마디의 목표 박 수(들). 보통 하나. 서로 다른 박자표가 같은 거리에서 마주 보면 둘 다 정답으로 인정 */
export function targetsOf(st: State, seg: Segment): number[] {
  const def = st.cfg.target;
  if (!st.ts) return [def];
  const cands = seg.ends.map((e) => walkTarget(st, seg, e)).filter((c): c is { dist: number; value: number } => !!c);
  if (!cands.length) return [def];
  const minD = Math.min(...cands.map((c) => c.dist));
  return [...new Set(cands.filter((c) => c.dist === minD).map((c) => c.value))].sort((a, b) => a - b);
}
export const targetOf = (st: State, seg: Segment) => targetsOf(st, seg)[0];

function badClose(st: State, seg: Segment): boolean {
  if (seg.notes + seg.rests === 0) return true; // 빈 마디
  const tg = targetsOf(st, seg);
  if (isStrict(st) && !tg.includes(seg.sum)) return true; // Lv0: 정확히 맞을 때만
  if (st.cfg.noUnderClose && seg.sum < Math.min(...tg)) return true; // 옵션: 덜 찬 마디 닫기 금지
  return false;
}

/** 마디의 조각을 리듬선 순서대로 (왼쪽·위쪽 끝에서 시작) */
export function orderPieces(st: State, seg: Segment): OrderItem[] {
  const inSeg = new Set(seg.pieces.map((p) => pieceKey(p.x, p.y, p.pi)));
  const nbrs = (p: { x: number; y: number; pi: number }) => {
    const t = tileAt(st, p.x, p.y)!;
    const pc = geomOf(t).pieces[p.pi];
    const out: { x: number; y: number; pi: number }[] = [];
    for (const e of pc.ends) {
      if (e === 'bar') continue;
      if (st.bars[seamKey(p.x, p.y, e)]) continue;
      const nx = p.x + DXY[e][0], ny = p.y + DXY[e][1];
      const nt = tileAt(st, nx, ny);
      if (!nt) continue;
      const npi = geomOf(nt).pieceAt[opp(e)];
      if (npi >= 0 && inSeg.has(pieceKey(nx, ny, npi))) out.push({ x: nx, y: ny, pi: npi });
    }
    return out;
  };
  let cands = seg.pieces.filter((p) => nbrs(p).length < 2);
  if (!cands.length) cands = seg.pieces.slice();
  cands.sort((a, b) => a.x - b.x || a.y - b.y || a.pi - b.pi);
  const out: { x: number; y: number; pi: number }[] = [];
  const vis = new Set<string>();
  let cur: { x: number; y: number; pi: number } | undefined = cands[0];
  while (cur) {
    vis.add(pieceKey(cur.x, cur.y, cur.pi));
    out.push(cur);
    cur = nbrs(cur).find((n) => !vis.has(pieceKey(n.x, n.y, n.pi)));
  }
  return out.map((p) => {
    const t = tileAt(st, p.x, p.y)!;
    const pc = geomOf(t).pieces[p.pi];
    return { x: p.x, y: p.y, pi: p.pi, k: t.k, beats: pc.beats, note: pc.note, rest: pc.rest };
  });
}

// ── ① 타일 놓기 ───────────────────────────────────────────────────────
/** 변 규칙: 최소 한 변이 맞닿고, 맞닿은 모든 변이 리듬선↔리듬선 / 배경↔배경 */
export function fitsAt(st: State, k: KindId, r: number, x: number, y: number): boolean {
  if (tileAt(st, x, y)) return false;
  const g = GEOM[k][r];
  let touching = 0;
  for (let d = 0; d < 4; d++) {
    const nt = tileAt(st, x + DXY[d][0], y + DXY[d][1]);
    if (!nt) continue;
    touching++;
    if (geomOf(nt).edges[opp(d)] !== g.edges[d]) return false;
  }
  return touching > 0;
}

/** 변 규칙 + 마디 규칙(빈 마디 금지, Lv0 정확히 맞을 때만, 옵션: 덜 찬 마디 닫기 금지) */
export function canPlace(st: State, k: KindId, r: number, x: number, y: number): boolean {
  if (!fitsAt(st, k, r, x, y)) return false;
  const ck = cellKey(x, y);
  const isTs = kindOf(k).shape === 'timesig';
  st.board[ck] = { k, r, n: -1, p: null };
  if (isTs) st.ts++;
  let ok = true;
  const g = GEOM[k][r];
  for (let pi = 0; pi < g.pieces.length && ok; pi++) {
    const seg = segmentOf(st, x, y, pi);
    if (seg.closed && badClose(st, seg)) ok = false;
  }
  delete st.board[ck];
  if (isTs) st.ts--;
  return ok;
}

export function frontier(st: State): { x: number; y: number }[] {
  const out = new Map<string, { x: number; y: number }>();
  for (const ck of Object.keys(st.board)) {
    const [x, y] = ck.split(',').map(Number);
    for (const [dx, dy] of DXY) {
      const nk = cellKey(x + dx, y + dy);
      if (!st.board[nk] && !out.has(nk)) out.set(nk, { x: x + dx, y: y + dy });
    }
  }
  return [...out.values()];
}

export interface Placement { x: number; y: number; rots: number[] }
export function placements(st: State, k: KindId): Placement[] {
  const out: Placement[] = [];
  for (const c of frontier(st)) {
    const rots = ROTATIONS[k].filter((r) => canPlace(st, k, r, c.x, c.y));
    if (rots.length) out.push({ x: c.x, y: c.y, rots });
  }
  return out;
}

export function hasAnyPlacement(st: State, p: number): boolean {
  return [...new Set(st.hands[p])].some((k) => placements(st, k).length > 0);
}

export function applyPlace(st: State, hi: number, x: number, y: number, r: number) {
  const T = st.turn;
  if (!T || T.placed || st.over) throw new Error('지금은 타일을 놓을 수 없습니다');
  const k = st.hands[T.p][hi];
  if (k == null) throw new Error('손패에 없는 타일입니다');
  if (!canPlace(st, k, r, x, y)) throw new Error('그 자리에는 놓을 수 없습니다');
  st.hands[T.p].splice(hi, 1);
  st.serial++;
  st.board[cellKey(x, y)] = { k, r, n: st.serial, p: T.p };
  if (kindOf(k).shape === 'timesig') st.ts++;
  T.placed = { x, y, k, r };
}

// ── ② 지휘자 ─────────────────────────────────────────────────────────
export function conductorSpots(st: State): Spot[] {
  const T = st.turn;
  if (!T || !T.placed || T.meeple || T.resolved) return [];
  if (st.players[T.p].meeples <= 0) return [];
  const { x, y } = T.placed;
  const t = tileAt(st, x, y)!;
  const spots: Spot[] = [];
  geomOf(t).pieces.forEach((pc, pi) => {
    if (pc.beats === 0 && !kindOf(t.k).thru) return; // 박자표 타일의 반쪽은 음표가 없어 찜할 수 없음
    const seg = segmentOf(st, x, y, pi, { skipSeam: T.bar });
    if (meeplesIn(st, seg).length === 0) spots.push({ x, y, f: pi });
  });
  if (kindOf(t.k).stand) spots.push({ x, y, f: 's' });
  return spots;
}

export function applyConductor(st: State, spot: Spot) {
  const T = st.turn;
  if (!conductorSpots(st).some((s) => s.f === spot.f)) throw new Error('그 자리에는 지휘자를 올릴 수 없습니다');
  st.meeples.push({ p: T.p, x: spot.x, y: spot.y, f: spot.f, t: st.turnNo });
  st.players[T.p].meeples--;
  T.meeple = { x: spot.x, y: spot.y, f: spot.f };
}

export function removeConductor(st: State) {
  const T = st.turn;
  if (!T || !T.meeple || T.resolved) return;
  const m0 = T.meeple;
  const i = st.meeples.findIndex((m) => m.t === st.turnNo && m.p === T.p && m.x === m0.x && m.y === m0.y && m.f === m0.f);
  if (i >= 0) st.meeples.splice(i, 1);
  st.players[T.p].meeples++;
  T.meeple = null;
}

// ── ③ 마디줄 막대 ────────────────────────────────────────────────────
function barLegal(st: State, sk: string): boolean {
  if (st.bars[sk]) return false;
  const sides = seamSides(st, sk);
  if (!sides.length) return false;
  for (const s of sides) if (st.scored[pieceKey(s.x, s.y, s.pi)]) return false; // 이미 정산된 마디 안
  for (const s of sides) {
    const seg = segmentOf(st, s.x, s.y, s.pi, { extraSeam: sk });
    if (seg.closed && badClose(st, seg)) return false;
  }
  return true;
}

/** 방금 놓은 타일과 그 상하좌우 타일의 리듬선 이음새 (대각선 불가) */
export function barSpots(st: State): { seam: string }[] {
  const T = st.turn;
  if (!T || !T.placed || T.bar || T.resolved || st.barsLeft <= 0) return [];
  const { x, y } = T.placed;
  const cells = [[x, y], [x, y - 1], [x + 1, y], [x, y + 1], [x - 1, y]];
  const seen = new Set<string>();
  const out: { seam: string }[] = [];
  for (const [cx, cy] of cells) {
    const t = tileAt(st, cx, cy);
    if (!t) continue;
    const g = geomOf(t);
    for (let d = 0; d < 4; d++) {
      if (!g.edges[d]) continue;
      const sk = seamKey(cx, cy, d);
      if (seen.has(sk)) continue;
      seen.add(sk);
      if (barLegal(st, sk)) out.push({ seam: sk });
    }
  }
  return out;
}

export function applyBar(st: State, sk: string) {
  const T = st.turn;
  if (!barSpots(st).some((b) => b.seam === sk)) throw new Error('그 이음새에는 마디줄을 꽂을 수 없습니다');
  st.bars[sk] = { p: T.p, t: st.turnNo };
  st.barsLeft--;
  T.bar = sk;
}

export function removeBar(st: State) {
  const T = st.turn;
  if (!T || !T.bar || T.resolved) return;
  delete st.bars[T.bar];
  st.barsLeft++;
  T.bar = null;
}

// ── ④ 정산 ───────────────────────────────────────────────────────────
export function standFilled(st: State, x: number, y: number): number {
  let n = 0;
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (tileAt(st, x + dx, y + dy)) n++;
  return n;
}

function scoreMeasure(st: State, seg: Segment, closer: number | null, isEnd = false): MeasureEvent {
  const targets = targetsOf(st, seg);
  const ok = targets.includes(seg.sum);
  const target = ok ? seg.sum : targets[0];
  const ms = meeplesIn(st, seg);
  const winners = majority(ms);
  let points = 0;
  if (!isEnd) points = ok ? seg.notes * 2 + seg.rests : 0;
  else if (st.cfg.softEnd && seg.sum <= Math.max(...targets) && seg.notes + seg.rests > 0) points = seg.notes + seg.rests;
  winners.forEach((p) => {
    st.players[p].score += points;
    if (!isEnd) {
      st.players[p].stats.measurePts += points;
      if (ok) st.players[p].stats.measuresWon++;
    } else st.players[p].stats.endPts += points;
  });
  ms.forEach((m) => { st.players[m.p].meeples++; });
  st.meeples = st.meeples.filter((m) => !ms.includes(m));
  const order = orderPieces(st, seg);
  const rec: MeasureEvent = {
    type: isEnd ? 'openMeasure' : 'measure', id: 0, turn: st.turnNo, closer: isEnd ? null : closer,
    ok, sum: seg.sum, target, targets, notes: seg.notes, rests: seg.rests, points, winners,
    returned: ms.map((m) => ({ p: m.p, x: m.x, y: m.y, f: m.f })), order,
  };
  if (!isEnd) {
    st.mid++;
    rec.id = st.mid;
    seg.pieces.forEach((pc) => { st.scored[pieceKey(pc.x, pc.y, pc.pi)] = rec.id; });
    if (closer != null) st.players[closer].stats[ok ? 'closedOk' : 'closedWrong']++;
    st.measures.push(rec);
  }
  st.log?.push({
    t: st.turnNo, type: rec.type, id: rec.id, ok, sum: seg.sum, target, targets, points, winners, closer: rec.closer,
    terms: order.filter((o) => o.note || o.rest).map((o) => (o.rest ? -o.beats : o.beats)),
  });
  return rec;
}

function scoreStand(st: State, x: number, y: number, isEnd = false): StandEvent {
  const m = st.meeples.find((z) => z.f === 's' && z.x === x && z.y === y);
  const filled = standFilled(st, x, y);
  const points = m ? (isEnd ? filled : 9) : 0;
  if (!isEnd) st.standDone[cellKey(x, y)] = true;
  if (m) {
    st.players[m.p].score += points;
    st.players[m.p].stats[isEnd ? 'endPts' : 'standPts'] += points;
    st.players[m.p].meeples++;
    st.meeples = st.meeples.filter((z) => z !== m);
  }
  const rec: StandEvent = { type: isEnd ? 'openStand' : 'stand', x, y, owner: m ? m.p : null, points, filled };
  st.log?.push({ t: st.turnNo, type: rec.type, owner: rec.owner, points, filled });
  return rec;
}

/** 이번 차례 정산: 새로 닫힌 마디 + 새로 둘러싸인 지휘대 */
export function resolveTurn(st: State): GameEvent[] {
  const T = st.turn;
  if (!T || T.resolved) return [];
  T.resolved = true;
  if (!T.placed) return [];
  const { x, y } = T.placed;
  st.log?.push({ t: st.turnNo, type: 'turn', p: T.p, k: T.placed.k, meeple: T.meeple ? (T.meeple.f === 's' ? 'stand' : 'line') : null, bar: !!T.bar });
  const events: GameEvent[] = [];
  const starts: [number, number, number][] = [];
  const t = tileAt(st, x, y)!;
  geomOf(t).pieces.forEach((_, pi) => starts.push([x, y, pi]));
  if (T.bar) for (const s of seamSides(st, T.bar)) starts.push([s.x, s.y, s.pi]);
  const done = new Set<string>();
  for (const [sx, sy, spi] of starts) {
    if (st.scored[pieceKey(sx, sy, spi)]) continue;
    const seg = segmentOf(st, sx, sy, spi);
    if (done.has(seg.id)) continue;
    done.add(seg.id);
    if (seg.closed) events.push(scoreMeasure(st, seg, T.p));
  }
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const cx = x + dx, cy = y + dy;
      const ct = tileAt(st, cx, cy);
      if (!ct || !kindOf(ct.k).stand || st.standDone[cellKey(cx, cy)]) continue;
      if (standFilled(st, cx, cy) === 9) events.push(scoreStand(st, cx, cy));
    }
  }
  return events;
}

/** ⑤ 손 채우기 → 다음 사람. 남은 타일이 없으면 게임 끝 정산 이벤트 */
export function advance(st: State): GameEvent[] {
  const p = st.turn.p;
  while (st.hands[p].length < st.cfg.handSize && st.bag.length) st.hands[p].push(st.bag.pop()!);
  const n = st.players.length;
  for (let i = 1; i <= n; i++) {
    const q = (p + i) % n;
    if (st.hands[q].length > 0) { startTurn(st, q); return []; }
  }
  return finalScoring(st);
}

export function endTurn(st: State): GameEvent[] {
  return [...resolveTurn(st), ...advance(st)];
}

/** 손패 어느 타일도 놓을 곳이 없을 때: 한 장을 공개해 빼 두고 새로 뽑는다 */
export function discardForNoMove(st: State, hi: number): { ended: boolean; events: GameEvent[] } {
  const T = st.turn;
  const k = st.hands[T.p].splice(hi, 1)[0];
  st.discards.push(k);
  st.log?.push({ t: st.turnNo, type: 'discard', p: T.p, k });
  if (st.bag.length) st.hands[T.p].push(st.bag.pop()!);
  if (st.hands[T.p].length === 0) {
    T.resolved = true;
    return { ended: true, events: advance(st) };
  }
  return { ended: false, events: [] };
}

// ── 게임 끝 ──────────────────────────────────────────────────────────
export function finalScoring(st: State): GameEvent[] {
  st.over = true;
  const events: GameEvent[] = [];
  const done = new Set<string>();
  for (const m of [...st.meeples]) {
    if (m.f === 's' || !st.meeples.includes(m)) continue;
    const seg = segmentOf(st, m.x, m.y, m.f as number);
    if (done.has(seg.id)) continue;
    done.add(seg.id);
    events.push(scoreMeasure(st, seg, null, true));
  }
  for (const m of [...st.meeples]) if (m.f === 's') events.push(scoreStand(st, m.x, m.y, true));
  st.final = ranking(st);
  st.log?.push({ t: st.turnNo, type: 'final' });
  return events;
}

export function ranking(st: State) {
  const rows = st.players.map((pl, i) => ({ p: i, score: pl.score, won: pl.stats.measuresWon, rank: 0 }));
  rows.sort((a, b) => b.score - a.score || b.won - a.won || a.p - b.p);
  rows.forEach((r, i) => {
    const prev = rows[i - 1];
    r.rank = i > 0 && prev.score === r.score && prev.won === r.won ? prev.rank : i + 1;
  });
  return rows;
}

// ── 기타 ─────────────────────────────────────────────────────────────
export function recordQuiz(st: State, p: number, ok: boolean) {
  st.players[p].stats.quizTotal++;
  if (ok) st.players[p].stats.quizOk++;
}
export function addTurnTime(st: State, p: number, ms: number) {
  st.players[p].stats.turnMs += Math.max(0, ms);
}
export function clone(st: State, withLog = true): State {
  if (withLog) return JSON.parse(JSON.stringify(st));
  const { log, measures, ...rest } = st;
  const c = JSON.parse(JSON.stringify(rest)) as State;
  c.log = null;
  c.measures = [];
  return c;
}

/**
 * 컴퓨터 시뮬레이션용 빠른 복사. 엔진은 타일·막대·지휘자 객체와 cfg를 고쳐 쓰지 않고 새로 만들어 넣으므로
 * 그 객체들은 함께 쓰고, 바뀌는 묶음(객체·배열)만 새로 만든다. 기록(log·measures)은 빼고 복사한다.
 */
export function fastClone(st: State): State {
  return {
    ...st,
    board: { ...st.board },
    bars: { ...st.bars },
    meeples: st.meeples.slice(),
    scored: { ...st.scored },
    standDone: { ...st.standDone },
    bag: st.bag.slice(),
    discards: st.discards.slice(),
    hands: st.hands.map((h) => h.slice()),
    players: st.players.map((p) => ({ score: p.score, meeples: p.meeples, stats: { ...p.stats } })),
    turn: { ...st.turn },
    log: null,
    measures: [],
  };
}

/** 이 세트·난이도에 들어 있는 타일 종류별 장수 (시작 타일 제외) */
export function setCountsOf(cfg: Pick<Config, 'set' | 'level'>): Partial<Record<KindId, number>> {
  return setCounts(cfg);
}
export const tilesRemaining = (st: State) => st.bag.length + st.hands.reduce((a, h) => a + h.length, 0);

/** 저장본 호환: 0단계(v1) 저장 상태를 v2로 */
export function migrate(st: State): State {
  if (st.ts == null) st.ts = Object.values(st.board).filter((t) => kindOf(t.k).shape === 'timesig').length;
  if (!st.v || st.v < 2) st.v = 2;
  return st;
}
