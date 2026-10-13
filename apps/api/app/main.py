"""FastAPI 애플리케이션 진입점.

앱 팩토리(create_app) 패턴을 쓰는 이유:
- 테스트마다 깨끗한 인스턴스를 만들 수 있고,
- 설정(Settings)을 바꿔 끼운 앱을 쉽게 만들 수 있다.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router
from app.core.config import get_settings
from app.core.errors import register_exception_handlers


def create_app() -> FastAPI:
    settings = get_settings()

    app = FastAPI(
        title=settings.app_name,
        version=settings.version,
        # 운영에서는 API 구조가 노출되지 않도록 문서 페이지를 끈다
        docs_url="/docs" if settings.debug else None,
        redoc_url=None,
        openapi_url="/openapi.json" if settings.debug else None,
    )

    # 모바일 앱은 CORS와 무관하지만, Expo 웹 개발 서버(localhost:8081)에서 호출할 때 필요하다
    if settings.cors_origins:
        app.add_middleware(
            CORSMiddleware,
            allow_origins=settings.cors_origins,
            allow_methods=["GET", "POST"],
            allow_headers=["*"],
        )

    register_exception_handlers(app)
    # 버전 접두사를 두면 나중에 /v2를 추가해도 기존 앱이 깨지지 않는다
    app.include_router(api_router, prefix="/v1")
    return app


app = create_app()
