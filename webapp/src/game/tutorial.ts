/* 첫 판 튜토리얼: 설계서 13장 샘플(1 + 2 + 1 = 4박 → 6점)을 직접 놓아 보며 배운다.
 * 각 단계는 허용하는 행동 하나만 받는다. */
import type { KindId, PlayerCfg } from '../engine/engine';

export type Expect =
  | { kind: 'next' }
  | { kind: 'choice'; options: string[]; answer: number; wrong: string }
  | { kind: 'cell'; x: number; y: number }
  | { kind: 'place' }
  | { kind: 'meeple' }
  | { kind: 'bar'; seam: string }
  | { kind: 'end' }
  | { kind: 'auto' }
  | { kind: 'quiz' };

export interface TutStep {
  id: string;
  title: string;
  text: string;
  expect: Expect;
  /** 눌러야 할 버튼 id (깜빡임 표시) */
  target?: string;
  /** 이 단계에서 손패에서 골라 둘 타일 */
  select?: KindId;
}

export const TUT_PLAYERS: PlayerCfg[] = [
  { name: '나', type: 'human', color: 0 },
  { name: '컴퓨터', type: 'ai', color: 1 },
];
export const TUT_HANDS: KindId[][] = [
  ['q-s', 'h-c', 'q-s'],
  ['h-s', 'q-c', 'q-s'],
];
/** 컴퓨터 차례에 둘 수 (설계서 13장 그대로) */
export const TUT_AI_MOVE = { k: 'h-s' as KindId, x: 2, y: 0, r: 0 };

export const TUT_STEPS: TutStep[] = [
  {
    id: 'intro', title: '리듬마을에 온 걸 환영해요',
    text: '음표 타일을 이어 붙여 박자의 합이 딱 4박인 마디를 만들면 점수를 얻어요. 가운데 초록 타일이 시작 타일이에요. 세로 막대(마디줄)가 마디의 시작이에요.',
    expect: { kind: 'next' },
  },
  {
    id: 'cell1', title: '타일 놓을 자리 고르기',
    text: '손패에서 4분음표(1박)가 골라져 있어요. 시작 타일 오른쪽의 점선 칸을 눌러 보세요.',
    expect: { kind: 'cell', x: 1, y: 0 }, select: 'q-s',
  },
  {
    id: 'place1', title: '놓기',
    text: '리듬선이 시작 타일과 이어졌어요. ‘여기에 놓기’를 누르면 확정돼요.',
    expect: { kind: 'place' }, target: 'aPlace',
  },
  {
    id: 'meeple', title: '지휘자로 찜하기',
    text: '흐린 지휘자를 누르면 이 마디를 찜해요. 마디가 4박으로 완성되면 찜한 사람이 점수를 받아요.',
    expect: { kind: 'meeple' },
  },
  {
    id: 'end1', title: '차례 끝',
    text: '이번 차례는 여기까지예요. ‘차례 끝내기’를 누르세요.',
    expect: { kind: 'end' }, target: 'aEnd',
  },
  {
    id: 'ai', title: '컴퓨터 차례',
    text: '컴퓨터가 타일을 고르는 중이에요…',
    expect: { kind: 'auto' },
  },
  {
    id: 'count', title: '지금 몇 박?',
    text: '컴퓨터가 2분음표(2박)를 이었어요. 이 마디는 지금 1 + 2 = 3박. 4박이 되려면 몇 박이 더 필요할까요?',
    expect: { kind: 'choice', options: ['1박', '2박', '3박'], answer: 0, wrong: '4 − 3을 계산해 보세요.' },
  },
  {
    id: 'cell2', title: '1박 채우기',
    text: '맞아요, 1박! 4분음표가 골라져 있어요. 2분음표 오른쪽 점선 칸을 누르고 ‘여기에 놓기’를 누르세요.',
    expect: { kind: 'cell', x: 3, y: 0 }, select: 'q-s',
  },
  {
    id: 'place2', title: '놓기',
    text: '‘여기에 놓기’를 누르세요.',
    expect: { kind: 'place' }, target: 'aPlace',
  },
  {
    id: 'bar', title: '마디줄로 닫기',
    text: '1 + 2 + 1 = 4박이 됐어요. 오른쪽 끝의 점선 동그라미를 눌러 마디줄을 꽂으면 마디가 닫혀요.',
    expect: { kind: 'bar', seam: 'v4,0' },
  },
  {
    id: 'end2', title: '계산하기',
    text: '‘차례 끝내기’를 누르면 닫힌 마디를 계산해요. 몇 박인지 먼저 맞혀 보세요!',
    expect: { kind: 'end' }, target: 'aEnd',
  },
  {
    id: 'quiz', title: '검산', text: '', expect: { kind: 'quiz' },
  },
];
