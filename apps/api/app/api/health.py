"""서버 상태 확인 엔드포인트. 배포 후 헬스 체크와 앱의 연결 확인에 쓴다."""

from fastapi import APIRouter

from app.core.config import get_settings
from app.schemas.common import HealthResponse

router = APIRouter(tags=["health"])


@router.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    return HealthResponse(status="ok", version=get_settings().version)
