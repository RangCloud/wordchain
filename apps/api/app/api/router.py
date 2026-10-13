"""기능별 라우터를 한곳에서 모은다. 새 기능은 여기에 include_router 한 줄만 추가한다."""

from fastapi import APIRouter

from app.api import health

api_router = APIRouter()
api_router.include_router(health.router)
