"""공통 오류 처리.

원칙
1. 서비스 계층은 HTTP를 모른다. 도메인 오류(AppError)만 던지고, HTTP 응답 변환은 여기서 한다.
2. 어떤 오류든 클라이언트는 같은 형식({"error": {code, message, request_id}})을 받는다.
   → 앱은 code 하나로 분기하면 되고, 테스트도 형식 하나만 검증하면 된다.
3. 내부 원인(스택 트레이스, 검증 상세)은 로그에만 남기고 응답에는 노출하지 않는다(보안).
"""

import logging
import uuid

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.schemas.common import ErrorDetail, ErrorResponse

logger = logging.getLogger(__name__)


class AppError(Exception):
    """도메인 오류의 기반 클래스."""

    def __init__(self, code: str, message: str, status_code: int = 400) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.status_code = status_code


def _new_request_id() -> str:
    return uuid.uuid4().hex


def _error_response(status_code: int, code: str, message: str, request_id: str) -> JSONResponse:
    body = ErrorResponse(error=ErrorDetail(code=code, message=message, request_id=request_id))
    return JSONResponse(status_code=status_code, content=body.model_dump())


def error_response(status_code: int, code: str, message: str) -> JSONResponse:
    """예외 처리기 밖(미들웨어)에서도 같은 오류 형식을 쓰기 위한 함수."""
    return _error_response(status_code, code, message, _new_request_id())


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def handle_app_error(_: Request, exc: AppError) -> JSONResponse:
        return _error_response(exc.status_code, exc.code, exc.message, _new_request_id())

    @app.exception_handler(RequestValidationError)
    async def handle_validation_error(_: Request, exc: RequestValidationError) -> JSONResponse:
        request_id = _new_request_id()
        logger.info("validation error [%s]: %s", request_id, exc.errors())
        return _error_response(
            422, "VALIDATION_ERROR", "요청 형식이 올바르지 않습니다.", request_id
        )

    @app.exception_handler(StarletteHTTPException)
    async def handle_http_error(_: Request, exc: StarletteHTTPException) -> JSONResponse:
        code = "NOT_FOUND" if exc.status_code == 404 else "HTTP_ERROR"
        return _error_response(exc.status_code, code, str(exc.detail), _new_request_id())

    @app.exception_handler(Exception)
    async def handle_unexpected(_: Request, exc: Exception) -> JSONResponse:
        # 예상하지 못한 오류: 스택 트레이스는 로그로, 응답에는 추적 ID만 준다
        request_id = _new_request_id()
        logger.exception("unhandled error [%s]", request_id)
        return _error_response(500, "INTERNAL_ERROR", "서버 오류가 발생했습니다.", request_id)
