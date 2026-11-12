# 리듬마을 웹앱 — 2단계 소스

음표 타일을 이어 4박 마디를 완성하는 카르카손형 음악 보드게임 '리듬마을'의 웹앱입니다.
Vite + React 18 + TypeScript. 규칙 엔진은 화면과 분리된 순수 함수입니다.

## 준비

- Node.js 18 이상 (20 권장)
- 이 폴더에서 `npm install`

## 명령

| 명령 | 하는 일 |
|---|---|
| `npm run dev` | 개발 서버 (http://localhost:5173). 코드를 고치면 바로 반영 |
| `npm test` | 자동 테스트 57개: 규칙 엔진·컴퓨터(무작위 대국 360판 포함) + 학습 퍼즐(단원 36문제·생성 문제 900개) + 룰북(삽화 숫자가 엔진과 같은지·글과 그림 배치) |
| `npm run typecheck` | 타입 검사 |
| `npm run build:artifact` | Claude 아티팩트용 HTML 한 파일 → `dist-artifact/rhythm-village.html` |
| `npm run build:web` | 설치형(PWA, 오프라인) 폴더 → `dist-web/` |
| `npm run preview` | `dist-web/`을 로컬에서 열어 보기 (설치·오프라인 확인용) |
| `npm run ai:match -- --a hard --b normal --games 100` | 컴퓨터끼리 맞붙여 실력 비교 (옵션: `--players 3 --level 2 --set full`) |
| `npm run icons` | 앱 아이콘 다시 만들기. Playwright 필요: `npm i -D playwright && npx playwright install chromium` (아이콘은 이미 `public/icons`에 들어 있음) |

## 폴더

| 위치 | 내용 |
|---|---|
| `src/engine/engine.ts` | 규칙 전부: 타일 카탈로그(Lv2 포함), 변 맞추기, 마디 추적, 박자표 목표, 지휘자·마디줄, 정산 |
| `src/engine/ai.ts` | 컴퓨터 (쉬움 / 보통 / 어려움). 생성기라 나눠서 계산할 수 있음 |
| `src/engine/ai.worker.ts` | 컴퓨터 계산 전용 워커 (설치형 빌드) |
| `src/engine/engine.test.ts` | 자동 테스트 |
| `src/art/tiles.ts` | 카드 테마 타일·지휘자·마디줄 SVG, 공통 기하 |
| `src/art/village.ts` | 음악 마을 테마(기본) 그림 |
| `src/art/skin.ts` | 테마 고르기 (그림은 모두 이 모듈을 거침) |
| `src/art/rulebook*.ts`, `src/art/figs*.ts` | 룰북 삽화 53장: 엔진 상태를 SVG로 그리는 도구(`rulebook.ts`·`rulebookKit.ts`)와 장별 그림, 그림 id 목록(`rulebookFigs.ts`) |
| `src/game/controller.ts` | 게임 진행: 차례 흐름, 컴퓨터 연출, 정산·검산 퀴즈, 저장·이어하기 |
| `src/game/tutorial.ts` | 첫 판 튜토리얼 단계 |
| `src/game/puzzle.ts` | 학습 퍼즐: 문제 형식·검사·단원 문제 36개·무한 연습 생성기 |
| `src/game/puzzle.test.ts` | 모든 퍼즐이 풀리는지, 생성 문제가 올바른지 자동 테스트 |
| `src/game/aiRunner.ts` | 컴퓨터 계산을 워커(설치형) 또는 시간 나눠 계산(아티팩트)으로 돌림 |
| `src/game/audio.ts` | 완성 마디 리듬 재생 |
| `src/ui/` | React 화면 (설정, 보드, 손패, 점수판, 시트, 퍼즐 목록·풀이, 룰북) |
| `src/ui/rulebookContent.ts` | 룰북 글과 그림 배치 (React 없는 순수 데이터, 숫자는 엔진에서) |
| `scripts/artifact.mjs` | 아티팩트 HTML 조립 (React는 jsDelivr에서 불러옴) |
| `scripts/ai-match.ts` | 컴퓨터 대국 비교 도구 |
| `scripts/preview.mjs` | 인터넷 없이 아티팩트 빌드를 미리 보는 파일 만들기 |
| `public/icons/` | 앱 아이콘 |

## 참고

- 저장: 브라우저 localStorage `rhythm-village-save-v1` (0단계 저장본도 이어하기 가능), 퍼즐 별·연속 정답은 `rhythm-village-puzzles-v1`, 화면 테마는 `rhythm-village-ui-v1`.
- 화면 테마는 `<html data-skin="village|card">`로 CSS 토큰이 바뀝니다 (`src/styles.css` 끝의 '음악 마을 테마' 부분).
- 아티팩트 빌드는 React를 CDN에서 불러오므로 인터넷이 필요합니다. 오프라인·설치는 `build:web` 결과물을 쓰세요.
- 개발 서버에서는 서비스워커가 꺼져 있습니다. 설치·오프라인 동작은 `npm run build:web` → `npm run preview`로 확인합니다.
- 브라우저 콘솔에서 `window.__rv`(게임), `window.__pz`(퍼즐 모듈)로 상태를 볼 수 있습니다 (디버그용).
- 아티팩트 빌드는 워커를 만들지 않습니다(`vite.config.ts`의 aiWorkerStub). 컴퓨터는 한 프레임에 약 10ms씩 나눠 계산해 화면이 멈추지 않습니다.
