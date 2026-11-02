# 리듬마을 (Music Rudiment Carcassonne)

음표 타일을 이어 붙여 리듬선을 만들고, 마디줄로 끊어 **박자의 합이 딱 4박인 마디**를 완성하면 점수를 얻는 타일 놓기 음악 보드게임과 그 웹앱입니다. 게임을 하다 보면 음표값 읽기와 박 더하기, 마디 나누기를 자연스럽게 익히게 됩니다.

## 폴더

| 위치 | 내용 |
|---|---|
| [`webapp/`](webapp/) | 웹앱 소스 (Vite + React 18 + TypeScript). 실행·빌드 방법은 [`webapp/README.md`](webapp/README.md) |
| [`docs/리듬마을_웹앱_개발구상.md`](docs/리듬마을_웹앱_개발구상.md) | 개발 구상, 규칙 해석, 결정 사항, 검증 기록 |

## 웹앱 기능

- 한 기기로 2~4명이 번갈아 두기(핫시트), 또는 컴퓨터(쉬움·보통·어려움)와 대국
- 첫 판 튜토리얼, 마디가 닫힐 때 "몇 박?"을 먼저 묻는 검산 퀴즈, 완성 마디 리듬 소리
- 학습 퍼즐 36문제(5단원: 1·2·4박 → 점2분음표 → 쉼표 → 8분·점4분음표 → 3/4·2/4 박자표) + 끝없이 만들어지는 무한 연습
- 난이도 Lv0 입문 · Lv1 기본 · Lv2 심화(8분·점4분음표, 쉼표, 박자표)
- 화면 그림 두 가지: '음악 마을'(기본, 나무 테이블 위 풀밭 타일) · '카드'(인쇄용 카드 색)
- 설치형(PWA): 한 번 열면 인터넷 없이도 실행

## 바로 해 보기

**https://kimyounggaur.github.io/Music_Rudiment_Carcassonne/** (GitHub Pages)

같은 앱이 Vercel에도 올라가 있습니다: https://webapp-phi-mauve.vercel.app/

- 안드로이드 태블릿·크롬북·PC 크롬: 첫 화면의 '앱으로 설치' 버튼 (또는 주소창의 설치 아이콘)
- 아이패드·아이폰: Safari로 열고 공유 버튼 → '홈 화면에 추가'
- 한 번 열어 두면 와이파이 없이도 실행됩니다. 새 버전은 다음에 인터넷이 될 때 자동으로 받습니다.

`main`에 push하면 두 곳 모두 자동으로 갱신됩니다.
- GitHub Pages: GitHub Actions가 자동 테스트 → 설치형 빌드 → 배포 ([`.github/workflows/pages.yml`](.github/workflows/pages.yml))
- Vercel: 저장소와 연결되어 push마다 빌드·배포 (설정: [`vercel.json`](vercel.json), [`webapp/vercel.json`](webapp/vercel.json)). 다른 브랜치에 push하면 미리보기 주소가 따로 생깁니다.

## 빠른 시작

```bash
cd webapp
npm install
npm run dev        # 개발 서버
npm test           # 자동 테스트 (규칙 엔진·컴퓨터·퍼즐)
npm run build:web  # 설치형 버전 → webapp/dist-web/
```

`webapp/dist-web/` 폴더는 Netlify·Vercel 같은 다른 정적 호스팅에도 그대로 올릴 수 있습니다.

## 참고

카르카손(Carcassonne)은 해당 권리자의 상표입니다. 이 프로젝트는 그 타일 놓기 방식에서 착안한 음악 교육용 게임이며, 원작의 그림·디자인은 쓰지 않고 독창적인 그림으로 만들었습니다.
