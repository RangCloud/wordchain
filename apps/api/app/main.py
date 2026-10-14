"""FastAPI 애플리케이션 진입점.

앱 팩토리(create_app) 패턴을 쓰는 이유:
- 테스트마다 깨끗한 인스턴스를 만들 수 있고,
- 설정(Settings)을 바꿔 끼운 앱을 쉽게 만들 수 있다.
"""

from collections.abc import Awaitable, Callable

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router
from app.core.config import Settings, get_settings
from app.core.errors import error_response, register_exception_handlers
from app.core.rate_limit import SlidingWindowLimiter, retry_after_header
from app.repositories.game_repo import InMemoryGameRepo

MAX_BODY_BYTES = 4096


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or get_settings()

    app = FastAPI(
        title=settings.app_name,
        version=settings.version,
        # 운영에서는 API 구조가 노출되지 않도록 문서 페이지를 끈다
        docs_url="/docs" if settings.debug else None,
        redoc_url=None,
        openapi_url="/openapi.json" if settings.debug else None,
    )

    # 이 API의 요청 본문은 수십 바이트다. 큰 본문은 읽기 전에 거절해 메모리·CPU 낭비를 막는다.
    # Content-Length 없이 보내는 청크 전송까지 막으려면 앞단 프록시에서도 본문 크기를 제한한다
    @app.middleware("http")
    async def limit_body_size(
        request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        length = request.headers.get("content-length")
        if length is not None and (not length.isdigit() or int(length) > MAX_BODY_BYTES):
            return error_response(413, "PAYLOAD_TOO_LARGE", "요청이 너무 커요.")
        return await call_next(request)

    # 요청 제한은 CORS보다 먼저 등록한다. Starlette는 나중에 등록한 미들웨어가 바깥쪽이라,
    # 이렇게 해야 429 응답에도 CORS 헤더가 붙어 Expo 웹에서 오류 코드를 읽을 수 있다
    if settings.rate_limit_per_minute > 0:
        limiter = SlidingWindowLimiter(settings.rate_limit_per_minute)

        @app.middleware("http")
        async def rate_limit(
            request: Request, call_next: Callable[[Request], Awaitable[Response]]
        ) -> Response:
            # 헬스 체크는 배포 플랫폼이 자주 부르므로 제한에서 뺀다
            if request.url.path.endswith("/health"):
                return await call_next(request)
            client_ip = request.client.host if request.client else "unknown"
            wait = limiter.check(client_ip)
            if wait is not None:
                res = error_response(
                    429, "RATE_LIMITED", "요청이 너무 많아요. 잠시 후 다시 시도해 주세요."
                )
                res.headers["Retry-After"] = retry_after_header(wait)
                return res
            return await call_next(request)

    # 모바일 앱은 CORS와 무관하지만, Expo 웹 개발 서버(localhost:8081)에서 호출할 때 필요하다
    if settings.cors_origins:
        app.add_middleware(
            CORSMiddleware,
            allow_origins=settings.cors_origins,
            allow_methods=["GET", "POST"],
            allow_headers=["*"],
        )

    # 게임 세션은 앱 인스턴스마다 따로 둔다 → 테스트마다 create_app()을 부르면 저장소도 깨끗해진다
    app.state.game_repo = InMemoryGameRepo(max_sessions=settings.max_sessions)

    register_exception_handlers(app)
    # 버전 접두사를 두면 나중에 /v2를 추가해도 기존 앱이 깨지지 않는다
    app.include_router(api_router, prefix="/v1")
    return app


app = create_app()
