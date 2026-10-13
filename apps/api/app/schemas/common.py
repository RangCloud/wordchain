"""여러 엔드포인트가 함께 쓰는 응답 스키마."""

from pydantic import BaseModel


class ErrorDetail(BaseModel):
    code: str  # 앱이 분기 처리에 쓰는 고정 코드 (예: RATE_LIMITED)
    message: str  # 사용자에게 보여줄 수 있는 한국어 문장
    request_id: str  # 서버 로그와 대조하기 위한 추적 ID


class ErrorResponse(BaseModel):
    """모든 오류 응답의 공통 형식: {"error": {...}}"""

    error: ErrorDetail


class HealthResponse(BaseModel):
    status: str
    version: str
