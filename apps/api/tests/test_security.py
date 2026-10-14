"""남용 방지 (기획서 2-4 429 RATE_LIMITED, 세션 상한)."""

from fastapi.testclient import TestClient

from app.api.games import get_dictionary
from app.core.config import Settings
from app.core.rate_limit import SlidingWindowLimiter, retry_after_header
from app.main import create_app
from tests.domain_fixtures import make_dictionary


def make_client(**overrides: int) -> TestClient:
    app = create_app(Settings(**overrides))
    app.dependency_overrides[get_dictionary] = make_dictionary
    return TestClient(app)


class FakeTime:
    def __init__(self) -> None:
        self.now = 1000.0

    def __call__(self) -> float:
        return self.now


# --- 요청 제한 ---


def test_limiter_allows_up_to_limit_then_blocks_until_window_passes() -> None:
    t = FakeTime()
    limiter = SlidingWindowLimiter(limit=2, window_seconds=60, clock=t)

    assert limiter.check("a") is None
    t.now += 10
    assert limiter.check("a") is None
    t.now += 10
    # 첫 요청(1000초)이 창에서 빠지는 1060초까지 40초 남았다
    assert limiter.check("a") == 40
    t.now += 40
    assert limiter.check("a") is None


def test_limiter_counts_each_ip_separately() -> None:
    limiter = SlidingWindowLimiter(limit=1, clock=FakeTime())

    assert limiter.check("a") is None
    assert limiter.check("b") is None
    assert limiter.check("a") is not None


def test_limiter_forgets_idle_ips() -> None:
    t = FakeTime()
    limiter = SlidingWindowLimiter(limit=1, window_seconds=60, clock=t)
    limiter.check("a")
    t.now += 61

    limiter.check("b")

    assert "a" not in limiter._hits


def test_retry_after_is_rounded_up_to_at_least_one_second() -> None:
    assert retry_after_header(0.2) == "1"
    assert retry_after_header(40.1) == "41"


def test_api_returns_429_in_common_error_format() -> None:
    client = make_client(rate_limit_per_minute=2)
    client.post("/v1/games", json={})
    client.post("/v1/games", json={})

    res = client.post("/v1/games", json={})

    assert res.status_code == 429
    assert res.json()["error"]["code"] == "RATE_LIMITED"
    assert int(res.headers["Retry-After"]) >= 1


def test_health_is_not_rate_limited() -> None:
    client = make_client(rate_limit_per_minute=1)

    codes = {client.get("/v1/health").status_code for _ in range(5)}

    assert codes == {200}


def test_rate_limit_can_be_disabled() -> None:
    client = make_client(rate_limit_per_minute=0)

    codes = {client.post("/v1/games", json={}).status_code for _ in range(5)}

    assert codes == {201}


# --- 세션 상한 ---


def test_new_game_is_refused_when_sessions_are_full() -> None:
    client = make_client(max_sessions=1, rate_limit_per_minute=0)
    first = client.post("/v1/games", json={})

    res = client.post("/v1/games", json={})

    assert res.status_code == 503
    assert res.json()["error"]["code"] == "SERVER_BUSY"
    # 이미 시작한 게임은 계속할 수 있어야 한다
    assert client.get(f"/v1/games/{first.json()['game_id']}").status_code == 200


# --- 오류 응답에 내부 정보가 새지 않는지 ---


def test_unexpected_error_hides_internal_details() -> None:
    app = create_app(Settings(rate_limit_per_minute=0))

    def broken_dictionary() -> None:
        raise RuntimeError("secret internal path /srv/data")

    app.dependency_overrides[get_dictionary] = broken_dictionary
    res = TestClient(app, raise_server_exceptions=False).post("/v1/games", json={})

    assert res.status_code == 500
    assert res.json()["error"]["code"] == "INTERNAL_ERROR"
    assert "secret" not in res.text and "/srv" not in res.text


def test_docs_are_hidden_when_debug_is_off() -> None:
    client = TestClient(create_app(Settings(debug=False)))

    assert client.get("/docs").status_code == 404
    assert client.get("/openapi.json").status_code == 404
