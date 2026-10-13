from fastapi.testclient import TestClient


def test_health_returns_ok(client: TestClient) -> None:
    res = client.get("/v1/health")

    assert res.status_code == 200
    assert res.json()["status"] == "ok"


def test_unknown_path_uses_common_error_format(client: TestClient) -> None:
    res = client.get("/v1/does-not-exist")

    assert res.status_code == 404
    body = res.json()
    assert body["error"]["code"] == "NOT_FOUND"
    # 추적 ID가 항상 포함되어야 서버 로그와 대조할 수 있다
    assert len(body["error"]["request_id"]) == 32
