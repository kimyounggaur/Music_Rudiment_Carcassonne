/* 룰북 삽화 모음 — 그림 id → 그림 만들기. 어느 그림이 어느 장 어디에 들어가는지는 ui/Rulebook.tsx가 정한다. */
import * as SKIN from './skin';
import type { Fig } from './rulebook';
import * as B from './figsBasics';
import * as P from './figsPlay';
import * as L from './figsLevels';
import * as S from './figsSample';
import * as A from './figsApp';

export type FigId =
  | 'intro-loop'
  | 'parts-anatomy' | 'parts-kinds' | 'parts-tokens' | 'parts-counts'
  | 'beats-ruler' | 'beats-make4'
  | 'edge-rule' | 'edge-corner' | 'edge-rotate' | 'edge-fit' | 'edge-open' | 'edge-nofork'
  | 'setup-table' | 'setup-start'
  | 'turn-flow' | 'turn-place' | 'turn-choose' | 'turn-conductor' | 'turn-bar' | 'turn-bar-keep' | 'turn-settle' | 'turn-nomove'
  | 'score-overview' | 'score-ok' | 'score-wrong' | 'score-block' | 'score-majority' | 'score-merge' | 'score-stand'
  | 'end-trigger' | 'end-score' | 'end-rank'
  | 'levels-ladder' | 'levels-lv0'
  | 'lv2-values' | 'lv2-add' | 'lv2-rest' | 'lv2-ts' | 'lv2-ts-flow' | 'lv2-ts-meet'
  | 'sample-1' | 'sample-2' | 'sample-3' | 'sample-4' | 'sample-wrong'
  | 'app-screen' | 'app-keys' | 'app-board' | 'app-quiz' | 'app-skins'
  | 'faq-bar-no' | 'faq-bar-under';

const BUILDERS: Record<FigId, () => Fig> = {
  'intro-loop': B.introLoop,
  'parts-anatomy': B.partsAnatomy, 'parts-kinds': B.partsKinds, 'parts-tokens': B.partsTokens, 'parts-counts': B.partsCounts,
  'beats-ruler': B.beatsRuler, 'beats-make4': B.beatsMake4,
  'edge-rule': B.edgeRule, 'edge-corner': B.edgeCorner, 'edge-rotate': B.edgeRotate, 'edge-fit': B.edgeFit, 'edge-open': B.edgeOpen, 'edge-nofork': B.edgeNoFork,
  'setup-table': P.setupTable, 'setup-start': P.setupStart,
  'turn-flow': P.turnFlow, 'turn-place': P.turnPlace, 'turn-choose': P.turnChoose, 'turn-conductor': P.turnConductor, 'turn-bar': P.turnBar,
  'turn-bar-keep': P.turnBarKeep, 'turn-settle': P.turnSettle, 'turn-nomove': P.turnNomove,
  'score-overview': P.scoreOverview, 'score-ok': P.scoreOk, 'score-wrong': P.scoreWrong, 'score-block': P.scoreBlock, 'score-majority': P.scoreMajority, 'score-merge': P.scoreMerge, 'score-stand': P.scoreStand,
  'end-trigger': P.endTrigger, 'end-score': P.endScore, 'end-rank': P.endRank,
  'levels-ladder': L.levelsLadder, 'levels-lv0': L.levelsLv0,
  'lv2-values': L.lv2Values, 'lv2-add': L.lv2Add, 'lv2-rest': L.lv2Rest, 'lv2-ts': L.lv2Ts, 'lv2-ts-flow': L.lv2TsFlow, 'lv2-ts-meet': L.lv2TsMeet,
  'sample-1': S.sample1, 'sample-2': S.sample2, 'sample-3': S.sample3, 'sample-4': S.sample4, 'sample-wrong': S.sampleWrong,
  'app-screen': A.appScreen, 'app-keys': A.appKeys, 'app-board': A.appBoard, 'app-quiz': A.appQuiz, 'app-skins': A.appSkins,
  'faq-bar-no': A.faqBarNo, 'faq-bar-under': A.faqBarUnder,
};

const cache = new Map<string, Fig>();
/** 그림 한 장 (테마가 바뀌면 다시 그린다) */
export function buildFig(id: FigId): Fig {
  const key = `${id}|${SKIN.getSkin()}`;
  let f = cache.get(key);
  if (!f) { f = BUILDERS[id](); cache.set(key, f); }
  return f;
}
export const FIG_IDS = Object.keys(BUILDERS) as FigId[];
