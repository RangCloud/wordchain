# 말꼬리 (Wordchain)

AI와 한 판 2~3분 동안 끝말잇기를 하는 캐주얼 게임 (두음법칙 정확 판정).

> 📄 기획서(로드맵 · 기술 스택 · 기능 명세 · 테스트 계획): https://claude.ai/code/artifact/5b12347f-b96b-41f1-aa20-4d171be902ff

## 구조

```text
wordchain/
├─ apps/
│  ├─ mobile/   # Expo SDK 54 + TypeScript + expo-router
│  └─ api/      # FastAPI + uv
├─ docs/        # 기획 · 명세 · 테스트 케이스 · 회고
├─ .github/workflows/ci.yml
├─ .vscode/     # 추천 확장 · 저장 시 포맷 · F5 디버깅 · 작업(Tasks)
└─ CLAUDE.md / AGENTS.md
```

## 처음 실행하기 (Windows PowerShell)

```powershell
# 1) VS Code로 열기 → 오른쪽 아래 '추천 확장 설치' 클릭
code C:\dev\wordchain

# 2) 앱
cd apps\mobile
npm install
npx expo start          # a: Android 에뮬레이터 · w: 웹 브라우저 · QR: 휴대폰 Expo Go

# 3) 서버 (새 터미널)
cd apps\api
uv sync
copy .env.example .env
uv run uvicorn app.main:app --reload --port 8000   # 또는 VS Code에서 F5
uv run pytest -q
```

## 현재 화면 (기본 UI)

| 경로 | 화면 | 상태 |
| --- | --- | --- |
| `index` | 홈: 난이도 선택, 최고 기록, 게임 시작 | 임시 기록 |
| `game/[id]` | 게임: 목숨, 점수, 타이머, 단어 체인, 시작 글자 힌트, 입력 | 임시 진행 상태 |
| `result/[id]` | 결과: 승패, 점수, 사용 단어와 뜻 | 임시 결과 |
| `rules` | 규칙과 두음법칙 예시 | 완료 |
| `settings` | 효과음 · 진동 · 정보 | 화면 상태만 |

## 다음 작업

- [ ] 사전 데이터 이용 약관 확인 → `scripts/build_dictionary.py`
- [ ] `domain/hangul.py` + 테스트 벡터 + 속성 기반 테스트(Hypothesis)
- [ ] `domain/rule_engine.py`, `domain/ai_player.py` → 게임 API 5개 → 앱 연동
