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
- **서버 권위형**: 단어 판정·AI 수·타이머 검증은 서버가 한다. 앱은 입력과 표시만 담당한다.
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
