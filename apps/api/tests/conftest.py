import pytest
from fastapi.testclient import TestClient

from app.main import create_app


@pytest.fixture
def client() -> TestClient:
    # 테스트마다 새 앱 인스턴스를 만들어 테스트 간 상태가 섞이지 않게 한다
    return TestClient(create_app())
