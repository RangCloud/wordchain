# 말꼬리 (Wordchain) — 프로젝트 규칙

> 이 파일은 **Claude Code**와 **Antigravity**가 함께 따르는 공통 규칙이다.
> 같은 내용을 `CLAUDE.md`와 `AGENTS.md` 두 이름으로 둔다. 답변·주석·커밋 메시지는 **한국어**로 작성한다.
> 기획서(로드맵·명세·테스트 계획): https://claude.ai/code/artifact/5b12347f-b96b-41f1-aa20-4d171be902ff

## 1. 개요
- **제품**: AI와 한 판 2~3분 동안 끝말잇기를 하는 캐주얼 게임 (두음법칙 정확 판정)
- **플랫폼**: Android 우선(Expo Go · EAS Build), iOS는 코드만 호환 유지
- **구조**: 모노레포 — `apps/mobile`(Expo SDK 54 + TypeScript) + `apps/api`(FastAPI + uv)

## 2. 기술 스택 (이 범위 안에서만 작업)
- 앱: Expo + TypeScript(strict), expo-router, @expo/vector-icons(Ionicons)
- 서버: FastAPI, Pydantic v2, pydantic-settings, uv, Ruff, pytest
- **새 라이브러리 도입은 먼저 이유를 설명하고 승인을 받은 뒤** 추가한다. Expo 패키지는 `npx expo install`로 SDK 호환 버전을 설치한다.

## 3. 폴더 구조
- 화면 → `apps/mobile/app/` (파일 = 라우트). 그 외 로직은 모두 `apps/mobile/src/`
  - 공용 UI `src/components/` · 디자인 토큰 `src/theme/` · 순수 유틸 `src/lib/`
  - 기능 단위 `src/features/game/` (타입, 임시 데이터, 타이머 훅)
- 서버 → `apps/api/app/`: 라우터 `api/` · 게임 진행 `services/` · 규칙 엔진 `domain/` · 사전·세션 `repositories/` · 설정/오류 `core/` · 입출력 타입 `schemas/`

## 4. 아키텍처 원칙
- **MVP는 앱 단독(오프라인)**: 판정·AI·타이머를 앱의 `src/features/game/engine.ts`·`localGame.ts`가 처리한다(서버 없이 출시, 2026-11-10 결정). 서버(`apps/api`)는 나중에 랭킹을 붙일 때 서버 권위형으로 다시 쓴다. 앱 엔진과 서버 `domain/`은 같은 규칙을 유지하고 같은 테스트 케이스로 검증한다.
- AI 상대는 LLM이 아니라 **사전 탐색 알고리즘**이다(환각 없음, 빠름, 시드 고정으로 재현 가능한 테스트).
- 규칙 엔진(`domain/`)은 FastAPI·DB를 모르는 **순수 함수**로 작성한다.
- 한글 분해·두음법칙 결과는 `shared/hangul-vectors.json` 테스트 벡터로 앱(TS)과 서버(Python)를 함께 검증한다.
- 외부 API 키는 **서버 `.env`에만** 둔다. 앱 번들·코드·깃에 절대 넣지 않는다.

## 5. 코딩 컨벤션
- TypeScript: 함수형 컴포넌트 + Hooks, `any` 금지, import는 `@/` 별칭(`src/` 기준)
- 색·간격·글자 크기는 `src/theme` 토큰만 쓴다(하드코딩 금지). 글자는 `AppText`로 그린다.
- 계산 로직은 컴포넌트 밖 순수 함수로 분리한다 → 단위 테스트 대상
- Python: 타입 힌트 필수, Ruff 규칙 준수, 오류는 `AppError`를 던지고 HTTP 변환은 `core/errors.py`가 한다
- 주석은 '무엇'보다 **'왜'**를 한국어로 설명한다

## 6. 디자인 가이드
- 콘셉트 "원고지": 단어와 시작 글자를 원고지 칸(`ManuscriptCells`)에 담고, 원고지 초록(`grid`)을 구조선에만 쓴다. 이모지로 하트·아이콘을 대신하지 않는다(벡터 아이콘).
- 똑같은 모양의 둥근 카드를 늘어놓는 SaaS식 화면, 장식용 그라데이션을 쓰지 않는다.
- 터치 영역 최소 48dp, 본문 대비 4.5:1 이상(라이트·다크), 상태는 색 + 모양/문구로 함께 표시한다.
- 아이콘만 있는 버튼은 `accessibilityLabel` + `accessibilityRole="button"` 필수.

## 7. 에이전트 작업 방식 ★
1. 질문과 **직접 관련된 파일·부분만** 읽는다. 추측하지 말고 검색으로 확인한다.
2. 처음 안내할 때 근거·대안·주의점까지 충분히 설명한다.
3. 복잡한 로직(규칙 엔진, 동기화 등)은 **구현 전에 계획을 먼저 제시하고 동의를 받는다.**
4. 변경은 최소·집중. 요청하지 않은 리팩터링이나 파일 생성을 하지 않는다.
5. 작업 후 무엇을, 왜 바꿨는지 짧게 요약한다.

## 8. Git
- GitHub Flow: `main` 보호, `feature/<이슈번호>-<요약>` 브랜치 → PR
- Conventional Commits: `feat:` `fix:` `test:` `docs:` `refactor:` `chore:`
- `.env`, 서명 키(`*.jks`), 빌드 산출물은 커밋 금지. `package-lock.json`, `uv.lock`은 커밋한다.

## 9. 테스트
- 기능 ID(기획서)를 테스트 케이스·이슈·커밋에 함께 적어 추적성을 유지한다.
- 경계값·예외 케이스를 빠뜨리지 않는다. CI(lint · typecheck · test)를 통과해야 머지한다.

## 10. 보안 ★
- 키·토큰·서명 키, 개인정보(이메일·실명·기기 ID), 중요 경로(사용자 홈 경로, 서버 주소·IP, 내부 URL)는 **코드·문서·테스트·커밋 메시지 어디에도 쓰지 않는다.** 예시에는 가짜 값과 `.env.example`만 쓴다.
- 커밋 전에 `git status`와 스테이징된 diff를 확인한다. `.env`, 키, 홈 경로, 이메일, 서버 주소가 보이면 커밋하지 않는다.
- 새 종류의 파일(원본 데이터, DB 파일, 이미지, 로그)을 만들면 `.gitignore`에 넣어야 하는지 먼저 따진다. 사전 원본(`apps/api/data/raw/`)과 가공 DB(`apps/api/data/*.sqlite`)는 커밋하지 않는다.
- 이미 커밋된 비밀값은 삭제 커밋으로 해결되지 않는다. 키를 폐기하고 재발급하도록 알린다.

## 11. 문서·스킬 확인
- 라이브러리·프레임워크 API를 새로 쓰는 코드는 기억에 의존하지 말고 **Context7 MCP로 최신 문서를 먼저 확인**한다("use context7"가 없어도 적용). 외부 라이브러리가 없는 순수 로직은 생략한다.
- UI 작업에는 디자인 비평·접근성 점검 스킬을 쓴다. 쓸 수 없는 스킬·MCP는 추측하지 말고 없다고 알린다.
- 작업 요약에 무엇을 확인했는지 적는다.

## 12. 사전 데이터
- 출처는 국립국어원 표준국어대사전(CC BY-SA 2.0 KR). 조건과 출시 전 점검표는 `README.md`의 "사전 데이터 출처와 라이선스"를 따른다.
- 표제어·품사·뜻풀이만 쓴다. 용례(예문), 발음·이미지 등 다중 매체는 쓰지 않는다.
- 사전 다시 만들기: `apps/api`에서 `uv run python -m scripts.build_dictionary` → 앱 단어 목록 갱신: `uv run python -m scripts.export_word_list` (`apps/mobile/src/features/game/data/words.json`, 단어만·뜻풀이 제외, 커밋한다)

## 13. 진행 상태 (2026-11-13 기준, 작업 후 갱신)
- 작업 브랜치: `feature/offline-mode` (원격: GitHub `RangCloud/wordchain`. PR #1 병합, PR #2 `feature/game-api` → `main` 리뷰 중, PR #3 `feature/offline-mode` → `feature/game-api`(#2 머지 후 base를 `main`으로). 앱 버전 1.0.0)
- **완료**: 서버 `domain/`·게임 API·요청 제한(PR #1·#2). 앱 단독 엔진 `engine.ts`(사전·판정·AI) · `localGame.ts`(진행·점수·시간) · `gameClient.ts`(번들 단어 목록 21만 개 지연 로딩), 화면을 앱 엔진으로 연결, 결과 화면은 뜻풀이 없이 단어만, `eas.json`(preview=APK, production=AAB·자동 versionCode). 테스트 서버 199개 · 앱 150개 통과. EAS 프로젝트 연결, 설정 > 정보에 사전 저작자 표시. 출시 전 QA(`docs/qa/` 보고서 v1.2): 결함 7건 모두 조치(실기기 확인 3건 대기), 앱 아이콘(사전 표지 + '한', `apps/mobile/assets/images/`)·스토어 그래픽(`docs/store/`)·개인정보처리방침 초안(`docs/privacy-policy.md`). 실제 단어 목록으로 AI 대 AI 300판: 잘못된 AI 단어 0, AI 응답 최악 1.4ms(Node).
- **다음**: `eas build -p android --profile preview`로 실기기 QA(TC-W-18, DV-01~06) → 개인정보처리방침 문의처 기입·웹 공개 → production 빌드 → `eas submit`(Play 비공개 테스트 · TestFlight).
- **QA 결과(2026-10-15, 서버 버전)**: TC-W-01~17 자동화, 실제 사전으로 게임 300판 무작위·이상 입력 검사 500 오류 0건, AI 응답 최악 4ms
- **보안 메모**: 앱 단독 버전은 네트워크 요청이 없다. 서버를 다시 붙일 때: 요청 제한 분당 60회·세션 상한 1만(`core/config.py`), 프록시 뒤에서는 uvicorn `--proxy-headers --forwarded-allow-ips`, 출시 빌드는 https만(`api.ts`), 운영 `.env`는 `DEBUG=false`. 로컬 `expo export` 번들에는 Hermes 임시 경로(사용자 폴더명)가 들어가므로 출시 빌드는 EAS 클라우드에서 만든다.
- **정해 둔 것**: 뜻풀이는 앱 용량 때문에 넣지 않는다(A안: 단어만 +0.8MB, 전부 넣으면 +9MB). 앱 엔진의 난수는 mulberry32라 서버(Python random)와 같은 시드라도 AI 수가 다르다(앱 안에서만 재현). 쉬움·보통 AI는 한방단어를 쓰지 않는다(후보가 한방뿐이면 AI 패배). 어려움 AI는 자기 5번째·10번째… 수에서만 한방단어를 쓴다(`HANBANG_EVERY = 5`, 앱 `engine.ts`·서버 `ai_player.py` 같은 규칙, 그 밖의 수에서 한방뿐이면 AI 패배). `judge`는 공백을 제거하지 않는다(진행 계층에서 처리). 동음이의어는 뜻을 하나만 저장한다. UI 디자인은 나중에 다시 바꾸므로 지금은 기존 화면에 데이터만 연결한다. 점수는 받아들여진 단어마다 글자 수 × 10, 승리 시 +100, 모두 난이도 배율(1.0/1.5/2.0)을 곱한다. 무효 제출도 `turn`을 1 올린다(중복 제출 방지). 종료 사유 코드: `timeout` · `no_lives` · `ai_stuck` · `forfeit`(문구는 앱이 정함). 앱 테스트는 Jest 대신 Node 내장 `node:test`(`npm test`, 테스트 파일은 `*.test.mts`). 세션 만료(30분)는 생성이 아니라 마지막 제출·기권 시각 기준이다. 제출 단어는 NFC로 정규화한 뒤 앞뒤 공백을 지운다(앱·서버·화면 즉시 검사 모두). 효과음은 MVP에서 뺐다(토글 없음). 진동은 RN 기본 `Vibration`으로 남은 시간 5초 이하에서 턴마다 1회, 설정은 AsyncStorage(`wordchain.settings.v1`). 스플래시는 `expo-splash-screen` 플러그인(app.json `plugins`, 라이트/다크 배경)으로 지정한다.
- **작업 방식**: 에이전트가 먼저 구현·테스트하고, 그 뒤에 무엇을 왜 했는지 설명한다. 토큰을 아끼기 위해 설명은 핵심만 쓴다.
