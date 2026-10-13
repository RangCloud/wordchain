# 말꼬리 API

```powershell
uv sync                      # 가상환경 생성 + 의존성 설치
copy .env.example .env
uv run uvicorn app.main:app --reload --port 8000
uv run pytest -q
```

- Swagger: http://localhost:8000/docs (`DEBUG=true`일 때만)
- 상태 확인: http://localhost:8000/v1/health
